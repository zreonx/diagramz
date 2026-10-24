export interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl?: string;
  color: string;
  cursor: {
    x: number;
    y: number;
  } | null;
  selectedElementIds: string[];
}

export interface CollabJoinPayload {
  diagramId: string;
  token?: string;
}

export interface CollabSyncPayload {
  diagramId: string;
  update: string; // Base64-encoded Uint8Array for HTTP/JSON fallback, or binary directly
}

export interface CollabPresencePayload {
  diagramId: string;
  user: PresenceUser;
}

export const COLLAB_SOCKET_EVENTS = {
  JOIN: 'diagram:join',
  LEAVE: 'diagram:leave',
  YJS_SYNC: 'yjs:sync',
  YJS_UPDATE: 'yjs:update',
  PRESENCE_UPDATE: 'presence:update',
  USER_JOINED: 'user:joined',
  USER_LEFT: 'user:left',
  ROOM_USERS: 'room:users',
  DIAGRAM_CHANGE: 'diagram:change',
  ERROR: 'diagram:error',
} as const;

export type CollabSocketEvent = (typeof COLLAB_SOCKET_EVENTS)[keyof typeof COLLAB_SOCKET_EVENTS];
