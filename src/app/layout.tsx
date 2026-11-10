import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "FffTV · 把好故事留给今晚", template: "%s · FffTV" },
  description: "属于我们的小小放映室。发现电影、追番，接着上次的故事。",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
