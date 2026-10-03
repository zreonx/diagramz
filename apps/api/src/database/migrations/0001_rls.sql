ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagrams ENABLE ROW LEVEL SECURITY;

-- Workspaces: Read if member
CREATE POLICY workspace_member_read ON workspaces
  FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

-- Workspaces: Update/Delete if owner
CREATE POLICY workspace_owner_write ON workspaces
  FOR ALL
  USING (
    owner_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
  );

-- Diagrams: Read if public OR if user belongs to parent workspace
CREATE POLICY diagram_access_policy ON diagrams
  FOR SELECT
  USING (
    is_public = true OR
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );
