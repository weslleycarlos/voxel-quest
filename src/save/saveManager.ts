import { dbGet, dbGetPrefix, dbSetMany } from "./db.ts";
import { touchWorld } from "./worldRegistry.ts";
import type { InventorySave } from "../items/inventory.ts";

/**
 * Serialização do mundo ativo (doc §3 /save/saveManager.ts, §4.8). Salva o
 * estado do jogador, inventário e APENAS os chunks modificados — o resto é
 * regenerado pela seed, mantendo os saves pequenos. Autosave: 30 s, pausa e
 * beforeunload.
 */

export interface PlayerSave {
  pos: [number, number, number];
  yaw: number;
  pitch: number;
  inventory: InventorySave;
}

export interface WorldSave {
  player: PlayerSave | null;
  chunks: Map<string, Uint8Array>;
}

const playerKey = (worldId: string) => `${worldId}:player`;
const chunkPrefix = (worldId: string) => `${worldId}:chunk:`;

export async function loadWorldSave(worldId: string): Promise<WorldSave> {
  const [player, chunkEntries] = await Promise.all([
    dbGet<PlayerSave>(playerKey(worldId)),
    dbGetPrefix<Uint8Array>(chunkPrefix(worldId)),
  ]);
  const chunks = new Map<string, Uint8Array>();
  const prefixLen = chunkPrefix(worldId).length;
  for (const [key, data] of chunkEntries) {
    chunks.set(key.slice(prefixLen), new Uint8Array(data));
  }
  return { player: player ?? null, chunks };
}

export async function saveWorld(
  worldId: string,
  player: PlayerSave,
  modifiedChunks: Map<string, Uint8Array>
): Promise<void> {
  const entries: [string, unknown][] = [[playerKey(worldId), player]];
  for (const [key, data] of modifiedChunks) {
    entries.push([chunkPrefix(worldId) + key, data]);
  }
  await dbSetMany(entries);
  await touchWorld(worldId);
}
