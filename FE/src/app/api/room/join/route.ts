import { NextResponse } from "next/server";

import { ApiHttpError, getRoomApiContext } from "@/lib/server/nakamaRoomApi";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { roomId, groupName, userId, session, client } = await getRoomApiContext(req);

    let groupId: string | null = null;
    let maxCount: number | undefined;
    let edgeCount: number | undefined;
    try {
      const list = await client.listGroups(session, groupName, undefined, 10);
      const existing = list.groups?.find((g) => g.name === groupName);
      if (!existing?.id) {
        return NextResponse.json({ error: "Room does not exist." }, { status: 404 });
      }
      groupId = existing.id ?? null;
      maxCount = existing.max_count;
      edgeCount = existing.edge_count;
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

    if (typeof maxCount === "number" && typeof edgeCount === "number" && edgeCount >= maxCount) {
      return NextResponse.json({ error: "Room is full." }, { status: 409 });
    }

    try {
      await client.joinGroup(session, groupId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isAlreadyMember =
        message.toLowerCase().includes("already") || message.toLowerCase().includes("exists");
      if (!isAlreadyMember) {
        return NextResponse.json(
          { error: "Failed to join room group.", details: message },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({
      roomId,
      groupId,
      groupName,
      userId
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
