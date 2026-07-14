import { createNoise2D, createNoise3D } from 'simplex-noise';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './chunk';
import { BlockIds } from './blocks';

export interface Biome {
  id: string;
  name: string;
  surfaceBlock: number;
  subsurfaceBlock: number;
  minElevation: number;
  maxElevation: number;
  mobLevelRange: [number, number];
}

export const Biomes: Record<string, Biome> = {
  PLAINS: {
    id: 'plains',
    name: 'Plains',
    surfaceBlock: BlockIds.GRASS,
    subsurfaceBlock: BlockIds.DIRT,
    minElevation: 0,
    maxElevation: 0.4,
    mobLevelRange: [1, 5],
  },
  FOREST: {
    id: 'forest',
    name: 'Forest',
    surfaceBlock: BlockIds.GRASS,
    subsurfaceBlock: BlockIds.DIRT,
    minElevation: 0.4,
    maxElevation: 0.6,
    mobLevelRange: [2, 8],
  },
  MOUNTAIN: {
    id: 'mountain',
    name: 'Mountain',
    surfaceBlock: BlockIds.STONE,
    subsurfaceBlock: BlockIds.STONE,
    minElevation: 0.6,
    maxElevation: 1.0,
    mobLevelRange: [5, 15],
  },
  DESERT: {
    id: 'desert',
    name: 'Desert',
    surfaceBlock: BlockIds.SAND,
    subsurfaceBlock: BlockIds.SAND,
    minElevation: 0,
    maxElevation: 0.3,
    mobLevelRange: [1, 6],
  },
};

export class TerrainGenerator {
  private noise2D: ReturnType<typeof createNoise2D>;
  private noise3D: ReturnType<typeof createNoise3D>;
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.noise2D = createNoise2D(() => this.random());
    this.noise3D = createNoise3D(() => this.random());
  }

  private random(): number {
    // Simple seeded random using linear congruential generator
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Generate a chunk with terrain
   */
  generateChunk(chunkX: number, chunkZ: number): Chunk {
    const chunk = new Chunk(chunkX, chunkZ);

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;

        // Get biome and height for this position
        const biome = this.getBiome(worldX, worldZ);
        const height = this.getHeight(worldX, worldZ, biome);

        // Fill blocks from bottom to height
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let blockId = BlockIds.AIR;

          if (y === 0) {
            blockId = BlockIds.BEDROCK;
          } else if (y < height - 3) {
            // Deep underground - stone with ores
            blockId = this.generateUnderground(worldX, y, worldZ);
          } else if (y < height) {
            // Subsurface
            blockId = biome.subsurfaceBlock;
          } else if (y === height) {
            // Surface
            blockId = biome.surfaceBlock;
          }

          chunk.setBlock(x, y, z, blockId);
        }

        // Generate trees in forest biome
        if (biome.id === 'forest' && Math.random() < 0.05) {
          this.generateTree(chunk, x, height + 1, z);
        }
      }
    }

    return chunk;
  }

  /**
   * Get biome based on position
   */
  private getBiome(x: number, z: number): Biome {
    const temperature = this.noise2D(x * 0.01, z * 0.01);
    const humidity = this.noise2D(x * 0.01 + 1000, z * 0.01 + 1000);

    // Simple biome mapping based on noise values
    if (temperature > 0.5 && humidity < -0.3) {
      return Biomes.DESERT;
    } else if (temperature > 0.3) {
      return Biomes.FOREST;
    } else if (temperature < -0.3) {
      return Biomes.MOUNTAIN;
    }
    return Biomes.PLAINS;
  }

  /**
   * Get terrain height at position
   */
  private getHeight(x: number, z: number, biome: Biome): number {
    const baseHeight = 20;
    const heightScale = 30;
    
    const elevation = this.noise2D(x * 0.02, z * 0.02);
    const normalizedElevation = (elevation + 1) / 2; // 0 to 1
    
    // Scale height based on biome
    const biomeHeightRange = biome.maxElevation - biome.minElevation;
    const biomeOffset = biome.minElevation / biomeHeightRange;
    
    const height = baseHeight + (normalizedElevation * heightScale);
    return Math.floor(Math.max(1, Math.min(CHUNK_HEIGHT - 10, height)));
  }

  /**
   * Generate underground blocks with ores
   */
  private generateUnderground(x: number, y: number, z: number): number {
    const caveNoise = this.noise3D(x * 0.05, y * 0.05, z * 0.05);
    
    // Caves
    if (caveNoise > 0.6) {
      return BlockIds.AIR;
    }

    // Ore generation based on depth
    const depth = CHUNK_HEIGHT - y;
    const oreNoise = this.noise3D(x * 0.1, y * 0.1, z * 0.1);

    if (depth > 40 && oreNoise > 0.7) {
      return BlockIds.ARCANE_CRYSTAL;
    } else if (depth > 30 && oreNoise > 0.65) {
      return BlockIds.GOLD_ORE;
    } else if (depth > 20 && oreNoise > 0.6) {
      return BlockIds.IRON_ORE;
    } else if (depth > 10 && oreNoise > 0.55) {
      return BlockIds.COAL_ORE;
    }

    return BlockIds.STONE;
  }

  /**
   * Generate a simple tree
   */
  private generateTree(chunk: Chunk, x: number, y: number, z: number): void {
    const trunkHeight = 4 + Math.floor(Math.random() * 3);

    // Trunk
    for (let i = 0; i < trunkHeight; i++) {
      if (y + i < CHUNK_HEIGHT) {
        chunk.setBlock(x, y + i, z, BlockIds.WOOD);
      }
    }

    // Leaves
    const leafStart = y + trunkHeight - 2;
    for (let ly = leafStart; ly <= y + trunkHeight + 1; ly++) {
      for (let lx = x - 2; lx <= x + 2; lx++) {
        for (let lz = z - 2; lz <= z + 2; lz++) {
          if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && ly < CHUNK_HEIGHT) {
            // Don't replace trunk
            if (lx === x && lz === z && ly < y + trunkHeight) continue;
            
            // Simple sphere-ish shape
            const dist = Math.abs(lx - x) + Math.abs(ly - (y + trunkHeight)) + Math.abs(lz - z);
            if (dist <= 3 && chunk.getBlock(lx, ly, lz) === BlockIds.AIR) {
              chunk.setBlock(lx, ly, lz, BlockIds.LEAVES);
            }
          }
        }
      }
    }
  }
}
