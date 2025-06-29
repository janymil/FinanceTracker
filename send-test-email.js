// Test script to send goal invitation email
import { sendGoalInvitationEmail } from './server/emailService.js';

async function sendTestEmail() {
  try {
    console.log('Sending test goal invitation email...');
    
    const result = await sendGoalInvitationEmail({
      recipientEmail: 'jan.milata@gmail.com',
      recipientName: 'Jan',
      inviterName: 'FinanzerPro Team',
      goalName: 'Vacation in Bali 2025',
      goalDescription: 'Saving for an amazing tropical vacation with friends and family. Beach, culture, and unforgettable memories await!',
      targetAmount: '3500.00',
      targetDate: new Date('2025-08-15'),
      goalUrl: 'https://finanzerpro.com/collaborative-goals/demo',
      isExistingUser: true
    });

    console.log('Email sent successfully:', result);
    console.log('Check jan.milata@gmail.com for the invitation email!');
  } catch (error) {
    console.error('Failed to send email:', error);
    console.error('Error details:', error.message);
  }
}

sendTestEmail();