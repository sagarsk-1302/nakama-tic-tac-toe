import { Client } from "@heroiclabs/nakama-js";

export type NakamaConfig = {
  host: string;
  port: string;
  useSSL: boolean;
  serverKey: string;
};

export function getNakamaConfig(): NakamaConfig {
  return {
    host: process.env.NEXT_PUBLIC_NAKAMA_HOST ?? "127.0.0.1",
    port: process.env.NEXT_PUBLIC_NAKAMA_PORT ?? "7350",
    useSSL: (process.env.NEXT_PUBLIC_NAKAMA_USE_SSL ?? "false") === "true",
    serverKey: process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY ?? "defaultkey"
  };
}

export function createNakamaClient() {
  const { host, port, useSSL, serverKey } = getNakamaConfig();
  return new Client(serverKey, host, port, useSSL);
}

