"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Session } from "@heroiclabs/nakama-js";

import { createNakamaClient } from "@/lib/nakama/client";

type AuthState =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "authed"; username?: string; userId?: string }
  | { kind: "error"; message: string };

const STORAGE_KEY = "lila.nakama.session";
const DEVICE_ID_KEY = "lila.deviceId";
const NICKNAME_KEY = "lila.nickname";

const cardClassName =
  "rounded-2xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-900/30";

const buttonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-50 dark:hover:bg-zinc-950/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-700 disabled:pointer-events-none disabled:opacity-50";

const inputClassName =
  "w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-800";

function fallbackNickname() {
  return `guest_${Math.floor(Math.random() * 1000)}`;
}

async function generateNicknameAsync() {
  const { NumberDictionary, adjectives, animals, uniqueNamesGenerator } = await import(
    "unique-names-generator"
  );
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals, NumberDictionary.generate({ min: 0, max: 999, length: 3 })],
    separator: "_",
    style: "lowerCase"
  });
}

function loadSavedSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token: string; refreshToken: string };
    if (!parsed?.token || !parsed?.refreshToken) return null;
    return Session.restore(parsed.token, parsed.refreshToken);
  } catch {
    return null;
  }
}

function saveSession(session: Session) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ token: session.token, refreshToken: session.refresh_token })
  );
}

export default function AuthPage() {
  const [state, setState] = useState<AuthState>({ kind: "idle" });
  const [isReady, setIsReady] = useState(false);
  const [nickname, setNickname] = useState("");
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = loadSavedSession();
      if (saved && !cancelled) {
        setState({ kind: "authed", username: saved.username, userId: saved.user_id });
      }

      const existingDeviceId = window.localStorage.getItem(DEVICE_ID_KEY);
      const nextDeviceId = existingDeviceId ?? crypto.randomUUID();
      if (!existingDeviceId) {
        window.localStorage.setItem(DEVICE_ID_KEY, nextDeviceId);
      }

      let nextNickname = window.localStorage.getItem(NICKNAME_KEY) ?? "";
      if (!saved && !nextNickname) {
        try {
          nextNickname = await generateNicknameAsync();
        } catch {
          nextNickname = fallbackNickname();
        }
        window.localStorage.setItem(NICKNAME_KEY, nextNickname);
      }

      if (cancelled) return;
      setDeviceId(nextDeviceId);
      setNickname(nextNickname);
      setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const authenticateDevice = useCallback(async () => {
    try {
      setState({ kind: "working" });
      const client = createNakamaClient();      
      const session = await client.authenticateDevice(deviceId + "|" + nickname.trim(), true, nickname.trim());
      saveSession(session);
      setState({
        kind: "authed",
        username: session.username,
        userId: session.user_id
      });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to authenticate."
      });
    }
  }, [deviceId, nickname]);

  const randomizeNickname = useCallback(async () => {
    try {
      const next = await generateNicknameAsync();
      setNickname(next);
      window.localStorage.setItem(NICKNAME_KEY, next);
    } catch {
      const next = fallbackNickname();
      setNickname(next);
      window.localStorage.setItem(NICKNAME_KEY, next);
    }
  }, []);

  const clearSession = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setState({ kind: "idle" });
  }, []);

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

      {state.kind === "authed" ? (
        <>
          <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-200">
            Signed in{state.username ? <> as <code>{state.username}</code></> : null}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link className={buttonClassName} href="/lobby">
              Continue to lobby
            </Link>
            <button className={buttonClassName} type="button" onClick={clearSession}>
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
              onChange={(e) => {
                const next = e.target.value;
                setNickname(next);
                window.localStorage.setItem(NICKNAME_KEY, next);
              }}
              placeholder="e.g. brave_panda_042"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="text"
              disabled={state.kind === "working"}
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className={buttonClassName}
              type="button"
              onClick={authenticateDevice}
              disabled={state.kind === "working" || nickname.trim().length === 0}
            >
              {state.kind === "working" ? "Signing in..." : "Sign in"}
            </button>
            <button
              className={buttonClassName}
              type="button"
              onClick={randomizeNickname}
              disabled={state.kind === "working"}
            >
              Randomize
            </button>
            <Link className={buttonClassName} href="/lobby">
              Skip for now
            </Link>
          </div>
          {state.kind === "error" ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {state.message}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
