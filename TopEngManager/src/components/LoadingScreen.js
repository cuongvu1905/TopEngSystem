import React from 'react';

export default function LoadingScreen({ message = "Đang tải dữ liệu..." }) {
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
      gap: '24px',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999
    }}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes drawFiber {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes slideInFiber {
          from {
            transform: translate(var(--x-offset), var(--y-offset));
            opacity: 0;
          }
          to {
            transform: translate(0, 0);
            opacity: 1;
          }
        }
        @keyframes pulseGlow {
          0%, 100% {
            filter: drop-shadow(0 0 2px rgba(220, 38, 38, 0.4));
          }
          50% {
            filter: drop-shadow(0 0 12px rgba(220, 38, 38, 0.9));
          }
        }
        @keyframes fadeText {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .fiber {
          fill: none;
          stroke: #e11d48; /* Concentrated bright rose red */
          stroke-width: 6;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          transform-origin: center;
          animation: drawFiber 2s cubic-bezier(0.16, 1, 0.3, 1) forwards,
                     slideInFiber 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .loading-logo-container {
          animation: pulseGlow 2.5s ease-in-out infinite;
        }
        .loading-text {
          font-size: 14.5px;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: #f1f5f9;
          animation: fadeText 2s ease-in-out infinite;
          font-family: 'Inter', sans-serif;
        }
        /* Fiber convergence parameters */
        .f-v1 { --x-offset: -80px; --y-offset: -80px; animation-delay: 0s; }
        .f-v2 { --x-offset: -80px; --y-offset: 80px; animation-delay: 0.15s; }
        .f-v3 { --x-offset: -80px; --y-offset: 0px; animation-delay: 0.3s; }
        .f-h1 { --x-offset: 100px; --y-offset: -50px; animation-delay: 0.4s; }
        .f-h2 { --x-offset: 100px; --y-offset: 0px; animation-delay: 0.5s; }
        .f-h3 { --x-offset: 100px; --y-offset: 50px; animation-delay: 0.6s; }
      `}} />

      <div className="loading-logo-container">
        <svg viewBox="0 0 100 100" width="120" height="120" xmlns="http://www.w3.org/2000/svg">
          {/* Vertical Stem of T */}
          <path className="fiber f-v1" d="M25,40 L25,90" />
          <path className="fiber f-v2" d="M35,40 L35,90" />
          <path className="fiber f-v3" d="M45,40 L45,90" />
          
          {/* Top bar + Loop of P */}
          {/* Outer Line */}
          <path className="fiber f-h1" d="M10,20 L55,20 A 25 25 0 0 1 55,70 L45,70" />
          {/* Middle Line */}
          <path className="fiber f-h2" d="M10,28 L55,28 A 17 17 0 0 1 55,62 L45,62" />
          {/* Inner Line */}
          <path className="fiber f-h3" d="M10,36 L55,36 A 9 9 0 0 1 55,54 L45,54" />
        </svg>
      </div>

      <span className="loading-text">{message}</span>
    </div>
  );
}
