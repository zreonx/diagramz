import { Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { db } from '../../database/drizzle.client';
import { diagramCanvases, diagrams } from '../../database/schema';
import { eq } from 'drizzle-orm';

interface RoomState {
  doc: Y.Doc;
  updateCount: number;
  lastPersisted: number;
  persistTimeout?: NodeJS.Timeout;
}

@Injectable()
export class CollabService {
  private readonly logger = new Logger(CollabService.name);
  private rooms = new Map<string, RoomState>();

  async getOrCreateDoc(diagramId: string): Promise<Y.Doc> {
    let room = this.rooms.get(diagramId);
    if (!room) {
      const doc = new Y.Doc();
      room = {
        doc,
        updateCount: 0,
        lastPersisted: Date.now(),
      };
      this.rooms.set(diagramId, room);

      // Hydrate from DB if exists
      try {
        const record = await db.query.diagramCanvases.findFirst({
          where: eq(diagramCanvases.diagramId, diagramId),
        });

        if (record && record.canvasData) {
          const yElements = doc.getArray('elements');
          const data = record.canvasData as { elements?: any[] };
          if (Array.isArray(data.elements) && yElements.length === 0) {
            doc.transact(() => {
              yElements.push(data.elements || []);
            });
          }
        }
      } catch (err: any) {
        this.logger.error(`Error hydrating Y.Doc for diagram ${diagramId}: ${err.message}`);
      }
    }

    return room.doc;
  }

  handleUpdate(diagramId: string, update: Uint8Array): void {
    const room = this.rooms.get(diagramId);
    if (!room) return;

    try {
      Y.applyUpdate(room.doc, update);
      room.updateCount += 1;

      // Persist if 50 updates reached
      if (room.updateCount >= 50) {
        this.flushRoomToDatabase(diagramId);
      } else {
        // Debounce 30 seconds inactivity persistence
        if (room.persistTimeout) clearTimeout(room.persistTimeout);
        room.persistTimeout = setTimeout(() => {
          this.flushRoomToDatabase(diagramId);
        }, 30000);
      }
    } catch (err: any) {
      this.logger.error(`Failed to apply Yjs update for diagram ${diagramId}: ${err.message}`);
    }
  }

  async flushRoomToDatabase(diagramId: string): Promise<void> {
    const room = this.rooms.get(diagramId);
    if (!room) return;

    room.updateCount = 0;
    room.lastPersisted = Date.now();
    if (room.persistTimeout) {
      clearTimeout(room.persistTimeout);
      room.persistTimeout = undefined;
    }

    try {
      const yElements = room.doc.getArray('elements');
      const elementsJson = yElements.toJSON();

      await db
        .insert(diagramCanvases)
        .values({
          diagramId,
          canvasData: { elements: elementsJson },
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: diagramCanvases.diagramId,
          set: {
            canvasData: { elements: elementsJson },
            updatedAt: new Date(),
          },
        });

      await db
        .update(diagrams)
        .set({ updatedAt: new Date() })
        .where(eq(diagrams.id, diagramId));

      this.logger.log(`Snapshot persisted for diagram ${diagramId}`);
    } catch (err: any) {
      this.logger.error(`Failed to flush canvas to DB for diagram ${diagramId}: ${err.message}`);
    }
  }

  getDocStateUpdate(doc: Y.Doc): Uint8Array {
    return Y.encodeStateAsUpdate(doc);
  }
}
