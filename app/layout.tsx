import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shadow",
  description: "AI-powered change impact analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
