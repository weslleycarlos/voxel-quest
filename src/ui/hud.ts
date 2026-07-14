import type { Player } from "../entities/player.ts";

/**
 * HUD em HTML sobreposto ao canvas (doc §3, regra 4). Fase 0: FPS, posição e
 * modo de câmera. Vida/XP/hotbar chegam nas fases seguintes.
 */
export class Hud {
  private stats = document.getElementById("stats")!;
  private hud = document.getElementById("hud")!;
  private fpsSamples: number[] = [];

  show(): void {
    this.hud.classList.remove("hidden");
  }
  hide(): void {
    this.hud.classList.add("hidden");
  }

  update(dt: number, player: Player, firstPerson: boolean): void {
    this.fpsSamples.push(1 / dt);
    if (this.fpsSamples.length > 30) this.fpsSamples.shift();
    const fps = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;

    const p = player.pos;
    this.stats.textContent =
      `FPS   ${fps.toFixed(0)}\n` +
      `X Y Z ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}\n` +
      `Câmera ${firstPerson ? "1ª pessoa" : "3ª pessoa"}` +
      `${player.onGround ? "" : "  (no ar)"}`;
  }
}
