import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import Nav from "@/components/nav";

export const metadata: Metadata = {
  title: "FE",
  description: "Basic Next.js frontend"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8">
          <header>
            <Nav />
          </header>
          <main className="mt-6 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

