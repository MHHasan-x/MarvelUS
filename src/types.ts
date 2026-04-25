export interface User {
  id: string;
  username: string;
}

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
}

export type SyncAction = 'play' | 'pause' | 'seek' | 'url-change';

export interface SyncEvent {
  action: SyncAction;
  currentTime?: number;
  videoUrl?: string;
}
