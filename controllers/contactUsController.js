const ContactUs = require("../models/contactUs");
const { sendEmail } = require("../utils/mailer");

exports.createContactUs = async (req, res) => {
  try {
    const contact = new ContactUs(req.body);
    await contact.save();

    res.status(201).json({
      success: true,
      message: "contact submitted successfully",
      data: contact.toObject(),
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getContactUs = async (req, res) => {
  try {
    const { filter, search } = req.query;
    let query = {};

    // filters
    if (filter === "unread") query.status = "Unread";
    else if (filter === "responded") query.status = "Responded";
    else if (filter === "spam") query.status = "Spam";
    else if (filter === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      query.createdAt = { $gte: today, $lt: tomorrow };
    } else if (filter === "lastweek") {
      const today = new Date();
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);
      query.createdAt = { $gte: lastWeek, $lt: today };
    }

    // search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { interest: { $regex: search, $options: "i" } }
      ];
    }

    const contacts = await ContactUs.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Unread", "Responded", "Spam"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const updated = await ContactUs.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "contact not found" });
    }

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteContact = async (req, res) => {
  const { id } = req.params;

  const deleted = await ContactUs.findByIdAndDelete(id);

  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: "Contact not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "Contact deleted successfully",
    deleted,
  });
};





exports.replyToContact = async (req, res) => {
  try {
    const { id } = req.params; // contact id
    const { replyMessage } = req.body;

    const contact = await ContactUs.findById(id);
    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    // send email
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; font-size: 16px;">
        <p>Hi ${contact.name},</p>
        <p>${replyMessage}</p>
        <br/>
        <p>Thanks,<br/>Support Team</p>
      </div>
    `;

    await sendEmail(contact.email, "Reply from Support", htmlContent);

    // update DB
    contact.status = "Responded";
    contact.adminReply = replyMessage;
    contact.respondedAt = new Date();
    await contact.save();

    res.status(200).json({
      success: true,
      message: "Reply sent successfully",
      data: contact,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
