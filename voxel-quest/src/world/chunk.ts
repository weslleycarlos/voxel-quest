import * as THREE from 'three';
import { BlockIds, isSolid } from './blocks';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;

/**
 * Chunk data structure - stores block IDs in a 3D array
 */
export class Chunk {
  public x: number;
  public z: number;
  public data: Uint8Array; // Flattened 3D array: y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x
  public mesh: THREE.Mesh | null = null;
  public modified: boolean = false;

  constructor(x: number, z: number) {
    this.x = x;
    this.z = z;
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  }

  getBlock(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return BlockIds.AIR;
    }
    const index = y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
    return this.data[index];
  }

  setBlock(x: number, y: number, z: number, blockId: number): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    const index = y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
    this.data[index] = blockId;
    this.modified = true;
  }

  /**
   * Get block in world coordinates
   */
  getBlockWorld(worldX: number, worldY: number, worldZ: number): number {
    const localX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return this.getBlock(localX, worldY, localZ);
  }

  /**
   * Set block in world coordinates
   */
  setBlockWorld(worldX: number, worldY: number, worldZ: number, blockId: number): void {
    const localX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    this.setBlock(localX, worldY, localZ, blockId);
  }

  /**
   * Check if chunk contains any non-air blocks
   */
  isEmpty(): boolean {
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] !== BlockIds.AIR) {
        return false;
      }
    }
    return true;
  }

  /**
   * Serialize chunk data for saving (only modified chunks)
   */
  serialize(): object | null {
    if (!this.modified) {
      return null;
    }
    return {
      x: this.x,
      z: this.z,
      data: Array.from(this.data),
    };
  }

  /**
   * Deserialize chunk data from save
   */
  static deserialize(data: any): Chunk {
    const chunk = new Chunk(data.x, data.z);
    chunk.data = new Uint8Array(data.data);
    chunk.modified = false;
    return chunk;
  }
}
