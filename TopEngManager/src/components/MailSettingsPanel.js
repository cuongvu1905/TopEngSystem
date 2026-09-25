"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/utils/db';
import { useLanguage } from '@/context/LanguageContext';
import { getSwal } from '@/utils/swal';

// The mailbox the system sends from (interpreter notifications today, anything else later).
// It lives here so the account can be swapped without shell access to the server.
//
// Admin-only, and the server says so too: every one of these three calls re-reads the
// requester's role from the database. Hiding the tab is presentation, not access control.

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid var(--neutral-border)',
  backgroundColor: 'var(--neutral-bg-main)',
  color: 'var(--neutral-dark)',
  outline: 'none'
};

const labelStyle = {
  fontWeight: '600',
  fontSize: '13px',
  color: 'var(--neutral-dark)',
  marginBottom: '4px',
  display: 'block'
};

export default function MailSettingsPanel({ currentUser }) {
  const { t } = useLanguage();
  const currentUserId = currentUser?.id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [source, setSource] = useState('env');
  const [hasPassword, setHasPassword] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedByName, setUpdatedByName] = useState(null);

  const [host, setHost] = useState('smtp.gmail.com');
  const [port, setPort] = useState('465');
  const [user, setUser] = useState('');
  const [from, setFrom] = useState('');
  // Never prefilled: the server does not send the stored password back, so an empty box
  // means "keep the one already saved" rather than "clear it".
  const [password, setPassword] = useState('');
  const [managerEmails, setManagerEmails] = useState([]);

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const applySettings = useCallback((data) => {
    setSource(data.source || 'env');
    setHost(data.host || 'smtp.gmail.com');
    setPort(String(data.port || 465));
    setUser(data.user || '');
    setFrom(data.from || '');
    setHasPassword(!!data.hasPassword);
    setUpdatedAt(data.updatedAt || null);
    setUpdatedByName(data.updatedByName || null);
    setManagerEmails(Array.isArray(data.managerEmails) ? data.managerEmails : []);
    setPassword('');
  }, []);

  const load = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    setLoadError(null);
    try {
      applySettings(await db.getMailSettings(currentUserId));
    } catch (err) {
      console.error('Failed to load mail settings', err);
      setLoadError(err.message || t('mail.loadFailed', 'Không tải được cấu hình email.'));
    } finally {
      setLoading(false);
    }
  }, [currentUserId, applySettings, t]);

  useEffect(() => { load(); }, [load]);

  const payload = (extra = {}) => ({
    requesterId: currentUserId,
    host: host.trim(),
    port: Number(port) || 465,
    user: user.trim(),
    from: from.trim(),
    password,
    managerEmails: managerEmails.map(e => e.trim()).filter(Boolean),
    ...extra
  });

  const handleAddManagerEmail = () => {
    setManagerEmails(prev => [...prev, '']);
  };

  const handleUpdateManagerEmail = (index, value) => {
    setManagerEmails(prev => prev.map((e, idx) => idx === index ? value : e));
  };

  const handleRemoveManagerEmail = (index) => {
    setManagerEmails(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await db.testMailSettings(payload());
      setTestResult(result.ok
        ? { ok: true, text: t('mail.testOk', 'Đăng nhập thành công với {user}.').replace('{user}', result.user) }
        : { ok: false, text: result.error || t('mail.testFailed', 'Đăng nhập thất bại.') });
    } catch (err) {
      setTestResult({ ok: false, text: err.message || t('mail.testFailed', 'Đăng nhập thất bại.') });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const Swal = await getSwal();

    // Validate manager emails if any typed
    const invalidEmail = managerEmails
      .map(e => e.trim())
      .filter(Boolean)
      .find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (invalidEmail) {
      Swal.fire({
        icon: 'warning',
        title: t('common.error', 'Email không hợp lệ'),
        text: `Địa chỉ email quản lý "${invalidEmail}" không đúng định dạng. Vui lòng kiểm tra lại.`,
        confirmButtonColor: 'var(--primary-color)'
      });
      return;
    }

    setSaving(true);
    try {
      await db.updateMailSettings(payload());
      await load();
      setTestResult(null);
      Swal.fire({
        icon: 'success',
        title: t('common.success', 'Thành công'),
        text: t('mail.saved', 'Đã lưu tài khoản gửi mail. Các email tiếp theo sẽ gửi từ địa chỉ này.'),
        confirmButtonColor: 'var(--primary-color)'
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: t('common.error', 'Lỗi'),
        text: err.message || t('mail.saveFailed', 'Không lưu được cấu hình email.'),
        confirmButtonColor: 'var(--primary-color)'
      });
    } finally {
      setSaving(false);
    }
  };

  // Deletes the saved row so the values in backend/.env take over again. Offered because
  // a half-filled override is otherwise impossible to back out of from the browser.
  const handleUseServerConfig = async () => {
    const Swal = await getSwal();
    const confirmed = await Swal.fire({
      icon: 'question',
      title: t('mail.useEnvTitle', 'Dùng lại cấu hình trên máy chủ?'),
      text: t('mail.useEnvText', 'Tài khoản gửi mail đã lưu sẽ bị xoá, hệ thống quay lại dùng cấu hình trong backend/.env.'),
      showCancelButton: true,
      confirmButtonText: t('common.confirm', 'Đồng ý'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)'
    });
    if (!confirmed.isConfirmed) return;

    setSaving(true);
    try {
      await db.updateMailSettings({ requesterId: currentUserId, clear: true });
      await load();
      setTestResult(null);
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: t('common.error', 'Lỗi'),
        text: err.message || t('mail.saveFailed', 'Không lưu được cấu hình email.'),
        confirmButtonColor: 'var(--primary-color)'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '20px' }}>
        {t('mail.loading', 'Đang tải cấu hình email...')}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card" style={{ padding: '20px', color: '#ef4444' }}>
        {loadError}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', color: 'var(--neutral-dark)' }}>
          <i className="fa-solid fa-envelope-circle-check" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>
          {t('mail.title', 'Tài khoản gửi email')}
        </h3>
        <div style={{ fontSize: '12.5px', color: 'var(--neutral-muted)', lineHeight: 1.5 }}>
          {t('mail.subtitle', 'Địa chỉ hệ thống dùng để gửi thông báo tự động (ví dụ: mời phiên dịch khi đặt phòng họp). Đổi ở đây là đổi được ngay, không cần sửa file trên máy chủ.')}
        </div>
      </div>

      {/* Where the account currently in use came from. Without this, an Admin who saves
          nothing cannot tell whether the address on screen is live or just a suggestion. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        padding: '10px 12px', borderRadius: '8px',
        border: '1px solid var(--neutral-border)', backgroundColor: 'var(--neutral-bg-main)',
        fontSize: '12.5px'
      }}>
        <span style={{
          fontWeight: '700', fontSize: '11.5px', letterSpacing: '0.03em',
          padding: '3px 8px', borderRadius: '6px',
          color: source === 'database' ? '#15803d' : '#b45309',
          border: `1px solid ${source === 'database' ? 'rgba(34,197,94,0.55)' : 'rgba(245,158,11,0.55)'}`,
          backgroundColor: source === 'database' ? 'rgba(34,197,94,0.14)' : 'rgba(245,158,11,0.14)'
        }}>
          {source === 'database'
            ? t('mail.sourceDb', 'Cấu hình trong ứng dụng')
            : t('mail.sourceEnv', 'Cấu hình trên máy chủ (.env)')}
        </span>
        <span style={{ color: 'var(--neutral-dark)' }}>
          {hasPassword
            ? t('mail.currentAccount', 'Đang gửi từ: {user}').replace('{user}', user || '—')
            : t('mail.noAccount', 'Chưa có tài khoản gửi mail nào được cấu hình.')}
        </span>
        {source === 'database' && updatedAt && (
          <span style={{ color: 'var(--neutral-muted)' }}>
            {t('mail.updatedBy', '· Cập nhật {time}{by}')
              .replace('{time}', new Date(updatedAt).toLocaleString())
              .replace('{by}', updatedByName ? ` · ${updatedByName}` : '')}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
        <div className="form-group">
          <label style={labelStyle}>{t('mail.host', 'Máy chủ SMTP')}</label>
          <input type="text" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.gmail.com" style={inputStyle} />
        </div>
        <div className="form-group">
          <label style={labelStyle}>{t('mail.port', 'Cổng')}</label>
          <input type="text" value={port} onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ''))} placeholder="465" style={inputStyle} />
          <div style={{ fontSize: '11.5px', color: 'var(--neutral-muted)', marginTop: '4px' }}>
            {t('mail.portHint', '465 (SSL) hoặc 587 (STARTTLS) — hệ thống tự chọn theo cổng.')}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="form-group">
          <label style={labelStyle}>
            {t('mail.user', 'Địa chỉ email gửi')} <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input type="text" value={user} onChange={(e) => setUser(e.target.value)} placeholder="vidu@gmail.com" style={inputStyle} />
        </div>
        <div className="form-group">
          <label style={labelStyle}>{t('mail.from', 'Địa chỉ hiển thị (From)')}</label>
          <input type="text" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={user || 'vidu@gmail.com'} style={inputStyle} />
          <div style={{ fontSize: '11.5px', color: 'var(--neutral-muted)', marginTop: '4px' }}>
            {t('mail.fromHint', 'Bỏ trống sẽ dùng chính địa chỉ gửi. Gmail thường bắt buộc hai địa chỉ này giống nhau.')}
          </div>
        </div>
      </div>

      <div className="form-group">
        <label style={labelStyle}>
          {t('mail.password', 'Mật khẩu ứng dụng (SMTP_PASS)')}
          {!hasPassword && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder={hasPassword
            ? t('mail.passwordKeep', 'Để trống nếu không đổi mật khẩu')
            : t('mail.passwordPlaceholder', 'Dán mật khẩu ứng dụng 16 ký tự')}
          style={inputStyle}
        />
        <div style={{ fontSize: '11.5px', color: 'var(--neutral-muted)', marginTop: '6px', lineHeight: 1.5 }}>
          {t('mail.passwordHint', 'Với Gmail, đây KHÔNG phải mật khẩu đăng nhập. Bật xác minh 2 bước rồi tạo "Mật khẩu ứng dụng" 16 ký tự tại myaccount.google.com/apppasswords. Dán cả dấu cách cũng được. Mật khẩu được mã hoá trước khi lưu và không bao giờ hiển thị lại.')}
        </div>
      </div>

      {/* Manager Emails Notification Section */}
      <div className="form-group" style={{
        marginTop: '4px',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid var(--neutral-border)',
        backgroundColor: 'var(--neutral-bg-main)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <label style={{ ...labelStyle, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-user-tie" style={{ color: 'var(--primary-color)' }}></i>
              {t('mail.managerEmails', 'Email quản lý nhận thông báo phiên dịch')}
            </label>
            <div style={{ fontSize: '11.5px', color: 'var(--neutral-muted)', lineHeight: '1.4' }}>
              {t('mail.managerEmailsHint', 'Khi có yêu cầu hoặc huỷ phiên dịch khi đặt phòng họp, hệ thống sẽ tự động gửi thêm một email thông báo đến các địa chỉ quản lý này.')}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleAddManagerEmail}
            style={{ fontSize: '12px', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="fa-solid fa-plus"></i> {t('mail.addManagerEmail', 'Thêm email quản lý')}
          </button>
        </div>

        {managerEmails.length === 0 ? (
          <div style={{
            padding: '12px',
            borderRadius: '6px',
            border: '1px dashed var(--neutral-border)',
            color: 'var(--neutral-muted)',
            fontSize: '12px',
            textAlign: 'center',
            marginTop: '8px'
          }}>
            <i className="fa-regular fa-envelope" style={{ marginRight: '6px' }}></i>
            {t('mail.noManagerEmails', 'Chưa có email quản lý nào. Bấm "Thêm email quản lý" để thêm người nhận thông báo.')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {managerEmails.map((email, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <i className="fa-solid fa-envelope" style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--neutral-muted)',
                    fontSize: '12px'
                  }}></i>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleUpdateManagerEmail(idx, e.target.value)}
                    placeholder={t('mail.managerEmailPlaceholder', 'quanly@example.com')}
                    style={{ ...inputStyle, paddingLeft: '32px' }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleRemoveManagerEmail(idx)}
                  title="Xoá email này"
                  style={{
                    padding: '8px 12px',
                    color: 'var(--danger-color, #ef4444)',
                    border: '1px solid var(--neutral-border)'
                  }}
                >
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {testResult && (
        <div style={{
          fontSize: '12.5px', lineHeight: 1.5, padding: '10px 12px', borderRadius: '8px',
          color: testResult.ok ? '#15803d' : '#b91c1c',
          border: `1px solid ${testResult.ok ? 'rgba(34,197,94,0.55)' : 'rgba(239,68,68,0.55)'}`,
          backgroundColor: testResult.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'
        }}>
          <i className={`fa-solid ${testResult.ok ? 'fa-circle-check' : 'fa-circle-xmark'}`} style={{ marginRight: '6px' }}></i>
          {testResult.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={testing || saving}>
          <i className="fa-solid fa-plug-circle-check"></i>{' '}
          {testing ? t('mail.testing', 'Đang kiểm tra...') : t('mail.testBtn', 'Kiểm tra kết nối')}
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || testing}>
          <i className="fa-solid fa-floppy-disk"></i>{' '}
          {saving ? t('common.saving', 'Đang lưu...') : t('mail.saveBtn', 'Lưu tài khoản gửi')}
        </button>
        {source === 'database' && (
          <button type="button" className="btn btn-secondary" onClick={handleUseServerConfig} disabled={saving || testing}>
            {t('mail.useEnvBtn', 'Dùng lại cấu hình máy chủ')}
          </button>
        )}
        <span style={{ fontSize: '11.5px', color: 'var(--neutral-muted)' }}>
          {t('mail.testNote', 'Kiểm tra chỉ đăng nhập thử, không gửi email cho ai.')}
        </span>
      </div>
    </div>
  );
}
