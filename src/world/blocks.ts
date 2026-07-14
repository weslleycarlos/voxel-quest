/**
 * Registro declarativo de blocos (doc §3, regra 2: dados de jogo em objetos,
 * nunca hardcoded na lógica). Na Fase 0 usamos apenas cor por face + textura de
 * detalhe compartilhada; textura/atlas pixel-art evolui nas fases seguintes.
 */

export const enum Block {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
  Wood = 5,
  Leaves = 6,
  Water = 7,
}

export type Face = "top" | "bottom" | "side";

export interface BlockDef {
  id: Block;
  name: string;
  solid: boolean;
  /** Cor base RGB (0–1) por face, multiplicada por AO e textura de detalhe. */
  color: { top: [number, number, number]; bottom: [number, number, number]; side: [number, number, number] };
}

function rgb(hex: number): [number, number, number] {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

function uniform(hex: number) {
  const c = rgb(hex);
  return { top: c, bottom: c, side: c };
}

export const BLOCKS: Record<Block, BlockDef> = {
  [Block.Air]: {
    id: Block.Air,
    name: "ar",
    solid: false,
    color: uniform(0x000000),
  },
  [Block.Grass]: {
    id: Block.Grass,
    name: "grama",
    solid: true,
    color: { top: rgb(0x6fb03a), side: rgb(0x7a5a34), bottom: rgb(0x6b4a2a) },
  },
  [Block.Dirt]: {
    id: Block.Dirt,
    name: "terra",
    solid: true,
    color: uniform(0x7a5a34),
  },
  [Block.Stone]: {
    id: Block.Stone,
    name: "pedra",
    solid: true,
    color: uniform(0x8b8f96),
  },
  [Block.Sand]: {
    id: Block.Sand,
    name: "areia",
    solid: true,
    color: uniform(0xd9c98f),
  },
  [Block.Wood]: {
    id: Block.Wood,
    name: "madeira",
    solid: true,
    color: { top: rgb(0xb5895a), bottom: rgb(0xb5895a), side: rgb(0x6f4f2f) },
  },
  [Block.Leaves]: {
    id: Block.Leaves,
    name: "folhas",
    solid: true,
    color: uniform(0x4f8f36),
  },
  [Block.Water]: {
    id: Block.Water,
    name: "água",
    solid: true,
    color: uniform(0x3b6ea5),
  },
};

export function isSolid(id: Block): boolean {
  return BLOCKS[id].solid;
}

export function faceColor(id: Block, face: Face): [number, number, number] {
  return BLOCKS[id].color[face];
}
