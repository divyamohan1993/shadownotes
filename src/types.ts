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
  id: string;
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

export interface VaultCase {
  id: string;
  domainId: DomainId;
  name: string;
  shortId: string;
  createdAt: number;
  updatedAt: number;
}

export interface VaultSession {
  id: string;
  caseId: string;
  caseNumber: string;
  createdAt: number;
  duration: number;
  segmentCount: number;
  findingCount: number;
  sizeBytes: number;
  encrypted: ArrayBuffer;
}

export interface VaultMeta {
  key: string;
  value: string | number;
}

export interface SessionContent {
  transcripts: TranscriptEntry[];
  intelligence: IntelligenceItem[];
}

export type AppScreen = 'init' | 'unlock' | 'cases' | 'case-detail' | 'capture' | 'summary';
