/**
 * portal-document.js
 * PDF generation for the OpenAdeia Client Portal.
 * Generates "Δήλωση Ανάθεσης" and "Συμφωνητικό Αμοιβής" PDFs.
 * Stores results in MinIO bucket "portal-docs".
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { randomUUID } from 'crypto';
import db from '../config/database.js';
import minioClient from '../config/minio.js';
import { t } from './portal-translations.js';

const PORTAL_DOCS_BUCKET = process.env.MINIO_PORTAL_DOCS_BUCKET || 'portal-docs';

// Greek font paths (DejaVu has full Greek Unicode support)
const FONT_PATHS = [
  ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'],
  ['/usr/share/fonts/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'],
  ['/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'],
];

// Role translation map
const ROLE_KEY_MAP = {
  'Γενική μελέτη έργου': 'pdf.role.general_study',
  'Μελέτη στατικών': 'pdf.role.structural_study',
  'Μελέτη μηχανολογικών': 'pdf.role.mechanical_study',
  'Γενική επίβλεψη έργου': 'pdf.role.general_supervision',
  'Επίβλεψη στατικών': 'pdf.role.structural_supervision',
  'Επίβλεψη μηχανολογικών': 'pdf.role.mechanical_supervision',
};

function translateRole(lang, roleText) {
  const key = ROLE_KEY_MAP[roleText];
  return key ? t(lang, key) : roleText;
}

/**
 * Ensure the portal-docs MinIO bucket exists.
 */
export async function ensurePortalDocsBucket() {
  try {
    const exists = await minioClient.bucketExists(PORTAL_DOCS_BUCKET);
    if (!exists) {
      await minioClient.makeBucket(PORTAL_DOCS_BUCKET, 'eu-west-1');
    }
  } catch (err) {
    console.warn('Could not ensure portal-docs bucket:', err.message);
  }
}

/**
 * Store PDF bytes in MinIO and record in portal_generated_docs.
 * Returns the generated doc record.
 */
async function storePdf(pdfBytes, stepId, filename) {
  await ensurePortalDocsBucket();

  const step = await db('portal_steps').where({ id: stepId }).first();
  const portal = step ? await db('portal_projects').where({ id: step.portal_project_id }).first() : null;
  const projectId = portal?.project_id || 'misc';

  const minioPath = `${projectId}/${stepId}/${filename}`;

  // Upload to MinIO
  const buffer = Buffer.from(pdfBytes);
  await minioClient.putObject(PORTAL_DOCS_BUCKET, minioPath, buffer, buffer.length, {
    'Content-Type': 'application/pdf',
  });

  // Record in DB
  const [doc] = await db('portal_generated_docs')
    .insert({
      step_id: stepId,
      template_id: null,
      minio_path: minioPath,
    })
    .returning('*');

  return doc;
}

/**
 * Load Greek-compatible fonts into a PDFDocument.
 * Falls back to Helvetica if no system fonts available.
 */
async function loadFonts(pdfDoc) {
  const { readFileSync } = await import('fs');
  pdfDoc.registerFontkit(fontkit);

  for (const [regularPath, boldPath] of FONT_PATHS) {
    try {
      const fontBytes = readFileSync(regularPath);
      const font = await pdfDoc.embedFont(fontBytes);
      let fontBold = font;
      try {
        const boldBytes = readFileSync(boldPath);
        fontBold = await pdfDoc.embedFont(boldBytes);
      } catch { /* use regular as bold fallback */ }
      return { font, fontBold };
    } catch { /* try next path */ }
  }

  // Final fallback to built-in fonts
  return {
    font: await pdfDoc.embedFont(StandardFonts.Helvetica),
    fontBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

/**
 * Get a portal setting from the portal_settings table.
 */
async function getSetting(key) {
  const row = await db('portal_settings').where({ key }).first();
  return row?.value || '';
}

/**
 * Get all form data for a portal project, organized by preset.
 * Returns { owners: [...], shared: {...} }
 */
async function collectFormData(portalProjectId) {
  const steps = await db('portal_steps')
    .where({ portal_project_id: portalProjectId, type: 'form' })
    .select('id', 'config');

  const owners = [];
  const shared = {};

  for (const step of steps) {
    const config = typeof step.config === 'string' ? JSON.parse(step.config) : (step.config || {});
    const formRows = await db('portal_form_data').where({ step_id: step.id });
    const data = {};
    for (const row of formRows) {
      data[row.field_name] = row.field_value || '';
    }

    if (config.preset === 'client_personal') {
      owners.push({ index: config.owner_index ?? owners.length, data });
    } else {
      Object.assign(shared, data);
    }
  }

  owners.sort((a, b) => a.index - b.index);

  // Ensure at least one owner
  if (owners.length === 0) {
    owners.push({ index: 0, data: {} });
  }

  return { owners, shared };
}

/**
 * Generate "Δήλωση Ανάθεσης" (Assignment Declaration) PDF.
 * @param {string} stepId  - the portal step this doc belongs to
 * @param {string} portalProjectId
 * @returns {object} generated_docs record
 */
export async function generateAssignmentPdf(stepId, portalProjectId) {
  const portal = await db('portal_projects').where({ id: portalProjectId }).first();
  const project = portal
    ? await db('projects').where({ id: portal.project_id }).first()
    : null;

  const lang = 'el'; // Assignment declaration is always in Greek (official doc)
  const { owners, shared } = await collectFormData(portalProjectId);

  const engineers = await db('portal_project_engineers')
    .where({ portal_project_id: portalProjectId })
    .orderBy('id');

  // Data
  const projectDesc = project?.title || shared.project_name || '';
  const propertyAddress = shared.property_address || shared.address || '';
  const propertyKaek = shared.kaek || '';
  const municipality = shared.municipality || shared.city || '';
  const dateStr = new Date().toLocaleDateString('el-GR');
  const primaryOwner = owners[0].data;

  // PDF setup
  const pdfDoc = await PDFDocument.create();
  const { font, fontBold } = await loadFonts(pdfDoc);

  const W = 595.28, H = 841.89, mL = 60, mR = 60;
  const cW = W - mL - mR;
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.75, 0.75, 0.75);

  let page = pdfDoc.addPage([W, H]);
  let y = H - 60;

  // Helpers
  const safeText = (text) => {
    if (!text) return '';
    return String(text).replace(/\r?\n/g, ' ').trim();
  };

  const drawText = (text, x, yPos, opts = {}) => {
    const size = opts.size || 10;
    const f = opts.bold ? fontBold : font;
    const color = opts.color || black;
    try {
      page.drawText(safeText(text), { x, y: yPos, size, font: f, color });
    } catch {
      // Strip non-safe chars as last resort
      page.drawText(safeText(text).replace(/[^\x20-\x7E]/g, '?'), { x, y: yPos, size, font: f, color });
    }
  };

  const drawLine = (x1, y1, x2, y2, opts = {}) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: opts.thickness || 0.5,
      color: opts.color || lightGray,
    });
  };

  const drawLabelValue = (label, value, yPos) => {
    drawText(label, mL, yPos, { size: 9, color: gray });
    drawText(value, mL + 140, yPos, { size: 10, bold: true });
    drawLine(mL, yPos - 4, W - mR, yPos - 4);
    return yPos - 22;
  };

  const ensureSpace = (needed) => {
    if (y < needed + 50) {
      page = pdfDoc.addPage([W, H]);
      y = H - 60;
    }
  };

  const sectionHeader = (title) => {
    drawText(title, mL, y, { size: 8, bold: true, color: gray });
    y -= 5;
    drawLine(mL, y, W - mR, y, { thickness: 0.8, color: gray });
    y -= 18;
  };

  // ── Title ──
  const title = t(lang, 'pdf.assignmentTitle');
  const titleW = fontBold.widthOfTextAtSize(title, 16);
  drawText(title, (W - titleW) / 2, y, { size: 16, bold: true });
  y -= 10;
  drawLine((W - titleW) / 2 - 10, y, (W + titleW) / 2 + 10, y, { thickness: 1.5, color: black });
  y -= 30;

  // ── Project info ──
  sectionHeader(t(lang, 'pdf.projectInfoSection'));
  y = drawLabelValue(t(lang, 'pdf.project'), projectDesc.substring(0, 60), y);
  y = drawLabelValue(t(lang, 'pdf.projectAddress'), propertyAddress.substring(0, 60), y);
  y = drawLabelValue(t(lang, 'pdf.kaek'), propertyKaek, y);
  y = drawLabelValue(t(lang, 'pdf.municipality'), municipality, y);
  y -= 10;

  // ── Owner info (all owners) ──
  for (let oi = 0; oi < owners.length; oi++) {
    const o = owners[oi].data;
    const ownerLabel = owners.length > 1
      ? `${t(lang, 'pdf.ownerInfoSection')} #${oi + 1}`
      : t(lang, 'pdf.ownerInfoSection');
    ensureSpace(120);
    sectionHeader(ownerLabel);
    const fullName = [o.surname, o.name].filter(Boolean).join(' ') || o.client_name || '';
    y = drawLabelValue(t(lang, 'pdf.fullName'), fullName, y);
    y = drawLabelValue(t(lang, 'pdf.fatherName'), o.father_name || '', y);
    y = drawLabelValue(t(lang, 'pdf.afm'), o.afm || '', y);
    y = drawLabelValue(t(lang, 'pdf.idNumber'), o.adt || o.id_number || '', y);
    const addr = [o.address, o.city, o.zip].filter(Boolean).join(', ');
    y = drawLabelValue(t(lang, 'pdf.addressLabel'), addr, y);
    y = drawLabelValue(t(lang, 'pdf.phone'), o.phone || '', y);
    y -= 10;
  }

  // ── Declaration text ──
  ensureSpace(100);
  sectionHeader(t(lang, 'pdf.declarationSection'));

  const ownerNames = owners
    .map((o) => {
      const d = o.data;
      return [d.surname, d.name].filter(Boolean).join(' ') || d.client_name || '';
    })
    .filter(Boolean)
    .join(', ') || '';

  const primaryAddr = [primaryOwner.address, primaryOwner.city].filter(Boolean).join(', ');
  const declText = t(lang, 'pdf.declarationText', {
    owner: ownerNames,
    address: primaryAddr,
    project: projectDesc,
  });

  // Word-wrap declaration
  const words = declText.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, 9) > cW) {
      drawText(line, mL, y, { size: 9 });
      y -= 14;
      line = word;
      ensureSpace(30);
    } else {
      line = test;
    }
  }
  if (line) { drawText(line, mL, y, { size: 9 }); y -= 14; }
  y -= 8;

  // ── Assignments table ──
  ensureSpace(80);
  drawText(t(lang, 'pdf.roleColumn'), mL, y, { size: 8, bold: true, color: gray });
  drawText(t(lang, 'pdf.engineerColumn'), mL + cW * 0.55, y, { size: 8, bold: true, color: gray });
  y -= 4;
  drawLine(mL, y, W - mR, y, { thickness: 0.8, color: gray });
  y -= 16;

  const assignments = engineers.filter((e) => e.role);
  if (assignments.length === 0) {
    drawText(t(lang, 'pdf.noAssignments'), mL, y, { size: 9, color: gray });
    y -= 20;
  } else {
    for (const eng of assignments) {
      ensureSpace(30);
      drawText(translateRole(lang, eng.role), mL, y, { size: 9 });
      drawText(`${eng.surname} ${eng.name}`, mL + cW * 0.55, y, { size: 9, bold: true });
      y -= 4;
      drawLine(mL, y, W - mR, y, { color: rgb(0.9, 0.9, 0.9) });
      y -= 16;
    }
  }

  y -= 20;

  // ── Signatures ──
  ensureSpace(100);
  drawText(`${t(lang, 'pdf.date')}: ${dateStr}`, mL, y, { size: 9 });
  y -= 35;

  const sigLeft = mL;
  const sigRight = W - mR - 160;

  drawText(t(lang, 'pdf.declarant'), sigLeft, y, { size: 9, bold: true });
  drawLine(sigLeft, y - 35, sigLeft + 180, y - 35, { thickness: 0.5, color: black });

  drawText(t(lang, 'pdf.engineer'), sigRight, y, { size: 9, bold: true });
  drawLine(sigRight, y - 35, sigRight + 150, y - 35, { thickness: 0.5, color: black });

  // ── Footer ──
  const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  lastPage.drawText(t(lang, 'pdf.footerAssignment'), { x: mL, y: 28, size: 7, font, color: lightGray });
  lastPage.drawText('forma-arch.gr', { x: W - mR - 60, y: 28, size: 7, font, color: lightGray });

  const pdfBytes = await pdfDoc.save();
  const filename = `assignment-${randomUUID().slice(0, 8)}.pdf`;
  return storePdf(pdfBytes, stepId, filename);
}

/**
 * Generate "Ιδιωτικό Συμφωνητικό Αμοιβής" (Fee Agreement) PDF.
 */
export async function generateFeeAgreementPdf(stepId, portalProjectId, feeConfig = {}) {
  const portal = await db('portal_projects').where({ id: portalProjectId }).first();
  const project = portal
    ? await db('projects').where({ id: portal.project_id }).first()
    : null;

  const lang = portal?.language || 'el';
  const locale = lang === 'el' ? 'el-GR' : 'en-GB';
  const { owners, shared } = await collectFormData(portalProjectId);

  const engineers = await db('portal_project_engineers')
    .where({ portal_project_id: portalProjectId })
    .whereNot({ role: '' })
    .orderBy('id');

  const primaryOwner = owners[0].data;
  const ownerName = [primaryOwner.surname, primaryOwner.name].filter(Boolean).join(' ') || primaryOwner.client_name || '';
  const ownerAfm = primaryOwner.afm || '';
  const ownerAddr = [primaryOwner.address, primaryOwner.city].filter(Boolean).join(', ');
  const propertyAddr = shared.property_address || '';
  const projectDesc = project?.title || '';
  const totalFee = feeConfig.total_fee || 0;
  const milestones = feeConfig.milestones || [];
  const dateStr = new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  // Engineer info from portal_settings
  const engineerName = await getSetting('engineer_name');
  const engineerAfm = await getSetting('engineer_afm');
  const engineerAm = await getSetting('engineer_am');
  const engineerAddr = await getSetting('engineer_address');

  // PDF setup
  const pdfDoc = await PDFDocument.create();
  const { font, fontBold } = await loadFonts(pdfDoc);

  const W = 595.28, H = 841.89, mL = 55, mR = 55;
  const cW = W - mL - mR;
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.78, 0.78, 0.78);

  let page = pdfDoc.addPage([W, H]);
  let y = H - 55;

  const safeText = (text) => {
    if (!text && text !== 0) return '';
    return String(text).replace(/\r?\n/g, ' ').trim();
  };

  const txt = (text, x, yy, o = {}) => {
    try {
      page.drawText(safeText(text), { x, y: yy, size: o.size || 9, font: o.bold ? fontBold : font, color: o.color || black });
    } catch { /* ignore render errors */ }
  };

  const ln = (x1, y1, x2, y2, o = {}) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: o.t || 0.5, color: o.c || lightGray });
  };

  const lv = (label, value, yy) => {
    txt(label, mL, yy, { size: 8, color: gray });
    txt(value, mL + 130, yy, { size: 9, bold: true });
    ln(mL, yy - 4, W - mR, yy - 4);
    return yy - 18;
  };

  const section = (sectionTitle) => {
    txt(sectionTitle, mL, y, { size: 8, bold: true, color: gray });
    y -= 5;
    ln(mL, y, W - mR, y, { t: 0.8, c: gray });
    y -= 16;
  };

  const ensureSpace = (needed) => {
    if (y < needed + 50) {
      page = pdfDoc.addPage([W, H]);
      y = H - 55;
    }
  };

  // ── Title ──
  const title = t(lang, 'pdf.feeTitle');
  const titleW = fontBold.widthOfTextAtSize(title, 14);
  txt(title, (W - titleW) / 2, y, { size: 14, bold: true });
  y -= 10;
  ln((W - titleW) / 2 - 10, y, (W + titleW) / 2 + 10, y, { t: 1.5, c: black });
  y -= 25;

  // ── Parties ──
  section(t(lang, 'pdf.partiesSection'));
  txt(t(lang, 'pdf.partyA'), mL, y, { size: 9, bold: true }); y -= 16;
  y = lv(t(lang, 'pdf.fullName'), ownerName, y);
  y = lv(t(lang, 'pdf.afm'), ownerAfm, y);
  y = lv(t(lang, 'pdf.addressLabel'), ownerAddr, y);
  y -= 6;
  txt(t(lang, 'pdf.partyB'), mL, y, { size: 9, bold: true }); y -= 16;
  y = lv(t(lang, 'pdf.fullName'), engineerName, y);
  y = lv(t(lang, 'pdf.amTee'), engineerAm, y);
  y = lv(t(lang, 'pdf.afm'), engineerAfm, y);
  y = lv(t(lang, 'pdf.addressLabel'), engineerAddr, y);
  y -= 8;

  // ── Subject ──
  ensureSpace(80);
  section(t(lang, 'pdf.subjectSection'));
  txt(t(lang, 'pdf.regardsProject', { project: projectDesc }), mL, y, { size: 9 }); y -= 14;
  txt(t(lang, 'pdf.location', { address: propertyAddr }), mL, y, { size: 9 }); y -= 14;
  txt(t(lang, 'pdf.engineerUndertakes'), mL, y, { size: 9 }); y -= 16;

  if (engineers.length === 0) {
    txt(t(lang, 'pdf.noRolesDefined'), mL + 10, y, { size: 8.5, color: gray }); y -= 14;
  } else {
    for (const eng of engineers) {
      ensureSpace(20);
      txt(`• ${translateRole(lang, eng.role)}`, mL + 10, y, { size: 8.5 });
      txt(`(${eng.surname} ${eng.name})`, mL + cW * 0.55, y, { size: 8.5, color: gray });
      y -= 14;
    }
  }
  y -= 6;

  // ── Fee ──
  ensureSpace(80);
  section(t(lang, 'pdf.feeSection'));
  const feeStr = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(totalFee);
  txt(t(lang, 'pdf.totalFeeText', { fee: feeStr }), mL, y, { size: 9.5, bold: true }); y -= 20;

  if (milestones.length > 0) {
    txt(t(lang, 'pdf.paymentIntro'), mL, y, { size: 9 }); y -= 16;
    txt(t(lang, 'pdf.phase'), mL + 10, y, { size: 8, bold: true, color: gray });
    txt(t(lang, 'pdf.amount'), W - mR - 80, y, { size: 8, bold: true, color: gray });
    y -= 4; ln(mL, y, W - mR, y, { t: 0.8, c: gray }); y -= 14;
    for (const ms of milestones) {
      ensureSpace(20);
      const msAmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(ms.amount || 0);
      txt(`• ${ms.name}`, mL + 10, y, { size: 9 });
      txt(msAmt, W - mR - 80, y, { size: 9, bold: true });
      y -= 4; ln(mL, y, W - mR, y); y -= 14;
    }
  }
  y -= 10;

  // ── Terms ──
  ensureSpace(80);
  section(t(lang, 'pdf.termsSection'));
  for (const key of ['pdf.term1', 'pdf.term2', 'pdf.term3', 'pdf.term4']) {
    ensureSpace(20);
    txt(`• ${t(lang, key)}`, mL + 5, y, { size: 8 }); y -= 13;
  }
  y -= 15;

  // ── Signatures ──
  ensureSpace(100);
  txt(`${t(lang, 'pdf.date')}: ${dateStr}`, mL, y, { size: 9 }); y -= 30;

  const halfW = cW / 2;
  txt(t(lang, 'pdf.employer'), mL + 20, y, { size: 9 });
  txt(t(lang, 'pdf.engineer'), mL + halfW + 20, y, { size: 9 });
  y -= 45;
  ln(mL, y, mL + halfW - 20, y, { c: black });
  ln(mL + halfW + 10, y, W - mR, y, { c: black });

  // ── Footer ──
  const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  lastPage.drawText(t(lang, 'pdf.footerFee'), { x: mL, y: 28, size: 7, font, color: lightGray });
  lastPage.drawText('forma-arch.gr', { x: W - mR - 55, y: 28, size: 7, font, color: lightGray });

  const pdfBytes = await pdfDoc.save();
  const filename = `fee-agreement-${randomUUID().slice(0, 8)}.pdf`;
  return storePdf(pdfBytes, stepId, filename);
}

/**
 * Embed a client's digital signature into an existing PDF.
 * @param {string} docId         - portal_generated_docs.id
 * @param {string} signatureB64  - base64 PNG (may include data URI prefix)
 * @returns {object} updated generated_docs record
 */
export async function embedSignatureInDoc(docId, signatureB64) {
  const doc = await db('portal_generated_docs').where({ id: docId }).first();
  if (!doc) throw new Error('Document not found');

  // Download existing PDF from MinIO
  let pdfStream;
  try {
    pdfStream = await minioClient.getObject(PORTAL_DOCS_BUCKET, doc.minio_path);
  } catch (err) {
    throw new Error(`Could not retrieve PDF from storage: ${err.message}`);
  }

  // Read stream into buffer
  const chunks = [];
  for await (const chunk of pdfStream) {
    chunks.push(chunk);
  }
  const pdfBytes = Buffer.concat(chunks);

  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(fontkit);

  // Embed font for timestamp
  const { readFileSync } = await import('fs');
  let font;
  for (const [fp] of FONT_PATHS) {
    try { font = await pdfDoc.embedFont(readFileSync(fp)); break; } catch { /* next */ }
  }
  if (!font) font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Decode base64 signature PNG
  const sigData = signatureB64.replace(/^data:image\/png;base64,/, '');
  const sigBuffer = Buffer.from(sigData, 'base64');
  const sigImage = await pdfDoc.embedPng(sigBuffer);

  // Place on last page
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width } = lastPage.getSize();

  const maxSigWidth = 200;
  const scale = Math.min(maxSigWidth / sigImage.width, 1);
  const sigWidth = sigImage.width * scale;
  const sigHeight = sigImage.height * scale;

  const sigX = width - 60 - sigWidth;
  lastPage.drawImage(sigImage, { x: sigX, y: 85, width: sigWidth, height: sigHeight });

  // Timestamp
  const timestamp = new Date().toLocaleString('el-GR');
  try {
    lastPage.drawText(timestamp, { x: sigX, y: 72, size: 7, font, color: rgb(0.5, 0.5, 0.5) });
  } catch {
    lastPage.drawText(new Date().toISOString().slice(0, 19), { x: sigX, y: 72, size: 7, font, color: rgb(0.5, 0.5, 0.5) });
  }

  const signedBytes = await pdfDoc.save();

  // Store signed PDF with new path
  const signedPath = doc.minio_path.replace(/\.pdf$/, '') + `-signed-${randomUUID().slice(0, 8)}.pdf`;
  const signedBuffer = Buffer.from(signedBytes);
  await minioClient.putObject(PORTAL_DOCS_BUCKET, signedPath, signedBuffer, signedBuffer.length, {
    'Content-Type': 'application/pdf',
  });

  // Update DB record
  const [updated] = await db('portal_generated_docs')
    .where({ id: docId })
    .update({
      minio_path: signedPath,
      signature_data: signatureB64.substring(0, 100), // store truncated reference
      signed_at: db.fn.now(),
    })
    .returning('*');

  return updated;
}

/**
 * Get a presigned download URL for a generated doc.
 * @param {string} minioPath
 * @param {number} expirySeconds
 */
export async function getDocDownloadUrl(minioPath, expirySeconds = 3600) {
  return minioClient.presignedGetObject(PORTAL_DOCS_BUCKET, minioPath, expirySeconds);
}
