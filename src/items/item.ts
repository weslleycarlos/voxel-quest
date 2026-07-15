/**
 * Registro declarativo de itens (doc §3 /items/item.ts). Fase 2: itens são
 * separados dos blocos. Um item pode ser recurso, ferramenta ou bloco
 * colocável. Dados em objetos, nunca hardcoded na lógica.
 */

import { Block } from "../world/blocks.ts";

export const enum ItemId {
  // Recursos
  Log = "log",
  Plank = "plank",
  Stick = "stick",
  Dirt = "dirt",
  Sand = "sand",
  Stone = "stone",
  Leaves = "leaves",
  Snow = "snow",
  Coal = "coal",
  IronOre = "iron_ore",
  GoldOre = "gold_ore",
  Crystal = "crystal",

  // Drops de mobs (Fase 3)
  SlimeGoo = "slime_goo",
  Bone = "bone",

  // Ferramentas
  PickaxeWood = "pickaxe_wood",
  PickaxeStone = "pickaxe_stone",
  PickaxeIron = "pickaxe_iron",
  PickaxeGold = "pickaxe_gold",
  PickaxeArcane = "pickaxe_arcane",

  // Armas (Fase 3)
  SwordWood = "sword_wood",
  SwordStone = "sword_stone",
  SwordIron = "sword_iron",
  SwordGold = "sword_gold",
  SwordArcane = "sword_arcane",

  // Blocos colocáveis (sufixo _block para diferenciar do recurso bruto)
  GrassBlock = "grass_block",
  DirtBlock = "dirt_block",
  SandBlock = "sand_block",
  StoneBlock = "stone_block",
  WoodBlock = "wood_block",
  LeavesBlock = "leaves_block",
  SnowBlock = "snow_block",
}

export type ToolType = "pickaxe" | "axe" | "shovel" | "sword";

export interface ItemDef {
  id: ItemId;
  name: string;
  /** Máximo por stack (1 para ferramentas, 64 para recursos/blocos). */
  stack: number;
  /** Cor do ícone (usada na UI enquanto não há sprites). */
  color: string;
  kind: "resource" | "tool" | "block" | "consumable";
  /** Se for bloco, qual bloco este item coloca. */
  placeBlock?: Block;
  /** Se for ferramenta. */
  tool?: {
    type: ToolType;
    /** Tier mínimo necessário para minerar certos blocos. */
    tier: number;
    /** Velocidade base de mineração (dureza / poder = segundos). */
    power: number;
  };
  /** Dano de ataque corpo-a-corpo (Fase 3; espadas e ferramentas). */
  damage?: number;
}

function hexColor(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  [ItemId.Log]: {
    id: ItemId.Log,
    name: "madeira",
    stack: 64,
    color: hexColor(0x8b5a2b),
    kind: "block",
    placeBlock: Block.Wood,
  },
  [ItemId.Plank]: {
    id: ItemId.Plank,
    name: "tábua",
    stack: 64,
    color: hexColor(0xbf9b6c),
    kind: "resource",
  },
  [ItemId.Stick]: {
    id: ItemId.Stick,
    name: "graveto",
    stack: 64,
    color: hexColor(0x9c7a4f),
    kind: "resource",
  },
  [ItemId.Dirt]: {
    id: ItemId.Dirt,
    name: "terra",
    stack: 64,
    color: hexColor(0x7a5a34),
    kind: "resource",
  },
  [ItemId.Sand]: {
    id: ItemId.Sand,
    name: "areia",
    stack: 64,
    color: hexColor(0xd9c98f),
    kind: "resource",
  },
  [ItemId.Stone]: {
    id: ItemId.Stone,
    name: "pedregulho",
    stack: 64,
    color: hexColor(0x8b8f96),
    kind: "resource",
  },
  [ItemId.Leaves]: {
    id: ItemId.Leaves,
    name: "folhas",
    stack: 64,
    color: hexColor(0x4f8f36),
    kind: "resource",
  },
  [ItemId.Snow]: {
    id: ItemId.Snow,
    name: "neve",
    stack: 64,
    color: hexColor(0xe8f0f2),
    kind: "resource",
  },
  [ItemId.Coal]: {
    id: ItemId.Coal,
    name: "carvão",
    stack: 64,
    color: hexColor(0x2b2b2b),
    kind: "resource",
  },
  [ItemId.IronOre]: {
    id: ItemId.IronOre,
    name: "minério de ferro",
    stack: 64,
    color: hexColor(0xb87333),
    kind: "resource",
  },
  [ItemId.GoldOre]: {
    id: ItemId.GoldOre,
    name: "minério de ouro",
    stack: 64,
    color: hexColor(0xffd700),
    kind: "resource",
  },
  [ItemId.Crystal]: {
    id: ItemId.Crystal,
    name: "cristal arcano",
    stack: 64,
    color: hexColor(0x9d7cff),
    kind: "resource",
  },

  [ItemId.SlimeGoo]: {
    id: ItemId.SlimeGoo,
    name: "gosma",
    stack: 64,
    color: hexColor(0x8fd44a),
    kind: "resource",
  },
  [ItemId.Bone]: {
    id: ItemId.Bone,
    name: "osso",
    stack: 64,
    color: hexColor(0xe8e4d0),
    kind: "resource",
  },

  [ItemId.PickaxeWood]: {
    id: ItemId.PickaxeWood,
    name: "picareta de madeira",
    stack: 1,
    color: hexColor(0xa67c52),
    kind: "tool",
    tool: { type: "pickaxe", tier: 1, power: 1.2 },
  },
  [ItemId.PickaxeStone]: {
    id: ItemId.PickaxeStone,
    name: "picareta de pedra",
    stack: 1,
    color: hexColor(0x808080),
    kind: "tool",
    tool: { type: "pickaxe", tier: 2, power: 2.5 },
  },
  [ItemId.PickaxeIron]: {
    id: ItemId.PickaxeIron,
    name: "picareta de ferro",
    stack: 1,
    color: hexColor(0xc0c0c0),
    kind: "tool",
    tool: { type: "pickaxe", tier: 3, power: 4.5 },
  },
  [ItemId.PickaxeGold]: {
    id: ItemId.PickaxeGold,
    name: "picareta de ouro",
    stack: 1,
    color: hexColor(0xffd700),
    kind: "tool",
    tool: { type: "pickaxe", tier: 4, power: 7.0 },
  },
  [ItemId.PickaxeArcane]: {
    id: ItemId.PickaxeArcane,
    name: "picareta arcano",
    stack: 1,
    color: hexColor(0xb76eff),
    kind: "tool",
    tool: { type: "pickaxe", tier: 5, power: 12.0 },
  },

  [ItemId.SwordWood]: {
    id: ItemId.SwordWood,
    name: "espada de madeira",
    stack: 1,
    color: hexColor(0xa67c52),
    kind: "tool",
    tool: { type: "sword", tier: 1, power: 0.8 },
    damage: 3,
  },
  [ItemId.SwordStone]: {
    id: ItemId.SwordStone,
    name: "espada de pedra",
    stack: 1,
    color: hexColor(0x808080),
    kind: "tool",
    tool: { type: "sword", tier: 2, power: 0.8 },
    damage: 5,
  },
  [ItemId.SwordIron]: {
    id: ItemId.SwordIron,
    name: "espada de ferro",
    stack: 1,
    color: hexColor(0xc0c0c0),
    kind: "tool",
    tool: { type: "sword", tier: 3, power: 0.8 },
    damage: 7,
  },
  [ItemId.SwordGold]: {
    id: ItemId.SwordGold,
    name: "espada de ouro",
    stack: 1,
    color: hexColor(0xffd700),
    kind: "tool",
    tool: { type: "sword", tier: 4, power: 0.8 },
    damage: 9,
  },
  [ItemId.SwordArcane]: {
    id: ItemId.SwordArcane,
    name: "espada arcana",
    stack: 1,
    color: hexColor(0xb76eff),
    kind: "tool",
    tool: { type: "sword", tier: 5, power: 0.8 },
    damage: 13,
  },

  [ItemId.GrassBlock]: {
    id: ItemId.GrassBlock,
    name: "bloco de grama",
    stack: 64,
    color: hexColor(0x6fb03a),
    kind: "block",
    placeBlock: Block.Grass,
  },
  [ItemId.DirtBlock]: {
    id: ItemId.DirtBlock,
    name: "bloco de terra",
    stack: 64,
    color: hexColor(0x7a5a34),
    kind: "block",
    placeBlock: Block.Dirt,
  },
  [ItemId.SandBlock]: {
    id: ItemId.SandBlock,
    name: "bloco de areia",
    stack: 64,
    color: hexColor(0xd9c98f),
    kind: "block",
    placeBlock: Block.Sand,
  },
  [ItemId.StoneBlock]: {
    id: ItemId.StoneBlock,
    name: "bloco de pedra",
    stack: 64,
    color: hexColor(0x8b8f96),
    kind: "block",
    placeBlock: Block.Stone,
  },
  [ItemId.WoodBlock]: {
    id: ItemId.WoodBlock,
    name: "bloco de madeira",
    stack: 64,
    color: hexColor(0x8b5a2b),
    kind: "block",
    placeBlock: Block.Wood,
  },
  [ItemId.LeavesBlock]: {
    id: ItemId.LeavesBlock,
    name: "bloco de folhas",
    stack: 64,
    color: hexColor(0x4f8f36),
    kind: "block",
    placeBlock: Block.Leaves,
  },
  [ItemId.SnowBlock]: {
    id: ItemId.SnowBlock,
    name: "bloco de neve",
    stack: 64,
    color: hexColor(0xe8f0f2),
    kind: "block",
    placeBlock: Block.Snow,
  },
};

/** Item que representa um bloco colocável (ou null se não houver). */
export function blockItem(block: Block): ItemId | null {
  switch (block) {
    case Block.Grass:
      return ItemId.GrassBlock;
    case Block.Dirt:
      return ItemId.DirtBlock;
    case Block.Sand:
      return ItemId.SandBlock;
    case Block.Stone:
      return ItemId.StoneBlock;
    case Block.Wood:
      return ItemId.WoodBlock;
    case Block.Leaves:
      return ItemId.LeavesBlock;
    case Block.Snow:
      return ItemId.SnowBlock;
    default:
      return null;
  }
}

/** Item obtido ao quebrar um bloco (drop principal). */
export function blockDrop(block: Block): ItemId | null {
  switch (block) {
    case Block.Grass:
      return ItemId.DirtBlock;
    case Block.Dirt:
      return ItemId.DirtBlock;
    case Block.Sand:
      return ItemId.SandBlock;
    case Block.Stone:
      return ItemId.Stone;
    case Block.Wood:
      return ItemId.Log;
    case Block.Leaves:
      return ItemId.Leaves;
    case Block.Snow:
      return ItemId.Snow;
    case Block.CoalOre:
      return ItemId.Coal;
    case Block.IronOre:
      return ItemId.IronOre;
    case Block.GoldOre:
      return ItemId.GoldOre;
    case Block.CrystalOre:
      return ItemId.Crystal;
    default:
      return null;
  }
}
