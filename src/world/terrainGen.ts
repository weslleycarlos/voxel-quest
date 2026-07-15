import { createNoise2D, createNoise3D, type NoiseFunction2D, type NoiseFunction3D } from "simplex-noise";
import { Block } from "./blocks.ts";
import { Chunk, CHUNK_X, CHUNK_Y, CHUNK_Z } from "./chunk.ts";

/**
 * Geração procedural por seed (doc §4.1): simplex 2D para altura, simplex 2D de
 * baixa frequência para biomas (temperatura/umidade) e simplex 3D para cavernas.
 * A mesma seed sempre produz o mesmo mundo — chunks intocados não são salvos.
 */

export const WATER_LEVEL = 26;

export type Biome = "planicie" | "floresta" | "deserto" | "montanha";

/** Hash FNV-1a de string → uint32, para derivar PRNGs da seed textual. */
function hashSeed(seed: string, salt: number): number {
  let h = 0x811c9dc5 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG mulberry32 — determinístico e barato, alimenta o simplex-noise. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash 2D determinístico por coluna (usado para espalhar árvores). */
function hash2(x: number, z: number, salt: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export class TerrainGenerator {
  private height: NoiseFunction2D;
  private detail: NoiseFunction2D;
  private temperature: NoiseFunction2D;
  private moisture: NoiseFunction2D;
  private cave: NoiseFunction3D;
  private treeSalt: number;

  constructor(public readonly seed: string) {
    this.height = createNoise2D(mulberry32(hashSeed(seed, 1)));
    this.detail = createNoise2D(mulberry32(hashSeed(seed, 2)));
    this.temperature = createNoise2D(mulberry32(hashSeed(seed, 3)));
    this.moisture = createNoise2D(mulberry32(hashSeed(seed, 4)));
    this.cave = createNoise3D(mulberry32(hashSeed(seed, 5)));
    this.treeSalt = hashSeed(seed, 6);
  }

  biomeAt(wx: number, wz: number): Biome {
    const t = this.temperature(wx / 220, wz / 220);
    const m = this.moisture(wx / 180, wz / 180);
    if (t > 0.45 && m < 0.05) return "deserto";
    if (this.mountainFactor(wx, wz) > 0.55) return "montanha";
    if (m > 0.15) return "floresta";
    return "planicie";
  }

  private mountainFactor(wx: number, wz: number): number {
    // Reaproveita o noise de altura em frequência mais baixa como "continentes".
    return (this.height(wx / 340, wz / 340) + 1) / 2;
  }

  surfaceHeight(wx: number, wz: number): number {
    const base = 28;
    const rolling =
      this.height(wx / 90, wz / 90) * 7 + this.detail(wx / 28, wz / 28) * 3;
    const mf = this.mountainFactor(wx, wz);
    // Montanhas: amplifica o relevo onde o fator continental é alto.
    const mountains = mf > 0.5 ? Math.pow((mf - 0.5) * 2, 1.6) * 26 : 0;
    const h = Math.floor(base + rolling + mountains);
    return Math.max(2, Math.min(CHUNK_Y - 6, h));
  }

  /** Cavernas: simplex 3D "queijo suíço", só abaixo da superfície. */
  private isCave(wx: number, y: number, wz: number, surface: number): boolean {
    if (y <= 1 || y > surface - 3) return false;
    const n = this.cave(wx / 24, y / 16, wz / 24);
    // Afunila perto do topo para cavernas não perfurarem a superfície.
    const depthBias = Math.min(1, (surface - 3 - y) / 8);
    return n > 0.62 - 0.12 * depthBias;
  }

  generate(chunk: Chunk): void {
    const ox = chunk.cx * CHUNK_X;
    const oz = chunk.cz * CHUNK_Z;

    for (let z = 0; z < CHUNK_Z; z++) {
      for (let x = 0; x < CHUNK_X; x++) {
        const wx = ox + x;
        const wz = oz + z;
        const surface = this.surfaceHeight(wx, wz);
        const biome = this.biomeAt(wx, wz);

        for (let y = 0; y <= surface; y++) {
          if (y === 0) {
            chunk.set(x, y, z, Block.Bedrock);
            continue;
          }
          if (this.isCave(wx, y, wz, surface)) continue; // ar (caverna)

          let block: Block;
          if (y === surface) {
            block = this.surfaceBlock(biome, surface);
          } else if (y > surface - 4) {
            block = this.subSurfaceBlock(biome, surface);
          } else {
            block = this.oreAt(wx, y, wz, surface);
          }
          chunk.set(x, y, z, block);
        }

        // Preenche depressões com água até o nível do mar.
        for (let y = surface + 1; y <= WATER_LEVEL; y++) {
          chunk.set(x, y, z, Block.Water);
        }
      }
    }

    this.scatterTrees(chunk);
  }

  private surfaceBlock(biome: Biome, surface: number): Block {
    if (surface < WATER_LEVEL + 2) return Block.Sand;
    switch (biome) {
      case "deserto":
        return Block.Sand;
      case "montanha":
        return surface > 48 ? Block.Snow : surface > 40 ? Block.Stone : Block.Grass;
      default:
        return Block.Grass;
    }
  }

  /** Minérios por profundidade + distância (doc §4.1, §4.2). */
  private oreAt(wx: number, y: number, wz: number, surface: number): Block {
    const depth = surface - y;
    const dist = Math.sqrt(wx * wx + wz * wz);
    const h = hash2(wx * 31 + y, wz, this.treeSalt ^ 0x77);

    // Cristal arcano: profundo e longe do spawn.
    if (depth >= 28 && dist > 180) {
      if (h < 0.015) return Block.CrystalOre;
    }
    // Ouro: profundo/médio.
    if (depth >= 18) {
      if (h < 0.02 + Math.min(0.02, dist / 12000)) return Block.GoldOre;
    }
    // Ferro.
    if (depth >= 8) {
      if (h < 0.035 + Math.min(0.02, dist / 8000)) return Block.IronOre;
    }
    // Carvão raso.
    if (depth >= 3) {
      if (h < 0.05) return Block.CoalOre;
    }
    return Block.Stone;
  }

  private subSurfaceBlock(biome: Biome, surface: number): Block {
    if (surface < WATER_LEVEL + 2 || biome === "deserto") return Block.Sand;
    if (biome === "montanha" && surface > 40) return Block.Stone;
    return Block.Dirt;
  }

  /**
   * Árvores determinísticas por coluna. A copa só usa colunas 2..13 para não
   * vazar para o chunk vizinho (mantém a geração de cada chunk independente).
   */
  private scatterTrees(chunk: Chunk): void {
    const ox = chunk.cx * CHUNK_X;
    const oz = chunk.cz * CHUNK_Z;

    for (let z = 2; z < CHUNK_Z - 2; z++) {
      for (let x = 2; x < CHUNK_X - 2; x++) {
        const wx = ox + x;
        const wz = oz + z;
        const biome = this.biomeAt(wx, wz);
        const density =
          biome === "floresta" ? 0.028 : biome === "planicie" ? 0.006 : 0;
        if (density === 0) continue;
        if (hash2(wx, wz, this.treeSalt) >= density) continue;

        // Superfície precisa ser grama (evita árvore na água/pedra/caverna).
        let surface = -1;
        for (let y = CHUNK_Y - 8; y >= 1; y--) {
          const b = chunk.get(x, y, z);
          if (b !== Block.Air) {
            if (b === Block.Grass) surface = y;
            break;
          }
        }
        if (surface < 0) continue;

        const trunk = 3 + Math.floor(hash2(wx, wz, this.treeSalt ^ 0x55) * 3);
        for (let i = 1; i <= trunk; i++) chunk.set(x, surface + i, z, Block.Wood);

        const top = surface + trunk;
        for (let dy = 0; dy <= 2; dy++) {
          const r = dy === 2 ? 1 : 2;
          for (let dx = -r; dx <= r; dx++) {
            for (let dz = -r; dz <= r; dz++) {
              if (dx === 0 && dz === 0 && dy < 2) continue;
              if (Math.abs(dx) === r && Math.abs(dz) === r && dy === 0) continue;
              if (chunk.get(x + dx, top + dy, z + dz) === Block.Air) {
                chunk.set(x + dx, top + dy, z + dz, Block.Leaves);
              }
            }
          }
        }
      }
    }
  }
}
