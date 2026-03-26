import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { ApiHttpError, getRoomApiContext } from "@/lib/server/nakamaRoomApi";
import { storeGameSessionRecord } from "@/lib/server/roomSessionStore";

export const runtime = "nodejs";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeWinner(value: unknown): string | "draw" | null {
  if (value === null) return null;
  if (value === "draw") return "draw";
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function normalizeBoard(value: unknown): Array<"X" | "O" | null> | undefined {
  if (!Array.isArray(value)) return undefined;
  const board = value.map((cell) => (cell === "X" || cell === "O" ? cell : null)).slice(0, 9);
  return board.length > 0 ? (board as Array<"X" | "O" | null>) : undefined;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function POST(req: Request) {
  try {
    const { body, roomId, groupName, userId, session, client } = await getRoomApiContext(req);

    let groupId: string | null = null;
    try {
      const list = await client.listGroups(session, groupName, undefined, 10);
      const existing = list.groups?.find((group) => group.name === groupName);
      if (!existing?.id) {
        return NextResponse.json({ error: "Room does not exist." }, { status: 404 });
      }
      groupId = existing.id;
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to lookup Nakama group for room.",
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }

    if (!groupId) {
      return NextResponse.json({ error: "Nakama group id missing from response." }, { status: 500 });
    }

    const gameId = typeof body.gameId === "string" && body.gameId.trim() ? body.gameId.trim() : randomUUID();
    const playerIds = parseStringArray(body.playerIds);
    const winner = normalizeWinner(body.winner);
    const startedAt = parseTimestamp(body.startedAt);
    const endedAt = parseTimestamp(body.endedAt) ?? Date.now();
    const board = normalizeBoard(body.board);

    try {
      await client.leaveGroup(session, groupId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isAlreadyLeft =
        message.toLowerCase().includes("already") ||
        message.toLowerCase().includes("not a member") ||
        message.toLowerCase().includes("not member");
      if (!isAlreadyLeft) {
        return NextResponse.json(
          { error: "Failed to leave room group.", details: message },
          { status: 409 }
        );
      }
    }

    let sessionSaved = true;
    try {
      await storeGameSessionRecord({
        gameId,
        roomId,
        groupId,
        playerIds: playerIds.length > 0 ? playerIds : [userId],
        winner,
        startedAt: startedAt ? new Date(startedAt).toISOString() : new Date(endedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        durationMs: startedAt ? Math.max(0, endedAt - startedAt) : 0,
        board,
        endedByUserId: userId,
        reason: "back_to_lobby"
      });
    } catch (error) {
      sessionSaved = false;
      console.error("Failed to store game session record:", error);
    }

    return NextResponse.json({
      roomId,
      groupId,
      gameId,
      left: true,
      sessionSaved
    });
  } catch (error) {
    if (error instanceof ApiHttpError) {
      return NextResponse.json(
        error.details ? { error: error.message, details: error.details } : { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Unexpected error.", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
