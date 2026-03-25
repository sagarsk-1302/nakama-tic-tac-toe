"use client";

import { useState } from "react";

export default function LobbyPage() {
  const [roomName, setRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isMatching, setIsMatching] = useState(false);

  const handleCreateRoom = () => {
    if (!roomName.trim()) {
      alert("Please enter a room name");
      return;
    }
    setIsCreating(true);
    // TODO: Call backend to create room
    console.log("Creating room:", roomName);
    setTimeout(() => setIsCreating(false), 1000);
  };

  const handleRandomMatch = () => {
    setIsMatching(true);
    // TODO: Call backend to find random match
    console.log("Finding random match...");
    setTimeout(() => setIsMatching(false), 1000);
  };

  return (
    <section className="rounded-2xl border border-zinc-200/70 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-900/30">
      <h1 className="text-3xl font-semibold tracking-tight">Lobby</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Create a room or match with a random player to start a game
      </p>

      <div className="mt-8 flex flex-col gap-6 lg:flex-row">
        {/* Create Room Section */}
        <div className="flex-1 rounded-lg border border-zinc-200/50 dark:border-zinc-800 p-6 bg-zinc-50/50 dark:bg-zinc-800/20">
          <h2 className="text-lg font-medium mb-4">Create a Room</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Enter room name..."
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              disabled={isCreating}
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 font-medium text-white transition-colors"
            >
              {isCreating ? "Creating..." : "Create Room"}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Enter a room name to invite another player to join your game.
          </p>
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
