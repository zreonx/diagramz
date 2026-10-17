'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterDto } from '@diagramz/shared';
import { apiClient, setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Layers,
  ArrowRight,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, checkAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  React.useEffect(() => {
    checkAuth().then((authed) => {
      if (authed) {
        router.replace('/dashboard');
      } else {
        setIsCheckingSession(false);
      }
    });
  }, [checkAuth, router]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterDto>({ resolver: zodResolver(registerSchema) });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email');
      if (emailParam) {
        setValue('email', emailParam);
      }
    }
  }, [setValue]);

  const onSubmit = async (data: RegisterDto) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/register', data);
      const { user, tokens } = res.data;
      setAccessToken(tokens.accessToken);
      setUser(user);
      toast.success(`Welcome to Diagramz, ${user.name}!`);
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const redirectUrl = params?.get('redirect') || '/dashboard';
      router.push(redirectUrl);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 relative bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Top Controls: Back to home & Theme toggle */}
      <div className="absolute top-4 left-4 z-20">
        <Link href="/">
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Back to home
          </Button>
        </Link>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Left: Brand & Benefits Showcase Panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-muted/30 border-r border-border/60 relative overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[radial-gradient(#80808014_1px,transparent_1px)] [background-size:20px_20px]" />

        {/* Top Brand Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Layers className="size-4" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Diagramz</span>
          </Link>
          <Badge variant="outline" className="text-[11px] font-normal border-border/70 text-muted-foreground">
            Get Started Free
          </Badge>
        </div>

        {/* Middle Feature Highlights List */}
        <div className="relative z-10 space-y-6 max-w-lg my-auto">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Sparkles className="size-3.5" /> Architecture As Living Code
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              Create your workspace and start building in seconds.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Join thousands of software engineers drafting distributed systems, flowcharts, and technical specifications.
            </p>
          </div>

          <div className="space-y-3.5 pt-2">
            {[
              {
                title: 'Dual-Engine Workspace',
                desc: 'Technical specs & Mermaid code on the left, infinite canvas on the right.',
              },
              {
                title: 'Multiplayer Synchronization',
                desc: 'CRDT-backed collaborative editing with zero locks and live cursor presence.',
              },
              {
                title: 'Enterprise Architecture Stencils',
                desc: 'Cloud nodes, microservices, databases, and flowchart components ready to use.',
              },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-card/60 backdrop-blur-sm">
                <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-foreground">{f.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Attribution */}
        <div className="relative z-10 flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/40">
          <span>&copy; {new Date().getFullYear()} Diagramz Platform</span>
          <span>No Credit Card Required</span>
        </div>
      </div>

      {/* Right: Auth Form */}
      <div className="flex flex-col items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-2">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <Layers className="size-4" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Diagramz</span>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Sign up to launch your collaborative diagramming workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Alex Turner"
                  className="pl-9 h-10 text-sm border-border/70 focus-visible:ring-1"
                  {...register('name')}
                  disabled={isLoading}
                />
              </div>
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">Work Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="alex@company.com"
                  className="pl-9 h-10 text-sm border-border/70 focus-visible:ring-1"
                  {...register('email')}
                  disabled={isLoading}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  className="pl-9 pr-9 h-10 text-sm border-border/70 focus-visible:ring-1"
                  {...register('password')}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button type="submit" disabled={isLoading} className="w-full h-10 gap-2 font-medium text-xs mt-3 shadow-sm">
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              {isLoading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground pt-3 border-t border-border/40">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-foreground underline underline-offset-4 hover:text-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
