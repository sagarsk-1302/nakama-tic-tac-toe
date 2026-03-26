"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";

type RoomApiSuccess = {
  roomId: string;
  groupId: string;
  groupName: string;
  userId: string;
};

function extractRoomIdFromGroupName(groupName: string): string {
  return groupName.replace(/^room_/i, "");
}

function buildGameUrl(result: RoomApiSuccess): string {
  const params = new URLSearchParams({
    roomId: result.roomId,
    groupId: result.groupId,
    groupName: result.groupName
  });
  return `/game?${params.toString()}`;
}

export default function LobbyPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<
    Array<{
      id: string;
      name: string;
      userCount: number;
      maxCount: number;
      open: boolean;
    }>
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [roomResult, setRoomResult] = useState<RoomApiSuccess | null>(null);

  const callRoomApi = async (
    path: "/api/room" | "/api/room/join",
    inputRoomId?: string
  ): Promise<RoomApiSuccess | null> => {
    setMessage(null);
    setRoomResult(null);

    if (!session?.token) {
      setMessage("You need to sign in first to create/join a room.");
      return null;
    }

    const trimmedRoomId = (inputRoomId ?? roomId).trim();
    if (!trimmedRoomId) {
      setMessage("Please enter a room name.");
      return null;
    }

    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({ roomId: trimmedRoomId })
    });

    const data = (await res.json().catch(() => ({}))) as
      | { error?: string; details?: string }
      | { roomId: string; groupId: string; groupName: string; userId: string };

    if (!res.ok) {
      const err = "error" in data && data.error ? data.error : "Request failed.";
      const details = "details" in data && data.details ? ` (${data.details})` : "";
      setMessage(`${err}${details}`);
      return null;
    }

    if ("roomId" in data) {
      setRoomResult(data);
      setMessage(path === "/api/room" ? "Room ready." : "Joined room.");
      return data;
    } else {
      setMessage("Unexpected response from server.");
      return null;
    }
  };

  const fetchRooms = async () => {
    if (!session?.token) {
      setRooms([]);
      setRoomsError("Sign in to see available rooms.");
      return;
    }

    setIsLoadingRooms(true);
    setRoomsError(null);

    try {
      const res = await fetch("/api/room", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.token}`
        }
      });

      const data = (await res.json().catch(() => ({}))) as
        | { error?: string; details?: string }
        | {
            success?: boolean;
            groups?: Array<{
              id: string;
              name: string;
              userCount: number;
              maxCount: number;
              open: boolean;
            }>;
          };

      if (!res.ok) {
        const err = "error" in data && data.error ? data.error : "Failed to load rooms.";
        const details = "details" in data && data.details ? ` (${data.details})` : "";
        setRoomsError(`${err}${details}`);
        setRooms([]);
        return;
      }

      if ("groups" in data && Array.isArray(data.groups)) {
        setRooms(data.groups);
      } else {
        setRooms([]);
      }
    } catch {
      setRoomsError("Failed to load rooms.");
      setRooms([]);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    void fetchRooms();
    // session token is enough to refetch room list after sign in/out.
  }, [session?.token]);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const result = await callRoomApi("/api/room");
      if (result) {
        router.push(buildGameUrl(result));
        return;
      }
      await fetchRooms();
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (inputRoomId?: string) => {
    setIsJoining(true);
    try {
      const result = await callRoomApi("/api/room/join", inputRoomId);
      if (result) {
        router.push(buildGameUrl(result));
        return;
      }
      await fetchRooms();
    } finally {
      setIsJoining(false);
    }
  };

  const handleRandomMatch = async () => {
    setMessage(null);

    if (!session?.token) {
      setMessage("You need to sign in first to find a match.");
      return;
    }

    setIsMatching(true);
    try {
      const waitingRoom = rooms.find((room) => room.open && room.userCount === 1 && room.maxCount > 1);

      if (waitingRoom) {
        const waitingRoomId = extractRoomIdFromGroupName(waitingRoom.name);
        const joined = await callRoomApi("/api/room/join", waitingRoomId);
        if (joined) {
          router.push(buildGameUrl(joined));
          return;
        }
      }

      const randomRoomId = `quick_${Math.random().toString(36).slice(2, 8)}`;
      const created = await callRoomApi("/api/room", randomRoomId);
      if (created) {
        router.push(buildGameUrl(created));
        return;
      }

      await fetchRooms();
    } finally {
      setIsMatching(false);
    }
  };

  const isRoomActionInProgress = isCreating || isJoining;

  return (
    <section className="rounded-2xl border border-zinc-200/70 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-900/30">
      <h1 className="text-3xl font-semibold tracking-tight">Lobby</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Create a room or match with a random player to start a game
      </p>

      <div className="mt-8 flex flex-col gap-6 lg:flex-row">
        {/* Create / Join Room Section */}
        <div className="flex-1 rounded-lg border border-zinc-200/50 dark:border-zinc-800 p-6 bg-zinc-50/50 dark:bg-zinc-800/20">
          <h2 className="text-lg font-medium mb-4">Room</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Enter room name..."
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={isRoomActionInProgress}
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateRoom}
                disabled={isRoomActionInProgress}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 font-medium text-white transition-colors"
              >
                {isCreating ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => void handleJoinRoom()}
                disabled={isRoomActionInProgress}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white/70 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 font-medium text-zinc-900 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/50 dark:text-zinc-100 transition-colors"
              >
                {isJoining ? "Joining..." : "Join"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Create a new room or join an existing one using the same room name.
          </p>
          {message ? (
            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">{message}</p>
          ) : null}
          {roomResult ? (
            <div className="mt-3 rounded-lg border border-zinc-200/70 bg-white/60 p-3 text-xs text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-950/20 dark:text-zinc-200">
              <div>
                <span className="font-medium">Room:</span> <code>{roomResult.roomId}</code>
              </div>
              <div>
                <span className="font-medium">Group:</span> <code>{roomResult.groupId}</code>
              </div>
              <div>
                <span className="font-medium">You:</span> <code>{roomResult.userId}</code>
              </div>
            </div>
          ) : null}

          
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
      <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Available rooms</h3>
              <button
                onClick={() => void fetchRooms()}
                disabled={isLoadingRooms || !session?.token}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {isLoadingRooms ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {roomsError ? (
              <p className="text-xs text-red-600 dark:text-red-400">{roomsError}</p>
            ) : null}

            {!roomsError && isLoadingRooms ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading rooms...</p>
            ) : null}

            {!roomsError && !isLoadingRooms && rooms.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">No rooms available right now.</p>
            ) : null}

            {!roomsError && rooms.length > 0 ? (
              <ul className="space-y-2">
                {rooms.map((room) => (
                  <li
                    key={room.id}
                    className="flex items-center justify-between rounded-md border border-zinc-200/70 bg-white/60 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900/30"
                  >
                    <div>
                      <div className="font-medium text-zinc-800 dark:text-zinc-100">{room.name.replace(/room_/i, "")}</div>
                      <div className="text-zinc-500 dark:text-zinc-400">
                        {room.userCount}/{room.maxCount} players
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const selectedRoomId = extractRoomIdFromGroupName(room.name);
                        setRoomId(selectedRoomId);
                        void handleJoinRoom(selectedRoomId);
                      }}
                      disabled={isRoomActionInProgress || !room.open || room.userCount >= room.maxCount}
                      className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                    >
                      Join
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
    </section>
  );
}
