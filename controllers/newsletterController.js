const axios = require("axios");
const crypto = require("crypto");
const Subscriber = require("../models/Newsletter")
const nodemailer = require("nodemailer");
const { sendEmail } = require("../utils/mailer"); 
const PersonalizedEmail = require("../models/PersonalizedEmail");

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER = process.env.MAILCHIMP_SERVER;
const AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;


function getSubscriberHash(email) {
  return crypto.createHash("md5").update(email.toLowerCase()).digest("hex");
}


exports.subscribeUser = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const subscriberHash = getSubscriberHash(email);

    await axios.put(
      `https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/lists/${AUDIENCE_ID}/members/${subscriberHash}`,
      { email_address: email, status: "subscribed" },
      { headers: { Authorization: `apikey ${MAILCHIMP_API_KEY}` } }
    );

    const subscriber = await Subscriber.findOneAndUpdate(
      { email },
      { subscribedAt: new Date(), unsubscribedAt: null },
      { new: true, upsert: true }
    );

    res.json({ message: "Subscribed successfully", subscriber });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Subscription failed" });
  }
};


exports.handleWebhook = async (req, res) => {
  try {
    const event = req.body;

    if (!event || !event.type) {
      return res.status(200).send("Webhook Verified");
    }

    const email = event?.data?.email;
    if (!email) return res.status(200).json({ message: "No email in event" });

    if (event.type === "unsubscribe") {
      await Subscriber.findOneAndUpdate({ email }, { unsubscribedAt: new Date() });
    } else if (event.type === "subscribe") {
      await Subscriber.findOneAndUpdate(
        { email },
        { subscribedAt: new Date(), unsubscribedAt: null },
        { upsert: true }
      );
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook failed" });
  }
};


exports.getSubscribers = async (req, res) => {
  try {
    const subs = await Subscriber.find().sort({ subscribedAt: -1 });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch subscribers" });
  }
};




exports.sendPersonalizedEmail = async (req, res) => {
  try {
    const { subscriberId } = req.params;
    const { subject, content, discountCode, productUrl } = req.body;

    const subscriber = await Subscriber.findById(subscriberId);
    if (!subscriber) return res.status(404).json({ error: "Subscriber not found" });

    if (subscriber.unsubscribedAt) {
      return res
        .status(400)
        .json({ error: "This subscriber has unsubscribed, cannot send email." });
    }


    const html = `
  <div style="background:#f4f6f8;padding:40px 0;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="max-width:680px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,0.08);">

      <!-- HEADER -->
      <div style="background:linear-gradient(90deg,#2874f0,#2b62e2);color:#ffffff;text-align:center;padding:28px 20px;">
        <h1 style="margin:0;font-size:28px;letter-spacing:0.5px;">🛍️ Dobby Mall</h1>
        <p style="margin:6px 0 0;font-size:15px;opacity:0.9;">Empowering Smart Shopping Experiences</p>
      </div>

      <!-- BODY -->
      <div style="padding:35px 30px;line-height:1.8;color:#333;">
        <h2 style="font-size:22px;margin-bottom:15px;">${subject}</h2>
        <p style="font-size:15px;color:#555;margin-bottom:25px;">
          ${content}
        </p>

        ${
          discountCode
            ? `
          <div style="background:#f0f6ff;border-left:4px solid #2874f0;padding:18px 20px;border-radius:8px;margin-bottom:25px;">
            <p style="margin:0;font-size:16px;color:#2874f0;font-weight:600;">🎁 Exclusive Offer Just for You</p>
            <h2 style="margin:8px 0;font-size:26px;letter-spacing:1px;color:#222;">${discountCode}</h2>
            <p style="margin:0;color:#2874f0;font-size:14px;">Apply this code at checkout and enjoy your savings!</p>
          </div>`
            : ""
        }

        ${
          productUrl
            ? `
          <div style="text-align:center;margin-top:25px;">
            <a href="${productUrl}" target="_blank"
              style="background:#2874f0;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;display:inline-block;box-shadow:0 2px 5px rgba(40,116,240,0.4);transition:all .3s;">
              🚀 Shop Now
            </a>
          </div>`
            : ""
        }

        <div style="margin-top:35px;padding:20px;background:#fafafa;border-radius:8px;border:1px solid #eee;">
          <p style="margin:0;font-size:14px;color:#555;">
            💡 <b>Pro Tip:</b> Stay logged in to your Dobby Mall account for faster checkout and personalized offers.
          </p>
        </div>

        <hr style="border:none;border-top:1px solid #eee;margin:35px 0;">

        <p style="text-align:center;font-size:14px;color:#666;margin:0;">
          Stay connected with <b>Dobby Mall</b> for the latest deals, curated just for you.
        </p>
      </div>

      <!-- FOOTER -->
      <div style="background:#f9fafc;padding:20px;text-align:center;font-size:12px;color:#888;border-top:1px solid #e5e5e5;">
        <p style="margin:0;">📩 You are receiving this email because you subscribed to <b>Dobby Mall</b> updates.</p>
        <p style="margin:6px 0 0;">To unsubscribe, visit your profile settings or click “Unsubscribe” in our future emails.</p>
        <p style="margin:10px 0 0;font-size:11px;color:#aaa;">© ${new Date().getFullYear()} Dobby Mall Pvt. Ltd. All rights reserved.</p>
      </div>
    </div>
  </div>
`;

    // Send using AWS SES mailer
    await sendEmail(subscriber.email, subject, html);

    // Save record in DB
    const saved = await PersonalizedEmail.create({
      subscriber: subscriber._id,
      email: subscriber.email,
      subject,
      content,
      discountCode,
      productUrl,
      sentBy: req.user?.email || "admin",
    });

    res.json({ message: "Personalized email sent via AWS SES & saved", data: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send personalized email" });
  }
};