"use client";

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Có lỗi xảy ra trong quá trình xác thực.');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <i className="fa-solid fa-layer-group"></i>
          <span>TopEng Manager</span>
        </div>
        <h2 className="login-title">Đăng nhập hệ thống</h2>
        <p className="login-subtitle">Vui lòng đăng nhập để truy cập tài nguyên doanh nghiệp</p>

        {errorMsg && (
          <div className="login-alert danger">
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Địa chỉ Email</label>
            <div className="input-with-icon">
              <i className="fa-regular fa-envelope"></i>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com" 
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label>Mật khẩu</label>
            <div className="input-with-icon">
              <i className="fa-solid fa-lock"></i>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                required 
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary login-submit-btn" disabled={loading}>
            {loading ? (
              <span className="spinner-border"></span>
            ) : (
              <span>Đăng nhập</span>
            )}
          </button>
        </form>

        <div className="login-toggle" style={{ fontSize: '12px', color: 'var(--neutral-muted)', textAlign: 'center', marginTop: '16px' }}>
          <i className="fa-solid fa-circle-info"></i> Tài khoản của bạn được cấp và quản lý bởi phòng nhân sự (HR).
        </div>
      </div>
    </div>
  );
}
