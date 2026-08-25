import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NMN Growth Desk | Weekly Performance Review",
  description: "媒体実績とクリエイティブ判断を一つにまとめた週次ダッシュボード。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
