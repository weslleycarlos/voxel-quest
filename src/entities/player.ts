import * as THREE from "three";
import type { Input } from "../core/input.ts";

export type SolidAt = (bx: number, by: number, bz: number) => boolean;
export type FluidAt = (x: number, y: number, z: number) => boolean;

const EPS = 1e-3;
const GRAVITY = 26; // m/s²
const JUMP_SPEED = 8.6;
const WALK_SPEED = 4.5;
const RUN_SPEED = 7.5;
const MOUSE_SENS = 0.0024;
const PITCH_LIMIT = Math.PI / 2 - 0.05;

// --- Física de água (Fase 1) ---
const WATER_GRAVITY = 5; // afunda devagar
const WATER_SINK_MAX = 2.2; // velocidade terminal de afundamento
const WATER_SWIM_UP = 4.2; // espaço = nadar para cima
const WATER_SPEED = 2.6; // movimento horizontal mais lento
const WATER_DRAG = 4; // amortecimento vertical ao entrar
const WATER_JUMP_OUT = 7.5; // impulso para sair na borda

/**
 * Jogador com colisão AABB voxel própria (doc §3.3) e gravidade. Fase 1: a água
 * não é mais sólida — dentro dela o jogador afunda devagar, nada para cima com
 * espaço e se move mais lento; na superfície, espaço dá impulso para sair.
 */
export class Player {
  pos = new THREE.Vector3(8, 40, 8);
  vel = new THREE.Vector3();
  yaw = 0; // rotação horizontal (olhar/mover)
  pitch = 0; // rotação vertical (só câmera)
  onGround = false;
  inWater = false;
  headInWater = false;

  readonly half = 0.3; // meia-largura
  readonly height = 1.8;
  readonly eyeHeight = 1.62;

  // --- Stats RPG (Fase 3): vida, XP, nível e atributos derivados ---
  level = 1;
  xp = 0;
  maxHp = 20;
  hp = 20;
  /** Dano base sem arma (cresce com força/nível). */
  baseDamage = 1;
  /** Segundos de invulnerabilidade restantes após levar dano. */
  hurtCooldown = 0;
  private regenTimer = 0;

  /** XP necessário para o próximo nível (curva suave). */
  get xpToNext(): number {
    return Math.floor(20 * Math.pow(this.level, 1.4));
  }

  /** Força: bônus de dano corpo-a-corpo. Vigor: HP máximo. */
  get strength(): number {
    return this.baseDamage + (this.level - 1);
  }

  /** Ganha XP; retorna quantos níveis subiu. */
  addXp(amount: number): number {
    this.xp += amount;
    let ups = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.maxHp += 4; // vigor
      this.hp = this.maxHp;
      ups++;
    }
    return ups;
  }

  /** Aplica dano com knockback; retorna true se morreu. */
  takeDamage(amount: number, knockDir?: THREE.Vector3): boolean {
    if (this.hurtCooldown > 0 || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtCooldown = 0.6;
    if (knockDir) {
      this.vel.x += knockDir.x * 7;
      this.vel.z += knockDir.z * 7;
      this.vel.y = Math.max(this.vel.y, 4.5);
    }
    return this.hp <= 0;
  }

  /** Regeneração lenta fora de combate + timers (chamar todo frame). */
  tickStats(dt: number): void {
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    if (this.hp > 0 && this.hp < this.maxHp) {
      this.regenTimer += dt;
      if (this.regenTimer >= 4) {
        this.regenTimer = 0;
        this.hp = Math.min(this.maxHp, this.hp + 1);
      }
    } else {
      this.regenTimer = 0;
    }
  }

  respawn(): void {
    this.hp = this.maxHp;
    this.hurtCooldown = 1.5;
    this.vel.set(0, 0, 0);
  }

  update(dt: number, input: Input, solid: SolidAt, fluid: FluidAt): void {
    // --- Olhar ---
    this.yaw -= input.mouseDX * MOUSE_SENS;
    this.pitch -= input.mouseDY * MOUSE_SENS;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));

    // --- Estado na água (corpo e cabeça) ---
    this.inWater =
      fluid(this.pos.x, this.pos.y + 0.4, this.pos.z) ||
      fluid(this.pos.x, this.pos.y + 1.0, this.pos.z);
    this.headInWater = fluid(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);

    // --- Direção de movimento relativa ao yaw ---
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const wish = new THREE.Vector3();
    if (input.isDown("KeyW")) wish.add(forward);
    if (input.isDown("KeyS")) wish.sub(forward);
    if (input.isDown("KeyD")) wish.add(right);
    if (input.isDown("KeyA")) wish.sub(right);

    const run = input.isDown("ShiftLeft") || input.isDown("ShiftRight");
    const speed = this.inWater ? WATER_SPEED : run ? RUN_SPEED : WALK_SPEED;
    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(speed);
    }
    this.vel.x = wish.x;
    this.vel.z = wish.z;

    // --- Vertical: gravidade/pulo em terra, empuxo/nado na água ---
    if (this.inWater) {
      this.vel.y -= WATER_GRAVITY * dt;
      // Arrasto vertical (suaviza a entrada na água em queda).
      this.vel.y -= this.vel.y * Math.min(1, WATER_DRAG * dt);
      if (this.vel.y < -WATER_SINK_MAX) this.vel.y = -WATER_SINK_MAX;

      if (input.isDown("Space")) {
        // Na superfície (cabeça fora), impulso maior para subir na borda.
        this.vel.y = this.headInWater ? WATER_SWIM_UP : WATER_JUMP_OUT;
      }
    } else {
      this.vel.y -= GRAVITY * dt;
      if (this.onGround && input.isDown("Space")) {
        this.vel.y = JUMP_SPEED;
        this.onGround = false;
      }
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

  /** AABB do jogador intersecta este voxel? (impede colocar bloco em si mesmo) */
  intersectsBlock(bx: number, by: number, bz: number): boolean {
    return (
      bx + 1 > this.pos.x - this.half &&
      bx < this.pos.x + this.half &&
      by + 1 > this.pos.y &&
      by < this.pos.y + this.height &&
      bz + 1 > this.pos.z - this.half &&
      bz < this.pos.z + this.half
    );
  }
}
