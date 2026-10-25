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

const SYSTEM_PROMPT = `You are Diagramz AI, a world-class diagram architect and visual thinking engine on par with Eraser.io.
Your mission is to generate crystal-clear, mathematically precise, production-grade diagrams across ANY domain — whether technical architectures, business workflows, decision trees, customer journeys, database schemas (ERDs), or sequence flows.

Output Instructions:
Always provide a response with the following 3 structured sections:

1. Overview & Architectural Breakdown (Clean GitHub-Flavored Markdown):
- Structure with clear headings (## Overview, ### Process & Decision Stages, ### Architectural Breakdown).
- Use bullet points, bold key terms, and concise engineering or workflow explanations.

2. Native Diagramz Diagram Structure (Enclosed strictly in \`\`\`json:diagramz and \`\`\` blocks):
Output a valid JSON object with "title", "nodes", and "edges".
Choose the most appropriate node types according to the domain:

A. Business Workflows, Decision Trees, & Flowcharts:
- Terminal / Start / End nodes: { "id": "start", "type": "circle", "title": "Start Process", "x": 60, "y": 140, "width": 100, "height": 100, "color": "#10b981" }
- Process / Action steps: { "id": "action-step", "type": "rectangle", "title": "Review Document", "x": 280, "y": 140, "width": 160, "height": 80, "color": "#3b82f6" }
- Decision Points & Gates: { "id": "decision-1", "type": "diamond", "title": "Is Approved?", "x": 500, "y": 135, "width": 140, "height": 90, "color": "#f59e0b" }
- Rich Action Cards (with badge & subtitle): { "id": "card-step", "type": "card", "title": "KYC Verification", "subtitle": "Automated identity screening", "badge": "Step 2", "x": 280, "y": 140, "width": 200, "height": 90, "color": "#6366f1" }
- Input / Output / Data: { "id": "data-in", "type": "parallelogram", "title": "User Form Data", "x": 280, "y": 145, "width": 150, "height": 80, "color": "#06b6d4" }
- Official Documents & Receipts: { "id": "doc-out", "type": "document", "title": "Signed Agreement", "x": 720, "y": 140, "width": 140, "height": 90, "color": "#8b5cf6" }
- Predefined Subroutines / Systems: { "id": "sub-1", "type": "subroutine", "title": "Payment Processing", "x": 500, "y": 145, "width": 160, "height": 80, "color": "#ec4899" }
- Preparation / State: { "id": "prep-1", "type": "hexagon", "title": "Init Cache", "x": 280, "y": 145, "width": 140, "height": 80, "color": "#14b8a6" }
- Notes & Callouts: { "id": "note-1", "type": "sticky-note", "title": "SLA: < 2 hours", "x": 500, "y": 280, "width": 130, "height": 80, "color": "#eab308" }

B. Database Schemas & Entity-Relationship Diagrams (ERDs):
- ALWAYS use type: "table" with "fields" array (name, type, pk, fk):
  { "id": "table-users", "type": "table", "title": "users", "width": 260, "height": 190, "color": "#0d9488", "x": 60, "y": 140, "fields": [
    { "name": "id", "type": "uuid", "pk": true },
    { "name": "email", "type": "varchar(255)" },
    { "name": "password_hash", "type": "text" },
    { "name": "created_at", "type": "timestamptz" }
  ]}
  { "id": "table-orders", "type": "table", "title": "orders", "width": 260, "height": 190, "color": "#0d9488", "x": 400, "y": 140, "fields": [
    { "name": "id", "type": "uuid", "pk": true },
    { "name": "user_id", "type": "uuid", "fk": true },
    { "name": "total_amount", "type": "numeric(10,2)" },
    { "name": "status", "type": "varchar(32)" }
  ]}

C. Cloud, Microservices, & System Architectures:
- Stencils (type: "svg" with "stencilId", width: 90, height: 90):
  arch-server, arch-microservice, arch-api-gateway, arch-payment-gateway, arch-stripe, arch-load-balancer, arch-database, arch-cache, arch-queue, arch-topic, arch-s3, arch-lambda, arch-auth, arch-firewall, arch-cdn, arch-dns, arch-monitoring, arch-vpc
- Official Tech Logos (type: "svg" with "stencilId", width: 90, height: 90):
  tech-postgres, tech-mysql, tech-redis, tech-mongodb, tech-kafka, tech-rabbitmq, tech-docker, tech-kubernetes, tech-nginx, tech-aws, tech-gcp, tech-azure, tech-cloudflare, tech-react, tech-nextjs, tech-nodejs, tech-python, tech-golang, tech-rust, tech-stripe
- Containers (type: "container") & Frames (type: "frame"):
  { "id": "vpc-main", "type": "container", "title": "Production VPC (us-east-1)", "x": 40, "y": 40, "width": 920, "height": 520, "color": "#3b82f6" }

MATHEMATICAL LAYOUT & POSITIONING RULES:
1. Clean Flow Direction:
   - Left-to-Right (LR) or Top-to-Bottom (TD) sequential progression.
   - For decision branches:
     - "Yes" / primary progression flows forward to the right (X += dx, same Y).
     - "No" / exception / rejection flows DOWNWARD (same X or slight offset, Y += 180) to avoid crossing lines.
2. Non-Colliding Spacing:
   - Horizontal distance (dx) between adjacent nodes in the same row MUST be >= 220px (e.g., x: 60, x: 300, x: 540, x: 780).
   - Vertical distance (dy) between tiers/branches MUST be >= 160px (e.g., y: 140, y: 320, y: 500).
   - Downstream dependencies (e.g., a service's database) MUST align in the SAME column X as the service, placed directly beneath it at Y + 180.
3. Informative Edges:
   - Every edge MUST have a meaningful label (e.g., "Yes", "No", "Submit Form", "HTTPS / JSON", "1:N (user_id)", "Validate Token", "Emit Event").
   - Edge objects: { "id": "e1", "source": "n1", "target": "n2", "label": "Validates", "style": "bezier", "color": "#3b82f6" }
4. Frame & Container Bounds:
   - When using containers or frames, calculate bounds to wrap children:
     - X = min(children.X) - 36, Y = min(children.Y) - 44
     - Width = max(children.X + children.Width) - min(children.X) + 72
     - Height = max(children.Y + children.Height) - min(children.Y) + 80
   - Enclosed nodes must declare "parentId": "<container-id>".

3. Optional Mermaid Representation (Enclosed in \`\`\`mermaid ... \`\`\`):
- Output valid Mermaid syntax matching the diagram domain:
  - erDiagram for database schemas
  - sequenceDiagram for chronological interactions
  - flowchart LR or flowchart TD for flowcharts, decision trees, and architectures.`;

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

    // 1. Hiring / Onboarding / Workflow Process
    if (lower.includes('hiring') || lower.includes('interview') || lower.includes('onboard') || lower.includes('recruit') || lower.includes('applicant')) {
      return [
        '## Employee Hiring & Onboarding Workflow',
        '',
        '### Workflow Overview',
        'A streamlined recruitment and onboarding lifecycle covering applicant submission, automated screening, panel evaluation, and welcome onboarding.',
        '',
        '### Key Stages',
        '1. **Application Intake**: Candidate submits resume and portfolio via job portal.',
        '2. **Screening & Assessment**: Automated resume parsing and skills challenge.',
        '3. **Panel Interviews**: Technical and behavioral assessment loops.',
        '4. **Offer & Verification**: Background verification, reference check, and formal contract.',
        '5. **Team Welcome**: Equipment provisioning and onboarding orientation.',
        '',
        '\`\`\`json:diagramz',
        JSON.stringify({
          title: 'Employee Hiring & Onboarding Workflow',
          nodes: [
            { id: 'n1', type: 'circle', title: 'Job Applied', x: 60, y: 140, width: 100, height: 100, color: '#10b981' },
            { id: 'n2', type: 'parallelogram', title: 'Submit Resume', x: 220, y: 150, width: 150, height: 80, color: '#06b6d4' },
            { id: 'n3', type: 'diamond', title: 'Screen Passed?', x: 430, y: 145, width: 140, height: 90, color: '#f59e0b' },
            { id: 'n4', type: 'rectangle', title: 'Panel Interview', x: 630, y: 150, width: 160, height: 80, color: '#3b82f6' },
            { id: 'n5', type: 'diamond', title: 'Offer Accepted?', x: 850, y: 145, width: 140, height: 90, color: '#f59e0b' },
            { id: 'n6', type: 'document', title: 'Sign Contract', x: 1050, y: 145, width: 140, height: 90, color: '#f97316' },
            { id: 'n7', type: 'circle', title: 'Hired & Active', x: 1250, y: 140, width: 100, height: 100, color: '#10b981' },
            { id: 'n-reject1', type: 'circle', title: 'Archive / Reject', x: 450, y: 320, width: 100, height: 100, color: '#ef4444' },
            { id: 'n-reject2', type: 'circle', title: 'Keep on File', x: 870, y: 320, width: 100, height: 100, color: '#ef4444' }
          ],
          edges: [
            { id: 'e1', source: 'n1', target: 'n2', label: 'Start', color: '#10b981' },
            { id: 'e2', source: 'n2', target: 'n3', label: 'Parse Resume', color: '#06b6d4' },
            { id: 'e3', source: 'n3', target: 'n4', label: 'Yes', color: '#10b981' },
            { id: 'e4', source: 'n3', target: 'n-reject1', label: 'No', color: '#ef4444' },
            { id: 'e5', source: 'n4', target: 'n5', label: 'Evaluation', color: '#3b82f6' },
            { id: 'e6', source: 'n5', target: 'n6', label: 'Yes', color: '#10b981' },
            { id: 'e7', source: 'n5', target: 'n-reject2', label: 'Declined', color: '#ef4444' },
            { id: 'e8', source: 'n6', target: 'n7', label: 'Complete', color: '#10b981' }
          ]
        }, null, 2),
        '\`\`\`',
        '',
        '\`\`\`mermaid',
        'flowchart LR',
        '    Start((Job Applied)) --> Resume[/Submit Resume/]',
        '    Resume --> Screen{Screen Passed?}',
        '    Screen -->|Yes| Interview[Panel Interview]',
        '    Screen -->|No| Reject1((Archive / Reject))',
        '    Interview --> Offer{Offer Accepted?}',
        '    Offer -->|Yes| Contract[>Sign Contract]',
        '    Offer -->|No| Reject2((Keep on File))',
        '    Contract --> Welcome((Hired & Active))',
        '\`\`\`'
      ].join('\n');
    }

    // 2. Customer Support / Refund Decision Tree
    if (lower.includes('refund') || lower.includes('return') || lower.includes('support') || lower.includes('ticket') || lower.includes('decision') || lower.includes('policy')) {
      return [
        '## Customer Refund & Returns Decision Tree',
        '',
        '### Policy & Evaluation Logic',
        'Automated customer refund qualification based on purchase recency, product condition, and exception escalation.',
        '',
        '### Decision Criteria',
        '- **Eligibility Window**: Validated within standard 30-day purchase period.',
        '- **Physical Condition**: Unopened items qualify for immediate automated store refund.',
        '- **Manager Exception**: Opened items undergo manual tier-2 review for store credit.',
        '',
        '\`\`\`json:diagramz',
        JSON.stringify({
          title: 'Customer Refund & Returns Decision Tree',
          nodes: [
            { id: 'n1', type: 'circle', title: 'Refund Request', x: 60, y: 140, width: 100, height: 100, color: '#3b82f6' },
            { id: 'n2', type: 'diamond', title: '< 30 Days?', x: 220, y: 145, width: 140, height: 90, color: '#f59e0b' },
            { id: 'n3', type: 'diamond', title: 'Item Unopened?', x: 420, y: 145, width: 140, height: 90, color: '#f59e0b' },
            { id: 'n4', type: 'document', title: 'Issue Refund Receipt', x: 620, y: 145, width: 150, height: 90, color: '#10b981' },
            { id: 'n5', type: 'card', title: 'Manager Review', subtitle: 'Condition assessment', badge: 'Tier 2', x: 415, y: 300, width: 150, height: 85, color: '#8b5cf6' },
            { id: 'n6', type: 'rectangle', title: 'Store Credit', x: 620, y: 300, width: 140, height: 80, color: '#06b6d4' },
            { id: 'n7', type: 'circle', title: 'Request Denied', x: 240, y: 300, width: 100, height: 100, color: '#ef4444' }
          ],
          edges: [
            { id: 'e1', source: 'n1', target: 'n2', label: 'Customer Initiates', color: '#3b82f6' },
            { id: 'e2', source: 'n2', target: 'n3', label: 'Yes', color: '#10b981' },
            { id: 'e3', source: 'n2', target: 'n7', label: 'No (Expired)', color: '#ef4444' },
            { id: 'e4', source: 'n3', target: 'n4', label: 'Yes (New)', color: '#10b981' },
            { id: 'e5', source: 'n3', target: 'n5', label: 'No (Opened)', color: '#f59e0b' },
            { id: 'e6', source: 'n5', target: 'n6', label: 'Approved', color: '#10b981' },
            { id: 'e7', source: 'n5', target: 'n7', label: 'Rejected', color: '#ef4444' }
          ]
        }, null, 2),
        '\`\`\`',
        '',
        '\`\`\`mermaid',
        'flowchart TD',
        '    Req((Refund Request)) --> CheckTime{Purchased < 30 Days?}',
        '    CheckTime -->|Yes| CheckCondition{Item Unopened?}',
        '    CheckTime -->|No| Denied((Request Denied))',
        '    CheckCondition -->|Yes| AutoRefund[Issue Refund Receipt]',
        '    CheckCondition -->|No| Escalate[Manager Review Tier-2]',
        '    Escalate -->|Approved| Credit[Issue Store Credit]',
        '    Escalate -->|Rejected| Denied',
        '\`\`\`'
      ].join('\n');
    }

    // 3. Database Schema / ERD
    if (lower.includes('database') || lower.includes('schema') || lower.includes('erd') || lower.includes('sql') || lower.includes('relational') || lower.includes('model')) {
      return [
        '## E-Commerce Relational Database Schema (ERD)',
        '',
        '### Data Architecture',
        'Normalized entity-relationship model supporting user authentication, order processing, and transaction settlements.',
        '',
        '### Entity Models',
        '- **users**: Customer profiles and hashed authentication credentials.',
        '- **orders**: High-level purchase lifecycle and state tracking.',
        '- **order_items**: Line-item breakdown linking orders to catalog inventory.',
        '- **payments**: Payment transaction records, Stripe settlement references, and statuses.',
        '',
        '\`\`\`json:diagramz',
        JSON.stringify({
          title: 'E-Commerce Relational Database Schema (ERD)',
          nodes: [
            {
              id: 't-users',
              type: 'table',
              title: 'users',
              x: 60,
              y: 140,
              width: 260,
              height: 200,
              color: '#0d9488',
              fields: [
                { name: 'id', type: 'uuid', pk: true },
                { name: 'email', type: 'varchar(255)' },
                { name: 'password_hash', type: 'text' },
                { name: 'created_at', type: 'timestamptz' }
              ]
            },
            {
              id: 't-orders',
              type: 'table',
              title: 'orders',
              x: 380,
              y: 140,
              width: 260,
              height: 200,
              color: '#0d9488',
              fields: [
                { name: 'id', type: 'uuid', pk: true },
                { name: 'user_id', type: 'uuid', fk: true },
                { name: 'total_cents', type: 'integer' },
                { name: 'status', type: 'varchar(32)' }
              ]
            },
            {
              id: 't-items',
              type: 'table',
              title: 'order_items',
              x: 700,
              y: 140,
              width: 260,
              height: 200,
              color: '#0d9488',
              fields: [
                { name: 'id', type: 'uuid', pk: true },
                { name: 'order_id', type: 'uuid', fk: true },
                { name: 'product_id', type: 'uuid' },
                { name: 'quantity', type: 'integer' }
              ]
            },
            {
              id: 't-payments',
              type: 'table',
              title: 'payments',
              x: 380,
              y: 400,
              width: 260,
              height: 200,
              color: '#0d9488',
              fields: [
                { name: 'id', type: 'uuid', pk: true },
                { name: 'order_id', type: 'uuid', fk: true },
                { name: 'stripe_payment_id', type: 'varchar(128)' },
                { name: 'status', type: 'varchar(32)' }
              ]
            }
          ],
          edges: [
            { id: 'e1', source: 't-users', target: 't-orders', label: '1:N places', style: 'bezier', color: '#0d9488' },
            { id: 'e2', source: 't-orders', target: 't-items', label: '1:N contains', style: 'bezier', color: '#0d9488' },
            { id: 'e3', source: 't-orders', target: 't-payments', label: '1:1 settles', style: 'bezier', color: '#0d9488' }
          ]
        }, null, 2),
        '\`\`\`',
        '',
        '\`\`\`mermaid',
        'erDiagram',
        '    USERS ||--o{ ORDERS : places',
        '    ORDERS ||--|{ ORDER_ITEMS : contains',
        '    ORDERS ||--|| PAYMENTS : settles',
        '    USERS {',
        '        uuid id PK',
        '        string email',
        '        string password_hash',
        '        timestamp created_at',
        '    }',
        '    ORDERS {',
        '        uuid id PK',
        '        uuid user_id FK',
        '        int total_cents',
        '        string status',
        '    }',
        '    ORDER_ITEMS {',
        '        uuid id PK',
        '        uuid order_id FK',
        '        uuid product_id',
        '        int quantity',
        '    }',
        '    PAYMENTS {',
        '        uuid id PK',
        '        uuid order_id FK',
        '        string stripe_payment_id',
        '        string status',
        '    }',
        '\`\`\`'
      ].join('\n');
    }

    // 4. Event Streaming / Kafka Pipeline
    if (lower.includes('event') || lower.includes('kafka') || lower.includes('stream') || lower.includes('queue') || lower.includes('broker')) {
      return [
        '## Event-Driven Distributed Streaming Architecture',
        '',
        '### System Overview',
        'This architecture decouples incoming client order events from background fulfillment engines using high-throughput message streaming.',
        '',
        '### Key Components & Boundaries',
        '- **Storefront Client**: Next.js 15 client delivering responsive web & mobile experiences.',
        '- **Order Gateway Service**: Ingress proxy validating customer checkouts before queueing.',
        '- **Apache Kafka Cluster**: Partitioned event streaming backbone preserving topic ordering.',
        '- **Worker Services**: Asynchronous inventory allocation and payment execution workers.',
        '- **PostgreSQL & Redis**: Transactional persistence and sub-millisecond status caching.',
        '',
        '\`\`\`json:diagramz',
        JSON.stringify({
          title: 'Event-Driven Distributed Streaming Architecture',
          nodes: [
            {
              id: 'c-pipeline',
              type: 'container',
              title: 'Production Event Mesh',
              x: 40,
              y: 40,
              width: 940,
              height: 480,
              color: '#f97316'
            },
            {
              id: 'node-client',
              type: 'svg',
              title: 'Next.js Web Client',
              width: 90,
              height: 90,
              data: { stencilId: 'tech-nextjs' },
              x: 80,
              y: 140,
              parentId: 'c-pipeline'
            },
            {
              id: 'node-ingress',
              type: 'svg',
              title: 'Order Ingress API',
              width: 90,
              height: 90,
              data: { stencilId: 'arch-api-gateway' },
              x: 280,
              y: 140,
              parentId: 'c-pipeline'
            },
            {
              id: 'node-kafka',
              type: 'svg',
              title: 'Apache Kafka',
              width: 90,
              height: 90,
              data: { stencilId: 'tech-kafka' },
              x: 480,
              y: 140,
              parentId: 'c-pipeline'
            },
            {
              id: 'node-worker',
              type: 'svg',
              title: 'Fulfillment Worker',
              width: 90,
              height: 90,
              data: { stencilId: 'tech-docker' },
              x: 720,
              y: 140,
              parentId: 'c-pipeline'
            },
            {
              id: 'node-db',
              type: 'svg',
              title: 'PostgreSQL DB',
              width: 90,
              height: 90,
              data: { stencilId: 'tech-postgres' },
              x: 480,
              y: 320,
              parentId: 'c-pipeline'
            },
            {
              id: 'node-cache',
              type: 'svg',
              title: 'Redis Cache',
              width: 90,
              height: 90,
              data: { stencilId: 'tech-redis' },
              x: 720,
              y: 320,
              parentId: 'c-pipeline'
            }
          ],
          edges: [
            { id: 'e1', source: 'node-client', target: 'node-ingress', label: 'POST /orders', style: 'bezier', color: '#06b6d4' },
            { id: 'e2', source: 'node-ingress', target: 'node-kafka', label: 'Publish order.created', style: 'bezier', color: '#f97316' },
            { id: 'e3', source: 'node-kafka', target: 'node-worker', label: 'Subscribe Partition', style: 'bezier', color: '#3b82f6' },
            { id: 'e4', source: 'node-worker', target: 'node-db', label: 'Write Order', style: 'bezier', color: '#10b981' },
            { id: 'e5', source: 'node-worker', target: 'node-cache', label: 'Cache State', style: 'bezier', color: '#ef4444' }
          ]
        }, null, 2),
        '\`\`\`',
        '',
        '\`\`\`mermaid',
        'flowchart LR',
        '    Client["Storefront Client<br/>(Next.js 15)"] -->|POST /orders| Gateway["Order Gateway API"]',
        '    Gateway -->|Publish Event| Kafka[("Kafka Broker<br/>(orders.v1 Topic)")]',
        '    Kafka -->|Consume Partition| Worker["Worker Cluster<br/>(Docker Go)"]',
        '    Worker -->|Persist Transaction| DB[("PostgreSQL DB")]',
        '    Worker -->|Update Status| Redis[("Redis Cache")]',
        '\`\`\`'
      ].join('\n');
    }

    // 5. Default: AWS Serverless Architecture
    return [
      '## AWS Serverless Production Architecture',
      '',
      '### System Overview',
      'A highly available serverless architecture featuring edge distribution, managed ingress, on-demand compute, and low-latency storage.',
      '',
      '### Key Components',
      '- **Next.js Client**: Global static and dynamic frontend hosted on CDN.',
      '- **Amazon API Gateway**: Managed REST ingress routing traffic with token authorization.',
      '- **AWS Lambda**: Event-driven serverless business compute.',
      '- **Amazon DynamoDB & S3**: Multi-AZ NoSQL store and object storage.',
      '',
      '\`\`\`json:diagramz',
      JSON.stringify({
        title: 'AWS Serverless Production Architecture',
        nodes: [
          {
            id: 'vpc-prod',
            type: 'container',
            title: 'AWS Production Environment (us-east-1)',
            x: 40,
            y: 40,
            width: 860,
            height: 480,
            color: '#635BFF'
          },
          {
            id: 'node-web',
            type: 'svg',
            title: 'Next.js Web Client',
            width: 90,
            height: 90,
            data: { stencilId: 'tech-nextjs' },
            x: 100,
            y: 140,
            parentId: 'vpc-prod'
          },
          {
            id: 'node-gw',
            type: 'svg',
            title: 'Amazon API Gateway',
            width: 90,
            height: 90,
            data: { stencilId: 'arch-api-gateway' },
            x: 340,
            y: 140,
            parentId: 'vpc-prod'
          },
          {
            id: 'node-lambda',
            type: 'svg',
            title: 'AWS Lambda Compute',
            width: 90,
            height: 90,
            data: { stencilId: 'arch-lambda' },
            x: 580,
            y: 140,
            parentId: 'vpc-prod'
          },
          {
            id: 'node-db',
            type: 'svg',
            title: 'Amazon DynamoDB',
            width: 90,
            height: 90,
            data: { stencilId: 'arch-database' },
            x: 580,
            y: 320,
            parentId: 'vpc-prod'
          },
          {
            id: 'node-s3',
            type: 'svg',
            title: 'S3 Assets Bucket',
            width: 90,
            height: 90,
            data: { stencilId: 'arch-s3' },
            x: 340,
            y: 320,
            parentId: 'vpc-prod'
          }
        ],
        edges: [
          { id: 'e1', source: 'node-web', target: 'node-gw', label: 'HTTPS / JSON', style: 'bezier', color: '#06b6d4' },
          { id: 'e2', source: 'node-gw', target: 'node-lambda', label: 'Invoke Event', style: 'bezier', color: '#3b82f6' },
          { id: 'e3', source: 'node-lambda', target: 'node-db', label: 'Read/Write Items', style: 'bezier', color: '#10b981' },
          { id: 'e4', source: 'node-lambda', target: 'node-s3', label: 'Upload Artifacts', style: 'bezier', color: '#f59e0b' }
        ]
      }, null, 2),
      '\`\`\`',
      '',
      '\`\`\`mermaid',
      'flowchart TD',
      '    Web["Web Client<br/>(Next.js & React)"] -->|HTTPS / JSON| GW["Amazon API Gateway"]',
      '    GW -->|Trigger| Lambda["AWS Lambda<br/>(Node.js Compute)"]',
      '    Lambda -->|Read / Write| DB[("Amazon DynamoDB")]',
      '    Lambda -->|Store Assets| S3[("Amazon S3 Bucket")]',
      '\`\`\`'
    ].join('\n');
  }
}
