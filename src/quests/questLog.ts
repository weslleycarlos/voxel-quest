/**
 * Rastreamento e persistência de quests (doc §6 Fase 4).
 * Mantém estado ativo/completo, processa eventos do jogo e avança objetivos.
 */

import { QuestId, QuestDef, QuestState, QUESTS, generateDaily } from "./quest.ts";
// ItemId import removido — não usado diretamente neste arquivo

export interface QuestEvent {
  type: "blockMined" | "mobKilled" | "itemCrafted" | "npcTalk" | "biomeEntered";
  target: string;
  count?: number;
}

export interface QuestLogSave {
  active: { id: QuestId; progress: number[] }[];
  completed: QuestId[];
  dailyId?: string;
  dailyProgress?: number[];
}

export class QuestLog {
  private active = new Map<QuestId, QuestState>();
  private completed = new Set<QuestId>();
  /** Callbacks para notificar a UI (HUD) de mudanças. */
  onUpdate?: () => void;
  onToast?: (message: string) => void;

  /** Adiciona uma quest ao log se os requisitos forem atendidos. */
  accept(def: QuestDef): boolean {
    if (this.completed.has(def.id) || this.active.has(def.id)) return false;
    if (def.requires) {
      if (def.requires.quest && !this.completed.has(def.requires.quest)) return false;
    }
    this.active.set(def.id, {
      def,
      progress: def.objectives.map(() => 0),
      completed: false,
    });
    this.onUpdate?.();
    this.onToast?.(`Nova missão: ${def.title}`);
    return true;
  }

  /** Aceita automaticamente quests iniciais desbloqueadas. */
  autoAccept(): void {
    for (const q of Object.values(QUESTS)) {
      if (!q.requires && !this.active.has(q.id) && !this.completed.has(q.id)) {
        this.accept(q);
      }
    }
  }

  /** Recebe eventos do jogo e avança quests ativas. */
  handleEvent(ev: QuestEvent): void {
    for (const state of this.active.values()) {
      if (state.completed) continue;
      for (let i = 0; i < state.def.objectives.length; i++) {
        const obj = state.def.objectives[i];
        if (obj.type === "collect" && ev.type === "blockMined" && ev.target === obj.target) {
          this.advance(state, i, ev.count ?? 1);
        } else if (obj.type === "kill" && ev.type === "mobKilled" && ev.target === obj.target) {
          this.advance(state, i, ev.count ?? 1);
        } else if (obj.type === "craft" && ev.type === "itemCrafted" && ev.target === obj.target) {
          this.advance(state, i, ev.count ?? 1);
        } else if (obj.type === "talk" && ev.type === "npcTalk" && ev.target === obj.target) {
          this.advance(state, i, 1);
        } else if (obj.type === "explore" && ev.type === "biomeEntered" && ev.target === obj.target) {
          this.advance(state, i, 1);
        }
      }
    }
  }

  private advance(state: QuestState, objIndex: number, delta: number): void {
    const obj = state.def.objectives[objIndex];
    const before = state.progress[objIndex];
    state.progress[objIndex] = Math.min(obj.amount, before + delta);
    if (state.progress[objIndex] !== before) {
      this.onUpdate?.();
      if (state.progress[objIndex] >= obj.amount) {
        this.checkComplete(state);
      }
    }
  }

  private checkComplete(state: QuestState): void {
    const allDone = state.def.objectives.every((obj, i) => state.progress[i] >= obj.amount);
    if (!allDone) return;
    state.completed = true;
    this.active.delete(state.def.id);
    this.completed.add(state.def.id);
    this.onUpdate?.();
    this.onToast?.(`Missão completa: ${state.def.title}`);

    // Aceita quests desbloqueadas pela conclusão desta.
    for (const q of Object.values(QUESTS)) {
      if (q.requires?.quest === state.def.id) {
        this.accept(q);
      }
    }
  }

  /** Gera ou continua missão diária. */
  refreshDaily(playerLevel: number): QuestState | null {
    const existing = Array.from(this.active.values()).find((s) => s.def.daily);
    if (existing) return existing;
    const def = generateDaily(playerLevel);
    this.accept(def);
    return this.active.get(def.id) ?? null;
  }

  getActive(): QuestState[] {
    return Array.from(this.active.values());
  }

  getCompleted(): QuestId[] {
    return Array.from(this.completed);
  }

  isCompleted(id: QuestId): boolean {
    return this.completed.has(id);
  }

  toSave(): QuestLogSave {
    const active = Array.from(this.active.values()).map((s) => ({
      id: s.def.id,
      progress: s.progress,
    }));
    return {
      active,
      completed: Array.from(this.completed),
    };
  }

  fromSave(data: QuestLogSave | undefined): void {
    if (!data) return;
    this.active.clear();
    this.completed.clear();
    for (const c of data.completed ?? []) this.completed.add(c);
    for (const a of data.active ?? []) {
      const def = QUESTS[a.id];
      if (!def) continue;
      this.active.set(a.id, {
        def,
        progress: a.progress ?? def.objectives.map(() => 0),
        completed: false,
      });
    }
  }
}
