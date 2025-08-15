/**
 * Email Service Configuration
 * 
 * This file provides email sending capabilities using Resend
 * for authentication-related emails and notifications.
 */

import { Resend } from "resend";

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Default email configuration
const DEFAULT_FROM_EMAIL = process.env.FROM_EMAIL || "noreply@yourapp.com";
const APP_NAME = "Payment Integration Template";

/**
 * Email template types for type safety
 */
export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email verification template
 */
export function getEmailVerificationTemplate(
  verificationUrl: string,
  _userEmail: string
): EmailTemplate {
  const subject = `Verify your email address for ${APP_NAME}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
          .security-note { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${APP_NAME}</h1>
            <h2>Verify Your Email Address</h2>
          </div>
          
          <p>Hello,</p>
          
          <p>Thank you for signing up for ${APP_NAME}! To complete your registration and secure your account, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 3px;">
            ${verificationUrl}
          </p>
          
          <div class="security-note">
            <strong>Security Notice:</strong>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>This verification link will expire in 24 hours</li>
              <li>If you didn't create an account, please ignore this email</li>
              <li>Never share this link with anyone</li>
            </ul>
          </div>
          
          <div class="footer">
            <p>Best regards,<br>The ${APP_NAME} Team</p>
            <p><em>This is an automated email. Please do not reply to this message.</em></p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    ${APP_NAME} - Verify Your Email Address
    
    Hello,
    
    Thank you for signing up for ${APP_NAME}! To complete your registration and secure your account, please verify your email address by visiting this link:
    
    ${verificationUrl}
    
    Security Notice:
    - This verification link will expire in 24 hours
    - If you didn't create an account, please ignore this email
    - Never share this link with anyone
    
    Best regards,
    The ${APP_NAME} Team
    
    This is an automated email. Please do not reply to this message.
  `;

  return { subject, html, text };
}

/**
 * Password reset template
 */
export function getPasswordResetTemplate(
  resetUrl: string,
  _userEmail: string
): EmailTemplate {
  const subject = `Reset your password for ${APP_NAME}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
          .security-note { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 14px; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${APP_NAME}</h1>
            <h2>Password Reset Request</h2>
          </div>
          
          <p>Hello,</p>
          
          <p>We received a request to reset your password for your ${APP_NAME} account. If you made this request, please click the button below to create a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 3px;">
            ${resetUrl}
          </p>
          
          <div class="security-note">
            <strong>Security Notice:</strong>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>This password reset link will expire in 1 hour</li>
              <li>If you didn't request a password reset, please ignore this email</li>
              <li>Your password will remain unchanged if you don't click the link</li>
              <li>For security, consider enabling two-factor authentication</li>
            </ul>
          </div>
          
          <div class="footer">
            <p>Best regards,<br>The ${APP_NAME} Team</p>
            <p><em>This is an automated email. Please do not reply to this message.</em></p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    ${APP_NAME} - Password Reset Request
    
    Hello,
    
    We received a request to reset your password for your ${APP_NAME} account. If you made this request, please visit this link to create a new password:
    
    ${resetUrl}
    
    Security Notice:
    - This password reset link will expire in 1 hour
    - If you didn't request a password reset, please ignore this email
    - Your password will remain unchanged if you don't click the link
    - For security, consider enabling two-factor authentication
    
    Best regards,
    The ${APP_NAME} Team
    
    This is an automated email. Please do not reply to this message.
  `;

  return { subject, html, text };
}

/**
 * Welcome email template
 */
export function getWelcomeEmailTemplate(
  userName: string,
  _userEmail: string
): EmailTemplate {
  const subject = `Welcome to ${APP_NAME}!`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
          .feature-list { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${APP_NAME}</h1>
            <h2>Welcome aboard, ${userName}!</h2>
          </div>
          
          <p>Hello ${userName},</p>
          
          <p>Welcome to ${APP_NAME}! We're excited to have you join our community. Your account has been successfully created and verified.</p>
          
          <div class="feature-list">
            <h3>What you can do now:</h3>
            <ul>
              <li>✓ Browse our secure payment solutions</li>
              <li>✓ Set up your payment preferences</li>
              <li>✓ Access your account dashboard</li>
              <li>✓ Configure security settings</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">Get Started</a>
          </div>
          
          <p>If you have any questions or need assistance, please don't hesitate to reach out to our support team.</p>
          
          <div class="footer">
            <p>Best regards,<br>The ${APP_NAME} Team</p>
            <p><em>This is an automated email. Please do not reply to this message.</em></p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    ${APP_NAME} - Welcome aboard!
    
    Hello ${userName},
    
    Welcome to ${APP_NAME}! We're excited to have you join our community. Your account has been successfully created and verified.
    
    What you can do now:
    - Browse our secure payment solutions
    - Set up your payment preferences
    - Access your account dashboard
    - Configure security settings
    
    Get started: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard
    
    If you have any questions or need assistance, please don't hesitate to reach out to our support team.
    
    Best regards,
    The ${APP_NAME} Team
    
    This is an automated email. Please do not reply to this message.
  `;

  return { subject, html, text };
}

/**
 * Send email using Resend
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from = DEFAULT_FROM_EMAIL,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}) {
  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
    });

    return { success: true, id: result.data?.id };
  } catch (error) {
    // Log error for debugging purposes
    console.error("Failed to send email:", error);
    return { success: false, error };
  }
}

/**
 * Send email verification email
 */
export async function sendEmailVerification(
  userEmail: string,
  verificationUrl: string
) {
  const template = getEmailVerificationTemplate(verificationUrl, userEmail);
  return sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(
  userEmail: string,
  resetUrl: string
) {
  const template = getPasswordResetTemplate(resetUrl, userEmail);
  return sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userName: string
) {
  const template = getWelcomeEmailTemplate(userName, userEmail);
  return sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

export { resend };