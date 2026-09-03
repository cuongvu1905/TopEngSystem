import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ALL_PLUGINS_SCHEMA, executePluginTool } from '@/plugins';
import { parseBookingIntentFromText, parseCancelIntentFromText } from '@/utils/aiTools';

const CONFIG_PATH = path.join(process.cwd(), 'src', 'config', 'ai_config.json');

function getAIConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading AI config:', e);
  }
  return {
    provider: '9router',
    model: 'gemini/gemini-3.7-flash',
    apiKey: 'sk-76c92f0944eab8dc-7aysp7-476b5431',
    baseUrl: 'http://localhost:20128/v1',
    temperature: 0.7,
    systemPrompt: 'Bạn là Trợ lý AI thông minh của hệ sinh thái quản lý doanh nghiệp TopEng System.',
    n8nEnabled: true,
    n8nWebhookUrl: 'http://localhost:5678/webhook/topeng-room-booking'
  };
}

// Trigger n8n Webhook
async function triggerN8NWebhook(webhookUrl, payload) {
  if (!webhookUrl || !webhookUrl.trim()) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout
    await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    console.log('n8n Webhook triggered successfully:', webhookUrl);
  } catch (err) {
    console.warn('n8n Webhook trigger failed (service might be offline or URL inactive):', err.message);
  }
}

// =========================================================================
// MAIN ROUTE HANDLER (DeepSeek Harness & Dynamic Multi-Brain Architecture)
// =========================================================================
export async function POST(request) {
  try {
    const { messages, systemContext, currentUser, language = 'vi' } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ success: false, error: 'Messages array is required.' }, { status: 400 });
    }

    const config = getAIConfig();
    const apiKey = (config.apiKey || '').trim();

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'NO_API_KEY',
        message: 'Hệ thống AI Chat chưa được cấu hình API Key. Quản trị viên (Admin) vui lòng nhấn vào nút "Cấu hình AI Model" ở góc trên bên phải để thiết lập API Key và Model.'
      });
    }

    const backendUrl = process.env.BACKEND_API_URL || 'http://127.0.0.1:5000/api';
    const provider = config.provider || 'openai';
    const model = config.model || 'gpt-4o-mini';
    const temperature = typeof config.temperature === 'number' ? config.temperature : 0.7;

    // Real-time calendar & system context
    const now = new Date();
    const daysOfWeekVi = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const daysOfWeekEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentCalendarInfo = `Hôm nay là / Today is: ${daysOfWeekEn[now.getDay()]} (${daysOfWeekVi[now.getDay()]}), ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} (Time: ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}).`;

    const langNames = {
      vi: 'Vietnamese (Tiếng Việt)',
      en: 'English',
      ko: 'Korean (한국어)',
      zh: 'Chinese (中文)',
      ja: 'Japanese (日本語)'
    };
    const activeLangName = langNames[language] || (language === 'en' ? 'English' : 'Vietnamese (Tiếng Việt)');

    let fullSystemPrompt = `[CRITICAL SYSTEM DIRECTIVE: LANGUAGE ENFORCEMENT]
- The user's active interface and communication language is: ${activeLangName} (Language Code: '${language}').
- You MUST converse, think, explain, clarify, and formulate your final response strictly in ${activeLangName}.
- If the user sends a message in English or the active language is 'en', YOUR ENTIRE ANSWER MUST BE IN ENGLISH.
- If asking follow-up questions (such as meeting duration, purpose, room selection, task details), ask them directly in ${activeLangName}.
- NEVER output Vietnamese when the active language is '${language}' (English/Korean/Chinese/Japanese) unless the user explicitly requests Vietnamese.

` + (config.systemPrompt || 'You are an intelligent enterprise AI Assistant for the TopEng System management platform.');
    fullSystemPrompt += `\n=== REAL-TIME CALENDAR INFO ===\n${currentCalendarInfo}\n`;
    fullSystemPrompt += `\n=== CURRENT USER PROFILE ===\n- Name: ${currentUser?.name || 'User'}\n- Email: ${currentUser?.email || 'user@topeng.com'}\n- Role: ${currentUser?.system_role || 'Staff'}\n- Department: ${currentUser?.department_name || 'R&D'}\n`;

    if (systemContext) {
      fullSystemPrompt += `\n=== SYSTEM CONTEXT DATA ===\n${systemContext}\n=== END OF CONTEXT DATA ===\n`;
    }

    fullSystemPrompt += `\n\n=== ZERO-FRICTION ROOM BOOKING & ACTION POLICY ===
- When the user asks to book a meeting room and provides basic details (e.g., room size/type and start time, such as "Book a large meeting room for 11 am", "Đặt phòng họp lớn lúc 10h", "Book small room at 2pm", "Book meeting room for 15:00"):
  * YOU MUST NEVER ASK follow-up questions asking for missing details like date, duration, purpose, or location!
  * IMMEDIATELY CALL \`book_meeting_room\` with smart defaults:
    - roomId: 'room-large' (if large/lớn/unspecified) or 'room-small' (if small/nhỏ)
    - date: Current today's date (${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')})
    - startTime: normalized 24h format (e.g., '11:00', '14:00', '15:00', '10:00')
    - endTime: exactly 1 hour after start time (e.g., '12:00', '15:00', '16:00')
    - location: 'HN'
    - purpose: '${language === 'en' ? 'Internal Meeting' : 'Họp nội bộ'}'
    - importance: 'LOW'
  * The system will execute the booking immediately and show the confirmed result!

- When the user asks to cancel a meeting (e.g., "cancel a meeting", "hủy phòng họp", "cancel meeting", "cancel my booking", "không họp nữa"):
  * YOU MUST NEVER ASK which room, date, or time!
  * IMMEDIATELY CALL \`cancel_meeting_room\` (with {} or { roomId: 'any', date: 'any', startTime: 'any' }).
  * The system will automatically look up and cancel the latest / upcoming meeting booked by the user and return a confirmation message!

YOU ARE EQUIPPED WITH ENTERPRISE AGENT TOOLS:
1. Meeting Room Booking & Cancellation & Availability check (book_meeting_room, cancel_meeting_room, check_room_availability).
2. Task Management (list_my_tasks, create_task).
3. Daily Report drafting (generate_daily_report).
When user needs to perform any of these actions, automatically call the best tool with accurate parameters.`;

    const contextHelper = {
      currentUser,
      config,
      backendUrl,
      language: language || 'vi',
      triggerN8N: (payload) => {
        if (config.n8nEnabled && config.n8nWebhookUrl) {
          triggerN8NWebhook(config.n8nWebhookUrl, payload);
        }
      }
    };

    // Filter out initial introductory greeting messages from LLM input to avoid anchoring to wrong language
    const nonGreetingMessages = messages.filter(m => !(m.role === 'assistant' && (
      m.content?.startsWith('Xin chào') ||
      m.content?.startsWith('Hello') ||
      m.content?.startsWith('안녕하세요') ||
      m.content?.startsWith('您好') ||
      m.content?.startsWith('こんにちは')
    )));

    const effectiveMessages = nonGreetingMessages.length > 0 ? nonGreetingMessages : messages;

    // =========================================================================
    // 1. CALL MODEL WITH TRUE TOOL CALLING (DeepSeek Harness, 9Router, OpenAI, Custom)
    // =========================================================================
    if (provider !== 'gemini' && provider !== 'claude') {
      let targetUrl = (config.baseUrl && config.baseUrl.trim()) 
        ? config.baseUrl.trim().replace(/\/+$/, '') 
        : (provider === 'deepseek_harness' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1');

      if (!targetUrl.endsWith('/v1') && !targetUrl.endsWith('/v1beta') && !targetUrl.includes('/v1/')) {
        targetUrl += '/v1';
      }

      const endpoint = `${targetUrl}/chat/completions`;

      const openAiMessages = [
        { role: 'system', content: fullSystemPrompt },
        ...effectiveMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || ''
        }))
      ];

      let res;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: openAiMessages,
            temperature,
            max_tokens: 3000,
            tools: ALL_PLUGINS_SCHEMA,
            tool_choice: 'auto',
            stream: false
          })
        });
      } catch (fetchError) {
        if (fetchError.message.includes('fetch failed') || fetchError.message.includes('ECONNREFUSED')) {
          return NextResponse.json({
            success: false,
            error: 'GATEWAY_OFFLINE',
            message: `Không thể kết nối đến cổng AI Gateway (${targetUrl}). Vui lòng kiểm tra ứng dụng 9Router hoặc máy chủ AI đang chạy trên máy tính của bạn.`
          }, { status: 502 });
        }
        throw fetchError;
      }

      const rawText = await res.text();
      let data = {};
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        if (rawText.includes('data:')) {
          const lines = rawText.split('\n');
          let accumulatedDelta = '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:') && !trimmed.includes('[DONE]')) {
              try {
                const chunk = JSON.parse(trimmed.replace(/^data:\s*/, ''));
                accumulatedDelta += chunk.choices?.[0]?.delta?.content || '';
              } catch {}
            }
          }
          if (accumulatedDelta) {
            return NextResponse.json({ success: true, reply: accumulatedDelta, model, provider });
          }
        }
        throw new Error(rawText.slice(0, 300) || parseErr.message);
      }

      if (!res.ok) {
        throw new Error(data.error?.message || data.message || `API error (${res.status}): ${res.statusText}`);
      }

      const assistantMessage = data.choices?.[0]?.message;

      // =======================================================================
      // CASE A: MODEL CALLED A PLUGIN TOOL
      // =======================================================================
      if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
        const toolCall = assistantMessage.tool_calls[0];
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try {
          toolArgs = typeof toolCall.function.arguments === 'string'
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;
        } catch (argErr) {
          console.error('Failed to parse tool arguments from LLM:', argErr);
        }

        console.log(`[Agent Harness Plugin Execution] Tool: ${toolName}, Args:`, toolArgs);

        const pluginResult = await executePluginTool(toolName, toolArgs, contextHelper);
        if (pluginResult) {
          return NextResponse.json({ ...pluginResult, model, provider });
        }
      }

      // =======================================================================
      // CASE B: MODEL RETURNED REGULAR TEXT
      // =======================================================================
      const reply = assistantMessage?.content || 'Xin lỗi, tôi không thể tạo phản hồi lúc này.';
      return NextResponse.json({ success: true, reply, model, provider });
    }

    // =========================================================================
    // 2. FALLBACK PATH FOR DIRECT GEMINI / CLAUDE
    // =========================================================================
    const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';

    if (parseCancelIntentFromText(lastUserMessage)) {
      const result = await executePluginTool('cancel_meeting_room', {}, contextHelper);
      return NextResponse.json({ ...result, model, provider });
    }

    const bookingIntent = parseBookingIntentFromText(lastUserMessage);
    if (bookingIntent) {
      const result = await executePluginTool('book_meeting_room', bookingIntent, contextHelper);
      return NextResponse.json({ ...result, model, provider });
    }

    if (provider === 'gemini') {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const contents = [
        { role: 'user', parts: [{ text: `[HƯỚNG DẪN HỆ THỐNG]\n${fullSystemPrompt}` }] },
        { role: 'model', parts: [{ text: 'Tôi đã hiểu và sẵn sàng hỗ trợ bạn theo đúng ngữ cảnh hệ thống TopEng.' }] },
        ...messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content || '' }]
        }))
      ];
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { temperature, maxOutputTokens: 3000 } })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Google Gemini API error: ${res.status}`);
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Xin lỗi, không có phản hồi từ Gemini.';
      return NextResponse.json({ success: true, reply, model, provider });
    }

    if (provider === 'claude') {
      const endpoint = 'https://api.anthropic.com/v1/messages';
      const claudeMessages = messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || ''
      }));
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, system: fullSystemPrompt, max_tokens: 4000, temperature, messages: claudeMessages })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Anthropic Claude API error: ${res.status}`);
      const reply = data.content?.[0]?.text || 'Xin lỗi, không có phản hồi từ Claude.';
      return NextResponse.json({ success: true, reply, model, provider });
    }

  } catch (error) {
    console.error('POST /api/ai-chat error:', error);
    return NextResponse.json({
      success: false,
      error: 'API_ERROR',
      message: `Lỗi kết nối Model AI: ${error.message}`
    }, { status: 500 });
  }
}
