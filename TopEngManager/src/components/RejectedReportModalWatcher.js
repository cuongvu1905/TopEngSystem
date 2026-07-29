"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { db } from '@/utils/db';
import { getSwal } from '@/utils/swal';

const REJECTED_REPORT_TITLE = 'Báo cáo ngày bị từ chối';

// Watches for daily-report-rejection notifications that have never been popped up as a
// one-time messagebox yet (tracked server-side via notification.modal_shown so it stays
// "shown once" across devices/sessions, not just this tab), and queues them up one at a time.
export default function RejectedReportModalWatcher() {
  const { currentUser, notifications } = useApp();
  const router = useRouter();
  const [queue, setQueue] = useState([]);
  const seenIdsRef = useRef(new Set());
  const showingRef = useRef(false);

  // Reset dedupe tracking whenever the logged-in user changes
  useEffect(() => {
    seenIdsRef.current = new Set();
    setQueue([]);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;
    const pending = notifications.filter(n =>
      n.user_id === currentUser.id &&
      n.title === REJECTED_REPORT_TITLE &&
      !n.modal_shown &&
      !seenIdsRef.current.has(n.id)
    );
    if (pending.length === 0) return;

    pending.forEach(n => seenIdsRef.current.add(n.id));
    setQueue(prev => [...prev, ...pending]);
  }, [notifications, currentUser]);

  useEffect(() => {
    if (showingRef.current || queue.length === 0) return;

    const next = queue[0];
    showingRef.current = true;

    (async () => {
      const Swal = await getSwal();
      const match = (next.link_url || '').match(/reportId=(\d+)/);
      const reportId = match ? match[1] : null;

      const result = await Swal.fire({
        icon: 'warning',
        title: 'Báo cáo bị từ chối',
        html: (next.content || 'Một báo cáo ngày của bạn đã bị từ chối.').replace(/\n/g, '<br/>'),
        showCancelButton: true,
        confirmButtonText: 'Đi đến báo cáo',
        cancelButtonText: 'Đóng',
        confirmButtonColor: 'var(--primary-color, #2563eb)',
        allowOutsideClick: false
      });

      try {
        await db.markNotificationModalShown([next.id]);
      } catch (e) {
        console.error('Failed to mark rejection modal as shown:', e);
      }

      if (result.isConfirmed && reportId) {
        router.push(`/daily-reports?reportId=${reportId}`);
      }

      setQueue(prev => prev.slice(1));
      showingRef.current = false;
    })();
  }, [queue, router]);

  return null;
}
