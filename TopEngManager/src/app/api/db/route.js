import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Connect to Node.js Express backend service
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:5000/api';

    try {
      const res = await fetch(`${backendUrl}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });

      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } catch (fetchErr) {
      console.error('Failed to proxy request to Node.js backend:', fetchErr);
      return NextResponse.json(
        { error: 'Không thể kết nối đến máy chủ Backend Node.js. Hãy chắc chắn rằng bạn đã khởi động server Express ở cổng 5000 (Thư mục /backend).' },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('BFF Proxy route error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi xử lý cổng trung gian Next.js' }, { status: 500 });
  }
}
