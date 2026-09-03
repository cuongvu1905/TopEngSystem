// Daily Report Plugin for TopEng Agent Harness

export const DAILY_REPORT_SCHEMA = [
  {
    type: "function",
    function: {
      name: "generate_daily_report",
      description: "Tự động tổng hợp danh sách công việc đã làm trong ngày và soạn thảo một bản Báo cáo ngày (Daily Report) chuẩn quy cách TopEng.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Ngày báo cáo dạng YYYY-MM-DD (mặc định là hôm nay)."
          },
          additionalNotes: {
            type: "string",
            description: "Ghi chú thêm hoặc các khó khăn/vấn đề phát sinh nếu có."
          }
        }
      }
    }
  }
];

export async function handleDailyReportTool(toolName, args, { currentUser, config, backendUrl, triggerN8N }) {
  if (toolName === 'generate_daily_report') {
    const now = new Date();
    const reportDate = args.date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let allTasks = [];
    try {
      const res = await fetch(`${backendUrl}/getTasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id })
      });
      if (res.ok) allTasks = await res.json();
    } catch (e) {
      console.warn('Could not fetch tasks for report:', e.message);
    }

    const doneTasks = allTasks.filter(t => t.status === 'DONE' || t.status === 'COMPLETED');
    const inProgressTasks = allTasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'DOING');

    let report = `📊 **BÁO CÁO CÔNG VIỆC HÀNG NGÀY (DAILY REPORT)**\n`;
    report += `📅 **Ngày:** ${reportDate}\n`;
    report += `👤 **Nhân sự:** ${currentUser?.name || 'Nguyễn Admin'} (${currentUser?.department_name || 'Phòng R&D'})\n\n`;

    report += `### 1. Công việc đã hoàn thành hôm nay:\n`;
    if (doneTasks.length === 0) {
      report += `  - Hoàn tất các tác vụ kỹ thuật định kỳ và rà soát hệ thống.\n`;
    } else {
      doneTasks.slice(0, 5).forEach(t => {
        report += `  - ✅ **${t.title}**: ${t.description || 'Đã hoàn thành theo tiến độ.'}\n`;
      });
    }

    report += `\n### 2. Công việc đang thực hiện (Dự kiến tiếp tục ngày mai):\n`;
    if (inProgressTasks.length === 0) {
      report += `  - Tiếp tục theo dõi các dự án trọng điểm theo phân công.\n`;
    } else {
      inProgressTasks.slice(0, 5).forEach(t => {
        report += `  - ⏳ **${t.title}** ${t.deadline ? `(Hạn: ${t.deadline})` : ''}\n`;
      });
    }

    if (args.additionalNotes) {
      report += `\n### 3. Đề xuất & Vấn đề phát sinh:\n  - ${args.additionalNotes}\n`;
    } else {
      report += `\n### 3. Đề xuất & Vấn đề phát sinh:\n  - Không có vướng mắc kỹ thuật, tiến độ đảm bảo đúng kế hoạch.\n`;
    }

    report += `\n---\n*💡 Bạn có thể sao chép nội dung trên và nộp trực tiếp vào mục **Báo cáo ngày**.*`;

    if (triggerN8N) {
      triggerN8N({
        event: 'DAILY_REPORT_DRAFTED',
        user: currentUser?.name || 'Admin',
        date: reportDate,
        tasksCount: allTasks.length,
        timestamp: now.toISOString()
      });
    }

    return { success: true, reply: report };
  }

  return null;
}
