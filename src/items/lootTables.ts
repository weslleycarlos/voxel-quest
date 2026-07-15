/**
 * Tabelas de loot e raridades (doc §3 /items/lootTables.ts, §6 Fase 3).
 * Cada mob referencia uma tabela declarativa; cada entrada tem chance,
 * quantidade e raridade (cor usada na UI de aviso de coleta).
 */

import { ItemId } from "./item.ts";

export type Rarity = "comum" | "incomum" | "raro" | "épico";

export const RARITY_COLORS: Record<Rarity, string> = {
  comum: "#c8d0c0",
  incomum: "#7ec850",
  raro: "#5aa9ff",
  épico: "#c07dff",
};

export interface LootEntry {
  item: ItemId;
  min: number;
  max: number;
  /** 0..1 — chance de cair. */
  chance: number;
  rarity: Rarity;
}

export const LOOT_TABLES: Record<string, LootEntry[]> = {
  slime: [
    { item: ItemId.SlimeGoo, min: 1, max: 3, chance: 0.9, rarity: "comum" },
    { item: ItemId.Crystal, min: 1, max: 1, chance: 0.03, rarity: "raro" },
  ],
  skeleton: [
    { item: ItemId.Bone, min: 1, max: 2, chance: 0.85, rarity: "comum" },
    { item: ItemId.Coal, min: 1, max: 2, chance: 0.25, rarity: "incomum" },
    { item: ItemId.IronOre, min: 1, max: 1, chance: 0.08, rarity: "raro" },
  ],
  golem: [
    { item: ItemId.Stone, min: 2, max: 5, chance: 1.0, rarity: "comum" },
    { item: ItemId.IronOre, min: 1, max: 2, chance: 0.35, rarity: "incomum" },
    { item: ItemId.GoldOre, min: 1, max: 1, chance: 0.15, rarity: "raro" },
    { item: ItemId.Crystal, min: 1, max: 1, chance: 0.06, rarity: "épico" },
  ],
};

export interface RolledLoot {
  item: ItemId;
  count: number;
  rarity: Rarity;
}

/** Sorteia os drops de uma tabela (níveis maiores rolam bônus de chance). */
export function rollLoot(tableId: string, level: number, rng: () => number = Math.random): RolledLoot[] {
  const table = LOOT_TABLES[tableId];
  if (!table) return [];
  const bonus = 1 + (level - 1) * 0.08; // mobs fortes dropam um pouco melhor
  const out: RolledLoot[] = [];
  for (const e of table) {
    if (rng() > Math.min(1, e.chance * bonus)) continue;
    const count = e.min + Math.floor(rng() * (e.max - e.min + 1));
    out.push({ item: e.item, count, rarity: e.rarity });
  }
  return out;
}
