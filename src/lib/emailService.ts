// Email notification service
// In a production app, you would integrate with services like:
// - SendGrid
// - AWS SES
// - Firebase Functions with Nodemailer
// - Resend
// - Mailgun

export interface EmailData {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface TicketNotificationData {
  ticketId: string;
  ticketTitle: string;
  userName: string;
  userEmail: string;
  status?: string;
  category?: string;
  description?: string;
}

class EmailService {
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = process.env.NEXT_PUBLIC_EMAIL_SERVICE_ENABLED === 'true';
  }

  async sendEmail(emailData: EmailData): Promise<boolean> {
    if (!this.isEnabled) {
      console.log('Email service disabled. Would send:', emailData);
      return true;
    }

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Email API error:', result);
        return false;
      }

      console.log('Email sent successfully:', result);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  async sendTicketCreatedNotification(data: TicketNotificationData): Promise<boolean> {
    const subject = `New Ticket Created: ${data.ticketTitle}`;
    const body = `
      A new ticket has been created:
      
      Ticket ID: ${data.ticketId}
      Title: ${data.ticketTitle}
      Created by: ${data.userName} (${data.userEmail})
      Category: ${data.category || 'General'}
      
      Description:
      ${data.description || 'No description provided'}
      
      Please log in to the QuickDesk system to review and respond to this ticket.
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Ticket Created</h2>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${data.ticketTitle}</h3>
          <p><strong>Ticket ID:</strong> ${data.ticketId}</p>
          <p><strong>Created by:</strong> ${data.userName} (${data.userEmail})</p>
          <p><strong>Category:</strong> ${data.category || 'General'}</p>
          ${data.description ? `<p><strong>Description:</strong><br>${data.description}</p>` : ''}
        </div>
        <p>Please log in to the QuickDesk system to review and respond to this ticket.</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated notification from QuickDesk Help Desk System.
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: 'support@company.com', // In production, this would be configurable
      subject,
      body,
      html,
    });
  }

  async sendTicketStatusUpdateNotification(data: TicketNotificationData): Promise<boolean> {
    const subject = `Ticket Status Updated: ${data.ticketTitle}`;
    const body = `
      Your ticket status has been updated:
      
      Ticket ID: ${data.ticketId}
      Title: ${data.ticketTitle}
      New Status: ${data.status}
      
      Please log in to the QuickDesk system to view the latest updates.
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Ticket Status Updated</h2>
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <h3 style="margin-top: 0;">${data.ticketTitle}</h3>
          <p><strong>Ticket ID:</strong> ${data.ticketId}</p>
          <p><strong>New Status:</strong> <span style="color: #059669; font-weight: bold;">${data.status}</span></p>
        </div>
        <p>Please log in to the QuickDesk system to view the latest updates and respond if needed.</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated notification from QuickDesk Help Desk System.
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: data.userEmail,
      subject,
      body,
      html,
    });
  }

  async sendTicketReplyNotification(data: TicketNotificationData & { replyFrom: string }): Promise<boolean> {
    const subject = `New Reply to Your Ticket: ${data.ticketTitle}`;
    const body = `
      You have received a new reply to your ticket:
      
      Ticket ID: ${data.ticketId}
      Title: ${data.ticketTitle}
      Replied by: ${data.replyFrom}
      
      Please log in to the QuickDesk system to view the reply and respond if needed.
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">New Reply to Your Ticket</h2>
        <div style="background-color: #faf5ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
          <h3 style="margin-top: 0;">${data.ticketTitle}</h3>
          <p><strong>Ticket ID:</strong> ${data.ticketId}</p>
          <p><strong>Replied by:</strong> ${data.replyFrom}</p>
        </div>
        <p>Please log in to the QuickDesk system to view the reply and respond if needed.</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated notification from QuickDesk Help Desk System.
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: data.userEmail,
      subject,
      body,
      html,
    });
  }
}

export const emailService = new EmailService(); 