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
Your task is to convert natural language instructions into strict, syntactically valid Mermaid.js diagrams.

Rules:
1. Always output valid Mermaid.js enclosed within \`\`\`mermaid and \`\`\` blocks.
2. Never output arbitrary layout coordinates, HTML, or unsupported Markdown styles.
3. Allowed diagram types: flowchart (TD, LR), sequenceDiagram, classDiagram, erDiagram, stateDiagram-v2, mindmap.
4. Maintain clean, descriptive node labels and consistent directionality.
5. Accompany the code with a concise (2-3 sentences) architectural explanation outside the code block.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;

  constructor(private configService: ConfigService) {
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
    const provider = dto.provider || (this.anthropic ? 'anthropic' : 'openai');
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
        const provider = dto.provider || (this.anthropic ? 'anthropic' : 'openai');

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

  private parseAndValidateResponse(rawOutput: string): AiGenerationResult {
    const match = rawOutput.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
    const mermaidCode = match ? match[1].trim() : rawOutput.trim();
    const explanation = rawOutput.replace(/```(?:mermaid)?[\s\S]*?```/gi, '').trim();

    const validation = validateMermaidCode(mermaidCode);
    if (!validation.isValid) {
      this.logger.warn(`AI generated invalid Mermaid code: ${validation.error}`);
      throw new BadRequestException(`AI generated invalid Mermaid diagram: ${validation.error}`);
    }

    return {
      mermaidCode: validation.mermaidCode,
      explanation: explanation || 'Architecture diagram generated successfully according to specification.',
      diagramType: validation.diagramType,
    };
  }

  private generateFallbackDiagram(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes('event') || lower.includes('kafka') || lower.includes('queue')) {
      return `Here is the event-driven architecture based on your request. It decouples the client order submissions from downstream processing via Kafka message topics.

\`\`\`mermaid
flowchart TD
    Client[Web & Mobile Client] -->|HTTP POST /orders| API[Order Gateway Service]
    API -->|Produce OrderPlaced| Kafka[Apache Kafka Cluster]
    
    subgraph Event Streaming
        Kafka --> TopicOrders[(orders.topic)]
    end
    
    TopicOrders -->|Consume| NotifService[Notification Service]
    TopicOrders -->|Consume| InventoryService[Inventory Service]
    TopicOrders -->|Consume| PaymentWorker[Payment Processor]
    
    PaymentWorker -->|OrderCharged| Kafka
\`\`\``;
    }

    if (lower.includes('sequence') || lower.includes('auth') || lower.includes('login')) {
      return `Here is the sequence diagram illustrating the authentication and token rotation workflow.

\`\`\`mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Web App (Next.js)
    participant API as NestJS Gateway
    participant DB as Postgres (Neon)
    
    User->>Web: Submits credentials
    Web->>API: POST /api/v1/auth/login
    API->>DB: Query user & verify password
    DB-->>API: User record
    API-->>Web: Set HTTP-only Cookie + JWT Access Token
    Web-->>User: Redirect to Workspace Dashboard
\`\`\``;
    }

    // Default flowchart
    return `Here is the system architecture diagram generated from your description.

\`\`\`mermaid
flowchart TD
    subgraph Presentation Layer
        UI[Next.js 15 Web Application]
        Canvas[Excalidraw & Mermaid Canvas]
    end

    subgraph Service Layer
        NestAPI[NestJS Modular API]
        CollabGW[Socket.IO Collab Gateway]
    end

    subgraph Storage Layer
        Postgres[(Neon PostgreSQL)]
        R2[(Cloudflare R2 Bucket)]
    end

    UI -->|REST & SSE| NestAPI
    Canvas <-->|Binary Yjs CRDTs| CollabGW
    NestAPI -->|Drizzle ORM| Postgres
    NestAPI -->|Presigned URLs| R2
\`\`\``;
  }
}
