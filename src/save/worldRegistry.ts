import { dbGet, dbSet, dbDeletePrefix } from "./db.ts";

/**
 * Lista de mundos salvos (doc §3 /save/worldRegistry.ts, §4.8): criar, listar,
 * atualizar "último jogo" e excluir. Cada mundo é um namespace isolado no
 * IndexedDB; `versaoSave` permite migrar formatos futuros sem corromper saves.
 */

export const SAVE_VERSION = 1;

export interface WorldMeta {
  id: string;
  nome: string;
  seed: string;
  criadoEm: string;
  ultimoJogo: string;
  versaoSave: number;
}

const REGISTRY_KEY = "worldRegistry";

export async function listWorlds(): Promise<WorldMeta[]> {
  const reg = await dbGet<{ mundos: WorldMeta[] }>(REGISTRY_KEY);
  const worlds = reg?.mundos ?? [];
  return worlds.sort((a, b) => b.ultimoJogo.localeCompare(a.ultimoJogo));
}

async function saveRegistry(mundos: WorldMeta[]): Promise<void> {
  await dbSet(REGISTRY_KEY, { mundos });
}

export async function createWorld(nome: string, seed: string): Promise<WorldMeta> {
  const worlds = await listWorlds();
  const id = "w_" + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString();
  const meta: WorldMeta = {
    id,
    nome: nome.trim() || "Novo Mundo",
    seed: seed.trim() || Math.random().toString(36).slice(2, 10),
    criadoEm: now,
    ultimoJogo: now,
    versaoSave: SAVE_VERSION,
  };
  worlds.push(meta);
  await saveRegistry(worlds);
  return meta;
}

export async function touchWorld(id: string): Promise<void> {
  const worlds = await listWorlds();
  const w = worlds.find((w) => w.id === id);
  if (!w) return;
  w.ultimoJogo = new Date().toISOString();
  await saveRegistry(worlds);
}

export async function deleteWorld(id: string): Promise<void> {
  const worlds = await listWorlds();
  await saveRegistry(worlds.filter((w) => w.id !== id));
  await dbDeletePrefix(id + ":");
}
