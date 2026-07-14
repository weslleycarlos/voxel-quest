import * as THREE from "three";
import { Chunk, CHUNK_X, CHUNK_Y, CHUNK_Z, chunkKey } from "./chunk.ts";
import { Block, isSolid, isFluid } from "./blocks.ts";
import { buildChunkGeometries } from "./mesher.ts";
import { TerrainGenerator } from "./terrainGen.ts";

/**
 * Carrega/descarrega chunks ao redor do jogador (doc §3 /world/chunkManager.ts).
 * - Raio de render configurável + fila ordenada por distância, com orçamento de
 *   geração por frame para não travar o game loop.
 * - Cada chunk vira 2 meshes: opaca e água (translúcida) — 1–2 draw calls/chunk.
 * - Rebuild só do chunk modificado e dos vizinhos de borda (doc §5).
 * - Chunks modificados ficam retidos em `modifiedData` mesmo após descarregar,
 *   para o autosave gravar apenas diffs (doc §4.8).
 */

export const RENDER_DISTANCE = 6; // chunks (doc §5: 6–8)
const UNLOAD_DISTANCE = RENDER_DISTANCE + 2;
const GEN_BUDGET_PER_FRAME = 2;

interface LoadedChunk {
  chunk: Chunk;
  opaqueMesh: THREE.Mesh | null;
  waterMesh: THREE.Mesh | null;
  dirty: boolean;
}

export class ChunkManager {
  private loaded = new Map<string, LoadedChunk>();
  /** Dados de chunks modificados (inclusive descarregados), p/ save + reload. */
  readonly modifiedData = new Map<string, Uint8Array>();

  constructor(
    private scene: THREE.Scene,
    private generator: TerrainGenerator,
    private opaqueMaterial: THREE.Material,
    private waterMaterial: THREE.Material,
    savedChunks?: Map<string, Uint8Array>
  ) {
    if (savedChunks) {
      for (const [key, data] of savedChunks) this.modifiedData.set(key, data);
    }
  }

  /** Atualiza o conjunto de chunks carregados em torno do jogador. */
  update(playerX: number, playerZ: number): void {
    const pcx = Math.floor(playerX / CHUNK_X);
    const pcz = Math.floor(playerZ / CHUNK_Z);

    // Descarrega os distantes.
    for (const [key, lc] of this.loaded) {
      const dx = lc.chunk.cx - pcx;
      const dz = lc.chunk.cz - pcz;
      if (dx * dx + dz * dz > UNLOAD_DISTANCE * UNLOAD_DISTANCE) {
        this.disposeMeshes(lc);
        this.loaded.delete(key);
      }
    }

    // Enfileira os que faltam, do mais próximo ao mais distante.
    const missing: { cx: number; cz: number; d2: number }[] = [];
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
      for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > RENDER_DISTANCE * RENDER_DISTANCE) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (!this.loaded.has(chunkKey(cx, cz))) missing.push({ cx, cz, d2 });
      }
    }
    missing.sort((a, b) => a.d2 - b.d2);

    let budget = GEN_BUDGET_PER_FRAME;
    for (const m of missing) {
      if (budget-- <= 0) break;
      this.loadChunk(m.cx, m.cz);
    }

    // Reconstrói meshes sujas (modificação ou vizinho recém-carregado).
    let rebuilds = GEN_BUDGET_PER_FRAME;
    for (const lc of this.loaded.values()) {
      if (!lc.dirty) continue;
      if (rebuilds-- <= 0) break;
      this.buildMeshes(lc);
    }
  }

  /** Carrega imediatamente todos os chunks num raio (usado no spawn). */
  loadAround(playerX: number, playerZ: number, radius: number): void {
    const pcx = Math.floor(playerX / CHUNK_X);
    const pcz = Math.floor(playerZ / CHUNK_Z);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dz * dz > radius * radius) continue;
        if (!this.loaded.has(chunkKey(pcx + dx, pcz + dz))) {
          this.loadChunk(pcx + dx, pcz + dz);
        }
      }
    }
    for (const lc of this.loaded.values()) {
      if (lc.dirty) this.buildMeshes(lc);
    }
  }

  private loadChunk(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    const saved = this.modifiedData.get(key);
    let chunk: Chunk;
    if (saved) {
      // Chunk modificado pelo jogador: restaura os dados salvos.
      chunk = new Chunk(cx, cz, saved);
      chunk.modified = true;
    } else {
      chunk = new Chunk(cx, cz);
      this.generator.generate(chunk);
    }
    const lc: LoadedChunk = { chunk, opaqueMesh: null, waterMesh: null, dirty: true };
    this.loaded.set(key, lc);

    // Vizinhos já carregados precisam refazer a borda (faces/AO entre chunks).
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = this.loaded.get(chunkKey(cx + nx, cz + nz));
      if (n) n.dirty = true;
    }
  }

  private buildMeshes(lc: LoadedChunk): void {
    this.disposeMeshes(lc);
    const ox = lc.chunk.cx * CHUNK_X;
    const oz = lc.chunk.cz * CHUNK_Z;
    const sample = (x: number, y: number, z: number) =>
      this.getBlock(ox + x, y, oz + z);

    const { opaque, water } = buildChunkGeometries(sample);

    if (opaque.getIndex()!.count > 0) {
      lc.opaqueMesh = new THREE.Mesh(opaque, this.opaqueMaterial);
      lc.opaqueMesh.position.set(ox, 0, oz);
      this.scene.add(lc.opaqueMesh);
    } else {
      opaque.dispose();
    }
    if (water.getIndex()!.count > 0) {
      lc.waterMesh = new THREE.Mesh(water, this.waterMaterial);
      lc.waterMesh.position.set(ox, 0, oz);
      this.scene.add(lc.waterMesh);
    } else {
      water.dispose();
    }
    lc.dirty = false;
  }

  private disposeMeshes(lc: LoadedChunk): void {
    for (const mesh of [lc.opaqueMesh, lc.waterMesh]) {
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    lc.opaqueMesh = null;
    lc.waterMesh = null;
  }

  // ---------- Acesso a blocos em coordenadas de mundo ----------

  getBlock(wx: number, y: number, wz: number): Block {
    if (y < 0 || y >= CHUNK_Y) return Block.Air;
    const cx = Math.floor(wx / CHUNK_X);
    const cz = Math.floor(wz / CHUNK_Z);
    const lc = this.loaded.get(chunkKey(cx, cz));
    if (!lc) return Block.Air;
    return lc.chunk.get(wx - cx * CHUNK_X, y, wz - cz * CHUNK_Z);
  }

  /**
   * Quebra/coloca um bloco. Marca o chunk como modificado (entra no autosave) e
   * suja apenas ele + vizinhos de borda para rebuild (doc §5).
   */
  setBlock(wx: number, y: number, wz: number, id: Block): boolean {
    if (y < 0 || y >= CHUNK_Y) return false;
    const cx = Math.floor(wx / CHUNK_X);
    const cz = Math.floor(wz / CHUNK_Z);
    const lc = this.loaded.get(chunkKey(cx, cz));
    if (!lc) return false;

    const lx = wx - cx * CHUNK_X;
    const lz = wz - cz * CHUNK_Z;
    lc.chunk.set(lx, y, lz, id);
    lc.chunk.modified = true;
    lc.dirty = true;
    this.modifiedData.set(chunkKey(cx, cz), lc.chunk.data);

    // Bordas: vizinho também precisa refazer faces/AO.
    const markDirty = (ncx: number, ncz: number) => {
      const n = this.loaded.get(chunkKey(ncx, ncz));
      if (n) n.dirty = true;
    };
    if (lx === 0) markDirty(cx - 1, cz);
    if (lx === CHUNK_X - 1) markDirty(cx + 1, cz);
    if (lz === 0) markDirty(cx, cz - 1);
    if (lz === CHUNK_Z - 1) markDirty(cx, cz + 1);
    return true;
  }

  /** Colisão: chunk não carregado conta como sólido (evita cair no void). */
  solidAt = (wx: number, y: number, wz: number): boolean => {
    if (y < 0) return false;
    if (y >= CHUNK_Y) return false;
    const cx = Math.floor(wx / CHUNK_X);
    const cz = Math.floor(wz / CHUNK_Z);
    const lc = this.loaded.get(chunkKey(cx, cz));
    if (!lc) return true;
    return isSolid(lc.chunk.get(wx - cx * CHUNK_X, y, wz - cz * CHUNK_Z));
  };

  fluidAt = (wx: number, y: number, wz: number): boolean => {
    return isFluid(this.getBlock(Math.floor(wx), Math.floor(y), Math.floor(wz)));
  };

  /** Primeiro Y livre acima do terreno (spawn/respawn). */
  surfaceY(wx: number, wz: number): number {
    const bx = Math.floor(wx);
    const bz = Math.floor(wz);
    for (let y = CHUNK_Y - 1; y >= 0; y--) {
      if (isSolid(this.getBlock(bx, y, bz))) return y + 1.05;
    }
    return this.generator.surfaceHeight(bx, bz) + 1.05;
  }

  /** Libera tudo (voltar ao menu). */
  dispose(): void {
    for (const lc of this.loaded.values()) this.disposeMeshes(lc);
    this.loaded.clear();
  }
}
