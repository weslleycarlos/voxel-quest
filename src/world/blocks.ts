/**
 * Registro declarativo de blocos (doc §3, regra 2: dados de jogo em objetos,
 * nunca hardcoded na lógica). Fase 1: água agora é FLUIDO (não sólida — o
 * jogador nada nela), e blocos ganham a flag `placeable` para o modo construção.
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
  Snow = 8,
  Bedrock = 9,
}

export type Face = "top" | "bottom" | "side";

export interface BlockDef {
  id: Block;
  name: string;
  /** Colide com o jogador e oclui faces vizinhas. */
  solid: boolean;
  /** Fluido: o jogador atravessa e nada (física de água). */
  fluid: boolean;
  /** Pode ser colocado pelo jogador (hotbar da Fase 1). */
  placeable: boolean;
  /** Pode ser quebrado pelo jogador. */
  breakable: boolean;
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
    fluid: false,
    placeable: false,
    breakable: false,
    color: uniform(0x000000),
  },
  [Block.Grass]: {
    id: Block.Grass,
    name: "grama",
    solid: true,
    fluid: false,
    placeable: true,
    breakable: true,
    color: { top: rgb(0x6fb03a), side: rgb(0x7a5a34), bottom: rgb(0x6b4a2a) },
  },
  [Block.Dirt]: {
    id: Block.Dirt,
    name: "terra",
    solid: true,
    fluid: false,
    placeable: true,
    breakable: true,
    color: uniform(0x7a5a34),
  },
  [Block.Stone]: {
    id: Block.Stone,
    name: "pedra",
    solid: true,
    fluid: false,
    placeable: true,
    breakable: true,
    color: uniform(0x8b8f96),
  },
  [Block.Sand]: {
    id: Block.Sand,
    name: "areia",
    solid: true,
    fluid: false,
    placeable: true,
    breakable: true,
    color: uniform(0xd9c98f),
  },
  [Block.Wood]: {
    id: Block.Wood,
    name: "madeira",
    solid: true,
    fluid: false,
    placeable: true,
    breakable: true,
    color: { top: rgb(0xb5895a), bottom: rgb(0xb5895a), side: rgb(0x6f4f2f) },
  },
  [Block.Leaves]: {
    id: Block.Leaves,
    name: "folhas",
    solid: true,
    fluid: false,
    placeable: true,
    breakable: true,
    color: uniform(0x4f8f36),
  },
  [Block.Water]: {
    id: Block.Water,
    name: "água",
    solid: false,
    fluid: true,
    placeable: false,
    breakable: false,
    color: uniform(0x3b6ea5),
  },
  [Block.Snow]: {
    id: Block.Snow,
    name: "neve",
    solid: true,
    fluid: false,
    placeable: true,
    breakable: true,
    color: { top: rgb(0xe8f0f2), side: rgb(0xc9d6da), bottom: rgb(0x8b8f96) },
  },
  [Block.Bedrock]: {
    id: Block.Bedrock,
    name: "rocha-mãe",
    solid: true,
    fluid: false,
    placeable: false,
    breakable: false,
    color: uniform(0x3a3d42),
  },
};

/** Blocos disponíveis na hotbar de construção da Fase 1 (teclas 1–7). */
export const PLACEABLE_BLOCKS: Block[] = [
  Block.Grass,
  Block.Dirt,
  Block.Stone,
  Block.Sand,
  Block.Wood,
  Block.Leaves,
  Block.Snow,
];

export function isSolid(id: Block): boolean {
  return BLOCKS[id].solid;
}

export function isFluid(id: Block): boolean {
  return BLOCKS[id].fluid;
}

export function faceColor(id: Block, face: Face): [number, number, number] {
  return BLOCKS[id].color[face];
}
