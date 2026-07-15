/**
 * Crafting simples declarativo (doc §3 /items/crafting.ts). Fase 2: receitas em
 * grid 2×2 (crafting manual), acessível com a tecla E. Cada receita consome
 * ingredientes e produz um resultado.
 */

import { ItemId } from "./item.ts";
import { Inventory } from "./inventory.ts";
import type { ItemStack } from "./inventory.ts";

export const CRAFTING_GRID_SIZE = 4; // 2×2

export interface Recipe {
  id: string;
  /** Lista de 4 posições (linha-major): null = vazio. */
  pattern: (ItemId | null)[];
  result: ItemStack;
}

export const RECIPES: Recipe[] = [
  {
    id: "planks_from_log",
    pattern: [ItemId.Log, null, null, null],
    result: { id: ItemId.Plank, count: 4 },
  },
  {
    id: "sticks_from_planks",
    pattern: [ItemId.Plank, null, ItemId.Plank, null],
    result: { id: ItemId.Stick, count: 4 },
  },
  {
    id: "pickaxe_wood",
    pattern: [ItemId.Plank, ItemId.Plank, ItemId.Plank, ItemId.Stick],
    result: { id: ItemId.PickaxeWood, count: 1 },
  },
  {
    id: "pickaxe_stone",
    pattern: [ItemId.Stone, ItemId.Stone, ItemId.Stone, ItemId.Stick],
    result: { id: ItemId.PickaxeStone, count: 1 },
  },
  {
    id: "pickaxe_iron",
    pattern: [ItemId.IronOre, ItemId.IronOre, ItemId.IronOre, ItemId.Stick],
    result: { id: ItemId.PickaxeIron, count: 1 },
  },
  {
    id: "pickaxe_gold",
    pattern: [ItemId.GoldOre, ItemId.GoldOre, ItemId.GoldOre, ItemId.Stick],
    result: { id: ItemId.PickaxeGold, count: 1 },
  },
  {
    id: "pickaxe_arcane",
    pattern: [ItemId.Crystal, ItemId.Crystal, ItemId.Crystal, ItemId.Stick],
    result: { id: ItemId.PickaxeArcane, count: 1 },
  },

  // Espadas (Fase 3): lâmina em coluna sobre o cabo.
  {
    id: "sword_wood",
    pattern: [ItemId.Plank, null, ItemId.Stick, null],
    result: { id: ItemId.SwordWood, count: 1 },
  },
  {
    id: "sword_stone",
    pattern: [ItemId.Stone, null, ItemId.Stick, null],
    result: { id: ItemId.SwordStone, count: 1 },
  },
  {
    id: "sword_iron",
    pattern: [ItemId.IronOre, null, ItemId.Stick, null],
    result: { id: ItemId.SwordIron, count: 1 },
  },
  {
    id: "sword_gold",
    pattern: [ItemId.GoldOre, null, ItemId.Stick, null],
    result: { id: ItemId.SwordGold, count: 1 },
  },
  {
    id: "sword_arcane",
    pattern: [ItemId.Crystal, null, ItemId.Stick, null],
    result: { id: ItemId.SwordArcane, count: 1 },
  },
];

/** Verifica se o conteúdo do grid casa com uma receita (considera rotações? Não na Fase 2). */
function matches(grid: (ItemId | null)[], pattern: (ItemId | null)[]): boolean {
  for (let i = 0; i < CRAFTING_GRID_SIZE; i++) {
    if (grid[i] !== pattern[i]) return false;
  }
  return true;
}

export function findRecipe(grid: (ItemId | null)[]): Recipe | null {
  return RECIPES.find((r) => matches(grid, r.pattern)) ?? null;
}

/** Verifica se o grid contém os ingredientes e se o inventário tem espaço para o resultado. */
export function canCraft(recipe: Recipe, grid: (ItemStack | null)[], inventory: Inventory): boolean {
  // Verifica ingredientes no grid.
  const needs = new Map<ItemId, number>();
  for (const id of recipe.pattern) {
    if (!id) continue;
    needs.set(id, (needs.get(id) ?? 0) + 1);
  }

  const available = new Map<ItemId, number>();
  for (const s of grid) {
    if (!s) continue;
    available.set(s.id, (available.get(s.id) ?? 0) + s.count);
  }

  for (const [id, qty] of needs) {
    if ((available.get(id) ?? 0) < qty) return false;
  }

  // Verifica se há espaço para o resultado (deep-clone para não alterar o real).
  const testInv = new Inventory();
  testInv.fromSave({
    slots: inventory.slots.map((s) => (s ? { id: s.id, count: s.count } : null)),
    selected: inventory.selected,
  });
  const leftover = testInv.add(recipe.result.id, recipe.result.count);
  return leftover === 0;
}

/** Consome os ingredientes do grid e adiciona o resultado ao inventário. */
export function craftInGrid(recipe: Recipe, grid: (ItemStack | null)[], inventory: Inventory): boolean {
  if (!canCraft(recipe, grid, inventory)) return false;

  // Consome ingredientes do grid.
  const needs = new Map<ItemId, number>();
  for (const id of recipe.pattern) {
    if (!id) continue;
    needs.set(id, (needs.get(id) ?? 0) + 1);
  }

  for (const [id, qty] of needs) {
    let remaining = qty;
    for (const s of grid) {
      if (!s || s.id !== id) continue;
      const take = Math.min(remaining, s.count);
      s.count -= take;
      remaining -= take;
      if (remaining === 0) break;
    }
  }

  inventory.add(recipe.result.id, recipe.result.count);
  return true;
}
