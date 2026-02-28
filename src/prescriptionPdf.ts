import jsPDF from 'jspdf';
import type { VaultSession, SessionContent, IntelligenceItem, DomainProfile, VaultCase } from './types';

// Hospital Name: "Sanjeevani" — meaning "life-giving herb" from ancient Indian mythology
const HOSPITAL_NAME = 'Sanjeevani';
const HOSPITAL_FULL = 'dmj.one CSR Hospital — Sanjeevani';
const HOSPITAL_TAGLINE = 'Dream Manifest and Journey Together as One';
const HOSPITAL_ADDRESS = 'dmj.one CSR Healthcare Initiative';
const HOSPITAL_CONTACT = 'www.dmj.one | contact@dmj.one';

interface PrescriptionData {
  patientInfo: string[];
  symptoms: string[];
  diagnoses: string[];
  medications: string[];
  vitalSigns: string[];
  followUpActions: string[];
}

function extractPrescriptionData(intelligence: IntelligenceItem[]): PrescriptionData {
  const data: PrescriptionData = {
    patientInfo: [],
    symptoms: [],
    diagnoses: [],
    medications: [],
    vitalSigns: [],
    followUpActions: [],
  };

  for (const item of intelligence) {
    const cat = item.category.toLowerCase();
    if (cat.includes('patient')) data.patientInfo.push(item.content);
    else if (cat.includes('symptom')) data.symptoms.push(item.content);
    else if (cat.includes('diagnos')) data.diagnoses.push(item.content);
    else if (cat.includes('medication')) data.medications.push(item.content);
    else if (cat.includes('vital')) data.vitalSigns.push(item.content);
    else if (cat.includes('follow')) data.followUpActions.push(item.content);
  }

  return data;
}

function parsePatientDetails(patientInfo: string[]): { name: string; age: string; gender: string } {
  let name = '';
  let age = '';
  let gender = '';

  for (const info of patientInfo) {
    const lower = info.toLowerCase();
    // Check for age patterns
    const ageMatch = info.match(/(\d+)\s*(?:y(?:ears?)?|yr|yrs)\s*(?:old)?/i);
    if (ageMatch) {
      age = ageMatch[1] + ' years';
      continue;
    }
    // Check for gender
    if (/\b(male|female|m|f|man|woman|boy|girl)\b/i.test(lower)) {
      const gMatch = lower.match(/\b(male|female|man|woman|boy|girl)\b/i);
      if (gMatch) {
        gender = gMatch[1].charAt(0).toUpperCase() + gMatch[1].slice(1);
      }
      // If the info has more than just the gender, it might also contain name
      const remaining = info.replace(/\b(male|female|man|woman|boy|girl)\b/i, '').trim();
      if (remaining && !name) name = remaining;
      continue;
    }
    // Check for standalone age number
    if (/^\d+$/.test(info.trim())) {
      age = info.trim() + ' years';
      continue;
    }
    // Otherwise it's likely a name
    if (!name) name = info;
  }

  return { name: name || 'N/A', age: age || 'N/A', gender: gender || 'N/A' };
}

// Color definitions for the PDF
const COLORS = {
  primary: [26, 54, 93] as [number, number, number],       // Deep navy blue
  accent: [178, 34, 34] as [number, number, number],        // Dark red for Rx
  headerBg: [26, 54, 93] as [number, number, number],       // Navy header bg
  headerText: [255, 255, 255] as [number, number, number],  // White header text
  lightBg: [245, 247, 250] as [number, number, number],     // Light grey section bg
  sectionHead: [26, 54, 93] as [number, number, number],    // Section heading color
  bodyText: [33, 37, 41] as [number, number, number],       // Dark body text
  mutedText: [108, 117, 125] as [number, number, number],   // Muted gray
  borderLine: [200, 206, 212] as [number, number, number],  // Border color
  white: [255, 255, 255] as [number, number, number],
  rxRed: [178, 34, 34] as [number, number, number],
  greenAccent: [39, 174, 96] as [number, number, number],
};

function drawLine(doc: jsPDF, x1: number, y: number, x2: number, color: [number, number, number] = COLORS.borderLine, width = 0.3) {
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.line(x1, y, x2, y);
}

export function generatePrescriptionPdf(
  domain: DomainProfile,
  vaultSession: VaultSession,
  content: SessionContent,
  caseItem?: VaultCase,
): void {
  // Only generate for medical domain
  if (domain.id !== 'medical') return;

  const data = extractPrescriptionData(content.intelligence);
  const patient = parsePatientDetails(data.patientInfo);
  const sessionDate = new Date(vaultSession.createdAt);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 0;

  // ============================================================
  // HEADER BAND
  // ============================================================
  const headerHeight = 38;
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Hospital Name — large, centered
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.white);
  doc.text(HOSPITAL_FULL, pageWidth / 2, 12, { align: 'center' });

  // Tagline
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(200, 210, 230);
  doc.text(`"${HOSPITAL_TAGLINE}"`, pageWidth / 2, 19, { align: 'center' });

  // Address & Contact
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 210);
  doc.text(HOSPITAL_ADDRESS, pageWidth / 2, 26, { align: 'center' });
  doc.text(HOSPITAL_CONTACT, pageWidth / 2, 31, { align: 'center' });

  // Decorative gold lines under header
  doc.setDrawColor(212, 168, 67);
  doc.setLineWidth(0.8);
  doc.line(marginLeft, headerHeight + 1, pageWidth - marginRight, headerHeight + 1);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, headerHeight + 3, pageWidth - marginRight, headerHeight + 3);

  y = headerHeight + 8;

  // ============================================================
  // PRESCRIPTION TITLE
  // ============================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primary);
  doc.text('PATIENT PRESCRIPTION', pageWidth / 2, y, { align: 'center' });
  y += 3;

  drawLine(doc, marginLeft + 40, y, pageWidth - marginRight - 40, COLORS.primary, 0.5);
  y += 6;

  // ============================================================
  // PATIENT DETAILS BOX
  // ============================================================
  const patientBoxHeight = 30;
  // Light background
  doc.setFillColor(...COLORS.lightBg);
  doc.roundedRect(marginLeft, y, contentWidth, patientBoxHeight, 2, 2, 'F');
  // Border
  doc.setDrawColor(...COLORS.borderLine);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginLeft, y, contentWidth, patientBoxHeight, 2, 2, 'S');

  const boxInner = marginLeft + 5;
  const boxY = y + 6;
  const col2X = marginLeft + contentWidth / 2 + 5;

  // Patient Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mutedText);
  doc.text('PATIENT NAME', boxInner, boxY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.bodyText);
  doc.text(patient.name, boxInner, boxY + 5.5);

  // Age
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mutedText);
  doc.text('AGE', col2X, boxY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.bodyText);
  doc.text(patient.age, col2X, boxY + 5.5);

  // Gender
  const col3X = col2X + 35;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mutedText);
  doc.text('GENDER', col3X, boxY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.bodyText);
  doc.text(patient.gender, col3X, boxY + 5.5);

  // Date / Time
  const dateStr = sessionDate.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const timeStr = sessionDate.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mutedText);
  doc.text('DATE', boxInner, boxY + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.bodyText);
  doc.text(dateStr, boxInner, boxY + 18.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mutedText);
  doc.text('REVIEW TIME', col2X, boxY + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.bodyText);
  doc.text(timeStr, col2X, boxY + 18.5);

  // Case Number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mutedText);
  doc.text('CASE NO.', col3X, boxY + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.bodyText);
  doc.text(caseItem?.shortId || vaultSession.caseNumber, col3X, boxY + 18.5);

  y += patientBoxHeight + 6;

  // ============================================================
  // VITAL SIGNS
  // ============================================================
  if (data.vitalSigns.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.sectionHead);
    doc.text('VITAL SIGNS', marginLeft, y + 1);
    drawLine(doc, marginLeft, y + 3, pageWidth - marginRight, COLORS.primary, 0.3);
    y += 7;

    const vitalBoxWidth = Math.min(38, contentWidth / data.vitalSigns.length - 2);
    let vx = marginLeft;
    for (const vital of data.vitalSigns) {
      // Small box per vital
      doc.setFillColor(240, 245, 255);
      doc.roundedRect(vx, y, vitalBoxWidth, 14, 1.5, 1.5, 'F');
      doc.setDrawColor(180, 195, 220);
      doc.setLineWidth(0.2);
      doc.roundedRect(vx, y, vitalBoxWidth, 14, 1.5, 1.5, 'S');

      // Parse label and value (e.g., "BP 140/72")
      const parts = vital.match(/^([A-Za-z\s]+[A-Za-z])\s*[:\-]?\s*(.+)$/);
      if (parts) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.mutedText);
        doc.text(parts[1].trim().toUpperCase(), vx + vitalBoxWidth / 2, y + 5, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.primary);
        doc.text(parts[2].trim(), vx + vitalBoxWidth / 2, y + 11, { align: 'center' });
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.primary);
        doc.text(vital, vx + vitalBoxWidth / 2, y + 9, { align: 'center' });
      }

      vx += vitalBoxWidth + 3;
      if (vx + vitalBoxWidth > pageWidth - marginRight) {
        vx = marginLeft;
        y += 17;
      }
    }
    y += 19;
  }

  // ============================================================
  // SYMPTOMS / CHIEF COMPLAINTS
  // ============================================================
  if (data.symptoms.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.sectionHead);
    doc.text('CHIEF COMPLAINTS / SYMPTOMS', marginLeft, y + 1);
    drawLine(doc, marginLeft, y + 3, pageWidth - marginRight, COLORS.primary, 0.3);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.bodyText);
    for (const symptom of data.symptoms) {
      doc.text(`\u2022  ${symptom}`, marginLeft + 3, y);
      y += 5.5;
      if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    }
    y += 3;
  }

  // ============================================================
  // DIAGNOSES
  // ============================================================
  if (data.diagnoses.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.sectionHead);
    doc.text('DIAGNOSIS', marginLeft, y + 1);
    drawLine(doc, marginLeft, y + 3, pageWidth - marginRight, COLORS.primary, 0.3);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.bodyText);
    for (const diag of data.diagnoses) {
      doc.text(`\u2022  ${diag}`, marginLeft + 3, y);
      y += 5.5;
      if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    }
    y += 3;
  }

  // ============================================================
  // Rx — MEDICATIONS (The Heart of a Prescription)
  // ============================================================
  // Large Rx symbol
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.rxRed);
  doc.text('Rx', marginLeft, y + 5);

  // Section heading next to Rx
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.sectionHead);
  doc.text('MEDICATIONS PRESCRIBED', marginLeft + 14, y + 1);
  drawLine(doc, marginLeft, y + 3, pageWidth - marginRight, COLORS.rxRed, 0.4);
  y += 9;

  if (data.medications.length > 0) {
    // Medication table header
    const medTableX = marginLeft;
    const medNumWidth = 10;
    const medNameWidth = contentWidth - medNumWidth;

    doc.setFillColor(245, 240, 240);
    doc.rect(medTableX, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.mutedText);
    doc.text('#', medTableX + 3, y + 5);
    doc.text('MEDICATION / DOSAGE', medTableX + medNumWidth + 2, y + 5);
    y += 9;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.bodyText);

    for (let i = 0; i < data.medications.length; i++) {
      // Alternate row shading
      if (i % 2 === 0) {
        doc.setFillColor(252, 252, 254);
        doc.rect(medTableX, y - 3.5, contentWidth, 7, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.primary);
      doc.text(`${i + 1}.`, medTableX + 3, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.bodyText);
      doc.text(data.medications[i], medTableX + medNumWidth + 2, y);
      y += 7;
      if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    }
    y += 2;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.mutedText);
    doc.text('No medications recorded in this session.', marginLeft + 3, y);
    y += 8;
  }

  y += 2;

  // ============================================================
  // FOLLOW-UP / ADVICE
  // ============================================================
  if (data.followUpActions.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.sectionHead);
    doc.text('FOLLOW-UP / ADVICE', marginLeft, y + 1);
    drawLine(doc, marginLeft, y + 3, pageWidth - marginRight, COLORS.primary, 0.3);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.bodyText);
    for (const action of data.followUpActions) {
      doc.text(`\u2022  ${action}`, marginLeft + 3, y);
      y += 5.5;
      if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    }
    y += 3;
  }

  // ============================================================
  // SIGNATURE SECTION
  // ============================================================
  // Ensure we have space at the bottom
  if (y > pageHeight - 55) {
    doc.addPage();
    y = 20;
  }

  const sigY = Math.max(y + 10, pageHeight - 50);

  drawLine(doc, marginLeft, sigY, pageWidth - marginRight, COLORS.borderLine, 0.3);

  // Left side — hospital stamp area
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mutedText);
  doc.text('Hospital Stamp', marginLeft, sigY + 8);
  doc.setDrawColor(...COLORS.borderLine);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1], 0);
  doc.roundedRect(marginLeft, sigY + 10, 45, 20, 1, 1, 'S');
  doc.setLineDashPattern([], 0);

  // Center — generated notice
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.mutedText);
  doc.text('Auto-generated by ShadowNotes AI', pageWidth / 2, sigY + 15, { align: 'center' });
  doc.text(`Session: ${vaultSession.caseNumber}`, pageWidth / 2, sigY + 19, { align: 'center' });

  // Right side — Doctor's signature area
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mutedText);
  doc.text("Doctor's Signature", pageWidth - marginRight - 40, sigY + 8);
  drawLine(doc, pageWidth - marginRight - 50, sigY + 22, pageWidth - marginRight, COLORS.bodyText, 0.3);

  // ============================================================
  // FOOTER
  // ============================================================
  const footerY = pageHeight - 8;
  drawLine(doc, marginLeft, footerY - 4, pageWidth - marginRight, [212, 168, 67], 0.3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.mutedText);
  doc.text(
    `${HOSPITAL_NAME} | ${HOSPITAL_TAGLINE} | This is a computer-generated prescription.`,
    pageWidth / 2, footerY,
    { align: 'center' }
  );

  // ============================================================
  // SAVE & DOWNLOAD
  // ============================================================
  const patientName = patient.name !== 'N/A' ? patient.name.replace(/\s+/g, '_') : 'patient';
  const dateFileStr = sessionDate.toISOString().slice(0, 10);
  const fileName = `Prescription_${patientName}_${dateFileStr}_${HOSPITAL_NAME}.pdf`;

  doc.save(fileName);
}

/**
 * Check if prescription PDF generation is available for a given domain
 */
export function canGeneratePrescription(domainId: string): boolean {
  return domainId === 'medical';
}
