/**
 * Sistema de legendas/introdução (doc §6 Fase 4).
 * Sequência de textos sobrepostos ao canvas, puláveis com clique.
 * Usado na abertura do mundo e em diálogos importantes de NPCs.
 */

export type CaptionLine = string;

export class CaptionSystem {
  private container: HTMLElement;
  private active = false;
  private queue: CaptionLine[] = [];
  private currentIndex = 0;
  private onDone?: () => void;

  constructor(parent: HTMLElement = document.body) {
    this.container = document.createElement("div");
    this.container.className = "caption-overlay";
    this.container.style.cssText =
      "position:fixed;inset:0;display:none;flex-direction:column;" +
      "align-items:center;justify-content:flex-end;padding-bottom:15vh;" +
      "z-index:20;cursor:pointer;background:transparent;";
    this.container.addEventListener("click", () => this.advance());
    parent.appendChild(this.container);
  }

  /** Toca uma sequência de legendas. */  play(lines: CaptionLine[], onDone?: () => void): void {
    this.queue = lines;
    this.currentIndex = 0;
    this.onDone = onDone;
    this.active = true;
    this.container.style.display = "flex";
    this.render();
  }

  private advance(): void {
    this.currentIndex++;
    if (this.currentIndex >= this.queue.length) {
      this.active = false;
      this.container.style.display = "none";
      this.container.innerHTML = "";
      this.onDone?.();
      return;
    }
    this.render();
  }

  private render(): void {
    const text = this.queue[this.currentIndex];
    const progress = `${this.currentIndex + 1}/${this.queue.length}`;
    this.container.innerHTML = `
      <div class="caption-box">
        <p class="caption-text">${text}</p>
        <span class="caption-hint">Clique para continuar (${progress})</span>
      </div>
    `;
  }

  get isPlaying(): boolean {
    return this.active;
  }

  dispose(): void {
    this.container.remove();
  }
}
