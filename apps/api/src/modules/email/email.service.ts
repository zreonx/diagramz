import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface SendWorkspaceInviteOptions {
  to: string;
  workspaceName: string;
  role: string;
  token: string;
  inviterName?: string;
  inviterEmail?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private fromEmail: string;
  private appUrl: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'Diagramz <onboarding@resend.dev>';
    this.appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend email client initialized successfully');
    } else {
      this.logger.warn('RESEND_API_KEY is not defined. Email dispatch will be simulated.');
    }
  }

  async sendWorkspaceInvitation(options: SendWorkspaceInviteOptions): Promise<boolean> {
    const inviteUrl = `${this.appUrl}/invite/${options.token}`;
    const inviterDisplay = options.inviterName || options.inviterEmail || 'A teammate';

    const subject = `${inviterDisplay} invited you to join ${options.workspaceName} on Diagramz`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      color: #0f172a;
    }
    .container {
      max-width: 560px;
      margin: 40px auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      padding: 32px 32px 24px;
      text-align: center;
      background: linear-gradient(180deg, #f1f5f9 0%, #ffffff 100%);
      border-bottom: 1px solid #f1f5f9;
    }
    .logo {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #0f172a;
      display: inline-block;
      margin-bottom: 8px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      color: #2563eb;
      background-color: #eff6ff;
      border-radius: 9999px;
      margin-top: 4px;
    }
    .content {
      padding: 32px;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 12px;
    }
    .description {
      font-size: 14px;
      color: #475569;
      line-height: 1.6;
      margin: 0 0 24px;
    }
    .card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 28px;
    }
    .card-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .card-row:last-child {
      margin-bottom: 0;
    }
    .card-label {
      color: #64748b;
    }
    .card-value {
      font-weight: 600;
      color: #0f172a;
    }
    .button-wrapper {
      text-align: center;
      margin-bottom: 28px;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      font-weight: 600;
      font-size: 14px;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
    }
    .fallback {
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
      word-break: break-all;
      border-top: 1px solid #f1f5f9;
      padding-top: 20px;
    }
    .fallback a {
      color: #2563eb;
    }
    .footer {
      padding: 24px 32px;
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Diagramz</div>
      <div><span class="badge">Team Invitation</span></div>
    </div>
    <div class="content">
      <h2 class="title">Join ${options.workspaceName}</h2>
      <p class="description">
        <strong>${inviterDisplay}</strong> has invited you to collaborate on technical architecture diagrams and specifications in <strong>${options.workspaceName}</strong>.
      </p>

      <div class="card">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td class="card-label" style="padding-bottom: 8px; color: #64748b; font-size: 13px;">Workspace:</td>
            <td class="card-value" style="padding-bottom: 8px; font-weight: 600; color: #0f172a; font-size: 13px; text-align: right;">${options.workspaceName}</td>
          </tr>
          <tr>
            <td class="card-label" style="padding-bottom: 8px; color: #64748b; font-size: 13px;">Your Role:</td>
            <td class="card-value" style="padding-bottom: 8px; font-weight: 600; color: #0f172a; font-size: 13px; text-align: right; text-transform: capitalize;">${options.role}</td>
          </tr>
          <tr>
            <td class="card-label" style="color: #64748b; font-size: 13px;">Invited Email:</td>
            <td class="card-value" style="font-weight: 600; color: #0f172a; font-size: 13px; text-align: right;">${options.to}</td>
          </tr>
        </table>
      </div>

      <div class="button-wrapper">
        <a href="${inviteUrl}" target="_blank" class="button">Accept Invitation</a>
      </div>

      <div class="fallback">
        If the button above doesn't work, copy and paste this link into your browser:<br>
        <a href="${inviteUrl}">${inviteUrl}</a>
      </div>
    </div>
    <div class="footer">
      This invitation was intended for ${options.to}. If you were not expecting this invitation, you can safely ignore this email.
    </div>
  </div>
</body>
</html>
    `;

    if (!this.resend) {
      this.logger.log(`[DRY RUN] Invite email for ${options.to} (${options.role}) to workspace ${options.workspaceName}. Link: ${inviteUrl}`);
      return true;
    }

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: options.to,
        subject,
        html,
      });

      if (result.error) {
        this.logger.warn(`Resend email dispatch error: ${result.error.message}`);
        return false;
      }

      this.logger.log(`Invitation email sent via Resend to ${options.to} (ID: ${result.data?.id})`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send invitation email via Resend to ${options.to}: ${err.message}`, err.stack);
      return false;
    }
  }
}
