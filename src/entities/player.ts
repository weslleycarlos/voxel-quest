import * as THREE from "three";
import type { Input } from "../core/input.ts";

export type SolidAt = (bx: number, by: number, bz: number) => boolean;

const EPS = 1e-3;
const GRAVITY = 26; // m/s²
const JUMP_SPEED = 8.6;
const WALK_SPEED = 4.5;
const RUN_SPEED = 7.5;
const MOUSE_SENS = 0.0024;
const PITCH_LIMIT = Math.PI / 2 - 0.05;

/**
 * Jogador com colisão AABB voxel própria (doc §3.3: ~100 linhas, sem engine de
 * física) e gravidade. `pos` é o centro dos pés (x,z no centro; y na base).
 */
export class Player {
  pos = new THREE.Vector3(8, 40, 8);
  vel = new THREE.Vector3();
  yaw = 0; // rotação horizontal (olhar/mover)
  pitch = 0; // rotação vertical (só câmera)
  onGround = false;

  readonly half = 0.3; // meia-largura
  readonly height = 1.8;
  readonly eyeHeight = 1.62;

  update(dt: number, input: Input, solid: SolidAt): void {
    // --- Olhar ---
    this.yaw -= input.mouseDX * MOUSE_SENS;
    this.pitch -= input.mouseDY * MOUSE_SENS;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));

    // --- Direção de movimento relativa ao yaw ---
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const wish = new THREE.Vector3();
    if (input.isDown("KeyW")) wish.add(forward);
    if (input.isDown("KeyS")) wish.sub(forward);
    if (input.isDown("KeyD")) wish.add(right);
    if (input.isDown("KeyA")) wish.sub(right);

    const speed = input.isDown("ShiftLeft") || input.isDown("ShiftRight") ? RUN_SPEED : WALK_SPEED;
    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(speed);
    }
    this.vel.x = wish.x;
    this.vel.z = wish.z;

    // --- Gravidade e pulo ---
    this.vel.y -= GRAVITY * dt;
    if (this.onGround && input.isDown("Space")) {
      this.vel.y = JUMP_SPEED;
      this.onGround = false;
    }

    // --- Integração com colisão, eixo a eixo ---
    this.onGround = false;
    this.moveAxis(0, this.vel.x * dt, solid);
    this.moveAxis(1, this.vel.y * dt, solid);
    this.moveAxis(2, this.vel.z * dt, solid);
  }

  /** Move um eixo (0=x,1=y,2=z) e resolve colisão contra voxels sólidos. */
  private moveAxis(axis: number, amount: number, solid: SolidAt): void {
    if (amount === 0) return;
    const comp: ("x" | "y" | "z")[] = ["x", "y", "z"];
    this.pos[comp[axis]] += amount;

    const minX = this.pos.x - this.half;
    const maxX = this.pos.x + this.half;
    const minY = this.pos.y;
    const maxY = this.pos.y + this.height;
    const minZ = this.pos.z - this.half;
    const maxZ = this.pos.z + this.half;

    const x0 = Math.floor(minX + EPS);
    const x1 = Math.floor(maxX - EPS);
    const y0 = Math.floor(minY + EPS);
    const y1 = Math.floor(maxY - EPS);
    const z0 = Math.floor(minZ + EPS);
    const z1 = Math.floor(maxZ - EPS);

    for (let bx = x0; bx <= x1; bx++) {
      for (let by = y0; by <= y1; by++) {
        for (let bz = z0; bz <= z1; bz++) {
          if (!solid(bx, by, bz)) continue;

          if (axis === 0) {
            if (amount > 0) this.pos.x = bx - this.half - EPS;
            else this.pos.x = bx + 1 + this.half + EPS;
            this.vel.x = 0;
          } else if (axis === 1) {
            if (amount > 0) {
              this.pos.y = by - this.height - EPS;
            } else {
              this.pos.y = by + 1 + EPS;
              this.onGround = true;
            }
            this.vel.y = 0;
          } else {
            if (amount > 0) this.pos.z = bz - this.half - EPS;
            else this.pos.z = bz + 1 + this.half + EPS;
            this.vel.z = 0;
          }
          return; // resolvido este eixo
        }
      }
    }
  }

  eyePosition(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
  }
}
