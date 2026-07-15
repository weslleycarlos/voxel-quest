/**
 * Entrada de teclado e mouse (doc §3 /core/input.ts). O mouse usa Pointer Lock
 * para olhar livremente; WASD/espaço/shift para mover. Fase 1: cliques do mouse
 * (quebrar/colocar bloco) e teclas numéricas (seleção da hotbar).
 */
export class Input {
  private keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  scrollDelta = 0;
  locked = false;

  /** Cliques ocorridos neste frame (0 = esquerdo, 2 = direito). */
  private clicks = new Set<number>();
  /** Botões do mouse atualmente pressionados. */
  private held = new Set<number>();

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

    this.canvas.addEventListener("mousedown", (e) => {
      if (this.locked) {
        this.clicks.add(e.button);
        this.held.add(e.button);
      }
    });
    window.addEventListener("mouseup", (e) => {
      this.held.delete(e.button);
    });
    this.canvas.addEventListener("wheel", (e) => {
      if (this.locked) this.scrollDelta += Math.sign(e.deltaY);
    }, { passive: true });
    // Menu de contexto atrapalharia o clique direito de colocar bloco.
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
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

  /** Houve clique deste botão neste frame? */
  clicked(button: number): boolean {
    return this.clicks.has(button);
  }

  /** Botão do mouse está pressionado neste frame? */
  isMouseDown(button: number): boolean {
    return this.held.has(button);
  }

  /** Zera acumulados de mouse ao fim do frame. */
  endFrame(): void {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.scrollDelta = 0;
    this.clicks.clear();
  }
}
