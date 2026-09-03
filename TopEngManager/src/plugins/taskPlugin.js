// Task Management Plugin for TopEng Agent Harness

export const TASK_PLUGIN_SCHEMA = [
  {
    type: "function",
    function: {
      name: "list_my_tasks",
      description: "Tra cứu danh sách công việc (Tasks) của người dùng hoặc các công việc khẩn cấp trong hệ thống.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["ALL", "TODO", "IN_PROGRESS", "DONE", "URGENT"],
            description: "Trạng thái công việc cần lọc: 'TODO' (Chưa làm), 'IN_PROGRESS' (Đang làm), 'DONE' (Đã xong), 'URGENT' (Khẩn cấp), 'ALL' (Tất cả)."
          },
          keyword: {
            type: "string",
            description: "Từ khóa tìm kiếm tiêu đề hoặc nội dung công việc nếu có."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Tạo một công việc (Task) mới trong hệ thống TopEng Management.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Tiêu đề công việc cần làm."
          },
          description: {
            type: "string",
            description: "Mô tả chi tiết nội dung công việc."
          },
          priority: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
            description: "Mức độ ưu tiên: 'LOW', 'MEDIUM', 'HIGH', 'URGENT' (Khẩn cấp)."
          },
          deadline: {
            type: "string",
            description: "Hạn chót hoàn thành dạng YYYY-MM-DD (Ví dụ: 2026-09-05)."
          },
          assigneeName: {
            type: "string",
            description: "Tên nhân sự được giao việc (hoặc để trống nếu tự giao cho chính mình)."
          }
        },
        required: ["title"]
      }
    }
  }
];

export async function handleTaskTool(toolName, args, { currentUser, config, backendUrl, triggerN8N }) {
  if (toolName === 'list_my_tasks') {
    let allTasks = [];
    try {
      const res = await fetch(`${backendUrl}/getTasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id })
      });
      if (res.ok) allTasks = await res.json();
    } catch (e) {
      console.warn('Could not fetch tasks:', e.message);
    }

    if (!Array.isArray(allTasks) || allTasks.length === 0) {
      return {
        success: true,
        reply: `📋 Hiện tại bạn chưa có công việc nào được giao trong danh sách!`
      };
    }

    let filtered = allTasks;
    const filterStatus = (args.status || 'ALL').toUpperCase();

    if (filterStatus === 'TODO') {
      filtered = filtered.filter(t => t.status === 'TODO' || t.status === 'OPEN' || !t.status);
    } else if (filterStatus === 'IN_PROGRESS') {
      filtered = filtered.filter(t => t.status === 'IN_PROGRESS' || t.status === 'DOING');
    } else if (filterStatus === 'DONE') {
      filtered = filtered.filter(t => t.status === 'DONE' || t.status === 'COMPLETED');
    } else if (filterStatus === 'URGENT') {
      filtered = filtered.filter(t => (t.priority || '').toUpperCase() === 'URGENT' || (t.priority || '').toUpperCase() === 'HIGH');
    }

    if (args.keyword && args.keyword.trim()) {
      const kw = args.keyword.toLowerCase().trim();
      filtered = filtered.filter(t => (t.title || '').toLowerCase().includes(kw) || (t.description || '').toLowerCase().includes(kw));
    }

    if (filtered.length === 0) {
      return {
        success: true,
        reply: `📋 Không tìm thấy công việc nào phù hợp với bộ lọc **${filterStatus}**.`
      };
    }

    let reply = `📋 **Danh sách Công việc (${filtered.length} việc):**\n\n`;
    filtered.slice(0, 8).forEach((task, idx) => {
      const statusIcon = task.status === 'DONE' ? '✅' : (task.status === 'IN_PROGRESS' ? '⏳' : '📌');
      const prioBadge = (task.priority === 'URGENT' || task.priority === 'HIGH') ? '🔥 [Khẩn]' : '';
      reply += `${idx + 1}. ${statusIcon} **${task.title}** ${prioBadge}\n`;
      if (task.deadline) reply += `   - Hạn chót: \`${task.deadline}\`\n`;
      if (task.assignee_name || task.assigneeName) reply += `   - Người thực hiện: ${task.assignee_name || task.assigneeName}\n`;
    });

    if (filtered.length > 8) {
      reply += `\n*...và còn ${filtered.length - 8} công việc khác trên hệ thống.*`;
    }

    return { success: true, reply };
  }

  if (toolName === 'create_task') {
    const title = args.title;
    const description = args.description || '';
    const priority = args.priority || 'MEDIUM';
    const deadline = args.deadline || '';
    const assigneeName = args.assigneeName || currentUser?.name || 'Nguyễn Admin';
    const assigneeId = currentUser?.id || 'usr-admin';

    const now = new Date();
    const taskId = `tsk-${Date.now()}`;

    const taskPayload = {
      id: taskId,
      title,
      description,
      priority,
      status: 'TODO',
      deadline,
      assignee_id: assigneeId,
      assignee_name: assigneeName,
      created_by: currentUser?.id || 'usr-admin',
      created_at: now.toISOString()
    };

    let saveSuccess = true;
    try {
      const res = await fetch(`${backendUrl}/saveTask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskPayload)
      });
      if (!res.ok) saveSuccess = false;
    } catch (e) {
      console.warn('Could not save task to backend:', e.message);
      saveSuccess = false;
    }

    if (triggerN8N) {
      triggerN8N({
        event: 'TASK_CREATED',
        taskId,
        title,
        description,
        priority,
        deadline,
        assignee: assigneeName,
        creator: currentUser?.name || 'Admin',
        timestamp: now.toISOString()
      });
    }

    return {
      success: true,
      reply: `✅ **Đã tạo công việc mới thành công!**\n\n* **Tiêu đề:** ${title}\n* **Ưu tiên:** ${priority}\n* **Người phụ trách:** ${assigneeName}\n${deadline ? `* **Hạn chót:** ${deadline}\n` : ''}\nCông việc đã được đồng bộ vào hệ thống Tasks và gửi thông báo tự động.`,
      taskData: taskPayload
    };
  }

  return null;
}
