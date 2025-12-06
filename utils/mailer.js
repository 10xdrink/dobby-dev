// const nodemailer = require("nodemailer");
// const MailConfig = require("../models/MailConfig");

// async function getTransporter() {
//   const config = await MailConfig.findOne();
//   if (!config) throw new Error("SMTP config not found, please set in admin panel!");

//   console.log(" [Mailer] Loaded SMTP Config:");
//   console.log({
//     host: config.host,
//     port: config.port,
//     encryption: config.encryption,
//     username: config.username,
//     emailId: config.emailId,
//   });

//   // Debugging note: don't log password obviously.
//   const transporter = nodemailer.createTransport({
//     host: config.host,
//     port: config.port,
//     secure: config.encryption === "ssl",
//     auth: {
//       user: config.username,
//       pass: config.password,
//     },
//   });

//   // Verify transporter connectivity
//   try {
//     await transporter.verify();
//     console.log(" [Mailer] SMTP connection verified successfully.");
//   } catch (err) {
//     console.error(" [Mailer] SMTP verification failed:");
//     console.error("Error name:", err.name);
//     console.error("Error code:", err.code);
//     console.error("Error message:", err.message);
//   }

//   return { transporter, config };
// }

// async function sendOTP(email, otp, subject = "Your OTP Code for Login", message = "This code will expire in 1 minute.") {
//   const { transporter, config } = await getTransporter();

//   const mailOptions = {
//     from: `"${config.mailerName}" <${config.emailId}>`,
//     to: email,
//     subject,
//     html: `
//       <div style="font-family: Arial, sans-serif; font-size: 16px;">
//         <p>Hi,</p>
//         <p>Your OTP code is:</p>
//         <h2 style="background: #f0f0f0; padding: 10px; display: inline-block;">${otp}</h2>
//         <p>${message}</p>
//         <br/>
//         <p>Thanks,<br/>Team Dobby Mall</p>
//       </div>
//     `
//   };

//   try {
//     console.log(` [Mailer] Sending OTP mail to ${email} ...`);
//     await transporter.sendMail(mailOptions);
//     console.log(` [Mailer] OTP ${otp} sent successfully to ${email}`);
//   } catch (err) {
//     console.error(` [Mailer] Failed to send OTP to ${email}`);
//     console.error("Error name:", err.name);
//     console.error("Error code:", err.code);
//     console.error("Error message:", err.message);
//     console.error("Full error object:", err);
//     throw new Error("Unable to send OTP. Please try again later.");
//   }
// }

// async function sendEmail(to, subject, htmlContent) {
//   const { transporter, config } = await getTransporter();

//   const mailOptions = {
//     from: `"${config.mailerName}" <${config.emailId}>`,
//     to,
//     subject,
//     html: htmlContent,
//   };

//   try {
//     console.log(` [Mailer] Sending email to ${to} | Subject: ${subject}`);
//     await transporter.sendMail(mailOptions);
//     console.log(` [Mailer] Email sent successfully to ${to}`);
//   } catch (err) {
//     console.error(` [Mailer] Failed to send email to ${to}`);
//     console.error("Error name:", err.name);
//     console.error("Error code:", err.code);
//     console.error("Error message:", err.message);
//     console.error("Full error object:", err);
//     throw new Error("Unable to send email. Please try again later.");
//   }
// }

// module.exports = { sendOTP, sendEmail };

const AWS = require('aws-sdk');

// Configure AWS SES
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1'
});

const ses = new AWS.SES({ apiVersion: '2010-12-01' });

function getMailConfig() {
  const config = {
    fromEmail: process.env.FROM_EMAIL || 'info@10xdrink.com',
    mailerName: 'Dobby Mall'
  };

  console.log(" [Mailer] AWS SES Config:");
  console.log({
    region: process.env.AWS_REGION,
    fromEmail: config.fromEmail,
    mailerName: config.mailerName
  });

  return config;
}

async function sendOTP(email, otp, subject = "Your OTP Code for Login", message = "This code will expire in 1 minute.") {
  const config = getMailConfig();

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; font-size: 16px;">
      <p>Hi,</p>
      <p>Your OTP code is:</p>
      <h2 style="background: #f0f0f0; padding: 10px; display: inline-block;">${otp}</h2>
      <p>${message}</p>
      <br/>
      <p>Thanks,<br/>Team Dobby Mall</p>
    </div>
  `;

  const params = {
    Source: `${config.mailerName} <${config.fromEmail}>`,
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: 'UTF-8'
        }
      }
    }
  };

  try {
    console.log(` [Mailer] Sending OTP to ${email}...`);
    await ses.sendEmail(params).promise();
    console.log(` [Mailer] OTP ${otp} sent successfully to ${email}`);
  } catch (err) {
    console.error(` [Mailer] Failed to send OTP to ${email}`);
    console.error("Error code:", err.code);
    console.error("Error message:", err.message);
    console.error("Error status:", err.statusCode);
    console.error("Full error:", JSON.stringify(err, null, 2));
    
    // Check for common AWS SES errors
    if (err.code === 'MessageRejected' && err.message.includes('Email address is not verified')) {
      throw new Error(`Email address ${config.fromEmail} is not verified in AWS SES. Please verify it first.`);
    }
    throw new Error("Unable to send OTP. Please try again later.");
  }
}

async function sendEmail(to, subject, htmlContent) {
  const config = getMailConfig();

  const params = {
    Source: `${config.mailerName} <${config.fromEmail}>`,
    Destination: {
      ToAddresses: [to]
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: htmlContent,
          Charset: 'UTF-8'
        }
      }
    }
  };

  try {
    console.log(` [Mailer] Sending email to ${to} | Subject: ${subject}`);
    await ses.sendEmail(params).promise();
    console.log(` [Mailer] Email sent successfully to ${to}`);
  } catch (err) {
    console.error(` [Mailer] Failed to send email to ${to}`);
    console.error("Error code:", err.code);
    console.error("Error message:", err.message);
    console.error("Error status:", err.statusCode);
    console.error("Full error:", JSON.stringify(err, null, 2));
    
    // Check for common AWS SES errors
    if (err.code === 'MessageRejected' && err.message.includes('Email address is not verified')) {
      throw new Error(`Email address ${config.fromEmail} is not verified in AWS SES. Please verify it first.`);
    }
    throw new Error("Unable to send email. Please try again later.");
  }
}

module.exports = { sendOTP, sendEmail };

