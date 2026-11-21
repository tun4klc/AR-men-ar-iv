import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AR Menü", template: "%s · AR Menü" },
  description: "Restoranlar için QR ve artırılmış gerçeklik destekli dijital menü.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fafaf9" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
