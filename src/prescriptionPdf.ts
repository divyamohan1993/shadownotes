import jsPDF from 'jspdf';
import type { VaultSession, SessionContent, IntelligenceItem, DomainProfile, VaultCase, DomainId } from './types';

// ════════════════════════════════════════════════════════════════
// dmj.one CSR ORGANIZATION BRANDING
// ════════════════════════════════════════════════════════════════
const ORG_MOTTO = 'Dream Manifest and Journey Together as One';
const ORG_WEBSITE = 'www.dmj.one';
const ORG_EMAIL = 'contact@dmj.one';

// Domain-specific branding — unique Hindi names
const DOMAIN_BRANDING: Record<DomainId, {
  name: string;
  meaning: string;
  fullTitle: string;
  subtitle: string;
  documentTitle: string;
  accentColor: RGB;
  headerBg: RGB;
  sectionBg: RGB;
  signatureLeft: string;
  signatureRight: string;
  footerNote: string;
  filePrefix: string;
}> = {
  medical: {
    name: 'Sanjeevani',
    meaning: 'The Life-Giving Herb',
    fullTitle: 'dmj.one CSR Hospital — Sanjeevani',
    subtitle: 'Department of General Medicine',
    documentTitle: 'PATIENT PRESCRIPTION',
    accentColor: [0, 105, 146],
    headerBg: [0, 75, 110],
    sectionBg: [230, 244, 250],
    signatureLeft: 'Hospital Seal',
    signatureRight: "Attending Physician's Signature",
    footerNote: 'This is a computer-generated prescription. Valid without signature for record purposes only.',
    filePrefix: 'Prescription',
  },
  security: {
    name: 'Kavach',
    meaning: 'The Divine Shield',
    fullTitle: 'dmj.one CSR Cybersecurity — Kavach',
    subtitle: 'Threat Intelligence & Vulnerability Assessment',
    documentTitle: 'SECURITY AUDIT REPORT',
    accentColor: [139, 0, 0],
    headerBg: [30, 30, 30],
    sectionBg: [245, 230, 230],
    signatureLeft: 'Organization Seal',
    signatureRight: 'Lead Security Analyst',
    footerNote: 'CONFIDENTIAL: This security audit report contains sensitive vulnerability information. Handle per classification.',
    filePrefix: 'SecurityAudit',
  },
  legal: {
    name: 'Nyaaya',
    meaning: 'The Path of Justice',
    fullTitle: 'dmj.one CSR Legal Services — Nyaaya',
    subtitle: 'Deposition & Legal Documentation Division',
    documentTitle: 'LEGAL DEPOSITION SUMMARY',
    accentColor: [101, 67, 33],
    headerBg: [44, 36, 28],
    sectionBg: [245, 238, 228],
    signatureLeft: 'Notary Seal',
    signatureRight: 'Counsel / Authorized Officer',
    footerNote: 'PRIVILEGED & CONFIDENTIAL: Attorney-client privilege may apply. Unauthorized disclosure prohibited.',
    filePrefix: 'LegalDeposition',
  },
  incident: {
    name: 'Prahari',
    meaning: 'The Vigilant Sentinel',
    fullTitle: 'dmj.one CSR Incident Response — Prahari',
    subtitle: 'Emergency Response & Investigation Unit',
    documentTitle: 'INCIDENT REPORT',
    accentColor: [180, 80, 0],
    headerBg: [80, 30, 0],
    sectionBg: [255, 240, 225],
    signatureLeft: 'Department Seal',
    signatureRight: 'Incident Commander',
    footerNote: 'OFFICIAL USE ONLY: This incident report is generated for internal records and authorized investigation.',
    filePrefix: 'IncidentReport',
  },
};

// ════════════════════════════════════════════════════════════════
// TYPE HELPERS
// ════════════════════════════════════════════════════════════════
type RGB = [number, number, number];

const C = {
  white: [255, 255, 255] as RGB,
  black: [0, 0, 0] as RGB,
  body: [33, 37, 41] as RGB,
  muted: [90, 95, 100] as RGB,
  lightMuted: [130, 135, 140] as RGB,
  border: [200, 204, 210] as RGB,
  sectionBg: [245, 247, 249] as RGB,
  tableBg: [235, 238, 242] as RGB,
  tableAlt: [246, 248, 250] as RGB,
  gold: [178, 142, 60] as RGB,
  goldLight: [212, 175, 85] as RGB,
  rxRed: [178, 34, 34] as RGB,
  urgentRed: [185, 28, 28] as RGB,
  green: [21, 128, 61] as RGB,
  watermark: [230, 235, 240] as RGB,
};

// ════════════════════════════════════════════════════════════════
// SHARED DRAWING UTILITIES
// ════════════════════════════════════════════════════════════════
interface DocContext {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  ml: number; // margin left
  mr: number; // margin right
  cw: number; // content width
  y: number;
  accent: RGB;
  headerBg: RGB;
}

function ensureSpace(ctx: DocContext, needed: number) {
  if (ctx.y + needed > ctx.pageHeight - 22) {
    ctx.doc.addPage();
    ctx.y = 18;
  }
}

function hLine(ctx: DocContext, y: number, color: RGB = C.border, width = 0.3) {
  ctx.doc.setDrawColor(...color);
  ctx.doc.setLineWidth(width);
  ctx.doc.line(ctx.ml, y, ctx.pageWidth - ctx.mr, y);
}

function sectionHeading(ctx: DocContext, title: string, _icon?: string) {
  ensureSpace(ctx, 16);
  const { doc, ml, accent } = ctx;

  // Colored left accent bar + light background strip
  const branding = Object.values(DOMAIN_BRANDING).find(b => b.accentColor === accent);
  const bgColor: RGB = branding?.sectionBg || C.sectionBg;

  doc.setFillColor(...bgColor);
  doc.rect(ml, ctx.y, ctx.cw, 8, 'F');
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(ml, ctx.y, 2.5, 8, 'F');

  // Title text — dark accent color on light bg for high contrast
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text(title, ml + 6, ctx.y + 5.8);
  ctx.y += 12;
}

function labelValue(ctx: DocContext, x: number, y: number, label: string, value: string, maxWidth?: number) {
  const { doc } = ctx;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.muted);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...C.body);
  if (maxWidth) {
    const lines = doc.splitTextToSize(value || 'N/A', maxWidth);
    doc.text(lines[0] || 'N/A', x, y + 5.5);
  } else {
    doc.text(value || 'N/A', x, y + 5.5);
  }
}

function bulletList(ctx: DocContext, items: string[], color: RGB = C.body) {
  const { doc, ml } = ctx;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...color);
  for (const item of items) {
    ensureSpace(ctx, 7);
    const lines = doc.splitTextToSize(item, ctx.cw - 12);
    doc.text('\u2022', ml + 4, ctx.y);
    for (let li = 0; li < lines.length; li++) {
      doc.text(lines[li], ml + 11, ctx.y);
      ctx.y += 5.5;
      ensureSpace(ctx, 6);
    }
    ctx.y += 1.5;
  }
  ctx.y += 3;
}

function numberedList(ctx: DocContext, items: string[], color: RGB = C.body) {
  const { doc, ml } = ctx;
  for (let i = 0; i < items.length; i++) {
    ensureSpace(ctx, 10);
    // Alternating row background
    if (i % 2 === 0) {
      doc.setFillColor(...C.tableAlt);
      doc.rect(ml, ctx.y - 4, ctx.cw, 9, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...ctx.accent);
    doc.text(`${(i + 1).toString().padStart(2, '0')}`, ml + 4, ctx.y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(items[i], ctx.cw - 20);
    doc.text(lines[0], ml + 16, ctx.y);
    ctx.y += 6;
    for (let li = 1; li < lines.length; li++) {
      doc.text(lines[li], ml + 16, ctx.y);
      ctx.y += 5.5;
    }
    ctx.y += 3;
  }
  ctx.y += 2;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function groupByCategory(intelligence: IntelligenceItem[]): Record<string, IntelligenceItem[]> {
  const g: Record<string, IntelligenceItem[]> = {};
  for (const item of intelligence) {
    if (!g[item.category]) g[item.category] = [];
    g[item.category].push(item);
  }
  return g;
}

// ════════════════════════════════════════════════════════════════
// SHARED HEADER — Compact single-line professional header
// ════════════════════════════════════════════════════════════════
function drawHeader(ctx: DocContext, branding: typeof DOMAIN_BRANDING.medical) {
  const { doc, pageWidth, ml, mr } = ctx;

  // Thin colored accent strip at very top (3mm)
  doc.setFillColor(...branding.headerBg);
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Organization name — bold, dark, left-aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.body);
  doc.text(branding.fullTitle, ml, 11);

  // Contact info — right-aligned on same line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(`${ORG_WEBSITE}  |  ${ORG_EMAIL}`, pageWidth - mr, 9, { align: 'right' });

  // Department subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  doc.text(branding.subtitle, ml, 16);

  // Separator
  hLine({ ...ctx, y: 19 } as DocContext, 19, C.border, 0.5);

  ctx.y = 24;

  // Document title — centered, accent colored, prominent
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...branding.accentColor);
  doc.text(branding.documentTitle, pageWidth / 2, ctx.y, { align: 'center' });
  ctx.y += 2.5;

  // Accent underline just under the title text
  const titleWidth = doc.getTextWidth(branding.documentTitle);
  doc.setDrawColor(...branding.accentColor);
  doc.setLineWidth(0.6);
  doc.line(pageWidth / 2 - titleWidth / 2, ctx.y, pageWidth / 2 + titleWidth / 2, ctx.y);
  ctx.y += 7;
}

// ════════════════════════════════════════════════════════════════
// SHARED SIGNATURE BLOCK
// ════════════════════════════════════════════════════════════════
function drawSignatureBlock(ctx: DocContext, branding: typeof DOMAIN_BRANDING.medical, session: VaultSession) {
  ensureSpace(ctx, 50);
  const { doc, ml, mr, pageWidth, pageHeight } = ctx;

  const sigY = Math.max(ctx.y + 8, pageHeight - 48);

  hLine({ ...ctx } as DocContext, sigY, C.border, 0.3);

  // Left — seal placeholder
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(branding.signatureLeft, ml + 22, sigY + 5, { align: 'center' });
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.5, 1], 0);
  doc.roundedRect(ml, sigY + 7, 44, 18, 1.5, 1.5, 'S');
  doc.setLineDashPattern([], 0);

  // Center — AI notice
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.lightMuted);
  doc.text('Generated by ShadowNotes AI', pageWidth / 2, sigY + 12, { align: 'center' });
  doc.text(`Session: ${session.caseNumber}`, pageWidth / 2, sigY + 16.5, { align: 'center' });
  doc.text(`Date: ${formatDate(session.createdAt)} at ${formatTime(session.createdAt)}`, pageWidth / 2, sigY + 21, { align: 'center' });

  // Right — signature line
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  const sigRightX = pageWidth - mr - 45;
  doc.text(branding.signatureRight, sigRightX + 22, sigY + 5, { align: 'center' });
  doc.setDrawColor(...C.body);
  doc.setLineWidth(0.3);
  doc.line(sigRightX, sigY + 20, pageWidth - mr, sigY + 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.lightMuted);
  doc.text('Name & Designation', sigRightX, sigY + 24);
  doc.text('Date:', sigRightX + 30, sigY + 24);
}

// ════════════════════════════════════════════════════════════════
// SHARED FOOTER
// ════════════════════════════════════════════════════════════════
function drawFooter(ctx: DocContext, branding: typeof DOMAIN_BRANDING.medical) {
  const { doc, ml, mr, pageWidth, pageHeight } = ctx;
  const fy = pageHeight - 7;

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(ml, fy - 3, pageWidth - mr, fy - 3);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...C.lightMuted);
  doc.text(branding.footerNote, pageWidth / 2, fy, { align: 'center' });
}

// ════════════════════════════════════════════════════════════════
// SHARED META INFO BOX
// ════════════════════════════════════════════════════════════════
function drawMetaBox(ctx: DocContext, fields: Array<[string, string]>, height = 24) {
  const { doc, ml } = ctx;
  const colCount = Math.min(fields.length, 4);
  const colWidth = ctx.cw / colCount;

  // Box background
  doc.setFillColor(...C.sectionBg);
  doc.roundedRect(ml, ctx.y, ctx.cw, height, 2, 2, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(ml, ctx.y, ctx.cw, height, 2, 2, 'S');

  const innerY = ctx.y + 6;
  for (let i = 0; i < fields.length; i++) {
    const col = i % colCount;
    const row = Math.floor(i / colCount);
    const x = ml + col * colWidth + 5;
    const y = innerY + row * 14;
    labelValue(ctx, x, y, fields[i][0], fields[i][1], colWidth - 10);
  }

  const rows = Math.ceil(fields.length / colCount);
  ctx.y += Math.max(height, rows * 14 + 6) + 5;
}

// ════════════════════════════════════════════════════════════════
// MEDICAL PRESCRIPTION — Clean, doctor-friendly prescription
// ════════════════════════════════════════════════════════════════
function parsePatientDetails(items: IntelligenceItem[]): { name: string; age: string; gender: string } {
  let name = '';
  let age = '';
  let gender = '';

  const patientItems = items.filter(i => i.category.toLowerCase().includes('patient'));
  for (const item of patientItems) {
    const info = item.content;
    const lower = info.toLowerCase();
    const ageMatch = info.match(/(\d+)\s*(?:y(?:ears?)?|yr|yrs)\s*(?:old)?/i);
    if (ageMatch) { age = ageMatch[1] + ' years'; continue; }
    if (/\b(male|female|man|woman|boy|girl)\b/i.test(lower)) {
      const gMatch = lower.match(/\b(male|female|man|woman|boy|girl)\b/i);
      if (gMatch) gender = gMatch[1].charAt(0).toUpperCase() + gMatch[1].slice(1);
      const remaining = info.replace(/\b(male|female|man|woman|boy|girl)\b/i, '').trim();
      if (remaining && !name) name = remaining;
      continue;
    }
    if (/^\d+$/.test(info.trim())) { age = info.trim() + ' years'; continue; }
    if (!name) name = info;
  }

  return { name: name || 'N/A', age: age || 'N/A', gender: gender || 'N/A' };
}

function generateMedicalPdf(ctx: DocContext, session: VaultSession, content: SessionContent, caseItem?: VaultCase) {
  const branding = DOMAIN_BRANDING.medical;
  const { doc, ml, mr, pageWidth } = ctx;
  const grouped = groupByCategory(content.intelligence);
  const patient = parsePatientDetails(content.intelligence);
  const ts = session.createdAt;

  drawHeader(ctx, branding);

  // ── Patient Information Box — generous space, large readable text ──
  const boxH = 42;
  doc.setFillColor(...C.sectionBg);
  doc.roundedRect(ml, ctx.y, ctx.cw, boxH, 2, 2, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(ml, ctx.y, ctx.cw, boxH, 2, 2, 'S');

  const halfW = ctx.cw / 2;
  const thirdW = ctx.cw / 3;
  const qw = ctx.cw / 4;

  // Row 1: Patient Name (full width, prominent)
  const row1Y = ctx.y + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.muted);
  doc.text('PATIENT NAME', ml + 5, row1Y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...C.body);
  doc.text(patient.name || 'N/A', ml + 5, row1Y + 7);

  // Age and Gender on same row, right side
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.muted);
  doc.text('AGE', ml + halfW + 5, row1Y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.body);
  doc.text(patient.age || 'N/A', ml + halfW + 5, row1Y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.muted);
  doc.text('GENDER', ml + halfW + qw + 5, row1Y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.body);
  doc.text(patient.gender || 'N/A', ml + halfW + qw + 5, row1Y + 7);

  // Separator between rows
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.15);
  doc.line(ml + 5, row1Y + 12, ml + ctx.cw - 5, row1Y + 12);

  // Row 2: Date, Time, Case Ref, Duration
  const row2Y = row1Y + 16;
  labelValue(ctx, ml + 5, row2Y, 'DATE', formatDate(ts), qw - 8);
  labelValue(ctx, ml + qw + 5, row2Y, 'TIME', formatTime(ts), qw - 8);
  labelValue(ctx, ml + qw * 2 + 5, row2Y, 'CASE REF.', caseItem?.shortId || session.caseNumber, qw - 8);
  labelValue(ctx, ml + qw * 3 + 5, row2Y, 'DURATION', formatDuration(session.duration), qw - 8);

  ctx.y += boxH + 6;

  // ── Vital Signs Cards ──
  const vitals = grouped['Vital Signs'] || [];
  if (vitals.length > 0) {
    sectionHeading(ctx, 'VITAL SIGNS');
    const cardW = Math.min(44, (ctx.cw - (vitals.length - 1) * 4) / vitals.length);
    let vx = ml;
    for (const v of vitals) {
      if (vx + cardW > pageWidth - mr) { vx = ml; ctx.y += 22; }
      ensureSpace(ctx, 20);
      // Card
      doc.setFillColor(240, 248, 255);
      doc.roundedRect(vx, ctx.y, cardW, 18, 2, 2, 'F');
      doc.setDrawColor(180, 210, 235);
      doc.setLineWidth(0.2);
      doc.roundedRect(vx, ctx.y, cardW, 18, 2, 2, 'S');
      // Parse label/value
      const parts = v.content.match(/^([A-Za-z\s]+[A-Za-z])\s*[:\-]?\s*(.+)$/);
      if (parts) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...C.muted);
        doc.text(parts[1].trim().toUpperCase(), vx + cardW / 2, ctx.y + 6, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...branding.accentColor);
        doc.text(parts[2].trim(), vx + cardW / 2, ctx.y + 14, { align: 'center' });
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...branding.accentColor);
        doc.text(v.content, vx + cardW / 2, ctx.y + 12, { align: 'center' });
      }
      vx += cardW + 4;
    }
    ctx.y += 24;
  }

  // ── Chief Complaints / Symptoms ──
  const symptoms = grouped['Symptoms'] || [];
  if (symptoms.length > 0) {
    sectionHeading(ctx, 'CHIEF COMPLAINTS / SYMPTOMS');
    bulletList(ctx, symptoms.map(s => s.content));
  }

  // ── Diagnosis ──
  const diagnoses = grouped['Diagnoses'] || [];
  if (diagnoses.length > 0) {
    sectionHeading(ctx, 'DIAGNOSIS');
    bulletList(ctx, diagnoses.map(d => d.content));
  }

  // ── Rx — Medications ──
  ensureSpace(ctx, 22);
  // Rx symbol — large, red, iconic
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(...C.rxRed);
  doc.text('Rx', ml + 2, ctx.y + 7);

  // Section bar (shifted right for Rx) — accent bg with white text
  const sectionBg = branding.sectionBg;
  doc.setFillColor(sectionBg[0], sectionBg[1], sectionBg[2]);
  doc.rect(ml + 18, ctx.y, ctx.cw - 18, 8, 'F');
  doc.setFillColor(branding.accentColor[0], branding.accentColor[1], branding.accentColor[2]);
  doc.rect(ml + 18, ctx.y, 2.5, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...branding.accentColor);
  doc.text('MEDICATIONS PRESCRIBED', ml + 24, ctx.y + 5.8);
  ctx.y += 12;

  const medications = grouped['Medications'] || [];
  if (medications.length > 0) {
    // Table header
    doc.setFillColor(...C.tableBg);
    doc.rect(ml, ctx.y, ctx.cw, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text('S.No.', ml + 4, ctx.y + 5);
    doc.text('MEDICATION / DOSAGE / INSTRUCTIONS', ml + 20, ctx.y + 5);
    doc.text('TIME', pageWidth - mr - 20, ctx.y + 5);
    ctx.y += 10;

    for (let i = 0; i < medications.length; i++) {
      ensureSpace(ctx, 10);
      if (i % 2 === 0) {
        doc.setFillColor(...C.tableAlt);
        doc.rect(ml, ctx.y - 4, ctx.cw, 9, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...branding.accentColor);
      doc.text(`${i + 1}.`, ml + 6, ctx.y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...C.body);
      const medLines = doc.splitTextToSize(medications[i].content, ctx.cw - 44);
      doc.text(medLines[0], ml + 20, ctx.y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.lightMuted);
      doc.text(medications[i].timestamp, pageWidth - mr - 18, ctx.y);
      ctx.y += 6;
      for (let li = 1; li < medLines.length; li++) {
        doc.setFontSize(11);
        doc.setTextColor(...C.body);
        doc.text(medLines[li], ml + 20, ctx.y);
        ctx.y += 5.5;
      }
      ctx.y += 3;
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...C.lightMuted);
    doc.text('No medications recorded in this session.', ml + 4, ctx.y);
    ctx.y += 8;
  }
  ctx.y += 4;

  // ── Follow-up / Advice ──
  const followUp = grouped['Follow-up Actions'] || [];
  if (followUp.length > 0) {
    sectionHeading(ctx, 'FOLLOW-UP / ADVICE');
    bulletList(ctx, followUp.map(f => f.content));
  }

  drawSignatureBlock(ctx, branding, session);
  drawFooter(ctx, branding);

  const pName = patient.name !== 'N/A' ? patient.name.replace(/\s+/g, '_') : 'Patient';
  return `${branding.filePrefix}_${pName}_${formatDate(session.createdAt).replace(/\s/g, '')}_${branding.name}.pdf`;
}

// ════════════════════════════════════════════════════════════════
// SECURITY AUDIT REPORT
// ════════════════════════════════════════════════════════════════
function generateSecurityPdf(ctx: DocContext, session: VaultSession, content: SessionContent, caseItem?: VaultCase) {
  const branding = DOMAIN_BRANDING.security;
  const { doc, ml, mr, pageWidth } = ctx;
  const grouped = groupByCategory(content.intelligence);

  drawHeader(ctx, branding);

  // ── Report Metadata ──
  drawMetaBox(ctx, [
    ['REPORT DATE', formatDate(session.createdAt)],
    ['ASSESSMENT TIME', formatTime(session.createdAt)],
    ['CASE REFERENCE', caseItem?.shortId || session.caseNumber],
    ['DURATION', formatDuration(session.duration)],
    ['CLASSIFICATION', 'TOP SECRET'],
    ['SEGMENTS', String(content.transcripts.length)],
    ['FINDINGS', String(content.intelligence.length)],
    ['STATUS', 'UNDER REVIEW'],
  ], 34);

  // Severity banner
  const vulns = grouped['Vulnerabilities'] || [];
  if (vulns.length > 0) {
    ensureSpace(ctx, 14);
    doc.setFillColor(...C.urgentRed);
    doc.roundedRect(ml, ctx.y, ctx.cw, 9, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.white);
    doc.text(`ALERT: ${vulns.length} VULNERABILITY${vulns.length > 1 ? 'S' : ''} IDENTIFIED`, ml + 5, ctx.y + 6.5);
    ctx.y += 14;
  }

  // ── Vulnerabilities ──
  if (vulns.length > 0) {
    sectionHeading(ctx, 'VULNERABILITIES DISCOVERED');
    numberedList(ctx, vulns.map(v => v.content), C.urgentRed);
  }

  // ── Timeline ──
  const timeline = grouped['Timeline'] || [];
  if (timeline.length > 0) {
    sectionHeading(ctx, 'EVENT TIMELINE');
    for (const t of timeline) {
      ensureSpace(ctx, 10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...branding.accentColor);
      doc.text(`[${t.timestamp}]`, ml + 4, ctx.y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...C.body);
      const lines = doc.splitTextToSize(t.content, ctx.cw - 32);
      doc.text(lines[0], ml + 26, ctx.y);
      ctx.y += 6;
      for (let li = 1; li < lines.length; li++) {
        doc.text(lines[li], ml + 26, ctx.y);
        ctx.y += 5.5;
      }
      ctx.y += 2.5;
    }
    ctx.y += 3;
  }

  // ── Evidence ──
  const evidence = grouped['Evidence'] || [];
  if (evidence.length > 0) {
    sectionHeading(ctx, 'EVIDENCE COLLECTED');
    numberedList(ctx, evidence.map(e => e.content));
  }

  // ── Affected Systems ──
  const systems = grouped['Affected Systems'] || [];
  if (systems.length > 0) {
    sectionHeading(ctx, 'AFFECTED SYSTEMS');
    bulletList(ctx, systems.map(s => s.content));
  }

  // ── Risk Assessment ──
  const risks = grouped['Risk Assessment'] || [];
  if (risks.length > 0) {
    sectionHeading(ctx, 'RISK ASSESSMENT');
    for (const r of risks) {
      ensureSpace(ctx, 12);
      doc.setFillColor(255, 245, 245);
      doc.roundedRect(ml, ctx.y, ctx.cw, 10, 1.5, 1.5, 'F');
      doc.setDrawColor(230, 200, 200);
      doc.setLineWidth(0.2);
      doc.roundedRect(ml, ctx.y, ctx.cw, 10, 1.5, 1.5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...C.urgentRed);
      const riskLines = doc.splitTextToSize(r.content, ctx.cw - 10);
      doc.text(riskLines[0], ml + 5, ctx.y + 7);
      ctx.y += 13;
    }
    ctx.y += 3;
  }

  drawSignatureBlock(ctx, branding, session);
  drawFooter(ctx, branding);

  return `${branding.filePrefix}_${caseItem?.shortId || session.caseNumber}_${formatDate(session.createdAt).replace(/\s/g, '')}_${branding.name}.pdf`;
}

// ════════════════════════════════════════════════════════════════
// LEGAL DEPOSITION SUMMARY
// ════════════════════════════════════════════════════════════════
function generateLegalPdf(ctx: DocContext, session: VaultSession, content: SessionContent, caseItem?: VaultCase) {
  const branding = DOMAIN_BRANDING.legal;
  const { doc, ml, mr, pageWidth } = ctx;
  const grouped = groupByCategory(content.intelligence);

  drawHeader(ctx, branding);

  // ── Deposition Details ──
  drawMetaBox(ctx, [
    ['DEPOSITION DATE', formatDate(session.createdAt)],
    ['SESSION TIME', formatTime(session.createdAt)],
    ['CASE FILE', caseItem?.shortId || session.caseNumber],
    ['DURATION', formatDuration(session.duration)],
    ['CLASSIFICATION', 'CONFIDENTIAL'],
    ['TRANSCRIPT SEG.', String(content.transcripts.length)],
    ['FINDINGS', String(content.intelligence.length)],
    ['CASE NAME', caseItem?.name || 'N/A'],
  ], 34);

  // Privileged notice
  ensureSpace(ctx, 14);
  doc.setFillColor(255, 248, 240);
  doc.roundedRect(ml, ctx.y, ctx.cw, 9, 1.5, 1.5, 'F');
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.3);
  doc.roundedRect(ml, ctx.y, ctx.cw, 9, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...branding.accentColor);
  doc.text('ATTORNEY-CLIENT PRIVILEGE  \u2014  WORK PRODUCT DOCTRINE MAY APPLY', ml + 5, ctx.y + 6);
  ctx.y += 14;

  // ── Key Statements ──
  const statements = grouped['Key Statements'] || [];
  if (statements.length > 0) {
    sectionHeading(ctx, 'KEY STATEMENTS & ADMISSIONS');
    numberedList(ctx, statements.map(s => s.content));
  }

  // ── Timeline ──
  const timeline = grouped['Timeline'] || [];
  if (timeline.length > 0) {
    sectionHeading(ctx, 'CHRONOLOGICAL TIMELINE');
    for (const t of timeline) {
      ensureSpace(ctx, 10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...branding.accentColor);
      doc.text(`[${t.timestamp}]`, ml + 4, ctx.y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...C.body);
      const lines = doc.splitTextToSize(t.content, ctx.cw - 32);
      doc.text(lines[0], ml + 26, ctx.y);
      ctx.y += 6;
      for (let li = 1; li < lines.length; li++) {
        doc.text(lines[li], ml + 26, ctx.y);
        ctx.y += 5.5;
      }
      ctx.y += 2.5;
    }
    ctx.y += 3;
  }

  // ── Parties Involved ──
  const parties = grouped['Parties Involved'] || [];
  if (parties.length > 0) {
    sectionHeading(ctx, 'PARTIES INVOLVED');
    // Table format for parties
    doc.setFillColor(...C.tableBg);
    doc.rect(ml, ctx.y, ctx.cw, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text('S.No.', ml + 4, ctx.y + 5);
    doc.text('PARTY / ROLE', ml + 20, ctx.y + 5);
    doc.text('NOTED AT', pageWidth - mr - 20, ctx.y + 5);
    ctx.y += 10;

    for (let i = 0; i < parties.length; i++) {
      ensureSpace(ctx, 10);
      if (i % 2 === 0) {
        doc.setFillColor(...C.tableAlt);
        doc.rect(ml, ctx.y - 4, ctx.cw, 9, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...branding.accentColor);
      doc.text(`${i + 1}.`, ml + 6, ctx.y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...C.body);
      doc.text(parties[i].content, ml + 20, ctx.y);
      doc.setFontSize(8);
      doc.setTextColor(...C.lightMuted);
      doc.text(parties[i].timestamp, pageWidth - mr - 18, ctx.y);
      ctx.y += 8;
    }
    ctx.y += 5;
  }

  // ── Contradictions ──
  const contradictions = grouped['Contradictions'] || [];
  if (contradictions.length > 0) {
    sectionHeading(ctx, 'CONTRADICTIONS & INCONSISTENCIES');
    for (const c of contradictions) {
      ensureSpace(ctx, 12);
      doc.setFillColor(255, 250, 245);
      doc.roundedRect(ml, ctx.y, ctx.cw, 10, 1.5, 1.5, 'F');
      doc.setDrawColor(220, 190, 160);
      doc.setLineWidth(0.2);
      doc.roundedRect(ml, ctx.y, ctx.cw, 10, 1.5, 1.5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(180, 100, 30);
      doc.text('\u26A0', ml + 5, ctx.y + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...C.body);
      const lines = doc.splitTextToSize(c.content, ctx.cw - 16);
      doc.text(lines[0], ml + 12, ctx.y + 7);
      ctx.y += 13;
    }
    ctx.y += 3;
  }

  // ── Exhibits ──
  const exhibits = grouped['Exhibits'] || [];
  if (exhibits.length > 0) {
    sectionHeading(ctx, 'EXHIBITS & DOCUMENTARY EVIDENCE');
    numberedList(ctx, exhibits.map(e => e.content));
  }

  drawSignatureBlock(ctx, branding, session);
  drawFooter(ctx, branding);

  return `${branding.filePrefix}_${caseItem?.shortId || session.caseNumber}_${formatDate(session.createdAt).replace(/\s/g, '')}_${branding.name}.pdf`;
}

// ════════════════════════════════════════════════════════════════
// INCIDENT REPORT
// ════════════════════════════════════════════════════════════════
function generateIncidentPdf(ctx: DocContext, session: VaultSession, content: SessionContent, caseItem?: VaultCase) {
  const branding = DOMAIN_BRANDING.incident;
  const { doc, ml, mr, pageWidth } = ctx;
  const grouped = groupByCategory(content.intelligence);

  drawHeader(ctx, branding);

  // ── Incident Summary Box ──
  drawMetaBox(ctx, [
    ['REPORT DATE', formatDate(session.createdAt)],
    ['REPORT TIME', formatTime(session.createdAt)],
    ['INCIDENT REF.', caseItem?.shortId || session.caseNumber],
    ['DURATION', formatDuration(session.duration)],
    ['PRIORITY', 'URGENT'],
    ['SEGMENTS', String(content.transcripts.length)],
    ['FINDINGS', String(content.intelligence.length)],
    ['CASE NAME', caseItem?.name || 'N/A'],
  ], 34);

  // Urgency banner
  ensureSpace(ctx, 14);
  doc.setFillColor(255, 240, 230);
  doc.roundedRect(ml, ctx.y, ctx.cw, 9, 1.5, 1.5, 'F');
  doc.setDrawColor(...branding.accentColor);
  doc.setLineWidth(0.4);
  doc.roundedRect(ml, ctx.y, ctx.cw, 9, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...branding.accentColor);
  doc.text('IMMEDIATE ATTENTION REQUIRED  \u2014  INCIDENT UNDER ACTIVE INVESTIGATION', ml + 5, ctx.y + 6);
  ctx.y += 14;

  // ── Incident Timeline ──
  const timeline = grouped['Incident Timeline'] || [];
  if (timeline.length > 0) {
    sectionHeading(ctx, 'INCIDENT TIMELINE');
    for (let i = 0; i < timeline.length; i++) {
      const t = timeline[i];
      ensureSpace(ctx, 12);

      // Timeline connector line
      if (i > 0) {
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.3);
        doc.line(ml + 8, ctx.y - 4, ml + 8, ctx.y);
      }

      // Timeline dot
      doc.setFillColor(...branding.accentColor);
      doc.circle(ml + 8, ctx.y + 2, 1.8, 'F');

      // Timestamp
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...branding.accentColor);
      doc.text(t.timestamp, ml + 14, ctx.y + 1);

      // Event description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...C.body);
      const lines = doc.splitTextToSize(t.content, ctx.cw - 32);
      doc.text(lines[0], ml + 14, ctx.y + 6.5);
      ctx.y += 10;
      for (let li = 1; li < lines.length; li++) {
        doc.text(lines[li], ml + 14, ctx.y);
        ctx.y += 5.5;
      }
      ctx.y += 2.5;
    }
    ctx.y += 3;
  }

  // ── Witnesses ──
  const witnesses = grouped['Witnesses'] || [];
  if (witnesses.length > 0) {
    sectionHeading(ctx, 'WITNESSES & INVOLVED PERSONNEL');
    // Table format
    doc.setFillColor(...C.tableBg);
    doc.rect(ml, ctx.y, ctx.cw, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text('S.No.', ml + 4, ctx.y + 5);
    doc.text('WITNESS / PERSONNEL', ml + 20, ctx.y + 5);
    doc.text('NOTED AT', pageWidth - mr - 20, ctx.y + 5);
    ctx.y += 10;

    for (let i = 0; i < witnesses.length; i++) {
      ensureSpace(ctx, 10);
      if (i % 2 === 0) {
        doc.setFillColor(...C.tableAlt);
        doc.rect(ml, ctx.y - 4, ctx.cw, 9, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...branding.accentColor);
      doc.text(`${i + 1}.`, ml + 6, ctx.y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...C.body);
      doc.text(witnesses[i].content, ml + 20, ctx.y);
      doc.setFontSize(8);
      doc.setTextColor(...C.lightMuted);
      doc.text(witnesses[i].timestamp, pageWidth - mr - 18, ctx.y);
      ctx.y += 8;
    }
    ctx.y += 5;
  }

  // ── Damage Assessment ──
  const damage = grouped['Damage Assessment'] || [];
  if (damage.length > 0) {
    sectionHeading(ctx, 'DAMAGE ASSESSMENT');
    numberedList(ctx, damage.map(d => d.content));
  }

  // ── Root Cause ──
  const rootCause = grouped['Root Cause'] || [];
  if (rootCause.length > 0) {
    sectionHeading(ctx, 'ROOT CAUSE ANALYSIS');
    for (const rc of rootCause) {
      ensureSpace(ctx, 12);
      doc.setFillColor(255, 248, 240);
      doc.roundedRect(ml, ctx.y, ctx.cw, 10, 1.5, 1.5, 'F');
      doc.setDrawColor(230, 200, 170);
      doc.setLineWidth(0.2);
      doc.roundedRect(ml, ctx.y, ctx.cw, 10, 1.5, 1.5, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...C.body);
      const lines = doc.splitTextToSize(rc.content, ctx.cw - 10);
      doc.text(lines[0], ml + 5, ctx.y + 7);
      ctx.y += 13;
    }
    ctx.y += 3;
  }

  // ── Next Steps ──
  const nextSteps = grouped['Next Steps'] || [];
  if (nextSteps.length > 0) {
    sectionHeading(ctx, 'RECOMMENDED NEXT STEPS');
    // Checkbox style for action items
    for (const step of nextSteps) {
      ensureSpace(ctx, 10);
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.rect(ml + 4, ctx.y - 3, 4, 4, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...C.body);
      const lines = doc.splitTextToSize(step.content, ctx.cw - 16);
      doc.text(lines[0], ml + 12, ctx.y);
      ctx.y += 6;
      for (let li = 1; li < lines.length; li++) {
        doc.text(lines[li], ml + 12, ctx.y);
        ctx.y += 5.5;
      }
      ctx.y += 2.5;
    }
    ctx.y += 3;
  }

  drawSignatureBlock(ctx, branding, session);
  drawFooter(ctx, branding);

  return `${branding.filePrefix}_${caseItem?.shortId || session.caseNumber}_${formatDate(session.createdAt).replace(/\s/g, '')}_${branding.name}.pdf`;
}

// ════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════
export function generateSessionPdf(
  domain: DomainProfile,
  vaultSession: VaultSession,
  content: SessionContent,
  caseItem?: VaultCase,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const ml = 14;
  const mr = 14;

  // White background for print
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  const ctx: DocContext = {
    doc,
    pageWidth,
    pageHeight,
    ml,
    mr,
    cw: pageWidth - ml - mr,
    y: 0,
    accent: DOMAIN_BRANDING[domain.id].accentColor,
    headerBg: DOMAIN_BRANDING[domain.id].headerBg,
  };

  let fileName: string;

  switch (domain.id) {
    case 'medical':
      fileName = generateMedicalPdf(ctx, vaultSession, content, caseItem);
      break;
    case 'security':
      fileName = generateSecurityPdf(ctx, vaultSession, content, caseItem);
      break;
    case 'legal':
      fileName = generateLegalPdf(ctx, vaultSession, content, caseItem);
      break;
    case 'incident':
      fileName = generateIncidentPdf(ctx, vaultSession, content, caseItem);
      break;
    default:
      return;
  }

  doc.save(fileName);
}

// Backward compatibility alias
export const generatePrescriptionPdf = generateSessionPdf;

/**
 * All domains now support PDF generation
 */
export function canGeneratePrescription(_domainId: string): boolean {
  return true;
}

/**
 * Get the appropriate download button label per domain
 */
export function getDownloadLabel(domainId: DomainId): string {
  switch (domainId) {
    case 'medical': return 'DOWNLOAD PRESCRIPTION';
    case 'security': return 'DOWNLOAD AUDIT REPORT';
    case 'legal': return 'DOWNLOAD DEPOSITION';
    case 'incident': return 'DOWNLOAD INCIDENT REPORT';
    default: return 'DOWNLOAD REPORT';
  }
}
