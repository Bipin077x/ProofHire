import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ProofHire",
  description: "AI-powered opportunity verification",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className + " h-full antialiased"}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
