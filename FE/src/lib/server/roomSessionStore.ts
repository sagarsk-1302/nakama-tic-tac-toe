import "server-only";

import type { Session } from "@heroiclabs/nakama-js";

import { createNakamaClient } from "@/lib/nakama/client";

export type RoomGameSessionRecord = {
  gameId: string;
  roomId: string;
  groupId: string;
  playerIds: string[];
  winner: string | "draw" | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  board?: Array<"X" | "O" | null>;
  endedByUserId: string;
  reason: "back_to_lobby";
};

const GAME_SESSION_COLLECTION = "room_game_sessions";
const SERVICE_DEVICE_ID = process.env.NAKAMA_SERVICE_DEVICE_ID ?? "lila-room-service";
const SERVICE_USERNAME = process.env.NAKAMA_SERVICE_USERNAME ?? "room-service";
const SESSION_REFRESH_WINDOW_MS = 8.64e7;

let cachedServiceSession: Session | null = null;

function isSessionFresh(session: Session): boolean {
  const unixTimeInFuture = (Date.now() + SESSION_REFRESH_WINDOW_MS) / 1000;
  return !session.refresh_token || !session.isexpired(unixTimeInFuture);
}

async function getServiceSession(): Promise<Session> {
  if (cachedServiceSession && isSessionFresh(cachedServiceSession)) {
    return cachedServiceSession;
  }

  const client = createNakamaClient();

  if (cachedServiceSession?.refresh_token) {
    try {
      cachedServiceSession = await client.sessionRefresh(cachedServiceSession);
      return cachedServiceSession;
    } catch {
      cachedServiceSession = null;
    }
  }

  cachedServiceSession = await client.authenticateDevice(SERVICE_DEVICE_ID, true, SERVICE_USERNAME);
  return cachedServiceSession;
}

function normalizePlayerIds(playerIds: unknown): string[] {
  if (!Array.isArray(playerIds)) return [];

  return Array.from(
    new Set(
      playerIds
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value): value is string => Boolean(value))
    )
  );
}

function normalizeBoard(board: unknown): Array<"X" | "O" | null> | undefined {
  if (!Array.isArray(board)) return undefined;

  const nextBoard = board.map((cell) => (cell === "X" || cell === "O" ? cell : null));
  return nextBoard.length > 0 ? (nextBoard.slice(0, 9) as Array<"X" | "O" | null>) : undefined;
}

export async function storeGameSessionRecord(record: RoomGameSessionRecord): Promise<void> {
  const client = createNakamaClient();
  const session = await getServiceSession();

  await client.writeStorageObjects(session, [
    {
      collection: GAME_SESSION_COLLECTION,
      key: record.gameId,
      permission_read: 2,
      permission_write: 0,
      value: {
        ...record,
        playerIds: normalizePlayerIds(record.playerIds),
        board: normalizeBoard(record.board)
      }
    }
  ]);
}

