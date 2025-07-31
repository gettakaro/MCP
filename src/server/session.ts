import { randomUUID } from 'crypto';

export interface SessionData {
  created: number;
  client?: any; // Will be typed properly with Takaro Client type later
  toolsCache?: any[]; // Will be typed with Tool[] later
}

export class SessionManager {
  private sessions = new Map<string, SessionData>();

  create(): string {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, { created: Date.now() });
    return sessionId;
  }

  get(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  update(sessionId: string, data: Partial<SessionData>): void {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      this.sessions.set(sessionId, { ...existing, ...data });
    }
  }

  getOrCreate(sessionId: string | undefined): { sessionId: string; isNew: boolean } {
    if (sessionId && this.has(sessionId)) {
      return { sessionId, isNew: false };
    }
    
    const newSessionId = this.create();
    return { sessionId: newSessionId, isNew: true };
  }
}