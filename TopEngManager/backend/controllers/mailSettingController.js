const prisma = require('../config/prisma');
const { encrypt } = require('../utils/secretBox');
const { getMailConfig, invalidateMailConfig, secureFor, getManagerEmails, saveManagerEmails, SETTING_ID, DEFAULT_HOST, DEFAULT_PORT } = require('../config/mailSettings');
const { verifyMail } = require('../utils/mailer');

// The mailbox the system sends from. Admin-only: whoever controls this address sends mail
// in the company's name, so it is the same level of trust as handing out the Admin role.
// Checked against the requester's own user row, never against a role passed in the body.

async function isRequesterAdmin(requesterId) {
  if (!requesterId) return false;
  const requester = await prisma.user.findUnique({
    where: { user_id: requesterId },
    select: { role: true }
  });
  return !!(requester && requester.role && requester.role.includes('Admin'));
}

async function requireAdmin(req, res) {
  const requesterId = (req.body || {}).requesterId;
  if (!(await isRequesterAdmin(requesterId))) {
    res.status(403).json({ error: 'Chỉ tài khoản Admin mới được xem hoặc thay đổi cấu hình email.' });
    return false;
  }
  return true;
}

function savedRow() {
  return prisma.mailsetting.findUnique({ where: { id: SETTING_ID } });
}

// The password is never sent back to the browser - only whether one is stored. There is no
// reason for a configured secret to travel back out over the network.
exports.getMailSettings = async (req, res, next) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const cfg = await getMailConfig();
    const row = await savedRow();

    let updatedByName = null;
    if (row && row.updated_by) {
      const who = await prisma.user.findUnique({
        where: { user_id: row.updated_by },
        select: { full_name: true }
      });
      updatedByName = who ? who.full_name : row.updated_by;
    }

    const managerEmails = getManagerEmails();

    res.json({
      source: cfg.source,               // 'database' = an Admin set it, 'env' = backend/.env
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      user: cfg.user,
      from: cfg.from,
      hasPassword: !!cfg.pass,
      updatedAt: row ? row.updated_at : null,
      updatedByName,
      managerEmails
    });
  } catch (err) {
    next(err);
  }
};

// Builds the configuration a test or a save should use, folding in whatever the Admin
// typed on top of the account currently in force - which may come from backend/.env and
// not from a saved row at all. Basing this on the saved row alone was a real bug: opening
// the tab on an .env-configured system and pressing "test" tested nothing.
//
// A blank password means "keep the one in force": the form cannot show the existing
// password, so it cannot send it back either.
async function resolveCandidate(body) {
  const current = await getMailConfig();

  const user = String(body.user ?? current.user ?? '').trim();
  const typedPass = String(body.password ?? '').replace(/\s+/g, '');
  const sameMailbox = !!user && user === current.user;

  // Reusing one mailbox's password against another would test something nobody asked for,
  // and could pass or fail for reasons unrelated to what was typed.
  if (!typedPass && user && current.user && !sameMailbox) {
    const err = new Error('Bạn đã đổi địa chỉ gửi, vui lòng nhập mật khẩu ứng dụng của địa chỉ mới.');
    err.status = 400;
    throw err;
  }
  const pass = typedPass || (sameMailbox ? current.pass : '');

  const host = String(body.host ?? current.host ?? DEFAULT_HOST).trim() || DEFAULT_HOST;
  const port = Number(body.port ?? current.port ?? DEFAULT_PORT) || DEFAULT_PORT;
  // Keep an explicit choice; keep the mode in force while the port is unchanged; otherwise
  // derive it from the new port, so 465 and 587 are never paired with the wrong mode.
  const secure = body.secure === undefined
    ? (port === current.port ? current.secure : secureFor(port, null))
    : secureFor(port, body.secure);
  const from = String(body.from ?? current.from ?? '').trim() || user;

  return { host, port, secure, user, pass, from };
}

// Logs in and hangs up: nothing is sent, so testing an account never puts a message in
// anybody's inbox. Runs against what is on screen, before it is saved.
exports.testMailSettings = async (req, res, next) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    let candidate;
    try {
      candidate = await resolveCandidate(req.body || {});
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
    if (!candidate.user || !candidate.pass) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ địa chỉ gửi và mật khẩu ứng dụng.' });
    }
    try {
      const result = await verifyMail(candidate);
      res.json({ ok: true, user: result.user, host: result.host, port: result.port });
    } catch (err) {
      // A rejected login is an answer, not a server fault: report it as one so the Admin
      // sees what the mail server actually said.
      res.json({ ok: false, error: String(err.message || err).split('\n')[0], code: err.code || null });
    }
  } catch (err) {
    next(err);
  }
};

exports.updateMailSettings = async (req, res, next) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const body = req.body || {};

    // Explicitly handing the configuration back to backend/.env, rather than leaving a
    // half-filled row behind that would quietly keep overriding it.
    if (body.clear === true) {
      await prisma.mailsetting.deleteMany({ where: { id: SETTING_ID } });
      saveManagerEmails([]);
      invalidateMailConfig();
      const cfg = await getMailConfig();
      return res.json({ success: true, source: cfg.source, user: cfg.user, hasPassword: !!cfg.pass, managerEmails: [] });
    }

    let candidate;
    try {
      candidate = await resolveCandidate(body);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
    if (!candidate.user) {
      return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email dùng để gửi.' });
    }
    if (!candidate.pass) {
      return res.status(400).json({ error: 'Vui lòng nhập mật khẩu ứng dụng cho địa chỉ gửi.' });
    }

    const data = {
      smtp_host: candidate.host,
      smtp_port: candidate.port,
      smtp_secure: candidate.secure,
      smtp_user: candidate.user,
      smtp_pass: encrypt(candidate.pass),
      smtp_from: candidate.from,
      updated_by: body.requesterId || null,
      updated_at: new Date()
    };
    await prisma.mailsetting.upsert({
      where: { id: SETTING_ID },
      create: { id: SETTING_ID, ...data },
      update: data
    });

    let savedManagerEmails = getManagerEmails();
    if (body.managerEmails !== undefined) {
      savedManagerEmails = saveManagerEmails(body.managerEmails);
    }

    // So the very next send uses what was just typed instead of waiting out the cache.
    invalidateMailConfig();
    const cfg = await getMailConfig();
    res.json({ success: true, source: cfg.source, user: cfg.user, hasPassword: !!cfg.pass, managerEmails: savedManagerEmails });
  } catch (err) {
    next(err);
  }
};
