import * as THREE from 'three';
import { Chunk, CHUNK_SIZE } from './chunk';
import { Mesher } from './mesher';
import { TerrainGenerator } from './terrainGen';

export class ChunkManager {
  private chunks: Map<string, Chunk> = new Map();
  private chunkMeshes: Map<string, THREE.Mesh> = new Map();
  private terrainGenerator: TerrainGenerator;
  private scene: THREE.Scene;
  private renderDistance: number = 4; // Render distance in chunks

  constructor(scene: THREE.Scene, seed: number) {
    this.scene = scene;
    this.terrainGenerator = new TerrainGenerator(seed);
  }

  /**
   * Get chunk key from coordinates
   */
  private getChunkKey(chunkX: number, chunkZ: number): string {
    return `${chunkX},${chunkZ}`;
  }

  /**
   * Get or create chunk at position
   */
  getChunk(chunkX: number, chunkZ: number): Chunk | undefined {
    const key = this.getChunkKey(chunkX, chunkZ);
    
    if (!this.chunks.has(key)) {
      const chunk = this.terrainGenerator.generateChunk(chunkX, chunkZ);
      this.chunks.set(key, chunk);
      this.updateChunkMesh(chunk);
    }
    
    return this.chunks.get(key);
  }

  /**
   * Update chunks around player position
   */
  updateChunksAroundPlayer(playerX: number, playerZ: number): void {
    const playerChunkX = Math.floor(playerX / CHUNK_SIZE);
    const playerChunkZ = Math.floor(playerZ / CHUNK_SIZE);

    // Load chunks within render distance
    for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
        const chunkX = playerChunkX + dx;
        const chunkZ = playerChunkZ + dz;
        
        // Check if within circular render distance
        if (dx * dx + dz * dz <= this.renderDistance * this.renderDistance) {
          this.getChunk(chunkX, chunkZ);
        }
      }
    }

    // Unload far chunks
    this.unloadFarChunks(playerChunkX, playerChunkZ);
  }

  /**
   * Remove chunks that are too far from player
   */
  private unloadFarChunks(playerChunkX: number, playerChunkZ: number): void {
    const keysToRemove: string[] = [];

    for (const [key, chunk] of this.chunks.entries()) {
      const dx = chunk.x - playerChunkX;
      const dz = chunk.z - playerChunkZ;
      
      if (dx * dx + dz * dz > (this.renderDistance + 2) * (this.renderDistance + 2)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      const chunk = this.chunks.get(key);
      if (chunk) {
        this.removeChunkMesh(chunk);
        this.chunks.delete(key);
      }
    }
  }

  /**
   * Update mesh for a chunk
   */
  private updateChunkMesh(chunk: Chunk): void {
    // Remove old mesh if exists
    this.removeChunkMesh(chunk);

    // Generate new mesh
    const geometry = Mesher.generateMesh(chunk, {});
    
    if (geometry) {
      const material = new THREE.MeshLambertMaterial({ 
        color: 0xffffff,
        side: THREE.DoubleSide,
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        chunk.x * CHUNK_SIZE,
        0,
        chunk.z * CHUNK_SIZE
      );
      
      this.scene.add(mesh);
      this.chunkMeshes.set(this.getChunkKey(chunk.x, chunk.z), mesh);
      chunk.mesh = mesh;
    }
  }

  /**
   * Remove chunk mesh from scene
   */
  private removeChunkMesh(chunk: Chunk): void {
    const key = this.getChunkKey(chunk.x, chunk.z);
    const mesh = this.chunkMeshes.get(key);
    
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.chunkMeshes.delete(key);
      chunk.mesh = null;
    }
  }

  /**
   * Set a block in the world
   */
  setBlock(worldX: number, worldY: number, worldZ: number, blockId: number): void {
    const chunkX = Math.floor(worldX / CHUNK_SIZE);
    const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
    
    const chunk = this.getChunk(chunkX, chunkZ);
    if (chunk) {
      chunk.setBlockWorld(worldX, worldY, worldZ, blockId);
      this.updateChunkMesh(chunk);
      
      // Update neighbor chunks if on border
      const localX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const localZ = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      
      if (localX === 0) {
        const neighbor = this.getChunk(chunkX - 1, chunkZ);
        if (neighbor) this.updateChunkMesh(neighbor);
      } else if (localX === CHUNK_SIZE - 1) {
        const neighbor = this.getChunk(chunkX + 1, chunkZ);
        if (neighbor) this.updateChunkMesh(neighbor);
      }
      
      if (localZ === 0) {
        const neighbor = this.getChunk(chunkX, chunkZ - 1);
        if (neighbor) this.updateChunkMesh(neighbor);
      } else if (localZ === CHUNK_SIZE - 1) {
        const neighbor = this.getChunk(chunkX, chunkZ + 1);
        if (neighbor) this.updateChunkMesh(neighbor);
      }
    }
  }

  /**
   * Get block at world position
   */
  getBlock(worldX: number, worldY: number, worldZ: number): number {
    const chunkX = Math.floor(worldX / CHUNK_SIZE);
    const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
    
    const chunk = this.chunks.get(this.getChunkKey(chunkX, chunkZ));
    if (chunk) {
      return chunk.getBlockWorld(worldX, worldY, worldZ);
    }
    
    return 0; // Air
  }

  /**
   * Get all loaded chunks
   */
  getAllChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Serialize modified chunks for saving
   */
  serializeModifiedChunks(): object[] {
    const serialized: object[] = [];
    
    for (const chunk of this.chunks.values()) {
      const data = chunk.serialize();
      if (data) {
        serialized.push(data);
      }
    }
    
    return serialized;
  }
}
