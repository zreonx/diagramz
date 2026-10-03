import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../../database/drizzle.client';
import { users, refreshTokens, workspaces, workspaceMembers } from '../../database/schema';
import {
  RegisterDto,
  LoginDto,
  AuthResponse,
  AuthSessionUser,
  JwtTokenPayload,
} from '@diagramz/shared';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async register(dto: RegisterDto): Promise<{ response: AuthResponse; rawRefreshToken: string }> {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, dto.email.toLowerCase()),
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    // Create user and default workspace in transaction
    const result = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          email: dto.email.toLowerCase(),
          passwordHash,
          name: dto.name,
        })
        .returning();

      // Create a default personal workspace for the user
      const slugBase = dto.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'workspace';
      const slugSuffix = Math.random().toString(36).substring(2, 6);
      const slug = `${slugBase}-${slugSuffix}`;

      const [workspace] = await tx
        .insert(workspaces)
        .values({
          name: `${dto.name}'s Workspace`,
          slug,
          ownerId: newUser.id,
        })
        .returning();

      await tx.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId: newUser.id,
        role: 'owner',
      });

      return newUser;
    });

    const sessionUser: AuthSessionUser = {
      id: result.id,
      email: result.email,
      name: result.name,
      avatarUrl: result.avatarUrl,
    };

    return this.generateAuthResult(sessionUser);
  }

  async login(dto: LoginDto): Promise<{ response: AuthResponse; rawRefreshToken: string }> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, dto.email.toLowerCase()),
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const sessionUser: AuthSessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };

    return this.generateAuthResult(sessionUser);
  }

  async refresh(
    rawRefreshToken: string,
  ): Promise<{ response: AuthResponse; rawRefreshToken: string }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const now = new Date();

    const storedToken = await db.query.refreshTokens.findFirst({
      where: and(eq(refreshTokens.tokenHash, tokenHash), gt(refreshTokens.expiresAt, now)),
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, storedToken.userId),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Invalidate the used refresh token (token rotation)
    await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));

    const sessionUser: AuthSessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };

    return this.generateAuthResult(sessionUser);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    if (!rawRefreshToken) return;

    const tokenHash = this.hashToken(rawRefreshToken);
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
  }

  private async generateAuthResult(
    user: AuthSessionUser,
  ): Promise<{ response: AuthResponse; rawRefreshToken: string }> {
    const payload: JwtTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    const accessExpiry = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessExpiry as `${number}${'m' | 'h' | 'd' | 's'}`,
    });

    // Generate random secure refresh token
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    const refreshDays = 7;
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    return {
      response: {
        user,
        tokens: {
          accessToken,
          expiresIn: 15 * 60, // 15 mins in seconds
        },
      },
      rawRefreshToken,
    };
  }
}
