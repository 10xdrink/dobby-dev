const Contact = require("../models/contactModel");

const submitContactForm = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const newMessage = await Contact.create({ name, email, subject, message });

    res.status(201).json({
      success: true,
      message: "Your message has been submitted successfully!",
      data: newMessage,
    });
  } catch (error) {
    console.error("Error submitting contact form:", error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { submitContactForm };
