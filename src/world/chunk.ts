import { Block } from "./blocks.ts";

export const CHUNK_X = 16;
export const CHUNK_Y = 64;
export const CHUNK_Z = 16;

const SIZE = CHUNK_X * CHUNK_Y * CHUNK_Z;

/**
 * Chunk voxel denso (doc §3 /world/chunk.ts). Fase 0: um único chunk gerado por
 * um heightmap de ruído de valor simples (a geração procedural completa por seed
 * e biomas chega na Fase 1). O objetivo aqui é ter algo com relevo para exercitar
 * o mesher, a colisão e a câmera.
 */
export class Chunk {
  readonly data: Uint8Array;

  constructor() {
    this.data = new Uint8Array(SIZE);
  }

  private static index(x: number, y: number, z: number): number {
    return y * CHUNK_X * CHUNK_Z + z * CHUNK_X + x;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < CHUNK_X && y >= 0 && y < CHUNK_Y && z >= 0 && z < CHUNK_Z;
  }

  get(x: number, y: number, z: number): Block {
    if (!this.inBounds(x, y, z)) return Block.Air;
    return this.data[Chunk.index(x, y, z)] as Block;
  }

  set(x: number, y: number, z: number, id: Block): void {
    if (!this.inBounds(x, y, z)) return;
    this.data[Chunk.index(x, y, z)] = id;
  }
}

/** Ruído de valor 2D determinístico (sem dependências), suave via interpolação. */
function hash2(x: number, z: number): number {
  let h = x * 374761393 + z * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = smooth(x - x0);
  const fz = smooth(z - z0);
  const n00 = hash2(x0, z0);
  const n10 = hash2(x0 + 1, z0);
  const n01 = hash2(x0, z0 + 1);
  const n11 = hash2(x0 + 1, z0 + 1);
  const nx0 = n00 + (n10 - n00) * fx;
  const nx1 = n01 + (n11 - n01) * fx;
  return nx0 + (nx1 - nx0) * fz;
}

const WATER_LEVEL = 26;

/** Gera o terreno do chunk único da Fase 0. */
export function generateChunk(chunk: Chunk): void {
  const base = 30;

  for (let z = 0; z < CHUNK_Z; z++) {
    for (let x = 0; x < CHUNK_X; x++) {
      // Duas oitavas de ruído para um relevo suave com algum detalhe.
      const n =
        valueNoise(x / 10, z / 10) * 0.7 + valueNoise(x / 4, z / 4) * 0.3;
      const height = Math.floor(base + (n - 0.5) * 12);

      for (let y = 0; y <= height; y++) {
        let block: Block;
        if (y === height) {
          block = height < WATER_LEVEL + 1 ? Block.Sand : Block.Grass;
        } else if (y > height - 4) {
          block = height < WATER_LEVEL + 1 ? Block.Sand : Block.Dirt;
        } else {
          block = Block.Stone;
        }
        chunk.set(x, y, z, block);
      }

      // Preenche depressões com água até o nível do mar.
      for (let y = height + 1; y <= WATER_LEVEL; y++) {
        chunk.set(x, y, z, Block.Water);
      }
    }
  }

  scatterTrees(chunk);
}

/** Algumas árvores simples (tronco + copa) para dar interesse visual. */
function scatterTrees(chunk: Chunk): void {
  const spots = [
    [4, 5],
    [11, 3],
    [8, 12],
    [13, 10],
    [2, 13],
  ];

  for (const [x, z] of spots) {
    // Encontra a superfície de grama.
    let surface = -1;
    for (let y = CHUNK_Y - 1; y >= 0; y--) {
      if (chunk.get(x, y, z) === Block.Grass) {
        surface = y;
        break;
      }
    }
    if (surface < 0) continue;

    const trunk = 4;
    for (let i = 1; i <= trunk; i++) chunk.set(x, surface + i, z, Block.Wood);

    const top = surface + trunk;
    for (let dy = 0; dy <= 2; dy++) {
      const r = dy === 2 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy < 2) continue;
          if (Math.abs(dx) === r && Math.abs(dz) === r && dy === 0) continue;
          chunk.set(x + dx, top + dy, z + dz, Block.Leaves);
        }
      }
    }
  }
}
