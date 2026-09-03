const mysql = require('mysql2/promise');

const host = 'localhost';
const port = 3306;
const user = 'root';
const password = '';
const database = 'topsystemdb';

async function main() {
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

  // 1. Ensure usr-admin is added to existing projects
  const adminMemberships = [
    ['proj-crm', 'usr-admin', 'PM / Quản trị hệ thống'],
    ['proj-ecommerce', 'usr-admin', 'Giám đốc dự án'],
    ['proj-ai-agent', 'usr-admin', 'Product Owner'],
    ['proj-erp', 'usr-admin', 'Advisor']
  ];

  for (const [pId, uId, role] of adminMemberships) {
    try {
      const [rows] = await conn.query('SELECT * FROM ProjectMember WHERE project_id = ? AND userId = ?', [pId, uId]);
      if (rows.length === 0) {
        await conn.query('INSERT INTO ProjectMember (project_id, userId, role) VALUES (?, ?, ?)', [pId, uId, role]);
        console.log(`Added usr-admin to ${pId}`);
      }
    } catch (e) {
      console.warn(`Skip adding member to ${pId}:`, e.message);
    }
  }

  // 2. Add New Sample Projects
  const newProjects = [
    {
      id: 'proj-cloud-ops',
      name: 'Nền tảng Giám sát & Quản trị Đám mây TOPV Cloud Ops',
      desc: 'Hệ thống hạ tầng điều phối Kubernetes, phân tích log tập trung, cảnh báo sự cố thời gian thực và tự động co giãn tài nguyên cloud.',
      key: 'CLOUD',
      createBy: 'usr-admin',
      customerId: 'cust-viettel'
    },
    {
      id: 'proj-genai-hub',
      name: 'Hệ thống AI Chatbot & Trợ lý GenAI Doanh nghiệp',
      desc: 'Tích hợp mô hình ngôn ngữ lớn LLM, RAG tìm kiếm tài liệu thông minh, tự động hóa quy trình nghiệp vụ và chấm công.',
      key: 'GENAI',
      createBy: 'usr-admin',
      customerId: 'cust-fpt'
    },
    {
      id: 'proj-smart-office',
      name: 'Ứng dụng Smart Office & Chấm công Định vị Tự động',
      desc: 'Giải pháp văn phòng thông minh: đặt phòng họp nhận diện khuôn mặt, đặt suất ăn trưa, đăng ký xe công tác và ký số duyệt tài liệu.',
      key: 'SMART',
      createBy: 'usr-admin',
      customerId: 'cust-vng'
    }
  ];

  for (const p of newProjects) {
    const [exists] = await conn.query('SELECT project_id FROM Project WHERE project_id = ?', [p.id]);
    if (exists.length === 0) {
      await conn.query(
        'INSERT INTO Project (project_id, project_name, project_description, project_key, create_by, customer_id) VALUES (?, ?, ?, ?, ?, ?)',
        [p.id, p.name, p.desc, p.key, p.createBy, p.customerId]
      );
      console.log(`Created new project: ${p.name}`);

      // Add Project Members
      const members = [
        [p.id, 'usr-admin', 'Project Director / PM'],
        [p.id, 'usr-leader', 'Tech Lead'],
        [p.id, 'usr-dev1', 'Senior Fullstack Dev'],
        [p.id, 'usr-dev2', 'Backend Dev'],
        [p.id, 'usr-staff', 'Developer'],
        [p.id, 'usr-qa1', 'QA / Tester']
      ];
      for (const m of members) {
        await conn.query('INSERT INTO ProjectMember (project_id, userId, role) VALUES (?, ?, ?)', m);
      }
    }
  }

  // 3. Add Sample Tasks
  const sampleTasks = [
    [
      'task-cloud-1',
      'proj-cloud-ops',
      'usr-admin',
      'Thiết lập cụm Kubernetes Cluster & CI/CD Pipeline trên AWS',
      'Cấu hình auto-scaling node pool, cài đặt Ingress Controller NGINX và SSL Let\'s Encrypt tự động.',
      'Khẩn cấp',
      new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      'InProgress'
    ],
    [
      'task-cloud-2',
      'proj-cloud-ops',
      'usr-dev1',
      'Tích hợp Grafana Dashboard & Prometheus Alerting',
      'Xây dựng biểu đồ giám sát CPU, RAM, Network I/O và cảnh báo qua Telegram / Slack khi CPU > 85%.',
      'Cao',
      new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
      'Done'
    ],
    [
      'task-genai-1',
      'proj-genai-hub',
      'usr-admin',
      'Phê duyệt kiến trúc RAG Vector Database & Embedding Model',
      'Đánh giá hiệu năng Qdrant vs pgvector, tối ưu chunking size cho tài liệu quy trình PDF nội bộ.',
      'Cao',
      new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      'Todo'
    ],
    [
      'task-smart-1',
      'proj-smart-office',
      'usr-admin',
      'Thẩm định bảo mật luồng xác thực OAuth2 & SSO Google Workspace',
      'Kiểm thử lỗ hổng bảo mật Token Expiry, Refresh Token Rotation và mã hóa AES-256 cơ sở dữ liệu.',
      'Trung bình',
      new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      'InProgress'
    ]
  ];

  for (const t of sampleTasks) {
    const [exists] = await conn.query('SELECT task_id FROM Task WHERE task_id = ?', [t[0]]);
    if (exists.length === 0) {
      await conn.query(
        'INSERT INTO Task (task_id, project_id, assignee_id, title, description, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        t
      );
      console.log(`Created task: ${t[3]}`);
    }
  }

  // 4. Add Sample Issues
  const [maxIssue] = await conn.query('SELECT COALESCE(MAX(id), 0) AS maxId FROM Issue');
  let currentIssueId = maxIssue[0].maxId + 1;

  const sampleIssues = [
    [
      currentIssueId++,
      'CLOUD-101',
      'proj-cloud-ops',
      'Lỗi nghẽn I/O khi đồng bộ backup snapshot cơ sở dữ liệu lúc 0h',
      'Tốc độ ghi đĩa NVMe bị throttle do quota IOPS vượt ngưỡng. Cần nâng cấp volume sang gp3 IOPS 12000.',
      'BUG',
      'IN_PROGRESS',
      'CRITICAL',
      'usr-leader',
      'usr-admin'
    ],
    [
      currentIssueId++,
      'GENAI-201',
      'proj-genai-hub',
      'Cần cấp quyền truy cập API Key OpenAI GPT-4o cho team R&D',
      'Team R&D đang bị gián đoạn tích hợp gateway do hạn mức rate limit 10k TPM.',
      'TASK',
      'TO_DO',
      'HIGH',
      'usr-staff',
      'usr-admin'
    ],
    [
      currentIssueId++,
      'SMART-301',
      'proj-smart-office',
      'Cập nhật sơ đồ tích hợp FaceID nhận diện phòng họp tầng 4',
      'Kết nối camera IP Hikvision với backend server qua chuẩn giao tiếp RTSP streaming.',
      'STORY',
      'IN_PROGRESS',
      'MEDIUM',
      'usr-leader',
      'usr-admin'
    ]
  ];

  for (const iss of sampleIssues) {
    const [exists] = await conn.query('SELECT id FROM Issue WHERE issue_key = ?', [iss[1]]);
    if (exists.length === 0) {
      await conn.query(
        'INSERT INTO Issue (id, issue_key, project_id, summary, description, type, status, priority, reporter_id, assignee_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        iss
      );
      console.log(`Created issue: ${iss[3]}`);
    }
  }

  console.log('Sample projects, tasks, and issues successfully created!');
  await conn.end();
}

main().catch(err => {
  console.error('Error running script:', err);
  process.exit(1);
});
