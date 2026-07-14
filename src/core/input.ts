/**
 * Entrada de teclado e mouse (doc §3 /core/input.ts). O mouse usa Pointer Lock
 * para olhar livremente; WASD/espaço/shift para mover. A UI de pausa é tratada
 * no main via eventos de lock.
 */
export class Input {
  private keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  locked = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      // Evita rolagem da página com espaço.
      if (e.code === "Space") e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.keys.clear();
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  requestLock(): void {
    this.canvas.requestPointerLock();
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** Consome o pressionamento (retorna true apenas uma vez por pressão). */
  private consumed = new Set<string>();
  pressed(code: string): boolean {
    if (this.keys.has(code)) {
      if (!this.consumed.has(code)) {
        this.consumed.add(code);
        return true;
      }
      return false;
    }
    this.consumed.delete(code);
    return false;
  }

  /** Zera o acumulado de mouse ao fim do frame. */
  endFrame(): void {
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
