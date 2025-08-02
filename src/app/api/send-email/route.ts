import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody, html } = body;

    // Validate required fields
    if (!to || !subject || !emailBody) {
      console.log('Missing required fields:', { to, subject, body: emailBody });
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    // Check if email service is enabled
    if (process.env.NEXT_PUBLIC_EMAIL_SERVICE_ENABLED !== 'true') {
      console.log('Email service disabled. Would send:', { to, subject, body: emailBody });
      return NextResponse.json(
        { success: true, message: 'Email service disabled - would send in production' },
        { status: 200 }
      );
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.log('Resend API key not configured. Would send:', { to, subject, body: emailBody });
      return NextResponse.json(
        { success: true, message: 'Resend API key not configured - would send in production' },
        { status: 200 }
      );
    }

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'QuickDesk <noreply@yourdomain.com>',
      to: [to],
      subject: subject,
      text: emailBody,
      html: html,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }

    console.log('Email sent successfully:', data);
    return NextResponse.json(
      { success: true, message: 'Email sent successfully', data },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
} 