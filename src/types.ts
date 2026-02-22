export type DomainId = 'security' | 'legal' | 'medical' | 'incident';

export interface DomainProfile {
  id: DomainId;
  name: string;
  codename: string;
  icon: string;
  clearanceLevel: string;
  categories: string[];
  systemPrompt: string;
}

export interface IntelligenceItem {
  category: string;
  content: string;
  timestamp: string;
}

export interface TranscriptEntry {
  text: string;
  timestamp: string;
}

export interface SessionData {
  domain: DomainProfile;
  caseNumber: string;
  startTime: Date;
  transcripts: TranscriptEntry[];
  intelligence: IntelligenceItem[];
}

export type AppScreen = 'init' | 'capture' | 'summary';
