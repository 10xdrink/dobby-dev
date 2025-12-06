require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


async function sendOTP(email, otp) {
  const mailOptions = {
    from: `"Digital Mongers" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your OTP Code for Login',
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 16px;">
        <p>Hi,</p>
        <p>Your OTP code is:</p>
        <h2 style="background: #f0f0f0; padding: 10px; display: inline-block;">${otp}</h2>
        <p>This code will expire in 1 minute.</p>
        <br/>
        <p>Thanks,<br/>Campus Affinity Team</p>
      </div>
    `
  };
  await transporter.sendMail(mailOptions);
  console.log(` OTP ${otp} sent to ${email}`);
}


async function sendEmail(to, subject, htmlContent) {
  const mailOptions = {
    from: `"Digital Mongers" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: htmlContent
  };
  await transporter.sendMail(mailOptions);
  console.log(`Email sent to ${to} | Subject: ${subject}`);
}

module.exports = { sendOTP, sendEmail };
