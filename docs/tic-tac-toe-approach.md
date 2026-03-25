# Tic-Tac-Toe (Next.js UI + Nakama Authoritative Multiplayer) — Approach

## Goals
- Responsive web UI (desktop + mobile) for real-time PvP tic-tac-toe.
- Show player profile + match status (searching, matched, in-game, finished).
- Automatic matchmaking (server pairs players).
- Real-time authoritative game-state updates (Nakama owns state/scores/leaderboards).
- Reduce client-side cheating (client sends *intent*, server validates and broadcasts truth).

## Proposed architecture
**Client (Next.js + NextUI)**
- Renders UI, collects user actions, connects to Nakama realtime (WebSocket).
- Sends only “move intent” (cell index), never “new state”.

**Nakama (server authoritative)**
- Owns match state and rules validation.
- Runs matchmaking and creates authoritative matches.
- Stores: match results, player stats, leaderboards, profile data (as needed).


## Core UX / screens
1) **Auth / Identify**
   - Authenticate via Nakama (device/email/OAuth) and fetch player profile.
2) **Lobby**
   - Profile card (name/avatar/rating) + online indicator.
   - “Play” button starts matchmaking; status shows “Searching…”.
3) **Match**
   - Player panels: you vs opponent (avatar/name + turn indicator + connection status).
   - 3×3 board with tap/click; disable input when not your turn.
   - “Rematch” and “Leave” actions after completion.
4) **Leaderboard**
   - Pull from Nakama leaderboard (top players, your rank).

## Nakama authoritative match design
Implement an authoritative match handler (Lua or Go runtime).

**Match state (server-owned)**
- `players`: `{ userId -> {presence, symbol ('X'|'O'), lastSeen, ...} }`
- `board`: array[9] of `'X'|'O'|null`
- `turnUserId`
- `status`: `lobby | playing | finished`
- `winnerUserId | null`, `isDraw`
- `moveCount`, `version` (monotonic for client reconciliation)

**Client → server messages (intents)**
- `JOIN` (optional; usually implied by presence)
- `MOVE { index: 0..8 }`
- `LEAVE`
- `REMATCH_REQUEST` (optional)

**Server → clients messages (truth)**
- `STATE { board, turnUserId, status, winnerUserId, isDraw, version, players }`
- `ERROR { code, message }`
- `PRESENCE { joins/leaves }`

**Validation rules (anti-cheat baseline)**
- Reject if `status != playing`.
- Reject if sender is not in `players`.
- Reject if not sender’s turn.
- Reject if `index` out of range or cell already occupied.
- Apply move, compute win/draw, update `turnUserId`, increment `version`.
- Broadcast updated `STATE` to both players.

**Persistence (in Nakama)**
- Write match result to Storage (per-user stats doc) and/or update Leaderboard.
- Consider an ELO-like rating as a future enhancement; start with simple W/L/D counters.

## Matchmaking (auto-pairing)
Use Nakama’s matchmaking to pair players:
- Client requests matchmaking: `AddMatchmaker(...)` with properties (region, rating bucket, etc.).
- On matchmaker matched:
  - Server creates/joins an authoritative match instance and assigns symbols (`X`/`O`).
  - Client receives match id and connects via realtime to the match.

Matchmaking knobs to start:
- 1v1, min=2 max=2.
- Optional: restrict by region and rating range.
- Timeouts: if no match within N seconds, widen rating range.

## Real-time state updates (UI)
On the client:
- Maintain local UI state derived from latest server `STATE` message.
- Optimistic UI is optional; safest is “server-confirmed only”.
- If you do optimistic moves, reconcile using `version` and replace local state on mismatch.

## Next.js + NextUI implementation sketch
**Suggested structure (App Router)**
- `app/(game)/lobby/page.tsx` – profile + matchmaking
- `app/(game)/match/[matchId]/page.tsx` – live match UI
- `app/(game)/leaderboard/page.tsx` – leaderboard view
- `app/components/game/board.tsx` – board rendering + input gating
- `app/components/game/player-card.tsx` – avatar/name/status/turn
- `lib/nakama/client.ts` – Nakama JS client initialization
- `lib/nakama/realtime.ts` – socket connection + match event handlers

**Responsive UI**
- Board: fixed aspect square, scales with viewport width; large tap targets on mobile.
- Use CSS grid for 3×3; NextUI `Button` or `Card` components per cell.
- Player panels stack on mobile, side-by-side on desktop.

## Cheat-resistance measures (practical)
- Authoritative validation in match handler (primary control).
- Never accept state from client; accept only actions (move index).
- Server timestamps / rate limiting: reject spammy moves, enforce turn timeouts if desired.
- Presence-aware turn logic: handle disconnects, allow short reconnection window, then forfeit.
- Use Nakama session auth; never trust client-provided userId.
- Keep any scoring/leaderboard writes server-side only.

## FastAPI responsibilities (if used)
Keep FastAPI thin:
- Admin tools (ban users, reset stats), analytics, webhook processing.
- Optional: issue short-lived config or feature flags for the web client.
- Do **not** duplicate matchmaking or game logic here if Nakama is authoritative.

## Local development (Nakama via Docker)
This repo includes `docker-compose.nakama.yml` to run Nakama + Postgres locally using the official Nakama Docker image.

**Start**
- `docker compose -f docker-compose.nakama.yml up -d`

**Stop**
- `docker compose -f docker-compose.nakama.yml down`

**Ports (host)**
- `7350` HTTP/WebSocket (Next.js client connects here)
- `7351` Nakama console UI
- `7349` gRPC (optional for future services)

**Default dev credentials (in `docker-compose.nakama.yml`)**
- Server key: `defaultkey`
- Console: `admin` / `password`

**Where to put authoritative server code**
- Drop runtime modules into `nakama/modules/` (mounted into the container at `/nakama/data/modules`).

**Next.js client config (suggested)**
- `NEXT_PUBLIC_NAKAMA_HOST=127.0.0.1`
- `NEXT_PUBLIC_NAKAMA_PORT=7350`
- `NEXT_PUBLIC_NAKAMA_USE_SSL=false`
- `NEXT_PUBLIC_NAKAMA_SERVER_KEY=defaultkey`

## Milestones
1) Client UI: lobby → match screen (static), responsive layout (NextUI).
2) Nakama: authoritative match handler + move validation + state broadcast.
3) Client realtime: connect, join match, render updates, send moves.
4) Matchmaking: automatic pairing, route to `match/[matchId]`.
5) Persistence: W/L/D stats + leaderboard in Nakama.
6) Hardening: disconnect handling, basic rate limits, telemetry.

## Open decisions (confirm early)
- Nakama runtime: **Lua** (fast to iterate) vs **Go** (performance/typing).
- Auth method: device id vs email/password vs OAuth.
- Rating system: simple W/L/D vs ELO-like rating.
