"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { Session } from "@heroiclabs/nakama-js";

import { createNakamaClient } from "@/lib/nakama/client";

type AuthStatus = "loading" | "anonymous" | "authenticating" | "authenticated" | "error";

type AuthContextValue = {
  status: AuthStatus;
  isReady: boolean;
  session: Session | null;
  nickname: string;
  deviceId: string;
  error: string | null;
  setNickname: (nickname: string) => void;
  signIn: () => Promise<void>;
  signOut: () => void;
  randomizeNickname: () => Promise<void>;
};

const STORAGE_KEY = "lila.nakama.session";
const DEVICE_ID_KEY = "lila.deviceId";
const NICKNAME_KEY = "lila.nickname";
const SESSION_REFRESH_WINDOW_MS = 8.64e7; // 24 hours

const AuthContext = createContext<AuthContextValue | null>(null);

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

function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

async function getActiveSession(savedSession: Session | null): Promise<Session | null> {
  if (!savedSession) return null;

  const unixTimeInFuture = (Date.now() + SESSION_REFRESH_WINDOW_MS) / 1000;
  if (!savedSession.refresh_token || !savedSession.isexpired(unixTimeInFuture)) {
    return savedSession;
  }

  try {
    const client = createNakamaClient();
    const refreshedSession = await client.sessionRefresh(savedSession);
    saveSession(refreshedSession);
    return refreshedSession;
  } catch {
    clearSession();
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [nickname, setNicknameState] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const savedSession = loadSavedSession();
      const activeSession = await getActiveSession(savedSession);

      const existingDeviceId = window.localStorage.getItem(DEVICE_ID_KEY);
      const nextDeviceId = existingDeviceId ?? crypto.randomUUID();
      if (!existingDeviceId) {
        window.localStorage.setItem(DEVICE_ID_KEY, nextDeviceId);
      }

      let nextNickname = window.localStorage.getItem(NICKNAME_KEY) ?? "";
      if (!activeSession && !nextNickname) {
        try {
          nextNickname = await generateNicknameAsync();
        } catch {
          nextNickname = fallbackNickname();
        }
        window.localStorage.setItem(NICKNAME_KEY, nextNickname);
      }

      if (cancelled) return;

      setSession(activeSession);
      setDeviceId(nextDeviceId);
      setNicknameState(nextNickname);
      setStatus(activeSession ? "authenticated" : "anonymous");
      setError(null);
      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setNickname = useCallback((nextNickname: string) => {
    setNicknameState(nextNickname);
    window.localStorage.setItem(NICKNAME_KEY, nextNickname);
  }, []);

  const signIn = useCallback(async () => {
    const trimmedNickname = nickname.trim();
    if (!deviceId || !trimmedNickname) return;

    try {
      setStatus("authenticating");
      setError(null);

      const client = createNakamaClient();
      const nextSession = await client.authenticateDevice(
        `${deviceId}|${trimmedNickname}`,
        true,
        trimmedNickname
      );

      saveSession(nextSession);
      setSession(nextSession);
      setStatus("authenticated");
    } catch (nextError) {
      setSession(null);
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "Failed to authenticate.");
    }
  }, [deviceId, nickname]);

  const signOut = useCallback(() => {
    clearSession();
    setSession(null);
    setStatus("anonymous");
    setError(null);
  }, []);

  const randomizeNickname = useCallback(async () => {
    try {
      setNickname(await generateNicknameAsync());
    } catch {
      setNickname(fallbackNickname());
    }
  }, [setNickname]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isReady,
      session,
      nickname,
      deviceId,
      error,
      setNickname,
      signIn,
      signOut,
      randomizeNickname
    }),
    [deviceId, error, isReady, nickname, randomizeNickname, session, setNickname, signIn, signOut, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
