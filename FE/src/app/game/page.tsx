"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ChannelPresenceEvent, Presence, Socket } from "@heroiclabs/nakama-js";

import { useAuth } from "@/components/auth-provider";
import { createNakamaClient } from "@/lib/nakama/client";
import { connectRealtimeSocket } from "@/lib/nakama/realtime";

type CellValue = "X" | "O" | null;
type SymbolValue = "X" | "O";

type MoveMessage = {
  type: "move";
  index: number;
  symbol: SymbolValue;
};

type ResetMessage = {
  type: "reset";
};

type GameMessage = MoveMessage | ResetMessage;

const initialBoard: CellValue[] = Array.from({ length: 9 }, () => null);

function uniquePresences(presences: Presence[]): Presence[] {
  const seen = new Set<string>();
  const unique: Presence[] = [];
  for (const presence of presences) {
    if (seen.has(presence.user_id)) continue;
    seen.add(presence.user_id);
    unique.push(presence);
  }
  return unique;
}

function applyPresenceEvent(current: Presence[], event: ChannelPresenceEvent): Presence[] {
  const joins = Array.isArray(event.joins) ? event.joins : [];
  const leavesList = Array.isArray(event.leaves) ? event.leaves : [];
  const leaves = new Set(leavesList.map((presence) => presence.user_id));
  const withoutLeaves = current.filter((presence) => !leaves.has(presence.user_id));
  return uniquePresences([...withoutLeaves, ...joins]);
}

function deriveWinner(board: CellValue[]): SymbolValue | "draw" | null {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ] as const;

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return board[a];
    }
  }

  return board.every((cell) => cell) ? "draw" : null;
}

function parseGameMessage(content: unknown): GameMessage | null {
  if (!content || typeof content !== "object") return null;
  const data = content as Record<string, unknown>;

  if (data.type === "reset") {
    return { type: "reset" };
  }

  if (
    data.type === "move" &&
    typeof data.index === "number" &&
    data.index >= 0 &&
    data.index <= 8 &&
    (data.symbol === "X" || data.symbol === "O")
  ) {
    return {
      type: "move",
      index: data.index,
      symbol: data.symbol
    };
  }

  return null;
}

export default function GamePage() {
  const searchParams = useSearchParams();
  const { session } = useAuth();

  const roomId = searchParams.get("roomId") ?? "";
  const groupId = searchParams.get("groupId") ?? "";

  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [socketError, setSocketError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [board, setBoard] = useState<CellValue[]>(initialBoard);
  const [turn, setTurn] = useState<SymbolValue>("X");
  const [winner, setWinner] = useState<SymbolValue | "draw" | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const hostUserIdRef = useRef<string | null>(null);
  const turnRef = useRef<SymbolValue>("X");
  const winnerRef = useRef<SymbolValue | "draw" | null>(null);

  const playerIds = useMemo(
    () => Array.from(new Set(presences.map((presence) => presence.user_id))).sort().slice(0, 2),
    [presences]
  );
  const hasOpponent = playerIds.length >= 2;
  const myUserId = session?.user_id ?? null;

  const mySymbol = useMemo<SymbolValue | null>(() => {
    if (!myUserId || playerIds.length < 2) return null;
    if (playerIds[0] === myUserId) return "X";
    if (playerIds[1] === myUserId) return "O";
    return null;
  }, [myUserId, playerIds]);

  const canPlay = hasOpponent && mySymbol !== null && winner === null && turn === mySymbol;

  useEffect(() => {
    setBoard(initialBoard);
    setTurn("X");
    setWinner(null);
    turnRef.current = "X";
    winnerRef.current = null;
  }, [playerIds.join("|")]);

  useEffect(() => {
    if (!session || !groupId) {
      setSocketStatus("error");
      setSocketError(!session ? "You must be signed in to play." : "Missing room group id.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setSocketStatus("connecting");
        setSocketError(null);

        const socket = await connectRealtimeSocket({
          client: createNakamaClient(),
          session,
          onDisconnect: () => {
            if (cancelled) return;
            setSocketStatus("error");
            setSocketError("Disconnected from realtime socket.");
          },
          onError: () => {
            if (cancelled) return;
            setSocketStatus("error");
            setSocketError("Realtime socket error.");
          }
        });

        if (cancelled) {
          socket.disconnect(false);
          return;
        }

        socketRef.current = socket;

        socket.onchannelpresence = (event) => {
          setPresences((current) => applyPresenceEvent(current, event));
        };

        socket.onchannelmessage = (message) => {
          const parsed = parseGameMessage(message.content);
          if (!parsed) return;

          if (parsed.type === "reset") {
            setBoard(initialBoard);
            setTurn("X");
            setWinner(null);
            turnRef.current = "X";
            winnerRef.current = null;
            return;
          }

          setBoard((currentBoard) => {
            if (currentBoard[parsed.index] || winnerRef.current) return currentBoard;
            if (turnRef.current !== parsed.symbol) return currentBoard;

            const nextBoard = [...currentBoard];
            nextBoard[parsed.index] = parsed.symbol;
            const nextWinner = deriveWinner(nextBoard);
            const nextTurn: SymbolValue = parsed.symbol === "X" ? "O" : "X";

            winnerRef.current = nextWinner;
            turnRef.current = nextTurn;
            setWinner(nextWinner);
            setTurn(nextTurn);
            return nextBoard;
          });
        };

        const channel = await socket.joinChat(groupId, 3, false, false);
        if (cancelled) {
          socket.disconnect(false);
          return;
        }

        const joinedPresences = Array.isArray(channel.presences) ? channel.presences : [];
        const selfPresence = channel.self ? [channel.self] : [];
        const nextPresences = uniquePresences([...selfPresence, ...joinedPresences]);
        hostUserIdRef.current = nextPresences.map((presence) => presence.user_id).sort()[0] ?? null;
        setChannelId(channel.id);
        setPresences(nextPresences);
        setSocketStatus("connected");
      } catch (error) {
        if (cancelled) return;
        setSocketStatus("error");
        setSocketError(error instanceof Error ? error.message : "Failed to connect realtime socket.");
      }
    })();

    return () => {
      cancelled = true;
      const activeSocket = socketRef.current;
      socketRef.current = null;
      if (activeSocket) {
        activeSocket.disconnect(false);
      }
    };
  }, [groupId, session]);

  useEffect(() => {
    if (!channelId || !hasOpponent || !myUserId || myUserId !== hostUserIdRef.current) return;
    const socket = socketRef.current;
    if (!socket) return;
    void socket.writeChatMessage(channelId, { type: "reset" } satisfies ResetMessage);
  }, [channelId, hasOpponent, myUserId, playerIds.join("|")]);

  const submitMove = async (index: number) => {
    if (!channelId || !mySymbol || !canPlay) return;
    if (board[index]) return;

    const socket = socketRef.current;
    if (!socket) return;

    const nextBoard = [...board];
    nextBoard[index] = mySymbol;
    const nextWinner = deriveWinner(nextBoard);
    const nextTurn: SymbolValue = mySymbol === "X" ? "O" : "X";

    setBoard(nextBoard);
    setTurn(nextTurn);
    setWinner(nextWinner);
    turnRef.current = nextTurn;
    winnerRef.current = nextWinner;

    try {
      await socket.writeChatMessage(
        channelId,
        {
          type: "move",
          index,
          symbol: mySymbol
        } satisfies MoveMessage
      );
    } catch {
      setSocketError("Failed to send move. Check your connection.");
    }
  };

  if (!roomId || !groupId) {
    return (
      <section className="rounded-2xl border border-zinc-200/70 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-900/30">
        <h1 className="text-2xl font-semibold tracking-tight">Game</h1>
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          Missing room context. Start from the lobby.
        </p>
        <Link href="/lobby" className="mt-5 inline-block text-sm font-medium text-blue-600 hover:underline">
          Return to Lobby
        </Link>
      </section>
    );
  }

  const statusText = hasOpponent
    ? winner
      ? winner === "draw"
        ? "Draw game."
        : `${winner} wins.`
      : canPlay
        ? `Your turn (${mySymbol}).`
        : mySymbol
          ? `Opponent's turn (${turn}).`
          : "Spectating."
    : "Waiting for opponent to join...";

  return (
    <section className="rounded-2xl border border-zinc-200/70 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-900/30">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Game Room: {roomId}</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Players connected: {playerIds.length}/2 | Socket: {socketStatus}
          </p>
        </div>
        <Link href="/lobby" className="rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          Back to Lobby
        </Link>
      </div>

      <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-200">{statusText}</p>
      {socketError ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{socketError}</p> : null}

      <div className="mt-6 grid w-full max-w-sm grid-cols-3 gap-2">
        {board.map((cell, index) => (
          <button
            key={index}
            type="button"
            onClick={() => void submitMove(index)}
            disabled={!canPlay || cell !== null || socketStatus !== "connected"}
            className="aspect-square rounded-md border border-zinc-300 bg-white text-3xl font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {cell ?? ""}
          </button>
        ))}
      </div>
    </section>
  );
}
