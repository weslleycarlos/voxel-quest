import type { Player } from "../entities/player.ts";
import { BLOCKS, PLACEABLE_BLOCKS, type Block } from "../world/blocks.ts";

/**
 * HUD em HTML sobreposto ao canvas (doc §3, regra 4). Fase 1: FPS, posição,
 * bioma, hotbar simplificada de blocos (teclas 1–7) e overlay azulado quando a
 * cabeça está submersa. Vida/XP chegam nas fases seguintes.
 */
export class Hud {
  private stats = document.getElementById("stats")!;
  private hud = document.getElementById("hud")!;
  private hotbar = document.getElementById("hotbar")!;
  private waterOverlay = document.getElementById("waterOverlay")!;
  private fpsSamples: number[] = [];

  constructor() {
    this.hotbar.innerHTML = PLACEABLE_BLOCKS.map((b, i) => {
      const [r, g, bl] = BLOCKS[b].color.top;
      const css = `rgb(${(r * 255) | 0},${(g * 255) | 0},${(bl * 255) | 0})`;
      return `<div class="slot" data-block="${b}">
        <span class="key">${i + 1}</span>
        <span class="swatch" style="background:${css}"></span>
        <span class="label">${BLOCKS[b].name}</span>
      </div>`;
    }).join("");
  }

  show(): void {
    this.hud.classList.remove("hidden");
  }
  hide(): void {
    this.hud.classList.add("hidden");
  }

  setSelectedBlock(block: Block): void {
    for (const el of this.hotbar.querySelectorAll<HTMLElement>(".slot")) {
      el.classList.toggle("selected", Number(el.dataset.block) === block);
    }
  }

  update(dt: number, player: Player, firstPerson: boolean, biome: string): void {
    this.fpsSamples.push(1 / dt);
    if (this.fpsSamples.length > 30) this.fpsSamples.shift();
    const fps = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;

    const p = player.pos;
    this.stats.textContent =
      `FPS   ${fps.toFixed(0)}\n` +
      `X Y Z ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}\n` +
      `Bioma ${biome}\n` +
      `Câmera ${firstPerson ? "1ª pessoa" : "3ª pessoa"}` +
      `${player.inWater ? "  (nadando)" : player.onGround ? "" : "  (no ar)"}`;

    this.waterOverlay.classList.toggle("hidden", !(firstPerson && player.headInWater));
  }
}
