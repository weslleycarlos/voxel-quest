/**
 * Tipos de mob declarativos (doc §3 /entities/mobTypes.ts, §6 Fase 3).
 * Stats base escalam com o nível do mob; visual é definido por partes de
 * cubos coloridos (sem assets externos, doc §5).
 */

export interface MobPart {
  /** Tamanho [w,h,d] e centro [x,y,z] relativos aos pés do mob. */
  size: [number, number, number];
  pos: [number, number, number];
  color: number;
  /** Parte animada como "perna" (balança ao andar). */
  leg?: boolean;
}

export interface MobDef {
  id: string;
  name: string;
  /** AABB de colisão: meia-largura e altura. */
  half: number;
  height: number;
  parts: MobPart[];
  baseHp: number;
  baseDamage: number;
  baseXp: number;
  speed: number;
  /** Distância para começar a perseguir o jogador. */
  aggroRange: number;
  attackRange: number;
  attackCooldown: number; // s
  hostile: boolean;
  /** Slime: locomoção por pulinhos. */
  jumpy?: boolean;
  /** Regras de spawn. */
  spawn: {
    /** Aparece na superfície durante o dia. */
    day?: boolean;
    /** Aparece na superfície à noite. */
    night?: boolean;
    /** Aparece em cavernas (abaixo de SURFACE_MIN_Y). */
    underground?: boolean;
    weight: number;
  };
  lootTable: string;
}

export const MOB_TYPES: MobDef[] = [
  {
    id: "slime",
    name: "Slime",
    half: 0.35,
    height: 0.7,
    parts: [
      { size: [0.7, 0.6, 0.7], pos: [0, 0.32, 0], color: 0x6fc83a },
      { size: [0.14, 0.14, 0.05], pos: [-0.16, 0.42, 0.34], color: 0x1c2a12 },
      { size: [0.14, 0.14, 0.05], pos: [0.16, 0.42, 0.34], color: 0x1c2a12 },
    ],
    baseHp: 8,
    baseDamage: 1,
    baseXp: 6,
    speed: 1.6,
    aggroRange: 10,
    attackRange: 1.2,
    attackCooldown: 1.4,
    hostile: true,
    jumpy: true,
    spawn: { day: true, night: true, weight: 4 },
    lootTable: "slime",
  },
  {
    id: "skeleton",
    name: "Esqueleto",
    half: 0.3,
    height: 1.8,
    parts: [
      { size: [0.2, 0.75, 0.24], pos: [-0.12, 0.38, 0], color: 0xd8d4c0, leg: true },
      { size: [0.2, 0.75, 0.24], pos: [0.12, 0.38, 0], color: 0xd8d4c0, leg: true },
      { size: [0.5, 0.55, 0.28], pos: [0, 1.06, 0], color: 0xb8b4a0 },
      { size: [0.38, 0.38, 0.38], pos: [0, 1.55, 0], color: 0xe8e4d0 },
      { size: [0.09, 0.09, 0.05], pos: [-0.1, 1.6, 0.19], color: 0x1a1a1a },
      { size: [0.09, 0.09, 0.05], pos: [0.1, 1.6, 0.19], color: 0x1a1a1a },
    ],
    baseHp: 14,
    baseDamage: 3,
    baseXp: 12,
    speed: 2.6,
    aggroRange: 14,
    attackRange: 1.6,
    attackCooldown: 1.1,
    hostile: true,
    spawn: { night: true, underground: true, weight: 3 },
    lootTable: "skeleton",
  },
  {
    id: "golem",
    name: "Golem de Pedra",
    half: 0.45,
    height: 2.0,
    parts: [
      { size: [0.34, 0.8, 0.36], pos: [-0.24, 0.4, 0], color: 0x6b7078, leg: true },
      { size: [0.34, 0.8, 0.36], pos: [0.24, 0.4, 0], color: 0x6b7078, leg: true },
      { size: [0.9, 0.75, 0.55], pos: [0, 1.2, 0], color: 0x8b8f96 },
      { size: [0.5, 0.42, 0.45], pos: [0, 1.8, 0], color: 0x7b8088 },
      { size: [0.1, 0.08, 0.05], pos: [-0.12, 1.84, 0.24], color: 0xffb050 },
      { size: [0.1, 0.08, 0.05], pos: [0.12, 1.84, 0.24], color: 0xffb050 },
    ],
    baseHp: 30,
    baseDamage: 5,
    baseXp: 25,
    speed: 1.8,
    aggroRange: 9,
    attackRange: 1.9,
    attackCooldown: 1.8,
    hostile: true,
    spawn: { underground: true, weight: 2 },
    lootTable: "golem",
  },
];

/** Escala de stats por nível (doc §6 Fase 3: mobs com níveis). */
export function scaledHp(def: MobDef, level: number): number {
  return Math.round(def.baseHp * (1 + 0.35 * (level - 1)));
}
export function scaledDamage(def: MobDef, level: number): number {
  return Math.round(def.baseDamage * (1 + 0.25 * (level - 1)));
}
export function scaledXp(def: MobDef, level: number): number {
  return Math.round(def.baseXp * level);
}
