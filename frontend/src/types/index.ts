export interface ConversationItem {
  id: string;
  role?: string;
  type?: string;
  status?: string;
  formatted: {
    text?: string;
    transcript?: string;
    audio?: { length?: number } | { data?: ArrayBuffer };
    file?: { url: string; };
  };
}

export interface Phrase {
  id: number;
  hindi: string;
  english: string;
  context: string;
  difficulty: number;
  mastery_level?: number;
}

export interface SessionState {
  isConnected: boolean;
  isRecording: boolean;
  sessionActive: boolean;
}
