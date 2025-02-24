// components/emailUtils.js
const { Recipient, EmailParams, MailerSend } = require("mailersend");

const mailersend = new MailerSend({
  apiKey: process.env.MAILER_SEND_API,
});

// Ensure template IDs are correctly loaded and trimmed.
const verifyTemplateId = process.env.VERIFY_TEMPLATE_ID ? process.env.VERIFY_TEMPLATE_ID.trim() : "pr9084zo6xmlw63d";
const forgotTemplateId = process.env.FORGOT_TEMPLATE_ID ? process.env.FORGOT_TEMPLATE_ID.trim() : "your_forgot_template_id";

console.log("Using VERIFY_TEMPLATE_ID:", verifyTemplateId);
console.log("Using FORGOT_TEMPLATE_ID:", forgotTemplateId);

const sendVerificationEmail = async ({ to, toName, username, verifyUrl, supportEmail }) => {
  console.log("Sending verification email to:", to);

  const recipients = [new Recipient(to, toName)];
  const personalization = [
    {
      email: to,
      data: {
        username,
        verifyUrl,
        support_email: supportEmail,
      },
    },
  ];
  const emailParams = new EmailParams()
  .setFrom({
    email: process.env.EMAIL_FROM ? process.env.EMAIL_FROM.trim() : "info@domain.com",
    name: process.env.EMAIL_FROM_NAME ? process.env.EMAIL_FROM_NAME.trim() : "Your Name"
  })
  .setTo(recipients)
  .setReplyTo({
    email: process.env.EMAIL_FROM ? process.env.EMAIL_FROM.trim() : "info@domain.com",
    name: process.env.EMAIL_FROM_NAME ? process.env.EMAIL_FROM_NAME.trim() : "Your Name"
  })
  .setSubject("Verify your email address")
  .setTemplateId(verifyTemplateId)
  .setPersonalization(personalization);
  
  try {
    const result = await mailersend.email.send(emailParams);
    return result;
  } catch (error) {
    throw error;
  }
};

const sendForgotPasswordEmail = async ({ to, toName, username, resetUrl, supportEmail }) => {
  console.log("Sending forgot password email to:", to);

  const recipients = [new Recipient(to, toName)];
  const personalization = [
    {
      email: to,
      data: {
        username,
        resetUrl,
        support_email: supportEmail,
      },
    },
  ];
  const emailParams = new EmailParams()
  .setFrom({
    email: process.env.EMAIL_FROM ? process.env.EMAIL_FROM.trim() : "info@domain.com",
    name: process.env.EMAIL_FROM_NAME ? process.env.EMAIL_FROM_NAME.trim() : "Your Name"
  })
  .setTo(recipients)
  .setReplyTo({
    email: process.env.EMAIL_FROM ? process.env.EMAIL_FROM.trim() : "info@domain.com",
    name: process.env.EMAIL_FROM_NAME ? process.env.EMAIL_FROM_NAME.trim() : "Your Name"
  })
  .setSubject("Reset your Password")
  .setTemplateId(forgotTemplateId)
  .setPersonalization(personalization);
  try {
    const result = await mailersend.email.send(emailParams);
    return result;
  } catch (error) {
    throw error;
  }
};

module.exports = { sendVerificationEmail, sendForgotPasswordEmail };
