// TOPV Desktop Agent Plugin for TopEng Agent Harness
// Connects to local Python Desktop Agent (http://127.0.0.1:20188) to trigger on-screen Spotlight overlays

export const DESKTOP_AGENT_SCHEMA = [
  {
    type: "function",
    function: {
      name: "show_desktop_spotlight_guide",
      description: "Kích hoạt lớp phủ Spotlight chiếu đèn sáng và hướng dẫn từng bước trực tiếp lên màn hình phần mềm Windows (như KSystem, ERP, App nội bộ).",
      parameters: {
        type: "object",
        properties: {
          windowHint: {
            type: "string",
            description: "Tên hoặc từ khóa tiêu đề của cửa sổ ứng dụng mục tiêu (Ví dụ: 'KSystem', 'ERP', 'TopEng')."
          },
          steps: {
            type: "array",
            description: "Danh sách các bước thao tác cần chiếu đèn hướng dẫn",
            items: {
              type: "object",
              properties: {
                step: { type: "number", description: "Số thứ tự bước (1, 2, 3...)" },
                target: { type: "string", description: "Tên nút hoặc ô nhập liệu cần bấm (Ví dụ: 'Dự án', 'TOPV Division', 'Lưu')" },
                title: { type: "string", description: "Tiêu đề ngắn gọn của bước" },
                desc: { type: "string", description: "Nội dung chỉ dẫn chi tiết" }
              },
              required: ["step", "title", "desc"]
            }
          }
        },
        required: ["steps"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_desktop_agent_status",
      description: "Kiểm tra xem ứng dụng trợ lý TOPV Desktop Agent trên máy tính Windows có đang chạy không.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
];

const LOCAL_AGENT_URL = "http://127.0.0.1:20188";

export async function handleDesktopAgentTool(toolName, args, context) {
  try {
    const isEn = context?.language === 'en';

    // 1. Tool: check_desktop_agent_status
    if (toolName === 'check_desktop_agent_status') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${LOCAL_AGENT_URL}/api/status`, {
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          return {
            success: true,
            status: 'online',
            agentData: data,
            reply: `🟢 **TOPV Desktop Agent đang hoạt động:**\n- Phiên bản: \`${data.version}\`\n- Trạng thái Spotlight: ${data.overlay?.active ? 'Đang bật' : 'Sẵn sàng'}`
          };
        }
      } catch (err) {
        return {
          success: false,
          status: 'offline',
          reply: `⚠️ **TOPV Desktop Agent chưa khởi chạy trên máy tính của bạn.**\n\nĐể bật hướng dẫn chiếu đèn trực tiếp lên app KSystem, vui lòng nhấp đúp vào file \`run_desktop_agent.bat\` trên máy tính.`
        };
      }
    }

    // 2. Tool: show_desktop_spotlight_guide
    if (toolName === 'show_desktop_spotlight_guide') {
      let steps = args.steps || [];
      const windowHint = args.windowHint || 'KSystem';

      if (!Array.isArray(steps) || steps.length === 0) {
        return {
          success: false,
          reply: isEn ? '⚠️ No guide steps provided.' : '⚠️ Vui lòng cung cấp danh sách các bước cần hướng dẫn.'
        };
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`${LOCAL_AGENT_URL}/api/spotlight/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ steps, windowHint }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const stepsSummary = steps.map(s => `  • **Bước ${s.step}:** ${s.title}`).join('\n');
          return {
            success: true,
            spotlightTriggered: true,
            totalSteps: steps.length,
            reply: `✨ **Đã kích hoạt chế độ Chiếu Đèn Spotlight trên màn hình!**\n\nLớp phủ hướng dẫn trực quan đang chiếu sáng các nút trên ứng dụng **${windowHint}**:\n${stepsSummary}\n\n👉 *Bạn có thể bấm trực tiếp các nút trên màn hình hoặc dùng phím mũi tên để chuyển bước, phím Esc để đóng.*`
          };
        }
      } catch (agentErr) {
        return {
          success: false,
          spotlightTriggered: false,
          error: 'AGENT_OFFLINE',
          reply: `⚠️ **Không thể kết nối tới TOPV Desktop Agent (Cổng 20188)**\n\nĐể AI có thể chiếu đèn và khoanh vùng nút bấm trên ứng dụng KSystem Desktop, bạn vui lòng chạy file \`run_desktop_agent.bat\` trong thư mục dự án.`
        };
      }
    }

    return {
      success: false,
      reply: `⚠️ Không tìm thấy handler cho công cụ \`${toolName}\`.`
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      reply: `❌ Lỗi thực thi Desktop Agent Plugin: ${err.message}`
    };
  }
}
