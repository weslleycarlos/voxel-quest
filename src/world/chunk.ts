import { Block } from "./blocks.ts";

export const CHUNK_X = 16;
export const CHUNK_Y = 64;
export const CHUNK_Z = 16;

const SIZE = CHUNK_X * CHUNK_Y * CHUNK_Z;

/**
 * Chunk voxel denso (doc §3 /world/chunk.ts). Fase 1: cada chunk conhece sua
 * coordenada de grade (cx, cz) no mundo e carrega a flag `modified` — só chunks
 * modificados pelo jogador vão para o save (doc §4.8); os demais são
 * regenerados pela seed.
 */
export class Chunk {
  readonly data: Uint8Array;
  /** true quando o jogador quebrou/colocou blocos — entra no autosave. */
  modified = false;

  constructor(
    public readonly cx: number,
    public readonly cz: number,
    data?: Uint8Array
  ) {
    this.data = data ?? new Uint8Array(SIZE);
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

/** Chave canônica de um chunk no mundo e nos saves. */
export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}
