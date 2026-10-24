'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { getAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useDiagramStore } from '@/stores/diagram.store';
import { COLLAB_SOCKET_EVENTS, PresenceUser } from '@diagramz/shared';

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/v1\/?$/, '')
    : 'http://localhost:4000');

export function useCollab(
  diagramId: string | null,
  options?: {
    onRemoteCanvasChange?: (canvasData: any) => void;
  }
) {
  const socketRef = useRef<Socket | null>(null);
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const user = useAuthStore((s) => s.user);
  const setCollaborators = useDiagramStore((s) => s.setCollaborators);
  const onRemoteCanvasChangeRef = useRef(options?.onRemoteCanvasChange);
  onRemoteCanvasChangeRef.current = options?.onRemoteCanvasChange;

  const sendYjsUpdate = useCallback(
    (update: Uint8Array) => {
      if (socketRef.current?.connected && diagramId) {
        socketRef.current.emit(COLLAB_SOCKET_EVENTS.YJS_UPDATE, {
          diagramId,
          update: Array.from(update),
        });
      }
    },
    [diagramId]
  );

  const lastCursorSendRef = useRef<number>(0);
  const sendCursorPosition = useCallback(
    (cursor: { x: number; y: number } | null, selectedElementIds: string[] = []) => {
      const now = Date.now();
      // Throttle cursor sends to max 25 events per second (40ms), but always send null (cursor left)
      if (cursor === null || now - lastCursorSendRef.current >= 40) {
        lastCursorSendRef.current = now;
        if (socketRef.current?.connected && diagramId) {
          socketRef.current.emit(COLLAB_SOCKET_EVENTS.PRESENCE_UPDATE, {
            diagramId,
            cursor,
            selectedElementIds,
          });
        }
      }
    },
    [diagramId]
  );

  const broadcastCanvasChange = useCallback(
    (canvasData: any) => {
      if (socketRef.current?.connected && diagramId) {
        socketRef.current.emit(COLLAB_SOCKET_EVENTS.DIAGRAM_CHANGE, {
          diagramId,
          canvasData,
          sourceUserId: user?.id,
        });
      }
    },
    [diagramId, user?.id]
  );

  useEffect(() => {
    if (!diagramId) return;

    // On HTTPS origins, avoid connecting to insecure http:// socket to prevent browser mixed-content console errors
    const isHttpsOrigin = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isExplicitSecureWs = process.env.NEXT_PUBLIC_WS_URL?.startsWith('wss://');
    if (isHttpsOrigin && !isExplicitSecureWs && WS_URL.startsWith('http://')) {
      return;
    }

    const token = getAccessToken();
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit(COLLAB_SOCKET_EVENTS.JOIN, {
        diagramId,
        token,
        user: {
          userId: user?.id,
          name: user?.name || 'Anonymous',
          avatarUrl: user?.avatarUrl,
        },
      });
    });

    socket.on(COLLAB_SOCKET_EVENTS.YJS_SYNC, (stateUpdate: ArrayBuffer | number[]) => {
      try {
        const updateArray =
          stateUpdate instanceof ArrayBuffer
            ? new Uint8Array(stateUpdate)
            : new Uint8Array(stateUpdate);
        Y.applyUpdate(ydocRef.current, updateArray);
      } catch (e) {
        console.error('Failed to apply Yjs sync:', e);
      }
    });

    socket.on(COLLAB_SOCKET_EVENTS.YJS_UPDATE, (update: ArrayBuffer | number[]) => {
      try {
        const updateArray =
          update instanceof ArrayBuffer
            ? new Uint8Array(update)
            : new Uint8Array(update);
        Y.applyUpdate(ydocRef.current, updateArray);
      } catch (e) {
        console.error('Failed to apply remote Yjs update:', e);
      }
    });

    // Receive initial active collaborators in room upon joining
    socket.on(COLLAB_SOCKET_EVENTS.ROOM_USERS, (users: PresenceUser[]) => {
      setCollaborators(users);
    });

    socket.on(COLLAB_SOCKET_EVENTS.USER_JOINED, (newUser: PresenceUser) => {
      const current = useDiagramStore.getState().collaborators;
      setCollaborators([
        ...current.filter((c) => c.userId !== newUser.userId),
        newUser,
      ]);
    });

    socket.on(COLLAB_SOCKET_EVENTS.USER_LEFT, ({ userId }: { userId: string }) => {
      const current = useDiagramStore.getState().collaborators;
      setCollaborators(current.filter((c) => c.userId !== userId));
    });

    socket.on(COLLAB_SOCKET_EVENTS.PRESENCE_UPDATE, (presenceUser: PresenceUser) => {
      const current = useDiagramStore.getState().collaborators;
      setCollaborators([
        ...current.filter((c) => c.userId !== presenceUser.userId),
        presenceUser,
      ]);
    });

    // Real-time peer diagram canvas changes
    socket.on(
      COLLAB_SOCKET_EVENTS.DIAGRAM_CHANGE,
      (payload: { diagramId: string; canvasData: any; sourceUserId?: string }) => {
        if (payload.sourceUserId && payload.sourceUserId === user?.id) return;
        if (onRemoteCanvasChangeRef.current) {
          onRemoteCanvasChangeRef.current(payload.canvasData);
        }
      }
    );

    return () => {
      socket.emit(COLLAB_SOCKET_EVENTS.LEAVE, { diagramId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [diagramId, user?.id, user?.name, user?.avatarUrl, setCollaborators]);

  return {
    ydoc: ydocRef.current,
    sendYjsUpdate,
    sendCursorPosition,
    broadcastCanvasChange,
    isConnected: socketRef.current?.connected ?? false,
  };
}
