"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

import { useAuth } from "@/components/auth-provider";

const linkClassName =
  "rounded-md px-2 py-1 text-sm font-medium transition-colors";

const activeLinkClassName =
  "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50";

const inactiveLinkClassName =
  "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-50";

export default function Nav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isReady, session, signOut } = useAuth();
  const username = session?.username ?? null;

  const isActive = (href: string) => pathname === href;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignout = () => {
    signOut();
    setIsOpen(false);
  };

  if (!isReady) return null;

  const linkMap= [
    { href: "/auth", label: "Auth", show: !username },
    { href: "/lobby", label: "Lobby", show: true },
    { href: "/leaderboard", label: "Leaderboard", show: true },
    { href: "/about", label: "About", show: true }
  ];

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {linkMap
          .filter((link) => link.show)
          .map((link) => (
            <Link
              key={link.href}
              className={`${linkClassName} ${isActive(link.href) ? activeLinkClassName : inactiveLinkClassName}`}
              href={link.href}
            >
              {link.label}
          </Link>
        ))}
      </div>

      {/* User Profile Card with Dropdown */}
      {username && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 rounded-md px-3 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-50"
          >
            <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
              {username.charAt(0).toUpperCase()}
            </span>
            <span>{username}</span>
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg z-50">
              <div className="px-4 py-3 border-b border-zinc-200/50 dark:border-zinc-800">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{username}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Player</p>
              </div>
              <button
                onClick={handleSignout}
                className="w-full px-4 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
