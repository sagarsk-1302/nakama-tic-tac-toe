import { Suspense } from "react";

import GameClient from "./GameClient";

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <section className="rounded-2xl border border-zinc-200/70 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-900/30">
          <h1 className="text-2xl font-semibold tracking-tight">Game</h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Loading room...</p>
        </section>
      }
    >
      <GameClient />
    </Suspense>
  );
}

