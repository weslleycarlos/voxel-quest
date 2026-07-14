import * as THREE from "three";
import { isSolid } from "./blocks.ts";
import type { ChunkManager } from "./chunkManager.ts";

/**
 * Raycast voxel por DDA (Amanatides & Woo) para mirar blocos — quebra e
 * colocação da Fase 1. Retorna o bloco sólido atingido e a célula anterior
 * (onde um novo bloco seria colocado).
 */

export interface RayHit {
  /** Bloco sólido atingido. */
  block: THREE.Vector3;
  /** Célula vazia imediatamente antes do impacto (para colocar). */
  previous: THREE.Vector3;
}

export function raycastVoxel(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance: number,
  world: ChunkManager
): RayHit | null {
  const dir = direction.clone().normalize();

  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = dir.x > 0 ? 1 : -1;
  const stepY = dir.y > 0 ? 1 : -1;
  const stepZ = dir.z > 0 ? 1 : -1;

  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

  const frac = (v: number) => v - Math.floor(v);
  let tMaxX =
    dir.x !== 0 ? (dir.x > 0 ? (1 - frac(origin.x)) : frac(origin.x)) * tDeltaX : Infinity;
  let tMaxY =
    dir.y !== 0 ? (dir.y > 0 ? (1 - frac(origin.y)) : frac(origin.y)) * tDeltaY : Infinity;
  let tMaxZ =
    dir.z !== 0 ? (dir.z > 0 ? (1 - frac(origin.z)) : frac(origin.z)) * tDeltaZ : Infinity;

  const prev = new THREE.Vector3(x, y, z);
  let t = 0;

  while (t <= maxDistance) {
    if (isSolid(world.getBlock(x, y, z))) {
      return { block: new THREE.Vector3(x, y, z), previous: prev.clone() };
    }
    prev.set(x, y, z);

    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
    }
  }
  return null;
}
