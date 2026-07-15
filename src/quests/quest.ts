/**
 * Sistema de quests declarativo (doc §4.6, §6 Fase 4).
 * Missões com objetivos, progressão automática via eventos, recompensas.
 */

import { ItemId, ITEMS } from "../items/item.ts";

export type QuestId = string;

export type ObjectiveType = "collect" | "kill" | "explore" | "talk" | "craft";

export interface QuestObjective {
  type: ObjectiveType;
  /** ItemId para coletar/craftar, mobId para matar, npcId para falar, ou biome/coord para explorar. */
  target: string;
  /** Quantidade necessária (1 para talk/explore). */
  amount: number;
}

export interface QuestReward {
  xp: number;
  items?: { id: ItemId; count: number }[];
}

export interface QuestDef {
  id: QuestId;
  title: string;
  description: string;
  /** Pré-requisito: quest anterior concluída ou nível mínimo. */
  requires?: { quest?: QuestId; levelMin?: number };
  objectives: QuestObjective[];
  reward: QuestReward;
  /** Se true, é uma missão diária gerada proceduralmente. */
  daily?: boolean;
}

/** Estado de uma quest em andamento no jogador. */
export interface QuestState {
  def: QuestDef;
  /** Progresso por objetivo (índice). */
  progress: number[];
  completed: boolean;
}

/** Banco de quests do jogo. */
export const QUESTS: Record<QuestId, QuestDef> = {
  intro_welcome: {
    id: "intro_welcome",
    title: "Bem-vindo a Voxel Quest",
    description: "Explore os arredores e familiarize-se com o mundo.",
    objectives: [{ type: "explore", target: "spawn", amount: 1 }],
    reward: { xp: 10 },
  },
  tutorial_mine: {
    id: "tutorial_mine",
    title: "Ferro para a Forja",
    description: "Quebre blocos de pedra para coletar recursos.",
    requires: { quest: "intro_welcome" },
    objectives: [{ type: "collect", target: ItemId.Stone, amount: 8 }],
    reward: { xp: 50, items: [{ id: ItemId.PickaxeStone, count: 1 }] },
  },
  tutorial_craft: {
    id: "tutorial_craft",
    title: "Primeira Ferramenta",
    description: "Use o menu de crafting (tecla E) para criar uma picareta de madeira.",
    requires: { quest: "tutorial_mine" },
    objectives: [{ type: "craft", target: ItemId.PickaxeWood, amount: 1 }],
    reward: { xp: 30, items: [{ id: ItemId.Log, count: 4 }] },
  },
  tutorial_kill: {
    id: "tutorial_kill",
    title: "Defesa da Vila",
    description: "Derrote 3 Slimes que ameaçam a vila.",
    requires: { quest: "tutorial_craft" },
    objectives: [{ type: "kill", target: "slime", amount: 3 }],
    reward: { xp: 100, items: [{ id: ItemId.SwordStone, count: 1 }] },
  },
  boss_ancient: {
    id: "boss_ancient",
    title: "O Golem Ancião",
    description: "Encontre e derrote o Golem Ancião nas ruínas ao norte.",
    requires: { quest: "tutorial_kill", levelMin: 5 },
    objectives: [{ type: "kill", target: "ancient_golem", amount: 1 }],
    reward: { xp: 500, items: [{ id: ItemId.Crystal, count: 3 }] },
  },
};

/** Nomes de mobs para exibição (mobId → nome). */
const MOB_NAMES: Record<string, string> = {
  slime: "Slime",
  skeleton: "Esqueleto",
  spider: "Aranha",
  stone_golem: "Golem de Pedra",
  ancient_golem: "Golem Ancião",
};

/** Nome legível do alvo de um objetivo (item, mob, bioma ou local). */
export function targetName(obj: QuestObjective): string {
  if (obj.type === "kill") return MOB_NAMES[obj.target] ?? obj.target;
  if (obj.type === "collect" || obj.type === "craft") {
    return ITEMS[obj.target as ItemId]?.name ?? obj.target;
  }
  return obj.target;
}

/** Id da missão diária de hoje — muda a cada dia real, forçando regeneração. */
export function todayDailyId(): string {
  return `daily_${new Date().toISOString().slice(0, 10)}`;
}

/** Gera a missão diária procedural de hoje. */
export function generateDaily(level: number): QuestDef {
  const targets = [
    { type: "collect" as const, target: ItemId.Stone, amount: 20 },
    { type: "collect" as const, target: ItemId.Log, amount: 15 },
    { type: "kill" as const, target: "slime", amount: 5 },
    { type: "kill" as const, target: "skeleton", amount: 3 },
    { type: "craft" as const, target: ItemId.Plank, amount: 10 },
  ];
  const pick = targets[Math.floor(Math.random() * targets.length)];
  const verb = pick.type === "collect" ? "colete" : pick.type === "kill" ? "derrote" : "crie";
  return {
    id: todayDailyId(),
    title: "Missão Diária",
    description: `Complete o objetivo: ${verb} ${pick.amount}x ${targetName(pick)}.`,
    objectives: [{ type: pick.type, target: pick.target, amount: pick.amount }],
    reward: { xp: 30 + level * 10 },
    daily: true,
  };
}
