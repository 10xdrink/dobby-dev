const ContactSupport = require("../models/ContactSupport");
const { sendEmail } = require("../utils/mailer"); 

// Send support request
exports.sendSupportMessage = async (req, res) => {
  try {
    const { shopName, email, receiverEmail, subject, message } = req.body;

    if (!shopName || !email || !receiverEmail || !subject || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    
    const support = new ContactSupport({
      shopName,
      email,
      receiverEmail,
      subject,
      message
    });
    await support.save();

   
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
        <h2>📩 New Contact Support Request</h2>
        <p><strong>Shop Name:</strong> ${shopName}</p>
        <p><strong>Sender Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <blockquote style="background:#f9f9f9;padding:10px;border-left:3px solid #007bff;">
          ${message}
        </blockquote>
        <hr/>
        <p style="color:gray;font-size:13px;">This message was sent via Dobby Mall Contact Support.</p>
      </div>
    `;

    // Send mail
    await sendEmail(receiverEmail, `Support Request: ${subject}`, htmlContent);

    res.json({
      success: true,
      message: "Support request sent successfully!"
    });

  } catch (error) {
    console.error(" Error in sendSupportMessage:", error.message);
    res.status(500).json({ message: "Failed to send support request", error: error.message });
  }
};
