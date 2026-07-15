/**
 * NPCs da vila e diálogos (doc §6 Fase 4).
 * NPCs são modelos simples de cubos posicionados no mundo;
 * interação por proximidade + clique mostra diálogos e entrega quests.
 */

import * as THREE from "three";
import { ChunkManager } from "../world/chunkManager.ts";
import { QuestLog } from "./questLog.ts";
import { QUESTS } from "./quest.ts";
import { CaptionSystem } from "./intro.ts";

export interface NpcDef {
  id: string;
  name: string;
  /** Cor do corpo. */
  color: number;
  /** Diálogos por estado (antes de quest, durante, depois). */
  dialogs: {
    /** Chave: questId + estado ("before", "during", "after"). */
    [key: string]: string[];
  };
  /** Quest que este NPC entrega (opcional). */
  givesQuest?: string;
}

export const NPCS: NpcDef[] = [
  {
    id: "elder",
    name: "Ancião da Vila",
    color: 0x8b7355,
    dialogs: {
      intro_welcome_before: [
        "Bem-vindo, viajante. Este mundo outrora foi próspero...",
        "Mas as criaturas das sombras cresceram em número. Precisamos de sua ajuda.",
        "Explore os arredores e volte quando estiver pronto para ouvir mais.",
      ],
      intro_welcome_after: [
        "Você sobreviveu à primeira noite! Impressionante.",
        "A vila precisa de pedra para reparar os muros. Pode nos ajudar?",
      ],
      tutorial_mine_before: [
        "Precisamos de 8 pedregulhos para reforçar os muros da vila.",
        "Quebre blocos de pedra com sua picareta e traga-os para mim.",
      ],
      tutorial_mine_after: [
        "Excelente trabalho! Com esses materiais, os muros ficarão mais seguros.",
      ],
      default: [
        "A vila agradece sua ajuda. Cuidado com os slimes à noite.",
      ],
    },
    givesQuest: "intro_welcome",
  },
  {
    id: "smith",
    name: "Ferreiro",
    color: 0x4a5568,
    dialogs: {
      tutorial_craft_before: [
        "Uma picareta de madeira é frágil, mas é um começo.",
        "Abra seu inventário com E e monte uma receita de picareta.",
      ],
      tutorial_craft_after: [
        "Bom trabalho! Agora você pode minerar com mais eficiência.",
      ],
      default: [
        "Se precisar de ferramentas, volte aqui. Boa sorte nas minas!",
      ],
    },
  },
  {
    id: "guard",
    name: "Guarda da Vila",
    color: 0x3a7ca5,
    dialogs: {
      tutorial_kill_before: [
        "Slimes estão invadindo os arredores da vila!",
        "Derrote 3 deles para garantir nossa segurança.",
      ],
      tutorial_kill_after: [
        "Os slimes recuaram. Você provou ser um verdadeiro guerreiro!",
        "Tome esta espada como recompensa.",
      ],
      default: [
        "Fico de olho nas muralhas. Você deveria ir ao norte — há rumores de um golem ancião.",
      ],
    },
  },
];

export interface NpcInstance {
  def: NpcDef;
  pos: THREE.Vector3;
  group: THREE.Group;
}

/** Cria o mesh simples de um NPC (2 cubos: corpo + cabeça). */
export function createNpcMesh(def: NpcDef): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: def.color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3), mat);
  body.position.y = 0.375;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), mat);
  head.position.y = 0.95;
  g.add(body, head);

  // Nome flutuante
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.lineWidth = 4;
  ctx.strokeText(def.name, 128, 28);
  ctx.fillText(def.name, 128, 28);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  );
  sprite.scale.set(1.6, 0.3, 1);
  sprite.position.y = 1.45;
  g.add(sprite);

  return g;
}

/** Posiciona NPCs da vila perto do spawn, apoiados na superfície do terreno. */
export function placeVillageNpcs(scene: THREE.Scene, world: ChunkManager): NpcInstance[] {
  const positions = [
    new THREE.Vector3(6.5, 0, 4.5),
    new THREE.Vector3(10.5, 0, 2.5),
    new THREE.Vector3(4.5, 0, 8.5),
  ];
  const instances: NpcInstance[] = [];
  for (let i = 0; i < NPCS.length && i < positions.length; i++) {
    const def = NPCS[i];
    const pos = positions[i];
    pos.y = world.surfaceY(pos.x, pos.z) - 0.05;
    const group = createNpcMesh(def);
    group.position.copy(pos);
    scene.add(group);
    instances.push({ def, pos, group });
  }
  return instances;
}

/** Diálogo disponível para um NPC baseado no estado das quests. */
export function getNpcDialog(npc: NpcDef, log: QuestLog): string[] | null {
  // Se o NPC entrega uma quest que ainda não foi aceita/completada
  if (npc.givesQuest) {
    if (!log.isCompleted(npc.givesQuest) && !log.getActive().some((s) => s.def.id === npc.givesQuest)) {
      return npc.dialogs[`${npc.givesQuest}_before`] ?? npc.dialogs["default"];
    }
  }

  // Para cada quest ativa/completa, busca diálogo específico
  for (const state of log.getActive()) {
    const during = npc.dialogs[`${state.def.id}_during`] ?? npc.dialogs[`${state.def.id}_before`];
    if (during) return during;
  }
  for (const id of log.getCompleted()) {
    const key = `${id}_after`;
    if (npc.dialogs[key]) return npc.dialogs[key];
  }

  return npc.dialogs["default"] ?? null;
}

/** Interage com NPC próximo: retorna true se houve interação. */
export function interactNpc(
  playerPos: THREE.Vector3,
  npcs: NpcInstance[],
  log: QuestLog,
  captions: CaptionSystem
): boolean {
  const INTERACT_DIST = 3.5;
  for (const npc of npcs) {
    // Distância horizontal: a altura do NPC segue o terreno, não o jogador.
    const dx = npc.pos.x - playerPos.x;
    const dz = npc.pos.z - playerPos.z;
    if (Math.hypot(dx, dz) > INTERACT_DIST || Math.abs(npc.pos.y - playerPos.y) > 3) continue;
    const lines = getNpcDialog(npc.def, log);
    if (!lines) return true;

    // Se entrega quest e ainda não foi aceita, aceita automaticamente
    if (npc.def.givesQuest) {
      const questDef = QUESTS[npc.def.givesQuest];
      if (questDef && !log.isCompleted(npc.def.givesQuest) && !log.getActive().some((s) => s.def.id === npc.def.givesQuest)) {
        log.accept(questDef);
      }
    }

    // Avança objetivos do tipo "talk" com este NPC.
    log.handleEvent({ type: "npcTalk", target: npc.def.id });

    captions.play(lines);
    return true;
  }
  return false;
}
