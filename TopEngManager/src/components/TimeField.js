"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';

// Every hour of the day, as the quick-pick list.
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Reads what people actually type into a time box: "9", "930", "9:5", "9h30", "09.30" all
// become "09:30"-style HH:MM. Returns null when it cannot be read as a time.
// Zero padding is not cosmetic: start/end times are compared as strings, and unpadded
// "9:00" sorts after "11:00".
export function normalizeTime(raw) {
  const s = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(/[h.,]/g, ':');
  if (!s) return null;
  let h, m;
  if (s.includes(':')) {
    const parts = s.split(':');
    if (parts.length > 2) return null;
    const [hp, mp = '0'] = parts;
    if (!/^\d{1,2}$/.test(hp) || !/^\d{1,2}$/.test(mp)) return null;
    h = Number(hp);
    m = Number(mp);
  } else if (/^\d{1,2}$/.test(s)) {
    h = Number(s);
    m = 0;
  } else if (/^\d{3}$/.test(s)) {
    h = Number(s.slice(0, 1));
    m = Number(s.slice(1));
  } else if (/^\d{4}$/.test(s)) {
    h = Number(s.slice(0, 2));
    m = Number(s.slice(2));
  } else {
    return null;
  }
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export { TIME_RE };

// The time control used by the daily report and the meeting-room booking form: a clock
// button showing the current value, and a dropdown offering both a typed hour/minute and
// a list of whole hours. Extracted so both screens share one implementation rather than
// drifting apart.
export default function TimeField({ value, onChange, align = 'left', disabled = false, buttonStyle }) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState({ hour: '', minute: '' });
  const wrapperRef = useRef(null);

  const [currentHour = '00', currentMinute = '00'] = String(value || '').split(':');

  // Containment is checked against this instance's own element. A shared CSS-class check
  // would leave one picker open while another is being used, since the click is still
  // "inside a picker" as far as the first one can tell.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onDocMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const open = () => {
    setDraft({ hour: currentHour, minute: currentMinute });
    setIsOpen(true);
  };

  const applyDraft = () => {
    const h = String(Math.min(23, Math.max(0, parseInt(draft.hour, 10) || 0))).padStart(2, '0');
    const m = String(Math.min(59, Math.max(0, parseInt(draft.minute, 10) || 0))).padStart(2, '0');
    onChange(`${h}:${m}`);
    setIsOpen(false);
  };

  const numberBoxStyle = {
    width: '48px', textAlign: 'center', border: '1px solid var(--neutral-border)',
    borderRadius: '4px', padding: '8px 4px', backgroundColor: 'var(--neutral-bg-card)',
    color: 'var(--neutral-dark)', fontSize: '17px', fontWeight: '600'
  };

  return (
    <div className="time-dropdown-wrapper" ref={wrapperRef} style={{ position: 'relative', flex: 1 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          width: '100%', border: '1px solid var(--neutral-border)', borderRadius: '4px',
          padding: '8px', backgroundColor: 'var(--neutral-bg-card)',
          color: 'var(--neutral-dark)', fontSize: '13.5px', fontWeight: '600',
          cursor: disabled ? 'default' : 'pointer',
          ...buttonStyle
        }}
      >
        <i className="fa-regular fa-clock" style={{ color: 'var(--primary-color)', fontSize: '18px' }}></i>
        {value}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          ...(align === 'right' ? { right: 0 } : { left: 0 }),
          minWidth: '220px',
          maxHeight: '280px',
          overflowY: 'auto',
          backgroundColor: 'var(--neutral-bg-card)',
          border: '1px solid var(--neutral-border)',
          borderRadius: '6px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)',
          zIndex: 30
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderBottom: '1px solid var(--neutral-border)' }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={draft.hour}
              onChange={(e) => setDraft(prev => ({ ...prev, hour: e.target.value.replace(/\D/g, '') }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyDraft(); } }}
              style={numberBoxStyle}
            />
            <span style={{ color: 'var(--neutral-dark)', fontWeight: '700', fontSize: '17px' }}>:</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={draft.minute}
              onChange={(e) => setDraft(prev => ({ ...prev, minute: e.target.value.replace(/\D/g, '') }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyDraft(); } }}
              style={numberBoxStyle}
            />
            <button
              type="button"
              onClick={applyDraft}
              title={t('common.confirm', 'Xác nhận')}
              style={{ flex: 1, border: 'none', borderRadius: '4px', padding: '8px 10px', backgroundColor: 'var(--primary-color)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
            >
              <i className="fa-solid fa-check"></i>
            </button>
          </div>

          {HOUR_OPTIONS.map(hour => (
            <button
              type="button"
              key={hour}
              onClick={() => { onChange(hour); setIsOpen(false); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'center',
                padding: '8px',
                border: 'none',
                backgroundColor: value === hour ? 'var(--primary-color)' : 'transparent',
                color: value === hour ? '#fff' : 'var(--neutral-dark)',
                fontSize: '13px',
                fontWeight: value === hour ? '700' : '500',
                cursor: 'pointer'
              }}
            >
              {hour}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
