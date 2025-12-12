require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const requestLogger = require("./middleware/requestLogger");
const safeLogger = require("./middleware/safeLogger");
const requestId = require("./middleware/requestId");
const morgan = require('morgan');



const authRoutes = require("./routes/authRoutes");
const shopRoutes = require("./routes/shopRoutes");

const { passport, setupOAuthStrategies } = require("./config/passport");

// const paymentRoutes = require("./routes/paymentRoutes");
const contactRoutes = require("./routes/contactRoutes");
const productRoutes = require("./routes/productRoutes");

const seoRoutes = require("./routes/seoRoutes");
const roleRoutes = require("./routes/roleRoutes");
const discountRoutes = require("./routes/discountRoutes");
const { errorHandler } = require("./middleware/errorHandler");

const aboutRoutes = require("./routes/aboutRoutes");
const termsRoutes = require("./routes/termsRoutes");
const privacyRoutes = require("./routes/privacyRoutes");
const blogRoutes = require("./routes/blogRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const faqRoutes = require("./routes/faqRoutes");

const topbarRoutes = require("./routes/topbarRoutes");
const secondTopbarRoutes = require("./routes/secondTopbarRoutes");
const cancellationRoutes = require("./routes/cancellationRoutes");
const shippingRoutes = require("./routes/shippingRoutes");
const refundPolicyRoutes = require("./routes/refundPolicy");
const returnPolicyRoutes = require("./routes/returnPolicyRoutes");
const ContactUsRoutes = require("./routes/contactUsRoutes");
const cookieParser = require("cookie-parser");
const seedAdmin = require("./utils/seed");
const adminLoginRoutes = require("./routes/adminLoginRoutes");
const countryRoutes = require("./routes/countryRoutes");
const dummyProductRoutes = require("./routes/dummyProductRoutes");
const compnayInfoRoutes = require("./routes/companyInfoRoutes");
const newsletterRoutes = require("./routes/newsletterRoutes");
const logoRoutes = require("./routes/logoRoutes");
const bannerRoutes = require("./routes/bannerRoutes");
const campaignRoutes = require("./routes/campaignRoutes");
const socialMediaRoutes = require("./routes/socialMediaRoutes");
const companyRealiabilityRoutes = require("./routes/companyReliabilityRoutes");
// const settingsRoutes = require("./routes/settingsRoutes");
const socialmediachatRoutes = require("./routes/socialmediachatRoutes");
const adminmailtemplateRoutes = require("./routes/adminmailtemplateRoutes");
const suppliermailtemplateRoutes = require("./routes/suppliermailtemplateRoutes");
const studentfaqRoutes = require("./routes/studentfaqRoutes");
const traininginfoRoutes = require("./routes/trainingInfoRoutes");
const customerRoutes = require("./routes/customerRoutes");
const customertemplateRoutes = require("./routes/customermailtemplateRoutes");
const environmentRoutes = require("./routes/environmentRoutes");
const modeMiddleware = require("./middleware/modeMiddleware");
const debugLogger = require("./middleware/debugLogger");
const { debugHandler } = require("./middleware/debugHandler");
const currencyRoutes = require("./routes/currencyRoutes");
const urlSettingsRoutes = require("./routes/urlsettingsRoutes");
const otpsettingsRoutes = require("./routes/otpsettingsRoutes");
const mailconfigRoutes = require("./routes/mailconfigRoutes");
const smsconfigRoutes = require("./routes/smsconfigRoutes");
const employeeroleRoutes = require("./routes/employeeroleRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const employeeauthRoutes = require("./routes/employeeauthRoutes");
const oauthRoutes = require("./routes/oauthRoutes");
const mapsettingsRoutes = require("./routes/mapsettingsRoutes");
const paymentgatewayRoutes = require("./routes/paymentgatewayRoutes");
const studentqueryRoutes = require("./routes/studentqueryRoutes");
const productcategoryRoutes = require("./routes/productcategoryRoutes");
const productsubcategoryRoutes = require("./routes/productsubcategoryRoutes");
const seedCustomerGroups = require("./utils/seedCustomerGroups");
const customergroupRoutes = require("./routes/customergroupRoutes");
const pricingRuleRoutes = require("./routes/pricingruleRoutes");
const seosettingsRoutes = require("./routes/seosettingsRoutes");
const shopkeeperfaqRoutes = require("./routes/shopkeeperfaqRoutes");
const contactsupportRoutes = require("./routes/contactsupportRoutes");
const couponRoutes = require("./routes/couponRoutes");
const flashsaleRoutes = require("./routes/flashsaleRoutes");
const upsellruleRoutes = require("./routes/upsellruleRoutes");
const referralclickRoutes = require("./routes/referralclickRoutes");
const adminreviewRoutes = require("./routes/adminreviewRoutes");
const categorysortRoutes = require("./routes/categorysortRoutes");
const newarrivalsettingRoutes = require("./routes/newarrivalsettingRoutes");
const topratedsettingRoutes = require("./routes/topratedsettingRoutes");
const shopsortsettingRoutes = require("./routes/shopsortsettingRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const returnRoutes = require("./routes/returnRoutes");
const imageSearchRoutes = require("./routes/imageSearchRoutes");
const addressRoutes = require("./routes/addressRoutes");
const abandonedcartRoutes = require("./routes/abandonedcartRoutes");
const shiprocketRoutes = require("./routes/shiprocketRoutes");
const shiprocketwebhookRoutes = require("./routes/shiprocketWebhookRoute");
const fedxRoutes = require("./routes/fedxRoutes");
const fedxwebhookRoutes = require("./routes/fedxwebhookRoutes");
const sliderRoutes = require("./routes/sliderRoutes");
const shopOrderRoutes = require("./routes/shopOrderRoutes");
const shopCustomerRoutes = require("./routes/shopCustomerRoutes");
const truestedlogoRoutes = require("./routes/trustedlogoRoutes");
const shopkeeperAnalyticsRoutes = require("./routes/shopkeeperanalyticsRoutes");
const graphanalyticsRoutes = require("./routes/graphanalyticsRoutes");
const inventoryreportRoutes = require("./routes/inventoryRoutes");
const shippingruleRoutes = require("./routes/shippingruleRoutes");
const taxsettingsRoutes = require("./routes/taxsettingsRoutes");
const ordercancelRoutes = require("./routes/orderCancelRoutes");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");
const analyticsJob = require("./cron/analyticsJob");
const { autoDeactivateExpired } = require("./controllers/couponController");
const flashSaleCron = require("./cron/flashSaleCron");
const  { startCustomerGroupingCron }  = require("./cron/customerGroupingCron");
const pricingRuleCron = require("./cron/pricingRuleCron");
const cartupsellRoutes = require("./routes/cartupsellRoutes")
const upsintegrationRoutes = require("./routes/upsIntegrationRoutes")
const shopkeeperdashboardRoutes = require("./routes/shopkeeperDashboardRoutes")
const cookiesettingsRoutes = require("./routes/cookiesettingsRoute")
const customermanagementRoutes = require("./routes/customerManagementRoutes")
const salesreportRoutes = require("./routes/salesreportRoutes")
const adminInventoryRoutes = require("./routes/inventoryreportRoutes")
const customeranalyticsRoutes = require("./routes/customeranalyticsRoutes")
const admindashboardRoutes = require("./routes/admindashboardRoutes")
const invoiceRoutes = require("./routes/invoiceRoutes")
const copyrightRoutes = require("./routes/copyrightRoutes")
const shopreviewRoutes = require("./routes/shopReviewRoutes")
const bulkUploadRoutes = require("./routes/bulkUploadRoutes")
const { initializeSitemapHooks } = require("./hooks/sitemapHooks");
const sitemapRoutes = require("./routes/sitemapRoutes");
const robotsRoutes = require("./routes/robotsRoutes");
const session = require("express-session");

const path = require("path");

console.log(" Loaded RECAPTCHA_SECRET_KEY:", process.env.RECAPTCHA_SECRET_KEY);

connectDB();

(async () => {
  try {
    await seedAdmin();
    await setupOAuthStrategies();
    await seedCustomerGroups();
    console.log("OAuth strategies initialized");
  } catch (err) {
    console.error("Error in initialization:", err);
  }
})();

require("./cron/abandonedCron");
analyticsJob.init();


initializeSitemapHooks();

flashSaleCron.start();
console.log(" Flash Sale cron job started - runs every 5 minutes");

startCustomerGroupingCron();

pricingRuleCron.start();

const app = express();

// Rate limiter
const limiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 15 minutes
  max: 5000, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message:
      "Too many requests from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS Configuration - Allow requests from frontend
app.use(cors({
  origin: [
    'http://localhost:8081',  // Expo web
    'http://localhost:19006', // Expo web alternative port
    'http://localhost:3000',  // Alternative frontend port
    'exp://localhost:8081',   // Expo app
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.set("trust proxy", 1);

const isProduction = process.env.NODE_ENV?.trim() === "production";

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("isProduction:", isProduction);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

app.use(modeMiddleware);


app.use(requestId);
app.use(requestLogger);
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}


app.use(limiter);

app.use(debugLogger);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "mysecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      httpOnly: true,
      maxAge: 1000 * 60 * 60,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/webhooks")) {
    next();
  } else {
    express.json({ limit: "10mb" })(req, res, next);
  }
});



app.use("/api/payments", require("./routes/paymentRoutes"));

app.use("/webhooks", require("./routes/webhookRoutes"));

app.use("/api/students", require("./routes/studentRoutes"));
app.use("/api/auth", authRoutes);
app.use("/api/shops", shopRoutes);
// app.use("/api/payments", paymentRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/products", productRoutes);
app.use("/api/image-search", imageSearchRoutes);

app.use("/api/seo", seoRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/discounts", discountRoutes);

app.use("/api/about", aboutRoutes);
app.use("/api/terms", termsRoutes);
app.use("/api/privacyPolicy", privacyRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/blog", blogRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/faqs", faqRoutes);

app.use("/api/topbar", topbarRoutes);
app.use("/api/secondtopbar", secondTopbarRoutes);
app.use("/api/cancellation", cancellationRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/refundPolicy", refundPolicyRoutes);
app.use("/api/returnPolicy", returnPolicyRoutes);
app.use("/api/contactUs", ContactUsRoutes);
app.use("/api/dummy", dummyProductRoutes);

app.use("/api/customergroup", customergroupRoutes);

app.use("/api/admin", adminLoginRoutes);

app.use("/api/countries", countryRoutes);

app.use("/api/companyInfo", compnayInfoRoutes);

app.use("/api/newsletter", newsletterRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/logo", logoRoutes);

app.use("/api/banner", bannerRoutes);
app.use("/api/campaign", campaignRoutes);
app.use("/api/socialMedia", socialMediaRoutes);
app.use("/api/companyReliability", companyRealiabilityRoutes);

// app.use("/api/settings", settingsRoutes);
app.use("/api/socialmediachat", socialmediachatRoutes);
app.use("/api/template", adminmailtemplateRoutes);
app.use("/api/supplierTemplate", suppliermailtemplateRoutes);
app.use("/api/studentfaq", studentfaqRoutes);
app.use("/api/traininginfo", traininginfoRoutes);

app.use("/api/customer", customerRoutes);

app.use("/api/customerTemplate", customertemplateRoutes);

app.use("/api/environment", environmentRoutes);
app.use("/api/currency", currencyRoutes);

app.use("/api/url", urlSettingsRoutes);
app.use("/api/otpSettings/", otpsettingsRoutes);

app.use("/api/mail", mailconfigRoutes);
app.use("/api/sms", smsconfigRoutes);

app.use("/api/employeeRole", employeeroleRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/employeeAuth", employeeauthRoutes);

app.use("/api/oauth", oauthRoutes);

app.use("/api/map", mapsettingsRoutes);

app.use("/api/paymentGateway", paymentgatewayRoutes);

app.use("/api/studentQuery", studentqueryRoutes);

app.use("/api/productCategory", productcategoryRoutes);
app.use("/api/productSubCategory", productsubcategoryRoutes);

app.use("/api/pricingRule", pricingRuleRoutes);

app.use("/api/seoShopkeeper", seosettingsRoutes);
app.use("/api/shopkeeperfaq", shopkeeperfaqRoutes);
app.use("/api/contactSupport", contactsupportRoutes);
app.use("/api/coupon", couponRoutes);

app.use("/api/flashSale", flashsaleRoutes);
app.use("/api/upsellRule", upsellruleRoutes);

app.use("/api/referral", referralclickRoutes);

app.use("/api/adminReview", adminreviewRoutes);

app.use("/api/sort", categorysortRoutes);
app.use("/api/arrivalProduct", newarrivalsettingRoutes);
app.use("/api/topRated", topratedsettingRoutes);
app.use("/api/shopSort", shopsortsettingRoutes);

app.use("/", robotsRoutes);
app.use("/", sitemapRoutes);

app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);

app.use("/api/notifications", notificationRoutes);

app.use("/api/order", orderRoutes);
app.use("/api/returnRequest", returnRoutes);
app.use("/api/address", addressRoutes);

app.use("/api/abandonedCart", abandonedcartRoutes);
app.use("/api/shiprocket", shiprocketRoutes);

app.use("/api/shiprocketWebhook", shiprocketwebhookRoutes);

app.use("/api/fedx", fedxRoutes);
app.use("/api/fedxWebhook", fedxwebhookRoutes);

app.use("/api/sliders", sliderRoutes)
app.use("/api/shopOrder", shopOrderRoutes);
app.use("/api/shopCustomer", shopCustomerRoutes);
app.use("/api/trustedLogo", truestedlogoRoutes);

app.use("/api/shopkeeperAnalytics", shopkeeperAnalyticsRoutes);
app.use("/api/graphAnalytics", graphanalyticsRoutes);
app.use("/api/inventoryReport", inventoryreportRoutes);

app.use("/api/shippingRule", shippingruleRoutes)
app.use("/api/taxSettings", taxsettingsRoutes);

app.use("/api/cancelOrder", ordercancelRoutes);

app.use("/api/cartUpsell", cartupsellRoutes )

app.use("/api/upsIntegration", upsintegrationRoutes)

app.use("/api/shopkeeperDashboard", shopkeeperdashboardRoutes)
app.use("/api/cookieSettings", cookiesettingsRoutes)
app.use("/api/adminCustomer", customermanagementRoutes)

app.use("/api/adminSales", salesreportRoutes)

app.use("/api/adminInventory", adminInventoryRoutes)
app.use("/api/adminCustomeranalytics", customeranalyticsRoutes)

app.use("/api/adminDashboard", admindashboardRoutes)

app.use("/api/invoice", invoiceRoutes)

app.use("/api/copyright", copyrightRoutes)

app.use("/api/shopReview", shopreviewRoutes)

app.use("/api/bulkProduct", bulkUploadRoutes)

//  Cron job to auto deactivate expired coupons
cron.schedule("0 0 * * *", async () => {
  console.log(" Running auto deactivate coupon job...");
  try {
    await autoDeactivateExpired();
    console.log(" Expired coupons deactivated automatically.");
  } catch (err) {
    console.error(" Cron job error:", err);
  }
});

cron.schedule("0 0 * * *", async () => {
  console.log("Running auto deactivate flash sales...");
  try {
    await autoDeactivateExpiredSales();
    console.log("Expired flash sales deactivated automatically.");
  } catch (err) {
    console.error("Cron job error:", err);
  }
});

app.use(debugHandler);

app.use(errorHandler);
app.use(safeLogger);


app.get("/", (req, res) => res.send("API Running"));
const http = require("http");
const { setupSocket } = require("./socket/socket");

const server = http.createServer(app);
setupSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
