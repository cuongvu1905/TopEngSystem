import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { provider, model, apiKey, baseUrl } = await request.json();

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json({ success: false, error: 'Vui lòng nhập API Key để kiểm tra kết nối.' }, { status: 400 });
    }

    const testPrompt = 'Xin chào, hãy phản hồi đúng 1 chữ: OK';

    if (provider === 'gemini') {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: testPrompt }] }]
        })
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error?.message || `Google Gemini API trả về mã lỗi: ${res.status}`;
        return NextResponse.json({ success: false, error: errMsg }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: `Kết nối thành công tới Gemini (${model})!` });
    }

    if (provider === 'claude') {
      const endpoint = 'https://api.anthropic.com/v1/messages';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: testPrompt }]
        })
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error?.message || `Anthropic Claude API trả về mã lỗi: ${res.status}`;
        return NextResponse.json({ success: false, error: errMsg }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: `Kết nối thành công tới Claude (${model})!` });
    }

    // Default: OpenAI or OpenAI-compatible (DeepSeek Harness, 9Router, Ollama, OpenRouter, Custom)
    let targetUrl = (baseUrl && baseUrl.trim()) 
      ? baseUrl.trim().replace(/\/+$/, '') 
      : (provider === 'deepseek_harness' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1');
    // Auto append /v1 if missing
    if (!targetUrl.endsWith('/v1') && !targetUrl.endsWith('/v1beta') && !targetUrl.includes('/v1/')) {
      targetUrl += '/v1';
    }

    const endpoint = `${targetUrl}/chat/completions`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: testPrompt }],
        max_tokens: 15,
        stream: false
      })
    });

    const rawText = await res.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      // If it streamed SSE data lines
      if (rawText.includes('data:')) {
        return NextResponse.json({ success: true, message: `Kết nối thành công tới ${provider.toUpperCase()} (${model})!` });
      }
      return NextResponse.json({ success: false, error: `Phản hồi không hợp lệ từ máy chủ: ${rawText.slice(0, 200)}` }, { status: 400 });
    }

    if (!res.ok) {
      const errMsg = data.error?.message || data.message || `API Endpoint trả về mã lỗi: ${res.status}`;
      return NextResponse.json({ success: false, error: errMsg }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Kết nối thành công tới ${provider.toUpperCase()} (${model})!` });
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi mạng hoặc không thể kết nối tới server API.' }, { status: 500 });
  }
}
