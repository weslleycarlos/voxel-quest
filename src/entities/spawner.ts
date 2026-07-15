import * as THREE from "three";
import { Mob, MobContext } from "./mob.ts";
import { MOB_TYPES, MobDef } from "./mobTypes.ts";
import type { ChunkManager } from "../world/chunkManager.ts";

/**
 * Regras de spawn (doc §3 /entities/spawner.ts). Fase 3: tenta spawnar em um
 * anel ao redor do jogador respeitando dia/noite e profundidade; nível do mob
 * cresce com a distância da origem do mundo (áreas distantes = mais difíceis,
 * doc §1 loop principal). Também gerencia update/remoção/despawn dos mobs.
 */

const MAX_MOBS = 12;
const SPAWN_INTERVAL = 3; // s entre tentativas
const SPAWN_MIN_R = 14;
const SPAWN_MAX_R = 32;
const DESPAWN_DIST = 56;
/** Abaixo deste Y conta como caverna para regras de spawn. */
const UNDERGROUND_Y = 26;

export class Spawner {
  readonly mobs: Mob[] = [];
  private timer = 0;

  constructor(private scene: THREE.Scene, private world: ChunkManager) {}

  update(dt: number, ctx: MobContext, isNight: boolean): void {
    this.timer += dt;
    if (this.timer >= SPAWN_INTERVAL) {
      this.timer = 0;
      this.trySpawn(ctx.playerPos, isNight);
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      mob.update(dt, ctx);
      const dist = mob.pos.distanceTo(ctx.playerPos);
      if (mob.finished || dist > DESPAWN_DIST || mob.pos.y < -12) {
        this.remove(i);
      }
    }
  }

  private trySpawn(playerPos: THREE.Vector3, isNight: boolean): void {
    if (this.mobs.length >= MAX_MOBS) return;

    const angle = Math.random() * Math.PI * 2;
    const radius = SPAWN_MIN_R + Math.random() * (SPAWN_MAX_R - SPAWN_MIN_R);
    const x = playerPos.x + Math.sin(angle) * radius;
    const z = playerPos.z + Math.cos(angle) * radius;

    // Spawn em caverna quando o jogador está no subsolo; senão, na superfície.
    const underground = playerPos.y < UNDERGROUND_Y;
    const y = underground
      ? this.findCaveFloor(x, playerPos.y, z)
      : this.world.surfaceY(x, z);
    if (y === null) return;

    const candidates = MOB_TYPES.filter((d) =>
      underground ? d.spawn.underground : isNight ? d.spawn.night : d.spawn.day
    );
    if (candidates.length === 0) return;

    const def = weightedPick(candidates);
    // Nível cresce com a distância da origem (+ variação aleatória).
    const distOrigin = Math.hypot(x, z);
    const level = Math.min(
      10,
      1 + Math.floor(distOrigin / 180) + (Math.random() < 0.2 ? 1 : 0)
    );

    const mob = new Mob(def, level, new THREE.Vector3(x, y, z));
    this.mobs.push(mob);
    this.scene.add(mob.group);
  }

  /** Procura chão livre em caverna perto do Y do jogador. */
  private findCaveFloor(x: number, nearY: number, z: number): number | null {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    for (let dy = 0; dy < 10; dy++) {
      for (const y of [Math.floor(nearY) - dy, Math.floor(nearY) + dy]) {
        if (y < 1 || y > UNDERGROUND_Y + 6) continue;
        if (
          this.world.solidAt(bx, y - 1, bz) &&
          !this.world.solidAt(bx, y, bz) &&
          !this.world.solidAt(bx, y + 1, bz)
        ) {
          return y + 0.05;
        }
      }
    }
    return null;
  }

  /** Mob mais próximo atingido por um raio (ataque do jogador). */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): Mob | null {
    let best: Mob | null = null;
    let bestT = Infinity;
    for (const mob of this.mobs) {
      const t = mob.raycast(origin, dir, maxDist);
      if (t !== null && t < bestT) {
        bestT = t;
        best = mob;
      }
    }
    return best;
  }

  private remove(index: number): void {
    const mob = this.mobs[index];
    this.scene.remove(mob.group);
    mob.dispose();
    this.mobs.splice(index, 1);
  }

  dispose(): void {
    for (let i = this.mobs.length - 1; i >= 0; i--) this.remove(i);
  }
}

function weightedPick(defs: MobDef[]): MobDef {
  const total = defs.reduce((a, d) => a + d.spawn.weight, 0);
  let r = Math.random() * total;
  for (const d of defs) {
    r -= d.spawn.weight;
    if (r <= 0) return d;
  }
  return defs[defs.length - 1];
}
