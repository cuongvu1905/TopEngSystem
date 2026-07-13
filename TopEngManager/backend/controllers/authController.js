const crypto = require('crypto');
const prisma = require('../config/prisma');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config/roles_permissions.json');

function getRolesPermissionsConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading roles_permissions.json:', err);
  }
  return {
    roles: [
      { id: 'role-admin', name: 'Quản trị viên (Admin)' },
      { id: 'role-hr', name: 'Nhân sự (HR)' },
      { id: 'role-staff', name: 'Nhân viên (Staff)' },
      { id: 'role-teamleader', name: 'Team Leader' },
      { id: 'role-partleader', name: 'Part Leader' },
      { id: 'role-sales', name: 'Kinh doanh (Sales)' },
      { id: 'role-bod', name: 'Ban điều hành (BOD)' }
    ],
    permissions: [],
    role_permissions: {}
  };
}

function hashPassword(password) {
  return crypto.createHash('md5').update(password).digest('hex');
}

function hashPasswordSecurely(password, salt = 'top_eng_manager_secure_salt_key') {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Thiếu email/mã nhân viên hoặc mật khẩu' });
    }

    const inputSecureHash = hashPasswordSecurely(password);
    const inputMd5Hash = hashPassword(password);

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: email },
          { user_id: email }
        ]
      }
    });

    if (users.length === 0) {
      return res.status(400).json({ error: 'Email/Mã nhân viên hoặc mật khẩu không chính xác.' });
    }

    const user = users[0];
    let isPasswordCorrect = false;

    if (user.password === inputSecureHash) {
      isPasswordCorrect = true;
    } else if (user.password === inputMd5Hash) {
      isPasswordCorrect = true;
      // Upgrade hash algorithm to SHA-256 for backward compatibility
      console.log(`Upgrading password hash to SHA-256 for user: ${user.email}`);
      await prisma.user.update({
        where: { user_id: user.user_id },
        data: { password: inputSecureHash }
      });
    }

    if (!isPasswordCorrect) {
      await prisma.activitylogs.create({
        data: {
          user_id: user.user_id,
          action_type: 'LOGIN_FAILURE',
          entity_type: 'User',
          description: `Đăng nhập thất bại: sai mật khẩu cho tài khoản ${email}.`
        }
      });
      return res.status(400).json({ error: 'Email/Mã nhân viên hoặc mật khẩu không chính xác.' });
    }

    // Capture security context for abnormal login checks
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const ua = req.headers['user-agent'] || 'Unknown';

    const oldRows = await prisma.$queryRawUnsafe(
      'SELECT `last_login_ip`, `last_login_ua` FROM `user` WHERE `user_id` = ?',
      user.user_id
    );
    const oldIp = oldRows && oldRows[0] ? oldRows[0].last_login_ip : null;
    const oldUa = oldRows && oldRows[0] ? oldRows[0].last_login_ua : null;

    if (oldIp && oldIp !== ip) {
      await prisma.activitylogs.create({
        data: {
          user_id: user.user_id,
          action_type: 'SECURITY_ALERT',
          entity_type: 'User',
          description: `Cảnh báo bảo mật: Phát hiện đăng nhập từ IP khác thường (IP cũ: ${oldIp}, IP mới: ${ip}).`
        }
      });
    }

    if (oldUa && oldUa !== ua) {
      await prisma.activitylogs.create({
        data: {
          user_id: user.user_id,
          action_type: 'SECURITY_ALERT',
          entity_type: 'User',
          description: `Cảnh báo bảo mật: Phát hiện đăng nhập từ trình duyệt/thiết bị khác thường (Thiết bị cũ: ${oldUa.slice(0, 100)}, Thiết bị mới: ${ua.slice(0, 100)}).`
        }
      });
    }

    // Log successful login
    await prisma.activitylogs.create({
      data: {
        user_id: user.user_id,
        action_type: 'LOGIN_SUCCESS',
        entity_type: 'User',
        description: `Người dùng '${user.full_name}' (${email}) đăng nhập thành công.`
      }
    });

    const sessionToken = crypto.randomBytes(32).toString('hex');
    await prisma.$executeRawUnsafe(
      'UPDATE `user` SET `session_token` = ?, `last_login_ip` = ?, `last_login_ua` = ?, `last_login_at` = CURRENT_TIMESTAMP WHERE `user_id` = ?',
      sessionToken, ip, ua, user.user_id
    );

    res.json({
      session: {
        token: sessionToken,
        user: {
          id: user.user_id,
          email: user.email,
          full_name: user.full_name,
          role_name: user.role || 'Nhân viên (Staff)'
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.signup = async (req, res, next) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Thiếu thông tin đăng ký bắt buộc' });
    }

    const passwordHash = hashPasswordSecurely(password);
    const userId = 'usr-' + Date.now();

    const existing = await prisma.user.findUnique({
      where: { email: email }
    });
    if (existing) {
      return res.status(400).json({ error: 'Email đã được đăng ký bởi tài khoản khác.' });
    }

    await prisma.user.create({
      data: {
        user_id: userId,
        full_name: fullName,
        email: email,
        password: passwordHash,
        role: 'Nhân viên (Staff)'
      }
    });

    res.json({
      user: {
        id: userId,
        email,
        full_name: fullName
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const dbUsers = await prisma.user.findMany({
      include: {
        department: true
      }
    });
    const users = dbUsers.map(u => ({
      id: u.user_id,
      name: u.full_name,
      email: u.email,
      system_role: u.role,
      department_id: u.department_id,
      department_name: u.department ? u.department.name : 'Chưa phân phòng',
      color: '#1E40AF'
    }));
    res.json(users);
  } catch (err) {
    next(err);
  }
};

exports.getRoles = async (req, res, next) => {
  try {
    const config = getRolesPermissionsConfig();
    res.json(config.roles);
  } catch (err) {
    next(err);
  }
};

exports.getRolesPermissions = async (req, res, next) => {
  try {
    const config = getRolesPermissionsConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
};

exports.saveRolesPermissions = async (req, res, next) => {
  try {
    const { roles, role_permissions } = req.body;
    if (!roles || !role_permissions) {
      return res.status(400).json({ error: 'Thiếu thông tin phân quyền cần lưu' });
    }

    const config = getRolesPermissionsConfig();
    config.roles = roles;
    config.role_permissions = role_permissions;

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { email, password, fullName, roleId, departmentId, employeeId } = req.body;
    if (!email || !password || !fullName || !roleId) {
      return res.status(400).json({ error: 'Thiếu thông tin đăng ký bắt buộc' });
    }

    const roleMap = {
      'role-admin': 'Quản trị viên (Admin)',
      'role-hr': 'Nhân sự (HR)',
      'role-staff': 'Nhân viên (Staff)',
      'role-teamleader': 'Team Leader',
      'role-partleader': 'Part Leader',
      'role-sales': 'Kinh doanh (Sales)',
      'role-bod': 'Ban điều hành (BOD)',
      'Quản trị viên (Admin)': 'Quản trị viên (Admin)',
      'Nhân sự (HR)': 'Nhân sự (HR)',
      'Nhân viên (Staff)': 'Nhân viên (Staff)',
      'Team Leader': 'Team Leader',
      'Part Leader': 'Part Leader',
      'Kinh doanh (Sales)': 'Kinh doanh (Sales)',
      'Ban điều hành (BOD)': 'Ban điều hành (BOD)'
    };
    const systemRole = roleMap[roleId] || roleId || 'Nhân viên (Staff)';

    const passwordHash = hashPasswordSecurely(password);
    const userId = (employeeId && employeeId.trim()) || ('usr-' + Date.now());

    if (employeeId && employeeId.trim()) {
      const existingUserById = await prisma.user.findUnique({
        where: { user_id: employeeId.trim() }
      });
      if (existingUserById) {
        return res.status(400).json({ error: 'Mã nhân viên đã tồn tại.' });
      }
    }

    const existing = await prisma.user.findUnique({
      where: { email: email }
    });
    if (existing) {
      return res.status(400).json({ error: 'Email đã được đăng ký bởi tài khoản khác.' });
    }

    await prisma.user.create({
      data: {
        user_id: userId,
        full_name: fullName,
        email: email,
        password: passwordHash,
        role: systemRole,
        department_id: departmentId || null
      }
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Thiếu thông tin yêu cầu đổi mật khẩu.' });
    }

    const user = await prisma.user.findUnique({
      where: { user_id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại.' });
    }

    const currentSecureHash = hashPasswordSecurely(currentPassword);
    const currentMd5Hash = hashPassword(currentPassword);

    let isPasswordCorrect = false;
    if (user.password === currentSecureHash || user.password === currentMd5Hash) {
      isPasswordCorrect = true;
    }

    if (!isPasswordCorrect) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác.' });
    }

    const newHash = hashPasswordSecurely(newPassword);
    await prisma.user.update({
      where: { user_id: userId },
      data: { password: newHash }
    });

    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    next(err);
  }
};

exports.resetUserPassword = async (req, res, next) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'Thiếu thông tin đặt lại mật khẩu.' });
    }

    const passwordHash = hashPasswordSecurely(newPassword);
    await prisma.user.update({
      where: { user_id: userId },
      data: { password: passwordHash }
    });

    res.json({ success: true, message: 'Đặt lại mật khẩu thành công!' });
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'Thiếu mã nhân viên cần xóa.' });
    }

    await prisma.user.delete({
      where: { user_id: userId }
    });

    res.json({ success: true, message: 'Xóa tài khoản thành công!' });
  } catch (err) {
    next(err);
  }
};

exports.checkSession = async (req, res, next) => {
  try {
    const { userId, token } = req.body;
    if (!userId || !token) {
      return res.json({ valid: false });
    }

    const rows = await prisma.$queryRawUnsafe(
      'SELECT `session_token` FROM `user` WHERE `user_id` = ?',
      userId
    );

    if (!rows || rows.length === 0) {
      return res.json({ valid: false });
    }

    const dbToken = rows[0].session_token;
    if (dbToken !== token) {
      return res.json({ valid: false, reason: 'Tài khoản của bạn đã được đăng nhập từ một thiết bị khác.' });
    }

    res.json({ valid: true });
  } catch (err) {
    next(err);
  }
};

exports.testConnection = async (req, res, next) => {
  try {
    const result = await prisma.$queryRaw`SELECT 1 + 1 as val`;
    if (result && result.length > 0) {
      res.json({ success: true, message: 'Kết nối cơ sở dữ liệu MySQL thành công qua Prisma!' });
    } else {
      res.status(500).json({ error: 'Không thể truy vấn cơ sở dữ liệu qua Prisma.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Kết nối thất bại: ' + err.message });
  }
};

exports.updateUserRoleAndDept = async (req, res, next) => {
  try {
    const { userId, role, departmentId, fullName, email } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'Thiếu mã nhân viên cần cập nhật.' });
    }

    const updateData = {};
    if (role !== undefined) {
      updateData.role = role;
    }
    if (departmentId !== undefined) {
      updateData.department_id = departmentId || null;
    }
    if (fullName !== undefined) {
      updateData.full_name = fullName;
    }
    if (email !== undefined) {
      updateData.email = email;
    }

    await prisma.user.update({
      where: { user_id: userId },
      data: updateData
    });

    res.json({ success: true, message: 'Cập nhật thông tin nhân sự thành công!' });
  } catch (err) {
    next(err);
  }
};
