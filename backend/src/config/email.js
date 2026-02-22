import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const FROM_ADDRESS = process.env.SMTP_FROM || 'noreply@eadeies.local';

export const imapConfig = {
  host: process.env.IMAP_HOST,
  port: Number(process.env.IMAP_PORT) || 993,
  tls: process.env.IMAP_TLS !== 'false',
  user: process.env.IMAP_USER,
  password: process.env.IMAP_PASS,
};
