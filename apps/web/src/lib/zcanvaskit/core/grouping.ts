import type { ZCanvasBox, ZCanvasNode } from './schema';

/**
 * Groups, as the canvas understands them.
 *
 * A group is not an element. Nothing is drawn for one, nothing is added to the
 * document, and nothing is written to the file that a reader would have to
 * interpret — grouping two cards leaves a document that is still exactly those
 * two cards. The members simply name the group they belong to in `groupIds`,
 * and the editor draws a frame around a group for as long as one of its members
 * is selected.
 *
 * That is deliberate. An earlier version gave every group a container node to
 * belong to, which meant that grouping quietly *created* a component: it came
 * back as a boundary indistinguishable from the VPC beside it, it survived into
 * every export, and ungrouping had to guess whether the box it found was one it
 * had made or one the user had drawn. A name cannot be mistaken for either.
 *
 * `groupIds` runs innermost first. Grouping a group together with something
 * else therefore appends a wider id instead of replacing the inner one, and
 * ungrouping pops the outermost and leaves the inner group intact.
 */

/** The groups a node belongs to, or an empty list when it belongs to none. */
export function groupIdsOf(node: ZCanvasNode): string[] {
  return node.groupIds ?? [];
}

/**
 * Returns the active group id that governs `node` given the currently entered
 * group (`enteredGroupId`), or `null` if `node` is ungrouped or already drilled
 * down to its innermost level.
 *
 * Since `groupIds` is ordered innermost-first (`['inner', 'outer']`):
 * - When `enteredGroupId` is `null`, the governing group is the outermost one
 *   (`groups[groups.length - 1]`).
 * - When `enteredGroupId` is active and `node` belongs to it at `idx`, any
 *   group at `>= idx` has been entered, so the governing child group is
 *   `idx > 0 ? groups[idx - 1] : null`.
 */
export function activeGroupIdOf(
  node: ZCanvasNode,
  enteredGroupId: string | null = null
): string | null {
  const groups = groupIdsOf(node);
  if (groups.length === 0) return null;
  if (!enteredGroupId) return groups[groups.length - 1] ?? null;

  const idx = groups.indexOf(enteredGroupId);
  if (idx === -1) return groups[groups.length - 1] ?? null;
  return idx > 0 ? groups[idx - 1] ?? null : null;
}

/**
 * Expands `ids` to whole groups while respecting the currently entered group
 * (`enteredGroupId`).
 *
 * In Draw.io, single-clicking a grouped node selects the whole group, whereas
 * double-clicking drills into that group (`enteredGroupId`). Once inside
 * `enteredGroupId`, clicking a direct member selects only that member (or its
 * inner sub-group if nested).
 */
export function expandSelectionInContext(
  nodes: ZCanvasNode[],
  ids: string[],
  enteredGroupId: string | null = null
): string[] {
  if (!enteredGroupId) return expandSelection(nodes, ids);
  if (ids.length === 0) return [];

  const effectiveGroupsOf = (node: ZCanvasNode): string[] => {
    const groups = groupIdsOf(node);
    const idx = groups.indexOf(enteredGroupId);
    if (idx === -1) return groups;
    return groups.slice(0, idx);
  };

  const selected = new Set(ids);
  const reached = new Set<string>();

  for (let grew = true; grew; ) {
    grew = false;

    for (const node of nodes) {
      if (selected.has(node.id)) continue;
      if (!effectiveGroupsOf(node).some((group) => reached.has(group))) continue;
      selected.add(node.id);
      grew = true;
    }

    for (const node of nodes) {
      if (!selected.has(node.id)) continue;
      for (const group of effectiveGroupsOf(node)) {
        if (reached.has(group)) continue;
        reached.add(group);
        grew = true;
      }
    }
  }

  return nodes.filter((node) => selected.has(node.id)).map((node) => node.id);
}

/**
 * Scales all nodes in `originNodes` proportionally from `oldBox` into `newBox`.
 * Used when dragging the 8 resize handles on a Group Frame or Multi-Selection box.
 */
export function scaleNodesInBox(
  nodes: ZCanvasNode[],
  originNodes: ReadonlyMap<string, ZCanvasNode>,
  oldBox: ZCanvasBox,
  newBox: ZCanvasBox
): ZCanvasNode[] {
  if (oldBox.width <= 0 || oldBox.height <= 0) return nodes;
  const scaleX = newBox.width / oldBox.width;
  const scaleY = newBox.height / oldBox.height;

  return nodes.map((node) => {
    const origin = originNodes.get(node.id);
    if (!origin) return node;

    const relX = origin.x - oldBox.x;
    const relY = origin.y - oldBox.y;
    const nextX = Math.round(newBox.x + relX * scaleX);
    const nextY = Math.round(newBox.y + relY * scaleY);
    const nextWidth = Math.max(24, Math.round(origin.width * scaleX));
    const nextHeight = Math.max(24, Math.round(origin.height * scaleY));

    return {
      ...node,
      x: nextX,
      y: nextY,
      width: nextWidth,
      height: nextHeight,
    };
  });
}

/**
 * A name no other group in this document is using.
 *
 * `existing` is how a caller that mints several names in one gesture keeps them
 * apart. The timestamp cannot: pasting a diagram of fifty groups mints fifty
 * names inside a single millisecond, and two of them drawing the same four
 * random characters would silently merge two unrelated groups into one.
 */
export function createGroupId(existing?: ReadonlySet<string>): string {
  let candidate: string;
  do {
    candidate = `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  } while (existing?.has(candidate));
  return candidate;
}

/**
 * The selection widened to whole groups.
 *
 * Picking any member picks the group it belongs to, and that applies to every
 * group it is a member of, so a node in two nested groups brings in both. The
 * result is in document order and without duplicates, and ids that name nothing
 * are dropped rather than passed through.
 */
export function expandSelection(nodes: ZCanvasNode[], ids: string[]): string[] {
  if (ids.length === 0) return [];

  const selected = new Set(ids);
  const reached = new Set<string>();

  // Each pass can reveal a node (through a group already reached) which can in
  // turn reveal the next group up the nesting; stop when a pass adds nothing.
  for (let grew = true; grew; ) {
    grew = false;

    for (const node of nodes) {
      if (selected.has(node.id)) continue;
      if (!groupIdsOf(node).some((group) => reached.has(group))) continue;
      selected.add(node.id);
      grew = true;
    }

    for (const node of nodes) {
      if (!selected.has(node.id)) continue;
      for (const group of groupIdsOf(node)) {
        if (reached.has(group)) continue;
        reached.add(group);
        grew = true;
      }
    }
  }

  return nodes.filter((node) => selected.has(node.id)).map((node) => node.id);
}

/**
 * Gives the selection one new group to belong to.
 *
 * The selection is widened to whole groups first, so grouping a single member
 * of an existing group groups that group rather than tearing one element out of
 * it. Two elements are the fewest that can be a group; with fewer than that the
 * nodes come back untouched, identity and all, so a caller can tell that
 * nothing happened.
 */
export function groupNodes(
  nodes: ZCanvasNode[],
  ids: string[],
  groupId: string = createGroupId()
): ZCanvasNode[] {
  const members = new Set(expandSelection(nodes, ids));
  if (members.size < 2) return nodes;

  return nodes.map((node) =>
    members.has(node.id) ? { ...node, groupIds: [...groupIdsOf(node), groupId] } : node
  );
}

/**
 * Releases the selection from the outermost group it is in.
 *
 * One level at a time, so ungrouping twice in a row takes a nested group apart
 * from the outside in and each step is its own undo. Nodes that were in no
 * group are left exactly as they were, and a selection with nothing to release
 * comes back untouched.
 */
export function ungroupNodes(nodes: ZCanvasNode[], ids: string[]): ZCanvasNode[] {
  const members = new Set(expandSelection(nodes, ids));
  const grouped = nodes.some((node) => members.has(node.id) && groupIdsOf(node).length > 0);
  if (!grouped) return nodes;

  return nodes.map((node) => {
    const groups = groupIdsOf(node);
    if (!members.has(node.id) || groups.length === 0) return node;

    const rest = groups.slice(0, -1);
    if (rest.length > 0) return { ...node, groupIds: rest };

    const released = { ...node };
    delete released.groupIds;
    return released;
  });
}

/**
 * Drops group names that no longer cover two elements.
 *
 * Deleting one of a pair leaves the survivor naming a group of one, which is
 * not a group — it would draw a frame around a single element and take up room
 * in the file forever. Called after a deletion so a document does not collect
 * them.
 */
export function pruneGroups(nodes: ZCanvasNode[]): ZCanvasNode[] {
  const sizes = new Map<string, number>();
  for (const node of nodes) {
    for (const group of groupIdsOf(node)) {
      sizes.set(group, (sizes.get(group) ?? 0) + 1);
    }
  }

  const standing = (group: string) => (sizes.get(group) ?? 0) >= 2;
  if (nodes.every((node) => groupIdsOf(node).every(standing))) return nodes;

  return nodes.map((node) => {
    const groups = groupIdsOf(node);
    if (groups.every(standing)) return node;

    const rest = groups.filter(standing);
    if (rest.length > 0) return { ...node, groupIds: rest };

    const pruned = { ...node };
    delete pruned.groupIds;
    return pruned;
  });
}

/** How far a group's frame stands off the elements it encloses. */
export const GROUP_FRAME_PADDING = 8;

export interface ZCanvasGroupFrame {
  /** The group this frame describes. */
  id: string;
  box: ZCanvasBox;
}

/**
 * The frames to draw for the current selection: one per group it touches.
 *
 * Each frame is measured over *every* member of its group, not only the
 * selected ones, so it stays where it is while a single element is picked out
 * of the group on its own. Groups that nobody is a member of any more — a
 * survivor of a deletion, before {@link pruneGroups} has run — draw nothing.
 */
export function groupFrames(nodes: ZCanvasNode[], ids: string[]): ZCanvasGroupFrame[] {
  const selected = new Set(ids);
  const touched = new Set<string>();
  for (const node of nodes) {
    if (!selected.has(node.id)) continue;
    for (const group of groupIdsOf(node)) touched.add(group);
  }

  const frames: ZCanvasGroupFrame[] = [];
  for (const group of touched) {
    const members = nodes.filter((node) => groupIdsOf(node).includes(group));
    if (members.length < 2) continue;
    frames.push({ id: group, box: paddedBounds(members, GROUP_FRAME_PADDING) });
  }
  return frames;
}

/** Whether any of these nodes belongs to a group. */
export function isGrouped(nodes: ZCanvasNode[], ids: string[]): boolean {
  const wanted = new Set(ids);
  return nodes.some((node) => wanted.has(node.id) && groupIdsOf(node).length > 0);
}

/**
 * Whether grouping these nodes would do anything.
 *
 * Grouping takes whole groups, so a single member of a group is enough to have
 * a group to make; otherwise it takes two elements.
 */
export function canGroup(nodes: ZCanvasNode[], ids: string[]): boolean {
  if (ids.length === 0) return false;
  if (isGrouped(nodes, ids)) return true;
  return expandSelection(nodes, ids).length >= 2;
}

/**
 * Removes the frames older documents carry as elements.
 *
 * Grouping used to give the selection a container node of its own. Documents
 * written then still hold one, so ungrouping sweeps up the boxes that gesture
 * left behind: a box is only removed once it holds nothing, which means a
 * boundary the user drew by hand — and filled — is never touched.
 */
export function pruneEmptyGroupBoxes(nodes: ZCanvasNode[]): ZCanvasNode[] {
  const held = new Set(
    nodes.map((node) => node.parentId).filter((id): id is string => Boolean(id))
  );
  const keep = (node: ZCanvasNode) => node.data?.groupBox !== true || held.has(node.id);
  if (nodes.every(keep)) return nodes;
  return nodes.filter(keep);
}

function paddedBounds(nodes: ZCanvasNode[], padding: number): ZCanvasBox {
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}
