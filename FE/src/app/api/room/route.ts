import { NextResponse } from "next/server";

import { ApiHttpError, getRoomApiContext } from "@/lib/server/nakamaRoomApi";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { roomId, groupName, userId, session, client } = await getRoomApiContext(req);

    let groupId: string | null = null;
    try {
      const list = await client.listGroups(session, groupName, undefined, 10);
      const existing = list.groups?.find((g) => g.name === groupName);

      if (existing?.id) {
        groupId = existing.id ?? null;
      } else {
        const created = await client.createGroup(session, {
          name: groupName,
          description: `Room ${roomId}`,
          open: true,
          max_count: 2
        });
        groupId = created.id ?? null;
      }
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to find/create Nakama group for room.",
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }

    if (!groupId) {
      return NextResponse.json({ error: "Nakama group id missing from response." }, { status: 500 });
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
