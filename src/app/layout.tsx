import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "数据管理 - Excel 导入导出",
  description: "Next.js 全栈应用，支持 Excel 导入导出",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
