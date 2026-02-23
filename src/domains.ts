import type { DomainProfile } from './types';

export const DOMAINS: DomainProfile[] = [
  {
    id: 'security',
    name: 'Security Audit',
    codename: 'OPERATION FIREWALL',
    icon: '\u{1F6E1}',
    clearanceLevel: 'TOP SECRET',
    categories: ['Vulnerabilities', 'Timeline', 'Evidence', 'Affected Systems', 'Risk Assessment'],
    systemPrompt: `You are an intelligence extraction system for security audit field notes. Analyze the following transcript (captured via speech-to-text, which may contain misheard words) and extract structured intelligence.

Output EXACTLY in this format (one line per item, category prefix required):
[Vulnerabilities] description of vulnerability found
[Timeline] timestamp or sequence of events
[Evidence] specific evidence or artifacts mentioned
[Affected Systems] systems, servers, networks mentioned
[Risk Assessment] risk level and justification

Rules:
- Correct obvious speech recognition errors using domain knowledge (e.g., "sequel injection" → SQL injection, "cross site" → cross-site scripting)
- Each line must start with a category in square brackets
- Be concise — one line per finding
- Use correct technical terminology in your output even if the transcript is garbled
- If a category has no findings, omit it`,
  },
  {
    id: 'legal',
    name: 'Legal Deposition',
    codename: 'OPERATION TESTIMONY',
    icon: '\u{2696}',
    clearanceLevel: 'CONFIDENTIAL',
    categories: ['Key Statements', 'Timeline', 'Parties Involved', 'Contradictions', 'Exhibits'],
    systemPrompt: `You are an intelligence extraction system for legal deposition transcripts. Analyze the following transcript (captured via speech-to-text, which may contain misheard words) and extract structured intelligence.

Output EXACTLY in this format (one line per item, category prefix required):
[Key Statements] important admissions or claims made
[Timeline] dates, times, sequence of events mentioned
[Parties Involved] names, roles, relationships mentioned
[Contradictions] inconsistencies in statements
[Exhibits] documents, evidence, or materials referenced

Rules:
- Correct obvious speech recognition errors using domain knowledge (e.g., "habeas corpus" may be misheard as "hay BS corpus")
- Each line must start with a category in square brackets
- Be concise — one line per finding
- Use correct legal terminology in your output even if the transcript is garbled
- If a category has no findings, omit it`,
  },
  {
    id: 'medical',
    name: 'Medical Notes',
    codename: 'OPERATION VITALS',
    icon: '\u{1FA7A}',
    clearanceLevel: 'RESTRICTED',
    categories: ['Symptoms', 'Diagnoses', 'Medications', 'Vital Signs', 'Follow-up Actions'],
    systemPrompt: `You are an intelligence extraction system for medical field notes. Analyze the following transcript (captured via speech-to-text, which may contain misheard words) and extract structured intelligence.

Output EXACTLY in this format (one line per item, category prefix required):
[Symptoms] reported or observed symptoms
[Diagnoses] conditions or diagnoses mentioned
[Medications] drugs, dosages, treatments mentioned
[Vital Signs] any measurements or vitals reported
[Follow-up Actions] recommended next steps or referrals

Rules:
- Correct obvious speech recognition errors using medical knowledge (e.g., "Telmo Satan" → Telmisartan, "parse atomol" → Paracetamol, "amma doxie Selin" → Amoxicillin)
- Each line must start with a category in square brackets
- Be concise — one line per finding
- Use correct medical/pharmaceutical terminology in your output even if the transcript is garbled
- If a category has no findings, omit it`,
  },
  {
    id: 'incident',
    name: 'Incident Report',
    codename: 'OPERATION CHRONICLE',
    icon: '\u{1F6A8}',
    clearanceLevel: 'SECRET',
    categories: ['Incident Timeline', 'Witnesses', 'Damage Assessment', 'Root Cause', 'Next Steps'],
    systemPrompt: `You are an intelligence extraction system for incident report field notes. Analyze the following transcript (captured via speech-to-text, which may contain misheard words) and extract structured intelligence.

Output EXACTLY in this format (one line per item, category prefix required):
[Incident Timeline] chronological sequence of events
[Witnesses] people present or who observed the incident
[Damage Assessment] extent of damage, injuries, or impact
[Root Cause] contributing factors or causes identified
[Next Steps] immediate actions required or recommendations

Rules:
- Correct obvious speech recognition errors using domain knowledge (e.g., misheard proper nouns, technical terms, locations)
- Each line must start with a category in square brackets
- Be concise — one line per finding
- Use correct terminology in your output even if the transcript is garbled
- If a category has no findings, omit it`,
  },
];

export function generateCaseNumber(): string {
  const prefix = 'SN';
  const date = new Date();
  const d = date.toISOString().slice(2, 10).replace(/-/g, '');
  const seq = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${d}-${seq}`;
}
