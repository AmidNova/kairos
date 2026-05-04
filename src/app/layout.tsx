import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KAIROS // Surveillance Terminal",
  description:
    "Surveillance de prix et stocks e-commerce. Scraper Playwright, fallback IA Gemini, alertes email.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${mono.variable} ${sans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
