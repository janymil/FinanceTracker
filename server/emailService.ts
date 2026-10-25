import { log } from './logger';
import { MailService } from '@sendgrid/mail';
import nodemailer, { type Transporter } from 'nodemailer';

const hasSendGrid = Boolean(process.env.SENDGRID_API_KEY);
const hasSmtp = Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);

if (!hasSendGrid && !hasSmtp) {
  console.warn("No email transport configured (SENDGRID_API_KEY or EMAIL_*). Email notifications will be disabled.");
} else if (!hasSendGrid) {
  log.info("Email notifications use the SMTP transport (EMAIL_* configured).");
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

let smtpTransporter: Transporter | null = null;

function getSmtpTransporter(): Transporter | null {
  if (!hasSmtp) return null;
  if (!smtpTransporter) {
    const port = parseInt(process.env.EMAIL_PORT || '587', 10);
    smtpTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST as string,
      port,
      secure: port === 465,
      auth: {
        user: process.env.EMAIL_USER as string,
        pass: process.env.EMAIL_PASS as string,
      },
    });
  }
  return smtpTransporter;
}

/** True when at least one email transport (SendGrid or SMTP) is configured. */
export function isEmailConfigured(): boolean {
  return hasSendGrid || hasSmtp;
}

export type EmailTransportStatus = 'unconfigured' | 'unknown' | 'ok' | 'failed';

let transportStatus: EmailTransportStatus = isEmailConfigured() ? 'unknown' : 'unconfigured';
let transportStatusDetail = isEmailConfigured() ? '' : 'No SENDGRID_API_KEY or EMAIL_* settings';

/** Last known transport state — cheap, so health checks and the admin screen can read it. */
export function getEmailTransportStatus(): { status: EmailTransportStatus; detail: string } {
  return { status: transportStatus, detail: transportStatusDetail };
}

/**
 * Proves the credentials really work. `sendEmail` swallows failures by design (a failed
 * receipt reminder must not crash a route), which is exactly how a wrong SMTP password
 * stayed invisible for days. The bootstrap calls this once and reports loudly.
 */
export async function verifyEmailTransport(): Promise<{ status: EmailTransportStatus; detail: string }> {
  if (hasSendGrid) {
    transportStatus = 'ok';
    transportStatusDetail = 'SendGrid API key configured';
    return getEmailTransportStatus();
  }

  const transporter = getSmtpTransporter();
  if (!transporter) {
    transportStatus = 'unconfigured';
    transportStatusDetail = 'No SENDGRID_API_KEY or EMAIL_* settings';
    return getEmailTransportStatus();
  }

  try {
    await transporter.verify();
    transportStatus = 'ok';
    transportStatusDetail = `SMTP ${process.env.EMAIL_HOST} accepted ${process.env.EMAIL_USER}`;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    transportStatus = 'failed';
    transportStatusDetail = detail;
  }
  return getEmailTransportStatus();
}


interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  const message = {
    to: params.to,
    from: params.from,
    subject: params.subject,
    text: params.text ?? '',
    html: params.html,
  };

  // Prefer SendGrid when a key is present, otherwise use SMTP.
  if (hasSendGrid) {
    try {
      await mailService.send(message);
      return true;
    } catch (error) {
      console.error('SendGrid email error:', error);
      if (!hasSmtp) return false;
    }
  }

  const transporter = getSmtpTransporter();
  if (!transporter) {
    log.info('Email transport not configured, skipping email:', params.subject);
    return false;
  }

  try {
    await transporter.sendMail(message);
    return true;
  } catch (error) {
    console.error('SMTP email error:', error);
    return false;
  }
}

// Payment failure notification templates
export async function sendPaymentFailureNotification(
  userEmail: string,
  userName: string,
  failureReason: string,
  graceExpiresAt: Date
): Promise<boolean> {
  const subject = 'Payment Failed - Action Required';
  const graceExpiry = graceExpiresAt.toLocaleDateString();
  
  const text = `
Hi ${userName},

We were unable to process your payment for your Kaptia subscription.

Failure reason: ${failureReason}

Don't worry - your account will remain active until ${graceExpiry}. Please update your payment method to continue enjoying all features.

To update your payment method:
1. Sign in to your account
2. Go to Account Settings
3. Update your payment information

If you need help, please contact our support team.

Best regards,
The Kaptia Team
  `.trim();

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Payment Failed - Action Required</h2>
  
  <p>Hi ${userName},</p>
  
  <p>We were unable to process your payment for your Kaptia subscription.</p>
  
  <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Failure reason:</strong> ${failureReason}
  </div>
  
  <p>Don't worry - your account will remain active until <strong>${graceExpiry}</strong>. Please update your payment method to continue enjoying all features.</p>
  
  <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>To update your payment method:</strong>
    <ol>
      <li>Sign in to your account</li>
      <li>Go to Account Settings</li>
      <li>Update your payment information</li>
    </ol>
  </div>
  
  <p>If you need help, please contact our support team.</p>
  
  <p>Best regards,<br>The Kaptia Team</p>
</div>
  `;

  return sendEmail({
    to: userEmail,
    from: 'noreply@kaptia.app',
    subject,
    text,
    html
  });
}

export async function sendGraceExpiryWarning(
  userEmail: string,
  userName: string,
  hoursRemaining: number
): Promise<boolean> {
  const subject = 'Account Access Expires Soon - Payment Required';
  
  const text = `
Hi ${userName},

Your Kaptia account access will expire in ${hoursRemaining} hours due to a failed payment.

Please update your payment method immediately to avoid service interruption.

To update your payment method:
1. Sign in to your account
2. Go to Account Settings
3. Update your payment information

If you need help, please contact our support team.

Best regards,
The Kaptia Team
  `.trim();

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #dc3545;">Account Access Expires Soon</h2>
  
  <p>Hi ${userName},</p>
  
  <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Your Kaptia account access will expire in ${hoursRemaining} hours due to a failed payment.</strong>
  </div>
  
  <p>Please update your payment method immediately to avoid service interruption.</p>
  
  <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>To update your payment method:</strong>
    <ol>
      <li>Sign in to your account</li>
      <li>Go to Account Settings</li>
      <li>Update your payment information</li>
    </ol>
  </div>
  
  <p>If you need help, please contact our support team.</p>
  
  <p>Best regards,<br>The Kaptia Team</p>
</div>
  `;

  return sendEmail({
    to: userEmail,
    from: 'noreply@kaptia.app',
    subject,
    text,
    html
  });
}

export async function sendAccountDowngradedNotification(
  userEmail: string,
  userName: string
): Promise<boolean> {
  const subject = 'Account Downgraded to Free Plan';
  
  const text = `
Hi ${userName},

Your Kaptia account has been downgraded to the Free plan due to payment issues.

You can still access basic features, but premium features are now restricted.

To restore your premium access:
1. Sign in to your account
2. Go to Account Settings
3. Update your payment information
4. Resubscribe to your preferred plan

If you need help, please contact our support team.

Best regards,
The Kaptia Team
  `.trim();

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Account Downgraded to Free Plan</h2>
  
  <p>Hi ${userName},</p>
  
  <p>Your Kaptia account has been downgraded to the Free plan due to payment issues.</p>
  
  <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>You can still access basic features, but premium features are now restricted.</strong>
  </div>
  
  <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>To restore your premium access:</strong>
    <ol>
      <li>Sign in to your account</li>
      <li>Go to Account Settings</li>
      <li>Update your payment information</li>
      <li>Resubscribe to your preferred plan</li>
    </ol>
  </div>
  
  <p>If you need help, please contact our support team.</p>
  
  <p>Best regards,<br>The Kaptia Team</p>
</div>
  `;

  return sendEmail({
    to: userEmail,
    from: 'noreply@kaptia.app',
    subject,
    text,
    html
  });
}

// Collaborative Goal Invitation Email Templates
interface GoalInvitationParams {
  recipientEmail: string;
  recipientName: string;
  inviterName: string;
  goalName: string;
  goalDescription: string;
  targetAmount: string;
  targetDate: Date;
  goalUrl: string;
  isExistingUser: boolean;
}

export async function sendGoalInvitationEmail(params: GoalInvitationParams): Promise<boolean> {
  const { 
    recipientEmail, 
    recipientName, 
    inviterName, 
    goalName, 
    goalDescription, 
    targetAmount, 
    targetDate, 
    goalUrl, 
    isExistingUser 
  } = params;

  const formattedAmount = `$${parseFloat(targetAmount).toLocaleString()}`;
  const formattedDate = new Date(targetDate).toLocaleDateString();
  
  if (isExistingUser) {
    // Email for existing users
    const subject = `${inviterName} invited you to join "${goalName}" savings goal`;
    
    const text = `
Hi ${recipientName},

${inviterName} has invited you to join their collaborative savings goal "${goalName}"!

Goal Details:
• Target Amount: ${formattedAmount}
• Target Date: ${formattedDate}
• Description: ${goalDescription}

Join this goal to save together and achieve your financial targets faster. Collaborative goals are proven to increase success rates by 40%!

Click here to view and join the goal:
${goalUrl}

Start contributing today and be part of this exciting savings journey!

Best regards,
The Kaptia Team
    `.trim();

    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎯 You're Invited to Save Together!</h1>
  </div>
  
  <div style="padding: 30px; background: white;">
    <p style="font-size: 16px; color: #333;">Hi ${recipientName},</p>
    
    <p style="font-size: 16px; color: #333;">
      <strong>${inviterName}</strong> has invited you to join their collaborative savings goal 
      <strong style="color: #667eea;">"${goalName}"</strong>!
    </p>
    
    <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0; color: #333;">🎯 Goal Details</h3>
      <ul style="margin: 0; padding-left: 20px; color: #555;">
        <li><strong>Target Amount:</strong> ${formattedAmount}</li>
        <li><strong>Target Date:</strong> ${formattedDate}</li>
        <li><strong>Description:</strong> ${goalDescription}</li>
      </ul>
    </div>
    
    <p style="font-size: 16px; color: #333;">
      Join this goal to save together and achieve your financial targets faster. 
      <strong style="color: #28a745;">Collaborative goals are proven to increase success rates by 40%!</strong>
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${goalUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
        🚀 View & Join Goal
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; text-align: center;">
      Start contributing today and be part of this exciting savings journey!
    </p>
  </div>
  
  <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
    <p>Best regards,<br>The Kaptia Team</p>
  </div>
</div>
    `;

    return sendEmail({
      to: recipientEmail,
      from: 'noreply@kaptia.app',
      subject,
      text,
      html
    });
  } else {
    // Email for new users
    const subject = `${inviterName} invited you to join Kaptia and save together!`;
    
    const text = `
Hi there,

${inviterName} has invited you to join Kaptia and participate in their collaborative savings goal "${goalName}"!

Goal Details:
• Target Amount: ${formattedAmount}
• Target Date: ${formattedDate}
• Description: ${goalDescription}

Kaptia is a smart personal finance app that helps you:
✓ Track expenses with AI-powered categorization
✓ Set and achieve savings goals
✓ Collaborate with friends and family on financial goals
✓ Get personalized financial insights

Join for free and start saving together:
${goalUrl}

Why collaborative goals work:
• 40% higher success rate than solo saving
• Motivation through shared progress
• Accountability from friends/family
• Celebration of achievements together

Start your financial journey today!

Best regards,
The Kaptia Team
    `.trim();

    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Welcome to Kaptia!</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">You've been invited to save together</p>
  </div>
  
  <div style="padding: 30px; background: white;">
    <p style="font-size: 16px; color: #333;">Hi there,</p>
    
    <p style="font-size: 16px; color: #333;">
      <strong>${inviterName}</strong> has invited you to join <strong style="color: #667eea;">Kaptia</strong> 
      and participate in their collaborative savings goal <strong>"${goalName}"</strong>!
    </p>
    
    <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0; color: #333;">🎯 Goal Details</h3>
      <ul style="margin: 0; padding-left: 20px; color: #555;">
        <li><strong>Target Amount:</strong> ${formattedAmount}</li>
        <li><strong>Target Date:</strong> ${formattedDate}</li>
        <li><strong>Description:</strong> ${goalDescription}</li>
      </ul>
    </div>
    
    <div style="background-color: #e8f4fd; border-radius: 8px; padding: 20px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0; color: #1976D2;">📱 What is Kaptia?</h3>
      <p style="margin: 0; color: #333;">Kaptia is a smart personal finance app that helps you:</p>
      <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #555;">
        <li>✓ Track expenses with AI-powered categorization</li>
        <li>✓ Set and achieve savings goals</li>
        <li>✓ Collaborate with friends and family on financial goals</li>
        <li>✓ Get personalized financial insights</li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${goalUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
        🚀 Join for FREE & Start Saving
      </a>
    </div>
    
    <div style="background-color: #e8f5e8; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <h4 style="margin: 0 0 10px 0; color: #2e7d32;">🤝 Why collaborative goals work:</h4>
      <ul style="margin: 0; padding-left: 20px; color: #555; font-size: 14px;">
        <li>40% higher success rate than solo saving</li>
        <li>Motivation through shared progress</li>
        <li>Accountability from friends/family</li>
        <li>Celebration of achievements together</li>
      </ul>
    </div>
  </div>
  
  <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
    <p>Start your financial journey today!</p>
    <p>Best regards,<br>The Kaptia Team</p>
  </div>
</div>
    `;

    return sendEmail({
      to: recipientEmail,
      from: 'noreply@kaptia.app',
      subject,
      text,
      html
    });
  }
}