// A required prefix may be written like "1.[BOM LIST]" or just "[CONCEPT]" — only the
// bracketed token itself is enforced; up to this many arbitrary characters (e.g. a
// running number like "00001.") are allowed before it in the string being checked.
// Mirrors the identical logic in backend/controllers/documentController.js.
const PREFIX_LEADING_SLACK = 6;

function extractPrefixToken(prefix) {
  const match = prefix && prefix.match(/\[[^\]]*\]/);
  return match ? match[0] : null;
}

export function matchesRequiredPrefix(value, requiredPrefix) {
  if (!requiredPrefix) return true;
  if (!value) return false;
  const token = extractPrefixToken(requiredPrefix);
  if (!token) return value.startsWith(requiredPrefix);
  const idx = value.indexOf(token);
  return idx !== -1 && idx <= PREFIX_LEADING_SLACK;
}

// A folder's allowed-extensions setting is a semicolon-separated list, e.g. "pdf;xlsx;pptx".
export function parseAllowedExtensions(allowedExtensions) {
  if (!allowedExtensions) return [];
  return allowedExtensions.split(';').map(e => e.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
}

export function matchesAllowedExtensions(filename, allowedExtensions) {
  const list = parseAllowedExtensions(allowedExtensions);
  if (list.length === 0) return true;
  const ext = (filename.split('.').pop() || '').toLowerCase();
  return list.includes(ext);
}
