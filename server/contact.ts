import { Request, Response } from 'express';
import * as nodemailer from 'nodemailer';
import { log } from './logger';

export async function handleContactForm(req: Request, res: Response) {
  // No need for req.method check since this is already a POST route
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    const port = parseInt(process.env.EMAIL_PORT || '587');
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: port,
      secure: port === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"Kaptia Contact Form" <info@kaptia.app>`,
      to: process.env.EMAIL_TO,
      subject: `[Contact Form] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage: ${message}`
    };

    await transporter.sendMail(mailOptions);
    return res.json({ success: true });
  } catch (error) {
    if (!res.headersSent) {
      log.error('Contact form error:', error);
      return res.status(500).json({ success: false, error: 'Failed to send message' });
    } else {
      log.error('Headers already sent. Contact form error:', error);
    }
  }
}