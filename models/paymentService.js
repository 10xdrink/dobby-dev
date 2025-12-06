const Payment = require("../models/Payment");
const PaymentGateway = require("../models/PaymentGateway");
const Cart = require("../models/Cart");
const Customer = require("../models/Customer");
const crypto = require("crypto");
const Stripe = require("stripe");
const Razorpay = require("razorpay");
const paypal = require("@paypal/checkout-server-sdk");

function createIdempotencyKey() {
  return crypto.randomBytes(16).toString("hex");
}

async function getActiveGatewayConfig(name) {
  const cfg = await PaymentGateway.findOne({ name, isActive: true });
  if (!cfg) throw new Error(`${name} gateway not available`);
  return cfg;
}

/**
 * createOrderPaymentSession
 * - user initiates checkout -> call this
 * - it snapshots cart items and address into payment.metadata
 * - returns gateway-specific client data (stripe client_secret / razorpay order etc)
 */
exports.createOrderPaymentSession = async ({ customerId, addressId, gateway }) => {
  // fetch cart
  const cart = await Cart.findOne({ customer: customerId }).populate("items.product");
  if (!cart || cart.items.length === 0) throw new Error("Cart is empty");

  // compute totals - assume cart.totalAmount exists via method
  cart.calculateTotal(); // ensure
  const total = cart.totalAmount;

  // snapshot items
  const itemsSnapshot = cart.items.map(i => ({
    product: i.product._id,
    name: i.product.productName,
    sku: i.product.sku,
    price: i.priceAtAddition || i.product.finalPrice || i.product.unitPrice,
    quantity: i.quantity
  }));

  // create Payment record in DB
  const idempotencyKey = createIdempotencyKey();
  const payment = new Payment({
    owner: customerId,  // reuse owner field to store who initiated (schema earlier used owner for shopkeeper) - acceptable
    amount: total,
    currency: "INR",
    gateway,
    status: "pending",
    idempotencyKey,
    metadata: {
      type: "orderPayment",
      customerId,
      addressId,
      itemsSnapshot
    }
  });
  await payment.save();

  // create gateway-specific client info
  if (gateway === "stripe") {
    const cfg = await getActiveGatewayConfig("stripe");
    const stripe = Stripe(cfg.credentials.apiKey);
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: "inr",
      metadata: { paymentId: payment._id.toString(), type: "orderPayment" },
    }, { idempotencyKey });

    payment.gatewayOrderId = pi.id;
    payment.clientSecret = pi.client_secret;
    await payment.save();

    return { paymentId: payment._id, gateway: "stripe", clientSecret: pi.client_secret };
  }

  if (gateway === "razorpay") {
    const cfg = await getActiveGatewayConfig("razorpay");
    const rzp = new Razorpay({ key_id: cfg.credentials.apiKey, key_secret: cfg.credentials.apiSecret });
    const options = {
      amount: Math.round(total * 100),
      currency: "INR",
      receipt: `order_${payment._id}`,
      payment_capture: 1,
    };
    const order = await rzp.orders.create(options);
    payment.gatewayOrderId = order.id;
    await payment.save();
    return { paymentId: payment._id, gateway: "razorpay", orderId: order.id, amount: order.amount };
  }

  if (gateway === "paypal") {
    const cfg = await getActiveGatewayConfig("paypal");
    const environment = new paypal.core.SandboxEnvironment(cfg.credentials.clientId, cfg.credentials.clientSecret);
    const client = new paypal.core.PayPalHttpClient(environment);
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: "INR", value: (total).toFixed(2) } }],
      application_context: { brand_name: "Dobby Mall" }
    });

    const order = await client.execute(request);
    payment.gatewayOrderId = order.result.id;
    await payment.save();

    const approveLink = order.result.links.find(l => l.rel === "approve")?.href;
    return { paymentId: payment._id, gateway: "paypal", approveLink };
  }

  throw new Error("Unsupported gateway");
};

module.exports = exports;
