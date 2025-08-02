# 📧 Email Integration Setup Guide

This guide will help you integrate real email notifications into your QuickDesk application.

## 🚀 Quick Setup (Recommended: Resend)

### Step 1: Install Dependencies
```bash
npm install resend
```

### Step 2: Set Up Resend Account
1. Go to [Resend.com](https://resend.com)
2. Sign up for a free account
3. Get your API key from the dashboard
4. Verify your domain (or use the provided test domain)

### Step 3: Update Environment Variables
Add these to your `.env.local` file:

```env
# Email Configuration
NEXT_PUBLIC_EMAIL_SERVICE_ENABLED=true
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=QuickDesk <noreply@yourdomain.com>

# Firebase Configuration (existing)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Step 4: Test Email Integration
1. Start your development server: `npm run dev`
2. Create a new ticket
3. Check your email inbox for notifications
4. Check browser console for email logs

## 🔧 Alternative Email Services

### Option 2: SendGrid

#### Install SendGrid
```bash
npm install @sendgrid/mail
```

#### Update API Route
Replace the content in `src/app/api/send-email/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody, html } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (process.env.NEXT_PUBLIC_EMAIL_SERVICE_ENABLED !== 'true') {
      console.log('Email service disabled. Would send:', { to, subject, body: emailBody });
      return NextResponse.json({ success: true, message: 'Email service disabled' });
    }

    const msg = {
      to: to,
      from: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
      subject: subject,
      text: emailBody,
      html: html,
    };

    await sgMail.send(msg);
    
    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('SendGrid error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
```

#### Environment Variables
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@yourdomain.com
NEXT_PUBLIC_EMAIL_SERVICE_ENABLED=true
```

### Option 3: AWS SES

#### Install AWS SDK
```bash
npm install @aws-sdk/client-ses
```

#### Update API Route
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody, html } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (process.env.NEXT_PUBLIC_EMAIL_SERVICE_ENABLED !== 'true') {
      console.log('Email service disabled. Would send:', { to, subject, body: emailBody });
      return NextResponse.json({ success: true, message: 'Email service disabled' });
    }

    const command = new SendEmailCommand({
      Source: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: emailBody },
          Html: { Data: html },
        },
      },
    });

    await ses.send(command);
    
    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('AWS SES error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
```

#### Environment Variables
```env
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1
FROM_EMAIL=noreply@yourdomain.com
NEXT_PUBLIC_EMAIL_SERVICE_ENABLED=true
```

### Option 4: Nodemailer (Self-hosted)

#### Install Nodemailer
```bash
npm install nodemailer @types/nodemailer
```

#### Update API Route
```typescript
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody, html } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (process.env.NEXT_PUBLIC_EMAIL_SERVICE_ENABLED !== 'true') {
      console.log('Email service disabled. Would send:', { to, subject, body: emailBody });
      return NextResponse.json({ success: true, message: 'Email service disabled' });
    }

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
      to: to,
      subject: subject,
      text: emailBody,
      html: html,
    };

    await transporter.sendMail(mailOptions);
    
    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Nodemailer error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
```

#### Environment Variables
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@yourdomain.com
NEXT_PUBLIC_EMAIL_SERVICE_ENABLED=true
```

## 🧪 Testing Your Email Integration

### Test Email Notifications

1. **Create a new ticket** - Should send notification to support team
2. **Update ticket status** - Should send notification to ticket owner
3. **Add a reply** - Should send notification to ticket owner

### Debug Email Issues

1. **Check browser console** for email logs
2. **Check server logs** for API errors
3. **Verify environment variables** are set correctly
4. **Test with a simple email** first

### Common Issues & Solutions

#### Issue: "Email service disabled"
**Solution**: Set `NEXT_PUBLIC_EMAIL_SERVICE_ENABLED=true` in your `.env.local`

#### Issue: "API key not found"
**Solution**: Verify your API key is correct and properly set in environment variables

#### Issue: "Domain not verified"
**Solution**: Verify your domain with your email service provider

#### Issue: "Rate limit exceeded"
**Solution**: Check your email service provider's limits and upgrade if needed

## 📊 Email Service Comparison

| Service | Free Tier | Setup Difficulty | Reliability | Cost |
|---------|-----------|------------------|-------------|------|
| **Resend** | 3,000 emails/month | Easy | High | $0.80/1000 emails |
| **SendGrid** | 100 emails/day | Medium | High | $14.95/month |
| **AWS SES** | 62,000 emails/month | Hard | Very High | $0.10/1000 emails |
| **Nodemailer** | Free | Hard | Medium | Server costs |

## 🚀 Production Deployment

### Vercel Deployment
1. Add environment variables in Vercel dashboard
2. Deploy your application
3. Test email functionality

### Other Platforms
- **Netlify**: Add environment variables in dashboard
- **Railway**: Set environment variables in project settings
- **Render**: Configure environment variables in service settings

## 📝 Email Templates

The application includes professional HTML email templates for:
- **New Ticket Created**: Notifies support team
- **Status Updated**: Notifies ticket owner of status changes
- **New Reply**: Notifies ticket owner of new replies

## 🔒 Security Considerations

1. **API Key Security**: Never commit API keys to version control
2. **Rate Limiting**: Implement rate limiting for email API
3. **Email Validation**: Validate email addresses before sending
4. **Error Handling**: Graceful fallback if email service fails

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Verify your email service configuration
3. Test with a simple email first
4. Check your email service provider's documentation

---

**Recommended**: Start with Resend for the easiest setup and best free tier! 