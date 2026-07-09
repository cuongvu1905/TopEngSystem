import { NextResponse } from 'next/server';
import { StreamChat } from 'stream-chat';

export async function POST(request) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'Thiếu userId' }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Stream Chat chưa được cấu hình đầy đủ API Key và API Secret trên Server.' }, { status: 500 });
    }

    const serverClient = StreamChat.getInstance(apiKey, apiSecret);
    const token = serverClient.createToken(userId);

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Lỗi sinh token Stream Chat:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
