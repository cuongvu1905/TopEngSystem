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
      { id: 'role-leader', name: 'Leader/Part Leader' },
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

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Thiếu email hoặc mật khẩu' });
    }

    const passwordHash = hashPassword(password);
    const users = await prisma.user.findMany({
      where: {
        email: email,
        password: passwordHash
      }
    });

    if (users.length === 0) {
      return res.status(400).json({ error: 'Email hoặc mật khẩu không chính xác.' });
    }

    const user = users[0];
    res.json({
      session: {
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

    const passwordHash = hashPassword(password);
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
    const { email, password, fullName, roleId, departmentId } = req.body;
    if (!email || !password || !fullName || !roleId) {
      return res.status(400).json({ error: 'Thiếu thông tin đăng ký bắt buộc' });
    }

    const roleMap = {
      'role-admin': 'Quản trị viên (Admin)',
      'role-hr': 'Nhân sự (HR)',
      'role-staff': 'Nhân viên (Staff)',
      'role-leader': 'Leader/Part Leader',
      'role-sales': 'Kinh doanh (Sales)',
      'role-bod': 'Ban điều hành (BOD)',
      'Quản trị viên (Admin)': 'Quản trị viên (Admin)',
      'Nhân sự (HR)': 'Nhân sự (HR)',
      'Nhân viên (Staff)': 'Nhân viên (Staff)',
      'Leader/Part Leader': 'Leader/Part Leader',
      'Kinh doanh (Sales)': 'Kinh doanh (Sales)',
      'Ban điều hành (BOD)': 'Ban điều hành (BOD)'
    };
    const systemRole = roleMap[roleId] || roleId || 'Nhân viên (Staff)';

    const passwordHash = hashPassword(password);
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
        role: systemRole,
        department_id: departmentId || null
      }
    });

    res.json({ success: true });
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
