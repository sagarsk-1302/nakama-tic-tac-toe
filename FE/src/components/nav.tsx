import Link from "next/link";

const linkClassName =
  "rounded-md px-2 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-50";

export default function Nav() {
  return (
    <nav className="flex flex-wrap items-center gap-2">
      <Link className={linkClassName} href="/">
        Home
      </Link>
      <Link className={linkClassName} href="/auth">
        Auth
      </Link>
      <Link className={linkClassName} href="/lobby">
        Lobby
      </Link>
      <Link className={linkClassName} href="/leaderboard">
        Leaderboard
      </Link>
      <Link className={linkClassName} href="/about">
        About
      </Link>
    </nav>
  );
}