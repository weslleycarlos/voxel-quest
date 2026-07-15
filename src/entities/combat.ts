import * as THREE from "three";

/**
 * Utilidades de combate (doc §3 /entities/combat.ts). Fase 3: números de dano
 * flutuantes como sprites no mundo (sobem e desvanecem) e cálculo de dano do
 * jogador (arma na mão + força, com chance de crítico).
 */

export const PLAYER_ATTACK_COOLDOWN = 0.45; // s
export const PLAYER_ATTACK_RANGE = 3.2;
const CRIT_CHANCE = 0.12;
const CRIT_MULTIPLIER = 1.6;

export interface AttackResult {
  damage: number;
  crit: boolean;
}

/** Dano final de um golpe do jogador: arma (ou soco) + força, com crítico. */
export function rollPlayerDamage(weaponDamage: number | undefined, strength: number): AttackResult {
  const base = (weaponDamage ?? 1) + strength * 0.5;
  const crit = Math.random() < CRIT_CHANCE;
  const damage = Math.max(1, Math.round(base * (crit ? CRIT_MULTIPLIER : 1)));
  return { damage, crit };
}

interface FloatingText {
  sprite: THREE.Sprite;
  life: number;
  vel: THREE.Vector3;
}

/** Números de dano flutuante (dano causado, crítico e XP ganho). */
export class FloatingTextManager {
  private texts: FloatingText[] = [];

  constructor(private scene: THREE.Scene) {}

  spawn(pos: THREE.Vector3, text: string, color: string, big = false): void {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 48;
    const ctx = canvas.getContext("2d")!;
    ctx.font = `bold ${big ? 30 : 22}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 5;
    ctx.strokeText(text, 64, 24);
    ctx.fillStyle = color;
    ctx.fillText(text, 64, 24);

    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
    );
    const s = big ? 1.1 : 0.85;
    sprite.scale.set(s * (128 / 48), s, 1);
    sprite.position.copy(pos);
    this.scene.add(sprite);

    this.texts.push({
      sprite,
      life: 0.9,
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, 2.2, (Math.random() - 0.5) * 0.6),
    });
  }

  update(dt: number): void {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.vel.y -= 2.5 * dt;
      t.sprite.position.addScaledVector(t.vel, dt);
      t.sprite.material.opacity = Math.min(1, t.life / 0.35);
      if (t.life <= 0) {
        this.scene.remove(t.sprite);
        t.sprite.material.map?.dispose();
        t.sprite.material.dispose();
        this.texts.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const t of this.texts) {
      this.scene.remove(t.sprite);
      t.sprite.material.map?.dispose();
      t.sprite.material.dispose();
    }
    this.texts = [];
  }
}
