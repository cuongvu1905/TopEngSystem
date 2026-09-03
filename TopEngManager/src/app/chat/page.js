"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSwal } from '@/utils/swal';

const STORAGE_KEY = 'topeng_ai_chat_sessions_v2';

// Helper Markdown formatter component
function MarkdownContent({ content }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleCopyCode = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const renderFormatted = useMemo(() => {
    if (!content) return null;

    // Split by code blocks ```lang ... ```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const elements = [];
    let lastIndex = 0;
    let match;
    let blockCounter = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const textSegment = content.substring(lastIndex, match.index);
        elements.push(
          <div key={`text-${lastIndex}`} className="ai-text-segment">
            {renderTextWithFormatting(textSegment)}
          </div>
        );
      }

      const lang = match[1] || 'code';
      const code = match[2].replace(/\n$/, '');
      const currentBlockIdx = blockCounter++;

      elements.push(
        <div key={`code-${currentBlockIdx}`} className="ai-code-block-wrap">
          <div className="ai-code-header">
            <span className="ai-code-lang">
              <i className="fa-solid fa-code" style={{ marginRight: '6px' }}></i>
              {lang}
            </span>
            <button
              type="button"
              className="ai-code-copy-btn"
              onClick={() => handleCopyCode(code, currentBlockIdx)}
              title="Sao chép mã"
            >
              {copiedIndex === currentBlockIdx ? (
                <>
                  <i className="fa-solid fa-check" style={{ color: '#10b981' }}></i>
                  <span style={{ color: '#10b981' }}>Đã sao chép!</span>
                </>
              ) : (
                <>
                  <i className="fa-regular fa-copy"></i>
                  <span>Sao chép</span>
                </>
              )}
            </button>
          </div>
          <pre className="ai-code-pre">
            <code>{code}</code>
          </pre>
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      const remainingText = content.substring(lastIndex);
      elements.push(
        <div key={`text-${lastIndex}`} className="ai-text-segment">
          {renderTextWithFormatting(remainingText)}
        </div>
      );
    }

    return elements;
  }, [content, copiedIndex]);

  return <div className="ai-markdown-body">{renderFormatted}</div>;
}

function renderTextWithFormatting(text) {
  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    if (!line.trim()) {
      return <div key={lineIdx} style={{ height: '8px' }} />;
    }

    if (line.startsWith('### ')) {
      return (
        <h4 key={lineIdx} className="ai-heading-3">
          {parseInlineSpans(line.replace('### ', ''))}
        </h4>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h3 key={lineIdx} className="ai-heading-2">
          {parseInlineSpans(line.replace('## ', ''))}
        </h3>
      );
    }

    if (line.startsWith('> ')) {
      return (
        <blockquote key={lineIdx} className="ai-blockquote">
          {parseInlineSpans(line.replace('> ', ''))}
        </blockquote>
      );
    }

    if (line.match(/^[-*•]\s+/)) {
      const bulletContent = line.replace(/^[-*•]\s+/, '');
      return (
        <div key={lineIdx} className="ai-list-item">
          <span className="ai-bullet">•</span>
          <span>{parseInlineSpans(bulletContent)}</span>
        </div>
      );
    }

    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      return (
        <div key={lineIdx} className="ai-list-item">
          <span className="ai-number-prefix">{numMatch[1]}.</span>
          <span>{parseInlineSpans(numMatch[2])}</span>
        </div>
      );
    }

    return (
      <p key={lineIdx} className="ai-paragraph">
        {parseInlineSpans(line)}
      </p>
    );
  });
}

function parseInlineSpans(str) {
  const parts = [];
  let remaining = str;
  let keyIdx = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(<code key={`c-${keyIdx++}`} className="ai-inline-code">{codeMatch[1]}</code>);
      remaining = remaining.substring(codeMatch[0].length);
      continue;
    }

    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={`b-${keyIdx++}`} className="ai-bold">{boldMatch[1]}</strong>);
      remaining = remaining.substring(boldMatch[0].length);
      continue;
    }

    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(<em key={`i-${keyIdx++}`} className="ai-italic">{italicMatch[1]}</em>);
      remaining = remaining.substring(italicMatch[0].length);
      continue;
    }

    const nextSpecial = remaining.search(/[`*]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      parts.push(remaining[0]);
      remaining = remaining.substring(1);
    } else {
      parts.push(remaining.substring(0, nextSpecial));
      remaining = remaining.substring(nextSpecial);
    }
  }

  return parts;
}

// Preset models per provider
const PROVIDER_PRESETS = {
  deepseek_harness: [
    { id: 'gemini/gemini-3.7-flash', name: '9Router Gateway (Gemini 3.7 Flash - Tự động Failover & Miễn phí)' },
    { id: 'free-auto-fallback', name: '9Router Auto Fallback (Dự phòng đa tài khoản chống sập)' },
    { id: 'deepseek-chat', name: 'DeepSeek-V3 (Cloud API - https://api.deepseek.com/v1)' },
    { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (Cloud API - Suy luận logic chuyên sâu)' },
    { id: 'deepseek-coder', name: 'DeepSeek Coder (Lập trình & Viết Script)' },
    { id: 'deepseek-local', name: 'DeepSeek Local Engine (Ollama/vLLM trên cổng 11434/8000)' }
  ],
  '9router': [
    { id: 'gemini/gemini-3.7-flash', name: 'Gemini 3.7 Flash (Mô hình nhanh nhất trên 9Router)' },
    { id: 'free-auto-fallback', name: 'Free Auto Fallback (Tự động dự phòng)' },
    { id: 'gemini/gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
    { id: 'gemini/gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
    { id: 'gemini/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
    { id: 'gemini/gemma-4-31b-it', name: 'Gemma 4 31B IT' }
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Nhanh, thông minh, tiết kiệm chi phí)' },
    { id: 'gpt-4o', name: 'GPT-4o (Mô hình flagship mạnh mẽ nhất của OpenAI)' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
  ],
  gemini: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Tốc độ siêu nhanh, context 1M token)' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Khả năng suy luận chuyên sâu)' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Next-gen)' }
  ],
  claude: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Đỉnh cao lập trình & phân tích)' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Phản hồi tức thì, chi phí thấp)' }
  ],
  custom: [
    { id: 'deepseek-chat', name: 'DeepSeek-V3 (DeepSeek Chat)' },
    { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (Suy luận chuyên sâu)' },
    { id: 'llama-3.3-70b', name: 'Llama 3.3 70B' },
    { id: 'qwen-2.5-72b', name: 'Qwen 2.5 72B' }
  ]
};

function AIChatPage() {
  const { currentUser, projects, tasks } = useApp();
  const { t, currentLang } = useLanguage();

  // Strict Admin Check: Only Admin accounts can configure AI Model & API
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const role = (currentUser.system_role || '').toLowerCase();
    return role.includes('admin') || role.includes('quản trị') || currentUser.email === 'admin@topeng.com';
  }, [currentUser]);

  // AI Model Configuration state
  const [aiConfig, setAiConfig] = useState({
    provider: 'openai',
    model: 'gpt-4o-mini',
    hasApiKey: false,
    maskedApiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    temperature: 0.7,
    systemPrompt: '',
    n8nEnabled: true,
    n8nWebhookUrl: 'http://localhost:5678/webhook/topeng-room-booking'
  });

  // Config Modal State (Only for Admin)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [formProvider, setFormProvider] = useState('openai');
  const [formModel, setFormModel] = useState('gpt-4o-mini');
  const [formApiKey, setFormApiKey] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formTemperature, setFormTemperature] = useState(0.7);
  const [formSystemPrompt, setFormSystemPrompt] = useState('');
  const [formN8nEnabled, setFormN8nEnabled] = useState(true);
  const [formN8nWebhookUrl, setFormN8nWebhookUrl] = useState('http://localhost:5678/webhook/topeng-room-booking');
  const [isTestingN8n, setIsTestingN8n] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isTestingConfig, setIsTestingConfig] = useState(false);

  // Chat sessions state
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [searchSessionQuery, setSearchSessionQuery] = useState('');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const streamTimerRef = useRef(null);

  // Fetch AI Config from Server
  const fetchAIConfig = async () => {
    try {
      const res = await fetch('/api/ai-config');
      const data = await res.json();
      if (data.success && data.config) {
        setAiConfig(data.config);
        setFormProvider(data.config.provider || 'openai');
        setFormModel(data.config.model || 'gpt-4o-mini');
        setFormBaseUrl(data.config.baseUrl || '');
        setFormTemperature(data.config.temperature ?? 0.7);
        setFormSystemPrompt(data.config.systemPrompt || '');
      }
    } catch (e) {
      console.warn('Could not load AI Config:', e);
    }
  };

  useEffect(() => {
    fetchAIConfig();
  }, []);

  // Initialize sessions from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
          return;
        }
      }
    } catch (e) {
      console.warn("Could not load AI sessions", e);
    }

    const initialWelcomeContent = (() => {
      const nameText = currentUser?.name ? ` **${currentUser.name}**` : '';
      if (currentLang === 'en') {
        return `Hello${nameText}! I am the **TopEng AI Assistant**.\n\nI am directly connected to the TopEng system and AI models. I can assist you with:\n- 📊 **Tasks & Deadlines:** Look up assignments, priorities, and deadlines.\n- 📋 **Daily Reports:** Draft formatted daily reports from your actual task progress.\n- 💻 **Engineering & Code:** Solve coding problems, optimize APIs, write scripts, explain code.\n- 🏢 **Room Booking & Projects:** Look up project info, book or cancel meeting rooms.\n\n*Feel free to click any suggestion below or type your question to begin!*`;
      }
      if (currentLang === 'ko') {
        return `안녕하세요${nameText}! **TopEng AI 어시스턴트**입니다.\n\n업무 분석, 회의실 예약, 일일 보고서 작성, 프로젝트 조회 등 무엇을 도와드릴까요? 💡`;
      }
      if (currentLang === 'zh') {
        return `您好${nameText}！我是 **TopEng AI 智能助理**。\n\n我可以为您提供数据分析、会议室预订、日常工作报告编写及项目查询等支持。今天有什么可以帮助您的？💡`;
      }
      if (currentLang === 'ja') {
        return `こんにちは${nameText}！**TopEng AI アシスタント**です。\n\n業務の進捗確認、会議室の予約・管理、日報作成など、どのようなサポートが必要ですか？💡`;
      }
      return `Xin chào${nameText}! Tôi là **Trợ lý AI TopEng**.\n\nHệ thống được tích hợp kết nối trực tiếp với các mô hình AI tiên tiến. Tôi có thể hỗ trợ bạn:\n- 📊 **Tiến độ & Công việc:** Tra cứu danh sách công việc, hạn chót, việc khẩn cấp.\n- 📋 **Tự động viết Báo cáo ngày:** Soạn thảo báo cáo công việc hàng ngày chuẩn form theo các task thực tế.\n- 💻 **Kỹ thuật & Kiến trúc mã nguồn:** Giải quyết vấn đề lập trình, tối ưu hóa API, viết script, giải thích code.\n- 🏢 **Thông tin Dự án & Phòng họp:** Tra cứu thông tin dự án, lịch đặt phòng họp và quy định chung.\n\n*Bạn có thể bấm vào một trong các gợi ý bên dưới hoặc gõ câu hỏi để bắt đầu!*`;
    })();

    const initialSession = {
      id: 'session-' + Date.now(),
      title: currentLang === 'en' ? 'New Chat' : currentLang === 'ko' ? '새 대화' : currentLang === 'zh' ? '新对话' : currentLang === 'ja' ? '新しいチャット' : 'Trò chuyện với AI TopEng',
      createdAt: Date.now(),
      messages: [
        {
          id: 'msg-welcome',
          role: 'assistant',
          content: initialWelcomeContent,
          isWelcome: true,
          timestamp: Date.now()
        }
      ]
    };
    setSessions([initialSession]);
    setActiveSessionId(initialSession.id);
  }, [currentUser?.name, currentLang, aiConfig.model]);

  // Persist sessions
  useEffect(() => {
    if (sessions.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      } catch (e) {
        console.warn("Could not save AI sessions", e);
      }
    }
  }, [sessions]);

  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || sessions[0] || null;
  }, [sessions, activeSessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, isGenerating]);

  // Open Admin Config Modal
  const handleOpenConfigModal = () => {
    if (!isAdmin) return;
    setFormProvider(aiConfig.provider || 'openai');
    setFormModel(aiConfig.model || 'gpt-4o-mini');
    setFormBaseUrl(aiConfig.baseUrl || '');
    setFormTemperature(aiConfig.temperature ?? 0.7);
    setFormSystemPrompt(aiConfig.systemPrompt || '');
    setFormN8nEnabled(aiConfig.n8nEnabled !== undefined ? aiConfig.n8nEnabled : true);
    setFormN8nWebhookUrl(aiConfig.n8nWebhookUrl || 'http://localhost:5678/webhook/topeng-room-booking');
    setFormApiKey(''); // clear dirty key
    setShowApiKey(false);
    setIsConfigModalOpen(true);
  };

  // Provider change handler in modal
  const handleProviderChange = (newProvider) => {
    setFormProvider(newProvider);
    const presets = PROVIDER_PRESETS[newProvider] || [];
    if (presets.length > 0) {
      setFormModel(presets[0].id);
    }
    if (newProvider === 'deepseek_harness') {
      setFormBaseUrl('http://localhost:20128/v1');
      setFormModel('gemini/gemini-3.7-flash');
      if (!formApiKey) {
        setFormApiKey('sk-76c92f0944eab8dc-7aysp7-476b5431');
      }
    } else if (newProvider === '9router') {
      setFormBaseUrl('http://localhost:20128/v1');
      setFormModel('gemini/gemini-3.7-flash');
      if (!formApiKey) {
        setFormApiKey('sk-76c92f0944eab8dc-7aysp7-476b5431');
      }
    } else if (newProvider === 'openai') {
      setFormBaseUrl('https://api.openai.com/v1');
    } else if (newProvider === 'custom') {
      setFormBaseUrl('https://api.deepseek.com/v1');
    } else {
      setFormBaseUrl('');
    }
  };

  // Model change handler with smart auto-switch for Base URL
  const handleModelChange = (newModel) => {
    setFormModel(newModel);
    if (formProvider === 'deepseek_harness') {
      if (newModel.startsWith('gemini/') || newModel === 'free-auto-fallback') {
        setFormBaseUrl('http://localhost:20128/v1');
        if (!formApiKey) {
          setFormApiKey('sk-76c92f0944eab8dc-7aysp7-476b5431');
        }
      } else if (newModel === 'deepseek-chat' || newModel === 'deepseek-reasoner' || newModel === 'deepseek-coder') {
        setFormBaseUrl('https://api.deepseek.com/v1');
      } else if (newModel === 'deepseek-local') {
        setFormBaseUrl('http://localhost:11434/v1');
      }
    }
  };

  // Test API Connection
  const handleTestAPI = async () => {
    const keyToTest = formApiKey.trim() || (!formApiKey && aiConfig.hasApiKey ? 'USE_EXISTING' : '');
    if (!keyToTest) {
      const Swal = await getSwal();
      Swal.fire({
        title: 'Thiếu API Key',
        text: 'Vui lòng nhập API Key để kiểm tra kết nối.',
        icon: 'warning',
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    setIsTestingConfig(true);
    try {
      const res = await fetch('/api/ai-chat/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: formProvider,
          model: formModel,
          apiKey: formApiKey.trim() || aiConfig.maskedApiKey,
          baseUrl: formBaseUrl
        })
      });
      const data = await res.json();
      const Swal = await getSwal();
      if (data.success) {
        Swal.fire({
          title: 'Kết nối thành công! 🎉',
          text: data.message,
          icon: 'success',
          confirmButtonColor: '#10b981'
        });
      } else {
        Swal.fire({
          title: 'Kết nối thất bại',
          text: data.error || 'Vui lòng kiểm tra lại API Key hoặc Endpoint URL.',
          icon: 'error',
          confirmButtonColor: '#f43f5e'
        });
      }
    } catch (e) {
      const Swal = await getSwal();
      Swal.fire({
        title: 'Lỗi kiểm tra',
        text: e.message || 'Không thể gửi yêu cầu kiểm tra.',
        icon: 'error',
        confirmButtonColor: '#f43f5e'
      });
    } finally {
      setIsTestingConfig(false);
    }
  };

  // Test n8n Webhook
  const handleTestN8N = async () => {
    if (!formN8nWebhookUrl || !formN8nWebhookUrl.trim()) {
      const Swal = await getSwal();
      Swal.fire({
        title: 'Chưa có URL Webhook',
        text: 'Vui lòng nhập đường dẫn n8n Webhook URL để kiểm tra.',
        icon: 'warning',
        confirmButtonColor: '#f59e0b'
      });
      return;
    }

    setIsTestingN8n(true);
    const Swal = await getSwal();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      
      const res = await fetch(formN8nWebhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'TEST_CONNECTION',
          message: 'Kiểm tra kết nối từ TopEng AI Assistant tới n8n Docker',
          timestamp: new Date().toISOString()
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        Swal.fire({
          title: 'n8n Phản hồi Thành công! ⚡',
          text: `Đã gửi tín hiệu kiểm tra thành công tới n8n (HTTP ${res.status}).`,
          icon: 'success',
          confirmButtonColor: '#10b981'
        });
      } else {
        Swal.fire({
          title: 'n8n Trả về mã lỗi',
          text: `Webhook nhận được nhưng trả về HTTP status ${res.status}. Vui lòng bật Active cho Workflow trên n8n.`,
          icon: 'info',
          confirmButtonColor: '#3b82f6'
        });
      }
    } catch (e) {
      Swal.fire({
        title: 'Chưa nhận phản hồi từ n8n',
        text: `Đã thử kết nối tới [${formN8nWebhookUrl}]. Hãy đảm bảo n8n container đang chạy và Workflow đã được kích hoạt (Active) hoặc ấn nút "Listen for test event" trên n8n.`,
        icon: 'warning',
        confirmButtonColor: '#f59e0b'
      });
    } finally {
      setIsTestingN8n(false);
    }
  };

  // Save AI Config (Admin only)
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSavingConfig(true);
    try {
      const res = await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: formProvider,
          model: formModel,
          apiKey: formApiKey, // if blank, backend preserves old key
          baseUrl: formBaseUrl,
          temperature: parseFloat(formTemperature),
          systemPrompt: formSystemPrompt,
          n8nEnabled: formN8nEnabled,
          n8nWebhookUrl: formN8nWebhookUrl
        })
      });
      const data = await res.json();
      const Swal = await getSwal();

      if (data.success) {
        setAiConfig(data.config);
        setIsConfigModalOpen(false);
        Swal.fire({
          title: 'Đã lưu cấu hình AI & n8n!',
          text: `Hệ thống đã cập nhật sang mô hình [${data.config.model}]. Tự động hóa n8n: [${data.config.n8nEnabled ? 'BẬT' : 'TẮT'}].`,
          icon: 'success',
          confirmButtonColor: '#10b981'
        });
      } else {
        Swal.fire({
          title: 'Lỗi lưu cấu hình',
          text: data.error || 'Không thể lưu cài đặt.',
          icon: 'error',
          confirmButtonColor: '#f43f5e'
        });
      }
    } catch (e) {
      const Swal = await getSwal();
      Swal.fire({
        title: 'Lỗi lưu cấu hình',
        text: e.message,
        icon: 'error',
        confirmButtonColor: '#f43f5e'
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Helper to generate localized session object
  const createFreshSessionObj = (lang = currentLang) => {
    const nameText = currentUser?.name ? ` **${currentUser.name}**` : '';

    let title = 'Đoạn chat mới';
    let welcomeText = `Xin chào${nameText}! Tôi là **Trợ lý AI TopEng**. Bạn cần tôi hỗ trợ phân tích dữ liệu, viết báo cáo hay xử lý công việc gì hôm nay? 💡`;

    if (lang === 'en') {
      title = 'New Chat';
      welcomeText = `Hello${nameText}! I am the **TopEng AI Assistant**. How can I assist you with analyzing data, drafting reports, or managing tasks today? 💡`;
    } else if (lang === 'ko') {
      title = '새 대화';
      welcomeText = `안녕하세요${nameText}! **TopEng AI 어시스턴트**입니다. 오늘 어떤 업무를 도와드릴까요? 💡`;
    } else if (lang === 'zh') {
      title = '新对话';
      welcomeText = `您好${nameText}！我是 **TopEng AI 智能助理**。今天有什么可以帮助您的？💡`;
    } else if (lang === 'ja') {
      title = '新しいチャット';
      welcomeText = `こんにちは${nameText}！**TopEng AI アシスタント**です。どのようなサポートが必要ですか？💡`;
    }

    return {
      id: 'session-' + Date.now(),
      title,
      createdAt: Date.now(),
      messages: [
        {
          id: 'welcome-' + Date.now(),
          role: 'assistant',
          content: welcomeText,
          isWelcome: true,
          timestamp: Date.now()
        }
      ]
    };
  };

  // Create new chat session
  const handleCreateNewSession = () => {
    if (isGenerating) return;
    const newSession = createFreshSessionObj();
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setShowMobileSidebar(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Delete session
  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    const Swal = await getSwal();
    const result = await Swal.fire({
      title: t('chat.deleteSessionTitle', 'Xóa đoạn chat này?'),
      text: t('chat.deleteSessionText', 'Toàn bộ nội dung tin nhắn trong đoạn chat này sẽ bị xóa.'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#475569',
      confirmButtonText: t('chat.btnDelete', 'Xóa ngay'),
      cancelButtonText: t('chat.btnClose', 'Hủy')
    });

    if (result.isConfirmed) {
      setSessions(prev => {
        const next = prev.filter(s => s.id !== sessionId);
        if (next.length === 0) {
          const fresh = createFreshSessionObj();
          setActiveSessionId(fresh.id);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([fresh]));
          } catch (e) {}
          return [fresh];
        }
        if (activeSessionId === sessionId) {
          setActiveSessionId(next[0].id);
        }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }
  };

  // Clear all chats
  const handleClearAllSessions = async () => {
    if (isGenerating) return;
    const Swal = await getSwal();
    const result = await Swal.fire({
      title: t('chat.confirmClearAll', 'Xóa toàn bộ lịch sử AI Chat?'),
      text: t('chat.confirmClearText', 'Tất cả các cuộc hội thoại với AI sẽ bị đặt lại về ban đầu.'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#475569',
      confirmButtonText: t('chat.clearAll', 'Xóa toàn bộ'),
      cancelButtonText: t('chat.btnClose', 'Hủy')
    });

    if (result.isConfirmed) {
      const freshSession = createFreshSessionObj();
      setSessions([freshSession]);
      setActiveSessionId(freshSession.id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([freshSession]));
      } catch (e) {
        console.warn('Could not save reset sessions', e);
      }
      Swal.fire({
        icon: 'success',
        title: t('chat.clearSuccess', 'Đã xóa toàn bộ lịch sử thành công!'),
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  // Construct real TopEng System Context for LLM
  const buildSystemContext = () => {
    const myTasks = tasks.filter(t => {
      if (!currentUser) return false;
      const assignee = (t.assignee || '').toLowerCase();
      return assignee.includes(currentUser.name.toLowerCase());
    });

    const isEn = currentLang === 'en';
    const isKo = currentLang === 'ko';
    const isZh = currentLang === 'zh';
    const isJa = currentLang === 'ja';

    const userLabel = isEn ? 'Currently chatting user profile' : isKo ? '현재 대화 중인 사용자 정보' : isZh ? '当前对话用户信息' : isJa ? '現在の対話ユーザー情報' : 'Người dùng đang trò chuyện';
    const tasksLabel = isEn ? `Assigned tasks for current user (${myTasks.length} tasks)` : `Danh sách công việc của người dùng hiện tại (${myTasks.length} việc)`;
    const projectsLabel = isEn ? 'Featured projects in TopEng System' : 'Danh sách các dự án tiêu biểu trong hệ thống TopEng';

    const userContext = currentUser ? `
${userLabel}:
- Name: ${currentUser.name}
- Email: ${currentUser.email}
- Role: ${currentUser.system_role || 'Staff'}
- Department: ${currentUser.department_name || 'N/A'}
- Employee ID: ${currentUser.employee_id || 'N/A'}
` : '';

    const tasksContext = `
${tasksLabel}:
${myTasks.slice(0, 10).map((t, idx) => `
${idx + 1}. [${t.title}] - Priority: ${t.priority || 'Normal'} - Status: ${t.status} - Due Date: ${t.due_date || 'N/A'}
`).join('')}
`;

    const projectsContext = `
${projectsLabel}:
${projects.slice(0, 6).map((p, idx) => `
${idx + 1}. Project: ${p.name} (Key: ${p.project_key}) - Status: ${p.status} - End Date: ${p.end_date || 'N/A'}
`).join('')}
`;

    return `${userContext}\n${tasksContext}\n${projectsContext}\nCurrent System Time: ${new Date().toISOString()}`;
  };

  // Handle Send Message (Calls Real AI Model with stream effect)
  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isGenerating || !activeSession) return;

    setInputMessage('');

    const userMsg = {
      id: 'msg-user-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    const isFirstUserMessage = activeSession.messages.filter(m => m.role === 'user').length === 0;
    const newTitle = isFirstUserMessage ? (text.length > 28 ? text.substring(0, 28) + '...' : text) : activeSession.title;

    const currentHistory = [...activeSession.messages, userMsg];

    setSessions(prev => prev.map(s => {
      if (s.id === activeSession.id) {
        return {
          ...s,
          title: newTitle,
          messages: currentHistory
        };
      }
      return s;
    }));

    setIsGenerating(true);

    const aiMsgId = 'msg-ai-' + (Date.now() + 1);

    // Placeholder message
    setSessions(prev => prev.map(s => {
      if (s.id === activeSession.id) {
        return {
          ...s,
          messages: [
            ...s.messages,
            { id: aiMsgId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true }
          ]
        };
      }
      return s;
    }));

    try {
      const systemContext = buildSystemContext();

      // Format messages for API: strip greeting and welcome messages
      const apiMessages = currentHistory
        .filter(m => !m.isWelcome && m.id !== 'msg-welcome' && !String(m.id).startsWith('welcome-') && !String(m.id).startsWith('msg-welcome'))
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          systemContext,
          currentUser,
          language: currentLang || 'vi'
        })
      });

      const data = await res.json();
      let fullResponse = '';

      if (data.reply) {
        fullResponse = data.reply;
      } else if (data.error === 'NO_API_KEY') {
        if (isAdmin) {
          fullResponse = `⚠️ **Chưa cấu hình API Key cho AI Chat**\n\nBạn đang đăng nhập bằng tài khoản **Quản trị viên (Admin)**. Hãy nhấn vào nút **[Cấu hình AI Model]** ở góc trên bên phải màn hình để chọn Model (OpenAI, Gemini, Claude, DeepSeek) và nhập API Key của bạn.\n\nSau khi lưu, toàn bộ nhân sự trong hệ thống sẽ có thể trò chuyện trực tiếp với Model AI này.`;
        } else {
          fullResponse = `⚠️ **Hệ thống AI Chat chưa được cấu hình API Key**\n\nQuản trị viên (Admin) chưa thiết lập API Key cho hệ thống. Vui lòng liên hệ Admin phụ trách để cấu hình Model AI và API Key trước khi sử dụng.`;
        }
      } else {
        fullResponse = `❌ **Lỗi kết nối AI:** ${data.message || data.error || 'Không thể tạo phản hồi từ Model AI. Vui lòng kiểm tra lại cấu hình API Key.'}`;
      }

      // Smooth typing stream
      let charIdx = 0;
      const chunkSize = 5;

      if (streamTimerRef.current) clearInterval(streamTimerRef.current);

      streamTimerRef.current = setInterval(() => {
        charIdx += chunkSize;
        if (charIdx >= fullResponse.length) {
          clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;
          setIsGenerating(false);

          setSessions(prev => prev.map(s => {
            if (s.id === activeSession.id) {
              return {
                ...s,
                messages: s.messages.map(m => {
                  if (m.id === aiMsgId) {
                    return { 
                      ...m, 
                      content: fullResponse, 
                      bookingData: data.bookingData || null,
                      isStreaming: false 
                    };
                  }
                  return m;
                })
              };
            }
            return s;
          }));
        } else {
          const partial = fullResponse.substring(0, charIdx);
          setSessions(prev => prev.map(s => {
            if (s.id === activeSession.id) {
              return {
                ...s,
                messages: s.messages.map(m => {
                  if (m.id === aiMsgId) {
                    return { ...m, content: partial, isStreaming: true };
                  }
                  return m;
                })
              };
            }
            return s;
          }));
        }
      }, 16);

    } catch (err) {
      console.error('AI chat error:', err);
      setIsGenerating(false);
      const errMsg = `❌ **Đã xảy ra lỗi khi gửi yêu cầu:** ${err.message}. Vui lòng thử lại sau.`;
      setSessions(prev => prev.map(s => {
        if (s.id === activeSession.id) {
          return {
            ...s,
            messages: s.messages.map(m => {
              if (m.id === aiMsgId) {
                return { ...m, content: errMsg, isStreaming: false };
              }
              return m;
            })
          };
        }
        return s;
      }));
    }
  };

  const handleStopGeneration = () => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
      setIsGenerating(false);

      setSessions(prev => prev.map(s => {
        if (s.id === activeSession.id) {
          return {
            ...s,
            messages: s.messages.map(m => {
              if (m.isStreaming) {
                return { ...m, isStreaming: false };
              }
              return m;
            })
          };
        }
        return s;
      }));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredSessions = sessions.filter(s => {
    if (!searchSessionQuery.trim()) return true;
    return s.title.toLowerCase().includes(searchSessionQuery.toLowerCase());
  });

  const promptSuggestions = useMemo(() => [
    {
      icon: 'fa-solid fa-chart-pie',
      color: '#38bdf8',
      title: t('chat.sugTaskTitle', 'Công việc của tôi'),
      desc: t('chat.sugTaskDesc', 'Tra cứu các task cần làm, deadline và trạng thái'),
      prompt: currentLang === 'vi' 
        ? 'Hôm nay tôi có những công việc nào cần xử lý? Có task nào khẩn cấp không?'
        : currentLang === 'en'
        ? 'What tasks do I have today? Are there any urgent tasks?'
        : currentLang === 'ko'
        ? '오늘 처리해야 할 작업은 무엇인가요? 긴급한 작업이 있나요?'
        : currentLang === 'zh'
        ? '我今天有哪些工作需要处理？有紧急任务吗？'
        : '今日処理すべきタスクは何ですか？緊急のタスクはありますか？'
    },
    {
      icon: 'fa-solid fa-file-signature',
      color: '#10b981',
      title: t('chat.sugReportTitle', 'Soạn Báo Cáo Ngày'),
      desc: t('chat.sugReportDesc', 'Tự động tổng hợp công việc hôm nay chuẩn form'),
      prompt: currentLang === 'vi'
        ? 'Hãy soạn giúp tôi một bản báo cáo công việc ngày hôm nay dựa trên các nhiệm vụ của tôi.'
        : currentLang === 'en'
        ? 'Please draft today\'s daily work report based on my assigned tasks.'
        : currentLang === 'ko'
        ? '내 업무를 기반으로 오늘 일일 업무 보고서를 작성해 주세요.'
        : currentLang === 'zh'
        ? '请根据我的任务为我起草一份今日工作日报。'
        : '私のタスクに基づいて本日の業務日報を作成してください。'
    },
    {
      icon: 'fa-solid fa-calendar-check',
      color: '#10b981',
      title: t('chat.sugRoomTitle', 'Đặt Phòng Họp Nhanh'),
      desc: t('chat.sugRoomDesc', 'Kiểm tra phòng trống và đặt lịch họp tự động'),
      prompt: currentLang === 'vi'
        ? 'Đặt giúp tôi phòng họp lớn lúc 10:00 sáng mai'
        : currentLang === 'en'
        ? 'Please book the large meeting room for me at 10:00 AM tomorrow'
        : currentLang === 'ko'
        ? '내일 오전 10시에 대회의실을 예약해 주세요'
        : currentLang === 'zh'
        ? '请帮我预订明天上午 10:00 的大会议室'
        : '明日の午前10時に大会議室を予約してください'
    },
    {
      icon: 'fa-solid fa-code',
      color: '#f59e0b',
      title: t('chat.sugTechTitle', 'Hỗ trợ Kỹ thuật & Code'),
      desc: t('chat.sugTechDesc', 'Tối ưu hóa API, gỡ lỗi logic, giải thích mã nguồn'),
      prompt: currentLang === 'vi'
        ? 'Hướng dẫn giải quyết lỗi timeout kết nối Server-Sent Events khi xử lý streaming LLM.'
        : currentLang === 'en'
        ? 'How to fix Server-Sent Events timeout errors during LLM streaming responses?'
        : currentLang === 'ko'
        ? 'LLM 스트리밍 응답 중 Server-Sent Events 타임아웃 오류를 해결하는 방법은 무엇인가요?'
        : currentLang === 'zh'
        ? '在处理 LLM 流式响应时，如何解决 Server-Sent Events 超时错误？'
        : 'LLMストリーミング応答時のServer-Sent Eventsタイムアウトエラーを解決する方法を教えてください。'
    }
  ], [t, currentLang]);

  if (!currentUser) return null;

  return (
    <div className="ai-chat-root-container">
      {/* Mobile Drawer Backdrop */}
      {showMobileSidebar && (
        <div 
          className="ai-chat-mobile-backdrop"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Left Sidebar: Chat Sessions History */}
      <aside className={`ai-chat-sidebar ${showMobileSidebar ? 'open' : ''}`}>
        <div className="ai-sidebar-header">
          <button 
            type="button" 
            className="btn btn-primary ai-new-chat-btn"
            onClick={handleCreateNewSession}
          >
            <i className="fa-solid fa-plus"></i>
            <span>{t('chat.newChat', 'Đoạn chat mới')}</span>
          </button>
        </div>

        <div className="ai-sidebar-search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input 
            type="text" 
            placeholder={t('chat.searchPlaceholder', 'Tìm kiếm đoạn chat...')} 
            value={searchSessionQuery}
            onChange={(e) => setSearchSessionQuery(e.target.value)}
          />
        </div>

        <div className="ai-sidebar-session-list">
          {filteredSessions.length === 0 ? (
            <div className="ai-sidebar-empty">{t('chat.noSessions', 'Chưa có đoạn chat nào')}</div>
          ) : (
            filteredSessions.map(sess => {
              const isActive = sess.id === activeSessionId;
              const dateLocale = currentLang === 'vi' ? 'vi-VN' : currentLang === 'ko' ? 'ko-KR' : currentLang === 'zh' ? 'zh-CN' : currentLang === 'ja' ? 'ja-JP' : 'en-US';
              const dateStr = new Date(sess.createdAt).toLocaleDateString(dateLocale);
              return (
                <div
                  key={sess.id}
                  className={`ai-session-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSessionId(sess.id);
                    setShowMobileSidebar(false);
                  }}
                >
                  <i className="fa-regular fa-message ai-session-icon"></i>
                  <div className="ai-session-info">
                    <span className="ai-session-title">{sess.title}</span>
                    <span className="ai-session-time">{dateStr}</span>
                  </div>
                  <button
                    type="button"
                    className="ai-session-del-btn"
                    title="Xóa đoạn chat"
                    onClick={(e) => handleDeleteSession(e, sess.id)}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="ai-sidebar-footer">
          <button 
            type="button" 
            className="ai-clear-all-btn"
            onClick={handleClearAllSessions}
          >
            <i className="fa-solid fa-broom"></i>
            <span>{t('chat.clearAll', 'Xóa toàn bộ lịch sử')}</span>
          </button>
        </div>
      </aside>

      {/* Main AI Chat Area */}
      <main className="ai-chat-main">
        {/* Header */}
        <header className="ai-chat-header">
          <div className="ai-header-left">
            <button 
              type="button" 
              className="ai-mobile-menu-toggle"
              onClick={() => setShowMobileSidebar(true)}
              aria-label="Mở danh sách đoạn chat"
            >
              <i className="fa-solid fa-bars"></i>
            </button>
            
            <div className="ai-bot-avatar-wrap">
              <div className="ai-bot-avatar">
                <i className="fa-solid fa-robot"></i>
              </div>
              <span className={`ai-online-pulse ${aiConfig.hasApiKey ? 'active' : 'warn'}`} title={aiConfig.hasApiKey ? 'AI Model Online' : 'Chưa cấu hình API Key'}></span>
            </div>

            <div className="ai-header-meta">
              <h3 className="ai-header-main-title">{t('chat.aiAssistantTitle', 'Trợ lý AI TopEng')}</h3>
            </div>
          </div>

          <div className="ai-header-actions">
            {/* ONLY ADMIN CAN SEE & OPEN THIS CONFIGURATION BUTTON */}
            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary btn-sm ai-config-btn"
                onClick={handleOpenConfigModal}
                title="Dành riêng cho Quản trị viên (Admin) thiết lập Model và API Key"
              >
                <i className="fa-solid fa-gear"></i>
                <span className="ai-btn-text">{t('chat.configAiModel', 'Cấu hình AI Model')}</span>
              </button>
            )}

            <button 
              type="button" 
              className="btn btn-secondary btn-sm ai-header-new-btn"
              onClick={handleCreateNewSession}
              title="Tạo cuộc hội thoại mới"
            >
              <i className="fa-solid fa-plus"></i>
              <span className="ai-btn-text">{t('chat.btnNewChat', 'Chat mới')}</span>
            </button>
          </div>
        </header>

        {/* Message Feed Area */}
        <div className="ai-chat-messages-scroll">
          {activeSession?.messages?.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const dateLocale = currentLang === 'vi' ? 'vi-VN' : currentLang === 'ko' ? 'ko-KR' : currentLang === 'zh' ? 'zh-CN' : currentLang === 'ja' ? 'ja-JP' : 'en-US';
            return (
              <div key={msg.id || idx} className={`ai-message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
                <div className="ai-message-container">
                  <div className={`ai-msg-avatar ${isUser ? 'user-avatar' : 'bot-avatar'}`} style={isUser ? { backgroundColor: currentUser?.color || 'var(--primary-color)' } : {}}>
                    {isUser ? (
                      currentUser?.name ? currentUser.name.split(" ").pop().charAt(0) : 'U'
                    ) : (
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                    )}
                  </div>

                  <div className="ai-msg-content-wrapper">
                    <div className="ai-msg-author-bar">
                      <span className="ai-author-name">{isUser ? (currentUser?.name || t('chat.you', 'Bạn')) : t('chat.aiAssistantTitle', 'Trợ lý AI TopEng')}</span>
                      <span className="ai-msg-time">
                        {new Date(msg.timestamp).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className={`ai-msg-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`}>
                      {isUser ? (
                        <div className="ai-user-text">{msg.content}</div>
                      ) : (
                        <>
                          <MarkdownContent content={msg.content} />
                          {msg.isStreaming && (
                            <span className="ai-streaming-cursor">▋</span>
                          )}
                          {msg.bookingData && !msg.isStreaming && (
                            <div className="ai-booking-action-card">
                              <div className="ai-booking-card-top">
                                <div className="ai-booking-badge room">
                                  <i className="fa-solid fa-door-open"></i> {msg.bookingData.roomName}
                                </div>
                                <div className="ai-booking-badge location">
                                  <i className="fa-solid fa-location-dot"></i> {msg.bookingData.locationName}
                                </div>
                              </div>
                              <div className="ai-booking-card-details">
                                <div className="ai-booking-row">
                                  <span className="row-lbl"><i className="fa-regular fa-calendar"></i> {t('chat.cardMeetingDate', 'Ngày họp:')}</span>
                                  <strong className="row-val">{msg.bookingData.date}</strong>
                                </div>
                                <div className="ai-booking-row">
                                  <span className="row-lbl"><i className="fa-regular fa-clock"></i> {t('chat.cardMeetingTime', 'Khung giờ:')}</span>
                                  <strong className="row-val highlight">{msg.bookingData.startTime} - {msg.bookingData.endTime}</strong>
                                </div>
                                <div className="ai-booking-row">
                                  <span className="row-lbl"><i className="fa-regular fa-user"></i> {t('chat.cardBooker', 'Người đặt:')}</span>
                                  <strong className="row-val">{msg.bookingData.bookerName} ({msg.bookingData.team})</strong>
                                </div>
                                {msg.bookingData.purpose && (
                                  <div className="ai-booking-row">
                                    <span className="row-lbl"><i className="fa-regular fa-comment-dots"></i> {t('chat.cardPurpose', 'Mục đích:')}</span>
                                    <strong className="row-val">{msg.bookingData.purpose}</strong>
                                  </div>
                                )}
                              </div>
                              <div className="ai-booking-card-actions">
                                <a href="/room-booking" className="ai-booking-btn-goto">
                                  <i className="fa-solid fa-calendar-days"></i> {t('chat.btnOpenRoomBooking', 'Mở Lịch Đặt Phòng Họp')}
                                </a>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Quick suggestions if session only has the welcome message */}
          {activeSession?.messages?.length <= 1 && (
            <div className="ai-suggestions-grid">
              <div className="ai-suggestions-header">
                <i className="fa-solid fa-lightbulb"></i>
                <span>{t('chat.suggestionsHeader', 'Gợi ý câu hỏi bắt đầu nhanh:')}</span>
              </div>
              <div className="ai-cards-grid">
                {promptSuggestions.map((item, i) => (
                  <div 
                    key={i} 
                    className="ai-suggestion-card"
                    onClick={() => handleSendMessage(item.prompt)}
                  >
                    <div className="ai-sug-icon" style={{ backgroundColor: `${item.color}15`, color: item.color, borderColor: `${item.color}35` }}>
                      <i className={item.icon}></i>
                    </div>
                    <div className="ai-sug-info">
                      <h4>{item.title}</h4>
                      <p>{item.desc}</p>
                    </div>
                    <i className="fa-solid fa-arrow-right ai-sug-arrow"></i>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar Area */}
        <div className="ai-chat-input-bar-wrap">
          {isGenerating && (
            <div className="ai-generating-banner">
              <span className="ai-spinner"><i className="fa-solid fa-circle-notch fa-spin"></i></span>
              <span>{t('chat.generating', 'Đang tạo phản hồi...')}</span>
              <button 
                type="button" 
                className="ai-stop-btn"
                onClick={handleStopGeneration}
                title="Dừng sinh phản hồi"
              >
                <i className="fa-solid fa-stop"></i>
                <span>{t('chat.btnStop', 'Dừng')}</span>
              </button>
            </div>
          )}

          <div className="ai-chat-input-box">
            <textarea
              ref={inputRef}
              className="ai-textarea"
              placeholder={t('chat.inputPlaceholder', 'Nhập tin nhắn...')}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows="1"
              disabled={isGenerating}
            />

            <button
              type="button"
              className={`ai-send-btn ${inputMessage.trim() ? 'active' : ''}`}
              disabled={!inputMessage.trim() || isGenerating}
              onClick={() => handleSendMessage()}
              title={t('chat.send', 'Gửi tin nhắn (Enter)')}
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* ADMIN-ONLY AI MODEL & API CONFIGURATION MODAL */}
      {/* ========================================================================= */}
      {isAdmin && isConfigModalOpen && (
        <div className="modal-backdrop ai-config-modal-backdrop" onClick={() => !isSavingConfig && setIsConfigModalOpen(false)}>
          <div className="modal-dialog ai-config-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header ai-config-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="ai-config-modal-icon">
                  <i className="fa-solid fa-sliders"></i>
                </div>
                <div>
                  <h3 className="modal-title" style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>{t('chat.configTitle', 'Cấu hình AI Model')}</h3>
                </div>
              </div>
              <button 
                type="button" 
                className="close-btn" 
                onClick={() => setIsConfigModalOpen(false)}
                disabled={isSavingConfig}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="ai-config-form">
              <div className="modal-body ai-config-modal-body">
                {/* 1. Provider Selector */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="ai-form-label">
                    <i className="fa-solid fa-brain" style={{ color: 'var(--primary-color)' }}></i> {t('chat.configProvider', 'Nhà cung cấp (Provider):')}
                  </label>
                  <div className="ai-provider-grid">
                    {[
                      { id: 'deepseek_harness', label: 'DeepSeek Harness', icon: 'fa-solid fa-robot' },
                      { id: '9router', label: '9Router Gateway', icon: 'fa-solid fa-network-wired' },
                      { id: 'openai', label: 'OpenAI', icon: 'fa-solid fa-bolt' },
                      { id: 'gemini', label: 'Google Gemini', icon: 'fa-solid fa-wand-magic-sparkles' },
                      { id: 'claude', label: 'Anthropic Claude', icon: 'fa-solid fa-feather-pointed' },
                      { id: 'custom', label: 'Custom / Proxy', icon: 'fa-solid fa-server' }
                    ].map(p => {
                      const isSel = formProvider === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`ai-provider-card ${isSel ? 'active' : ''}`}
                          onClick={() => handleProviderChange(p.id)}
                        >
                          <i className={p.icon}></i>
                          <span className="ai-prov-name">{p.label}</span>
                          {isSel && <i className="fa-solid fa-check ai-prov-check"></i>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Model Selection */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="ai-form-label">
                    <i className="fa-solid fa-microchip"></i> {t('chat.configModel', 'Mô hình AI (Model):')}
                  </label>
                  <select
                    className="form-control"
                    value={formModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                  >
                    {(PROVIDER_PRESETS[formProvider] || []).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {/* 3. API Key */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="ai-form-label">
                    <i className="fa-solid fa-key" style={{ color: '#f59e0b' }}></i> {t('chat.configApiKey', 'Khóa bí mật (API Key):')}
                  </label>
                  <div className="ai-api-key-input-wrap">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      className="form-control"
                      placeholder={aiConfig.hasApiKey ? `Đã lưu: ${aiConfig.maskedApiKey}` : 'Nhập API Key...'}
                      value={formApiKey}
                      onChange={(e) => setFormApiKey(e.target.value)}
                      style={{ fontFamily: 'monospace', paddingRight: '40px', width: '100%' }}
                    />
                    <button
                      type="button"
                      className="ai-toggle-eye-btn"
                      onClick={() => setShowApiKey(prev => !prev)}
                      title={showApiKey ? 'Ẩn API Key' : 'Hiện API Key'}
                    >
                      <i className={`fa-solid ${showApiKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>

                {/* 4. Base URL */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="ai-form-label">
                    <i className="fa-solid fa-link"></i> {t('chat.configBaseUrl', 'Endpoint Base URL:')}
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Mặc định chính thức (hoặc http://localhost:20128/v1)"
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    style={{ fontSize: '13px', fontFamily: 'monospace', width: '100%' }}
                  />
                </div>

                {/* 5. Temperature Slider */}
                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="ai-form-label" style={{ margin: 0 }}>
                      <i className="fa-solid fa-temperature-half"></i> {t('chat.configTemperature', 'Độ sáng tạo (Temperature):')}
                    </label>
                    <span className="ai-temp-badge">{formTemperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    className="ai-slider"
                    value={formTemperature}
                    onChange={(e) => setFormTemperature(parseFloat(e.target.value))}
                  />
                </div>

                {/* 6. System Prompt */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="ai-form-label">
                    <i className="fa-solid fa-comment-dots"></i> {t('chat.configSystemPrompt', 'Chỉ dẫn Hệ thống (System Prompt):')}
                  </label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={formSystemPrompt}
                    onChange={(e) => setFormSystemPrompt(e.target.value)}
                    placeholder="Chỉ dẫn phong cách phản hồi cho AI..."
                    style={{ fontSize: '12.5px', resize: 'vertical' }}
                  />
                </div>

                {/* 7. n8n Automation Section */}
                <div className="ai-n8n-config-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: formN8nEnabled ? '8px' : '0' }}>
                    <label className="ai-form-label" style={{ margin: 0, color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-network-wired"></i> {t('chat.configN8n', 'Tự động hóa n8n:')}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={formN8nEnabled}
                        onChange={(e) => setFormN8nEnabled(e.target.checked)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: formN8nEnabled ? '#10b981' : 'var(--neutral-muted)' }}>
                        {formN8nEnabled ? t('chat.configN8nOn', 'Bật') : t('chat.configN8nOff', 'Tắt')}
                      </span>
                    </label>
                  </div>

                  {formN8nEnabled && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="http://localhost:5678/webhook/..."
                        value={formN8nWebhookUrl}
                        onChange={(e) => setFormN8nWebhookUrl(e.target.value)}
                        style={{ fontSize: '12px', fontFamily: 'monospace', flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleTestN8N}
                        disabled={isTestingN8n}
                        style={{ flexShrink: 0, fontSize: '12px', padding: '6px 12px' }}
                      >
                        {isTestingN8n ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>} Test
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer ai-config-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleTestAPI}
                  disabled={isTestingConfig || isSavingConfig}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px' }}
                >
                  {isTestingConfig ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      <span>{t('chat.btnTesting', 'Đang kiểm tra...')}</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-plug"></i>
                      <span>{t('chat.btnTestConnection', 'Kiểm tra kết nối')}</span>
                    </>
                  )}
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsConfigModalOpen(false)}
                    disabled={isSavingConfig}
                    style={{ padding: '7px 14px' }}
                  >
                    {t('chat.btnClose', 'Đóng')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={isSavingConfig}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', minWidth: '110px', justifyContent: 'center' }}
                  >
                    {isSavingConfig ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                        <span>{t('chat.btnSaving', 'Đang lưu...')}</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-check"></i>
                        <span>{t('chat.btnSaveConfig', 'Lưu cấu hình')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .ai-chat-root-container {
          display: flex;
          height: calc(100vh - 56px);
          max-height: calc(100vh - 56px);
          width: 100%;
          overflow: hidden;
          background: var(--neutral-bg);
          position: relative;
        }

        /* Sidebar Sessions */
        .ai-chat-sidebar {
          width: 280px;
          min-width: 280px;
          background: var(--neutral-bg-card);
          border-right: 1px solid var(--neutral-border);
          display: flex;
          flex-direction: column;
          z-index: 10;
          transition: transform 0.25s ease;
        }

        .ai-sidebar-header {
          padding: 14px;
          border-bottom: 1px solid var(--neutral-border);
        }

        .ai-new-chat-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 9px 14px;
          font-weight: 600;
          font-size: 13px;
          border-radius: 6px;
        }

        .ai-sidebar-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-bottom: 1px solid var(--neutral-border);
          color: var(--neutral-muted);
          font-size: 12px;
        }

        .ai-sidebar-search input {
          background: transparent;
          border: none;
          outline: none;
          color: var(--neutral-dark);
          width: 100%;
          font-size: 12px;
        }

        .ai-sidebar-session-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .ai-sidebar-empty {
          padding: 24px 12px;
          text-align: center;
          font-size: 12px;
          color: var(--neutral-muted);
        }

        .ai-session-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid transparent;
        }

        .ai-session-item:hover {
          background: var(--neutral-bg-hover);
        }

        .ai-session-item.active {
          background: rgba(99, 102, 241, 0.12);
          border-color: rgba(99, 102, 241, 0.35);
        }

        [data-theme="trollllm"] .ai-session-item.active {
          background: rgba(16, 185, 129, 0.12);
          border-color: rgba(16, 185, 129, 0.4);
        }

        .ai-session-icon {
          font-size: 13px;
          color: var(--neutral-muted);
          flex-shrink: 0;
        }

        .ai-session-item.active .ai-session-icon {
          color: var(--primary-color);
        }

        .ai-session-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ai-session-title {
          font-size: 12.5px;
          font-weight: 500;
          color: var(--neutral-dark);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ai-session-time {
          font-size: 10px;
          color: var(--neutral-muted);
        }

        .ai-session-del-btn {
          background: transparent;
          border: none;
          color: var(--neutral-muted);
          font-size: 11px;
          opacity: 0;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.15s ease;
        }

        .ai-session-item:hover .ai-session-del-btn {
          opacity: 1;
        }

        .ai-session-del-btn:hover {
          color: #f43f5e;
          background: rgba(244, 63, 94, 0.1);
        }

        .ai-sidebar-footer {
          padding: 10px 14px;
          border-top: 1px solid var(--neutral-border);
        }

        .ai-clear-all-btn {
          width: 100%;
          background: transparent;
          border: 1px dashed var(--neutral-border);
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11.5px;
          color: var(--neutral-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.15s ease;
        }

        .ai-clear-all-btn:hover {
          color: #f43f5e;
          border-color: #f43f5e;
          background: rgba(244, 63, 94, 0.05);
        }

        /* Main Chat Area */
        .ai-chat-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-width: 0;
          position: relative;
        }

        /* Header */
        .ai-chat-header {
          height: 58px;
          border-bottom: 1px solid var(--neutral-border);
          background: var(--neutral-bg-card);
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          gap: 12px;
        }

        .ai-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .ai-mobile-menu-toggle {
          display: none;
          background: transparent;
          border: none;
          color: var(--neutral-dark);
          font-size: 16px;
          cursor: pointer;
          padding: 6px;
          border-radius: 4px;
        }

        .ai-bot-avatar-wrap {
          position: relative;
          width: 36px;
          height: 36px;
          flex-shrink: 0;
        }

        .ai-bot-avatar {
          width: 100%;
          height: 100%;
          border-radius: 8px;
          background: linear-gradient(135deg, #10b981 0%, #0ea5e9 100%);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          box-shadow: 0 0 14px rgba(16, 185, 129, 0.35);
        }

        .ai-online-pulse {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #10b981;
          border: 2px solid var(--neutral-bg-card);
          box-shadow: 0 0 8px #10b981;
        }

        .ai-online-pulse.warn {
          background: #f59e0b;
          box-shadow: 0 0 8px #f59e0b;
        }

        .ai-header-meta {
          min-width: 0;
          display: flex;
          align-items: center;
        }

        .ai-header-main-title {
          margin: 0;
          font-size: 15.5px;
          font-weight: 700;
          color: var(--neutral-dark);
          white-space: nowrap;
          letter-spacing: -0.01em;
        }

        [data-theme="trollllm"] .ai-header-main-title,
        [data-theme="cyber-light"] .ai-header-main-title {
          font-family: var(--cyber-mono-font, 'JetBrains Mono', monospace);
        }

        .ai-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ai-config-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
        }

        [data-theme="trollllm"] .ai-config-btn {
          background: #10b981;
          border-color: #10b981;
          color: #04130d;
          font-weight: 700;
          box-shadow: 0 0 14px rgba(16, 185, 129, 0.4);
        }

        .ai-header-new-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
        }

        /* Message feed */
        .ai-chat-messages-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .ai-message-row {
          width: 100%;
          display: flex;
        }

        .ai-message-row.user-row {
          justify-content: flex-end;
        }

        .ai-message-row.assistant-row {
          justify-content: flex-start;
        }

        .ai-message-container {
          display: flex;
          gap: 12px;
          max-width: 860px;
          width: 100%;
        }

        .ai-message-row.user-row .ai-message-container {
          flex-direction: row-reverse;
          max-width: 680px;
        }

        .ai-msg-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .ai-msg-avatar.user-avatar {
          color: #fff;
          border-radius: 50%;
        }

        .ai-msg-avatar.bot-avatar {
          background: linear-gradient(135deg, #10b981 0%, #0ea5e9 100%);
          color: #fff;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.25);
        }

        .ai-msg-content-wrapper {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ai-message-row.user-row .ai-msg-content-wrapper {
          align-items: flex-end;
        }

        .ai-msg-author-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
        }

        .ai-author-name {
          font-weight: 600;
          color: var(--neutral-dark);
        }

        .ai-msg-time {
          color: var(--neutral-muted);
          font-size: 10px;
        }

        .ai-msg-bubble {
          border-radius: 10px;
          padding: 12px 16px;
          line-height: 1.55;
          font-size: 13.5px;
          word-break: break-word;
          max-width: 100%;
        }

        .ai-msg-bubble.user-bubble {
          background: var(--primary-color);
          color: #fff;
          border-top-right-radius: 2px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .ai-msg-bubble.bot-bubble {
          background: var(--neutral-bg-card);
          color: var(--neutral-dark);
          border: 1px solid var(--neutral-border);
          border-top-left-radius: 2px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
        }

        [data-theme="trollllm"] .ai-msg-bubble.bot-bubble {
          background: #0e0c1f;
          border-color: #1f1a3a;
          box-shadow: 0 0 12px rgba(14, 12, 31, 0.6);
        }

        .ai-user-text {
          white-space: pre-wrap;
        }

        .ai-streaming-cursor {
          display: inline-block;
          color: var(--primary-color);
          font-weight: bold;
          animation: blink 0.8s infinite;
          margin-left: 2px;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        /* Suggestions Area */
        .ai-suggestions-grid {
          margin: 10px auto 20px auto;
          max-width: 820px;
          width: 100%;
        }

        .ai-suggestions-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--neutral-muted);
          margin-bottom: 12px;
        }

        .ai-cards-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .ai-suggestion-card {
          background: var(--neutral-bg-card);
          border: 1px solid var(--neutral-border);
          border-radius: 8px;
          padding: 12px 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ai-suggestion-card:hover {
          transform: translateY(-2px);
          border-color: var(--primary-color);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
        }

        [data-theme="trollllm"] .ai-suggestion-card {
          background: #0d0a1b;
          border-color: #1e1736;
        }

        [data-theme="trollllm"] .ai-suggestion-card:hover {
          border-color: rgba(16, 185, 129, 0.5);
          box-shadow: 0 0 16px rgba(16, 185, 129, 0.15);
        }

        .ai-sug-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }

        .ai-sug-info {
          flex: 1;
          min-width: 0;
        }

        .ai-sug-info h4 {
          margin: 0 0 2px 0;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--neutral-dark);
        }

        .ai-sug-info p {
          margin: 0;
          font-size: 11px;
          color: var(--neutral-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ai-sug-arrow {
          font-size: 11px;
          color: var(--neutral-muted);
          transition: transform 0.15s ease;
        }

        .ai-suggestion-card:hover .ai-sug-arrow {
          transform: translateX(3px);
          color: var(--primary-color);
        }

        /* Bottom Input Bar */
        .ai-chat-input-bar-wrap {
          padding: 12px 24px 16px 24px;
          background: var(--neutral-bg-card);
          border-top: 1px solid var(--neutral-border);
          position: relative;
        }

        .ai-chat-input-bar-wrap {
          padding: 12px 24px 20px 24px;
          position: sticky;
          bottom: 0;
          z-index: 10;
          background: linear-gradient(180deg, transparent 0%, var(--neutral-bg-main) 35%);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .ai-generating-banner {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          font-size: 12px;
          font-weight: 500;
          color: var(--neutral-dark);
          background: var(--neutral-bg-card);
          border: 1px solid var(--neutral-border);
          padding: 4px 12px;
          border-radius: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .ai-stop-btn {
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.3);
          color: #f43f5e;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s ease;
          margin-left: 4px;
        }

        .ai-stop-btn:hover {
          background: #f43f5e;
          color: #fff;
        }

        .ai-chat-input-box {
          width: 100%;
          max-width: 820px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--neutral-bg-card);
          border: 1.5px solid var(--neutral-border);
          border-radius: 28px;
          padding: 8px 10px 8px 20px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
        }

        .ai-chat-input-box:focus-within {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15), 0 4px 20px rgba(0, 0, 0, 0.06);
        }

        [data-theme="trollllm"] .ai-chat-input-box {
          background: #0f0c22;
          border-color: #2a2245;
          border-radius: 28px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }

        [data-theme="trollllm"] .ai-chat-input-box:focus-within {
          border-color: #10b981;
          box-shadow: 0 0 16px rgba(16, 185, 129, 0.22);
        }

        [data-theme="cyber-light"] .ai-chat-input-box {
          background: #ffffff;
          border-color: #cbd5e1;
          border-radius: 28px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
        }

        [data-theme="cyber-light"] .ai-chat-input-box:focus-within {
          border-color: #059669;
          box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
        }

        .ai-textarea,
        .ai-textarea:focus,
        .ai-textarea:focus-visible,
        .ai-textarea:active,
        [data-theme="trollllm"] .ai-textarea,
        [data-theme="trollllm"] .ai-textarea:focus,
        [data-theme="trollllm"] .ai-textarea:focus-visible,
        [data-theme="cyber-light"] .ai-textarea,
        [data-theme="cyber-light"] .ai-textarea:focus,
        [data-theme="cyber-light"] .ai-textarea:focus-visible {
          flex: 1;
          background: transparent !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          font-size: 14px;
          color: var(--neutral-dark) !important;
          resize: none;
          line-height: 1.5;
          padding: 6px 0;
          max-height: 120px;
          margin: 0;
        }

        [data-theme="trollllm"] .ai-textarea {
          color: #ffffff !important;
          font-family: var(--cyber-mono-font, 'JetBrains Mono', monospace);
        }

        [data-theme="cyber-light"] .ai-textarea {
          color: #0f172a !important;
          font-family: var(--cyber-mono-font, 'JetBrains Mono', monospace);
        }

        .ai-send-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: rgba(148, 163, 184, 0.15);
          color: var(--neutral-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          cursor: not-allowed;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .ai-send-btn.active {
          background: var(--primary-color);
          color: #fff;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
        }

        [data-theme="trollllm"] .ai-send-btn.active {
          background: #10b981;
          color: #000000;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
        }

        [data-theme="cyber-light"] .ai-send-btn.active {
          background: #059669;
          box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
        }

        .ai-send-btn.active:hover {
          transform: scale(1.06);
        }

        /* Admin Config Modal */
        .ai-config-modal-backdrop,
        .modal-backdrop {
          position: fixed !important;
          inset: 0 !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: rgba(0, 0, 0, 0.65) !important;
          backdrop-filter: blur(8px) !important;
          z-index: 9999 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 20px !important;
          animation: modalFadeIn 0.2s ease-out;
        }

        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .ai-config-modal-dialog {
          position: relative !important;
          max-width: 520px;
          width: 100%;
          max-height: 88vh;
          display: flex;
          flex-direction: column;
          border-radius: 14px;
          overflow: hidden;
          background: var(--neutral-bg-card);
          border: 1px solid var(--neutral-border);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          animation: modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes modalSlideUp {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        [data-theme="trollllm"] .ai-config-modal-dialog,
        [data-theme="cyber-light"] .ai-config-modal-dialog {
          border-radius: 0px;
        }

        .ai-config-modal-header {
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--neutral-border);
          background: var(--neutral-bg-card);
        }

        .ai-config-modal-header .close-btn {
          background: transparent;
          border: none;
          color: var(--neutral-muted);
          font-size: 16px;
          cursor: pointer;
          width: 30px;
          height: 30px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .ai-config-modal-header .close-btn:hover {
          background: var(--neutral-bg-hover);
          color: var(--neutral-dark);
        }

        .ai-config-modal-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(99, 102, 241, 0.12);
          color: var(--primary-color);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }

        [data-theme="trollllm"] .ai-config-modal-icon {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border-radius: 0px;
        }

        [data-theme="cyber-light"] .ai-config-modal-icon {
          background: rgba(5, 150, 105, 0.12);
          color: #059669;
          border-radius: 0px;
        }

        .ai-config-form {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex: 1;
        }

        .ai-config-modal-body {
          padding: 18px 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ai-form-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          color: var(--neutral-dark);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .ai-provider-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .ai-provider-card {
          border: 1px solid var(--neutral-border);
          border-radius: 8px;
          padding: 9px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.15s ease;
          background: var(--neutral-bg-main);
          color: var(--neutral-dark);
        }

        [data-theme="trollllm"] .ai-provider-card,
        [data-theme="cyber-light"] .ai-provider-card {
          border-radius: 0px;
        }

        .ai-provider-card:hover {
          border-color: var(--primary-color);
          background: var(--neutral-bg-hover);
        }

        .ai-provider-card.active {
          border-color: var(--primary-color);
          background: var(--primary-light);
          color: var(--primary-color);
        }

        [data-theme="trollllm"] .ai-provider-card.active {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
        }

        [data-theme="cyber-light"] .ai-provider-card.active {
          border-color: #059669;
          background: rgba(5, 150, 105, 0.1);
          color: #059669;
        }

        .ai-provider-card i {
          font-size: 13px;
          flex-shrink: 0;
        }

        .ai-prov-name {
          font-size: 12px;
          font-weight: 600;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ai-prov-check {
          font-size: 10px;
          color: var(--primary-color);
        }

        [data-theme="trollllm"] .ai-prov-check {
          color: #10b981;
        }

        [data-theme="cyber-light"] .ai-prov-check {
          color: #059669;
        }

        .ai-api-key-input-wrap {
          position: relative;
          width: 100%;
        }

        .ai-toggle-eye-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: var(--neutral-muted);
          cursor: pointer;
          padding: 4px;
          font-size: 13px;
        }

        .ai-toggle-eye-btn:hover {
          color: var(--neutral-dark);
        }

        .ai-temp-badge {
          font-size: 11px;
          font-family: monospace;
          font-weight: 700;
          color: var(--primary-color);
          background: rgba(99, 102, 241, 0.12);
          padding: 2px 6px;
          border-radius: 4px;
        }

        [data-theme="trollllm"] .ai-temp-badge {
          color: #10b981;
          background: rgba(16, 185, 129, 0.15);
          border-radius: 0px;
        }

        [data-theme="cyber-light"] .ai-temp-badge {
          color: #059669;
          background: rgba(5, 150, 105, 0.12);
          border-radius: 0px;
        }

        .ai-slider {
          width: 100%;
          accent-color: var(--primary-color);
          cursor: pointer;
        }

        [data-theme="trollllm"] .ai-slider {
          accent-color: #10b981;
        }

        [data-theme="cyber-light"] .ai-slider {
          accent-color: #059669;
        }

        .ai-n8n-config-box {
          padding: 12px 14px;
          background: rgba(245, 158, 11, 0.06);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
        }

        [data-theme="trollllm"] .ai-n8n-config-box,
        [data-theme="cyber-light"] .ai-n8n-config-box {
          border-radius: 0px;
        }

        .ai-config-modal-footer {
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--neutral-border);
          background: var(--neutral-bg-card);
        }

        /* Mobile styles */
        @media (max-width: 768px) {
          .ai-chat-sidebar {
            position: fixed;
            top: 56px;
            left: 0;
            bottom: 0;
            width: 280px;
            transform: translateX(-100%);
            box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
          }

          .ai-chat-sidebar.open {
            transform: translateX(0);
          }

          .ai-chat-mobile-backdrop {
            position: fixed;
            top: 56px;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 9;
          }

          .ai-mobile-menu-toggle {
            display: flex;
          }

          .ai-chat-header {
            padding: 0 12px;
          }

          .ai-btn-text {
            display: none;
          }

          .ai-chat-messages-scroll {
            padding: 14px 12px;
            gap: 14px;
          }

          .ai-cards-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .ai-provider-grid {
            grid-template-columns: 1fr;
          }

          .ai-chat-input-bar-wrap {
            padding: 10px 12px;
          }

          .ai-input-disclaimer {
            font-size: 9.5px;
          }

          .ai-config-modal-footer {
            flex-direction: column;
            gap: 10px;
          }

          .ai-config-modal-footer button {
            width: 100%;
          }
        }
      `}</style>

      {/* Global styles for AI Markdown elements */}
      <style jsx global>{`
        .ai-markdown-body {
          font-size: 13.5px;
          line-height: 1.6;
        }
        .ai-paragraph {
          margin: 0 0 8px 0;
        }
        .ai-paragraph:last-child {
          margin-bottom: 0;
        }
        .ai-heading-2 {
          font-size: 15px;
          font-weight: 700;
          margin: 12px 0 6px 0;
          color: var(--primary-color);
        }
        .ai-heading-3 {
          font-size: 14px;
          font-weight: 700;
          margin: 10px 0 4px 0;
          color: var(--neutral-dark);
        }
        .ai-blockquote {
          border-left: 3px solid var(--primary-color);
          background: rgba(99, 102, 241, 0.08);
          margin: 8px 0;
          padding: 6px 12px;
          border-radius: 0 4px 4px 0;
          font-size: 13px;
        }
        .ai-list-item {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-bottom: 4px;
        }
        .ai-bullet {
          color: var(--primary-color);
          font-weight: bold;
          font-size: 14px;
        }
        .ai-number-prefix {
          color: var(--primary-color);
          font-weight: 700;
          font-size: 12px;
          min-width: 16px;
        }
        .ai-bold {
          font-weight: 700;
          color: var(--neutral-dark);
        }
        .ai-inline-code {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 1px 5px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
          color: #38bdf8;
        }
        [data-theme="trollllm"] .ai-inline-code {
          color: #10b981;
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.25);
        }
        .ai-code-block-wrap {
          margin: 10px 0;
          background: #090714;
          border: 1px solid #231c3d;
          border-radius: 8px;
          overflow: hidden;
        }
        .ai-code-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid #1f1936;
          font-size: 11px;
          font-family: monospace;
          color: var(--neutral-muted);
        }
        .ai-code-copy-btn {
          background: transparent;
          border: none;
          color: var(--neutral-muted);
          font-size: 11px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: color 0.15s ease;
        }
        .ai-code-copy-btn:hover {
          color: #fff;
        }
        .ai-code-pre {
          margin: 0;
          padding: 12px 14px;
          overflow-x: auto;
          font-family: monospace;
          font-size: 12px;
          line-height: 1.5;
          color: #e2e8f0;
        }
      `}</style>
    </div>
  );
}

export default dynamic(() => Promise.resolve(AIChatPage), { ssr: false });
