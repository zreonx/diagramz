import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password is too long'),
  name: z.string().min(2, 'Name must be at least 2 characters long').max(100),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginDto = z.infer<typeof loginSchema>;

export interface AuthSessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: AuthSessionUser;
  tokens: AuthTokens;
}

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long').max(100).optional(),
  avatarUrl: z.string().url('Must be a valid URL').nullable().optional(),
});
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long')
    .max(100, 'Password is too long'),
});
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export interface JwtTokenPayload {
  sub: string;
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}
