"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";

export default function HomePage() {
  const router = useRouter();
  const { isReady, session } = useAuth();

  useEffect(() => {
    if (!isReady) return;

    if (session) {
      router.push("/lobby");
    } else {
      router.push("/auth");
    }
  }, [isReady, router, session]);

  return null;
}
