"use client";

import { useState } from "react";

import { Session } from "@heroiclabs/nakama-js";

export default function LobbyPage() {
  const [roomId, setRoomId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [roomResult, setRoomResult] = useState<{
    roomId: string;
    groupId: string;
    groupName: string;
    userId: string;
  } | null>(null);

  const STORAGE_KEY = "lila.nakama.session";

  const loadSavedSession = (): Session | null => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { token: string; refreshToken: string };
      if (!parsed?.token) return null;
      return Session.restore(parsed.token, parsed.refreshToken ?? "");
      
    } catch {
      return null;
    }
  };

  const callRoomApi = async (path: "/api/room" | "/api/room/join") => {
    setMessage(null);
    setRoomResult(null);

    const session = loadSavedSession();
    if (!session?.token) {
      setMessage("You need to sign in first to create/join a room.");
      return;
    }

    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId) {
      setMessage("Please enter a room name.");
      return;
    }

    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({ roomId: trimmedRoomId })
    });

    const data = (await res.json().catch(() => ({}))) as
      | { error?: string; details?: string }
      | { roomId: string; groupId: string; groupName: string; userId: string };

    if (!res.ok) {
      const err = "error" in data && data.error ? data.error : "Request failed.";
      const details = "details" in data && data.details ? ` (${data.details})` : "";
      setMessage(`${err}${details}`);
      return;
    }

    if ("roomId" in data) {
      setRoomResult(data);
      setMessage(path === "/api/room" ? "Room ready." : "Joined room.");
    } else {
      setMessage("Unexpected response from server.");
    }
  };

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      await callRoomApi("/api/room");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    setIsJoining(true);
    try {
      await callRoomApi("/api/room/join");
    } finally {
      setIsJoining(false);
    }
  };

  const handleRandomMatch = () => {
    setIsMatching(true);
    // TODO: Call backend to find random match
    console.log("Finding random match...");
    setTimeout(() => setIsMatching(false), 1000);
  };

  const isRoomActionInProgress = isCreating || isJoining;

  return (
    <section className="rounded-2xl border border-zinc-200/70 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-900/30">
      <h1 className="text-3xl font-semibold tracking-tight">Lobby</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Create a room or match with a random player to start a game
      </p>

      <div className="mt-8 flex flex-col gap-6 lg:flex-row">
        {/* Create / Join Room Section */}
        <div className="flex-1 rounded-lg border border-zinc-200/50 dark:border-zinc-800 p-6 bg-zinc-50/50 dark:bg-zinc-800/20">
          <h2 className="text-lg font-medium mb-4">Room</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Enter room name..."
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={isRoomActionInProgress}
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateRoom}
                disabled={isRoomActionInProgress}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 font-medium text-white transition-colors"
              >
                {isCreating ? "Creating..." : "Create"}
              </button>
              <button
                onClick={handleJoinRoom}
                disabled={isRoomActionInProgress}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white/70 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 font-medium text-zinc-900 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/50 dark:text-zinc-100 transition-colors"
              >
                {isJoining ? "Joining..." : "Join"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Create a new room or join an existing one using the same room name.
          </p>
          {message ? (
            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">{message}</p>
          ) : null}
          {roomResult ? (
            <div className="mt-3 rounded-lg border border-zinc-200/70 bg-white/60 p-3 text-xs text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-950/20 dark:text-zinc-200">
              <div>
                <span className="font-medium">Room:</span> <code>{roomResult.roomId}</code>
              </div>
              <div>
                <span className="font-medium">Group:</span> <code>{roomResult.groupId}</code>
              </div>
              <div>
                <span className="font-medium">You:</span> <code>{roomResult.userId}</code>
              </div>
            </div>
          ) : null}
        </div>

        {/* Random Match Section */}
        <div className="flex-1 rounded-lg border border-zinc-200/50 dark:border-zinc-800 p-6 bg-zinc-50/50 dark:bg-zinc-800/20">
          <h2 className="text-lg font-medium mb-4">Quick Match</h2>
          <button
            onClick={handleRandomMatch}
            disabled={isMatching}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 font-medium text-white transition-colors"
          >
            {isMatching ? "Finding opponent..." : "Match with Random Player"}
          </button>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Get matched with a random opponent immediately.
          </p>
        </div>
      </div>
    </section>
  );
}
