import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY environment variable not set. Email notifications will be disabled.");
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('SendGrid API key not configured, skipping email:', params.subject);
    return false;
  }

  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
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

We were unable to process your payment for your FinanzerPro subscription.

Failure reason: ${failureReason}

Don't worry - your account will remain active until ${graceExpiry}. Please update your payment method to continue enjoying all features.

To update your payment method:
1. Sign in to your account
2. Go to Account Settings
3. Update your payment information

If you need help, please contact our support team.

Best regards,
The FinanzerPro Team
  `.trim();

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Payment Failed - Action Required</h2>
  
  <p>Hi ${userName},</p>
  
  <p>We were unable to process your payment for your FinanzerPro subscription.</p>
  
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
  
  <p>Best regards,<br>The FinanzerPro Team</p>
</div>
  `;

  return sendEmail({
    to: userEmail,
    from: 'noreply@finanzerpro.com',
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

Your FinanzerPro account access will expire in ${hoursRemaining} hours due to a failed payment.

Please update your payment method immediately to avoid service interruption.

To update your payment method:
1. Sign in to your account
2. Go to Account Settings
3. Update your payment information

If you need help, please contact our support team.

Best regards,
The FinanzerPro Team
  `.trim();

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #dc3545;">Account Access Expires Soon</h2>
  
  <p>Hi ${userName},</p>
  
  <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Your FinanzerPro account access will expire in ${hoursRemaining} hours due to a failed payment.</strong>
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
  
  <p>Best regards,<br>The FinanzerPro Team</p>
</div>
  `;

  return sendEmail({
    to: userEmail,
    from: 'noreply@finanzerpro.com',
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

Your FinanzerPro account has been downgraded to the Free plan due to payment issues.

You can still access basic features, but premium features are now restricted.

To restore your premium access:
1. Sign in to your account
2. Go to Account Settings
3. Update your payment information
4. Resubscribe to your preferred plan

If you need help, please contact our support team.

Best regards,
The FinanzerPro Team
  `.trim();

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Account Downgraded to Free Plan</h2>
  
  <p>Hi ${userName},</p>
  
  <p>Your FinanzerPro account has been downgraded to the Free plan due to payment issues.</p>
  
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
  
  <p>Best regards,<br>The FinanzerPro Team</p>
</div>
  `;

  return sendEmail({
    to: userEmail,
    from: 'noreply@finanzerpro.com',
    subject,
    text,
    html
  });
}