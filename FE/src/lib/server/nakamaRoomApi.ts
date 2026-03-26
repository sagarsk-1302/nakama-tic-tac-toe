import "server-only";

import { Session } from "@heroiclabs/nakama-js";

import { createNakamaClient } from "@/lib/nakama/client";
import { log } from "console";

export type RoomApiBody = {
  roomId?: unknown;
  token?: unknown;
  gameId?: unknown;
  playerIds?: unknown;
  winner?: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  board?: unknown;
};

export class ApiHttpError extends Error {
  status: number;
  details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function parseBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;
  if (!token) return null;
  return token.trim() || null;
}

export function toRoomGroupName(roomId: string): string {
  const normalized = roomId.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return `room_${normalized}`.slice(0, 128);
}

async function readJsonBody(req: Request): Promise<RoomApiBody> {
  try {
    return (await req.json()) as RoomApiBody;
  } catch {
    throw new ApiHttpError(400, "Invalid JSON body.");
  }
}

export async function getRoomApiContext(req: Request): Promise<{
  body: RoomApiBody;
  roomId: string;
  groupName: string;
  userId: string;
  session: Session;
  client: ReturnType<typeof createNakamaClient>;
}> {
  const body = await readJsonBody(req);

  const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
  if (!roomId) {
    throw new ApiHttpError(400, "`roomId` is required.");
  }

  const tokenFromBody = typeof body.token === "string" ? body.token.trim() : "";
  const tokenFromHeader = parseBearerToken(req.headers.get("authorization"));
  const token = tokenFromHeader ?? (tokenFromBody || null);

  if (!token) {
    throw new ApiHttpError(
      401,
      "Missing token. Provide `Authorization: Bearer <token>` or `token` in the JSON body."
    );
  }

  let session: Session;
  try {
    session = Session.restore(token, "");
  } catch {
    throw new ApiHttpError(401, "Token is not a valid Nakama session JWT.");
  }

  const client = createNakamaClient();

  try {
    await client.getAccount(session);

  } catch (error) {
    throw new ApiHttpError(
      401,
      "Token failed validation with Nakama.",
      error instanceof Error ? error.message : String(error)
    );
  }

  const userId = session.user_id;
  if (!userId) {
    throw new ApiHttpError(500, "Validated token is missing user id.");
  }

  return {
    body,
    roomId,
    groupName: toRoomGroupName(roomId),
    userId,
    session,
    client
  };
}
