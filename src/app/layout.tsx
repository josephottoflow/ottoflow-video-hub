import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Factory — Dashboard",
  description: "Product video editor with live Remotion preview",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
