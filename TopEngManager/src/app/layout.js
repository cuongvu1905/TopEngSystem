import "./globals.css";
import { AppContextProvider } from "@/context/AppContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import AppLayout from "@/components/AppLayout";

export const metadata = {
  title: "TOPVSystem Manager - Hệ Thống Quản Lý Doanh Nghiệp",
  description: "Hệ thống quản lý doanh nghiệp tích hợp quản lý dự án, công việc, tài liệu và kênh chat realtime.",
  icons: {
    icon: "/TOP_RED_178x134.png",
    shortcut: "/TOP_RED_178x134.png",
    apple: "/TOP_RED_178x134.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/TOP_RED_178x134.png" type="image/png" />
        <link rel="apple-touch-icon" href="/TOP_RED_178x134.png" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var theme = localStorage.getItem('theme');
              if (theme === 'light') {
                document.documentElement.removeAttribute('data-theme');
              } else if (theme) {
                document.documentElement.setAttribute('data-theme', theme);
              } else {
                document.documentElement.setAttribute('data-theme', 'dark');
              }
            } catch (e) {}
          })();
        ` }} />
        <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" 
          precedence="default"
        />
        <link 
          rel="stylesheet" 
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700;800&display=swap" 
        />
      </head>
      <body>
        <LanguageProvider>
          <ThemeProvider>
            <AppContextProvider>
              <AppLayout>
                {children}
              </AppLayout>
            </AppContextProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
