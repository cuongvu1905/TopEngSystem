const crypto = require('crypto');
const { query } = require('../config/db');

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
    const users = await query(
      `SELECT u.* 
       FROM User u 
       WHERE u.email = ? AND u.password = ?`,
      [email, passwordHash]
    );

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

    const existing = await query('SELECT user_id FROM User WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email đã được đăng ký bởi tài khoản khác.' });
    }

    await query(
      'INSERT INTO User (user_id, full_name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [userId, fullName, email, passwordHash, 'Nhân viên (Staff)']
    );

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
    const users = await query(
      `SELECT u.user_id as id, u.full_name as name, u.email, u.role as system_role, u.department_id, '#1E40AF' as color 
       FROM User u`
    );
    res.json(users);
  } catch (err) {
    next(err);
  }
};

exports.getRoles = async (req, res, next) => {
  try {
    res.json([
      { id: 'role-admin', name: 'Quản trị viên (Admin)' },
      { id: 'role-hr', name: 'Nhân sự (HR)' },
      { id: 'role-staff', name: 'Nhân viên (Staff)' },
      { id: 'role-leader', name: 'Leader/Part Leader' },
      { id: 'role-sales', name: 'Kinh doanh (Sales)' },
      { id: 'role-bod', name: 'Ban điều hành (BOD)' }
    ]);
  } catch (err) {
    next(err);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { email, password, fullName, roleId } = req.body;
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

    const existing = await query('SELECT user_id FROM User WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email đã được đăng ký bởi tài khoản khác.' });
    }

    await query(
      'INSERT INTO User (user_id, full_name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [userId, fullName, email, passwordHash, systemRole]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.testConnection = async (req, res, next) => {
  try {
    const result = await query('SELECT 1 + 1 as val');
    if (result && result.length > 0) {
      res.json({ success: true, message: 'Kết nối cơ sở dữ liệu MySQL thành công!' });
    } else {
      res.status(500).json({ error: 'Không thể truy vấn cơ sở dữ liệu.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Kết nối thất bại: ' + err.message });
  }
};
