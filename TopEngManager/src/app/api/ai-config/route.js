import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'src', 'config', 'ai_config.json');

const DEFAULT_CONFIG = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  temperature: 0.7,
  systemPrompt: 'Bạn là Trợ lý AI thông minh của hệ sinh thái quản lý doanh nghiệp TopEng System. Hãy hỗ trợ người dùng giải quyết công việc, phân tích dự án, viết báo cáo và lập trình một cách chuyên nghiệp, chính xác và lịch sự bằng tiếng Việt.',
  n8nEnabled: false,
  n8nWebhookUrl: 'http://localhost:5678/webhook/topeng-room-booking'
};

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Error reading AI config:', e);
  }
  return DEFAULT_CONFIG;
}

function writeConfig(config) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export async function GET() {
  try {
    const config = readConfig();
    const hasApiKey = Boolean(config.apiKey && config.apiKey.trim().length > 0);
    const maskedApiKey = hasApiKey 
      ? (config.apiKey.length > 8 ? `${config.apiKey.slice(0, 4)}••••••••${config.apiKey.slice(-4)}` : '••••••••')
      : '';

    return NextResponse.json({
      success: true,
      config: {
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        temperature: config.temperature,
        systemPrompt: config.systemPrompt,
        hasApiKey,
        maskedApiKey,
        n8nEnabled: Boolean(config.n8nEnabled),
        n8nWebhookUrl: config.n8nWebhookUrl || 'http://localhost:5678/webhook/topeng-room-booking'
      }
    });
  } catch (error) {
    console.error('GET /api/ai-config error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { provider, model, apiKey, baseUrl, temperature, systemPrompt, n8nEnabled, n8nWebhookUrl } = body;

    const currentConfig = readConfig();

    // If new apiKey is empty string or undefined, keep old apiKey if it exists
    const finalApiKey = (apiKey !== undefined && apiKey !== '') ? apiKey.trim() : currentConfig.apiKey;

    const newConfig = {
      provider: provider || currentConfig.provider || 'openai',
      model: model || currentConfig.model || 'gpt-4o-mini',
      apiKey: finalApiKey,
      baseUrl: baseUrl || currentConfig.baseUrl || '',
      temperature: typeof temperature === 'number' ? temperature : currentConfig.temperature,
      systemPrompt: systemPrompt !== undefined ? systemPrompt : currentConfig.systemPrompt,
      n8nEnabled: n8nEnabled !== undefined ? Boolean(n8nEnabled) : Boolean(currentConfig.n8nEnabled),
      n8nWebhookUrl: n8nWebhookUrl !== undefined ? n8nWebhookUrl.trim() : (currentConfig.n8nWebhookUrl || 'http://localhost:5678/webhook/topeng-room-booking')
    };

    writeConfig(newConfig);

    return NextResponse.json({
      success: true,
      message: 'Cấu hình AI Model, API & n8n đã được lưu thành công!',
      config: {
        provider: newConfig.provider,
        model: newConfig.model,
        baseUrl: newConfig.baseUrl,
        temperature: newConfig.temperature,
        systemPrompt: newConfig.systemPrompt,
        hasApiKey: Boolean(newConfig.apiKey && newConfig.apiKey.length > 0),
        maskedApiKey: newConfig.apiKey 
          ? (newConfig.apiKey.length > 8 ? `${newConfig.apiKey.slice(0, 4)}••••••••${newConfig.apiKey.slice(-4)}` : '••••••••')
          : '',
        n8nEnabled: newConfig.n8nEnabled,
        n8nWebhookUrl: newConfig.n8nWebhookUrl
      }
    });
  } catch (error) {
    console.error('POST /api/ai-config error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
