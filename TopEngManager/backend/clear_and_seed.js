const fs = require('fs');
const path = require('path');
const db = require('./config/db');

const USERS_TO_SEED = [
  {
    user_id: 'usr-admin',
    full_name: 'Nguyễn Admin',
    email: 'admin@test.com',
    role: 'Quản trị viên (Admin)',
    department_id: 'dept-hr',
    position_id: 'pos-director',
    jandi_link: 'https://jandi.com/connect/admin'
  },
  {
    user_id: 'usr-hr',
    full_name: 'Trần Nhân Sự',
    email: 'hr@test.com',
    role: 'Nhân sự (HR)',
    department_id: 'dept-hr',
    position_id: 'pos-manager',
    jandi_link: 'https://jandi.com/connect/hr'
  },
  {
    user_id: 'usr-staff',
    full_name: 'Lê Nhân Viên',
    email: 'staff@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-dev',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/staff'
  },
  {
    user_id: 'usr-leader',
    full_name: 'Phạm Trưởng Nhóm',
    email: 'leader@test.com',
    role: 'Leader/Part Leader',
    department_id: 'dept-dev',
    position_id: 'pos-lead',
    jandi_link: 'https://jandi.com/connect/leader'
  },
  {
    user_id: 'usr-sales',
    full_name: 'Vũ Kinh Doanh',
    email: 'sales@test.com',
    role: 'Kinh doanh (Sales)',
    department_id: 'dept-sales',
    position_id: 'pos-manager',
    jandi_link: 'https://jandi.com/connect/sales'
  },
  {
    user_id: 'usr-bod',
    full_name: 'Nguyễn Điều Hành',
    email: 'bod@test.com',
    role: 'Ban điều hành (BOD)',
    department_id: 'dept-finance',
    position_id: 'pos-director',
    jandi_link: 'https://jandi.com/connect/bod'
  }
];

const DEPARTMENTS = [
  { department_id: 'dept-dev', name: 'Phòng Phát triển Phần mềm (R&D)' },
  { department_id: 'dept-hr', name: 'Phòng Hành chính Nhân sự (HR)' },
  { department_id: 'dept-sales', name: 'Phòng Kinh doanh (Sales)' },
  { department_id: 'dept-mkt', name: 'Phòng Truyền thông Marketing' },
  { department_id: 'dept-finance', name: 'Phòng Kế toán Tài chính' }
];

const POSITIONS = [
  { position_id: 'pos-intern', position_name: 'Thực tập sinh (Intern)' },
  { position_id: 'pos-staff', position_name: 'Nhân viên chính thức (Staff)' },
  { position_id: 'pos-lead', position_name: 'Trưởng nhóm kỹ thuật (Technical Lead)' },
  { position_id: 'pos-manager', position_name: 'Trưởng phòng (Manager)' },
  { position_id: 'pos-director', position_name: 'Giám đốc bộ phận (Director)' }
];

const TABLES = [
  'activitylogs',
  'chatroommember',
  'chatrooms',
  'customer',
  'dailyreport',
  'department',
  'issue',
  'issuecomments',
  'issuehistory',
  'messages',
  'messagesattachment',
  'notificyations',
  'position',
  'project',
  'projectmember',
  'subtask',
  'task',
  'user'
];

async function main() {
  try {
    console.log('--- STARTING DATABASE RESET & SEEDING ---');

    // 1. Disable Foreign Key Checks
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('Disabled foreign key checks.');

    // 2. Truncate Tables
    for (const table of TABLES) {
      await db.query(`TRUNCATE TABLE \`${table}\``);
      console.log(`Truncated table: ${table}`);
    }

    // 3. Seed Departments
    for (const dept of DEPARTMENTS) {
      await db.query(
        'INSERT INTO `department` (`department_id`, `name`) VALUES (?, ?)',
        [dept.department_id, dept.name]
      );
    }
    console.log('Seeded departments.');

    // 4. Seed Positions
    for (const pos of POSITIONS) {
      await db.query(
        'INSERT INTO `position` (`position_id`, `position_name`) VALUES (?, ?)',
        [pos.position_id, pos.position_name]
      );
    }
    console.log('Seeded positions.');

    // 5. Seed Users
    // Default password '123456' hashes to MD5: 'e10adc3949ba59abbe56e057f20f883e'
    const passwordHash = 'e10adc3949ba59abbe56e057f20f883e';
    for (const user of USERS_TO_SEED) {
      await db.query(
        'INSERT INTO `user` (`user_id`, `department_id`, `position_id`, `full_name`, `email`, `jandi_link`, `password`, `role`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          user.user_id,
          user.department_id,
          user.position_id,
          user.full_name,
          user.email,
          user.jandi_link,
          passwordHash,
          user.role
        ]
      );
      console.log(`Seeded user: ${user.full_name} (${user.role})`);
    }

    // 6. Seed Global ChatRoom
    await db.query(
      'INSERT INTO `chatrooms` (`room_id`, `type`, `room_name`, `project_id`) VALUES (?, ?, ?, ?)',
      ['room-global', 'global', '💬 Kênh thảo luận toàn công ty', null]
    );
    console.log('Seeded global chatroom.');

    // 7. Re-enable Foreign Key Checks
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Re-enabled foreign key checks.');

    console.log('Database successfully reset and seeded!');

    // 8. Generate account_test.md
    generateAccountMarkdown();

  } catch (error) {
    console.error('Error during database reset and seed:', error);
    process.exit(1);
  }
}

function generateAccountMarkdown() {
  const filePath = path.join(__dirname, '../account_test.md');
  const content = `# Danh sách tài khoản kiểm thử hệ thống (TopEng Manager)

Tài liệu này chứa thông tin các tài khoản thử nghiệm tương ứng với từng vai trò/vị trí trong hệ thống sau khi đã làm sạch cơ sở dữ liệu.

## Thông tin đăng nhập chung
- **Mật khẩu mặc định**: \`123456\`
- **Đường dẫn ứng dụng**: \`http://localhost:3000\`

## Danh sách tài khoản

| Họ và tên | Email | Vai trò hệ thống | Phòng ban | Chức vụ |
| :--- | :--- | :--- | :--- | :--- |
| **Nguyễn Admin** | \`admin@test.com\` | \`Quản trị viên (Admin)\` | Phòng Hành chính Nhân sự (HR) | Giám đốc bộ phận (Director) |
| **Trần Nhân Sự** | \`hr@test.com\` | \`Nhân sự (HR)\` | Phòng Hành chính Nhân sự (HR) | Trưởng phòng (Manager) |
| **Lê Nhân Viên** | \`staff@test.com\` | \`Nhân viên (Staff)\` | Phòng Phát triển Phần mềm (R&D) | Nhân viên chính thức (Staff) |
| **Phạm Trưởng Nhóm** | \`leader@test.com\` | \`Leader/Part Leader\` | Phòng Phát triển Phần mềm (R&D) | Trưởng nhóm kỹ thuật (Technical Lead) |
| **Vũ Kinh Doanh** | \`sales@test.com\` | \`Kinh doanh (Sales)\` | Phòng Kinh doanh (Sales) | Trưởng phòng (Manager) |
| **Nguyễn Điều Hành** | \`bod@test.com\` | \`Ban điều hành (BOD)\` | Phòng Kế toán Tài chính | Giám đốc bộ phận (Director) |

---

## Hướng dẫn kiểm thử nhanh
1. Truy cập vào ứng dụng tại [http://localhost:3000](http://localhost:3000)
2. Sử dụng email của tài khoản muốn kiểm thử kèm mật khẩu \`123456\` để đăng nhập.
3. Kiểm tra các chức năng và quyền truy cập đặc thù của vai trò đó (Tham khảo phân quyền trong \`PHAN_QUYEN.md\`).
4. Sử dụng nút đăng xuất nhanh ở góc trên bên phải để chuyển đổi giữa các tài khoản tiện lợi hơn.
`;

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Generated account listing file at: ${filePath}`);
}

main();
