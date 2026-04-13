import type React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "highlight.js/styles/github-dark.css";
import FloatingAiAssistant from "@/components/assistant/floating-ai-assistant";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Study - 학습 플랫폼",
  description: "효과적인 학습을 위한 플랫폼",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`dark ${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-background text-foreground">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(120,119,198,0.08),_transparent_45%),radial-gradient(circle_at_85%_10%,_rgba(56,189,248,0.08),_transparent_35%)]">
          {children}
        </div>
        <FloatingAiAssistant />
        <Analytics />
      </body>
    </html>
  );
}
