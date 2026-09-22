const crypto = require('crypto');

// Small helper for the handful of secrets the app has to store and read back again -
// currently just the outgoing-mail password an Admin types into the settings screen.
//
// A password that has to be handed to an SMTP server cannot be hashed: the server needs
// the original. So it is encrypted instead, with AES-256-GCM. That does not make a
// stolen backup harmless if the attacker also has the source and the environment, but a
// leaked database dump on its own - by far the most common way these get out - yields
// nothing readable.
//
// The key comes from SETTINGS_SECRET when it is set. Deployments that never set one fall
// back to the salt the password hashing already uses, so the feature works out of the box
// rather than silently storing plaintext.

const KEY_INFO = 'topeng-mail-settings';
const FALLBACK_SECRET = 'top_eng_manager_secure_salt_key';
const PREFIX = 'v1';

function key() {
  const secret = process.env.SETTINGS_SECRET || FALLBACK_SECRET;
  return crypto.scryptSync(secret, KEY_INFO, 32);
}

function encrypt(plain) {
  const value = String(plain ?? '');
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

// Returns '' rather than throwing when the stored value cannot be read: a settings row
// written under a different SETTINGS_SECRET should present as "no password saved", which
// an Admin can fix by typing it again, not as a crash on every send.
function decrypt(stored) {
  const value = String(stored ?? '');
  if (!value) return '';
  const parts = value.split(':');
  if (parts.length !== 4 || parts[0] !== PREFIX) return '';
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(parts[1], 'base64'));
    decipher.setAuthTag(Buffer.from(parts[2], 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

module.exports = { encrypt, decrypt };
