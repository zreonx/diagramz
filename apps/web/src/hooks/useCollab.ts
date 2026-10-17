'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { getAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useDiagramStore } from '@/stores/diagram.store';
import { COLLAB_SOCKET_EVENTS, PresenceUser } from '@diagramz/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

export function useCollab(diagramId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const user = useAuthStore((s) => s.user);
  const setCollaborators = useDiagramStore((s) => s.setCollaborators);
  const collaborators = useDiagramStore((s) => s.collaborators);

  const sendYjsUpdate = useCallback(
    (update: Uint8Array) => {
      if (socketRef.current?.connected && diagramId) {
        socketRef.current.emit(COLLAB_SOCKET_EVENTS.YJS_UPDATE, {
          diagramId,
          update: Array.from(update),
        });
      }
    },
    [diagramId],
  );

  const sendCursorPosition = useCallback(
    (cursor: { x: number; y: number } | null, selectedElementIds: string[] = []) => {
      if (socketRef.current?.connected && diagramId) {
        socketRef.current.emit(COLLAB_SOCKET_EVENTS.PRESENCE_UPDATE, {
          diagramId,
          cursor,
          selectedElementIds,
        });
      }
    },
    [diagramId],
  );

  useEffect(() => {
    if (!diagramId) return;

    const token = getAccessToken();
    const socket = io(WS_URL, {
      transports: ['websocket'],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit(COLLAB_SOCKET_EVENTS.JOIN, {
        diagramId,
        token,
        user: {
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

    socket.on(COLLAB_SOCKET_EVENTS.USER_JOINED, (newUser: PresenceUser) => {
      setCollaborators([
        ...collaborators.filter((c) => c.userId !== newUser.userId),
        newUser,
      ]);
    });

    socket.on(COLLAB_SOCKET_EVENTS.USER_LEFT, ({ userId }: { userId: string }) => {
      setCollaborators(collaborators.filter((c) => c.userId !== userId));
    });

    socket.on(COLLAB_SOCKET_EVENTS.PRESENCE_UPDATE, (presenceUser: PresenceUser) => {
      setCollaborators([
        ...collaborators.filter((c) => c.userId !== presenceUser.userId),
        presenceUser,
      ]);
    });

    return () => {
      socket.emit(COLLAB_SOCKET_EVENTS.LEAVE, { diagramId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [diagramId, user?.name, user?.avatarUrl]);

  return {
    ydoc: ydocRef.current,
    sendYjsUpdate,
    sendCursorPosition,
  };
}
