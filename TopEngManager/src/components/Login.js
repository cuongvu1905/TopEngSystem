"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';

export default function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dbType, setDbType] = useState('mysql');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDbType(localStorage.getItem('ems_db_type') || 'mysql');
    }
  }, []);

  const handleDbTypeChange = (val) => {
    setDbType(val);
    localStorage.setItem('ems_db_type', val);
    // Reload page to apply new DB adapter immediately
    window.location.reload();
  };

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
            <label>Phương thức lưu trữ</label>
            <div className="input-with-icon">
              <i className="fa-solid fa-database"></i>
              <select 
                value={dbType} 
                onChange={(e) => handleDbTypeChange(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px 8px 32px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--neutral-border)', 
                  outline: 'none', 
                  fontSize: '13.5px',
                  backgroundColor: 'var(--neutral-light)',
                  color: 'var(--neutral-dark)',
                  cursor: 'pointer'
                }}
              >
                <option value="mysql">MySQL Database (Cần khởi chạy backend & database)</option>
                <option value="mock">Mock Database Cục bộ (Chạy trực tiếp trên trình duyệt)</option>
              </select>
            </div>
          </div>

          {dbType === 'mock' && (
            <div style={{ fontSize: '11.5px', color: '#1E40AF', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '8px 10px', borderRadius: '6px', marginBottom: '12px', lineHeight: '1.4' }}>
              <i className="fa-solid fa-circle-info"></i> <strong>Mock Mode đang bật:</strong> Bạn có thể dùng bất kỳ email demo nào (ví dụ: <code>alice.nguyen@company.com</code>, <code>leader.tran@company.com</code>) và mật khẩu bất kỳ để đăng nhập mà không cần cài MySQL!
            </div>
          )}

          <div className="form-group">
            <label>Địa chỉ Email</label>
            <div className="input-with-icon">
              <i className="fa-regular fa-envelope"></i>
              <input 
                type="email" 
                style={{
                  backgroundColor: 'white',
                  color: 'black',
                  
                }}
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
