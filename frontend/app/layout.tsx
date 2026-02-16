import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Influencer Studio",
  description: "Create AI influencer characters and generate content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
