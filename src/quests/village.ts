/**
 * Geração da vila no spawn (doc §6 Fase 4).
 * Constrói estruturas simples de blocos (casas, caminho) em coordenadas
 * fixas próximas ao ponto de spawn, usando ChunkManager.setBlock.
 */

import * as THREE from "three";
import { ChunkManager } from "../world/chunkManager.ts";
import { Block } from "../world/blocks.ts";

const VILLAGE_CENTER = new THREE.Vector3(7, 0, 6);

/** Constrói uma pequena vila de 3 casas + caminho no spawn. */
export function buildVillage(world: ChunkManager): void {
  const cx = Math.floor(VILLAGE_CENTER.x);
  const cz = Math.floor(VILLAGE_CENTER.z);
  const groundY = Math.floor(world.surfaceY(cx + 0.5, cz + 0.5));

  // Aplaina o chão da vila (5x5 áreas para cada casa)
  for (let dx = -2; dx <= 12; dx++) {
    for (let dz = -2; dz <= 10; dz++) {
      const x = cx + dx;
      const z = cz + dz;
      const y = Math.floor(world.surfaceY(x + 0.5, z + 0.5));
      // Torna plano no nível médio
      const flatY = groundY;
      for (let fy = y; fy <= flatY + 1; fy++) {
        world.setBlock(x, fy, z, fy === flatY ? Block.Grass : Block.Air);
      }
      world.setBlock(x, flatY - 1, z, Block.Dirt);
    }
  }

  // Caminho de terra entre as casas
  for (let dx = 0; dx <= 10; dx++) {
    world.setBlock(cx + dx, groundY, cz + 4, Block.Dirt);
  }

  // Casa 1 (Madeira)
  buildHouse(world, cx + 1, groundY, cz + 1, Block.Wood, Block.Wood);
  // Casa 2 (Pedra)
  buildHouse(world, cx + 6, groundY, cz + 1, Block.Stone, Block.Stone);
  // Casa 3 (Madeira)
  buildHouse(world, cx + 1, groundY, cz + 6, Block.Wood, Block.Wood);

  // Tochas simples (blocos de ouro como placeholder luminoso — substituir se houver lanterna)
  world.setBlock(cx + 3, groundY + 2, cz + 3, Block.GoldOre);
  world.setBlock(cx + 8, groundY + 2, cz + 3, Block.GoldOre);
}

function buildHouse(
  world: ChunkManager,
  x0: number,
  y0: number,
  z0: number,
  wallBlock: Block,
  floorBlock: Block
): void {
  const w = 3;
  const h = 3;
  const d = 3;
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < d; z++) {
      world.setBlock(x0 + x, y0, z0 + z, floorBlock);
      for (let y = 1; y <= h; y++) {
        const isWall = x === 0 || x === w - 1 || z === 0 || z === d - 1;
        const isDoor = z === d - 1 && x === 1 && y <= 2;
        if (isDoor) {
          world.setBlock(x0 + x, y0 + y, z0 + z, Block.Air);
        } else if (isWall || y === h) {
          world.setBlock(x0 + x, y0 + y, z0 + z, wallBlock);
        } else {
          world.setBlock(x0 + x, y0 + y, z0 + z, Block.Air);
        }
      }
    }
  }
}
