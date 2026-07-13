"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { getSwal } from '@/utils/swal';

const Swal = {
  fire: async (...args) => {
    const instance = await getSwal();
    return instance.fire(...args);
  },
  mixin: async (...args) => {
    const instance = await getSwal();
    return instance.mixin(...args);
  },
  close: async (...args) => {
    const instance = await getSwal();
    return instance.close(...args);
  }
};
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
      Swal.fire({
        icon: 'error',
        title: 'Lỗi đăng nhập',
        text: err.message || 'Tài khoản hoặc mật khẩu không chính xác. Vui lòng thử lại.',
      });

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
            <label>Email hoặc Mã nhân viên</label>
            <div className="input-with-icon">
              <i className="fa-regular fa-user"></i>
              <input 
                type="text" 
                style={{
                  backgroundColor: 'white',
                  color: 'black',
                }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@topengnet.com hoặc mã nhân viên" 
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
