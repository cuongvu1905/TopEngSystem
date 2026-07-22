import "./globals.css";
import { AppContextProvider } from "@/context/AppContext";
import { LanguageProvider } from "@/context/LanguageContext";
import AppLayout from "@/components/AppLayout";

export const metadata = {
  title: "TopEng Manager - Hệ Thống Quản Lý Doanh Nghiệp",
  description: "Hệ thống quản lý doanh nghiệp tích hợp quản lý dự án, công việc, tài liệu và kênh chat realtime.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" 
          precedence="default"
        />
      </head>
      <body>
        <LanguageProvider>
          <AppContextProvider>
            <AppLayout>
              {children}
            </AppLayout>
          </AppContextProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
