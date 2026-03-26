import { NextResponse } from "next/server";

import { ApiHttpError, getRoomApiContext } from "@/lib/server/nakamaRoomApi";
import { error, log } from "console";
import { createNakamaClient } from "@/lib/nakama/client";
import { Session } from "@heroiclabs/nakama-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { roomId, groupName, userId, session, client } = await getRoomApiContext(req);

    let groupId: string | null = null;
    try {
      const list = await client.listGroups(session, groupName, undefined, 10);
      const existing = list.groups?.find((g) => g.name === groupName);
      if (existing) {
        log(`Found existing group for room ${roomId}: ${existing.id}`);
        return NextResponse.json({
          error: "Room already exists.",
          details: `A room with the name "${roomId}" already exists. Please choose a different name or join the existing room.`
        }, { status: 409 });
      }

      const created = await client.createGroup(session, {
          name: groupName,
          description: `Room ${roomId}`,
          open: true,
          max_count: 2
        });
      groupId = created.id ?? null;
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
      console.debug(error)
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

interface GroupUser {
  userId: string;
  username: string;
  avatarUrl?: string;
}

interface GroupWithUsers {
  id: string;
  name: string;
  description?: string;
  open: boolean;
  maxCount: number;
  userCount: number;
  users: GroupUser[];
}

function parseBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;
  if (!token) return null;
  return token.trim() || null;
}

async function getSessionFromRequest(req: Request): Promise<{ session: Session; userId: string }> {
  const tokenFromHeader = parseBearerToken(req.headers.get("authorization"));
  
  if (!tokenFromHeader) {
    throw new ApiHttpError(
      401,
      "Missing token. Provide `Authorization: Bearer <token>`."
    );
  }

  let session: Session;
  try {
    session = Session.restore(tokenFromHeader, "");
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

  return { session, userId };
}

async function getGroupsWithUsers(session: Session): Promise<GroupWithUsers[]> {
  const client = createNakamaClient();
  const groups: GroupWithUsers[] = [];
  
  try {
    // List all groups - using empty prefix to get all groups
    const groupList = await client.listGroups(session, "", undefined, 100);
    
    if (!groupList.groups || groupList.groups.length === 0) {
      return groups;
    }

    // Get users for each group
    for (const group of groupList.groups) {
      if (!group.id) continue;
      
      try {
        const groupUserList = await client.listGroupUsers(session, group.id);
        
        // GroupUserList has 'group_users' property containing the user list
        const rawGroupUsers = (groupUserList as unknown as { group_users?: Array<{ user?: { id?: string; username?: string; avatar_url?: string } }> }).group_users || [];
        
        const users: GroupUser[] = rawGroupUsers
          .filter((gu) => gu.user?.id)
          .map((gu) => ({
            userId: gu.user!.id || "",
            username: gu.user!.username || "",
            avatarUrl: gu.user!.avatar_url
          }));

        groups.push({
          id: group.id,
          name: group.name || "",
          description: group.description,
          open: group.open ?? false,
          maxCount: group.max_count ?? 0,
          userCount: rawGroupUsers.length,
          users
        });
      } catch (error) {
        // If we can't list users for a group, still include the group without users
        console.error(`Failed to get users for group ${group.id}:`, error);
        groups.push({
          id: group.id,
          name: group.name || "",
          description: group.description,
          open: group.open ?? false,
          maxCount: group.max_count ?? 0,
          userCount: 0,
          users: []
        });
      }
    }
  } catch (error) {
    console.error("Failed to list groups:", error);
    throw error;
  }

  return groups;
}

export async function GET(req: Request) {
  try {
    const { session } = await getSessionFromRequest(req);
    const groups = await getGroupsWithUsers(session);

    return NextResponse.json({
      success: true,
      count: groups.length,
      groups
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