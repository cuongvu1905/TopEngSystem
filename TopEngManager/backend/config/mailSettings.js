const prisma = require('./prisma');
const { decrypt } = require('../utils/secretBox');

// Where the outgoing-mail account comes from.
//
// An Admin can set it from the settings screen, which puts it in the database; that is
// what lets the sending mailbox be swapped without shell access to the server. Anything
// not configured there falls back to backend/.env, so an existing deployment keeps
// working untouched until somebody actually changes it.
//
// The rule is all-or-nothing rather than field-by-field: a saved row counts only when it
// has both a mailbox and a password. Merging half a row with half an environment is the
// kind of configuration that sends mail from an address nobody chose.

const SETTING_ID = 1;
const DEFAULT_HOST = 'smtp.gmail.com';
const DEFAULT_PORT = 465;

// Other backend processes have their own copy of this cache, so it is deliberately
// short-lived: a change made on one instance reaches the others within the TTL instead of
// waiting for a restart.
const TTL_MS = 30000;
let cache = null;
let cachedAt = 0;

// Port 465 is implicit TLS, 587 is STARTTLS. An explicit choice wins; otherwise it is
// derived from the port, so a wrong combination is never the default.
function secureFor(port, explicit) {
  if (explicit === true || explicit === false) return explicit;
  if (explicit === null || explicit === undefined || explicit === '') return Number(port) === 465;
  return String(explicit).toLowerCase() === 'true';
}

function fromEnv() {
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const port = Number(process.env.SMTP_PORT || DEFAULT_PORT);
  return {
    source: 'env',
    host: String(process.env.SMTP_HOST || DEFAULT_HOST).trim(),
    port,
    secure: secureFor(port, process.env.SMTP_SECURE),
    user,
    pass,
    from: String(process.env.SMTP_FROM || user).trim()
  };
}

async function readRow() {
  try {
    return await prisma.mailsetting.findUnique({ where: { id: SETTING_ID } });
  } catch {
    // The table may not exist yet on a database that has not run the migration.
    return null;
  }
}

async function loadConfig() {
  // Pins this process to backend/.env and ignores whatever an Admin saved. The test
  // suites set it so a sandboxed backend can never reach the real mail server no matter
  // what is in the shared database; on a server it is also the way back in if a saved
  // account is wrong and nobody can log in to fix it.
  if (String(process.env.MAIL_SETTINGS_IGNORE_DB || '').toLowerCase() === 'true') return fromEnv();

  const row = await readRow();
  const user = String(row?.smtp_user || '').trim();
  const pass = decrypt(row?.smtp_pass).replace(/\s+/g, '');
  if (!user || !pass) return fromEnv();

  const port = Number(row.smtp_port || DEFAULT_PORT);
  return {
    source: 'database',
    host: String(row.smtp_host || DEFAULT_HOST).trim(),
    port,
    secure: secureFor(port, row.smtp_secure === null ? null : !!row.smtp_secure),
    user,
    pass,
    from: String(row.smtp_from || user).trim()
  };
}

async function getMailConfig() {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  cache = await loadConfig();
  cachedAt = Date.now();
  return cache;
}

// Called straight after a save so the Admin's next action uses what they just typed
// rather than waiting out the TTL.
function invalidateMailConfig() {
  cache = null;
  cachedAt = 0;
}

module.exports = { getMailConfig, invalidateMailConfig, secureFor, SETTING_ID, DEFAULT_HOST, DEFAULT_PORT };
