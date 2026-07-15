import * as THREE from "three";
import type { SolidAt } from "./player.ts";
import { MobDef, scaledDamage, scaledHp } from "./mobTypes.ts";

/**
 * Classe base de inimigo (doc §3 /entities/mob.ts). Fase 3: máquina de estados
 * (idle → wander → chase → attack; hurt/dead como transições), física AABB
 * voxel igual à do jogador, knockback e barra de vida flutuante.
 */

export type MobState = "idle" | "wander" | "chase" | "attack" | "dead";

const EPS = 1e-3;
const GRAVITY = 26;

export interface MobContext {
  playerPos: THREE.Vector3;
  playerAlive: boolean;
  solid: SolidAt;
  /** Mob acerta o jogador: aplicar dano/knockback do lado de fora. */
  attackPlayer(mob: Mob, damage: number): void;
}

let nextId = 1;

export class Mob {
  readonly id = nextId++;
  readonly group = new THREE.Group();
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  state: MobState = "idle";
  hp: number;
  readonly maxHp: number;
  readonly damage: number;
  onGround = false;

  /** Tempo restante para poder atacar de novo. */
  private attackTimer = 0;
  /** Timer do estado atual (troca idle↔wander, duração do hit flash etc.). */
  private stateTimer = 0;
  private wanderDir = new THREE.Vector3();
  private hitFlash = 0;
  /** Animação de morte: 1 → 0 (escala). */
  private deathScale = 1;
  private walkPhase = 0;

  private legs: THREE.Object3D[] = [];
  private materials: THREE.MeshLambertMaterial[] = [];
  private hpBar: THREE.Sprite;
  private hpBarCanvas: HTMLCanvasElement;
  private hpBarTexture: THREE.CanvasTexture;

  constructor(readonly def: MobDef, readonly level: number, spawnPos: THREE.Vector3) {
    this.pos.copy(spawnPos);
    this.maxHp = scaledHp(def, level);
    this.hp = this.maxHp;
    this.damage = scaledDamage(def, level);

    for (const part of def.parts) {
      const mat = new THREE.MeshLambertMaterial({ color: part.color });
      this.materials.push(mat);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...part.size), mat);
      if (part.leg) {
        // Pivô no topo da perna para balançar ao andar.
        const pivot = new THREE.Group();
        pivot.position.set(part.pos[0], part.pos[1] + part.size[1] / 2, part.pos[2]);
        mesh.position.y = -part.size[1] / 2;
        pivot.add(mesh);
        this.group.add(pivot);
        this.legs.push(pivot);
      } else {
        mesh.position.set(...part.pos);
        this.group.add(mesh);
      }
    }

    // Barra de vida + nome/nível (sprite sempre de frente para a câmera).
    this.hpBarCanvas = document.createElement("canvas");
    this.hpBarCanvas.width = 128;
    this.hpBarCanvas.height = 32;
    this.hpBarTexture = new THREE.CanvasTexture(this.hpBarCanvas);
    this.hpBar = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.hpBarTexture, depthTest: false, transparent: true })
    );
    this.hpBar.scale.set(1.3, 0.33, 1);
    this.hpBar.position.y = def.height + 0.45;
    this.group.add(this.hpBar);
    this.redrawHpBar();
  }

  get dead(): boolean {
    return this.state === "dead";
  }

  /** Morte concluída (animação terminou): remover da cena. */
  get finished(): boolean {
    return this.state === "dead" && this.deathScale <= 0.02;
  }

  /** Aplica dano com knockback vindo de `from`. Retorna true se matou. */
  hurt(amount: number, from: THREE.Vector3): boolean {
    if (this.dead) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlash = 0.18;
    const dir = this.pos.clone().sub(from).setY(0).normalize();
    this.vel.x += dir.x * 6;
    this.vel.z += dir.z * 6;
    this.vel.y = Math.max(this.vel.y, 4);
    this.redrawHpBar();
    if (this.hp <= 0) {
      this.state = "dead";
      this.hpBar.visible = false;
      return true;
    }
    // Levar dano acorda o mob.
    if (this.def.hostile) this.state = "chase";
    return false;
  }

  update(dt: number, ctx: MobContext): void {
    if (this.state === "dead") {
      this.deathScale = Math.max(0, this.deathScale - dt * 4);
      this.group.scale.setScalar(Math.max(0.02, this.deathScale));
      this.syncVisual(dt);
      return;
    }

    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.stateTimer -= dt;
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      const flash = this.hitFlash > 0;
      for (const m of this.materials) m.emissive.setHex(flash ? 0x881111 : 0x000000);
    }

    const toPlayer = ctx.playerPos.clone().sub(this.pos);
    const distXZ = Math.hypot(toPlayer.x, toPlayer.z);

    // --- Transições da FSM ---
    if (this.def.hostile && ctx.playerAlive && distXZ < this.def.aggroRange) {
      this.state = distXZ <= this.def.attackRange ? "attack" : "chase";
    } else if (this.state === "chase" || this.state === "attack") {
      this.state = "idle";
      this.stateTimer = 1 + Math.random() * 2;
    } else if (this.stateTimer <= 0) {
      if (this.state === "idle") {
        this.state = "wander";
        this.stateTimer = 1.5 + Math.random() * 2.5;
        const a = Math.random() * Math.PI * 2;
        this.wanderDir.set(Math.sin(a), 0, Math.cos(a));
      } else {
        this.state = "idle";
        this.stateTimer = 1 + Math.random() * 3;
      }
    }

    // --- Comportamento por estado ---
    let wishX = 0;
    let wishZ = 0;
    if (this.state === "wander") {
      wishX = this.wanderDir.x * this.def.speed * 0.5;
      wishZ = this.wanderDir.z * this.def.speed * 0.5;
    } else if (this.state === "chase") {
      const n = 1 / Math.max(distXZ, 0.001);
      wishX = toPlayer.x * n * this.def.speed;
      wishZ = toPlayer.z * n * this.def.speed;
    } else if (this.state === "attack" && this.attackTimer <= 0) {
      this.attackTimer = this.def.attackCooldown;
      ctx.attackPlayer(this, this.damage);
    }

    // Slime anda por pulinhos: só se move no ar.
    if (this.def.jumpy) {
      if (this.onGround && (wishX !== 0 || wishZ !== 0)) {
        this.vel.y = 7;
        this.onGround = false;
      }
      if (this.onGround) {
        wishX = 0;
        wishZ = 0;
      }
    } else if (this.onGround && (wishX !== 0 || wishZ !== 0)) {
      // Pulo automático de 1 bloco quando esbarra em parede.
      const aheadX = Math.floor(this.pos.x + Math.sign(wishX) * (this.def.half + 0.15));
      const aheadZ = Math.floor(this.pos.z + Math.sign(wishZ) * (this.def.half + 0.15));
      const feetY = Math.floor(this.pos.y + 0.1);
      if (
        ctx.solid(aheadX, feetY, Math.floor(this.pos.z)) ||
        ctx.solid(Math.floor(this.pos.x), feetY, aheadZ)
      ) {
        this.vel.y = 8.2;
        this.onGround = false;
      }
    }

    // Acelera horizontal suavemente (knockback decai naturalmente).
    const accel = Math.min(1, 8 * dt);
    this.vel.x += (wishX - this.vel.x) * accel;
    this.vel.z += (wishZ - this.vel.z) * accel;
    this.vel.y -= GRAVITY * dt;

    // Olha para onde anda (ou para o jogador em combate).
    if (this.state === "chase" || this.state === "attack") {
      this.yaw = Math.atan2(toPlayer.x, toPlayer.z);
    } else if (wishX !== 0 || wishZ !== 0) {
      this.yaw = Math.atan2(wishX, wishZ);
    }

    // --- Integração com colisão voxel, eixo a eixo ---
    this.onGround = false;
    this.moveAxis(0, this.vel.x * dt, ctx.solid);
    this.moveAxis(1, this.vel.y * dt, ctx.solid);
    this.moveAxis(2, this.vel.z * dt, ctx.solid);

    this.walkPhase += Math.hypot(this.vel.x, this.vel.z) * 2.2 * dt;
    this.syncVisual(dt);
  }

  private syncVisual(dt: number): void {
    this.group.position.copy(this.pos);
    // Gira suavemente na direção alvo.
    let d = this.yaw - this.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.group.rotation.y += d * Math.min(1, 10 * dt);

    const swing = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 3);
    for (let i = 0; i < this.legs.length; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      this.legs[i].rotation.x = Math.sin(this.walkPhase * Math.PI) * 0.7 * swing * dir;
    }
    // Slime: squash & stretch nos pulos.
    if (this.def.jumpy) {
      const squash = this.onGround ? 1 : 1 + Math.min(0.3, Math.abs(this.vel.y) * 0.03);
      this.group.scale.set(this.deathScale * (2 - squash), this.deathScale * squash, this.deathScale * (2 - squash));
    }
  }

  private moveAxis(axis: number, amount: number, solid: SolidAt): void {
    if (amount === 0) return;
    const comp: ("x" | "y" | "z")[] = ["x", "y", "z"];
    this.pos[comp[axis]] += amount;

    const x0 = Math.floor(this.pos.x - this.def.half + EPS);
    const x1 = Math.floor(this.pos.x + this.def.half - EPS);
    const y0 = Math.floor(this.pos.y + EPS);
    const y1 = Math.floor(this.pos.y + this.def.height - EPS);
    const z0 = Math.floor(this.pos.z - this.def.half + EPS);
    const z1 = Math.floor(this.pos.z + this.def.half - EPS);

    for (let bx = x0; bx <= x1; bx++) {
      for (let by = y0; by <= y1; by++) {
        for (let bz = z0; bz <= z1; bz++) {
          if (!solid(bx, by, bz)) continue;
          if (axis === 0) {
            this.pos.x = amount > 0 ? bx - this.def.half - EPS : bx + 1 + this.def.half + EPS;
            this.vel.x = 0;
          } else if (axis === 1) {
            if (amount > 0) {
              this.pos.y = by - this.def.height - EPS;
            } else {
              this.pos.y = by + 1 + EPS;
              this.onGround = true;
            }
            this.vel.y = 0;
          } else {
            this.pos.z = amount > 0 ? bz - this.def.half - EPS : bz + 1 + this.def.half + EPS;
            this.vel.z = 0;
          }
          return;
        }
      }
    }
  }

  /** Interseção raio × AABB do mob (para o ataque do jogador). Retorna t ou null. */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number | null {
    if (this.dead) return null;
    const min = new THREE.Vector3(this.pos.x - this.def.half, this.pos.y, this.pos.z - this.def.half);
    const max = new THREE.Vector3(this.pos.x + this.def.half, this.pos.y + this.def.height, this.pos.z + this.def.half);
    let tMin = 0;
    let tMax = maxDist;
    for (const a of ["x", "y", "z"] as const) {
      const inv = 1 / (dir[a] || 1e-9);
      let t0 = (min[a] - origin[a]) * inv;
      let t1 = (max[a] - origin[a]) * inv;
      if (t0 > t1) [t0, t1] = [t1, t0];
      tMin = Math.max(tMin, t0);
      tMax = Math.min(tMax, t1);
      if (tMin > tMax) return null;
    }
    return tMin;
  }

  private redrawHpBar(): void {
    const ctx = this.hpBarCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, 128, 32);
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 3;
    const label = `${this.def.name} Nv.${this.level}`;
    ctx.strokeText(label, 64, 13);
    ctx.fillText(label, 64, 13);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(14, 20, 100, 8);
    ctx.fillStyle = "#e04040";
    ctx.fillRect(15, 21, 98 * (this.hp / this.maxHp), 6);
    this.hpBarTexture.needsUpdate = true;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
    this.hpBar.material.dispose();
    this.hpBarTexture.dispose();
  }
}
