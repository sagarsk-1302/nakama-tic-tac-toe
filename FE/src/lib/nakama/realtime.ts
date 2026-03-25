import type { Session, Socket } from "@heroiclabs/nakama-js";
import { Client } from "@heroiclabs/nakama-js";

export async function connectRealtimeSocket({
  client,
  session,
  onDisconnect,
  onError
}: {
  client: Client;
  session: Session;
  onDisconnect?: (event: Event) => void;
  onError?: (event: Event) => void;
}): Promise<Socket> {
  const socket = client.createSocket();
  if (onDisconnect) socket.ondisconnect = onDisconnect;
  if (onError) socket.onerror = onError;
  await socket.connect(session, true);
  return socket;
}
