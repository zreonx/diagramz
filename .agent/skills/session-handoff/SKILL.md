---
name: session-handoff
description: >-
  Use this skill at the conclusion of a feature implementation, bug fix, or
  coding session to update .agent/CHANGELOG.md and .agent/HANDOFF.md.
---

# Session Handoff & Changelog Runbook

Keep the repository's `.agent/` memory accurate so future sessions and collaborators have immediate context.

## Steps

1. **Update `.agent/CHANGELOG.md`**:
   - Add or update the section for today's date (`## [YYYY-MM-DD] — <Summary>`).
   - Group changes under `### Added`, `### Changed`, and `### Fixed`.
   - Include clickable file links to modified components, stores, and services.

2. **Update `.agent/HANDOFF.md`**:
   - Update the `Last Updated` date and verify the test count and build status.
   - Move completed items into **Recently Completed Work**.
   - Refine **Recommended Next Steps (Backlog)** based on the latest project state.

3. **Commit & Push**:
   - Stage `.agent/CHANGELOG.md` and `.agent/HANDOFF.md` alongside code changes so the project memory stays synchronized with git history.
