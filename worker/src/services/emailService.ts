import nodemailer, { Transporter } from 'nodemailer';

// Ethereal is a free email catching service for developers.
// We initialize the transporter with a test account.
let transporter: Transporter | null = null;

export const initEmailService = async () => {
  if (transporter) return;
  
  // Create a test account dynamically for development
  let testAccount = await nodemailer.createTestAccount();
  
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: testAccount.user, // generated ethereal user
      pass: testAccount.pass, // generated ethereal password
    },
  });
  console.log('[EmailService] Ethereal Email Transporter Ready!');
  console.log(`[EmailService] Username: ${testAccount.user}`);
};

export const sendEmail = async (to: string, subject: string, html: string) => {
  if (!transporter) await initEmailService();
  
  try {
    const info = await transporter!.sendMail({
      from: '"Smriti AI" <smriti@example.com>',
      to,
      subject,
      html,
    });
    
    console.log(`[EmailService] Email sent to ${to}. Message ID: ${info.messageId}`);
    // Preview URL will show you the exact email that was sent in your browser!
    console.log(`[EmailService] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    
    return true;
  } catch (error) {
    console.error(`[EmailService] Failed to send email to ${to}`, error);
    return false;
  }
};
