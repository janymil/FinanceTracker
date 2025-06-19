
import { Request, Response } from 'express';
import nodemailer from 'nodemailer';

export async function handleContactForm(req: Request, res: Response) {
  console.log('=== CONTACT FORM REQUEST RECEIVED ===');
  console.log('Method:', req.method);
  console.log('Body:', req.body);
  
  try {
    // Validate POST method
    if (req.method !== 'POST') {
      console.log('Invalid method, returning 405');
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

    console.log('Starting email send process...');
    
    // Verify email configuration exists
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_TO) {
      throw new Error('Missing email configuration');
    }
    
    console.log('Email config verified, creating transporter...');
    
    // Configure SMTP transporter
    const transportConfig = {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    };
    
    console.log('Transport config:', {
      host: transportConfig.host,
      port: transportConfig.port,
      secure: transportConfig.secure,
      user: transportConfig.auth.user?.substring(0, 3) + '***'
    });
    
    const transporter = nodemailer.createTransport(transportConfig);

    // Email options - use authenticated email as sender, user email as reply-to
    const mailOptions = {
      from: `"FinanzerPro Contact Form" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `[Contact Form] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      replyTo: email
    };

    console.log('Sending email to:', process.env.EMAIL_TO);
    
    // Send email
    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);

    return res.json({ success: true });

  } catch (error) {
    console.error('Contact form error details:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      emailConfig: {
        host: process.env.EMAIL_HOST ? 'configured' : 'missing',
        port: process.env.EMAIL_PORT || 'default(587)',
        user: process.env.EMAIL_USER ? 'configured' : 'missing',
        pass: process.env.EMAIL_PASS ? 'configured' : 'missing',
        to: process.env.EMAIL_TO ? 'configured' : 'missing'
      }
    });
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to send message' 
    });
  }
}
