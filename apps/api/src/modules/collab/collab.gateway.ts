import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CollabService } from './collab.service';
import { COLLAB_SOCKET_EVENTS, PresenceUser } from '@diagramz/shared';

interface SocketData {
  userId?: string;
  diagramId?: string;
  user?: PresenceUser;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  maxHttpBufferSize: 1e7, // 10MB
})
export class CollabGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CollabGateway.name);

  constructor(
    private collabService: CollabService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const data = (client.data || {}) as SocketData;
    if (data.diagramId && data.user) {
      client.to(`diagram:${data.diagramId}`).emit(COLLAB_SOCKET_EVENTS.USER_LEFT, {
        userId: data.user.userId,
      });
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(COLLAB_SOCKET_EVENTS.JOIN)
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { diagramId: string; token?: string; user?: Partial<PresenceUser> },
  ) {
    try {
      const { diagramId, token, user } = payload;
      let userId = 'anonymous';
      let userName = user?.name || 'Guest';

      if (token) {
        try {
          const secret =
            this.configService.get<string>('JWT_ACCESS_SECRET') ||
            'diagramz-super-secret-jwt-key-minimum-64-characters-for-safety-and-compliance';
          const decoded = this.jwtService.verify(token, { secret });
          userId = decoded.sub;
          userName = decoded.name || userName;
        } catch {
          // Token invalid, allow guest viewing or fallback
        }
      }

      const roomName = `diagram:${diagramId}`;
      await client.join(roomName);

      const presenceUser: PresenceUser = {
        userId,
        name: userName,
        avatarUrl: user?.avatarUrl,
        color:
          user?.color ||
          `#${Math.floor(Math.random() * 16777215)
            .toString(16)
            .padStart(6, '0')}`,
        cursor: null,
        selectedElementIds: [],
      };

      client.data = {
        userId,
        diagramId,
        user: presenceUser,
      };

      // Fetch or init server-side Y.Doc
      const doc = await this.collabService.getOrCreateDoc(diagramId);
      const stateUpdate = this.collabService.getDocStateUpdate(doc);

      // Emit initial sync to client
      client.emit(COLLAB_SOCKET_EVENTS.YJS_SYNC, stateUpdate);

      // Compile current active collaborators in room and send to the joining user
      const sockets = await this.server.in(roomName).fetchSockets();
      const existingUsers: PresenceUser[] = [];
      for (const s of sockets) {
        const u = (s.data as SocketData)?.user;
        if (u && u.userId !== presenceUser.userId) {
          existingUsers.push(u);
        }
      }
      client.emit(COLLAB_SOCKET_EVENTS.ROOM_USERS, existingUsers);

      // Notify others in room
      client.to(roomName).emit(COLLAB_SOCKET_EVENTS.USER_JOINED, presenceUser);

      return { status: 'joined', diagramId, users: existingUsers };
    } catch (err: any) {
      this.logger.error(`Error in handleJoin: ${err.message}`);
      client.emit(COLLAB_SOCKET_EVENTS.ERROR, { message: 'Failed to join diagram session' });
    }
  }

  @SubscribeMessage(COLLAB_SOCKET_EVENTS.LEAVE)
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { diagramId: string },
  ) {
    const roomName = `diagram:${payload.diagramId}`;
    await client.leave(roomName);
    const data = (client.data || {}) as SocketData;
    if (data.user) {
      client.to(roomName).emit(COLLAB_SOCKET_EVENTS.USER_LEFT, { userId: data.user.userId });
    }
  }

  @SubscribeMessage(COLLAB_SOCKET_EVENTS.DIAGRAM_CHANGE)
  handleDiagramChange(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      diagramId: string;
      canvasData: any;
      sourceUserId?: string;
    },
  ) {
    const roomName = `diagram:${payload.diagramId}`;
    // Broadcast diagram canvas changes to all other peers in the diagram room
    client.to(roomName).emit(COLLAB_SOCKET_EVENTS.DIAGRAM_CHANGE, payload);
  }

  @SubscribeMessage(COLLAB_SOCKET_EVENTS.YJS_UPDATE)
  handleYjsUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { diagramId: string; update: Buffer | Uint8Array | number[] },
  ) {
    const { diagramId, update } = payload;
    const roomName = `diagram:${diagramId}`;

    const updateBuffer = Buffer.isBuffer(update)
      ? new Uint8Array(update)
      : Array.isArray(update)
      ? new Uint8Array(update)
      : update;

    // Apply update to server doc
    this.collabService.handleUpdate(diagramId, updateBuffer);

    // Broadcast binary update to everyone else in the room
    client.to(roomName).emit(COLLAB_SOCKET_EVENTS.YJS_UPDATE, updateBuffer);
  }

  @SubscribeMessage(COLLAB_SOCKET_EVENTS.PRESENCE_UPDATE)
  handlePresenceUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      diagramId: string;
      cursor: { x: number; y: number } | null;
      selectedElementIds?: string[];
    },
  ) {
    const data = (client.data || {}) as SocketData;
    if (!data.user) return;

    data.user.cursor = payload.cursor;
    data.user.selectedElementIds = payload.selectedElementIds || [];

    const roomName = `diagram:${payload.diagramId}`;
    client.to(roomName).emit(COLLAB_SOCKET_EVENTS.PRESENCE_UPDATE, data.user);
  }
}
