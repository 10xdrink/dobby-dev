const cron = require("node-cron");
const AbandonedCart = require("../models/AbandonedCart");
const Customer = require("../models/Customer");
const Product = require("../models/productModel");
const { sendEmail } = require("../utils/mailer");

cron.schedule("*/5 * * * *", async () => {
  console.log(" Abandoned Cart Reminder Cron Started...");

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const carts = await AbandonedCart.find({
      status: "pending",
      updatedAt: { $lte: oneDayAgo },
    })
      .populate("customer", "email firstName")
      .populate("product", "productName icon1 icon2");

    for (const cart of carts) {
      if (!cart.customer?.email) continue;

      const email = cart.customer.email;
      const name = cart.customer.firstName || "Customer";
      const product = cart.product?.productName || "your product";
      const productImage =
        cart.product?.icon1 ||
        (cart.product?.icon2?.length ? cart.product.icon2[0] : null) ||
        "https://via.placeholder.com/150";

      const subject = `Still thinking about ${product}? Complete your purchase today!`;

      //  Enterprise-Grade Flipkart-Style Template
      const htmlContent = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f8; padding: 30px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 3px 10px rgba(0,0,0,0.08);">
            
            <!-- Header -->
            <div style="background-color: #2874f0; padding: 18px 25px;">
              <h2 style="color: #ffffff; margin: 0; font-weight: 600; font-size: 22px;">Dobby Mall</h2>
            </div>

            <!-- Body -->
            <div style="padding: 25px;">
              <p style="font-size: 16px; color: #333; margin: 0 0 10px;">Hi <b>${name}</b>,</p>
              <p style="font-size: 15px; color: #555; margin: 0 0 20px;">
                You left an item waiting in your cart. Complete your purchase before it goes out of stock!
              </p>

              <!-- Product Section -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 10px;">
                <tr>
                  <td width="100" align="center" style="padding: 10px;">
                    <img src="${productImage}" alt="${product}" width="80" height="80"
                      style="border-radius: 6px; object-fit: cover; display: block;" />
                  </td>
                  <td style="padding: 10px 15px; vertical-align: middle;">
                    <p style="margin: 0; font-size: 16px; font-weight: 600; color: #222;">${product}</p>
                    <p style="margin: 5px 0 0; color: #777; font-size: 14px;">Available now on <b>Dobby Mall</b></p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <div style="text-align: center; margin-top: 25px;">
                <a href="https://test-dobby.vercel.app/cart"
                   style="background-color: #fb641b; color: #ffffff; padding: 12px 28px; text-decoration: none; 
                          border-radius: 5px; font-weight: 600; font-size: 15px; display: inline-block;">
                  Go to Cart 🛒
                </a>
              </div>

              <p style="font-size: 14px; color: #555; margin-top: 25px; text-align: center;">
                Hurry! Your saved item might sell out soon.
              </p>

              <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">

              <!-- Footer -->
              <div style="text-align: center;">
                <p style="font-size: 13px; color: #888; margin: 0;">
                  Thank you for shopping with <b style="color:#2874f0;">Dobby Mall</b> ❤️
                </p>
                <p style="font-size: 12px; color: #aaa; margin-top: 5px;">
                  © ${new Date().getFullYear()} Dobby Mall. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </div>
      `;

      await sendEmail(email, subject, htmlContent);

      await AbandonedCart.updateOne(
        { _id: cart._id },
        { $set: { status: "sent", lastUpdated: new Date() } }
      );

      console.log(` Reminder sent to ${email} for product ${product}`);
    }

    console.log(" Abandoned Cart Cron completed.");
  } catch (err) {
    console.error(" Abandoned Cart Cron Error:", err.message);
  }
});
