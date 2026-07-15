import {
  listWorlds,
  createWorld,
  deleteWorld,
  type WorldMeta,
} from "../save/worldRegistry.ts";

/**
 * Tela inicial (doc §3 /screens/titleScreen.ts, §4.8): lista mundos salvos com
 * Jogar/Excluir e formulário de "Criar Novo Mundo" (nome + seed opcional).
 * UI 100% HTML/CSS por cima do canvas (doc §3, regra 4).
 */
export class TitleScreen {
  constructor(
    private root: HTMLElement,
    private onPlay: (world: WorldMeta) => void
  ) {}

  async show(): Promise<void> {
    this.root.classList.remove("hidden");
    await this.render();
  }

  hide(): void {
    this.root.classList.add("hidden");
  }

  private async render(): Promise<void> {
    const worlds = await listWorlds();

    this.root.innerHTML = `
      <div class="panel title-panel">
        <h1>VOXEL QUEST</h1>
        <p class="tag">Fase 4 — Missões e Mundo Vivo</p>

        <div class="world-list">
          ${
            worlds.length === 0
              ? `<p class="empty">Nenhum mundo ainda. Crie o primeiro!</p>`
              : worlds.map((w) => this.worldRow(w)).join("")
          }
        </div>

        <form id="newWorldForm" class="new-world">
          <input id="worldName" type="text" maxlength="32" placeholder="Nome do mundo" autocomplete="off" />
          <input id="worldSeed" type="text" maxlength="32" placeholder="Seed (opcional)" autocomplete="off" />
          <button type="submit">Criar Novo Mundo</button>
        </form>
      </div>
    `;

    this.root.querySelector<HTMLFormElement>("#newWorldForm")!.addEventListener(
      "submit",
      async (e) => {
        e.preventDefault();
        const nome = this.root.querySelector<HTMLInputElement>("#worldName")!.value;
        const seed = this.root.querySelector<HTMLInputElement>("#worldSeed")!.value;
        const world = await createWorld(nome, seed);
        this.hide();
        this.onPlay(world);
      }
    );

    for (const btn of this.root.querySelectorAll<HTMLButtonElement>("[data-play]")) {
      btn.addEventListener("click", () => {
        const world = worlds.find((w) => w.id === btn.dataset.play)!;
        this.hide();
        this.onPlay(world);
      });
    }

    for (const btn of this.root.querySelectorAll<HTMLButtonElement>("[data-delete]")) {
      btn.addEventListener("click", async () => {
        const world = worlds.find((w) => w.id === btn.dataset.delete)!;
        if (!confirm(`Excluir o mundo "${world.nome}"? Isso não pode ser desfeito.`)) return;
        await deleteWorld(world.id);
        await this.render();
      });
    }
  }

  private worldRow(w: WorldMeta): string {
    const date = new Date(w.ultimoJogo).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `
      <div class="world-row">
        <div class="world-info">
          <span class="world-name">${escapeHtml(w.nome)}</span>
          <span class="world-meta">seed: ${escapeHtml(w.seed)} · último jogo: ${date}</span>
        </div>
        <div class="world-actions">
          <button data-play="${w.id}">Jogar</button>
          <button data-delete="${w.id}" class="danger">Excluir</button>
        </div>
      </div>
    `;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
