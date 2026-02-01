
export interface FeedbackData {
  professional: string | null;
  nps: number | null;
  comment: string;
  timestamp: string; // ISO string
}

export enum AppStep {
  WELCOME,
  PROFESSIONAL,
  NPS,
  COMMENT,
  PROCESSING,
  SUCCESS,
  DASHBOARD
}
