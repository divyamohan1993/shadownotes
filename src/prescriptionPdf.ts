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
  signatureLeft: string;
  signatureRight: string;
  footerNote: string;
  filePrefix: string;
}> = {
  medical: {
    name: 'Sanjeevani',
    meaning: 'The Life-Giving Herb',
    fullTitle: 'dmj.one CSR Hospital \u2014 Sanjeevani',
    subtitle: 'Department of General Medicine',
    documentTitle: 'PATIENT PRESCRIPTION',
    accentColor: [0, 105, 146],
    headerBg: [0, 75, 110],
    signatureLeft: 'Hospital Seal',
    signatureRight: "Attending Physician's Signature",
    footerNote: 'This is a computer-generated prescription. Valid without signature for record purposes only.',
    filePrefix: 'Prescription',
  },
  security: {
    name: 'Kavach',
    meaning: 'The Divine Shield',
    fullTitle: 'dmj.one CSR Cybersecurity \u2014 Kavach',
    subtitle: 'Threat Intelligence & Vulnerability Assessment',
    documentTitle: 'SECURITY AUDIT REPORT',
    accentColor: [139, 0, 0],
    headerBg: [30, 30, 30],
    signatureLeft: 'Organization Seal',
    signatureRight: 'Lead Security Analyst',
    footerNote: 'CONFIDENTIAL: This security audit report contains sensitive vulnerability information. Handle per classification.',
    filePrefix: 'SecurityAudit',
  },
  legal: {
    name: 'Nyaaya',
    meaning: 'The Path of Justice',
    fullTitle: 'dmj.one CSR Legal Services \u2014 Nyaaya',
    subtitle: 'Deposition & Legal Documentation Division',
    documentTitle: 'LEGAL DEPOSITION SUMMARY',
    accentColor: [101, 67, 33],
    headerBg: [44, 36, 28],
    signatureLeft: 'Notary Seal',
    signatureRight: 'Counsel / Authorized Officer',
    footerNote: 'PRIVILEGED & CONFIDENTIAL: Attorney-client privilege may apply. Unauthorized disclosure prohibited.',
    filePrefix: 'LegalDeposition',
  },
  incident: {
    name: 'Prahari',
    meaning: 'The Vigilant Sentinel',
    fullTitle: 'dmj.one CSR Incident Response \u2014 Prahari',
    subtitle: 'Emergency Response & Investigation Unit',
    documentTitle: 'INCIDENT REPORT',
    accentColor: [180, 80, 0],
    headerBg: [80, 30, 0],
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
  muted: [108, 117, 125] as RGB,
  lightMuted: [156, 163, 175] as RGB,
  border: [210, 214, 220] as RGB,
  sectionBg: [248, 249, 250] as RGB,
  tableBg: [243, 244, 246] as RGB,
  tableAlt: [249, 250, 251] as RGB,
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
  if (ctx.y + needed > ctx.pageHeight - 20) {
    ctx.doc.addPage();
    ctx.y = 18;
  }
}

function hLine(ctx: DocContext, y: number, color: RGB = C.border, width = 0.3) {
  ctx.doc.setDrawColor(...color);
  ctx.doc.setLineWidth(width);
  ctx.doc.line(ctx.ml, y, ctx.pageWidth - ctx.mr, y);
}

function sectionHeading(ctx: DocContext, title: string, icon?: string) {
  ensureSpace(ctx, 14);
  const { doc, ml, pageWidth, mr, accent } = ctx;
  // Background strip
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(ml, ctx.y, ctx.cw, 7, 'F');
  // Title text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.white);
  const label = icon ? `${icon}  ${title}` : title;
  doc.text(label, ml + 4, ctx.y + 5);
  ctx.y += 10;
}

function labelValue(ctx: DocContext, x: number, y: number, label: string, value: string, maxWidth?: number) {
  const { doc } = ctx;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.body);
  if (maxWidth) {
    const lines = doc.splitTextToSize(value || 'N/A', maxWidth);
    doc.text(lines[0] || 'N/A', x, y + 4.5);
  } else {
    doc.text(value || 'N/A', x, y + 4.5);
  }
}

function bulletList(ctx: DocContext, items: string[], color: RGB = C.body) {
  const { doc, ml, pageHeight } = ctx;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...color);
  for (const item of items) {
    ensureSpace(ctx, 6);
    const lines = doc.splitTextToSize(item, ctx.cw - 10);
    doc.text('\u2022', ml + 4, ctx.y);
    for (let li = 0; li < lines.length; li++) {
      doc.text(lines[li], ml + 10, ctx.y);
      ctx.y += 4.8;
      ensureSpace(ctx, 5);
    }
    ctx.y += 1;
  }
  ctx.y += 2;
}

function numberedList(ctx: DocContext, items: string[], color: RGB = C.body) {
  const { doc, ml } = ctx;
  for (let i = 0; i < items.length; i++) {
    ensureSpace(ctx, 8);
    // Alternating row background
    if (i % 2 === 0) {
      doc.setFillColor(...C.tableAlt);
      doc.rect(ml, ctx.y - 3.5, ctx.cw, 7.5, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...ctx.accent);
    doc.text(`${(i + 1).toString().padStart(2, '0')}`, ml + 4, ctx.y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(items[i], ctx.cw - 18);
    doc.text(lines[0], ml + 14, ctx.y);
    ctx.y += 5;
    for (let li = 1; li < lines.length; li++) {
      doc.text(lines[li], ml + 14, ctx.y);
      ctx.y += 4.5;
    }
    ctx.y += 2.5;
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
// SHARED HEADER — World-class professional header for all docs
// ════════════════════════════════════════════════════════════════
function drawHeader(ctx: DocContext, branding: typeof DOMAIN_BRANDING.medical) {
  const { doc, pageWidth, ml, mr } = ctx;
  const w = pageWidth;

  // ── Main header background ──
  const hh = 34;
  doc.setFillColor(...branding.headerBg);
  doc.rect(0, 0, w, hh, 'F');

  // Subtle gradient overlay (darker strip at top)
  doc.setFillColor(0, 0, 0);
  doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
  doc.rect(0, 0, w, 4, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // Organization name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...C.white);
  doc.text(branding.fullTitle, w / 2, 13, { align: 'center' });

  // Hindi meaning in elegant italic
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(200, 210, 225);
  doc.text(`\u2014 ${branding.meaning} \u2014`, w / 2, 19, { align: 'center' });

  // Subtitle department
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(170, 185, 205);
  doc.text(branding.subtitle, w / 2, 24.5, { align: 'center' });

  // Contact line
  doc.setFontSize(6.5);
  doc.setTextColor(140, 155, 175);
  doc.text(`${ORG_WEBSITE}  |  ${ORG_EMAIL}  |  "${ORG_MOTTO}"`, w / 2, 30, { align: 'center' });

  // Gold accent line beneath header
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(1);
  doc.line(ml, hh + 0.5, w - mr, hh + 0.5);
  doc.setDrawColor(...C.goldLight);
  doc.setLineWidth(0.3);
  doc.line(ml, hh + 2.5, w - mr, hh + 2.5);

  ctx.y = hh + 7;

  // ── Document title ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...branding.accentColor);
  doc.text(branding.documentTitle, w / 2, ctx.y, { align: 'center' });
  ctx.y += 2;

  // Thin underline for document title
  const titleWidth = doc.getTextWidth(branding.documentTitle);
  hLine({ ...ctx, y: ctx.y } as DocContext, ctx.y, branding.accentColor, 0.5);
  ctx.y += 5;
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
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text(branding.signatureLeft, ml + 22, sigY + 5, { align: 'center' });
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.5, 1], 0);
  doc.roundedRect(ml, sigY + 7, 44, 18, 1.5, 1.5, 'S');
  doc.setLineDashPattern([], 0);

  // Center — AI notice
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.lightMuted);
  doc.text('Generated by ShadowNotes AI', pageWidth / 2, sigY + 12, { align: 'center' });
  doc.text(`Session: ${session.caseNumber}`, pageWidth / 2, sigY + 16, { align: 'center' });
  doc.text(`Date: ${formatDate(session.createdAt)} at ${formatTime(session.createdAt)}`, pageWidth / 2, sigY + 20, { align: 'center' });

  // Right — signature line
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  const sigRightX = pageWidth - mr - 45;
  doc.text(branding.signatureRight, sigRightX + 22, sigY + 5, { align: 'center' });
  doc.setDrawColor(...C.body);
  doc.setLineWidth(0.3);
  doc.line(sigRightX, sigY + 20, pageWidth - mr, sigY + 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
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

  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.3);
  doc.line(ml, fy - 3, pageWidth - mr, fy - 3);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(...C.lightMuted);
  doc.text(branding.footerNote, pageWidth / 2, fy, { align: 'center' });
}

// ════════════════════════════════════════════════════════════════
// SHARED META INFO BOX
// ════════════════════════════════════════════════════════════════
function drawMetaBox(ctx: DocContext, fields: Array<[string, string]>, height = 20) {
  const { doc, ml } = ctx;
  const colCount = Math.min(fields.length, 4);
  const colWidth = ctx.cw / colCount;

  // Box background
  doc.setFillColor(...C.sectionBg);
  doc.roundedRect(ml, ctx.y, ctx.cw, height, 2, 2, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(ml, ctx.y, ctx.cw, height, 2, 2, 'S');

  const innerY = ctx.y + 5;
  for (let i = 0; i < fields.length; i++) {
    const col = i % colCount;
    const row = Math.floor(i / colCount);
    const x = ml + col * colWidth + 5;
    const y = innerY + row * 12;
    labelValue(ctx, x, y, fields[i][0], fields[i][1], colWidth - 10);
  }

  const rows = Math.ceil(fields.length / colCount);
  ctx.y += Math.max(height, rows * 12 + 5) + 4;
}

// ════════════════════════════════════════════════════════════════
// MEDICAL PRESCRIPTION — World-class hospital prescription
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

  // ── Patient Information Box (2 rows x 4 cols) ──
  const boxH = 26;
  doc.setFillColor(...C.sectionBg);
  doc.roundedRect(ml, ctx.y, ctx.cw, boxH, 2, 2, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(ml, ctx.y, ctx.cw, boxH, 2, 2, 'S');

  const qw = ctx.cw / 4; // quarter width
  const by = ctx.y + 5;
  labelValue(ctx, ml + 4, by, 'PATIENT NAME', patient.name, qw * 2 - 8);
  labelValue(ctx, ml + qw * 2 + 4, by, 'AGE', patient.age, qw - 8);
  labelValue(ctx, ml + qw * 3 + 4, by, 'GENDER', patient.gender, qw - 8);
  labelValue(ctx, ml + 4, by + 12, 'DATE', formatDate(ts), qw - 8);
  labelValue(ctx, ml + qw + 4, by + 12, 'REVIEW TIME', formatTime(ts), qw - 8);
  labelValue(ctx, ml + qw * 2 + 4, by + 12, 'CASE REF.', caseItem?.shortId || session.caseNumber, qw - 8);
  labelValue(ctx, ml + qw * 3 + 4, by + 12, 'DURATION', formatDuration(session.duration), qw - 8);

  ctx.y += boxH + 5;

  // ── Vital Signs Cards ──
  const vitals = grouped['Vital Signs'] || [];
  if (vitals.length > 0) {
    sectionHeading(ctx, 'VITAL SIGNS');
    const cardW = Math.min(42, (ctx.cw - (vitals.length - 1) * 3) / vitals.length);
    let vx = ml;
    for (const v of vitals) {
      if (vx + cardW > pageWidth - mr) { vx = ml; ctx.y += 18; }
      ensureSpace(ctx, 18);
      // Card
      doc.setFillColor(240, 248, 255);
      doc.roundedRect(vx, ctx.y, cardW, 15, 2, 2, 'F');
      doc.setDrawColor(180, 210, 235);
      doc.setLineWidth(0.2);
      doc.roundedRect(vx, ctx.y, cardW, 15, 2, 2, 'S');
      // Parse label/value
      const parts = v.content.match(/^([A-Za-z\s]+[A-Za-z])\s*[:\-]?\s*(.+)$/);
      if (parts) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...C.muted);
        doc.text(parts[1].trim().toUpperCase(), vx + cardW / 2, ctx.y + 5, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...branding.accentColor);
        doc.text(parts[2].trim(), vx + cardW / 2, ctx.y + 12, { align: 'center' });
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...branding.accentColor);
        doc.text(v.content, vx + cardW / 2, ctx.y + 10, { align: 'center' });
      }
      vx += cardW + 3;
    }
    ctx.y += 20;
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
  ensureSpace(ctx, 20);
  // Rx symbol
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...C.rxRed);
  doc.text('Rx', ml + 2, ctx.y + 6);

  // Section bar (shifted right for Rx)
  doc.setFillColor(...branding.accentColor);
  doc.rect(ml + 16, ctx.y, ctx.cw - 16, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.white);
  doc.text('MEDICATIONS PRESCRIBED', ml + 20, ctx.y + 5);
  ctx.y += 10;

  const medications = grouped['Medications'] || [];
  if (medications.length > 0) {
    // Table header
    doc.setFillColor(...C.tableBg);
    doc.rect(ml, ctx.y, ctx.cw, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text('S.No.', ml + 4, ctx.y + 4);
    doc.text('MEDICATION / DOSAGE / INSTRUCTIONS', ml + 18, ctx.y + 4);
    doc.text('TIME', pageWidth - mr - 18, ctx.y + 4);
    ctx.y += 8;

    for (let i = 0; i < medications.length; i++) {
      ensureSpace(ctx, 8);
      if (i % 2 === 0) {
        doc.setFillColor(...C.tableAlt);
        doc.rect(ml, ctx.y - 3, ctx.cw, 7, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...branding.accentColor);
      doc.text(`${i + 1}.`, ml + 6, ctx.y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...C.body);
      const medLines = doc.splitTextToSize(medications[i].content, ctx.cw - 40);
      doc.text(medLines[0], ml + 18, ctx.y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.lightMuted);
      doc.text(medications[i].timestamp, pageWidth - mr - 16, ctx.y);
      ctx.y += 5;
      for (let li = 1; li < medLines.length; li++) {
        doc.setFontSize(9.5);
        doc.setTextColor(...C.body);
        doc.text(medLines[li], ml + 18, ctx.y);
        ctx.y += 4.5;
      }
      ctx.y += 2.5;
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...C.lightMuted);
    doc.text('No medications recorded in this session.', ml + 4, ctx.y);
    ctx.y += 7;
  }
  ctx.y += 3;

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
  ], 30);

  // Severity banner
  const vulns = grouped['Vulnerabilities'] || [];
  if (vulns.length > 0) {
    ensureSpace(ctx, 12);
    doc.setFillColor(...C.urgentRed);
    doc.roundedRect(ml, ctx.y, ctx.cw, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.white);
    doc.text(`ALERT: ${vulns.length} VULNERABILITY${vulns.length > 1 ? 'S' : ''} IDENTIFIED`, ml + 4, ctx.y + 5.5);
    ctx.y += 12;
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
      ensureSpace(ctx, 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...branding.accentColor);
      doc.text(`[${t.timestamp}]`, ml + 4, ctx.y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...C.body);
      const lines = doc.splitTextToSize(t.content, ctx.cw - 30);
      doc.text(lines[0], ml + 24, ctx.y);
      ctx.y += 5;
      for (let li = 1; li < lines.length; li++) {
        doc.text(lines[li], ml + 24, ctx.y);
        ctx.y += 4.5;
      }
      ctx.y += 2;
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
      ensureSpace(ctx, 10);
      doc.setFillColor(255, 245, 245);
      doc.roundedRect(ml, ctx.y, ctx.cw, 8, 1.5, 1.5, 'F');
      doc.setDrawColor(230, 200, 200);
      doc.setLineWidth(0.2);
      doc.roundedRect(ml, ctx.y, ctx.cw, 8, 1.5, 1.5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.urgentRed);
      const riskLines = doc.splitTextToSize(r.content, ctx.cw - 8);
      doc.text(riskLines[0], ml + 4, ctx.y + 5.5);
      ctx.y += 11;
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
  ], 30);

  // Privileged notice
  ensureSpace(ctx, 12);
  doc.setFillColor(255, 248, 240);
  doc.roundedRect(ml, ctx.y, ctx.cw, 8, 1.5, 1.5, 'F');
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.3);
  doc.roundedRect(ml, ctx.y, ctx.cw, 8, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...branding.accentColor);
  doc.text('ATTORNEY-CLIENT PRIVILEGE  \u2014  WORK PRODUCT DOCTRINE MAY APPLY', ml + 4, ctx.y + 5.5);
  ctx.y += 12;

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
      ensureSpace(ctx, 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...branding.accentColor);
      doc.text(`[${t.timestamp}]`, ml + 4, ctx.y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...C.body);
      const lines = doc.splitTextToSize(t.content, ctx.cw - 30);
      doc.text(lines[0], ml + 24, ctx.y);
      ctx.y += 5;
      for (let li = 1; li < lines.length; li++) {
        doc.text(lines[li], ml + 24, ctx.y);
        ctx.y += 4.5;
      }
      ctx.y += 2;
    }
    ctx.y += 3;
  }

  // ── Parties Involved ──
  const parties = grouped['Parties Involved'] || [];
  if (parties.length > 0) {
    sectionHeading(ctx, 'PARTIES INVOLVED');
    // Table format for parties
    doc.setFillColor(...C.tableBg);
    doc.rect(ml, ctx.y, ctx.cw, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text('S.No.', ml + 4, ctx.y + 4);
    doc.text('PARTY / ROLE', ml + 18, ctx.y + 4);
    doc.text('NOTED AT', pageWidth - mr - 18, ctx.y + 4);
    ctx.y += 8;

    for (let i = 0; i < parties.length; i++) {
      ensureSpace(ctx, 8);
      if (i % 2 === 0) {
        doc.setFillColor(...C.tableAlt);
        doc.rect(ml, ctx.y - 3, ctx.cw, 7, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...branding.accentColor);
      doc.text(`${i + 1}.`, ml + 6, ctx.y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...C.body);
      doc.text(parties[i].content, ml + 18, ctx.y);
      doc.setFontSize(7);
      doc.setTextColor(...C.lightMuted);
      doc.text(parties[i].timestamp, pageWidth - mr - 16, ctx.y);
      ctx.y += 7;
    }
    ctx.y += 5;
  }

  // ── Contradictions ──
  const contradictions = grouped['Contradictions'] || [];
  if (contradictions.length > 0) {
    sectionHeading(ctx, 'CONTRADICTIONS & INCONSISTENCIES');
    for (const c of contradictions) {
      ensureSpace(ctx, 10);
      doc.setFillColor(255, 250, 245);
      doc.roundedRect(ml, ctx.y, ctx.cw, 8, 1.5, 1.5, 'F');
      doc.setDrawColor(220, 190, 160);
      doc.setLineWidth(0.2);
      doc.roundedRect(ml, ctx.y, ctx.cw, 8, 1.5, 1.5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 100, 30);
      doc.text('\u26A0', ml + 4, ctx.y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...C.body);
      const lines = doc.splitTextToSize(c.content, ctx.cw - 14);
      doc.text(lines[0], ml + 10, ctx.y + 5.5);
      ctx.y += 11;
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
  ], 30);

  // Urgency banner
  ensureSpace(ctx, 12);
  doc.setFillColor(255, 240, 230);
  doc.roundedRect(ml, ctx.y, ctx.cw, 8, 1.5, 1.5, 'F');
  doc.setDrawColor(...branding.accentColor);
  doc.setLineWidth(0.4);
  doc.roundedRect(ml, ctx.y, ctx.cw, 8, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...branding.accentColor);
  doc.text('IMMEDIATE ATTENTION REQUIRED  \u2014  INCIDENT UNDER ACTIVE INVESTIGATION', ml + 4, ctx.y + 5.5);
  ctx.y += 12;

  // ── Incident Timeline ──
  const timeline = grouped['Incident Timeline'] || [];
  if (timeline.length > 0) {
    sectionHeading(ctx, 'INCIDENT TIMELINE');
    for (let i = 0; i < timeline.length; i++) {
      const t = timeline[i];
      ensureSpace(ctx, 10);

      // Timeline connector line
      if (i > 0) {
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.3);
        doc.line(ml + 8, ctx.y - 4, ml + 8, ctx.y);
      }

      // Timeline dot
      doc.setFillColor(...branding.accentColor);
      doc.circle(ml + 8, ctx.y + 2, 1.5, 'F');

      // Timestamp
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...branding.accentColor);
      doc.text(t.timestamp, ml + 14, ctx.y + 1);

      // Event description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...C.body);
      const lines = doc.splitTextToSize(t.content, ctx.cw - 30);
      doc.text(lines[0], ml + 14, ctx.y + 5.5);
      ctx.y += 8;
      for (let li = 1; li < lines.length; li++) {
        doc.text(lines[li], ml + 14, ctx.y);
        ctx.y += 4.5;
      }
      ctx.y += 2;
    }
    ctx.y += 3;
  }

  // ── Witnesses ──
  const witnesses = grouped['Witnesses'] || [];
  if (witnesses.length > 0) {
    sectionHeading(ctx, 'WITNESSES & INVOLVED PERSONNEL');
    // Table format
    doc.setFillColor(...C.tableBg);
    doc.rect(ml, ctx.y, ctx.cw, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text('S.No.', ml + 4, ctx.y + 4);
    doc.text('WITNESS / PERSONNEL', ml + 18, ctx.y + 4);
    doc.text('NOTED AT', pageWidth - mr - 18, ctx.y + 4);
    ctx.y += 8;

    for (let i = 0; i < witnesses.length; i++) {
      ensureSpace(ctx, 8);
      if (i % 2 === 0) {
        doc.setFillColor(...C.tableAlt);
        doc.rect(ml, ctx.y - 3, ctx.cw, 7, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...branding.accentColor);
      doc.text(`${i + 1}.`, ml + 6, ctx.y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...C.body);
      doc.text(witnesses[i].content, ml + 18, ctx.y);
      doc.setFontSize(7);
      doc.setTextColor(...C.lightMuted);
      doc.text(witnesses[i].timestamp, pageWidth - mr - 16, ctx.y);
      ctx.y += 7;
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
      ensureSpace(ctx, 10);
      doc.setFillColor(255, 248, 240);
      doc.roundedRect(ml, ctx.y, ctx.cw, 8, 1.5, 1.5, 'F');
      doc.setDrawColor(230, 200, 170);
      doc.setLineWidth(0.2);
      doc.roundedRect(ml, ctx.y, ctx.cw, 8, 1.5, 1.5, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...C.body);
      const lines = doc.splitTextToSize(rc.content, ctx.cw - 8);
      doc.text(lines[0], ml + 4, ctx.y + 5.5);
      ctx.y += 11;
    }
    ctx.y += 3;
  }

  // ── Next Steps ──
  const nextSteps = grouped['Next Steps'] || [];
  if (nextSteps.length > 0) {
    sectionHeading(ctx, 'RECOMMENDED NEXT STEPS');
    // Checkbox style for action items
    for (const step of nextSteps) {
      ensureSpace(ctx, 8);
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.rect(ml + 4, ctx.y - 2.5, 3.5, 3.5, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...C.body);
      const lines = doc.splitTextToSize(step.content, ctx.cw - 14);
      doc.text(lines[0], ml + 11, ctx.y);
      ctx.y += 5;
      for (let li = 1; li < lines.length; li++) {
        doc.text(lines[li], ml + 11, ctx.y);
        ctx.y += 4.5;
      }
      ctx.y += 2;
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
