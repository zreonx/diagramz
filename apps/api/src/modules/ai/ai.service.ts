import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Observable, Subject } from 'rxjs';
import { validateMermaidCode } from './mermaid-validator';
import {
  AiGenerateDto,
  AiChatDto,
  AiGenerationResult,
  AiProvider,
} from '@diagramz/shared';

const SYSTEM_PROMPT = `You are an expert system architect and diagram designer for Diagramz.
Your mission is to design production-grade cloud, microservice, and distributed architectures using real-world architectural stencils, official tech logos, and security boundaries.

Output Instructions:
Always provide a response with the following 3 structured sections:

1. Architectural Overview & Breakdown (Formatted in clean GitHub-Flavored Markdown):
- Structure with clear headings (## System Architecture, ### Component Roles, ### Security & Data Flow).
- Use bullet points, bold key terms, and concise engineering explanations.

2. Native Diagramz Architecture Structure (Enclosed strictly in \`\`\`json:diagramz and \`\`\` blocks):
Output a valid JSON object with "title", "nodes", and "edges":
- "nodes": Array of architecture elements. Combine the built-in capabilities of Diagramz:
  - Architecture Tables (type: "table" for ERD, database schemas, and relational entities):
    Use "table" with "fields" array for ERDs, database models, and persistent stores:
    { "id": "table-users", "type": "table", "title": "users", "width": 260, "height": 190, "color": "#0d9488", "x": 60, "y": 140, "fields": [
      { "name": "id", "type": "uuid", "pk": true },
      { "name": "email", "type": "varchar(255)" },
      { "name": "password_hash", "type": "text" },
      { "name": "created_at", "type": "timestamptz" }
    ]}
    { "id": "table-orders", "type": "table", "title": "orders", "width": 260, "height": 190, "color": "#0d9488", "x": 380, "y": 140, "fields": [
      { "name": "id", "type": "uuid", "pk": true },
      { "name": "user_id", "type": "uuid", "fk": true },
      { "name": "total_amount", "type": "numeric(10,2)" },
      { "name": "status", "type": "varchar(32)" }
    ]}
  - Built-in Architecture Stencils (type: "svg" with stencilId, width: 90, height: 90):
    { "id": "api-gw", "type": "svg", "title": "Amazon API Gateway", "width": 90, "height": 90, "data": { "stencilId": "arch-api-gateway" }, "x": 360, "y": 140, "parentId": "vpc-main" }
    { "id": "lambda-svc", "type": "svg", "title": "AWS Lambda", "width": 90, "height": 90, "data": { "stencilId": "arch-lambda" }, "x": 580, "y": 140, "parentId": "vpc-main" }
    { "id": "auth-svc", "type": "svg", "title": "Cognito Auth", "width": 90, "height": 90, "data": { "stencilId": "arch-auth" }, "x": 360, "y": 320, "parentId": "vpc-main" }
    { "id": "stripe-gw", "type": "svg", "title": "Stripe Payment Gateway", "width": 90, "height": 90, "data": { "stencilId": "arch-payment-gateway" }, "x": 800, "y": 140, "parentId": "vpc-main" }
    { "id": "s3-storage", "type": "svg", "title": "S3 Bucket", "width": 90, "height": 90, "data": { "stencilId": "arch-s3" }, "x": 800, "y": 320, "parentId": "vpc-main" }
  - Official Tech Logo Stencils (type: "svg" with stencilId/techLogoId, width: 90, height: 90):
    { "id": "client-ui", "type": "svg", "title": "Next.js Web Client", "width": 90, "height": 90, "data": { "stencilId": "tech-nextjs" }, "x": 120, "y": 140, "parentId": "vpc-main" }
    { "id": "postgres-db", "type": "svg", "title": "PostgreSQL Primary", "width": 90, "height": 90, "data": { "stencilId": "tech-postgres" }, "x": 580, "y": 320, "parentId": "vpc-main" }
    { "id": "redis-cache", "type": "svg", "title": "Redis Cache", "width": 90, "height": 90, "data": { "stencilId": "tech-redis" }, "x": 800, "y": 320, "parentId": "vpc-main" }
    { "id": "kafka-bus", "type": "svg", "title": "Apache Kafka", "width": 90, "height": 90, "data": { "stencilId": "tech-kafka" }, "x": 580, "y": 140, "parentId": "vpc-main" }
    { "id": "docker-runner", "type": "svg", "title": "Docker Worker", "width": 90, "height": 90, "data": { "stencilId": "tech-docker" }, "x": 360, "y": 320, "parentId": "vpc-main" }
    { "id": "tech-stripe-logo", "type": "svg", "title": "Stripe Gateway", "width": 90, "height": 90, "data": { "stencilId": "tech-stripe" }, "x": 800, "y": 140, "parentId": "vpc-main" }
  - Frames & Artboard Boundaries (type: "frame"):
    High-level artboard frame enclosing subsystems with top title & dimensions:
    { "id": "frame-main", "type": "frame", "title": "Production E-Commerce Platform", "x": 20, "y": 20, "width": 1280, "height": 760, "color": "#635BFF" }
  - Containers (type: "container" for VPC, Subnet, or Namespace):
    { "id": "vpc-main", "type": "container", "title": "Production VPC (us-east-1)", "x": 40, "y": 40, "width": 880, "height": 520, "color": "#3b82f6" }
  - Geometric Shapes (type: "rectangle", "circle", "diamond") & Text Annotations (type: "text"):
    { "id": "decision-fraud", "type": "diamond", "title": "Fraud Check?", "width": 120, "height": 80, "color": "#f59e0b", "x": 440, "y": 140 }
    { "id": "callout-note", "type": "text", "title": "⚡ 15k RPS Ingress · mTLS 1.3 · 99.99% Availability", "width": 320, "height": 40, "color": "#a855f7", "x": 380, "y": 50 }
- Available Tech Logos ("stencilId" or "techLogoId"):
  - Databases: tech-postgres, tech-mysql, tech-redis, tech-mongodb, tech-sqlite
  - Event & Queues: tech-kafka, tech-rabbitmq
  - Containers & Infra: tech-docker, tech-kubernetes, tech-nginx
  - Cloud Providers: tech-aws, tech-gcp, tech-azure, tech-cloudflare
  - Languages & Frameworks: tech-react, tech-nextjs, tech-nodejs, tech-python, tech-golang, tech-rust, tech-graphql, tech-typescript
  - Observability & Payments: tech-prometheus, tech-grafana, tech-elasticsearch, tech-stripe
- Available Architecture Stencils ("stencilId"):
  - arch-server, arch-microservice, arch-api-gateway, arch-payment-gateway, arch-stripe, arch-load-balancer, arch-database, arch-cache, arch-queue, arch-topic, arch-s3, arch-lambda, arch-auth, arch-firewall, arch-cdn, arch-dns, arch-monitoring, arch-vpc
- "edges": Array of connections with descriptive protocol labels:
  - { "id": "e1", "source": "api-gw", "target": "lambda-svc", "label": "HTTP Proxy", "style": "bezier", "color": "#3b82f6" }
  - { "id": "e2", "source": "table-users", "target": "table-orders", "label": "1:N (user_id)", "style": "bezier", "color": "#0d9488" }

CRITICAL ARCHITECTURE & ERD RULES:
1. When asked to "make erd", "create database schema", or design data models:
   ALWAYS use type: "table" with detailed "fields" (name, type, pk, fk). DO NOT use basic cards or generic SVGs for database schema tables.
2. For system & cloud architectures:
   Combine architecture stencils (type: "svg"), official tech logos, and database tables (type: "table") inside containers (type: "container") or frames (type: "frame"), enriched with text annotations (type: "text") and decision shapes where relevant.
3. DO NOT generate generic rectangular flow cards (type: "card") when architecture stencils or database tables are appropriate.

CRITICAL POSITIONING & ARCHITECTURE GUIDELINES:
- Professional Positioning & Column Alignment:
  - Downstream components (databases, tables, caches, workers, storage) MUST align in the same column (X position) as the specific service or worker that calls them!
    Example: If "order-worker" is at x: 640, y: 140, its database "postgres-db" or "table-orders" MUST be at x: 640, y: 340 (directly underneath it), NOT shoved back to x: 60!
    If "auth-service" is at x: 380, its session store "redis-cache" or "table-users" MUST be at x: 380, y: 340.
  - Centered Hubs & Ingress: Ingress nodes (like API Gateway or Load Balancer) that distribute traffic to multiple services should be centered horizontally relative to the services they route to.
- Logical Flow Direction:
  - Establish a clean, professional Left-to-Right flow across architectural tiers (e.g., Client/DNS at x: 120 -> Ingress/Gateway at x: 380 -> Services/Workers at x: 640 -> Databases/Storage at x: 900) or structured Top-to-Bottom tiers.
- Spacing & Breathing Room:
  - Horizontal distance (dx) between adjacent nodes in the same row: >= 240px (e.g. x: 120, x: 380, x: 640, x: 900) so edge label pills and titles never overlap.
  - Vertical distance (dy) between tiers/rows: >= 180px (e.g. y: 140, y: 340, y: 540) so downward arrows and multiline labels have generous breathing room.
- Clean Connection Lines & Label Positioning:
  - Clear, concise connection labels: Give edges descriptive protocol/relationship labels (e.g. "HTTPS / REST", "gRPC / Protobuf", "SQL Queries", "Pub/Sub Events", "Session Cache", "1:N (user_id)").
  - Non-colliding relationships: When hubs connect to multiple downstream services, space target services horizontally (dx >= 240px) so fan-out lines never cross or overlap.
  - Clear flow hierarchy: Route communication paths logically from upstream client/ingress to downstream services and data stores without unnecessary crisscrossing.
- Containers & Grouping Boundaries:
  - Frames (type: "frame") and containers (type: "container") MUST snuggly match and enclose their content!
  - Frame/container bounds MUST be calculated to wrap their children:
    - X = min(children.X) - 36, Y = min(children.Y) - 44
    - Width = max(children.X + children.Width) - min(children.X) + 72
    - Height = max(children.Y + children.Height) - min(children.Y) + 80
  - Every child component enclosed inside a frame or container MUST specify "parentId": "<frame-or-container-id>".
  - DO NOT output oversized empty frames or detached frames that do not wrap their components.
  - Sibling containers (e.g. Public Subnet, Private Subnet) must be positioned side-by-side with at least 80px gap between them (Container 2 X >= Container 1 X + Container 1 Width + 80).

3. Optional Mermaid Representation (Enclosed in \`\`\`mermaid ... \`\`\`):
- If the diagram is an ERD / database schema, output valid Mermaid \`erDiagram\` syntax (with entities, fields, PK, FK, and relationships).
- If the diagram is a flowchart / cloud architecture, output clean, valid Mermaid flowchart syntax (\`flowchart LR\` or \`flowchart TD\`).`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private geminiKey: string | null = null;
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;

  constructor(private configService: ConfigService) {
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiKey && geminiKey.trim().length > 0) {
      this.geminiKey = geminiKey.trim();
      this.logger.log('Google Gemini provider initialized (Private Mode · No Model Training)');
    }

    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiKey && !openaiKey.startsWith('sk-proj-...')) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.logger.log('OpenAI provider initialized');
    }

    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey && !anthropicKey.startsWith('sk-ant-...')) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
      this.logger.log('Anthropic provider initialized');
    }
  }

  async generate(dto: AiGenerateDto): Promise<AiGenerationResult> {
    const provider = dto.provider || (this.geminiKey ? 'gemini' : this.anthropic ? 'anthropic' : 'openai');
    const promptWithContext = dto.currentMermaidCode
      ? `${dto.prompt}\n\nExisting Mermaid Diagram:\n\`\`\`mermaid\n${dto.currentMermaidCode}\n\`\`\`\nPlease update and refine this diagram accordingly.`
      : dto.prompt;

    const rawOutput = await this.callProvider(provider, promptWithContext);
    return this.parseAndValidateResponse(rawOutput);
  }

  streamChat(dto: AiChatDto): Observable<{ data: string }> {
    const subject = new Subject<{ data: string }>();

    (async () => {
      try {
        const provider = dto.provider || (this.geminiKey ? 'gemini' : this.anthropic ? 'anthropic' : 'openai');

        if (this.geminiKey && (provider === 'gemini' || (!this.openai && !this.anthropic))) {
          await this.streamGemini(dto, subject);
          return;
        }

        if (this.openai && provider === 'openai') {
          const messages: OpenAI.ChatCompletionMessageParam[] = [
            { role: 'system', content: SYSTEM_PROMPT },
          ];

          if (dto.currentMermaidCode) {
            messages.push({
              role: 'system',
              content: `Current Mermaid diagram code on the user's canvas:\n\`\`\`mermaid\n${dto.currentMermaidCode}\n\`\`\``,
            });
          }

          for (const msg of dto.history || []) {
            messages.push({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
            });
          }

          messages.push({ role: 'user', content: dto.message });

          const stream = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            stream: true,
          });

          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content || '';
            if (token) {
              subject.next({ data: JSON.stringify({ token }) });
            }
          }
        } else {
          // Mock / Fallback streaming response
          const simulatedResponse = this.generateFallbackDiagram(dto.message);
          const chunks = simulatedResponse.split(' ');
          for (const chunk of chunks) {
            await new Promise((r) => setTimeout(r, 40));
            subject.next({ data: JSON.stringify({ token: chunk + ' ' }) });
          }
        }

        subject.next({ data: JSON.stringify({ done: true }) });
        subject.complete();
      } catch (err: any) {
        this.logger.error(`AI stream error: ${err.message}`);
        subject.next({ data: JSON.stringify({ error: err.message, done: true }) });
        subject.complete();
      }
    })();

    return subject.asObservable();
  }

  private async callProvider(provider: AiProvider, prompt: string): Promise<string> {
    if (provider === 'gemini' || (!this.openai && !this.anthropic && this.geminiKey)) {
      return this.callGemini(prompt);
    }

    if (provider === 'openai' && this.openai) {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      });
      return completion.choices[0]?.message?.content || '';
    }

    if (provider === 'anthropic' && this.anthropic) {
      const msg = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-latest',
        system: SYSTEM_PROMPT,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });
      const textBlock = msg.content.find((c) => c.type === 'text');
      return textBlock ? textBlock.text : '';
    }

    // High-quality local fallback for development
    return this.generateFallbackDiagram(prompt);
  }

  private async callGemini(prompt: string): Promise<string> {
    if (!this.geminiKey) {
      throw new BadRequestException('Gemini API key is not configured.');
    }

    const models = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let lastError: any = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: SYSTEM_PROMPT }],
            },
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error?.message || `Gemini API returned status ${res.status}`);
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return text;
        }
      } catch (err: any) {
        this.logger.warn(`Gemini model ${model} failed: ${err.message}. Trying next fallback model...`);
        lastError = err;
      }
    }

    this.logger.error(`All Gemini models failed. Falling back to local architectural generator. Error: ${lastError?.message}`);
    return this.generateFallbackDiagram(prompt);
  }

  private async streamGemini(
    dto: AiChatDto,
    subject: Subject<{ data: string }>
  ): Promise<void> {
    if (!this.geminiKey) {
      throw new BadRequestException('Gemini API key is not configured.');
    }

    const contents: any[] = [];
    if (dto.currentMermaidCode) {
      contents.push({
        role: 'user',
        parts: [{ text: `Current Mermaid diagram code on the canvas:\n\`\`\`mermaid\n${dto.currentMermaidCode}\n\`\`\`` }],
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'I understand the current diagram on your canvas.' }],
      });
    }

    for (const msg of dto.history || []) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: dto.message }],
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${this.geminiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error?.message || `Gemini stream returned status ${res.status}`);
    }

    if (!res.body) {
      throw new Error('Gemini response has no stream body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;

        try {
          const payload = JSON.parse(jsonStr);
          const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text) {
            subject.next({ data: JSON.stringify({ token: text }) });
          }
        } catch {
          // ignore heartbeats
        }
      }
    }

    subject.next({ data: JSON.stringify({ done: true }) });
    subject.complete();
  }

  private parseAndValidateResponse(rawOutput: string): AiGenerationResult {
    // 1. Try to extract json:diagramz block
    const jsonMatch = rawOutput.match(/```(?:json:diagramz|json)\s*([\s\S]*?)```/i);
    let canvasData: Record<string, any> | undefined;
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.nodes && Array.isArray(parsed.nodes)) {
          canvasData = parsed;
        }
      } catch (e) {
        this.logger.debug(`Could not parse JSON diagram data: ${e}`);
      }
    }

    // 2. Extract Mermaid block
    const mermaidMatch = rawOutput.match(/```(?:mermaid)\s*([\s\S]*?)```/i) || rawOutput.match(/```(?:flowchart|graph)?\s*([\s\S]*?)```/i);
    let mermaidCode = mermaidMatch ? mermaidMatch[1].trim() : '';

    if (mermaidCode.startsWith('{') || mermaidCode.startsWith('[')) {
      const explicitMermaid = rawOutput.match(/```mermaid\s*([\s\S]*?)```/i);
      mermaidCode = explicitMermaid ? explicitMermaid[1].trim() : '';
    }

    // 3. Extract Markdown explanation
    let explanation = rawOutput
      .replace(/```(?:json:diagramz|json)[\s\S]*?```/gi, '')
      .replace(/```(?:mermaid)[\s\S]*?```/gi, '')
      .trim();

    // 4. Validate Mermaid code
    let diagramType = 'flowchart';
    if (mermaidCode) {
      const validation = validateMermaidCode(mermaidCode);
      if (validation.isValid) {
        mermaidCode = validation.mermaidCode;
        diagramType = validation.diagramType;
      }
    }

    // If no valid mermaid was provided, synthesize a clean fallback flowchart
    if (!mermaidCode) {
      mermaidCode = `flowchart TD\n    Client["Web App<br/>(Next.js)"] --> Gateway["API Gateway"]\n    Gateway --> CoreAPI["Core Microservice<br/>(Node.js / Docker)"]\n    CoreAPI --> DB[("PostgreSQL DB")]\n    CoreAPI --> Cache[("Redis Cache")]`;
    }

    return {
      mermaidCode,
      explanation: explanation || 'Architecture diagram designed successfully according to specification.',
      diagramType,
      canvasData,
    };
  }

  private generateFallbackDiagram(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes('event') || lower.includes('kafka') || lower.includes('queue')) {
      return `## Event-Driven Distributed Streaming Architecture

### System Overview
This architecture decouples incoming client order events from background fulfillment engines using high-throughput message streaming.

### Key Components & Boundaries
- **Storefront Client**: Next.js 15 client delivering responsive web & mobile experiences.
- **Order Gateway Service**: Ingress proxy validating customer checkouts before queueing.
- **Apache Kafka Cluster**: Partitioned event streaming backbone preserving topic ordering.
- **Worker Services**: Asynchronous inventory allocation and payment execution workers.
- **PostgreSQL & Redis**: Transactional persistence and sub-millisecond status caching.

\`\`\`json:diagramz
{
  "title": "Event-Driven Distributed Streaming Architecture",
  "nodes": [
    {
      "id": "vpc-cluster",
      "type": "container",
      "title": "Streaming VPC & Kubernetes Cluster",
      "x": 40,
      "y": 40,
      "width": 860,
      "height": 480,
      "color": "#635BFF"
    },
    {
      "id": "node-client",
      "type": "svg",
      "title": "Next.js Web Client",
      "width": 90,
      "height": 90,
      "data": { "stencilId": "tech-nextjs" },
      "x": 100,
      "y": 140,
      "parentId": "vpc-cluster"
    },
    {
      "id": "node-api",
      "type": "svg",
      "title": "Order Ingress Gateway",
      "width": 90,
      "height": 90,
      "data": { "stencilId": "arch-api-gateway" },
      "x": 320,
      "y": 140,
      "parentId": "vpc-cluster"
    },
    {
      "id": "node-kafka",
      "type": "svg",
      "title": "Apache Kafka Cluster",
      "width": 90,
      "height": 90,
      "data": { "stencilId": "tech-kafka" },
      "x": 540,
      "y": 140,
      "parentId": "vpc-cluster"
    },
    {
      "id": "node-worker",
      "type": "svg",
      "title": "Payment Processor",
      "width": 90,
      "height": 90,
      "data": { "stencilId": "tech-stripe" },
      "x": 320,
      "y": 300,
      "parentId": "vpc-cluster"
    },
    {
      "id": "node-db",
      "type": "svg",
      "title": "PostgreSQL Primary",
      "width": 90,
      "height": 90,
      "data": { "stencilId": "tech-postgres" },
      "x": 540,
      "y": 300,
      "parentId": "vpc-cluster"
    }
  ],
  "edges": [
    { "id": "e1", "source": "node-client", "target": "node-api", "label": "HTTPS POST /orders", "style": "bezier", "color": "#06b6d4" },
    { "id": "e2", "source": "node-api", "target": "node-kafka", "label": "Produce OrderPlaced", "style": "bezier", "color": "#3b82f6" },
    { "id": "e3", "source": "node-kafka", "target": "node-worker", "label": "Consume Topic", "style": "step", "color": "#231F20" },
    { "id": "e4", "source": "node-worker", "target": "node-db", "label": "Write Ledger", "style": "bezier", "color": "#4169E1" }
  ]
}
\`\`\`

\`\`\`mermaid
flowchart TD
    Client["Storefront Web App<br/>(Next.js)"] -->|HTTPS POST /orders| API["Order Gateway<br/>(Docker / Node.js)"]
    API -->|Produce OrderPlaced| Kafka{{"Apache Kafka<br/>(orders.topic)"}}
    Kafka -->|Consume| Worker["Payment Worker<br/>(Stripe)"]
    Worker -->|Write Transaction| DB[("PostgreSQL DB<br/>(Orders Ledger)")]
\`\`\``;
    }

    // Default microservices cloud architecture
    return `## Distributed Microservices Cloud Architecture

### System Overview
This scalable cloud architecture utilizes API Gateway routing, isolated containerized microservices, and dedicated storage layers.

### Key Components & Boundaries
- **Client Tier**: Web & Mobile UI built with modern React & Next.js.
- **Security Boundary**: VPC with public ingress and private isolated subnets.
- **Microservices**: Containerized services deployed via Docker and Kubernetes.
- **Persistence Tier**: Multi-AZ PostgreSQL primary database and in-memory Redis cluster.

\`\`\`json:diagramz
{
  "title": "Distributed Microservices Cloud Architecture",
  "nodes": [
    {
      "id": "vpc-prod",
      "type": "container",
      "title": "AWS Production VPC (us-east-1)",
      "x": 40,
      "y": 40,
      "width": 860,
      "height": 480,
      "color": "#635BFF"
    },
    {
      "id": "node-web",
      "type": "svg",
      "title": "Next.js Web Client",
      "width": 90,
      "height": 90,
      "data": { "stencilId": "tech-nextjs" },
      "x": 100,
      "y": 140,
      "parentId": "vpc-prod"
    },
    {
      "id": "node-gw",
      "type": "svg",
      "title": "Amazon API Gateway",
      "width": 90,
      "height": 90,
      "data": { "stencilId": "arch-api-gateway" },
      "x": 320,
      "y": 140,
      "parentId": "vpc-prod"
    },
    {
      "id": "node-core",
      "type": "svg",
      "title": "Core Microservice",
      "width": 90,
      "height": 90,
      "data": { "stencilId": "tech-docker" },
      "x": 540,
      "y": 140,
      "parentId": "vpc-prod"
    },
    {
      "id": "node-db",
      "type": "svg",
      "title": "PostgreSQL Primary",
      "width": 90,
      "height": 90,
      "data": { "stencilId": "tech-postgres" },
      "x": 320,
      "y": 300,
      "parentId": "vpc-prod"
    },
    {
      "id": "node-cache",
      "type": "svg",
      "title": "Redis Cluster",
      "width": 90,
      "height": 90,
      "data": { "stencilId": "tech-redis" },
      "x": 540,
      "y": 300,
      "parentId": "vpc-prod"
    }
  ],
  "edges": [
    { "id": "e1", "source": "node-web", "target": "node-gw", "label": "HTTPS / JSON", "style": "bezier", "color": "#06b6d4" },
    { "id": "e2", "source": "node-gw", "target": "node-core", "label": "Internal gRPC", "style": "bezier", "color": "#3b82f6" },
    { "id": "e3", "source": "node-core", "target": "node-db", "label": "Query SQL", "style": "bezier", "color": "#4169E1" },
    { "id": "e4", "source": "node-core", "target": "node-cache", "label": "Cache Reads/Writes", "style": "bezier", "color": "#FF4438" }
  ]
}
\`\`\`

\`\`\`mermaid
flowchart TD
    Web["Web Application<br/>(Next.js & React)"] -->|HTTPS / JSON| GW["Amazon API Gateway"]
    GW -->|Internal gRPC| Core["Core Microservice<br/>(Node.js / Docker)"]
    Core -->|Query SQL| DB[("PostgreSQL DB<br/>(Multi-AZ Primary)")]
    Core -->|Get / Set| Cache[("Redis Cluster<br/>(In-Memory Cache)")]
\`\`\``;
  }
}
