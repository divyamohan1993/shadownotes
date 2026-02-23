import type { DomainId, IntelligenceItem } from './types';

interface ExtractionRule {
  category: string;
  patterns: RegExp[];
}

const MEDICAL_RULES: ExtractionRule[] = [
  {
    category: 'Vital Signs',
    patterns: [
      /\d+\s*(?:\/|over)\s*\d+/i, /blood pressure/i, /heart rate/i, /\bbpm\b/i,
      /temperature/i, /oxygen/i, /SpO2/i, /pulse/i, /respiration/i, /\bbp\b/i,
    ],
  },
  {
    category: 'Symptoms',
    patterns: [
      /pain/i, /ache/i, /fever/i, /nausea/i, /dizz/i, /fatigue/i, /swelling/i,
      /bleeding/i, /cough/i, /shortness of breath/i, /chest/i, /headache/i,
      /vomit/i, /diarrhea/i, /weakness/i, /numb/i, /tingling/i, /rash/i,
      /breath/i, /wheez/i, /cramp/i, /stiff/i, /sore/i,
    ],
  },
  {
    category: 'Diagnoses',
    patterns: [
      /diabetes/i, /hypertension/i, /infection/i, /fracture/i, /failure/i,
      /disease/i, /syndrome/i, /disorder/i, /condition/i, /cancer/i,
      /asthma/i, /anemia/i, /arthritis/i, /pneumonia/i, /stroke/i,
      /diagnosis/i, /diagnosed/i, /stable/i, /chronic/i, /acute/i,
    ],
  },
  {
    category: 'Medications',
    patterns: [
      /\w+\s*\d+\s*mg/i, /\bdaily\b/i, /twice\s+(?:a\s+)?day/i, /tablet/i,
      /capsule/i, /\bdose\b/i, /\bdosage\b/i, /prescri/i, /medication/i,
      /\bdrug\b/i, /insulin/i, /antibiotic/i, /mg\b/i, /ml\b/i,
    ],
  },
  {
    category: 'Follow-up Actions',
    patterns: [
      /follow.?up/i, /refer/i, /schedule/i, /appointment/i, /return/i,
      /recheck/i, /monitor/i, /reassess/i, /lab\s*(?:work|test)/i,
      /imaging/i, /x-?ray/i, /mri/i, /ct\s*scan/i, /blood\s*(?:work|test)/i,
    ],
  },
];

const SECURITY_RULES: ExtractionRule[] = [
  {
    category: 'Vulnerabilities',
    patterns: [
      /vulnerab/i, /exploit/i, /CVE/i, /injection/i, /\bXSS\b/i, /overflow/i,
      /bypass/i, /weakness/i, /flaw/i, /exposed/i, /unpatched/i, /misconfigur/i,
      /open\s*port/i, /unsecured/i, /plaintext/i, /default\s*password/i,
    ],
  },
  {
    category: 'Timeline',
    patterns: [
      /\d{1,2}:\d{2}/i, /\bAM\b/i, /\bPM\b/i, /yesterday/i, /today/i,
      /\d{1,2}\/\d{1,2}/i, /hours?\s*ago/i, /minutes?\s*ago/i,
      /detected\s*at/i, /occurred/i, /discovered/i, /noticed/i,
    ],
  },
  {
    category: 'Evidence',
    patterns: [
      /\blog\b/i, /artifact/i, /screenshot/i, /packet/i, /capture/i,
      /evidence/i, /trace/i, /record/i, /dump/i, /sample/i, /forensic/i,
    ],
  },
  {
    category: 'Affected Systems',
    patterns: [
      /server/i, /database/i, /network/i, /firewall/i, /endpoint/i,
      /\bIP\b/i, /router/i, /switch/i, /domain/i, /workstation/i,
      /cloud/i, /\bAPI\b/i, /service/i, /container/i, /cluster/i,
    ],
  },
  {
    category: 'Risk Assessment',
    patterns: [
      /critical/i, /\bhigh\b/i, /\bmedium\b/i, /\blow\b/i, /severe/i,
      /risk/i, /impact/i, /threat/i, /priority/i, /urgent/i,
    ],
  },
];

const LEGAL_RULES: ExtractionRule[] = [
  {
    category: 'Key Statements',
    patterns: [
      /stated/i, /claimed/i, /admitted/i, /testified/i, /denied/i,
      /confirmed/i, /alleged/i, /swore/i, /declared/i, /asserted/i,
      /acknowledged/i, /recalled/i, /testified/i,
    ],
  },
  {
    category: 'Timeline',
    patterns: [
      /\d{1,2}:\d{2}/i, /\d{1,2}\/\d{1,2}/i, /on\s+or\s+about/i,
      /approximately/i, /prior\s+to/i, /subsequent/i, /following/i,
      /before/i, /after/i, /during/i, /at\s+the\s+time/i,
    ],
  },
  {
    category: 'Parties Involved',
    patterns: [
      /\bMr\.?\b/i, /\bMs\.?\b/i, /\bDr\.?\b/i, /plaintiff/i, /defendant/i,
      /witness/i, /attorney/i, /counsel/i, /client/i, /\bparty\b/i,
      /company/i, /organization/i, /employee/i, /manager/i,
    ],
  },
  {
    category: 'Contradictions',
    patterns: [
      /however/i, /\bbut\b/i, /previously\s+said/i, /inconsisten/i,
      /contradict/i, /contrary/i, /differs/i, /changed/i, /revised/i,
    ],
  },
  {
    category: 'Exhibits',
    patterns: [
      /exhibit/i, /document/i, /email/i, /contract/i, /record/i,
      /agreement/i, /memorandum/i, /correspondence/i, /report/i, /filing/i,
    ],
  },
];

const INCIDENT_RULES: ExtractionRule[] = [
  {
    category: 'Incident Timeline',
    patterns: [
      /\d{1,2}:\d{2}/i, /\bAM\b/i, /\bPM\b/i, /first\s+noticed/i,
      /reported\s+at/i, /occurred/i, /began/i, /started/i, /ended/i,
      /responded/i, /arrived/i, /discovered/i,
    ],
  },
  {
    category: 'Witnesses',
    patterns: [
      /\bsaw\b/i, /observed/i, /reported/i, /witness/i, /bystander/i,
      /\bpresent\b/i, /\bnoticed\b/i, /testified/i, /stated/i,
    ],
  },
  {
    category: 'Damage Assessment',
    patterns: [
      /damaged/i, /destroyed/i, /injured/i, /impact/i, /\bloss\b/i,
      /broken/i, /collapsed/i, /flooded/i, /casualt/i, /extent/i,
      /cost/i, /repair/i, /replace/i, /totaled/i,
    ],
  },
  {
    category: 'Root Cause',
    patterns: [
      /caused\s+by/i, /due\s+to/i, /result\s+of/i, /contributing/i,
      /factor/i, /failure/i, /malfunction/i, /error/i, /negligence/i,
      /because/i, /reason/i, /led\s+to/i, /triggered/i,
    ],
  },
  {
    category: 'Next Steps',
    patterns: [
      /recommend/i, /should/i, /must/i, /immediate/i, /action/i,
      /plan/i, /prevent/i, /mitigat/i, /investigat/i, /review/i,
      /follow.?up/i, /repair/i, /restore/i,
    ],
  },
];

const DOMAIN_RULES: Record<DomainId, ExtractionRule[]> = {
  medical: MEDICAL_RULES,
  security: SECURITY_RULES,
  legal: LEGAL_RULES,
  incident: INCIDENT_RULES,
};

/**
 * Extract intelligence items from transcript text using keyword matching.
 * Zero memory overhead — pure regex, runs on any device.
 */
export function extractIntelligence(text: string, domainId: DomainId): IntelligenceItem[] {
  const rules = DOMAIN_RULES[domainId];
  if (!rules) return [];

  // Split into sentences (by period, question mark, exclamation, or semicolon)
  const sentences = text
    .split(/[.!?;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const items: IntelligenceItem[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    for (const rule of rules) {
      if (rule.patterns.some((p) => p.test(sentence))) {
        // Avoid duplicate content
        const key = `${rule.category}:${sentence.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            category: rule.category,
            content: sentence,
            timestamp,
          });
        }
        break; // Each sentence goes to first matching category
      }
    }
  }

  return items;
}
