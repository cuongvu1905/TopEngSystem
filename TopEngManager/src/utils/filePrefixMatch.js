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

// The file types the document store accepts. Two components each kept their own copy of
// this list, so adding a type meant editing it in three places and hoping none was missed.
// Must stay in step with ALLOWED_EXTENSIONS in backend/routes/documentRoutes.js, which is
// the gate that actually enforces it.
export const UPLOAD_EXTENSIONS = [
  'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'csv',
  'png', 'jpg', 'jpeg', 'zip', 'rar', 'dwg', 'zw1', 'drawio'
];

// The accept="" value for a file input.
export const UPLOAD_ACCEPT_EXT = UPLOAD_EXTENSIONS.map(e => `.${e}`).join(',');
