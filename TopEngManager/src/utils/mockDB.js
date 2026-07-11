// Mock Database & Data Initialization for Next.js (React)
// Tích hợp 6 vai trò phân quyền và các module bổ sung (Issues, Task Chats)

let authListeners = [];

const INITIAL_USERS = [
  { id: "usr-admin", name: "Alice Nguyễn (Admin)", email: "alice.nguyen@company.com", system_role: "Quản trị viên (Admin)", department_id: "dept-hr", color: "#D97706" },
  { id: "usr-hr", name: "Trần Nhân Sự (HR)", email: "hr.tran@company.com", system_role: "Nhân sự (HR)", department_id: "dept-hr", color: "#8B5CF6" },
  { id: "usr-pm", name: "Trần Leader (Leader)", email: "leader.tran@company.com", system_role: "Leader/Part Leader", department_id: "dept-dev", color: "#1E40AF" },
  { id: "usr-member1", name: "Lê Nhân Viên 1 (Staff)", email: "charlie.le@company.com", system_role: "Nhân viên (Staff)", department_id: "dept-dev", color: "#10B981" },
  { id: "usr-member2", name: "Phạm Nhân Viên 2 (Staff)", email: "david.pham@company.com", system_role: "Nhân viên (Staff)", department_id: "dept-dev", color: "#EC4899" },
  { id: "usr-sales", name: "Vũ Kinh Doanh (Sales)", email: "sales.vu@company.com", system_role: "Kinh doanh (Sales)", department_id: "dept-sales", color: "#EF4444" },
  { id: "usr-bod", name: "Nguyễn Điều Hành (BOD)", email: "bod.nguyen@company.com", system_role: "Ban điều hành (BOD)", department_id: "dept-finance", color: "#10B981" },
  // 23 additional users to reach 30 users total
  { id: "usr-user07", name: "Hoàng Phát Triển", email: "developer1@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-dev", color: "#3B82F6" },
  { id: "usr-user08", name: "Ngô Lập Trình", email: "developer2@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-dev", color: "#60A5FA" },
  { id: "usr-user09", name: "Bùi Mã Nguồn", email: "developer3@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-dev", color: "#93C5FD" },
  { id: "usr-user10", name: "Đỗ Công Nghệ", email: "developer4@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-dev", color: "#34D399" },
  { id: "usr-user11", name: "Phan Kiểm Thử", email: "tester1@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-dev", color: "#F59E0B" },
  { id: "usr-user12", name: "Vũ Đảm Bảo", email: "qa1@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-dev", color: "#10B981" },
  { id: "usr-user13", name: "Lý Thiết Kế", email: "designer1@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-dev", color: "#8B5CF6" },
  { id: "usr-user14", name: "Nguyễn Tuyển Dụng", email: "recruiter1@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-hr", color: "#EC4899" },
  { id: "usr-user15", name: "Trần Đào Tạo", email: "trainer1@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-hr", color: "#F43F5E" },
  { id: "usr-user16", name: "Lê Tiếp Thị", email: "marketer1@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-mkt", color: "#06B6D4" },
  { id: "usr-user17", name: "Phạm Truyền Thông", email: "pr1@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-mkt", color: "#0D9488" },
  { id: "usr-user18", name: "Trịnh Quảng Cáo", email: "ads1@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-mkt", color: "#14B8A6" },
  { id: "usr-user19", name: "Đặng Bán Hàng", email: "sales1@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-sales", color: "#EF4444" },
  { id: "usr-user20", name: "Dương Khách Hàng", email: "sales2@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-sales", color: "#F87171" },
  { id: "usr-user21", name: "Lâm Kế Toán", email: "accountant1@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-finance", color: "#6B7280" },
  { id: "usr-user22", name: "Hồ Thủ Quỹ", email: "cashier1@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-finance", color: "#9CA3AF" },
  { id: "usr-user23", name: "Nguyễn Trưởng Phòng Dev", email: "dev_mgr@test.com", system_role: "Leader/Part Leader", department_id: "dept-dev", color: "#2563EB" },
  { id: "usr-user24", name: "Trần Trưởng Nhóm Mkt", email: "mkt_lead@test.com", system_role: "Leader/Part Leader", department_id: "dept-mkt", color: "#A855F7" },
  { id: "usr-user25", name: "Lê Trưởng Phòng Mkt", email: "mkt_mgr@test.com", system_role: "Leader/Part Leader", department_id: "dept-mkt", color: "#D946EF" },
  { id: "usr-user26", name: "Phạm Phó Giám Đốc", email: "deputy@test.com", system_role: "Ban điều hành (BOD)", department_id: "dept-finance", color: "#EAB308" },
  { id: "usr-user27", name: "Vũ Tư Vấn", email: "consultant1@test.com", system_role: "Kinh doanh (Sales)", department_id: "dept-sales", color: "#F97316" },
  { id: "usr-user28", name: "Nguyễn Thực Tập Dev", email: "dev_intern@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-dev", color: "#F472B6" },
  { id: "usr-user29", name: "Trần Thực Tập HR", email: "hr_intern@test.com", system_role: "Nhân viên (Staff)", department_id: "dept-hr", color: "#FB7185" }
];

const INITIAL_PROJECTS = [
  { 
    id: "proj-1", 
    name: "Xây dựng Hệ thống CRM Khách hàng", 
    description: "Hệ thống quản lý nguồn lực doanh nghiệp tích hợp Nhân sự, Tài chính, và Báo cáo tự động.", 
    status: "Thực thi", 
    start_date: "2026-06-01", 
    end_date: "2026-12-31", 
    created_by: "usr-sales",
    is_public: true
  },
  { 
    id: "proj-2", 
    name: "Ứng dụng Di động E-Commerce Pay", 
    description: "Nâng cấp trải nghiệm người dùng, cải thiện hiệu năng và bổ sung tính năng thanh toán trực tuyến.", 
    status: "Lập kế hoạch", 
    start_date: "2026-08-01", 
    end_date: "2026-11-30", 
    created_by: "usr-bod",
    is_public: false
  },
  { 
    id: "proj-3", 
    name: "Chiến dịch Tuyển dụng TopEng 2026", 
    description: "Chiến dịch thu hút nhân tài kỹ thuật cao cấp phục vụ cho các dự án mở rộng thị trường quốc tế.", 
    status: "Khởi tạo", 
    start_date: "2026-07-15", 
    end_date: "2026-09-30", 
    created_by: "usr-admin",
    is_public: false
  }
];

const INITIAL_PROJECT_MEMBERS = [
  { id: "pmem-1", project_id: "proj-1", user_id: "usr-pm", project_role: "PM", joined_at: "2026-06-01T09:00:00Z" },
  { id: "pmem-2", project_id: "proj-1", user_id: "usr-member1", project_role: "Member", joined_at: "2026-06-02T10:00:00Z" },
  { id: "pmem-3", project_id: "proj-1", user_id: "usr-user07", project_role: "Member", joined_at: "2026-06-02T11:00:00Z" },
  { id: "pmem-4", project_id: "proj-1", user_id: "usr-user08", project_role: "Member", joined_at: "2026-06-02T11:00:00Z" },
  { id: "pmem-5", project_id: "proj-1", user_id: "usr-user11", project_role: "Member", joined_at: "2026-06-02T11:00:00Z" },
  { id: "pmem-6", project_id: "proj-1", user_id: "usr-user13", project_role: "Member", joined_at: "2026-06-02T11:00:00Z" },
  { id: "pmem-7", project_id: "proj-1", user_id: "usr-sales", project_role: "Member", joined_at: "2026-06-02T11:00:00Z" },
  
  { id: "pmem-8", project_id: "proj-2", user_id: "usr-user23", project_role: "PM", joined_at: "2026-06-15T08:00:00Z" },
  { id: "pmem-9", project_id: "proj-2", user_id: "usr-pm", project_role: "Member", joined_at: "2026-06-15T09:00:00Z" },
  { id: "pmem-10", project_id: "proj-2", user_id: "usr-member1", project_role: "Member", joined_at: "2026-06-15T09:00:00Z" },
  { id: "pmem-11", project_id: "proj-2", user_id: "usr-user09", project_role: "Member", joined_at: "2026-06-15T09:00:00Z" },
  { id: "pmem-12", project_id: "proj-2", user_id: "usr-user10", project_role: "Member", joined_at: "2026-06-15T09:00:00Z" },
  { id: "pmem-13", project_id: "proj-2", user_id: "usr-user12", project_role: "Member", joined_at: "2026-06-15T09:00:00Z" },
  { id: "pmem-14", project_id: "proj-2", user_id: "usr-user26", project_role: "Member", joined_at: "2026-06-15T09:00:00Z" },

  { id: "pmem-15", project_id: "proj-3", user_id: "usr-hr", project_role: "PM", joined_at: "2026-07-01T08:00:00Z" },
  { id: "pmem-16", project_id: "proj-3", user_id: "usr-admin", project_role: "Member", joined_at: "2026-07-01T09:00:00Z" },
  { id: "pmem-17", project_id: "proj-3", user_id: "usr-user14", project_role: "Member", joined_at: "2026-07-01T09:00:00Z" },
  { id: "pmem-18", project_id: "proj-3", user_id: "usr-user15", project_role: "Member", joined_at: "2026-07-01T09:00:00Z" },
  { id: "pmem-19", project_id: "proj-3", user_id: "usr-user29", project_role: "Member", joined_at: "2026-07-01T09:00:00Z" }
];

const INITIAL_TASKS = [
  { 
    id: "task-1", 
    project_id: "proj-1", 
    title: "Thiết kế cơ sơ dữ liệu CRM", 
    description: "Thiết kế các bảng MySQL cho CRM và tạo mối quan hệ ràng buộc.", 
    assignee_id: "usr-member1", 
    priority: "Cao", 
    status: "Done", 
    due_date: "2026-07-20"
  },
  { 
    id: "task-2", 
    project_id: "proj-1", 
    title: "Xây dựng API đăng nhập & phân quyền", 
    description: "Cấu hình JWT & Middleware xác thực người dùng.", 
    assignee_id: "usr-user07", 
    priority: "Cao", 
    status: "InProgress", 
    due_date: "2026-07-25"
  },
  { 
    id: "task-3", 
    project_id: "proj-1", 
    title: "Tạo UI giao diện Dashboard CRM", 
    description: "Vẽ giao diện dashboard hiển thị các biểu đồ thống kê.", 
    assignee_id: "usr-user13", 
    priority: "Trung bình", 
    status: "Review", 
    due_date: "2026-07-15"
  },
  { 
    id: "task-4", 
    project_id: "proj-2", 
    title: "Phác thảo Wireframe UI/UX E-Commerce", 
    description: "Vẽ Wireframe chi tiết luồng thanh toán và giỏ hàng.", 
    assignee_id: "usr-pm", 
    priority: "Cao", 
    status: "Done", 
    due_date: "2026-07-10"
  },
  { 
    id: "task-5", 
    project_id: "proj-2", 
    title: "Tích hợp cổng thanh toán Sandbox", 
    description: "Cài đặt và cấu hình Viettel Pay SDK Sandbox.", 
    assignee_id: "usr-user09", 
    priority: "Cao", 
    status: "Todo", 
    due_date: "2026-08-01"
  },
  { 
    id: "task-6", 
    project_id: "proj-2", 
    title: "Viết API giỏ hàng và đặt hàng", 
    description: "Phát triển API thêm/sửa/xóa sản phẩm trong giỏ hàng và tạo đơn hàng.", 
    assignee_id: "usr-user10", 
    priority: "Trung bình", 
    status: "InProgress", 
    due_date: "2026-07-30"
  },
  { 
    id: "task-7", 
    project_id: "proj-3", 
    title: "Sàng lọc hồ sơ ứng viên Tech Lead", 
    description: "Đánh giá CV của các ứng viên nộp qua cổng tuyển dụng.", 
    assignee_id: "usr-user14", 
    priority: "Cao", 
    status: "InProgress", 
    due_date: "2026-07-18"
  },
  { 
    id: "task-8", 
    project_id: "proj-3", 
    title: "Lên lịch phỏng vấn vòng 1", 
    description: "Gửi thư mời phỏng vấn và sắp xếp lịch hẹn cho ứng viên phù hợp.", 
    assignee_id: "usr-user15", 
    priority: "Trung bình", 
    status: "Todo", 
    due_date: "2026-07-22"
  }
];

const INITIAL_SUBTASKS = [
  { id: "sub-1", task_id: "task-1", title: "Vẽ sơ đồ ERD chi tiết", is_done: true },
  { id: "sub-2", task_id: "task-1", title: "Tạo script SQL khởi tạo", is_done: true },
  { id: "sub-3", task_id: "task-2", title: "Cấu hình thư viện jwt", is_done: true },
  { id: "sub-4", task_id: "task-2", title: "Viết middleware phân quyền", is_done: false },
  { id: "sub-5", task_id: "task-3", title: "Thiết kế giao diện chart doanh thu", is_done: false }
];

const INITIAL_COMMENTS = [
  { id: "comm-1", task_id: "task-1", user_id: "usr-pm", content: "Báo cáo rất chi tiết, tôi đã duyệt tài liệu này gửi cho khách hàng.", created_at: "2026-06-14T15:30:00Z" },
  { id: "comm-2", task_id: "task-2", user_id: "usr-admin", content: "Nhớ chú ý kiểm tra SQL injection khi viết câu lệnh truy vấn nhé.", created_at: "2026-07-05T09:12:00Z" }
];

const INITIAL_TASK_CHATS = [
  { id: "tchat-1", task_id: "task-2", sender_id: "usr-pm", content: "Tiến độ API auth thế nào rồi?", created_at: "2026-07-06T09:00:00Z" },
  { id: "tchat-2", task_id: "task-2", sender_id: "usr-user07", content: "Em đang làm và viết jwt sign rồi anh.", created_at: "2026-07-06T09:05:00Z" }
];

const INITIAL_PROJECT_ISSUES = [
  { id: 1, issue_key: "CRM-101", project_id: "proj-1", summary: "Thiết kế Dashboard hiển thị KPI doanh số", description: "Xây dựng layout Dashboard hiển thị các biểu đồ doanh thu và thống kê khách hàng.", type: "STORY", status: "DONE", priority: "HIGH", reporter_id: "usr-sales", assignee_id: "usr-pm", epic_id: null, parent_id: null, created_at: "2026-07-01T08:00:00Z", updated_at: "2026-07-02T10:00:00Z" },
  { id: 2, issue_key: "CRM-102", project_id: "proj-1", summary: "Lỗi null pointer exception khi lưu khách hàng không có email", description: "API trả về status 500 khi lưu một record khách hàng mới không chứa trường email.", type: "BUG", status: "IN_PROGRESS", priority: "CRITICAL", reporter_id: "usr-user11", assignee_id: "usr-member1", epic_id: null, parent_id: null, created_at: "2026-07-05T09:00:00Z", updated_at: "2026-07-05T11:00:00Z" },
  { id: 3, issue_key: "PAY-101", project_id: "proj-2", summary: "Cập nhật SSL certificate cho sandbox API", description: "Cần cập nhật cấu hình SSL mới cho server sandbox để tránh lỗi kết nối TLS từ cổng thanh toán.", type: "TASK", status: "TO_DO", priority: "MEDIUM", reporter_id: "usr-user23", assignee_id: "usr-user09", epic_id: null, parent_id: null, created_at: "2026-07-06T10:00:00Z", updated_at: "2026-07-06T10:00:00Z" }
];

const INITIAL_ISSUE_COMMENTS = [
  { id: 1, issue_id: 1, user_id: "usr-member1", content: "Em đã hoàn thành thiết kế Figma và React rồi, nhờ anh review nhé.", created_at: "2026-07-02T09:00:00Z", updated_at: "2026-07-02T09:00:00Z" },
  { id: 2, issue_id: 2, user_id: "usr-pm", content: "Hãy kiểm tra lại validation ở tầng DTO trước khi lưu database nhé.", created_at: "2026-07-05T10:00:00Z", updated_at: "2026-07-05T10:00:00Z" }
];

const INITIAL_ISSUE_HISTORY = [
  { id: 1, issue_id: 1, user_id: "usr-pm", field_changed: "status", old_value: "TO_DO", new_value: "DONE", changed_at: "2026-07-02T10:00:00Z" },
  { id: 2, issue_id: 2, user_id: "usr-member1", field_changed: "status", old_value: "TO_DO", new_value: "IN_PROGRESS", changed_at: "2026-07-05T11:00:00Z" }
];

const INITIAL_CHAT_ROOMS = [
  { id: "room-global", type: "global", name: "💬 Kênh thảo luận toàn công ty", project_id: null, created_at: "2026-01-01T00:00:00Z" },
  { id: "room-crm", type: "project", name: "📂 Dự án CRM - Thảo luận chung", project_id: "proj-1", created_at: "2026-06-01T08:00:00Z" },
  { id: "room-ecommerce", type: "project", name: "📂 Dự án Mobile App - Kỹ thuật", project_id: "proj-2", created_at: "2026-06-15T08:00:00Z" },
  { id: "room-recruitment", type: "project", name: "📂 Tuyển dụng 2026 - Thảo luận chung", project_id: "proj-3", created_at: "2026-07-01T08:00:00Z" }
];

const INITIAL_CHAT_ROOM_MEMBERS = [
  { id: "crm-1", room_id: "room-global", user_id: "usr-admin", joined_at: "2026-01-01T00:00:00Z", last_read_at: "2026-07-07T04:00:00Z" },
  { id: "crm-2", room_id: "room-global", user_id: "usr-hr", joined_at: "2026-01-01T00:00:00Z", last_read_at: "2026-07-07T04:00:00Z" },
  { id: "crm-3", room_id: "room-global", user_id: "usr-pm", joined_at: "2026-01-01T00:00:00Z", last_read_at: "2026-07-07T04:00:00Z" },
  { id: "crm-4", room_id: "room-global", user_id: "usr-sales", joined_at: "2026-01-01T00:00:00Z", last_read_at: "2026-07-07T04:00:00Z" },
  { id: "crm-5", room_id: "room-global", user_id: "usr-bod", joined_at: "2026-01-01T00:00:00Z", last_read_at: "2026-07-07T04:00:00Z" },
  { id: "crm-6", room_id: "room-global", user_id: "usr-member1", joined_at: "2026-01-01T00:00:00Z", last_read_at: "2026-07-07T04:00:00Z" },
  { id: "crm-7", room_id: "room-global", user_id: "usr-member2", joined_at: "2026-01-01T00:00:00Z", last_read_at: "2026-07-07T04:00:00Z" },
  
  { id: "crm-8", room_id: "room-crm", user_id: "usr-pm", joined_at: "2026-06-01T09:00:00Z", last_read_at: "2026-07-07T04:00:00Z" },
  { id: "crm-9", room_id: "room-crm", user_id: "usr-member1", joined_at: "2026-06-02T10:00:00Z", last_read_at: "2026-07-07T04:00:00Z" },
  { id: "crm-10", room_id: "room-crm", user_id: "usr-user07", joined_at: "2026-06-02T11:00:00Z", last_read_at: "2026-07-07T04:00:00Z" },
  { id: "crm-11", room_id: "room-crm", user_id: "usr-user08", joined_at: "2026-06-02T11:00:00Z", last_read_at: "2026-07-07T04:00:00Z" },

  { id: "crm-12", room_id: "room-ecommerce", user_id: "usr-user23", joined_at: "2026-06-15T08:00:00Z", last_read_at: "2026-07-07T04:00:00Z" },
  { id: "crm-13", room_id: "room-ecommerce", user_id: "usr-pm", joined_at: "2026-06-15T09:00:00Z", last_read_at: "2026-07-07T04:00:00Z" },
  { id: "crm-14", room_id: "room-ecommerce", user_id: "usr-member1", joined_at: "2026-06-15T09:00:00Z", last_read_at: "2026-07-07T04:00:00Z" }
];

const INITIAL_MESSAGES = [
  { id: "msg-1", room_id: "room-global", sender_id: "usr-admin", content: "Chào mừng mọi người đến với cổng quản trị doanh nghiệp mới của TopEng. Hãy cập nhật công việc hàng ngày của mình lên hệ thống nhé!", is_edited: false, created_at: "2026-07-06T08:30:00Z", attachments: [] },
  { id: "msg-2", room_id: "room-global", sender_id: "usr-pm", content: "Dạ vâng chị. Toàn bộ các task cho dự án CRM và E-Commerce đã được cập nhật.", is_edited: false, created_at: "2026-07-06T09:00:00Z", attachments: [] }
];

const INITIAL_DOCUMENT_CATEGORIES = [
  { id: "cat-training", name: "Tài liệu đào tạo", type: "training" },
  { id: "cat-general", name: "Tài liệu chung", type: "general" },
  { id: "cat-lifecycle", name: "Tài liệu vòng đời dự án", type: "project_lifecycle" }
];

const INITIAL_DOCUMENTS = [
  { id: "doc-1", title: "Quy trình Onboarding thành viên mới", category_id: "cat-training", project_id: null, uploaded_by: "usr-admin", project_phase: null, created_at: "2026-01-15T09:00:00Z" },
  { id: "doc-2", title: "Nội quy & Chính sách bảo mật thông tin", category_id: "cat-general", project_id: null, uploaded_by: "usr-admin", project_phase: null, created_at: "2026-01-20T10:00:00Z" },
  { id: "doc-3", title: "Tài liệu Thiết kế Kiến trúc CRM", category_id: "cat-lifecycle", project_id: "proj-1", uploaded_by: "usr-pm", project_phase: "Lập kế hoạch", created_at: "2026-06-10T14:00:00Z" },
  { id: "doc-4", title: "Đặc tả yêu cầu nghiệp vụ E-Commerce (SRS)", category_id: "cat-lifecycle", project_id: "proj-2", uploaded_by: "usr-user23", project_phase: "Khởi tạo", created_at: "2026-06-18T10:00:00Z" },
  { id: "doc-5", title: "Kế hoạch Tuyển dụng Kỹ sư AI 2026", category_id: "cat-general", project_id: "proj-3", uploaded_by: "usr-hr", project_phase: "Lập kế hoạch", created_at: "2026-07-02T15:00:00Z" }
];

const INITIAL_DOCUMENT_VERSIONS = [
  { id: "ver-1", document_id: "doc-1", version_number: 1, file_url: "Onboarding_Process_v1.pdf", file_size: "1.2 MB", uploaded_by: "usr-admin", created_at: "2026-01-15T09:00:00Z" },
  { id: "ver-2", document_id: "doc-2", version_number: 1, file_url: "Security_Policy_v1.pdf", file_size: "2.4 MB", uploaded_by: "usr-admin", created_at: "2026-01-20T10:00:00Z" },
  { id: "ver-3", document_id: "doc-3", version_number: 1, file_url: "CRM_Architecture_v1.pdf", file_size: "4.8 MB", uploaded_by: "usr-pm", created_at: "2026-06-10T14:00:00Z" },
  { id: "ver-4", document_id: "doc-4", version_number: 2, file_url: "Ecommerce_SRS_v2.pdf", file_size: "5.1 MB", uploaded_by: "usr-user23", created_at: "2026-06-18T10:00:00Z" },
  { id: "ver-5", document_id: "doc-5", version_number: 1, file_url: "AI_Recruitment_Plan_2026.pdf", file_size: "1.5 MB", uploaded_by: "usr-hr", created_at: "2026-07-02T15:00:00Z" }
];

const INITIAL_ACTIVITY_LOGS = [
  { id: "log-1", user_id: "usr-admin", action_type: "CREATE", entity_type: "Project", entity_id: "proj-1", description: "đã tạo dự án 'Xây dựng Hệ thống CRM Khách hàng'", metadata: {}, created_at: "2026-06-01T08:00:00Z" }
];

const INITIAL_NOTIFICATIONS = [
  { id: "not-1", user_id: "usr-member1", title: "Công việc mới được giao", content: "Bạn được giao công việc 'Thiết kế cơ sơ dữ liệu CRM' trong dự án CRM.", link_url: "#tasks", is_read: false, created_at: "2026-06-02T10:05:00Z" }
];

// Helper to save to localStorage safely in Next.js
function saveToLocalStorage(key, data) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`ems_${key}`, JSON.stringify(data));
  }
}

// Helper to load from localStorage safely in Next.js
function loadFromLocalStorage(key, defaultValue) {
  if (typeof window === "undefined") return defaultValue;
  const data = localStorage.getItem(`ems_${key}`);
  if (data === null) {
    saveToLocalStorage(key, defaultValue);
    return defaultValue;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error(`Error parsing ems_${key}`, e);
    return defaultValue;
  }
}

export const MockDB = {
  isEnabled: () => true,
  client: {
    auth: {
      getSession: async () => {
        if (typeof window === 'undefined') return { data: { session: null } };
        const id = localStorage.getItem('ems_current_user_id');
        if (!id) return { data: { session: null } };
        const users = loadFromLocalStorage("users", INITIAL_USERS);
        const u = users.find(usr => usr.id === id);
        if (!u) return { data: { session: null } };
        return { data: { session: { user: { id: u.id, email: u.email, full_name: u.name, role_name: u.system_role } } } };
      },
      signInWithPassword: async ({ email, password }) => {
        const users = loadFromLocalStorage("users", INITIAL_USERS);
        const u = users.find(usr => usr.email === email);
        if (!u) return { error: new Error('Không tìm thấy tài khoản email này.') };
        localStorage.setItem('ems_current_user_id', u.id);
        const session = { user: { id: u.id, email: u.email, full_name: u.name, role_name: u.system_role } };
        authListeners.forEach(cb => cb('SIGNED_IN', session));
        return { data: { session }, error: null };
      },
      signUp: async ({ email, password, options }) => {
        const users = loadFromLocalStorage("users", INITIAL_USERS);
        const fullName = options?.data?.full_name || email.split('@')[0];
        const newU = { id: `usr-${Date.now()}`, name: fullName, email, system_role: 'Nhân viên (Staff)', color: '#1E40AF' };
        users.push(newU);
        saveToLocalStorage("users", users);
        localStorage.setItem('ems_current_user_id', newU.id);
        const session = { user: { id: newU.id, email, full_name: fullName, role_name: 'Nhân viên (Staff)' } };
        authListeners.forEach(cb => cb('SIGNED_IN', session));
        return { data: { user: { id: newU.id, email } }, error: null };
      },
      signOut: async () => {
        localStorage.removeItem('ems_current_user_id');
        authListeners.forEach(cb => cb('SIGNED_OUT', null));
        return { error: null };
      },
      onAuthStateChange: (cb) => {
        authListeners.push(cb);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                authListeners = authListeners.filter(l => l !== cb);
              }
            }
          }
        };
      }
    }
  },

  getUsers: async () => loadFromLocalStorage("users", INITIAL_USERS),
  setUsers: (data) => saveToLocalStorage("users", data),
  
  getProjects: async () => loadFromLocalStorage("projects", INITIAL_PROJECTS),
  setProjects: (data) => saveToLocalStorage("projects", data),
  
  getProjectMembers: async () => loadFromLocalStorage("project_members", INITIAL_PROJECT_MEMBERS),
  setProjectMembers: (data) => saveToLocalStorage("project_members", data),
  
  getTasks: async () => loadFromLocalStorage("tasks", INITIAL_TASKS),
  setTasks: (data) => saveToLocalStorage("tasks", data),
  
  getSubtasks: async () => loadFromLocalStorage("subtasks", INITIAL_SUBTASKS),
  setSubtasks: (data) => saveToLocalStorage("subtasks", data),
  
  getComments: async () => loadFromLocalStorage("comments", INITIAL_COMMENTS),
  setComments: (data) => saveToLocalStorage("comments", data),
  
  getChatRooms: async () => loadFromLocalStorage("chat_rooms", INITIAL_CHAT_ROOMS),
  setChatRooms: (data) => saveToLocalStorage("chat_rooms", data),
  
  getChatRoomMembers: async () => loadFromLocalStorage("chat_room_members", INITIAL_CHAT_ROOM_MEMBERS),
  setChatRoomMembers: (data) => saveToLocalStorage("chat_room_members", data),
  
  getMessages: async () => loadFromLocalStorage("messages", INITIAL_MESSAGES),
  setMessages: (data) => saveToLocalStorage("messages", data),
  
  getDocumentCategories: async () => loadFromLocalStorage("document_categories", INITIAL_DOCUMENT_CATEGORIES),
  setDocumentCategories: (data) => saveToLocalStorage("document_categories", data),
  
  getDocuments: async () => loadFromLocalStorage("documents", INITIAL_DOCUMENTS),
  setDocuments: (data) => saveToLocalStorage("documents", data),
  
  getDocumentVersions: async () => loadFromLocalStorage("document_versions", INITIAL_DOCUMENT_VERSIONS),
  setDocumentVersions: (data) => saveToLocalStorage("document_versions", data),
  
  getActivityLogs: async () => loadFromLocalStorage("activity_logs", INITIAL_ACTIVITY_LOGS).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)),
  setActivityLogs: (data) => saveToLocalStorage("activity_logs", data),
  
  getNotifications: async (userId) => {
    const list = loadFromLocalStorage("notifications", INITIAL_NOTIFICATIONS);
    return list.filter(n => n.user_id === userId).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  },
  setNotifications: (data) => saveToLocalStorage("notifications", data),

  // Unified write adapters matching MySQLAdapter
  saveProject: async function(proj, membersList = []) {
    const list = await this.getProjects();
    let resultProj;
    if (proj.id) {
      const idx = list.findIndex(p => p.id === proj.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...proj };
        resultProj = list[idx];
      }
    } else {
      proj.id = `proj-${Date.now()}`;
      proj.is_public = proj.is_public || false;
      list.push(proj);
      resultProj = proj;

      // Create project chat room
      const allRooms = await this.getChatRooms();
      allRooms.push({
        id: `room-proj-${Date.now()}`,
        type: 'project',
        name: `📂 Dự án: ${proj.name}`,
        project_id: proj.id,
        created_at: new Date().toISOString()
      });
      this.setChatRooms(allRooms);
    }
    this.setProjects(list);

    if (membersList.length > 0) {
      let pMembers = await this.getProjectMembers();
      const oldUserIds = pMembers.filter(m => m.project_id === resultProj.id).map(m => m.user_id);
      if (proj.id) {
        pMembers = pMembers.filter(m => m.project_id !== proj.id);
      }
      const notifications = loadFromLocalStorage("notifications", INITIAL_NOTIFICATIONS);
      membersList.forEach(m => {
        pMembers.push({
          id: `pmem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          project_id: resultProj.id,
          user_id: m.user_id,
          project_role: m.project_role,
          joined_at: new Date().toISOString()
        });

        if (!oldUserIds.includes(m.user_id)) {
          notifications.push({
            id: `not-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            user_id: m.user_id,
            title: 'Bạn được thêm vào dự án mới',
            content: `Bạn vừa được thêm vào dự án "${resultProj.name}" với vai trò ${m.project_role || 'Member'}.`,
            link_url: `#projects/${resultProj.id}`,
            is_read: false,
            created_at: new Date().toISOString()
          });
        }
      });
      this.setProjectMembers(pMembers);
      saveToLocalStorage("notifications", notifications);
    }
    return resultProj;
  },

  saveTask: async function(task) {
    const list = await this.getTasks();
    if (task.id) {
      const idx = list.findIndex(t => t.id === task.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...task };
        this.setTasks(list);
        return list[idx];
      }
    } else {
      task.id = `task-${Date.now()}`;
      task.status = task.status || 'Todo';
      list.push(task);
      this.setTasks(list);
      return task;
    }
  },

  updateTaskStatus: async function(taskId, status) {
    const list = await this.getTasks();
    const idx = list.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      list[idx].status = status;
      this.setTasks(list);
      return list[idx];
    }
    return null;
  },

  saveSubtask: async function(subtask) {
    const list = await this.getSubtasks();
    if (subtask.id) {
      const idx = list.findIndex(s => s.id === subtask.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...subtask };
        this.setSubtasks(list);
        return list[idx];
      }
    } else {
      subtask.id = `sub-${Date.now()}`;
      list.push(subtask);
      this.setSubtasks(list);
      return subtask;
    }
  },

  deleteSubtask: async function(subId) {
    const list = await this.getSubtasks();
    const filtered = list.filter(s => s.id !== subId);
    this.setSubtasks(filtered);
    return true;
  },

  addComment: async function(comment) {
    const list = await this.getComments();
    comment.id = `comm-${Date.now()}`;
    comment.created_at = new Date().toISOString();
    list.push(comment);
    this.setComments(list);
    return comment;
  },

  sendMessage: async function(msg) {
    const list = await this.getMessages();
    msg.id = `msg-${Date.now()}`;
    msg.created_at = new Date().toISOString();
    msg.is_edited = false;
    msg.attachments = msg.attachments || [];
    list.push(msg);
    this.setMessages(list);
    return msg;
  },

  addMessageReaction: async function(messageId, emoji, userId) {
    return true;
  },

  saveDocument: async function(doc, version) {
    const list = await this.getDocuments();
    let resultDoc;
    if (doc.id) {
      const idx = list.findIndex(d => d.id === doc.id);
      if (idx !== -1) {
        resultDoc = list[idx];
      }
    } else {
      doc.id = `doc-${Date.now()}`;
      doc.created_at = new Date().toISOString();
      list.push(doc);
      this.setDocuments(list);
      resultDoc = doc;
    }

    const verList = await this.getDocumentVersions();
    version.id = `ver-${Date.now()}`;
    version.document_id = resultDoc.id;
    version.created_at = new Date().toISOString();
    verList.push(version);
    this.setDocumentVersions(verList);

    return resultDoc;
  },

  addProjectMember: async function(projectId, userId, projectRole) {
    const pMembers = await this.getProjectMembers();
    const newMember = {
      id: `pmem-${Date.now()}`,
      project_id: projectId,
      user_id: userId,
      project_role: projectRole,
      joined_at: new Date().toISOString()
    };
    pMembers.push(newMember);
    this.setProjectMembers(pMembers);

    // Create notification
    const projects = await this.getProjects();
    const proj = projects.find(p => p.id === projectId);
    const notifications = loadFromLocalStorage("notifications", INITIAL_NOTIFICATIONS);
    notifications.push({
      id: `not-${Date.now()}`,
      user_id: userId,
      title: 'Bạn được thêm vào dự án mới',
      content: `Bạn vừa được thêm vào dự án "${proj?.name || 'Dự án'}" với vai trò ${projectRole || 'Member'}.`,
      link_url: `#projects/${projectId}`,
      is_read: false,
      created_at: new Date().toISOString()
    });
    saveToLocalStorage("notifications", notifications);

    return newMember;
  },

  removeProjectMember: async function(projectId, userId) {
    const pMembers = await this.getProjectMembers();
    const filtered = pMembers.filter(m => !(m.project_id === projectId && m.user_id === userId));
    this.setProjectMembers(filtered);
    return true;
  },

  logActivity: async function(userId, actionType, entityType, entityId, description, metadata = {}) {
    const logs = loadFromLocalStorage("activity_logs", INITIAL_ACTIVITY_LOGS);
    const newLog = {
      id: `log-${Date.now()}`,
      user_id: userId,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      description: description,
      metadata: metadata,
      created_at: new Date().toISOString()
    };
    logs.push(newLog);
    saveToLocalStorage("activity_logs", logs);
    return newLog;
  },

  createNotification: async function(userId, title, content, linkUrl) {
    const notifications = loadFromLocalStorage("notifications", INITIAL_NOTIFICATIONS);
    const newNotification = {
      id: `not-${Date.now()}`,
      user_id: userId,
      title: title,
      content: content,
      link_url: linkUrl,
      is_read: false,
      created_at: new Date().toISOString()
    };
    notifications.push(newNotification);
    saveToLocalStorage("notifications", notifications);
    return newNotification;
  },
  
  markAllNotificationsRead: async function(userId) {
    const notifications = loadFromLocalStorage("notifications", INITIAL_NOTIFICATIONS);
    notifications.forEach(n => {
      if (n.user_id === userId) n.is_read = true;
    });
    saveToLocalStorage("notifications", notifications);
    return true;
  },

  // --- NEW ISSUES MODULE MOCK IMPLEMENTATIONS ---
  getIssues: async function(projectId, searchQuery = '', assigneeId = '', priority = '', type = '') {
    let list = loadFromLocalStorage("project_issues", INITIAL_PROJECT_ISSUES);
    if (projectId) {
      list = list.filter(i => i.project_id === projectId);
    }
    if (searchQuery) {
      list = list.filter(i => 
        (i.summary && i.summary.toLowerCase().includes(searchQuery.toLowerCase())) || 
        (i.description && i.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    if (assigneeId) {
      list = list.filter(i => i.assignee_id === assigneeId);
    }
    if (priority) {
      list = list.filter(i => i.priority === priority);
    }
    if (type) {
      list = list.filter(i => i.type === type);
    }
    return list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getIssueDetail: async function(issueId) {
    const list = loadFromLocalStorage("project_issues", INITIAL_PROJECT_ISSUES);
    const issue = list.find(i => i.id === Number(issueId) || i.id === issueId);
    if (!issue) throw new Error('Issue not found');

    const commentsList = loadFromLocalStorage("issue_comments", INITIAL_ISSUE_COMMENTS);
    const comments = commentsList.filter(c => c.issue_id === issue.id);

    const historyList = loadFromLocalStorage("issue_history", INITIAL_ISSUE_HISTORY);
    const history = historyList.filter(h => h.issue_id === issue.id);

    // Join user names
    const users = loadFromLocalStorage("users", INITIAL_USERS);
    const formatComments = comments.map(c => {
      const u = users.find(usr => usr.id === c.user_id);
      return { ...c, user_name: u ? u.name : 'Unknown User' };
    });
    const formatHistory = history.map(h => {
      const u = users.find(usr => usr.id === h.user_id);
      return { ...h, user_name: u ? u.name : 'Unknown User' };
    });

    let currentUserId = '';
    if (typeof window !== 'undefined') {
      const sessionStr = localStorage.getItem('ems_mock_session') || localStorage.getItem('ems_mysql_session');
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          currentUserId = session?.user?.id || session?.id || '';
        } catch (e) {}
      }
    }
    const locks = loadFromLocalStorage("ems_issue_locks", {});
    const existingLock = locks[issue.id];
    const now = Date.now();
    const isLocked = existingLock && existingLock.userId !== currentUserId && (now - existingLock.lockedAt) < 15000;

    return { 
      issue, 
      comments: formatComments, 
      history: formatHistory,
      lock: isLocked ? { isLocked: true, lockedBy: existingLock.userName } : { isLocked: false }
    };
  },

  lockIssue: async function(issueId, userId) {
    const locks = loadFromLocalStorage("ems_issue_locks", {});
    const now = Date.now();
    const existingLock = locks[issueId];
    if (existingLock && existingLock.userId !== userId && (now - existingLock.lockedAt) < 15000) {
      return { success: false, lockedBy: existingLock.userName, isLocked: true };
    }
    const users = loadFromLocalStorage("users", INITIAL_USERS);
    const u = users.find(usr => usr.id === userId);
    const userName = u ? u.name : 'Người dùng khác';
    locks[issueId] = { userId, userName, lockedAt: now };
    saveToLocalStorage("ems_issue_locks", locks);
    return { success: true };
  },

  unlockIssue: async function(issueId, userId) {
    const locks = loadFromLocalStorage("ems_issue_locks", {});
    const existingLock = locks[issueId];
    if (existingLock && existingLock.userId === userId) {
      delete locks[issueId];
      saveToLocalStorage("ems_issue_locks", locks);
    }
    return { success: true };
  },

  createIssue: async function(issue) {
    const list = loadFromLocalStorage("project_issues", INITIAL_PROJECT_ISSUES);
    const newId = list.length > 0 ? Math.max(...list.map(i => Number(i.id) || 0)) + 1 : 1;

    // Get project key (or compute it)
    const projects = loadFromLocalStorage("projects", INITIAL_PROJECTS);
    const proj = projects.find(p => p.id === issue.project_id);
    const projKey = proj ? (proj.project_key || 'PRJ') : 'PRJ';

    // Count issues for this project
    const projIssuesCount = list.filter(i => i.project_id === issue.project_id).length;
    const issueKey = `${projKey}-${101 + projIssuesCount}`;

    const newIssue = {
      id: newId,
      issue_key: issueKey,
      project_id: issue.project_id,
      summary: issue.summary,
      description: issue.description || '',
      type: issue.type || 'TASK',
      status: issue.status || 'TO_DO',
      priority: issue.priority || 'MEDIUM',
      reporter_id: issue.reporter_id,
      assignee_id: issue.assignee_id || null,
      epic_id: issue.epic_id || null,
      parent_id: issue.parent_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    list.push(newIssue);
    saveToLocalStorage("project_issues", list);

    // History logging
    const history = loadFromLocalStorage("issue_history", INITIAL_ISSUE_HISTORY);
    history.push({
      id: history.length + 1,
      issue_id: newId,
      user_id: issue.reporter_id,
      field_changed: 'created',
      old_value: null,
      new_value: issueKey,
      changed_at: new Date().toISOString()
    });
    saveToLocalStorage("issue_history", history);

    return { success: true, id: newId, issue_key: issueKey };
  },

  updateIssue: async function(issue, userId) {
    const locks = loadFromLocalStorage("ems_issue_locks", {});
    const existingLock = locks[issue.id];
    if (existingLock && existingLock.userId !== userId && (Date.now() - existingLock.lockedAt) < 15000) {
      throw new Error(`Issue is locked by ${existingLock.userName}`);
    }

    const list = loadFromLocalStorage("project_issues", INITIAL_PROJECT_ISSUES);
    const idx = list.findIndex(i => i.id === Number(issue.id) || i.id === issue.id);
    if (idx === -1) throw new Error('Issue not found');

    const old = list[idx];
    let finalStatus = issue.status;
    try {
      if (issue.description) {
        const parsed = JSON.parse(issue.description);
        if (parsed && Array.isArray(parsed.issueTasks)) {
          const hasInProgress = parsed.issueTasks.some(t => t.status === 'Đang thực hiện');
          if (hasInProgress && finalStatus === 'TO_DO') {
            finalStatus = 'IN_PROGRESS';
          }
        }
      }
    } catch (e) {
      // ignore
    }

    const updated = {
      ...old,
      summary: issue.summary,
      description: issue.description,
      type: issue.type,
      status: finalStatus,
      priority: issue.priority,
      assignee_id: issue.assignee_id,
      epic_id: issue.epic_id,
      parent_id: issue.parent_id,
      updated_at: new Date().toISOString()
    };

    list[idx] = updated;
    saveToLocalStorage("project_issues", list);

    // History logs
    const history = loadFromLocalStorage("issue_history", INITIAL_ISSUE_HISTORY);
    const trackChange = (field, oldVal, newVal) => {
      if (oldVal !== newVal) {
        history.push({
          id: history.length + 1,
          issue_id: old.id,
          user_id: userId,
          field_changed: field,
          old_value: oldVal ? String(oldVal) : null,
          new_value: newVal ? String(newVal) : null,
          changed_at: new Date().toISOString()
        });
      }
    };

    trackChange('summary', old.summary, issue.summary);
    trackChange('description', old.description, issue.description);
    trackChange('type', old.type, issue.type);
    trackChange('status', old.status, finalStatus);
    trackChange('priority', old.priority, issue.priority);
    trackChange('assignee_id', old.assignee_id, issue.assignee_id);
    trackChange('epic_id', old.epic_id, issue.epic_id);
    trackChange('parent_id', old.parent_id, issue.parent_id);

    saveToLocalStorage("issue_history", history);
    return true;
  },

  updateIssueStatus: async function(issueId, status, userId) {
    const locks = loadFromLocalStorage("ems_issue_locks", {});
    const existingLock = locks[issueId];
    if (existingLock && existingLock.userId !== userId && (Date.now() - existingLock.lockedAt) < 15000) {
      throw new Error(`Issue is locked by ${existingLock.userName}`);
    }

    const list = loadFromLocalStorage("project_issues", INITIAL_PROJECT_ISSUES);
    const idx = list.findIndex(i => i.id === Number(issueId) || i.id === issueId);
    if (idx === -1) throw new Error('Issue not found');

    const old = list[idx];
    if (old.status !== status) {
      list[idx].status = status;

      let updatedDescription = old.description;
      try {
        if (old.description) {
          const parsed = JSON.parse(old.description);
          if (parsed && Array.isArray(parsed.issueTasks)) {
            parsed.issueTasks = parsed.issueTasks.map(t => {
              if (status === 'DONE') {
                return { ...t, status: 'Hoàn thành' };
              } else if (status === 'TO_DO') {
                return { ...t, status: 'Chưa thực hiện' };
              }
              return t;
            });
            updatedDescription = JSON.stringify(parsed);
          }
        }
      } catch (e) {
        // ignore
      }
      list[idx].description = updatedDescription;
      list[idx].updated_at = new Date().toISOString();
      saveToLocalStorage("project_issues", list);

      const history = loadFromLocalStorage("issue_history", INITIAL_ISSUE_HISTORY);
      history.push({
        id: history.length + 1,
        issue_id: old.id,
        user_id: userId,
        field_changed: 'status',
        old_value: old.status,
        new_value: status,
        changed_at: new Date().toISOString()
      });
      saveToLocalStorage("issue_history", history);
    }
    return true;
  },

  deleteIssue: async function(issueId) {
    const list = loadFromLocalStorage("project_issues", INITIAL_PROJECT_ISSUES);
    const filtered = list.filter(i => i.id !== Number(issueId) && i.id !== issueId);
    saveToLocalStorage("project_issues", filtered);
    return true;
  },

  addComment: async function(issueId, userId, content) {
    const list = loadFromLocalStorage("issue_comments", INITIAL_ISSUE_COMMENTS);
    const newId = list.length > 0 ? Math.max(...list.map(c => Number(c.id) || 0)) + 1 : 1;
    const newComment = {
      id: newId,
      issue_id: Number(issueId) || issueId,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    list.push(newComment);
    saveToLocalStorage("issue_comments", list);
    return { success: true, commentId: newId };
  },

  deleteComment: async function(commentId) {
    const list = loadFromLocalStorage("issue_comments", INITIAL_ISSUE_COMMENTS);
    const filtered = list.filter(c => c.id !== Number(commentId) && c.id !== commentId);
    saveToLocalStorage("issue_comments", filtered);
    return true;
  },

  getIssueTags: async function(issueId) {
    return [];
  },

  saveIssue: async function(issue, taggedUserIds = []) {
    return { success: true };
  },

  // --- NEW TASK CHATS MOCK IMPLEMENTATIONS ---
  getTaskChats: async function(taskId) {
    const list = loadFromLocalStorage("task_chats", INITIAL_TASK_CHATS);
    return list.filter(c => c.task_id === taskId).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  },

  sendTaskChat: async function(chat) {
    const list = loadFromLocalStorage("task_chats", INITIAL_TASK_CHATS);
    chat.id = `tchat-${Date.now()}`;
    chat.created_at = new Date().toISOString();
    list.push(chat);
    saveToLocalStorage("task_chats", list);
    return chat;
  },

  markNotificationRead: async function(notificationId) {
    const notifications = loadFromLocalStorage("notifications", INITIAL_NOTIFICATIONS);
    const found = notifications.find(n => n.id === notificationId);
    if (found) {
      found.is_read = true;
      saveToLocalStorage("notifications", notifications);
    }
    return true;
  },

  createDirectChatRoom: async function(userId1, userId2, roomName) {
    const rooms = await this.getChatRooms();
    const roomId = `room-direct-${Date.now()}`;
    rooms.push({
      id: roomId,
      type: 'direct',
      name: roomName,
      project_id: null,
      created_at: new Date().toISOString()
    });
    this.setChatRooms(rooms);

    const members = await this.getChatRoomMembers();
    members.push(
      { id: `crm-${Date.now()}-1`, room_id: roomId, user_id: userId1, joined_at: new Date().toISOString(), last_read_at: new Date().toISOString() },
      { id: `crm-${Date.now()}-2`, room_id: roomId, user_id: userId2, joined_at: new Date().toISOString(), last_read_at: new Date().toISOString() }
    );
    this.setChatRoomMembers(members);
    return true;
  },

  getRoles: async function() {
    const defaultRoles = [
      { id: 'role-admin', name: 'Quản trị viên (Admin)' },
      { id: 'role-hr', name: 'Nhân sự (HR)' },
      { id: 'role-staff', name: 'Nhân viên (Staff)' },
      { id: 'role-leader', name: 'Leader/Part Leader' },
      { id: 'role-sales', name: 'Kinh doanh (Sales)' },
      { id: 'role-bod', name: 'Ban điều hành (BOD)' }
    ];
    if (typeof window === 'undefined') return defaultRoles;
    const stored = localStorage.getItem("ems_roles");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error(e);
      }
    }
    return defaultRoles;
  },

  getRolesPermissions: async function() {
    const roles = await this.getRoles();
    const DEFAULT_PERMISSIONS = [
      { key: "view_dashboard", name: "Xem Dashboard", module: "Dashboard" },
      { key: "view_all_projects", name: "Xem toàn bộ dự án", module: "Dự án" },
      { key: "create_project", name: "Thêm dự án mới", module: "Dự án" },
      { key: "edit_project", name: "Điều chỉnh plan dự án (sửa/xóa dự án)", module: "Dự án" },
      { key: "manage_project_members", name: "Quản lý thành viên dự án", module: "Dự án" },
      { key: "create_task", name: "Giao việc mới (Tạo Task)", module: "Công việc" },
      { key: "edit_task", name: "Chỉnh sửa nội dung công việc", module: "Công việc" },
      { key: "delete_task", name: "Xóa công việc", module: "Công việc" },
      { key: "update_task_status", name: "Cập nhật trạng thái việc (Task status)", module: "Công việc" },
      { key: "create_issue", name: "Báo cáo lỗi/vấn đề mới (Issues)", module: "Dự án" },
      { key: "edit_issue", name: "Cập nhật trạng thái Issue (Reporter/Tagged)", module: "Dự án" },
      { key: "view_documents", name: "Xem tài liệu chung và tài liệu dự án", module: "Tài liệu" },
      { key: "upload_documents", name: "Tải lên/Cập nhật tài liệu mới", module: "Tài liệu" },
      { key: "view_hr", name: "Truy cập Quản trị nhân sự", module: "Quản trị hệ thống" },
      { key: "view_activity_logs", name: "Xem nhật ký hệ thống (Log)", module: "Quản trị hệ thống" },
      { key: "chat_tag_all_global", name: "Tự động tag @all phòng chat chung", module: "Kênh Chat" },
      { key: "chat_tag_all_project", name: "Tự động tag @all phòng chat dự án", module: "Kênh Chat" },
      { key: "chat_confirm_send", name: "Hỏi xác nhận trước khi gửi tin nhắn", module: "Kênh Chat" }
    ];

    const DEFAULT_ROLE_PERMISSIONS = {
      "Quản trị viên (Admin)": [
        "view_dashboard", "view_all_projects", "create_project", "edit_project", "manage_project_members",
        "create_task", "edit_task", "delete_task", "update_task_status", "create_issue", "edit_issue",
        "view_documents", "upload_documents", "view_hr", "view_activity_logs", "chat_tag_all_global",
        "chat_tag_all_project", "chat_confirm_send"
      ],
      "Ban điều hành (BOD)": [
        "view_dashboard", "view_all_projects", "create_project", "edit_project",
        "edit_task", "delete_task", "view_documents", "chat_tag_all_global", "chat_confirm_send"
      ],
      "Leader/Part Leader": [
        "view_dashboard", "view_all_projects", "create_project", "create_task", "edit_task", "delete_task",
        "update_task_status", "create_issue", "edit_issue", "view_documents", "upload_documents",
        "chat_tag_all_project"
      ],
      "Nhân viên (Staff)": [
        "view_dashboard", "update_task_status", "create_issue", "edit_issue",
        "view_documents", "upload_documents"
      ],
      "Kinh doanh (Sales)": [
        "view_dashboard", "view_all_projects", "create_project", "edit_project",
        "update_task_status", "view_documents", "upload_documents", "chat_tag_all_global",
        "chat_tag_all_project", "chat_confirm_send"
      ],
      "Nhân sự (HR)": [
        "view_hr", "view_documents", "upload_documents", "chat_confirm_send"
      ]
    };

    if (typeof window === 'undefined') {
      return { roles, permissions: DEFAULT_PERMISSIONS, role_permissions: DEFAULT_ROLE_PERMISSIONS };
    }
    const stored = localStorage.getItem("ems_role_permissions");
    let role_permissions = DEFAULT_ROLE_PERMISSIONS;
    if (stored) {
      try {
        role_permissions = JSON.parse(stored);
      } catch (e) {
        console.error(e);
      }
    }
    return { roles, permissions: DEFAULT_PERMISSIONS, role_permissions };
  },

  saveRolesPermissions: async function(roles, rolePermissions) {
    if (typeof window === 'undefined') return true;
    localStorage.setItem("ems_roles", JSON.stringify(roles));
    localStorage.setItem("ems_role_permissions", JSON.stringify(rolePermissions));
    return true;
  },

  createUser: async function(email, password, fullName, roleId) {
    const list = await this.getUsers();
    const roles = await this.getRoles();
    const roleObj = roles.find(r => r.id === roleId || r.name === roleId);
    const systemRole = roleObj ? roleObj.name : 'Nhân viên (Staff)';
    
    const colors = ['#1E40AF', '#D97706', '#059669', '#DC2626', '#7C3AED'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    list.push({
      id: 'usr-' + Date.now(),
      name: fullName,
      email: email,
      system_role: systemRole,
      color: randomColor
    });
    this.setUsers(list);
    return true;
  },

  testConnection: async function() {
    return { success: true, message: 'Kết nối MockDB thành công!' };
  },

  getCustomers: async function() {
    return [
      { customer_id: 'cust-vng', customer_name: 'Công ty Cổ phần VNG (VNG Corporation)' },
      { customer_id: 'cust-viettel', customer_name: 'Tập đoàn Công nghiệp - Viễn thông Quân đội (Viettel)' }
    ];
  },

  getDepartments: async function() {
    return [
      { department_id: 'dept-dev', name: 'Phòng Phát triển Phần mềm (R&D)' },
      { department_id: 'dept-hr', name: 'Phòng Hành chính Nhân sự (HR)' },
      { department_id: 'dept-sales', name: 'Phòng Kinh doanh (Sales)' },
      { department_id: 'dept-mkt', name: 'Phòng Truyền thông Marketing' },
      { department_id: 'dept-finance', name: 'Phòng Kế toán Tài chính' }
    ];
  },

  uploadFile: async function(file) {
    return { success: true, fileUrl: `/uploads/mock-${Date.now()}-${file.name}` };
  },

  getDailyReports: async function(userId, userRole) {
    const list = loadFromLocalStorage("daily_reports", []);
    const users = loadFromLocalStorage("users", INITIAL_USERS);
    
    const isAdminOrManagement = 
      userRole?.includes("Admin") || 
      userRole?.includes("HR") || 
      userRole?.includes("BOD") || 
      userRole?.includes("Leader");

    let filtered = list;
    if (!isAdminOrManagement && userId) {
      filtered = list.filter(r => r.user_id === userId);
    }
    
    return filtered.map(r => {
      const u = users.find(usr => usr.id === r.user_id);
      return {
        ...r,
        user_name: u ? u.name : 'Unknown',
        user_email: u ? u.email : '',
        user_role: u ? u.system_role : ''
      };
    });
  },

  createDailyReport: async function(report) {
    const list = loadFromLocalStorage("daily_reports", []);
    const newId = list.length > 0 ? Math.max(...list.map(r => r.id)) + 1 : 1;
    const newReport = {
      id: newId,
      user_id: report.userId,
      project_id: report.projectId || null,
      content: report.content,
      file_url: report.fileUrl || null,
      created_at: new Date().toISOString()
    };
    list.push(newReport);
    saveToLocalStorage("daily_reports", list);
    
    // Log activity
    const logs = loadFromLocalStorage("activity_logs", INITIAL_ACTIVITY_LOGS);
    logs.push({
      id: logs.length + 1,
      user_id: report.userId,
      action_type: "CREATE_REPORT",
      entity_type: "DailyReport",
      description: `đã gửi báo cáo ngày mới`,
      create_at: new Date().toISOString()
    });
    saveToLocalStorage("activity_logs", logs);
    
    return { success: true, report: newReport };
  },

  updateDailyReportStatus: async function(reportId, status, comment) {
    const list = loadFromLocalStorage("daily_reports", []);
    const idx = list.findIndex(r => r.id === parseInt(reportId));
    if (idx !== -1) {
      list[idx].status = status;
      list[idx].comment = comment || null;
      saveToLocalStorage("daily_reports", list);
    }
    return { success: true };
  },

  resetAll: () => {
    saveToLocalStorage("users", INITIAL_USERS);
    saveToLocalStorage("projects", INITIAL_PROJECTS);
    saveToLocalStorage("project_members", INITIAL_PROJECT_MEMBERS);
    saveToLocalStorage("tasks", INITIAL_TASKS);
    saveToLocalStorage("subtasks", INITIAL_SUBTASKS);
    saveToLocalStorage("comments", INITIAL_COMMENTS);
    saveToLocalStorage("task_chats", INITIAL_TASK_CHATS);
    saveToLocalStorage("project_issues", INITIAL_PROJECT_ISSUES);
    saveToLocalStorage("project_issue_tags", INITIAL_PROJECT_ISSUE_TAGS);
    saveToLocalStorage("chat_rooms", INITIAL_CHAT_ROOMS);
    saveToLocalStorage("chat_room_members", INITIAL_CHAT_ROOM_MEMBERS);
    saveToLocalStorage("messages", INITIAL_MESSAGES);
    saveToLocalStorage("document_categories", INITIAL_DOCUMENT_CATEGORIES);
    saveToLocalStorage("documents", INITIAL_DOCUMENTS);
    saveToLocalStorage("document_versions", INITIAL_DOCUMENT_VERSIONS);
    saveToLocalStorage("activity_logs", INITIAL_ACTIVITY_LOGS);
    saveToLocalStorage("notifications", INITIAL_NOTIFICATIONS);
    saveToLocalStorage("daily_reports", []);
  }
};
