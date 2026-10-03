'use client';

import React from 'react';
import { useDiagramStore } from '@/stores/diagram.store';
import { useAuthStore } from '@/stores/auth.store';
import { MousePointer2 } from 'lucide-react';

export function RemoteCursorsOverlay() {
  const collaborators = useDiagramStore((s) => s.collaborators);
  const currentUser = useAuthStore((s) => s.user);

  // Filter out self
  const remoteUsers = collaborators.filter(
    (c) => c.userId !== currentUser?.id && c.cursor !== null,
  );

  if (remoteUsers.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {remoteUsers.map((user) => {
        if (!user.cursor) return null;

        return (
          <div
            key={user.userId}
            className="absolute transition-all duration-75 ease-out flex items-center gap-1.5"
            style={{
              transform: `translate(${user.cursor.x}px, ${user.cursor.y}px)`,
            }}
          >
            <MousePointer2
              className="w-4 h-4 fill-current drop-shadow-md"
              style={{ color: user.color }}
            />
            <div
              className="text-[10px] font-medium px-1.5 py-0.5 rounded shadow text-white whitespace-nowrap"
              style={{ backgroundColor: user.color }}
            >
              {user.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
