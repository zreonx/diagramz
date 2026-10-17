'use client';

import React from 'react';
import {
  Server,
  Database,
  Cloud,
  Cpu,
  Globe,
  Shield,
  ShieldCheck,
  Layers,
  HardDrive,
  MessageSquare,
  Activity,
  Key,
  Smartphone,
  Monitor,
  Laptop,
  Terminal,
  Boxes,
  Box,
  Package,
  Network,
  Zap,
  Shuffle,
  Search,
  Lock,
  Radio,
  Workflow,
  User,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const ARCH_ICON_MAP: Record<string, React.ElementType> = {
  // Databases & Storage
  database: Database,
  postgres: Database,
  mysql: Database,
  redis: Database,
  cache: Database,
  mongodb: Database,
  elasticsearch: Search,
  search: Search,
  storage: HardDrive,
  harddrive: HardDrive,
  s3: HardDrive,

  // Servers & Compute
  server: Server,
  'web-server': Server,
  'app-server': Server,
  cpu: Cpu,
  microservice: Box,
  box: Box,
  boxes: Boxes,
  worker: Workflow,
  workflow: Workflow,
  container: Package,
  docker: Package,
  package: Package,
  k8s: Layers,
  kubernetes: Layers,
  layers: Layers,
  terminal: Terminal,
  linux: Terminal,

  // Cloud & Serverless
  cloud: Cloud,
  aws: Cloud,
  lambda: Zap,
  zap: Zap,
  serverless: Zap,
  'cloud-vpc': Cloud,

  // Security & Networking
  network: Network,
  'api-gateway': Network,
  gateway: Network,
  shuffle: Shuffle,
  'load-balancer': Shuffle,
  shield: Shield,
  firewall: Shield,
  'shield-check': ShieldCheck,
  auth: ShieldCheck,
  lock: Lock,
  globe: Globe,
  cdn: Globe,
  dns: Globe,

  // Clients & Frontend
  client: Laptop,
  browser: Laptop,
  laptop: Laptop,
  mobile: Smartphone,
  smartphone: Smartphone,
  desktop: Monitor,
  monitor: Monitor,
  user: User,

  // Messaging & Queues
  kafka: Activity,
  activity: Activity,
  queue: MessageSquare,
  messagesquare: MessageSquare,
  websocket: Radio,
  radio: Radio,
  pubsub: Radio,
  key: Key,

  // Payments & Checkout
  stripe: CreditCard,
  payment: CreditCard,
  'payment-gateway': CreditCard,
  checkout: CreditCard,
  billing: CreditCard,
};

export interface ArchitectureIconProps {
  name?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ArchitectureIcon({
  name,
  className = 'w-4 h-4',
  style,
}: ArchitectureIconProps) {
  if (!name) {
    return <Server className={cn('shrink-0', className)} style={style} />;
  }

  const normalized = name.toLowerCase().trim();
  const IconComponent = ARCH_ICON_MAP[normalized] || Server;

  return <IconComponent className={cn('shrink-0', className)} style={style} />;
}
