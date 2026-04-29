import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KillMyIdea",
  description: "AI multi-agent decision debate system"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
