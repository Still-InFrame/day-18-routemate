import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RouteMate",
  description: "Premium route optimization for service workers and door-to-door teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
