"use client";

import Link from "next/link";

import { useAuth } from "@/components/auth-provider";

const cardClassName =
  "rounded-2xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-900/30";

const buttonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-50 dark:hover:bg-zinc-950/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-700 disabled:pointer-events-none disabled:opacity-50";

const inputClassName =
  "w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-800";

export default function AuthPage() {
  const { error, isReady, nickname, session, setNickname, signIn, signOut, status, randomizeNickname } =
    useAuth();

  if (!isReady) {
    return (
      <section className={cardClassName}>
        <h1 className="text-2xl font-semibold tracking-tight">Authentication</h1>
        <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-200">Loading...</p>
      </section>
    );
  }

  return (
    <section className={cardClassName}>
      <h1 className="text-2xl font-semibold tracking-tight">Authentication</h1>

      {session ? (
        <>
          <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-200">
            Signed in{session.username ? <> as <code>{session.username}</code></> : null}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link className={buttonClassName} href="/lobby">
              Continue to lobby
            </Link>
            <button className={buttonClassName} type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="mt-4 grid gap-2 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Nickname
            </span>
            <input
              className={inputClassName}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. brave_panda_042"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="text"
              disabled={status === "authenticating"}
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className={buttonClassName}
              type="button"
              onClick={signIn}
              disabled={status === "authenticating" || nickname.trim().length === 0}
            >
              {status === "authenticating" ? "Signing in..." : "Sign in"}
            </button>
            <button
              className={buttonClassName}
              type="button"
              onClick={randomizeNickname}
              disabled={status === "authenticating"}
            >
              Randomize
            </button>
            <Link className={buttonClassName} href="/lobby">
              Skip for now
            </Link>
          </div>
          {error ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
