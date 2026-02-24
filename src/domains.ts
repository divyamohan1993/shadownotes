import type { DomainProfile } from './types';

export const DOMAINS: DomainProfile[] = [
  {
    id: 'security',
    name: 'Security Audit',
    codename: 'OPERATION FIREWALL',
    icon: '\u{1F6E1}',
    clearanceLevel: 'TOP SECRET',
    categories: ['Vulnerabilities', 'Timeline', 'Evidence', 'Affected Systems', 'Risk Assessment'],
    systemPrompt: `Extract security findings from this speech transcript. Fix speech errors. Output ONLY short facts, not sentences.

Format — one fact per line:
[Vulnerabilities] single vulnerability found
[Timeline] single timestamp or event
[Evidence] single artifact or evidence item
[Affected Systems] single system or network
[Risk Assessment] risk level with brief reason

Speech fixes: "sequel injection" → SQL injection, "cross site" → XSS, "ess ess eich" → SSH, "de-en-ess" → DNS.

Rules:
- Extract ONLY the key data, never repeat full sentences
- One finding per line, one category tag per line
- Fix all speech recognition errors using security knowledge
- Omit categories with no findings`,
  },
  {
    id: 'legal',
    name: 'Legal Deposition',
    codename: 'OPERATION TESTIMONY',
    icon: '\u{2696}',
    clearanceLevel: 'CONFIDENTIAL',
    categories: ['Key Statements', 'Timeline', 'Parties Involved', 'Contradictions', 'Exhibits'],
    systemPrompt: `Extract legal findings from this speech transcript. Fix speech errors. Output ONLY short facts, not sentences.

Format — one fact per line:
[Key Statements] single admission or claim
[Timeline] single date, time, or event
[Parties Involved] name and role
[Contradictions] single inconsistency
[Exhibits] single document or evidence

Speech fixes: "hay BS corpus" → habeas corpus, "nolo contend airy" → nolo contendere.

Rules:
- Extract ONLY the key data, never repeat full sentences
- One finding per line, one category tag per line
- Fix all speech recognition errors using legal knowledge
- Omit categories with no findings`,
  },
  {
    id: 'medical',
    name: 'Medical Notes',
    codename: 'OPERATION VITALS',
    icon: '\u{1FA7A}',
    clearanceLevel: 'RESTRICTED',
    categories: ['Patient Info', 'Symptoms', 'Diagnoses', 'Medications', 'Vital Signs', 'Follow-up Actions'],
    systemPrompt: `Extract medical data from this speech transcript. Fix speech errors. Output ONLY short facts, not sentences.

Format — one fact per line:
[Patient Info] name, age, or gender
[Symptoms] single symptom
[Diagnoses] single diagnosis
[Medications] drug name and dose
[Vital Signs] single measurement
[Follow-up Actions] single action

Speech fixes: "Tell me Satin" → Telmisartan, "parse atomol" → Paracetamol, "amma doxie Selin" → Amoxicillin, "SPO 2" → SpO2, "bee pee" → BP.

Example input: "Patient named Sara she had a BP of 140 by 72 and SPO 2 of 95 she has headache I gave parse atomol and Tell me Satin 80 mg"
Example output:
[Patient Info] Sara
[Symptoms] Headache
[Vital Signs] BP 140/72
[Vital Signs] SpO2 95
[Medications] Paracetamol
[Medications] Telmisartan 80mg

Rules:
- Extract ONLY the key data, never repeat full sentences
- One finding per line, one category tag per line
- Fix all speech recognition errors using medical knowledge
- Omit categories with no findings`,
  },
  {
    id: 'incident',
    name: 'Incident Report',
    codename: 'OPERATION CHRONICLE',
    icon: '\u{1F6A8}',
    clearanceLevel: 'SECRET',
    categories: ['Incident Timeline', 'Witnesses', 'Damage Assessment', 'Root Cause', 'Next Steps'],
    systemPrompt: `Extract incident details from this speech transcript. Fix speech errors. Output ONLY short facts, not sentences.

Format — one fact per line:
[Incident Timeline] single event with time
[Witnesses] single person name or role
[Damage Assessment] single damage item
[Root Cause] single contributing factor
[Next Steps] single action item

Rules:
- Extract ONLY the key data, never repeat full sentences
- One finding per line, one category tag per line
- Fix all speech recognition errors using domain knowledge
- Omit categories with no findings`,
  },
];

export function generateCaseNumber(): string {
  const prefix = 'SN';
  const date = new Date();
  const d = date.toISOString().slice(2, 10).replace(/-/g, '');
  const seq = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${d}-${seq}`;
}
