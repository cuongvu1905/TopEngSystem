// Company org structure: BOD TOPV (root) -> Team (Team Leader) -> Part (Part Leader)
// -> employees. Depth is derived from department.parent_id rather than matching names,
// so renaming "BOD TOPV" or adding another root never breaks the mapping:
//   depth 0 = root (BOD / standalone depts), depth 1 = Team, depth 2+ = Part.

const MAX_DEPTH_WALK = 20; // guards against a malformed parent cycle

// Projects/boards created before Team/Part scoping existed are stored with
// department_id = ''. A distinct UI sentinel is needed because '' is already the
// combobox's "nothing selected" value; toApiScope() maps it back to '' for the API.
export const UNSCOPED_SCOPE_ID = '__UNSCOPED__';

export function toApiScope(scopeId) {
  return scopeId === UNSCOPED_SCOPE_ID ? '' : (scopeId || '');
}

export function getDepartmentDepth(departments, departmentId) {
  let depth = 0;
  let current = departments.find(d => d.department_id === departmentId);
  if (!current) return -1;
  const seen = new Set([departmentId]);
  while (current && current.parent_id && depth < MAX_DEPTH_WALK) {
    const parent = departments.find(d => d.department_id === current.parent_id);
    if (!parent || seen.has(parent.department_id)) break;
    seen.add(parent.department_id);
    current = parent;
    depth += 1;
  }
  return depth;
}

// The Team a department belongs to: itself when it already is a Team, otherwise its
// depth-1 ancestor. Returns null for a root department (a Team has no Team above it).
export function getOwningTeamId(departments, departmentId) {
  const depth = getDepartmentDepth(departments, departmentId);
  if (depth < 1) return null;
  let current = departments.find(d => d.department_id === departmentId);
  let currentDepth = depth;
  const seen = new Set();
  while (current && currentDepth > 1) {
    if (seen.has(current.department_id)) return null;
    seen.add(current.department_id);
    current = departments.find(d => d.department_id === current.parent_id);
    currentDepth -= 1;
  }
  return current ? current.department_id : null;
}

// Every department at or below departmentId — a Team resolves to itself plus all of its
// Parts, which is what "a Team's board shows all of its Parts' projects" relies on.
export function getScopeDepartmentIds(departments, departmentId) {
  if (departmentId === UNSCOPED_SCOPE_ID) return [''];
  if (!departmentId) return [];
  const ids = [departmentId];
  let frontier = [departmentId];
  let guard = 0;
  while (frontier.length > 0 && guard < MAX_DEPTH_WALK) {
    const children = departments
      .filter(d => d.parent_id && frontier.includes(d.parent_id) && !ids.includes(d.department_id))
      .map(d => d.department_id);
    if (children.length === 0) break;
    ids.push(...children);
    frontier = children;
    guard += 1;
  }
  return ids;
}

// Selectable Team/Part scopes for the current user, ordered Team-then-its-Parts so the
// combobox can render Parts indented under their Team.
// Admin sees every Team and Part; a Team Leader or Part Leader is restricted to the
// single Team subtree they belong to (their own Team plus that Team's Parts).
// includeUnscoped adds the legacy bucket, Admin-only, so pre-scoping rows stay
// reachable and can be reassigned instead of silently disappearing from every view.
export function getAllowedScopes(departments, currentUser, { includeUnscoped = false } = {}) {
  if (!Array.isArray(departments) || departments.length === 0 || !currentUser) return [];

  const role = currentUser.system_role || '';
  const isAdmin = role.includes('Admin');

  const teams = departments
    .filter(d => getDepartmentDepth(departments, d.department_id) === 1)
    .sort((a, b) => a.name.localeCompare(b.name));

  let visibleTeams = teams;
  if (!isAdmin) {
    const ownTeamId = getOwningTeamId(departments, currentUser.department_id);
    visibleTeams = teams.filter(teamRow => teamRow.department_id === ownTeamId);
  }

  const scopes = [];
  visibleTeams.forEach(teamRow => {
    scopes.push({
      department_id: teamRow.department_id,
      name: teamRow.name,
      level: 'team',
      teamId: teamRow.department_id,
      teamName: teamRow.name
    });
    departments
      .filter(d => getOwningTeamId(departments, d.department_id) === teamRow.department_id
        && d.department_id !== teamRow.department_id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(partRow => {
        scopes.push({
          department_id: partRow.department_id,
          name: partRow.name,
          level: 'part',
          teamId: teamRow.department_id,
          teamName: teamRow.name
        });
      });
  });

  if (isAdmin && includeUnscoped) {
    scopes.push({
      department_id: UNSCOPED_SCOPE_ID,
      name: '(Chưa phân Team/Part)',
      level: 'unscoped',
      teamId: null,
      teamName: null
    });
  }

  return scopes;
}
