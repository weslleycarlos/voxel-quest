/**
 * Inventário em grade + hotbar (doc §3 /items/inventory.ts). Fase 2: 27 slots
 * (3×9), sendo os 9 primeiros a hotbar. Itens empilháveis até o máximo da
 * definição. Suporta adição, consumo, movimentação e serialização para save.
 */

import { ItemId, ITEMS, type ItemDef } from "./item.ts";

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 27;

export interface ItemStack {
  id: ItemId;
  count: number;
}

export type InventorySlot = ItemStack | null;

export interface InventorySave {
  slots: InventorySlot[];
  selected: number;
}

export class Inventory {
  slots: InventorySlot[] = Array(INVENTORY_SIZE).fill(null);
  /** Índice 0..HOTBAR_SIZE-1 do slot ativo na hotbar. */
  selected = 0;

  /** Item atualmente seguro na mão (hotbar selecionada). */
  get hand(): ItemDef | null {
    const stack = this.slots[this.selected];
    return stack ? ITEMS[stack.id] : null;
  }

  /** Seleciona slot da hotbar (1-based para UI; 0-based interno). */
  selectHotbar(index: number): void {
    this.selected = Math.max(0, Math.min(HOTBAR_SIZE - 1, index));
  }

  /** Seleção da próxima hotbar (rolagem do mouse). */
  scroll(delta: number): void {
    this.selected = (this.selected + delta + HOTBAR_SIZE) % HOTBAR_SIZE;
  }

  /** Adiciona itens, tentando empilhar e depois slots vazios. Retorna o restante. */
  add(id: ItemId, count: number): number {
    const max = ITEMS[id].stack;
    let remaining = count;

    // Empilhar primeiro.
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const slot = this.slots[i];
      if (slot && slot.id === id) {
        const add = Math.min(remaining, max - slot.count);
        slot.count += add;
        remaining -= add;
      }
    }

    // Depois slots vazios.
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(remaining, max);
        this.slots[i] = { id, count: add };
        remaining -= add;
      }
    }

    return remaining;
  }

  /** Remove `count` itens de um id espalhados pelo inventário. Retorna true se conseguiu. */
  remove(id: ItemId, count: number): boolean {
    let needed = count;
    for (const slot of this.slots) {
      if (!slot || slot.id !== id) continue;
      const rem = Math.min(needed, slot.count);
      slot.count -= rem;
      needed -= rem;
      if (slot.count <= 0) {
        const idx = this.slots.indexOf(slot);
        this.slots[idx] = null;
      }
      if (needed === 0) return true;
    }
    return false;
  }

  /** Conta quantos de um id existem. */
  count(id: ItemId): number {
    return this.slots.reduce((acc, s) => (s && s.id === id ? acc + s.count : acc), 0);
  }

  /** Consome 1 item do slot selecionado (usado para colocar bloco). */
  consumeHand(): void {
    const stack = this.slots[this.selected];
    if (!stack) return;
    stack.count--;
    if (stack.count <= 0) this.slots[this.selected] = null;
  }

  /** Move itens entre slots (arrastar-e-soltar). */
  move(from: number, to: number): void {
    if (from === to) return;
    const a = this.slots[from];
    const b = this.slots[to];
    if (!a) return;

    if (b && b.id === a.id) {
      const max = ITEMS[a.id].stack;
      const add = Math.min(a.count, max - b.count);
      b.count += add;
      a.count -= add;
      if (a.count <= 0) this.slots[from] = null;
    } else {
      this.slots[from] = b;
      this.slots[to] = a;
    }
  }

  /** Divide um stack ao clicar com botão direito (crafting/transferência). */
  split(index: number): ItemStack | null {
    const s = this.slots[index];
    if (!s || s.count <= 1) return null;
    const half = Math.floor(s.count / 2);
    s.count -= half;
    return { id: s.id, count: half };
  }

  /** Para saves: serialização compacta. */
  toSave(): InventorySave {
    return {
      slots: this.slots.map((s) => (s ? { id: s.id, count: s.count } : null)),
      selected: this.selected,
    };
  }

  fromSave(data: InventorySave): void {
    if (!data || !Array.isArray(data.slots)) return;
    this.slots = data.slots.slice(0, INVENTORY_SIZE).map((s) => {
      if (!s || !s.id || s.count <= 0) return null;
      return { id: s.id as ItemId, count: s.count };
    });
    if (data.slots.length < INVENTORY_SIZE) {
      this.slots.push(...Array(INVENTORY_SIZE - data.slots.length).fill(null));
    }
    this.selected = Math.max(0, Math.min(HOTBAR_SIZE - 1, data.selected ?? 0));
  }
}
