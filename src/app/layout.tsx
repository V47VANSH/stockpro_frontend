import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StockWeb Dashboard",
  description: "Real-time stock market dashboard with movers, highs & lows, and analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var theme = localStorage.getItem('theme');
              if (theme === 'light' || theme === 'dark') {
                document.documentElement.setAttribute('data-theme', theme);
              } else {
                // no attribute -> follow system preference
                document.documentElement.removeAttribute('data-theme');
              }
            } catch (e) { }
          })();
        ` }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: 'var(--background)', color: 'var(--foreground)' }}
      >
        <Navigation />
        {children}
      </body>
    </html>
  );
}
