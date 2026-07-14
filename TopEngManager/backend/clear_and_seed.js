const fs = require('fs');
const path = require('path');
const db = require('./config/db');

const USERS_TO_SEED = [
  // 6 existing core users (unchanged as requested)
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
    role: 'Team Leader',
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
  },
  // 24 new users to reach 30 users
  {
    user_id: 'usr-user07',
    full_name: 'Hoàng Phát Triển',
    email: 'developer1@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-dev',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/developer1'
  },
  {
    user_id: 'usr-user08',
    full_name: 'Ngô Lập Trình',
    email: 'developer2@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-dev',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/developer2'
  },
  {
    user_id: 'usr-user09',
    full_name: 'Bùi Mã Nguồn',
    email: 'developer3@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-dev',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/developer3'
  },
  {
    user_id: 'usr-user10',
    full_name: 'Đỗ Công Nghệ',
    email: 'developer4@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-dev',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/developer4'
  },
  {
    user_id: 'usr-user11',
    full_name: 'Phan Kiểm Thử',
    email: 'tester1@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-dev',
    position_id: 'pos-intern',
    jandi_link: 'https://jandi.com/connect/tester1'
  },
  {
    user_id: 'usr-user12',
    full_name: 'Vũ Đảm Bảo',
    email: 'qa1@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-dev',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/qa1'
  },
  {
    user_id: 'usr-user13',
    full_name: 'Lý Thiết Kế',
    email: 'designer1@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-dev',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/designer1'
  },
  {
    user_id: 'usr-user14',
    full_name: 'Nguyễn Tuyển Dụng',
    email: 'recruiter1@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-hr',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/recruiter1'
  },
  {
    user_id: 'usr-user15',
    full_name: 'Trần Đào Tạo',
    email: 'trainer1@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-hr',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/trainer1'
  },
  {
    user_id: 'usr-user16',
    full_name: 'Lê Tiếp Thị',
    email: 'marketer1@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-mkt',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/marketer1'
  },
  {
    user_id: 'usr-user17',
    full_name: 'Phạm Truyền Thông',
    email: 'pr1@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-mkt',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/pr1'
  },
  {
    user_id: 'usr-user18',
    full_name: 'Trịnh Quảng Cáo',
    email: 'ads1@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-mkt',
    position_id: 'pos-intern',
    jandi_link: 'https://jandi.com/connect/ads1'
  },
  {
    user_id: 'usr-user19',
    full_name: 'Đặng Bán Hàng',
    email: 'sales1@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-sales',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/sales1'
  },
  {
    user_id: 'usr-user20',
    full_name: 'Dương Khách Hàng',
    email: 'sales2@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-sales',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/sales2'
  },
  {
    user_id: 'usr-user21',
    full_name: 'Lâm Kế Toán',
    email: 'accountant1@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-finance',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/accountant1'
  },
  {
    user_id: 'usr-user22',
    full_name: 'Hồ Thủ Quỹ',
    email: 'cashier1@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-finance',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/cashier1'
  },
  {
    user_id: 'usr-user23',
    full_name: 'Nguyễn Trưởng Phòng Dev',
    email: 'dev_mgr@test.com',
    role: 'Team Leader',
    department_id: 'dept-dev',
    position_id: 'pos-manager',
    jandi_link: 'https://jandi.com/connect/dev_mgr'
  },
  {
    user_id: 'usr-user24',
    full_name: 'Trần Trưởng Nhóm Mkt',
    email: 'mkt_lead@test.com',
    role: 'Part Leader',
    department_id: 'dept-mkt',
    position_id: 'pos-lead',
    jandi_link: 'https://jandi.com/connect/mkt_lead'
  },
  {
    user_id: 'usr-user25',
    full_name: 'Lê Trưởng Phòng Mkt',
    email: 'mkt_mgr@test.com',
    role: 'Team Leader',
    department_id: 'dept-mkt',
    position_id: 'pos-manager',
    jandi_link: 'https://jandi.com/connect/mkt_mgr'
  },
  {
    user_id: 'usr-user26',
    full_name: 'Phạm Phó Giám Đốc',
    email: 'deputy@test.com',
    role: 'Ban điều hành (BOD)',
    department_id: 'dept-finance',
    position_id: 'pos-director',
    jandi_link: 'https://jandi.com/connect/deputy'
  },
  {
    user_id: 'usr-user27',
    full_name: 'Vũ Tư Vấn',
    email: 'consultant1@test.com',
    role: 'Kinh doanh (Sales)',
    department_id: 'dept-sales',
    position_id: 'pos-staff',
    jandi_link: 'https://jandi.com/connect/consultant1'
  },
  {
    user_id: 'usr-user28',
    full_name: 'Nguyễn Thực Tập Dev',
    email: 'dev_intern@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-dev',
    position_id: 'pos-intern',
    jandi_link: 'https://jandi.com/connect/dev_intern'
  },
  {
    user_id: 'usr-user29',
    full_name: 'Trần Thực Tập HR',
    email: 'hr_intern@test.com',
    role: 'Nhân viên (Staff)',
    department_id: 'dept-hr',
    position_id: 'pos-intern',
    jandi_link: 'https://jandi.com/connect/hr_intern'
  },
  {
    user_id: 'usr-user30',
    full_name: 'Lê Tài Chính',
    email: 'finance_mgr@test.com',
    role: 'Team Leader',
    department_id: 'dept-finance',
    position_id: 'pos-manager',
    jandi_link: 'https://jandi.com/connect/finance_mgr'
  }
];

const DEPARTMENTS = [
  { department_id: 'dept-dev', name: 'Phòng Phát triển Phần mềm (R&D)', parent_id: null },
  { department_id: 'dept-hr', name: 'Phòng Hành chính Nhân sự (HR)', parent_id: null },
  { department_id: 'dept-sales', name: 'Phòng Kinh doanh (Sales)', parent_id: null },
  { department_id: 'dept-mkt', name: 'Phòng Truyền thông Marketing', parent_id: null },
  { department_id: 'dept-finance', name: 'Phòng Kế toán Tài chính', parent_id: null },
  { department_id: 'PCT', name: 'PC', parent_id: null },
  { department_id: 'PCT1', name: 'PC1', parent_id: 'PCT' },
  { department_id: 'PCT2', name: 'PC2', parent_id: 'PCT' }
];

const POSITIONS = [
  { position_id: 'pos-intern', position_name: 'Thực tập sinh (Intern)' },
  { position_id: 'pos-staff', position_name: 'Nhân viên chính thức (Staff)' },
  { position_id: 'pos-lead', position_name: 'Trưởng nhóm kỹ thuật (Technical Lead)' },
  { position_id: 'pos-manager', position_name: 'Trưởng phòng (Manager)' },
  { position_id: 'pos-director', position_name: 'Giám đốc bộ phận (Director)' }
];

const CUSTOMERS = [
  { customer_id: 'cust-vng', name: 'Công ty Cổ phần VNG (VNG Corporation)' },
  { customer_id: 'cust-viettel', name: 'Tập đoàn Công nghiệp - Viễn thông Quân đội (Viettel)' }
];

const PROJECTS = [
  {
    project_id: 'proj-crm',
    project_name: 'Hệ thống Quản lý Khách hàng CRM',
    project_description: 'Dự án phát triển phần mềm CRM phục vụ bộ phận kinh doanh chăm sóc khách hàng.',
    project_key: 'CRM',
    create_by: 'usr-sales',
    customer_id: 'cust-vng'
  },
  {
    project_id: 'proj-ecommerce',
    project_name: 'Ứng dụng Di động E-Commerce',
    project_description: 'Xây dựng app mua sắm tích hợp cổng thanh toán trực tuyến.',
    project_key: 'PAY',
    create_by: 'usr-bod',
    customer_id: 'cust-viettel'
  },
  {
    project_id: 'proj-recruitment',
    project_name: 'Chiến dịch Tuyển dụng TopEng 2026',
    project_description: 'Chiến dịch thu hút nhân tài kỹ thuật cao cấp phục vụ cho các dự án mở rộng.',
    project_key: 'HR',
    create_by: 'usr-admin',
    customer_id: null
  }
];

const PROJECT_MEMBERS = [
  // Project CRM
  { project_id: 'proj-crm', userId: 'usr-leader', role: 'PM' },
  { project_id: 'proj-crm', userId: 'usr-staff', role: 'Member' },
  { project_id: 'proj-crm', userId: 'usr-user07', role: 'Member' },
  { project_id: 'proj-crm', userId: 'usr-user08', role: 'Member' },
  { project_id: 'proj-crm', userId: 'usr-user11', role: 'Member' },
  { project_id: 'proj-crm', userId: 'usr-user13', role: 'Member' },
  { project_id: 'proj-crm', userId: 'usr-sales', role: 'Member' },

  // Project E-Commerce
  { project_id: 'proj-ecommerce', userId: 'usr-user23', role: 'PM' },
  { project_id: 'proj-ecommerce', userId: 'usr-leader', role: 'Member' },
  { project_id: 'proj-ecommerce', userId: 'usr-staff', role: 'Member' },
  { project_id: 'proj-ecommerce', userId: 'usr-user09', role: 'Member' },
  { project_id: 'proj-ecommerce', userId: 'usr-user10', role: 'Member' },
  { project_id: 'proj-ecommerce', userId: 'usr-user12', role: 'Member' },
  { project_id: 'proj-ecommerce', userId: 'usr-user26', role: 'Member' },

  // Project Recruitment
  { project_id: 'proj-recruitment', userId: 'usr-hr', role: 'PM' },
  { project_id: 'proj-recruitment', userId: 'usr-admin', role: 'Member' },
  { project_id: 'proj-recruitment', userId: 'usr-user14', role: 'Member' },
  { project_id: 'proj-recruitment', userId: 'usr-user15', role: 'Member' },
  { project_id: 'proj-recruitment', userId: 'usr-user29', role: 'Member' }
];

const TASKS = [
  {
    task_id: 'task-1',
    project_id: 'proj-crm',
    assignee_id: 'usr-staff',
    title: 'Thiết kế cơ sở dữ liệu CRM',
    description: 'Thiết kế các bảng MySQL cho CRM và tạo mối quan hệ ràng buộc.',
    priority: 'Cao',
    status: 'Done',
    due_date: '2026-07-20'
  },
  {
    task_id: 'task-2',
    project_id: 'proj-crm',
    assignee_id: 'usr-user07',
    title: 'Xây dựng API đăng nhập & phân quyền',
    description: 'Cấu hình JWT & Middleware xác thực người dùng.',
    priority: 'Cao',
    status: 'InProgress',
    due_date: '2026-07-25'
  },
  {
    task_id: 'task-3',
    project_id: 'proj-crm',
    assignee_id: 'usr-user13',
    title: 'Tạo UI giao diện Dashboard CRM',
    description: 'Vẽ giao diện dashboard hiển thị các biểu đồ thống kê.',
    priority: 'Trung bình',
    status: 'Review',
    due_date: '2026-07-15'
  },
  {
    task_id: 'task-4',
    project_id: 'proj-ecommerce',
    assignee_id: 'usr-leader',
    title: 'Phác thảo Wireframe UI/UX E-Commerce',
    description: 'Vẽ Wireframe chi tiết luồng thanh toán và giỏ hàng.',
    priority: 'Cao',
    status: 'Done',
    due_date: '2026-07-10'
  },
  {
    task_id: 'task-5',
    project_id: 'proj-ecommerce',
    assignee_id: 'usr-user09',
    title: 'Tích hợp cổng thanh toán Sandbox',
    description: 'Cài đặt và cấu hình Viettel Pay SDK Sandbox.',
    priority: 'Cao',
    status: 'Todo',
    due_date: '2026-08-01'
  },
  {
    task_id: 'task-6',
    project_id: 'proj-ecommerce',
    assignee_id: 'usr-user10',
    title: 'Viết API giỏ hàng và đặt hàng',
    description: 'Phát triển API thêm/sửa/xóa sản phẩm trong giỏ hàng và tạo đơn hàng.',
    priority: 'Trung bình',
    status: 'InProgress',
    due_date: '2026-07-30'
  },
  {
    task_id: 'task-7',
    project_id: 'proj-recruitment',
    assignee_id: 'usr-user14',
    title: 'Sàng lọc hồ sơ ứng viên Tech Lead',
    description: 'Đánh giá CV của các ứng viên nộp qua cổng tuyển dụng.',
    priority: 'Cao',
    status: 'InProgress',
    due_date: '2026-07-18'
  },
  {
    task_id: 'task-8',
    project_id: 'proj-recruitment',
    assignee_id: 'usr-user15',
    title: 'Lên lịch phỏng vấn vòng 1',
    description: 'Gửi thư mời phỏng vấn và sắp xếp lịch hẹn cho ứng viên phù hợp.',
    priority: 'Trung bình',
    status: 'Todo',
    due_date: '2026-07-22'
  }
];

const SUBTASKS = [
  { task_id: 'task-1', title: 'Vẽ sơ đồ ERD chi tiết', is_done: true },
  { task_id: 'task-1', title: 'Tạo script SQL khởi tạo', is_done: true },
  { task_id: 'task-2', title: 'Cấu hình thư viện jwt', is_done: true },
  { task_id: 'task-2', title: 'Viết middleware phân quyền', is_done: false },
  { task_id: 'task-3', title: 'Thiết kế giao diện chart doanh thu', is_done: false }
];

const ISSUES = [
  {
    id: 1,
    issue_key: 'CRM-I101',
    project_id: 'proj-crm',
    summary: 'Thiết kế Dashboard hiển thị KPI doanh số',
    description: 'Xây dựng layout Dashboard hiển thị các biểu đồ doanh thu và thống kê khách hàng.',
    type: 'STORY',
    status: 'DONE',
    priority: 'HIGH',
    reporter_id: 'usr-sales',
    assignee_id: 'usr-leader'
  },
  {
    id: 2,
    issue_key: 'CRM-I102',
    project_id: 'proj-crm',
    summary: 'Lỗi null pointer exception khi lưu khách hàng không có email',
    description: 'API trả về status 500 khi lưu một record khách hàng mới không chứa trường email.',
    type: 'BUG',
    status: 'IN_PROGRESS',
    priority: 'CRITICAL',
    reporter_id: 'usr-user11',
    assignee_id: 'usr-staff'
  },
  {
    id: 3,
    issue_key: 'PAY-I101',
    project_id: 'proj-ecommerce',
    summary: 'Cập nhật SSL certificate cho sandbox API',
    description: 'Cần cập nhật cấu hình SSL mới cho server sandbox để tránh lỗi kết nối TLS từ cổng thanh toán.',
    type: 'TASK',
    status: 'TO_DO',
    priority: 'MEDIUM',
    reporter_id: 'usr-user23',
    assignee_id: 'usr-user09'
  }
];

const ISSUE_COMMENTS = [
  { issue_id: 1, user_id: 'usr-staff', content: 'Em đã hoàn thành thiết kế Figma và React rồi, nhờ anh review nhé.' },
  { issue_id: 2, user_id: 'usr-leader', content: 'Hãy kiểm tra lại validation ở tầng DTO trước khi lưu database nhé.' }
];

const ISSUE_HISTORY = [
  { issue_id: 1, user_id: 'usr-leader', field_changed: 'status', old_value: 'TO_DO', new_value: 'DONE' },
  { issue_id: 2, user_id: 'usr-staff', field_changed: 'status', old_value: 'TO_DO', new_value: 'IN_PROGRESS' }
];

const CHAT_ROOMS = [
  { room_id: 'room-global', type: 'global', room_name: '💬 Kênh thảo luận toàn công ty', project_id: null },
  { room_id: 'room-crm', type: 'project', room_name: '📂 Dự án CRM - Thảo luận chung', project_id: 'proj-crm' },
  { room_id: 'room-ecommerce', type: 'project', room_name: '📂 Dự án Mobile App - Kỹ thuật', project_id: 'proj-ecommerce' },
  { room_id: 'room-recruitment', type: 'project', room_name: '📂 Tuyển dụng 2026 - Thảo luận chung', project_id: 'proj-recruitment' }
];

const MESSAGES = [
  { id: 'msg-1', room_id: 'room-global', sender_id: 'usr-admin', content: 'Chào mừng mọi người gia nhập hệ thống quản lý mới của TopEng!' },
  { id: 'msg-2', room_id: 'room-global', sender_id: 'usr-bod', content: 'Chúc toàn thể công ty làm việc hiệu quả!' },
  { id: 'msg-3', room_id: 'room-crm', sender_id: 'usr-leader', content: 'Chào mọi người, chúng ta kick-off dự án CRM nhé.' },
  { id: 'msg-4', room_id: 'room-crm', sender_id: 'usr-staff', content: 'Dạ vâng anh, em đã nhận task thiết kế database.' }
];

const DAILY_REPORTS = [
  {
    user_id: 'usr-staff',
    project_id: 'proj-crm',
    content: 'Hôm nay tôi đã hoàn thành thiết kế ERD cho dự án CRM và bắt đầu viết câu lệnh SQL tạo bảng.',
    file_url: null,
    status: 'Pending',
    comment: null
  },
  {
    user_id: 'usr-user07',
    project_id: 'proj-crm',
    content: 'Hôm nay tôi đã cấu hình xong Passport JWT và kiểm thử cơ bản API đăng nhập.',
    file_url: null,
    status: 'Pending',
    comment: null
  },
  {
    user_id: 'usr-leader',
    project_id: 'proj-ecommerce',
    content: 'Tiến hành họp kick-off dự án E-Commerce và phân bổ công việc cho thành viên phát triển.',
    file_url: null,
    status: 'Pending',
    comment: null
  }
];

const NOTIFICATIONS = [
  { user_id: 'usr-staff', title: 'Công việc mới', content: 'Bạn đã được phân công công việc "Thiết kế cơ sở dữ liệu CRM" trong dự án CRM.', link_url: '#tasks', is_read: false },
  { user_id: 'usr-leader', title: 'Issue mới', content: 'Có issue mới cần xử lý: CRM-I101', link_url: '#projects', is_read: false }
];

const ACTIVITY_LOGS = [
  { user_id: 'usr-admin', action_type: 'CREATE', entity_type: 'Project', entity_id: 'proj-crm', description: "đã tạo dự án 'Hệ thống Quản lý Khách hàng CRM'" },
  { user_id: 'usr-hr', action_type: 'CREATE', entity_type: 'Project', entity_id: 'proj-recruitment', description: "đã tạo dự án 'Chiến dịch Tuyển dụng TopEng 2026'" }
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
        'INSERT INTO `department` (`department_id`, `name`, `parent_id`) VALUES (?, ?, ?)',
        [dept.department_id, dept.name, dept.parent_id || null]
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
    // Default password '123456' hashes to SHA-256 securely: 'f35c46b8d0e816b626dfc4fd55a711b2a712863f24843bb77d6141576cefb7a6'
    const passwordHash = 'f35c46b8d0e816b626dfc4fd55a711b2a712863f24843bb77d6141576cefb7a6';
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

    // 6. Seed Customers
    for (const cust of CUSTOMERS) {
      await db.query(
        'INSERT INTO `customer` (`customer_id`, `customer_name`) VALUES (?, ?)',
        [cust.customer_id, cust.name]
      );
    }
    console.log('Seeded customers.');

    // 7. Seed Projects
    for (const proj of PROJECTS) {
      await db.query(
        'INSERT INTO `project` (`project_id`, `project_name`, `project_description`, `project_key`, `create_by`, `customer_id`) VALUES (?, ?, ?, ?, ?, ?)',
        [
          proj.project_id,
          proj.project_name,
          proj.project_description,
          proj.project_key,
          proj.create_by,
          proj.customer_id
        ]
      );
    }
    console.log('Seeded projects.');

    // 8. Seed Project Members
    for (const pmem of PROJECT_MEMBERS) {
      await db.query(
        'INSERT INTO `projectmember` (`project_id`, `userId`, `role`) VALUES (?, ?, ?)',
        [pmem.project_id, pmem.userId, pmem.role]
      );
    }
    console.log('Seeded project members.');

    // 9. Seed Tasks
    for (const task of TASKS) {
      await db.query(
        'INSERT INTO `task` (`task_id`, `project_id`, `assignee_id`, `title`, `description`, `priority`, `due_date`) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          task.task_id,
          task.project_id,
          task.assignee_id,
          task.title,
          task.description,
          task.priority,
          task.due_date
        ]
      );
    }
    console.log('Seeded tasks.');

    // 10. Seed Subtasks
    for (const sub of SUBTASKS) {
      await db.query(
        'INSERT INTO `subtask` (`task_id`, `title`, `is_done`) VALUES (?, ?, ?)',
        [sub.task_id, sub.title, sub.is_done ? 1 : 0]
      );
    }
    console.log('Seeded subtasks.');

    // 11. Seed Issues
    for (const issue of ISSUES) {
      await db.query(
        'INSERT INTO `issue` (`id`, `issue_key`, `project_id`, `summary`, `description`, `type`, `status`, `priority`, `reporter_id`, `assignee_id`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          issue.id,
          issue.issue_key,
          issue.project_id,
          issue.summary,
          issue.description,
          issue.type,
          issue.status,
          issue.priority,
          issue.reporter_id,
          issue.assignee_id
        ]
      );
    }
    console.log('Seeded issues.');

    // 12. Seed Issue Comments
    for (const comm of ISSUE_COMMENTS) {
      await db.query(
        'INSERT INTO `issuecomments` (`issue_id`, `user_id`, `content`) VALUES (?, ?, ?)',
        [comm.issue_id, comm.user_id, comm.content]
      );
    }
    console.log('Seeded issue comments.');

    // 13. Seed Issue History
    for (const hist of ISSUE_HISTORY) {
      await db.query(
        'INSERT INTO `issuehistory` (`issue_id`, `user_id`, `field_changed`, `old_value`, `new_value`) VALUES (?, ?, ?, ?, ?)',
        [hist.issue_id, hist.user_id, hist.field_changed, hist.old_value, hist.new_value]
      );
    }
    console.log('Seeded issue history.');

    // 14. Seed Chat Rooms
    for (const room of CHAT_ROOMS) {
      await db.query(
        'INSERT INTO `chatrooms` (`room_id`, `type`, `room_name`, `project_id`) VALUES (?, ?, ?, ?)',
        [room.room_id, room.type, room.room_name, room.project_id]
      );
    }
    console.log('Seeded chatrooms.');

    // 15. Seed Chat Room Members dynamically
    // First, add all users to room-global
    for (const user of USERS_TO_SEED) {
      await db.query(
        'INSERT INTO `chatroommember` (`room_id`, `user_id`) VALUES (?, ?)',
        ['room-global', user.user_id]
      );
    }
    // Next, add project members to their respective project rooms
    for (const pmem of PROJECT_MEMBERS) {
      let roomId = '';
      if (pmem.project_id === 'proj-crm') roomId = 'room-crm';
      else if (pmem.project_id === 'proj-ecommerce') roomId = 'room-ecommerce';
      else if (pmem.project_id === 'proj-recruitment') roomId = 'room-recruitment';

      if (roomId) {
        // Prevent duplicate room-member entries if any
        try {
          await db.query(
            'INSERT INTO `chatroommember` (`room_id`, `user_id`) VALUES (?, ?)',
            [roomId, pmem.userId]
          );
        } catch (e) {
          // Skip duplicate
        }
      }
    }
    console.log('Seeded chat room members.');

    // 16. Seed Messages
    for (const msg of MESSAGES) {
      // For message_id we can just use a unique random/timestamped string
      const msgId = `msg-id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await db.query(
        'INSERT INTO `messages` (`message_id`, `room_id`, `sender_id`, `content`) VALUES (?, ?, ?, ?)',
        [msgId, msg.room_id, msg.sender_id, msg.content]
      );
    }
    console.log('Seeded messages.');

    // 17. Seed Daily Reports
    for (const rep of DAILY_REPORTS) {
      await db.query(
        'INSERT INTO `dailyreport` (`user_id`, `project_id`, `content`, `status`) VALUES (?, ?, ?, ?)',
        [rep.user_id, rep.project_id, rep.content, rep.status]
      );
    }
    console.log('Seeded daily reports.');

    // 18. Seed Notifications
    for (const notif of NOTIFICATIONS) {
      await db.query(
        'INSERT INTO `notificyations` (`user_id`, `title`, `content`, `link_url`, `is_read`) VALUES (?, ?, ?, ?, ?)',
        [notif.user_id, notif.title, notif.content, notif.link_url, notif.is_read ? 1 : 0]
      );
    }
    console.log('Seeded notifications.');

    // 19. Seed Activity Logs
    for (const log of ACTIVITY_LOGS) {
      await db.query(
        'INSERT INTO `activitylogs` (`user_id`, `action_type`, `entity_type`, `description`) VALUES (?, ?, ?, ?)',
        [log.user_id, log.action_type, log.entity_type, log.description]
      );
    }
    console.log('Seeded activity logs.');

    // 20. Re-enable Foreign Key Checks
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Re-enabled foreign key checks.');

    console.log('Database successfully reset and seeded with full demo data!');

    // 21. Generate account_test.md
    generateAccountMarkdown();

  } catch (error) {
    console.error('Error during database reset and seed:', error);
    process.exit(1);
  }
}

function generateAccountMarkdown() {
  const filePath = path.join(__dirname, '../account_test.md');
  
  let content = `# Danh sách tài khoản kiểm thử hệ thống (TopEng Manager)

Tài liệu này chứa thông tin các tài khoản thử nghiệm tương ứng với từng vai trò/vị trí trong hệ thống sau khi đã làm sạch và seed dữ liệu demo.

## Thông tin đăng nhập chung
- **Mật khẩu mặc định**: \`123456\`
- **Đường dẫn ứng dụng**: \`http://localhost:3000\`
- **Mã đăng nhập nhanh**: Bạn có thể đăng nhập bằng Email hoặc Mã nhân viên (ví dụ: \`usr-admin\`).

## 6 Tài khoản vai trò cốt lõi (Core Accounts)

| Họ và tên | Email | Vai trò hệ thống | Phòng ban | Chức vụ |
| :--- | :--- | :--- | :--- | :--- |
| **Nguyễn Admin** | \`admin@test.com\` | \`Quản trị viên (Admin)\` | Phòng Hành chính Nhân sự (HR) | Giám đốc bộ phận (Director) |
| **Trần Nhân Sự** | \`hr@test.com\` | \`Nhân sự (HR)\` | Phòng Hành chính Nhân sự (HR) | Trưởng phòng (Manager) |
| **Lê Nhân Viên** | \`staff@test.com\` | \`Nhân viên (Staff)\` | Phòng Phát triển Phần mềm (R&D) | Nhân viên chính thức (Staff) |
| **Phạm Trưởng Nhóm** | \`leader@test.com\` | \`Leader/Part Leader\` | Phòng Phát triển Phần mềm (R&D) | Trưởng nhóm kỹ thuật (Technical Lead) |
| **Vũ Kinh Doanh** | \`sales@test.com\` | \`Kinh doanh (Sales)\` | Phòng Kinh doanh (Sales) | Trưởng phòng (Manager) |
| **Nguyễn Điều Hành** | \`bod@test.com\` | \`Ban điều hành (BOD)\` | Phòng Kế toán Tài chính | Giám đốc bộ phận (Director) |

## 24 Tài khoản demo bổ sung (Other Mock Accounts)

| Họ và tên | Email | Vai trò hệ thống | Phòng ban | Chức vụ |
| :--- | :--- | :--- | :--- | :--- |
| Hoàng Phát Triển | \`developer1@test.com\` | \`Nhân viên (Staff)\` | Phát triển Phần mềm | Nhân viên chính thức |
| Ngô Lập Trình | \`developer2@test.com\` | \`Nhân viên (Staff)\` | Phát triển Phần mềm | Nhân viên chính thức |
| Bùi Mã Nguồn | \`developer3@test.com\` | \`Nhân viên (Staff)\` | Phát triển Phần mềm | Nhân viên chính thức |
| Đỗ Công Nghệ | \`developer4@test.com\` | \`Nhân viên (Staff)\` | Phát triển Phần mềm | Nhân viên chính thức |
| Phan Kiểm Thử | \`tester1@test.com\` | \`Nhân viên (Staff)\` | Phát triển Phần mềm | Thực tập sinh |
| Vũ Đảm Bảo | \`qa1@test.com\` | \`Nhân viên (Staff)\` | Phát triển Phần mềm | Nhân viên chính thức |
| Lý Thiết Kế | \`designer1@test.com\` | \`Nhân viên (Staff)\` | Phát triển Phần mềm | Nhân viên chính thức |
| Nguyễn Tuyển Dụng | \`recruiter1@test.com\` | \`Nhân viên (Staff)\` | Hành chính Nhân sự | Nhân viên chính thức |
| Trần Đào Tạo | \`trainer1@test.com\` | \`Nhân viên (Staff)\` | Hành chính Nhân sự | Nhân viên chính thức |
| Lê Tiếp Thị | \`marketer1@test.com\` | \`Nhân viên (Staff)\` | Truyền thông Marketing | Nhân viên chính thức |
| Phạm Truyền Thông | \`pr1@test.com\` | \`Nhân viên (Staff)\` | Truyền thông Marketing | Nhân viên chính thức |
| Trịnh Quảng Cáo | \`ads1@test.com\` | \`Nhân viên (Staff)\` | Truyền thông Marketing | Thực tập sinh |
| Đặng Bán Hàng | \`sales1@test.com\` | \`Nhân viên (Staff)\` | Kinh doanh (Sales) | Nhân viên chính thức |
| Dương Khách Hàng | \`sales2@test.com\` | \`Nhân viên (Staff)\` | Kinh doanh (Sales) | Nhân viên chính thức |
| Lâm Kế Toán | \`accountant1@test.com\` | \`Nhân viên (Staff)\` | Kế toán Tài chính | Nhân viên chính thức |
| Hồ Thủ Quỹ | \`cashier1@test.com\` | \`Nhân viên (Staff)\` | Kế toán Tài chính | Nhân viên chính thức |
| Nguyễn Trưởng Phòng Dev | \`dev_mgr@test.com\` | \`Leader/Part Leader\` | Phát triển Phần mềm | Trưởng phòng (Manager) |
| Trần Trưởng Nhóm Mkt | \`mkt_lead@test.com\` | \`Leader/Part Leader\` | Truyền thông Marketing | Trưởng nhóm kỹ thuật |
| Lê Trưởng Phòng Mkt | \`mkt_mgr@test.com\` | \`Leader/Part Leader\` | Truyền thông Marketing | Trưởng phòng (Manager) |
| Phạm Phó Giám Đốc | \`deputy@test.com\` | \`Ban điều hành (BOD)\` | Kế toán Tài chính | Giám đốc bộ phận |
| Vũ Tư Vấn | \`consultant1@test.com\` | \`Kinh doanh (Sales)\` | Kinh doanh (Sales) | Nhân viên chính thức |
| Nguyễn Thực Tập Dev | \`dev_intern@test.com\` | \`Nhân viên (Staff)\` | Phát triển Phần mềm | Thực tập sinh |
| Trần Thực Tập HR | \`hr_intern@test.com\` | \`Nhân viên (Staff)\` | Hành chính Nhân sự | Thực tập sinh |
| Lê Tài Chính | \`finance_mgr@test.com\` | \`Leader/Part Leader\` | Kế toán Tài chính | Trưởng phòng (Manager) |

---

## Hướng dẫn kiểm thử nhanh
1. Truy cập vào ứng dụng tại [http://localhost:3000](http://localhost:3000)
2. Sử dụng email hoặc mã nhân viên của tài khoản muốn kiểm thử kèm mật khẩu \`123456\` để đăng nhập.
3. Kiểm tra các chức năng và quyền truy cập đặc thù của vai trò đó (Tham khảo phân quyền trong \`PHAN_QUYEN.md\`).
4. Sử dụng nút đăng xuất nhanh ở góc trên bên phải để chuyển đổi giữa các tài khoản tiện lợi hơn.
`;

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Generated account listing file at: ${filePath}`);
}

main();
