// Block definitions according to doc-roadmap

export interface BlockData {
  id: number;
  name: string;
  textureIndex: number; // Index in texture atlas
  hardness: number;
  minableWithTier: number; // Minimum tool tier required
  drops: ItemDrop[];
}

export interface ItemDrop {
  itemId: string;
  quantity: number;
  chance: number; // 0-1
}

// Block IDs
export const BlockIds = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
  COAL_ORE: 7,
  IRON_ORE: 8,
  GOLD_ORE: 9,
  ARCANE_CRYSTAL: 10,
  BEDROCK: 11,
} as const;

// Block registry - declarative data as recommended in doc
export const Blocks: Record<number, BlockData> = {
  [BlockIds.AIR]: {
    id: 0,
    name: 'Air',
    textureIndex: -1,
    hardness: 0,
    minableWithTier: 0,
    drops: [],
  },
  [BlockIds.GRASS]: {
    id: 1,
    name: 'Grass',
    textureIndex: 0,
    hardness: 1.0,
    minableWithTier: 0,
    drops: [{ itemId: 'dirt', quantity: 1, chance: 1.0 }],
  },
  [BlockIds.DIRT]: {
    id: 2,
    name: 'Dirt',
    textureIndex: 1,
    hardness: 0.8,
    minableWithTier: 0,
    drops: [{ itemId: 'dirt', quantity: 1, chance: 1.0 }],
  },
  [BlockIds.STONE]: {
    id: 3,
    name: 'Stone',
    textureIndex: 2,
    hardness: 1.5,
    minableWithTier: 1, // Requires pickaxe
    drops: [{ itemId: 'cobblestone', quantity: 1, chance: 1.0 }],
  },
  [BlockIds.WOOD]: {
    id: 4,
    name: 'Wood',
    textureIndex: 3,
    hardness: 1.2,
    minableWithTier: 0,
    drops: [{ itemId: 'wood', quantity: 1, chance: 1.0 }],
  },
  [BlockIds.LEAVES]: {
    id: 5,
    name: 'Leaves',
    textureIndex: 4,
    hardness: 0.3,
    minableWithTier: 0,
    drops: [{ itemId: 'stick', quantity: 1, chance: 0.2 }],
  },
  [BlockIds.SAND]: {
    id: 6,
    name: 'Sand',
    textureIndex: 5,
    hardness: 0.6,
    minableWithTier: 0,
    drops: [{ itemId: 'sand', quantity: 1, chance: 1.0 }],
  },
  [BlockIds.COAL_ORE]: {
    id: 7,
    name: 'Coal Ore',
    textureIndex: 6,
    hardness: 2.0,
    minableWithTier: 1,
    drops: [{ itemId: 'coal', quantity: 1, chance: 1.0 }],
  },
  [BlockIds.IRON_ORE]: {
    id: 8,
    name: 'Iron Ore',
    textureIndex: 7,
    hardness: 3.0,
    minableWithTier: 2, // Requires iron pickaxe or better
    drops: [{ itemId: 'iron_ore', quantity: 1, chance: 1.0 }],
  },
  [BlockIds.GOLD_ORE]: {
    id: 9,
    name: 'Gold Ore',
    textureIndex: 8,
    hardness: 4.0,
    minableWithTier: 3,
    drops: [{ itemId: 'gold_ore', quantity: 1, chance: 1.0 }],
  },
  [BlockIds.ARCANE_CRYSTAL]: {
    id: 10,
    name: 'Arcane Crystal',
    textureIndex: 9,
    hardness: 6.0,
    minableWithTier: 4,
    drops: [
      { itemId: 'arcane_crystal', quantity: 1, chance: 1.0 },
      { itemId: 'arcane_fragment', quantity: 1, chance: 0.1 }, // Rare drop
    ],
  },
  [BlockIds.BEDROCK]: {
    id: 11,
    name: 'Bedrock',
    textureIndex: 10,
    hardness: 9999,
    minableWithTier: 999,
    drops: [],
  },
};

export function getBlock(id: number): BlockData {
  return Blocks[id] || Blocks[BlockIds.AIR];
}

export function isSolid(blockId: number): boolean {
  return blockId !== BlockIds.AIR;
}
