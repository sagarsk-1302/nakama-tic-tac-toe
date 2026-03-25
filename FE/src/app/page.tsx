"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Session } from "@heroiclabs/nakama-js";

const STORAGE_KEY = "lila.nakama.session";

function loadSavedSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token: string; refreshToken: string };
    if (!parsed?.token || !parsed?.refreshToken) return null;
    return Session.restore(parsed.token, parsed.refresh_token);
  } catch {
    return null;
  }
}

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const saved = loadSavedSession();
    if (saved) {
      router.push("/lobby");
    } else {
      router.push("/auth");
    }
  }, [router]);

  return null;
}
