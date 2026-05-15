import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ottoflow — Command Center",
  description: "AI-powered short-form video pipeline. Automate Intelligently. Grow Effortlessly.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
