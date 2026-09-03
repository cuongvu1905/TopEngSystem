const mysql = require('mysql2/promise');

const host = 'localhost';
const port = 3306;
const user = 'root';
const password = '';
const database = 'topsystemdb';

// MD5 of '123456'
const DEFAULT_PW_MD5 = 'e10adc3949ba59abbe56e057f20f883e';

async function seed() {
  console.log('Connecting to MySQL database:', database);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true
  });
  console.log('Connected to MySQL successfully!');

  // Disable FK
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');

  // Truncate tables
  const tables = [
    'MessagesAttachment', 'Messages', 'ChatRoomMember', 'ChatRooms',
    'IssueComments', 'IssueHistory', 'ActivityLogs', 'Notificyations',
    'DailyReport', 'Subtask', 'Task', 'Issue', 'ProjectMember',
    'Project', 'User', 'Customer', 'Position', 'Department'
  ];

  for (const t of tables) {
    try {
      await conn.query(`TRUNCATE TABLE \`${t}\``);
    } catch(e) {
      console.warn(`Skip truncate ${t}:`, e.message);
    }
  }

  console.log('Cleared old tables. Seeding fresh realistic test data...');

  // 1. Departments
  await conn.query(`
    INSERT INTO \`Department\` (\`department_id\`, \`name\`) VALUES
    ('dept-dev', 'Phòng Phát triển Phần mềm (R&D)'),
    ('dept-hr', 'Phòng Hành chính Nhân sự (HR)'),
    ('dept-sales', 'Phòng Kinh doanh (Sales)'),
    ('dept-mkt', 'Phòng Truyền thông Marketing'),
    ('dept-finance', 'Phòng Kế toán Tài chính');
  `);

  // 2. Positions
  await conn.query(`
    INSERT INTO \`Position\` (\`position_id\`, \`position_name\`) VALUES
    ('pos-intern', 'Thực tập sinh (Intern)'),
    ('pos-staff', 'Nhân viên chính thức (Staff)'),
    ('pos-lead', 'Trưởng nhóm kỹ thuật (Technical Lead)'),
    ('pos-manager', 'Trưởng phòng (Manager)'),
    ('pos-director', 'Giám đốc bộ phận (Director)');
  `);

  // 3. Customers
  await conn.query(`
    INSERT INTO \`Customer\` (\`customer_id\`, \`customer_name\`, \`address\`, \`tax_code\`) VALUES
    ('cust-vng', 'Công ty Cổ phần VNG (VNG Corporation)', 'Z06 Đường số 13, Quận 7, TP.HCM', '0304193888'),
    ('cust-viettel', 'Tập đoàn Công nghiệp - Viễn thông Quân đội (Viettel)', 'Lô D26 Khu đô thị mới Cầu Giấy, Hà Nội', '0100109106'),
    ('cust-fpt', 'Công ty Cổ phần FPT Software', 'Tòa nhà FPT Cầu Giấy, Duy Tân, Hà Nội', '0101258122'),
    ('cust-tcb', 'Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank)', '6 Quang Trung, Hoàn Kiếm, Hà Nội', '0100230800'),
    ('cust-shopee', 'Công ty TNHH Shopee Việt Nam', 'Tầng 4-5 Tòa nhà Saigon Centre 2, Quận 1, TP.HCM', '0313725590'),
    ('cust-vinfast', 'Công ty Cổ phần Sản xuất và Kinh doanh VinFast', 'Khu kinh tế Đình Vũ - Cát Hải, Hải Phòng', '0201844621');
  `);

  // 4. Users (30 users matching account_test.md)
  const users = [
    // 6 Core accounts
    ['usr-admin', 'dept-hr', 'pos-director', 'Nguyễn Admin', 'admin@test.com', DEFAULT_PW_MD5, 'Quản trị viên (Admin)'],
    ['usr-hr', 'dept-hr', 'pos-manager', 'Trần Nhân Sự', 'hr@test.com', DEFAULT_PW_MD5, 'Nhân sự (HR)'],
    ['usr-staff', 'dept-dev', 'pos-staff', 'Lê Nhân Viên', 'staff@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-leader', 'dept-dev', 'pos-lead', 'Phạm Trưởng Nhóm', 'leader@test.com', DEFAULT_PW_MD5, 'Leader/Part Leader'],
    ['usr-sales', 'dept-sales', 'pos-manager', 'Vũ Kinh Doanh', 'sales@test.com', DEFAULT_PW_MD5, 'Kinh doanh (Sales)'],
    ['usr-bod', 'dept-finance', 'pos-director', 'Nguyễn Điều Hành', 'bod@test.com', DEFAULT_PW_MD5, 'Ban điều hành (BOD)'],

    // 24 Extension accounts
    ['usr-dev1', 'dept-dev', 'pos-staff', 'Hoàng Phát Triển', 'developer1@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-dev2', 'dept-dev', 'pos-staff', 'Ngô Lập Trình', 'developer2@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-dev3', 'dept-dev', 'pos-staff', 'Bùi Mã Nguồn', 'developer3@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-dev4', 'dept-dev', 'pos-staff', 'Đỗ Công Nghệ', 'developer4@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-tester1', 'dept-dev', 'pos-intern', 'Phan Kiểm Thử', 'tester1@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-qa1', 'dept-dev', 'pos-staff', 'Vũ Đảm Bảo', 'qa1@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-des1', 'dept-dev', 'pos-staff', 'Lý Thiết Kế', 'designer1@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-rec1', 'dept-hr', 'pos-staff', 'Nguyễn Tuyển Dụng', 'recruiter1@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-train1', 'dept-hr', 'pos-staff', 'Trần Đào Tạo', 'trainer1@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-mkt1', 'dept-mkt', 'pos-staff', 'Lê Tiếp Thị', 'marketer1@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-pr1', 'dept-mkt', 'pos-staff', 'Phạm Truyền Thông', 'pr1@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-ads1', 'dept-mkt', 'pos-intern', 'Trịnh Quảng Cáo', 'ads1@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-sales1', 'dept-sales', 'pos-staff', 'Đặng Bán Hàng', 'sales1@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-sales2', 'dept-sales', 'pos-staff', 'Dương Khách Hàng', 'sales2@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-acc1', 'dept-finance', 'pos-staff', 'Lâm Kế Toán', 'accountant1@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-cash1', 'dept-finance', 'pos-staff', 'Hồ Thủ Quỹ', 'cashier1@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-devmgr', 'dept-dev', 'pos-lead', 'Nguyễn Trưởng Phòng Dev', 'dev_mgr@test.com', DEFAULT_PW_MD5, 'Leader/Part Leader'],
    ['usr-mktlead', 'dept-mkt', 'pos-lead', 'Trần Trưởng Nhóm Mkt', 'mkt_lead@test.com', DEFAULT_PW_MD5, 'Leader/Part Leader'],
    ['usr-mktmgr', 'dept-mkt', 'pos-lead', 'Lê Trưởng Phòng Mkt', 'mkt_mgr@test.com', DEFAULT_PW_MD5, 'Leader/Part Leader'],
    ['usr-deputy', 'dept-finance', 'pos-director', 'Phạm Phó Giám Đốc', 'deputy@test.com', DEFAULT_PW_MD5, 'Ban điều hành (BOD)'],
    ['usr-cons1', 'dept-sales', 'pos-staff', 'Vũ Tư Vấn', 'consultant1@test.com', DEFAULT_PW_MD5, 'Kinh doanh (Sales)'],
    ['usr-devintern', 'dept-dev', 'pos-intern', 'Nguyễn Thực Tập Dev', 'dev_intern@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-hrintern', 'dept-hr', 'pos-intern', 'Trần Thực Tập HR', 'hr_intern@test.com', DEFAULT_PW_MD5, 'Nhân viên (Staff)'],
    ['usr-finmgr', 'dept-finance', 'pos-lead', 'Lê Tài Chính', 'finance_mgr@test.com', DEFAULT_PW_MD5, 'Leader/Part Leader']
  ];

  for (const u of users) {
    await conn.query(`
      INSERT INTO \`User\` (\`user_id\`, \`department_id\`, \`position_id\`, \`full_name\`, \`email\`, \`password\`, \`role\`)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, u);
  }
  console.log(`Inserted ${users.length} Users.`);

  // 5. Projects
  const projects = [
    ['proj-crm', 'Hệ thống Quản lý Khách hàng CRM Enterprise', 'Phần mềm CRM đa kênh quản lý phễu bán hàng, tự động chăm sóc khách hàng và tích hợp tổng đài VoIP.', 'CRM', 'usr-leader', 'cust-vng'],
    ['proj-ecommerce', 'Ứng dụng Mobile E-Commerce Viettel Pay', 'Xây dựng siêu ứng dụng mua sắm trực tuyến, tích hợp ví thanh toán, QR code và chương trình khách hàng thân thiết.', 'PAY', 'usr-devmgr', 'cust-viettel'],
    ['proj-ai-agent', 'Nền tảng Trợ lý ảo AI Copilot Doanh nghiệp', 'Hệ thống AI Agent tự động hóa tổng hợp báo cáo, hỗ trợ viết code, phân tích dữ liệu và tích hợp TrollLLM API Gateway.', 'AI', 'usr-leader', 'cust-fpt'],
    ['proj-erp', 'Hệ thống Quản trị Chuỗi cung ứng ERP Next', 'Nền tảng ERP quản lý chuỗi cung ứng, kho bãi tự động và điều phối giao hàng thời gian thực.', 'ERP', 'usr-sales', 'cust-tcb'],
    ['proj-hr-portal', 'Cổng thông tin Tự phục vụ Nhân sự HR-Portal', 'Hệ thống quản lý hồ sơ nhân viên, chấm công định vị GPS, phê duyệt nghỉ phép và đánh giá KPI tự động.', 'HR', 'usr-hr', 'cust-shopee'],
    ['proj-mobile', 'Ứng dụng Quản lý Tài chính Xe thông minh', 'App mobile kết nối thiết bị IoT trên ô tô điện, quản lý lộ trình, trạm sạc và thanh toán tự động.', 'AUTO', 'usr-dev1', 'cust-vinfast']
  ];

  for (const p of projects) {
    await conn.query(`
      INSERT INTO \`Project\` (\`project_id\`, \`project_name\`, \`project_description\`, \`project_key\`, \`create_by\`, \`customer_id\`)
      VALUES (?, ?, ?, ?, ?, ?)
    `, p);
  }
  console.log(`Inserted ${projects.length} Projects.`);

  // 6. Project Members
  const projectMembers = [
    ['proj-crm', 'usr-leader', 'PM'],
    ['proj-crm', 'usr-dev1', 'Developer'],
    ['proj-crm', 'usr-dev2', 'Developer'],
    ['proj-crm', 'usr-des1', 'UI/UX Designer'],
    ['proj-crm', 'usr-qa1', 'QA Lead'],
    ['proj-crm', 'usr-sales', 'Sales Rep'],

    ['proj-ecommerce', 'usr-devmgr', 'PM'],
    ['proj-ecommerce', 'usr-staff', 'Tech Lead'],
    ['proj-ecommerce', 'usr-dev3', 'Backend Dev'],
    ['proj-ecommerce', 'usr-dev4', 'Frontend Dev'],
    ['proj-ecommerce', 'usr-tester1', 'QA/Tester'],

    ['proj-ai-agent', 'usr-leader', 'PM'],
    ['proj-ai-agent', 'usr-staff', 'AI Engineer'],
    ['proj-ai-agent', 'usr-dev1', 'Fullstack Dev'],
    ['proj-ai-agent', 'usr-devintern', 'Intern'],

    ['proj-erp', 'usr-sales', 'PM'],
    ['proj-erp', 'usr-dev2', 'Developer'],
    ['proj-erp', 'usr-acc1', 'Business Analyst'],
    ['proj-erp', 'usr-cash1', 'Financial Auditor'],

    ['proj-hr-portal', 'usr-hr', 'PM'],
    ['proj-hr-portal', 'usr-rec1', 'Coordinator'],
    ['proj-hr-portal', 'usr-train1', 'Trainer'],
    ['proj-hr-portal', 'usr-dev3', 'Developer'],

    ['proj-mobile', 'usr-dev1', 'PM'],
    ['proj-mobile', 'usr-dev4', 'Mobile Dev'],
    ['proj-mobile', 'usr-des1', 'Designer'],
    ['proj-mobile', 'usr-qa1', 'Tester']
  ];

  for (const pm of projectMembers) {
    await conn.query(`
      INSERT INTO \`ProjectMember\` (\`project_id\`, \`userId\`, \`role\`)
      VALUES (?, ?, ?)
    `, pm);
  }
  console.log(`Inserted ${projectMembers.length} Project Members.`);

  // 7. Issues (Jira Style - 16 issues)
  const issues = [
    [1, 'CRM-101', 'proj-crm', 'Thiết kế giao diện Dashboard phân tích đa chiều', 'Xây dựng layout Dashboard hiển thị các biểu đồ doanh thu theo thời gian thực và biểu đồ phễu khách hàng.', 'STORY', 'DONE', 'HIGH', 'usr-leader', 'usr-des1'],
    [2, 'CRM-102', 'proj-crm', 'Lỗi tràn bộ nhớ đệm khi export báo cáo 50k dòng', 'API trả về lỗi Out of Memory (500) khi người dùng xuất file Excel danh sách khách hàng số lượng lớn.', 'BUG', 'IN_PROGRESS', 'CRITICAL', 'usr-sales', 'usr-dev1'],
    [3, 'CRM-103', 'proj-crm', 'Tích hợp cổng Webhook đồng bộ tin nhắn Zalo ZNS', 'Cấu hình endpoint nhận webhook từ Zalo OA và tự động phân luồng tin nhắn đến nhân viên chăm sóc.', 'TASK', 'TO_DO', 'MEDIUM', 'usr-leader', 'usr-dev2'],
    [4, 'CRM-104', 'proj-crm', 'Tối ưu tốc độ tải danh sách khách hàng dưới 200ms', 'Thêm indexing cho các cột filter thường dùng (phone, email, status) và cấu hình Redis cache.', 'TASK', 'IN_PROGRESS', 'HIGH', 'usr-leader', 'usr-dev1'],
    
    [5, 'PAY-101', 'proj-ecommerce', 'Tích hợp SDK thanh toán quét mã VietQR Pro', 'Xây dựng module tạo mã QR động tự khớp lệnh thanh toán ngân hàng NAPAS247.', 'STORY', 'DONE', 'HIGH', 'usr-devmgr', 'usr-staff'],
    [6, 'PAY-102', 'proj-ecommerce', 'Lỗi lệch tiền đối soát giao dịch cuối ngày', 'Giao dịch refund không được trừ vào tổng doanh thu kết toán hàng ngày.', 'BUG', 'IN_PROGRESS', 'CRITICAL', 'usr-devmgr', 'usr-dev3'],
    [7, 'PAY-103', 'proj-ecommerce', 'Nâng cấp bảo mật sinh trắc học FaceID & TouchID', 'Tích hợp WebAuthn và Keychain mã hóa dữ liệu thanh toán nhạy cảm trên Mobile.', 'TASK', 'TO_DO', 'MEDIUM', 'usr-devmgr', 'usr-dev4'],
    
    [8, 'AI-101', 'proj-ai-agent', 'Tích hợp TrollLLM API Gateway đa mô hình', 'Kết nối gateway API OpenAI & Anthropic qua TrollLLM server để tối ưu chi phí và tốc độ token.', 'STORY', 'DONE', 'CRITICAL', 'usr-leader', 'usr-staff'],
    [9, 'AI-102', 'proj-ai-agent', 'Phát triển Chatbot RAG đọc tài liệu PDF nội bộ', 'Triển khai Vector Database (Milvus/Chroma) và pipeline nhúng Embedding tài liệu kỹ thuật công ty.', 'STORY', 'IN_PROGRESS', 'HIGH', 'usr-leader', 'usr-dev1'],
    [10, 'AI-103', 'proj-ai-agent', 'Lỗi Timeout khi prompt vượt quá 128k context', 'Streaming SSE bị ngắt kết nối giữa chừng với các prompt phân tích báo cáo tài chính dài.', 'BUG', 'TO_DO', 'HIGH', 'usr-staff', 'usr-devintern'],

    [11, 'ERP-101', 'proj-erp', 'Thiết kế phân hệ quản lý kho đa điểm (Multi-Warehouse)', 'Cho phép điều chuyển hàng giữa các kho chi nhánh miền Bắc - Trung - Nam tự động.', 'STORY', 'IN_PROGRESS', 'HIGH', 'usr-sales', 'usr-dev2'],
    [12, 'ERP-102', 'proj-erp', 'Lỗi đồng bộ tồn kho thời gian thực qua socket', 'Số lượng tồn kho hiển thị chênh lệch 1-2 phút so với thực tế khi bán hàng đồng thời.', 'BUG', 'TO_DO', 'MEDIUM', 'usr-sales', 'usr-dev2'],

    [13, 'HR-101', 'proj-hr-portal', 'Module chấm công định vị GPS và nhận diện khuôn mặt', 'Ứng dụng chấm công di động cho nhân viên làm việc tại văn phòng và công trường.', 'STORY', 'DONE', 'HIGH', 'usr-hr', 'usr-dev3'],
    [14, 'HR-102', 'proj-hr-portal', 'Tự động tính bảng lương và gửi phiếu lương qua email', 'Tính toán tự động công chuẩn, OT, phụ cấp, giảm trừ gia cảnh và xuất phiếu lương PDF bảo mật.', 'TASK', 'IN_PROGRESS', 'HIGH', 'usr-hr', 'usr-dev3'],

    [15, 'AUTO-101', 'proj-mobile', 'Thiết kế giao diện Dark Mode phong cách Cyber Obsidian', 'Thiết kế UI màn hình điều khiển sạc xe với tone màu đen Midnight và viền dạ quang neon.', 'STORY', 'DONE', 'HIGH', 'usr-dev1', 'usr-des1'],
    [16, 'AUTO-102', 'proj-mobile', 'Lỗi mất kết nối Bluetooth BLE với trạm sạc', 'Ứng dụng không tự động quét lại trạm sạc sau khi ngắt kết nối đột ngột.', 'BUG', 'IN_PROGRESS', 'CRITICAL', 'usr-dev1', 'usr-dev4']
  ];

  for (const iss of issues) {
    await conn.query(`
      INSERT INTO \`Issue\` (\`id\`, \`issue_key\`, \`project_id\`, \`summary\`, \`description\`, \`type\`, \`status\`, \`priority\`, \`reporter_id\`, \`assignee_id\`)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, iss);
  }
  console.log(`Inserted ${issues.length} Issues.`);

  // 8. Issue Comments & History
  await conn.query(`
    INSERT INTO \`IssueComments\` (\`issue_id\`, \`user_id\`, \`content\`) VALUES
    (1, 'usr-des1', 'Em đã bàn giao file Figma Design System đầy đủ cả Light và TrollLLM Theme rồi ạ.'),
    (1, 'usr-leader', 'Giao diện rất trực quan và sắc nét, duyệt nhé!'),
    (2, 'usr-dev1', 'Đã tái hiện được lỗi với dataset 50.000 dòng. Đang chuyển sang cơ chế streaming ExcelJS.'),
    (5, 'usr-staff', 'Đã tích hợp xong VietQR Pro SDK và test thành công trên môi trường Sandbox của Vietinbank & Techcombank.'),
    (8, 'usr-leader', 'Tốc độ phản hồi qua TrollLLM API Gateway rất nhanh, latency giảm hơn 40%.');
  `);

  // 9. Tasks (16 tasks with subtasks)
  const tasks = [
    ['task-1', 'proj-crm', 'usr-dev1', 'Xây dựng API Export Excel Streaming', 'Viết pipeline đọc dữ liệu dạng chunk và ghi trực tiếp vào response stream.', 'Cao', '2026-08-30', 'InProgress'],
    ['task-2', 'proj-crm', 'usr-dev2', 'Tích hợp Zalo ZNS Webhook Endpoint', 'Đăng ký template tin nhắn ZNS và cài đặt cơ chế retry khi gửi thất bại.', 'Trung bình', '2026-09-02', 'Todo'],
    ['task-3', 'proj-crm', 'usr-des1', 'Hoàn thiện Design System UI Components', 'Bộ thư viện nút bấm, card, modal, bảng dữ liệu cho cả 3 theme.', 'Cao', '2026-08-28', 'Done'],
    ['task-4', 'proj-crm', 'usr-qa1', 'Viết kịch bản kiểm thử tải JMeter 1000 CCU', 'Kiểm tra độ ổn định của API khi có 1000 nhân viên cùng truy cập.', 'Trung bình', '2026-09-05', 'Todo'],

    ['task-5', 'proj-ecommerce', 'usr-dev3', 'Khắc phục lỗi đối soát kết toán cuối ngày', 'Viết lại hàm tính tổng doanh thu tính cả các giao dịch rollback/refund.', 'Cao', '2026-08-29', 'InProgress'],
    ['task-6', 'proj-ecommerce', 'usr-dev4', 'Tích hợp SDK FaceID cho iOS và Android', 'Hỗ trợ xác thực vân tay và FaceID khi thanh toán trên 500.000 VNĐ.', 'Trung bình', '2026-09-08', 'Todo'],
    ['task-7', 'proj-ecommerce', 'usr-tester1', 'Kiểm thử hồi quy toàn bộ luồng mua sắm', 'Test giỏ hàng, mã giảm giá voucher và thông báo đơn hàng realtime.', 'Cao', '2026-09-01', 'InProgress'],

    ['task-8', 'proj-ai-agent', 'usr-staff', 'Tối ưu hóa Embedding Pipeline tài liệu nội bộ', 'Sử dụng mô hình text-embedding-3-small để vector hóa 500 tài liệu PDF.', 'Cao', '2026-08-30', 'InProgress'],
    ['task-9', 'proj-ai-agent', 'usr-devintern', 'Sửa lỗi SSE Connection Timeout với Long Prompt', 'Cấu hình keep-alive headers và tăng timeout gateway lên 180s.', 'Trung bình', '2026-09-03', 'Todo'],
    ['task-10', 'proj-ai-agent', 'usr-dev1', 'Tạo bộ kiểm thử Benchmark độ chính xác của AI', 'Chạy bộ câu hỏi mẫu và đánh giá điểm Hallucination rate.', 'Thấp', '2026-09-10', 'Todo'],

    ['task-11', 'proj-erp', 'usr-dev2', 'Thiết kế sơ đồ CSDL Quản lý Kho Đa Điểm', 'Tạo các bảng Warehouses, StockTransfer, StockMovementLog.', 'Cao', '2026-08-31', 'InProgress'],
    ['task-12', 'proj-erp', 'usr-acc1', 'Xây dựng tài liệu đặc tả yêu cầu nghiệp vụ kho', 'Tổng hợp quy trình xuất nhập kho và kiểm kê định kỳ.', 'Trung bình', '2026-08-28', 'Done'],

    ['task-13', 'proj-hr-portal', 'usr-dev3', 'Xây dựng công thức tính lương tự động', 'Tự động tính thuế TNCN lũy tiến từng phần và bảo hiểm xã hội bắt buộc.', 'Cao', '2026-09-04', 'InProgress'],
    ['task-14', 'proj-hr-portal', 'usr-hr', 'Kiểm tra độ chính xác dữ liệu chấm công tháng 8', 'Đối chiếu dữ liệu máy chấm công vân tay với app GPS.', 'Trung bình', '2026-08-31', 'Todo'],

    ['task-15', 'proj-mobile', 'usr-dev4', 'Fix lỗi reconnect Bluetooth BLE trạm sạc', 'Bổ sung cơ chế auto-reconnect background service cho ứng dụng Flutter.', 'Cao', '2026-08-29', 'InProgress'],
    ['task-16', 'proj-mobile', 'usr-des1', 'Thiết kế icon bộ sạc động phong cách Neon', 'Vẽ animation sạc pin SVG phát sáng chuyển động mượt mà.', 'Thấp', '2026-08-28', 'Done']
  ];

  for (const t of tasks) {
    await conn.query(`
      INSERT INTO \`Task\` (\`task_id\`, \`project_id\`, \`assignee_id\`, \`title\`, \`description\`, \`priority\`, \`due_date\`, \`status\`)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, t);
  }
  console.log(`Inserted ${tasks.length} Tasks.`);

  // 10. Subtasks
  await conn.query(`
    INSERT INTO \`Subtask\` (\`task_id\`, \`title\`, \`is_done\`) VALUES
    ('task-1', 'Cài đặt thư viện ExcelJS Streaming', 1),
    ('task-1', 'Viết unit test cho dataset 100k records', 0),
    ('task-1', 'Benchmarking RAM usage dưới 150MB', 0),
    ('task-3', 'Thiết kế Light Theme Color Palette', 1),
    ('task-3', 'Thiết kế Classic Dark Mode', 1),
    ('task-3', 'Thiết kế TrollLLM Cyber Obsidian Theme', 1),
    ('task-5', 'Tìm nguyên nhân sai lệch số dư', 1),
    ('task-5', 'Viết stored procedure re-calculate', 0),
    ('task-8', 'Chunking tài liệu PDF 1000 tokens', 1),
    ('task-8', 'Lưu trữ vào Chroma Vector DB', 0),
    ('task-11', 'Tạo sơ đồ ERD chi tiết', 1),
    ('task-11', 'Viết migration script SQL', 1),
    ('task-13', 'Cấu hình bảng thuế thu nhập cá nhân 2026', 1),
    ('task-13', 'Xây dựng module gửi mail phiếu lương có mật khẩu PDF', 0);
  `);

  // 11. Daily Reports (12 reports with rich content)
  const dailyReports = [
    ['usr-dev1', 'proj-crm', 'Hôm nay: Đã hoàn thiện 80% module export Excel dạng stream, RAM không còn bị tràn khi test tải nặng. Ngày mai: Tối ưu thêm tốc độ query DB và viết unit test. Vướng mắc: Không có.', 'Approved', 'Làm rất tốt, chú ý test memory leak nhé!'],
    ['usr-dev2', 'proj-crm', 'Hôm nay: Đã liên hệ Zalo OA lấy API Key, viết xong route webhook nhận tin nhắn. Ngày mai: Tích hợp bảng phân công tư vấn viên. Vướng mắc: Đang chờ Zalo duyệt template ZNS.', 'Pending', null],
    ['usr-staff', 'proj-ai-agent', 'Hôm nay: Kết nối thành công TrollLLM API Gateway, thời gian phản hồi stream đạt mức 45ms. Ngày mai: Triển khai tiếp RAG vector database. Vướng mắc: Không có.', 'Approved', 'Tuyệt vời!'],
    ['usr-dev3', 'proj-ecommerce', 'Hôm nay: Tìm ra nguyên nhân sai lệch số dư do giao dịch hoàn tiền không tính phí cổng. Đang fix lại logic. Ngày mai: Deploy test sandbox. Vướng mắc: Cần xin tài khoản test hoàn tiền từ Viettel.', 'Pending', null],
    ['usr-des1', 'proj-crm', 'Hôm nay: Bàn giao toàn bộ Figma Components cho cả 3 theme (Light, Dark, TrollLLM Cyber). Hỗ trợ team dev tích hợp CSS tokens. Ngày mai: Thiết kế màn hình Kanban Board mới.', 'Approved', 'Design rất đẹp và sắc nét!'],
    ['usr-qa1', 'proj-crm', 'Hôm nay: Hoàn thành kịch bản kiểm thử tải JMeter. Thực hiện test smoke toàn bộ tính năng phân quyền hệ thống. Ngày mai: Chạy stress test 1000 CCU.', 'Approved', 'Đã xem kết quả test.'],
    ['usr-dev4', 'proj-mobile', 'Hôm nay: Đã bắt được sự kiện ngắt kết nối BLE trên Android và thêm vòng lặp auto-scan 5s/lần. Ngày mai: Test tiếp trên thiết bị iOS iPhone 15 Pro.', 'Pending', null],
    ['usr-sales', 'proj-erp', 'Hôm nay: Họp thống nhất yêu cầu phân hệ Kho Đa Điểm với khách hàng Techcombank. Khách hàng đã ký biên bản chốt requirement. Ngày mai: Chuyển giao spec cho dev team.', 'Approved', 'Rất chuẩn tiến độ!'],
    ['usr-hr', 'proj-hr-portal', 'Hôm nay: Kiểm tra đối soát chấm công tháng 8 cho 150 nhân sự toàn công ty. Tiến hành duyệt các đơn nghỉ phép còn tồn đọng.', 'Approved', 'Đã duyệt.'],
    ['usr-leader', 'proj-ai-agent', 'Hôm nay: Review code các pull request của team AI và CRM. Họp ban điều hành báo cáo tiến độ tuần. Ngày mai: Triển khai pipeline CI/CD tự động lên Kubernetes.', 'Approved', 'Rất tốt!'],
    ['usr-rec1', 'dept-hr', 'Hôm nay: Phỏng vấn 3 ứng viên Senior React Native và 2 ứng viên Backend Node.js. Đã gửi offer cho 1 bạn Senior Dev.', 'Approved', 'Chúc mừng team.'],
    ['usr-mkt1', 'proj-crm', 'Hôm nay: Viết bài hướng dẫn sử dụng tính năng mới của CRM, quay video demo tính năng TrollLLM theme chia sẻ lên kênh truyền thông nội bộ.', 'Approved', 'Video rất sinh động.']
  ];

  for (const dr of dailyReports) {
    await conn.query(`
      INSERT INTO \`DailyReport\` (\`user_id\`, \`project_id\`, \`content\`, \`status\`, \`comment\`, \`created_at\`)
      VALUES (?, ?, ?, ?, ?, NOW() - INTERVAL FLOOR(RAND() * 24) HOUR)
    `, dr);
  }
  console.log(`Inserted ${dailyReports.length} Daily Reports.`);

  // 12. Notifications (16 notifications)
  const notifications = [
    ['usr-staff', 'Công việc mới được giao', 'Bạn vừa được giao nhiệm vụ: Tối ưu hóa Embedding Pipeline tài liệu nội bộ.', '#tasks', 0],
    ['usr-dev1', 'Issue đã được cập nhật', 'Issue CRM-102 (Lỗi tràn bộ nhớ đệm) đã chuyển trạng thái sang IN_PROGRESS.', '#projects/proj-crm', 0],
    ['usr-dev2', 'Báo cáo ngày được duyệt', 'Báo cáo ngày của bạn đã được Leader Phạm Trưởng Nhóm duyệt với nhận xét: Làm rất tốt!', '#daily-reports', 1],
    ['usr-staff', 'Hệ thống cập nhật', 'Giao diện TrollLLM Cyber Obsidian đã được cập nhật với hiệu ứng viền phát sáng mới.', '#dashboard', 0],
    ['usr-dev3', 'Nhắc nhở hạn hoàn thành Task', 'Task Khắc phục lỗi đối soát kết toán cuối ngày sẽ đến hạn vào ngày mai.', '#tasks', 0],
    ['usr-leader', 'Thành viên nộp báo cáo ngày', 'Lê Nhân Viên vừa nộp báo cáo ngày cho dự án Nền tảng Trợ lý ảo AI Copilot.', '#daily-reports', 0],
    ['usr-sales', 'Khách hàng mới được thêm', 'Khách hàng Công ty Cổ phần Sản xuất và Kinh doanh VinFast vừa được tạo trên hệ thống.', '#projects', 1],
    ['usr-admin', 'Cảnh báo bảo mật hệ thống', 'Phiên đăng nhập mới từ IP 192.168.1.130 đã được xác thực an toàn.', '#hr', 1]
  ];

  for (const n of notifications) {
    await conn.query(`
      INSERT INTO \`Notificyations\` (\`user_id\`, \`title\`, \`content\`, \`link_url\`, \`is_read\`, \`create_at\`)
      VALUES (?, ?, ?, ?, ?, NOW() - INTERVAL FLOOR(RAND() * 48) HOUR)
    `, n);
  }
  console.log(`Inserted ${notifications.length} Notifications.`);

  // 13. Activity Logs (16 logs)
  const activityLogs = [
    ['usr-admin', 'LOGIN', 'SYSTEM', 'Đăng nhập vào hệ thống TopEng Manager thành công.'],
    ['usr-leader', 'CREATE', 'ISSUE', 'Tạo mới Issue AI-101: Tích hợp TrollLLM API Gateway đa mô hình.'],
    ['usr-dev1', 'UPDATE', 'ISSUE', 'Cập nhật trạng thái Issue CRM-102 sang IN_PROGRESS.'],
    ['usr-des1', 'COMPLETE', 'TASK', 'Hoàn thành Task: Hoàn thiện Design System UI Components.'],
    ['usr-staff', 'REPORT', 'DAILY_REPORT', 'Nộp báo cáo ngày cho dự án Nền tảng Trợ lý ảo AI Copilot.'],
    ['usr-sales', 'CREATE', 'PROJECT', 'Tạo mới dự án: Hệ thống Quản trị Chuỗi cung ứng ERP Next.'],
    ['usr-hr', 'APPROVE', 'DAILY_REPORT', 'Duyệt báo cáo ngày của nhân viên Hoàng Phát Triển.'],
    ['usr-leader', 'CHANGE_THEME', 'SYSTEM', 'Chuyển đổi giao diện hệ thống sang theme TrollLLM (Cyber Obsidian).']
  ];

  for (const log of activityLogs) {
    await conn.query(`
      INSERT INTO \`ActivityLogs\` (\`user_id\`, \`action_type\`, \`entity_type\`, \`description\`, \`create_at\`)
      VALUES (?, ?, ?, ?, NOW() - INTERVAL FLOOR(RAND() * 72) HOUR)
    `, log);
  }
  console.log(`Inserted ${activityLogs.length} Activity Logs.`);

  // 14. Chat Rooms & Members & Messages
  await conn.query(`
    INSERT INTO \`ChatRooms\` (\`room_id\`, \`type\`, \`room_name\`, \`project_id\`) VALUES
    ('room-general', 'global', '🌐 Kênh thông báo chung toàn công ty', NULL),
    ('room-dev', 'global', '💻 Nhóm Kỹ thuật & Công nghệ R&D', NULL),
    ('room-crm', 'project', '📂 Nhóm Dự án CRM Enterprise', 'proj-crm'),
    ('room-ai', 'project', '⚡ Nhóm Dự án AI Copilot & TrollLLM', 'proj-ai-agent'),
    ('room-pay', 'project', '💳 Nhóm Dự án Viettel Pay Mobile', 'proj-ecommerce');
  `);

  const roomMembers = [
    ['usr-admin', 'room-general'], ['usr-hr', 'room-general'], ['usr-staff', 'room-general'], ['usr-leader', 'room-general'], ['usr-sales', 'room-general'],
    ['usr-staff', 'room-dev'], ['usr-leader', 'room-dev'], ['usr-dev1', 'room-dev'], ['usr-dev2', 'room-dev'], ['usr-dev3', 'room-dev'],
    ['usr-leader', 'room-crm'], ['usr-dev1', 'room-crm'], ['usr-dev2', 'room-crm'], ['usr-des1', 'room-crm'], ['usr-qa1', 'room-crm'],
    ['usr-leader', 'room-ai'], ['usr-staff', 'room-ai'], ['usr-dev1', 'room-ai'], ['usr-devintern', 'room-ai'],
    ['usr-devmgr', 'room-pay'], ['usr-staff', 'room-pay'], ['usr-dev3', 'room-pay'], ['usr-dev4', 'room-pay']
  ];

  for (const rm of roomMembers) {
    await conn.query(`
      INSERT INTO \`ChatRoomMember\` (\`user_id\`, \`room_id\`) VALUES (?, ?)
    `, rm);
  }

  const messages = [
    ['msg-1', 'room-general', 'usr-admin', 'Chào mừng toàn thể anh chị em đến với phiên bản TopEng Manager v0.8 mới nhất!'],
    ['msg-2', 'room-general', 'usr-hr', 'Mọi người nhớ cập nhật báo cáo ngày trước 17:30 mỗi ngày nhé.'],
    ['msg-3', 'room-dev', 'usr-leader', 'Theme TrollLLM Cyber Obsidian đã lên sóng, mọi người test thử hiệu ứng glow xem nhé.'],
    ['msg-4', 'room-dev', 'usr-staff', 'Giao diện đen OLED kết hợp font JetBrains Mono nhìn cực ngầu luôn anh ạ!'],
    ['msg-5', 'room-crm', 'usr-leader', 'Tiến độ sprint này của CRM đang đạt 90%, còn issue export Excel bạn Phát Triển hoàn thiện nốt nhé.'],
    ['msg-6', 'room-crm', 'usr-dev1', 'Dạ em đang test luồng streaming ExcelJS rồi anh, chạy rất mượt ạ.'],
    ['msg-7', 'room-ai', 'usr-staff', 'API Gateway của TrollLLM xử lý SSE streaming cực nhanh, prompt dài 100k tokens chạy ngon lành.'],
    ['msg-8', 'room-ai', 'usr-leader', 'Chuẩn bị demo tính năng RAG đọc tài liệu PDF cho BOD vào thứ 6 tuần này nhé.']
  ];

  for (const m of messages) {
    await conn.query(`
      INSERT INTO \`Messages\` (\`message_id\`, \`room_id\`, \`sender_id\`, \`content\`, \`created_at\`)
      VALUES (?, ?, ?, ?, NOW() - INTERVAL FLOOR(RAND() * 12) HOUR)
    `, m);
  }
  console.log(`Inserted Chat Rooms & ${messages.length} Messages.`);

  // Re-enable FK
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  await conn.end();
  console.log('✅ SEED COMPLETED SUCCESSFULLY! Full test dataset is now live.');
}

seed().catch(err => {
  console.error('❌ Seed script error:', err);
  process.exit(1);
});
