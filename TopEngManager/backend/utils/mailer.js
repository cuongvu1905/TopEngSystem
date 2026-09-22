const nodemailer = require('nodemailer');
const { getMailConfig } = require('../config/mailSettings');

// Outgoing mail for the app. Only the transport lives here; what a particular email says
// belongs to the feature that sends it, and where the account comes from belongs to
// config/mailSettings.js (an Admin's saved settings, else backend/.env).
//
// Gmail note: since May 2022 Google refuses SMTP logins that use the account's own
// password. The value has to be a 16-character App Password, generated at
// myaccount.google.com/apppasswords on an account that has 2-step verification on.
// Google prints it in four spaced groups; the spaces are presentation only, so they are
// stripped rather than being a login failure nobody can explain.

// A hanging SMTP handshake must not become a hanging HTTP request: the caller is waiting
// to hear whether their meeting was booked.
const TIMEOUTS = {
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000
};

let cachedTransport = null;
let cachedKey = '';

function buildTransport(cfg) {
  // Rebuild only when something actually changed, so a corrected password takes effect on
  // the next send rather than after a restart.
  const key = [cfg.host, cfg.port, cfg.secure, cfg.user, cfg.pass].join('|');
  if (!cachedTransport || cachedKey !== key) {
    cachedTransport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      ...TIMEOUTS
    });
    cachedKey = key;
  }
  return cachedTransport;
}

// A throwaway transport for "does this account work?", built from values that have not
// been saved yet. Never cached: it must not displace the live one.
function oneOffTransport(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    ...TIMEOUTS
  });
}

// Whether outgoing mail can be attempted at all. Callers use this to tell the user
// "nobody was emailed because mail is not configured" instead of failing silently.
async function isMailConfigured() {
  const cfg = await getMailConfig();
  return !!(cfg.user && cfg.pass);
}

// Logs in and hangs up. Sends nothing - it is what the settings screen's "test" button
// runs, and an Admin checking a mailbox should not put a message in anyone's inbox.
async function verifyMail(override) {
  const cfg = override || await getMailConfig();
  if (!cfg.user || !cfg.pass) {
    throw new Error('Chưa cấu hình tài khoản gửi mail (thiếu địa chỉ hoặc mật khẩu).');
  }
  await oneOffTransport(cfg).verify();
  return { ok: true, user: cfg.user, host: cfg.host, port: cfg.port };
}

// Sends one message. Throws on failure; the caller decides whether that failure should
// take the surrounding operation down with it (for a meeting booking, it should not).
async function sendMail({ to, subject, text, html, fromName }) {
  const cfg = await getMailConfig();
  if (!cfg.user || !cfg.pass) {
    throw new Error('Chưa cấu hình tài khoản gửi mail (SMTP_USER / SMTP_PASS).');
  }
  const recipients = (Array.isArray(to) ? to : [to])
    .map(addr => String(addr || '').trim())
    .filter(Boolean);
  if (recipients.length === 0) {
    throw new Error('Không có địa chỉ nhận mail.');
  }

  const sender = cfg.from || cfg.user;
  const from = fromName ? `"${fromName}" <${sender}>` : sender;
  const info = await buildTransport(cfg).sendMail({
    from,
    to: recipients.join(', '),
    subject,
    text,
    html
  });
  return { messageId: info.messageId, accepted: info.accepted || [], rejected: info.rejected || [] };
}

module.exports = { sendMail, isMailConfigured, verifyMail };
