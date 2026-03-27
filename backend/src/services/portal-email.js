/**
 * portal-email.js
 * Email notification service for the OpenAdeia Client Portal.
 * Uses nodemailer with Resend SMTP (if API key configured) or generic SMTP.
 */

import { transporter as defaultTransporter, FROM_ADDRESS } from '../config/email.js';
import { t } from './portal-translations.js';
import db from '../config/database.js';

/**
 * Get a portal setting value.
 */
async function getSetting(key) {
  const row = await db('portal_settings').where({ key }).first();
  return row?.value || null;
}

/**
 * Build a nodemailer transporter.
 * Prefers Resend API key (SMTP), falls back to env SMTP config.
 */
async function getTransporter() {
  // Check if portal has a Resend API key configured
  const resendKey = await getSetting('resend_api_key') || process.env.RESEND_API_KEY;
  if (resendKey) {
    const nodemailer = await import('nodemailer');
    return nodemailer.default.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: resendKey },
    });
  }

  // Fall back to the global transporter from config/email.js
  return defaultTransporter;
}

/**
 * Get the "from" address for portal emails.
 */
async function getFromAddress() {
  return (await getSetting('email_from')) || FROM_ADDRESS || 'Forma Architecture <info@forma-arch.gr>';
}

/**
 * Send an email. Silently logs on failure (does not throw).
 * @param {object} opts - { to, subject, html }
 * @returns {boolean}
 */
export async function sendEmail({ to, subject, html }) {
  if (!to) {
    console.warn('[portal-email] No recipient — skipping send');
    return false;
  }
  try {
    const transport = await getTransporter();
    const from = await getFromAddress();
    await transport.sendMail({
      from,
      to,
      subject,
      html,
      text: html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
    });
    console.log(`[portal-email] Sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error(`[portal-email] Failed to ${to}: ${err.message}`);
    return false;
  }
}

// ── Email template builders ─────────────────────────────────────────────────

const BRAND_HEADER = `
  <div style="background:#1e293b;padding:16px 24px;border-radius:8px 8px 0 0;">
    <span style="color:white;font-size:17px;font-weight:700;letter-spacing:2px;">OPENADEIA</span>
    <span style="color:rgba(255,255,255,0.5);font-size:13px;margin-left:8px;">Forma Architecture</span>
  </div>`;

const BRAND_FOOTER = `
  <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px;">
    OpenAdeia · Forma Architecture · <a href="https://forma-arch.gr" style="color:#9ca3af;">forma-arch.gr</a>
  </div>`;

/**
 * Welcome email sent to the client when a portal is activated.
 */
export function buildWelcomeEmail(portal, project, portalUrl) {
  const lang = portal.language || 'el';
  const clientName = t(lang, 'email.welcome.defaultName');
  return {
    subject: t(lang, 'email.welcome.subject', { projectName: project?.title || '' }),
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#1a1a2e;max-width:600px;margin:0 auto;padding:20px;">
  ${BRAND_HEADER}
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
    <h2 style="margin:0 0 16px 0;color:#374151;">${t(lang, 'email.welcome.greeting', { name: clientName })}</h2>
    <p>${t(lang, 'email.welcome.intro', { projectName: project?.title || '' })}</p>
    <p>${t(lang, 'email.welcome.whatYouCanDo')}</p>
    <ul style="color:#4b5563;">
      <li>${t(lang, 'email.welcome.bullet1')}</li>
      <li>${t(lang, 'email.welcome.bullet2')}</li>
      <li>${t(lang, 'email.welcome.bullet3')}</li>
      <li>${t(lang, 'email.welcome.bullet4')}</li>
    </ul>
    <div style="text-align:center;margin:24px 0;">
      <a href="${portalUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        ${t(lang, 'email.welcome.cta')}
      </a>
    </div>
    <p style="color:#6b7280;font-size:13px;">${t(lang, 'email.welcome.linkWarning')}</p>
  </div>
  ${BRAND_FOOTER}
</body></html>`,
  };
}

/**
 * Notification sent to the engineer when a client submits a step.
 */
export function buildStepSubmittedEmail(portal, project, step) {
  const clientName = project?.client_name || '—';
  const projectName = project?.title || portal.project_id || '';
  return {
    subject: `[${projectName}] Νέα υποβολή: ${step.title}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#1a1a2e;max-width:600px;margin:0 auto;padding:20px;">
  ${BRAND_HEADER}
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:20px;">
    <h3 style="margin:0 0 12px 0;">Νέα υποβολή στο έργο "${projectName}"</h3>
    <p>Ο πελάτης <strong>${clientName}</strong> υπέβαλε το βήμα:</p>
    <div style="background:#f3f4f6;padding:12px 16px;border-radius:6px;margin:12px 0;">
      <strong>${step.title}</strong> <span style="color:#6b7280;">(${step.type})</span>
    </div>
    <p style="color:#6b7280;font-size:13px;">Συνδεθείτε στο admin panel για να το ελέγξετε και να εγκρίνετε ή να ζητήσετε διόρθωση.</p>
  </div>
  ${BRAND_FOOTER}
</body></html>`,
  };
}

/**
 * Notification sent to the client when a step is approved or revision is requested.
 */
export function buildStepReviewedEmail(portal, project, step, action, comment) {
  const lang = portal.language || 'el';
  const isApproved = action === 'approve';
  const statusColor = isApproved ? '#059669' : '#d97706';
  const projectName = project?.title || '';

  const subject = isApproved
    ? t(lang, 'email.stepReviewed.subjectApproved', { stepTitle: step.title })
    : t(lang, 'email.stepReviewed.subjectRevision', { stepTitle: step.title });

  const body = isApproved
    ? t(lang, 'email.stepReviewed.bodyApproved', { stepTitle: step.title, projectName })
    : t(lang, 'email.stepReviewed.bodyRevision', { stepTitle: step.title, projectName });

  return {
    subject: `OpenAdeia — ${subject}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#1a1a2e;max-width:600px;margin:0 auto;padding:20px;">
  ${BRAND_HEADER}
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:20px;">
    <h3 style="margin:0 0 12px 0;color:${statusColor};">
      ${isApproved ? '✅' : '⚠️'} ${t(lang, 'email.stepReviewed.heading')}
    </h3>
    <p>${body}</p>
    ${comment ? `
    <div style="background:#fffbeb;padding:12px 16px;border-radius:6px;border-left:3px solid ${statusColor};margin:12px 0;">
      <strong>${t(lang, 'email.stepReviewed.revisionNotes')}</strong> ${comment}
    </div>` : ''}
  </div>
  ${BRAND_FOOTER}
</body></html>`,
  };
}

// ── Convenience senders ─────────────────────────────────────────────────────

/**
 * Send welcome email to a client when portal is activated.
 * Looks up client email from portal_form_data.
 */
export async function sendWelcomeEmail(portal, project, portalUrl) {
  // Try to find client email from form_data
  const formData = await db('portal_form_data')
    .join('portal_steps', 'portal_form_data.step_id', 'portal_steps.id')
    .where('portal_steps.portal_project_id', portal.id)
    .where('portal_form_data.field_name', 'email')
    .select('portal_form_data.field_value')
    .first();

  const clientEmail = formData?.field_value || process.env.PORTAL_TEST_EMAIL;
  if (!clientEmail) {
    console.warn('[portal-email] No client email found — skipping welcome email');
    return false;
  }

  const { subject, html } = buildWelcomeEmail(portal, project, portalUrl);
  return sendEmail({ to: clientEmail, subject, html });
}

/**
 * Notify engineer when client submits a step.
 */
export async function notifyEngineerStepSubmitted(portal, project, step) {
  const engineerEmail = await getSetting('engineer_email') || process.env.ENGINEER_EMAIL;
  if (!engineerEmail) {
    console.warn('[portal-email] No engineer email — skipping step-submitted notification');
    return false;
  }
  const { subject, html } = buildStepSubmittedEmail(portal, project, step);
  return sendEmail({ to: engineerEmail, subject, html });
}

/**
 * Notify client when step is reviewed.
 */
export async function notifyClientStepReviewed(portal, project, step, action, comment) {
  // Find client email from form_data
  const formData = await db('portal_form_data')
    .join('portal_steps', 'portal_form_data.step_id', 'portal_steps.id')
    .where('portal_steps.portal_project_id', portal.id)
    .where('portal_form_data.field_name', 'email')
    .select('portal_form_data.field_value')
    .first();

  const clientEmail = formData?.field_value || process.env.PORTAL_TEST_EMAIL;
  if (!clientEmail) {
    console.warn('[portal-email] No client email — skipping step-reviewed notification');
    return false;
  }

  const { subject, html } = buildStepReviewedEmail(portal, project, step, action, comment);
  return sendEmail({ to: clientEmail, subject, html });
}
