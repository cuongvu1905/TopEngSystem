"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Login from '@/components/Login';

export default function AppLayout({ children }) {
  const { currentUser, isLoading } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isPublicRoute = pathname && pathname.startsWith('/public-projects/');

  // Tự động đẩy người dùng về trang đăng nhập nếu chưa đăng nhập và cố gắng truy cập link chức năng khác
  useEffect(() => {
    if (mounted && !isLoading && !currentUser && !isPublicRoute && pathname !== '/') {
      router.replace('/');
    }
  }, [mounted, isLoading, currentUser, isPublicRoute, pathname, router]);

  if (!mounted) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        width: '100vw', 
        backgroundColor: '#0f172a',
        color: '#cbd5e1',
        gap: '16px'
      }}>
        <div className="loading-spinner"></div>
        <span style={{ fontSize: '14px', fontWeight: 500 }}>Đang khởi động hệ thống...</span>
      </div>
    );
  }

  if (isPublicRoute) {
    return <main className="public-content-container">{children}</main>;
  }

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        width: '100vw', 
        backgroundColor: '#0f172a',
        color: '#cbd5e1',
        gap: '16px'
      }}>
        <div className="loading-spinner"></div>
        <span style={{ fontSize: '14px', fontWeight: 500 }}>Đang khởi động hệ thống...</span>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-wrapper">
        <Header />
        <main className="content-container">
          {children}
        </main>
      </div>
    </div>
  );
}
