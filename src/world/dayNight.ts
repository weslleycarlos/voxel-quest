/**
 * Ciclo dia/noite (doc §6 Fase 2). Fase 2: tempo contínuo de 0..1, duração
 * configurável. Atualiza céu, névoa e iluminação (hemi + sol) para criar
 * atmosfera de sobrevivência sem sombras dinâmicas.
 */

import * as THREE from "three";

export const DAY_LENGTH = 600; // segundos reais para um ciclo completo

export class DayNightCycle {
  /** 0 = meio-dia, 0.25 = pôr do sol, 0.5 = meia-noite, 0.75 = nascer do sol. */
  timeOfDay = 0.25; // começa no início da tarde para mostrar variação
  private elapsed = 0;

  // Paleta de cores (0xRRGGBB)
  private readonly skyDayTop = 0x8fc7ff;
  private readonly skyDayBottom = 0xcfe8ff;
  private readonly skySunsetTop = 0x6a4c6e;
  private readonly skySunsetBottom = 0xf4a261;
  private readonly skyNightTop = 0x0a0e17;
  private readonly skyNightBottom = 0x1a2435;

  private readonly sunDay = 0xfff9d6;
  private readonly sunSunset = 0xff8c42;
  private readonly sunNight = 0x2a3a55;

  constructor(
    private hemiLight: THREE.HemisphereLight,
    private dirLight: THREE.DirectionalLight,
    private fog: THREE.Fog,
    private skyTexture: THREE.Texture
  ) {}

  update(dt: number): void {
    this.elapsed += dt;
    this.timeOfDay = (this.elapsed % DAY_LENGTH) / DAY_LENGTH;

    const sunAngle = this.timeOfDay * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    const sunDir = new THREE.Vector3(
      Math.cos(sunAngle) * 0.5,
      Math.max(0.08, sunHeight),
      0.3
    ).normalize();
    this.dirLight.position.copy(sunDir);

    const dayPhase = this.dayPhase();
    const sky = this.lerpSky(dayPhase);
    const fog = this.lerpFog(dayPhase);
    const hemiIntensity = this.lerpHemiIntensity(dayPhase);
    const dirIntensity = this.lerpDirIntensity(dayPhase);
    const sunColor = this.lerpSunColor(dayPhase);

    this.updateSkyTexture(sky.top, sky.bottom);
    this.fog.color.setHex(fog);
    this.hemiLight.intensity = hemiIntensity;
    this.hemiLight.groundColor.setHex(dayPhase < 0.5 ? 0x556644 : 0x2a3325);
    this.dirLight.intensity = dirIntensity;
    this.dirLight.color.setHex(sunColor);
  }

  /** Retorna 0 = dia, 0.5 = crepúsculo, 1 = noite. */
  private dayPhase(): number {
    const t = this.timeOfDay;
    // transições suaves próximo a 0.2 (pôr) e 0.8 (nascer)
    if (t >= 0.25 && t <= 0.75) {
      const center = (t - 0.25) / 0.5; // 0..1 dentro do período noturno
      return 0.5 + (center - 0.5) * 0.5; // 0.25..0.75
    }
    const edge = t < 0.25 ? t : 1 - t;
    const fade = Math.min(1, edge / 0.08);
    return 0.5 * (1 - fade);
  }

  private lerpSky(phase: number) {
    if (phase <= 0.5) {
      const k = phase / 0.5;
      return {
        top: lerpColor(this.skyDayTop, this.skySunsetTop, k),
        bottom: lerpColor(this.skyDayBottom, this.skySunsetBottom, k),
      };
    }
    const k = (phase - 0.5) / 0.5;
    return {
      top: lerpColor(this.skySunsetTop, this.skyNightTop, k),
      bottom: lerpColor(this.skySunsetBottom, this.skyNightBottom, k),
    };
  }

  private lerpFog(phase: number): number {
    if (phase <= 0.5) {
      return lerpColor(0xbfe0ff, 0x9b6e5a, phase / 0.5);
    }
    return lerpColor(0x9b6e5a, 0x1a2435, (phase - 0.5) / 0.5);
  }

  private lerpHemiIntensity(phase: number): number {
    const day = 0.9;
    const night = 0.18;
    if (phase <= 0.5) return day - (day - 0.45) * (phase / 0.5);
    return 0.45 - (0.45 - night) * ((phase - 0.5) / 0.5);
  }

  private lerpDirIntensity(phase: number): number {
    const day = 0.7;
    const night = 0.05;
    if (phase <= 0.5) return day - (day - 0.15) * (phase / 0.5);
    return 0.15 - (0.15 - night) * ((phase - 0.5) / 0.5);
  }

  private lerpSunColor(phase: number): number {
    if (phase <= 0.5) return lerpColor(this.sunDay, this.sunSunset, phase / 0.5);
    return lerpColor(this.sunSunset, this.sunNight, (phase - 0.5) / 0.5);
  }

  private updateSkyTexture(top: number, bottom: number): void {
    const c = this.skyTexture.image as HTMLCanvasElement;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, `#${top.toString(16).padStart(6, "0")}`);
    grad.addColorStop(1, `#${bottom.toString(16).padStart(6, "0")}`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
    this.skyTexture.needsUpdate = true;
  }
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Formato "HH:MM" para HUD. */
export function formatTime(timeOfDay: number): string {
  const minutes = Math.floor(timeOfDay * 24 * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
