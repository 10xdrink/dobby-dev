const mongoose = require("mongoose");

const MailConfigSchema = new mongoose.Schema({
  mailerName: { type: String, required: true }, // e.g. Dobby
  host: { type: String, required: true },       // e.g. smtp.gmail.com
  port: { type: Number, required: true },       // e.g. 465
  username: { type: String, required: true },   // e.g. support@dobby.com
  emailId: { type: String, required: true },    // from email address
  password: { type: String, required: true },   // SMTP password / app password
  encryption: { type: String, enum: ["ssl", "tls"], default: "ssl" }
}, { timestamps: true });

module.exports = mongoose.model("MailConfig", MailConfigSchema);
