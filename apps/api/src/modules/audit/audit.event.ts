export class AuditLogEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly userId: string | null,
    public readonly action: string,
    public readonly resourceType: string,
    public readonly resourceId: string,
    public readonly metadata?: Record<string, unknown>,
  ) {}
}
