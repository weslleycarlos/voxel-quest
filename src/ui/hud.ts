import type { Player } from "../entities/player.ts";
import { Inventory, HOTBAR_SIZE, type ItemStack } from "../items/inventory.ts";
import { ITEMS } from "../items/item.ts";
import { CRAFTING_GRID_SIZE, findRecipe, canCraft, craftInGrid } from "../items/crafting.ts";

/**
 * HUD em HTML sobreposto ao canvas (doc §3, regra 4). Fase 2: hotbar de itens
 * (teclas 1–9/scroll), inventário + crafting 2×2 aberto com E, progresso de
 * mineração com overlay de rachadura, e relógio do ciclo dia/noite.
 */
export class Hud {
  private stats = document.getElementById("stats")!;
  private hud = document.getElementById("hud")!;
  private hotbarEl = document.getElementById("hotbar")!;
  private controls = document.getElementById("controls")!;
  private waterOverlay = document.getElementById("waterOverlay")!;
  private breakOverlay = document.getElementById("breakOverlay")!;
  private inventoryEl = document.getElementById("inventory")!;
  private hurtOverlay = document.getElementById("hurtOverlay")!;
  private toastsEl = document.getElementById("toasts")!;
  private hpFill = document.getElementById("hpFill")!;
  private hpText = document.getElementById("hpText")!;
  private xpFill = document.getElementById("xpFill")!;
  private xpText = document.getElementById("xpText")!;
  private fpsSamples: number[] = [];

  private inventory: Inventory;
  private craftingGrid: (ItemStack | null)[] = Array(CRAFTING_GRID_SIZE).fill(null);
  private inventoryOpen = false;
  private onCloseCallback?: () => void;
  private heldMouse: ItemStack | null = null;

  /** Reengaja o pointer lock no canvas do jogo (injetado pelo main). */
  private relock?: () => void;

  constructor(inventory: Inventory, relock?: () => void) {
    this.inventory = inventory;
    this.relock = relock;
    this.inventoryEl.addEventListener("mousedown", (e) => this.onInventoryMouse(e));
    this.inventoryEl.addEventListener("contextmenu", (e) => e.preventDefault());
    this.renderInventory();
    this.renderHotbar();
  }

  /** Abre/fecha o painel de inventário + crafting. */
  toggleInventory(): void {
    this.inventoryOpen = !this.inventoryOpen;
    this.inventoryEl.classList.toggle("hidden", !this.inventoryOpen);
    this.controls.classList.toggle("hidden", this.inventoryOpen);
    if (this.inventoryOpen) {
      this.renderInventory();
      document.exitPointerLock?.();
      this.onCloseCallback?.();
    } else {
      // BUGFIX Fase 2: pedia lock em document.body — o Input só reconhece o
      // canvas, então cliques (quebrar/colocar blocos) morriam após abrir o
      // inventário uma vez. Relock sempre via canvas.
      this.relock?.();
    }
  }

  setInventoryOpen(open: boolean): void {
    if (this.inventoryOpen !== open) this.toggleInventory();
  }

  isInventoryOpen(): boolean {
    return this.inventoryOpen;
  }

  onInventoryClose(cb: () => void): void {
    this.onCloseCallback = cb;
  }

  show(): void {
    this.hud.classList.remove("hidden");
  }
  hide(): void {
    this.hud.classList.add("hidden");
    this.inventoryOpen = false;
    this.inventoryEl.classList.add("hidden");
  }

  /** Atualiza visual da hotbar e seleção. */
  updateHotbar(): void {
    this.renderHotbar();
  }

  /** Mostra progresso de quebra de bloco (0..1). */
  setBreakProgress(p: number): void {
    this.breakOverlay.style.setProperty("--break", `${Math.max(0, Math.min(1, p))}`);
    this.breakOverlay.classList.toggle("hidden", p <= 0 || p >= 1);
  }

  hideBreakOverlay(): void {
    this.breakOverlay.classList.add("hidden");
  }

  update(
    dt: number,
    player: Player,
    firstPerson: boolean,
    biome: string,
    _timeOfDay: number,
    timeText: string
  ): void {
    this.fpsSamples.push(1 / dt);
    if (this.fpsSamples.length > 30) this.fpsSamples.shift();
    const fps = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;

    const p = player.pos;
    const hand = this.inventory.hand;
    const handName = hand ? hand.name : "mãos vazias";

    this.stats.textContent =
      `FPS   ${fps.toFixed(0)}\n` +
      `X Y Z ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}\n` +
      `Bioma ${biome}\n` +
      `Câmera ${firstPerson ? "1ª pessoa" : "3ª pessoa"}` +
      `${player.inWater ? "  (nadando)" : player.onGround ? "" : "  (no ar)"}\n` +
      `Hora  ${timeText}\n` +
      `Mão   ${handName}`;

    this.waterOverlay.classList.toggle("hidden", !(firstPerson && player.headInWater));

    // Vida / XP / nível (Fase 3).
    this.hpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
    this.hpText.textContent = `❤ ${player.hp} / ${player.maxHp}`;
    this.xpFill.style.width = `${(player.xp / player.xpToNext) * 100}%`;
    this.xpText.textContent = `Nível ${player.level} — ${player.xp}/${player.xpToNext} XP`;
  }

  /** Vinheta vermelha rápida ao levar dano. */
  flashHurt(): void {
    this.hurtOverlay.classList.remove("hidden");
    // Reinicia a animação CSS.
    this.hurtOverlay.style.animation = "none";
    void this.hurtOverlay.offsetWidth;
    this.hurtOverlay.style.animation = "";
  }

  /** Aviso temporário (loot coletado, level up, morte). */
  toast(message: string, color = "#eef2e9"): void {
    const el = document.createElement("div");
    el.className = "toast";
    el.style.color = color;
    el.textContent = message;
    this.toastsEl.appendChild(el);
    setTimeout(() => el.remove(), 2700);
    while (this.toastsEl.children.length > 5) this.toastsEl.firstChild?.remove();
  }

  private renderHotbar(): void {
    this.hotbarEl.innerHTML = this.inventory.slots
      .slice(0, HOTBAR_SIZE)
      .map((s, i) => this.slotHtml(s, i, i === this.inventory.selected, i + 1))
      .join("");
  }

  private renderInventory(): void {
    const inv = this.inventory.slots
      .map((s, i) => this.slotHtml(s, i, false, null, "inventory"))
      .join("");

    const craft = this.craftingGrid
      .map((s, i) => this.slotHtml(s, i, false, null, "crafting"))
      .join("");

    const recipe = findRecipe(this.craftingGrid.map((s) => s?.id ?? null));
    const craftable = recipe && canCraft(recipe, this.craftingGrid, this.inventory);
    const result = recipe
      ? `<div class="slot ${craftable ? "" : "disabled"}" data-result="${recipe.id}">
          <span class="swatch" style="background:${ITEMS[recipe.result.id].color}"></span>
          <span class="label">${ITEMS[recipe.result.id].name}</span>
          <span class="count">${recipe.result.count}</span>
        </div>`
      : `<div class="slot empty"><span class="swatch"></span></div>`;

    this.inventoryEl.innerHTML = `
      <div class="panel inventory-panel">
        <h2>Inventário</h2>
        <div class="inv-grid">${inv}</div>
        <div class="crafting-area">
          <div class="craft-grid">${craft}</div>
          <div class="craft-arrow">➜</div>
          <div class="craft-result" id="craftResult">${result}</div>
        </div>
        <button id="closeInv" class="secondary">Fechar (E)</button>
      </div>
    `;

    this.inventoryEl.querySelector("#closeInv")?.addEventListener("click", () => this.toggleInventory());
    const resultEl = this.inventoryEl.querySelector("#craftResult");
    if (resultEl) {
      resultEl.addEventListener("click", () => this.onCraftResult());
    }
  }

  private slotHtml(
    s: ItemStack | null,
    index: number,
    selected: boolean,
    hotkey: number | null,
    type?: "inventory" | "crafting"
  ): string {
    const def = s ? ITEMS[s.id] : null;
    const classes = ["slot", selected ? "selected" : "", s ? "" : "empty", type || ""]
      .filter(Boolean)
      .join(" ");
    return `<div class="${classes}" data-index="${index}" data-type="${type ?? ""}">
      ${hotkey ? `<span class="key">${hotkey}</span>` : ""}
      ${def ? `<span class="swatch" style="background:${def.color}"></span>` : ""}
      ${def ? `<span class="label">${def.name}</span>` : ""}
      ${s && s.count > 1 ? `<span class="count">${s.count}</span>` : ""}
    </div>`;
  }

  private onInventoryMouse(e: MouseEvent): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>(".slot");
    if (!target) return;
    const type = (target.dataset.type as "inventory" | "crafting" | "") || null;
    const index = Number(target.dataset.index);
    const isResult = target.dataset.result;

    if (e.button === 0) {
      if (isResult) {
        this.onCraftResult();
        return;
      }
      if (!type) return;
      this.handleLeftClick(type, index);
    } else if (e.button === 2) {
      if (!type) return;
      this.handleRightClick(type, index);
    }
    this.renderInventory();
    this.renderHotbar();
  }

  private handleLeftClick(type: "inventory" | "crafting", index: number): void {
    const source = type === "inventory" ? this.inventory.slots : this.craftingGrid;
    const stack = source[index];

    if (!this.heldMouse) {
      if (stack) {
        this.heldMouse = { ...stack };
        source[index] = null;
      }
    } else {
      if (!stack) {
        source[index] = { ...this.heldMouse };
        this.heldMouse = null;
      } else if (stack.id === this.heldMouse.id) {
        const max = ITEMS[stack.id].stack;
        const add = Math.min(this.heldMouse.count, max - stack.count);
        stack.count += add;
        this.heldMouse.count -= add;
        if (this.heldMouse.count <= 0) {
          this.heldMouse = null;
        }
      } else {
        // Troca.
        const temp = { ...stack };
        source[index] = { ...this.heldMouse };
        this.heldMouse = temp;
      }
    }
  }

  private handleRightClick(type: "inventory" | "crafting", index: number): void {
    const source = type === "inventory" ? this.inventory.slots : this.craftingGrid;
    const stack = source[index];

    if (!this.heldMouse) {
      if (!stack || stack.count <= 1) return;
      const half = Math.floor(stack.count / 2);
      this.heldMouse = { id: stack.id, count: half };
      stack.count -= half;
    } else {
      if (!stack) {
        source[index] = { id: this.heldMouse.id, count: 1 };
        this.heldMouse.count--;
        if (this.heldMouse.count <= 0) this.heldMouse = null;
      } else if (stack.id === this.heldMouse.id) {
        const max = ITEMS[stack.id].stack;
        if (stack.count < max) {
          stack.count++;
          this.heldMouse.count--;
          if (this.heldMouse.count <= 0) this.heldMouse = null;
        }
      }
    }
  }

  private onCraftResult(): void {
    const recipe = findRecipe(this.craftingGrid.map((s) => s?.id ?? null));
    if (!recipe) return;
    if (craftInGrid(recipe, this.craftingGrid, this.inventory)) {
      this.craftingGrid = this.craftingGrid.map((s) => (s && s.count > 0 ? s : null));
      this.renderInventory();
      this.renderHotbar();
    }
  }

  /** Devolve itens do grid de crafting e do cursor para o inventário ao fechar. */
  returnHeld(): void {
    if (this.heldMouse) {
      this.inventory.add(this.heldMouse.id, this.heldMouse.count);
      this.heldMouse = null;
    }
    for (const s of this.craftingGrid) {
      if (s) {
        this.inventory.add(s.id, s.count);
      }
    }
    this.craftingGrid.fill(null);
  }
}
