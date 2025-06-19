
import { Request, Response } from 'express';
import nodemailer from 'nodemailer';

export async function handleContactForm(req: Request, res: Response) {
  try {
    // Validate POST method
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Extract form data
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }

    // Configure SMTP transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Email options - use authenticated email as sender, include user email in body
    const mailOptions = {
      from: `"FinanzerPro Contact Form" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `[Contact Form] ${subject}`,
      text: `Contact Form Submission\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`
    };

    // Send email
    await transporter.sendMail(mailOptions);

    return res.json({ success: true });

  } catch (error) {
    console.error('Contact form error:', error instanceof Error ? error.message : error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to send message' 
    });
  }
}
