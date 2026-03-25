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
          <footer className="mt-10 text-xs text-zinc-500 dark:text-zinc-400">
            FE - Next.js App Router - Tailwind CSS
          </footer>
        </div>
      </body>
    </html>
  );
}

