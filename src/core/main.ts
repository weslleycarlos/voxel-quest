import * as THREE from "three";
import { CHUNK_X, CHUNK_Z } from "../world/chunk.ts";
import { ChunkManager, RENDER_DISTANCE } from "../world/chunkManager.ts";
import { TerrainGenerator } from "../world/terrainGen.ts";
import { raycastVoxel } from "../world/raycast.ts";
import { createDetailTexture } from "../world/textures.ts";
import { Block, BLOCKS } from "../world/blocks.ts";
import { Input } from "./input.ts";
import { CameraController } from "./camera.ts";
import { Player } from "../entities/player.ts";
import { createPlayerModel } from "../entities/playerModel.ts";
import { Hud } from "../ui/hud.ts";
import { TitleScreen } from "../screens/titleScreen.ts";
import { loadWorldSave, saveWorld, type PlayerSave } from "../save/saveManager.ts";
import type { WorldMeta } from "../save/worldRegistry.ts";
import { Inventory, HOTBAR_SIZE } from "../items/inventory.ts";
import { ItemId, ITEMS, blockDrop } from "../items/item.ts";
import { DayNightCycle, formatTime } from "../world/dayNight.ts";
import { Spawner } from "../entities/spawner.ts";
import { Mob } from "../entities/mob.ts";
import {
  FloatingTextManager,
  rollPlayerDamage,
  PLAYER_ATTACK_COOLDOWN,
  PLAYER_ATTACK_RANGE,
} from "../entities/combat.ts";
import { scaledXp, ANCIENT_GOLEM } from "../entities/mobTypes.ts";
import { rollLoot, RARITY_COLORS } from "../items/lootTables.ts";

// --- Fase 4: Mundo vivo, quests, NPCs, introdução ---
import { CaptionSystem } from "../quests/intro.ts";
import { QuestLog } from "../quests/questLog.ts";
import { type NpcInstance, placeVillageNpcs, interactNpc } from "../quests/npcs.ts";
import { buildVillage } from "../quests/village.ts";

/**
 * Bootstrap e game loop (doc §3 /core/main.ts). Fase 1 — Mundo:
 * tela inicial com múltiplos mundos, chunks dinâmicos ao redor do jogador,
 * terreno procedural por seed (biomas + cavernas), quebrar/colocar blocos com
 * rebuild localizado, física de água (nado) e autosave em IndexedDB.
 */

const FOG_COLOR = 0xbfe0ff;
const REACH = 6; // alcance de interação com blocos
const AUTOSAVE_INTERVAL = 30; // s (doc §4.8)
const HAND_BREAK_SPEED = 0.8; // poder das mãos nuas

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(FOG_COLOR);

const scene = new THREE.Scene();
const viewDist = RENDER_DISTANCE * CHUNK_X;
const fog = new THREE.Fog(FOG_COLOR, viewDist * 0.55, viewDist * 0.95);
scene.fog = fog;
const skyTexture = makeSkyTexture();
scene.background = skyTexture;

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.05,
  600
);
scene.add(camera); // necessário para renderizar filhos (viewmodel) da câmera

// --- Iluminação suave (sem sombras dinâmicas, doc §5) ---
const hemi = new THREE.HemisphereLight(0xdff1ff, 0x556644, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.7);
sun.position.set(0.5, 1, 0.3);
scene.add(sun);
const dayNight = new DayNightCycle(hemi, sun, fog, skyTexture);

// --- Materiais compartilhados por todos os chunks ---
const detailTexture = createDetailTexture();
const opaqueMaterial = new THREE.MeshBasicMaterial({
  vertexColors: true,
  map: detailTexture,
  fog: true,
});
const waterMaterial = new THREE.MeshBasicMaterial({
  vertexColors: true,
  map: detailTexture,
  fog: true,
  transparent: true,
  opacity: 0.62,
  depthWrite: false,
});

// --- Destaque do bloco mirado ---
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.6 })
);
highlight.visible = false;
scene.add(highlight);

// --- Entidades e controles (independentes do mundo ativo) ---
const player = new Player();
const playerModel = createPlayerModel();
scene.add(playerModel.group);

const cameraController = new CameraController(camera);
const input = new Input(canvas);
const inventory = new Inventory();
const hud = new Hud(inventory, () => input.requestLock());
hud.onCraft = (itemId) => {
  questLog.handleEvent({ type: "itemCrafted", target: itemId });
};

// --- Estado do mundo ativo ---
let world: ChunkManager | null = null;
let activeWorld: WorldMeta | null = null;
let generator: TerrainGenerator | null = null;
let autosaveTimer = 0;
let playing = false;

// --- Estado de mineração ---
let miningTarget: { x: number; y: number; z: number } | null = null;
let miningProgress = 0;

// --- Fase 3: mobs, combate e textos flutuantes ---
let spawner: Spawner | null = null;
const floatingText = new FloatingTextManager(scene);
let attackCooldown = 0;

// --- Fase 4: quests, NPCs, introdução e boss ---
const captions = new CaptionSystem();
const questLog = new QuestLog();
let villageNpcs: NpcInstance[] = [];
let bossMob: Mob | null = null;
let introShown = false;

// --- Telas ---
const overlay = document.getElementById("overlay")!;
const pausePanel = document.getElementById("pause")!;
const titleScreen = new TitleScreen(overlay, (meta) => void startWorld(meta));

document.getElementById("resumeBtn")!.addEventListener("click", () => {
  pausePanel.classList.add("hidden");
  input.requestLock();
});
document.getElementById("quitBtn")!.addEventListener("click", async () => {
  await persist();
  stopWorld();
  pausePanel.classList.add("hidden");
  await titleScreen.show();
});

document.addEventListener("pointerlockchange", () => {
  if (!playing) return;
  if (input.locked) {
    pausePanel.classList.add("hidden");
    hud.show();
  } else if (hud.isInventoryOpen()) {
    // Lock liberado pelo próprio inventário (E): não é pausa.
  } else {
    // ESC = pausa: mostra o menu e dispara um save (doc §4.8).
    pausePanel.classList.remove("hidden");
    hud.hide();
    void persist();
  }
});

window.addEventListener("beforeunload", () => void persist());

void titleScreen.show();

// ---------- Ciclo de vida do mundo ----------

async function startWorld(meta: WorldMeta): Promise<void> {
  const save = await loadWorldSave(meta.id);

  activeWorld = meta;
  generator = new TerrainGenerator(meta.seed);
  world = new ChunkManager(scene, generator, opaqueMaterial, waterMaterial, save.chunks);

  if (save.player) {
    player.pos.set(...save.player.pos);
    player.yaw = save.player.yaw;
    player.pitch = save.player.pitch;
    inventory.slots.fill(null);
    inventory.fromSave(save.player.inventory);
  } else {
    player.pos.set(CHUNK_X / 2 + 0.5, 60, CHUNK_Z / 2 + 0.5);
    player.yaw = 0;
    player.pitch = 0;
    inventory.slots.fill(null);
    inventory.selected = 0;
    // Kit inicial de sobrevivência (Fase 2) + espada (Fase 3).
    inventory.add(ItemId.PickaxeWood, 1);
    inventory.add(ItemId.SwordWood, 1);
    inventory.add(ItemId.DirtBlock, 16);
    inventory.add(ItemId.StoneBlock, 16);
  }
  // Stats RPG (Fase 3): restaura do save ou usa padrões de nível 1.
  player.level = save.player?.stats?.level ?? 1;
  player.xp = save.player?.stats?.xp ?? 0;
  player.maxHp = save.player?.stats?.maxHp ?? 20;
  player.hp = save.player?.stats?.hp ?? player.maxHp;
  player.hurtCooldown = 0;
  player.vel.set(0, 0, 0);

  // Garante chão sob o jogador antes do primeiro frame.
  world.loadAround(player.pos.x, player.pos.z, 2);
  if (!save.player) {
    player.pos.y = world.surfaceY(player.pos.x, player.pos.z);
  }

  // Fase 4: constrói vila e posiciona NPCs perto do spawn.
  buildVillage(world);
  villageNpcs = placeVillageNpcs(scene);

  // Fase 4: carrega quests e aceita iniciais.
  questLog.fromSave(save.player?.quests);
  questLog.onUpdate = () => hud.setQuestStates(questLog.getActive());
  questLog.onToast = (msg) => hud.toast(msg, "#cfeeb0");
  questLog.autoAccept();
  hud.setQuestStates(questLog.getActive());

  // Fase 4: introdução na primeira vez.
  introShown = save.player?.introShown ?? false;
  if (!introShown) {
    playing = true; // precisa estar true para o frame rodar
    captions.play(
      [
        "Você acorda em uma terra fragmentada, onde a luz do sol mal toca as ruínas antigas...",
        "Era uma vez um reino próspero, até que criaturas de pedra e sombra tomaram as minas.",
        "A vila ao leste precisa de um herói. Sua jornada começa agora.",
        "Objetivo: encontre a vila e fale com o Ancião.",
      ],
      () => {
        introShown = true;
        input.requestLock();
      }
    );
  } else {
    input.requestLock();
  }

  // Fase 4: boss regional fixo (Golem Ancião ao norte, ~180m).
  const bossPos = new THREE.Vector3(player.pos.x, 0, player.pos.z - 180);
  world.loadAround(bossPos.x, bossPos.z, 2);
  bossPos.y = world.surfaceY(bossPos.x, bossPos.z);
  if (bossPos.y > 0) {
    bossMob = new Mob(ANCIENT_GOLEM, 5, bossPos);
    scene.add(bossMob.group);
  }

  spawner = new Spawner(scene, world);
  attackCooldown = 0;
  autosaveTimer = 0;
  miningTarget = null;
  miningProgress = 0;
  playing = true;
  hud.show();
  hud.updateHotbar();
}

function stopWorld(): void {
  playing = false;
  spawner?.dispose();
  spawner = null;
  floatingText.dispose();
  world?.dispose();
  world = null;
  activeWorld = null;
  generator = null;
  highlight.visible = false;
  hud.hide();
  captions.dispose();
  for (const npc of villageNpcs) scene.remove(npc.group);
  villageNpcs = [];
  if (bossMob) {
    scene.remove(bossMob.group);
    bossMob.dispose();
    bossMob = null;
  }
}

async function persist(): Promise<void> {
  if (!world || !activeWorld) return;
  const playerSave: PlayerSave = {
    pos: [player.pos.x, player.pos.y, player.pos.z],
    yaw: player.yaw,
    pitch: player.pitch,
    inventory: inventory.toSave(),
    stats: { hp: player.hp, maxHp: player.maxHp, level: player.level, xp: player.xp },
    quests: questLog.toSave(),
    introShown,
  };
  await saveWorld(activeWorld.id, playerSave, world.modifiedData);
}

// ---------- Interação com blocos ----------

function handleBlockInteraction(dt: number): void {
  if (!world) return;

  const cp = Math.cos(player.pitch);
  const dir = new THREE.Vector3(
    -Math.sin(player.yaw) * cp,
    Math.sin(player.pitch),
    -Math.cos(player.yaw) * cp
  );
  // Fase 3: mob na mira tem prioridade sobre mineração no clique esquerdo.
  // Fase 4: inclui o boss regional no raycast.
  const eye = player.eyePosition();
  let mobTarget = spawner?.raycast(eye, dir, PLAYER_ATTACK_RANGE) ?? null;
  if (!mobTarget && bossMob && !bossMob.dead) {
    const t = bossMob.raycast(eye, dir, PLAYER_ATTACK_RANGE);
    if (t !== null) mobTarget = bossMob;
  }
  if (mobTarget) {
    resetMining();
    if (input.isMouseDown(0) && attackCooldown <= 0) {
      attackMob(mobTarget);
    }
    highlight.visible = false;
    return;
  }

  const hit = raycastVoxel(eye, dir, REACH, world);

  if (!hit) {
    highlight.visible = false;
    resetMining();
    return;
  }
  highlight.visible = true;
  highlight.position.set(hit.block.x + 0.5, hit.block.y + 0.5, hit.block.z + 0.5);

  const targetId = world.getBlock(hit.block.x, hit.block.y, hit.block.z);
  const target = BLOCKS[targetId];

  // Esquerdo: segurar para quebrar com dureza/ferramenta.
  if (input.isMouseDown(0)) {
    if (!miningTarget ||
      miningTarget.x !== hit.block.x ||
      miningTarget.y !== hit.block.y ||
      miningTarget.z !== hit.block.z) {
      resetMining();
      miningTarget = { x: hit.block.x, y: hit.block.y, z: hit.block.z };
    }

    if (target.breakable) {
      const breakTime = computeBreakTime(targetId);
      miningProgress += dt / breakTime;
      hud.setBreakProgress(miningProgress);

      if (miningProgress >= 1) {
        breakBlock(hit.block.x, hit.block.y, hit.block.z, targetId);
        resetMining();
      }
    } else {
      resetMining();
    }
  } else {
    resetMining();
  }

  // Direito: colocar o bloco segurado na hotbar.
  if (input.clicked(2)) {
    const hand = inventory.hand;
    const p = hit.previous;
    const occupied = world.getBlock(p.x, p.y, p.z);
    if (
      hand?.placeBlock &&
      (occupied === Block.Air || occupied === Block.Water) &&
      !player.intersectsBlock(p.x, p.y, p.z)
    ) {
      world.setBlock(p.x, p.y, p.z, hand.placeBlock);
      inventory.consumeHand();
      hud.updateHotbar();
    }
  }
}

function computeBreakTime(blockId: Block): number {
  const def = BLOCKS[blockId];
  const hand = inventory.hand;
  let power = HAND_BREAK_SPEED;
  let correctTool = false;

  if (hand?.tool && def.tool && hand.tool.type === def.tool && hand.tool.tier >= def.minTier) {
    power = hand.tool.power;
    correctTool = true;
  }

  // Ferramenta errada: penalidade severa; mãos nuas em bloco que precisa de ferramenta: ainda pior.
  if (def.tool && (!hand?.tool || hand.tool.type !== def.tool || hand.tool.tier < def.minTier)) {
    power = correctTool ? power : hand?.tool ? 0.2 : 0.05;
  }

  return Math.max(0.05, def.hardness / power);
}

function breakBlock(x: number, y: number, z: number, blockId: Block): void {
  if (!world) return;
  const drop = blockDrop(blockId);
  if (drop) {
    const leftover = inventory.add(drop, 1);
    if (leftover > 0) {
      // Futuro: criar item entity no mundo.
    }
    hud.updateHotbar();
    // Fase 4: evento de coleta para quests.
    questLog.handleEvent({ type: "blockMined", target: drop });
  }
  world.setBlock(x, y, z, Block.Air);
}

function resetMining(): void {
  miningTarget = null;
  miningProgress = 0;
  hud.hideBreakOverlay();
}

// ---------- Combate (Fase 3) ----------

function attackMob(mob: Mob): void {
  attackCooldown = PLAYER_ATTACK_COOLDOWN;
  const hand = inventory.hand;
  const { damage, crit } = rollPlayerDamage(hand?.damage, player.strength);
  const died = mob.hurt(damage, player.pos);

  const textPos = mob.pos.clone().add(new THREE.Vector3(0, mob.def.height + 0.2, 0));
  floatingText.spawn(textPos, `${damage}${crit ? "!" : ""}`, crit ? "#ffd75a" : "#ffffff", crit);

  if (died) onMobKilled(mob);
}

function onMobKilled(mob: Mob): void {
  // XP com número flutuante e possível level up.
  const xp = scaledXp(mob.def, mob.level);
  const ups = player.addXp(xp);
  floatingText.spawn(
    mob.pos.clone().add(new THREE.Vector3(0, mob.def.height + 0.7, 0)),
    `+${xp} XP`,
    "#9be06a"
  );
  if (ups > 0) {
    hud.toast(`⭐ Nível ${player.level}! Vida máxima +${ups * 4}`, "#ffd75a");
  }

  // Loot direto para o inventário, com aviso colorido por raridade.
  for (const drop of rollLoot(mob.def.lootTable, mob.level)) {
    const leftover = inventory.add(drop.item, drop.count);
    const got = drop.count - leftover;
    if (got > 0) {
      hud.toast(`+${got} ${ITEMS[drop.item].name}`, RARITY_COLORS[drop.rarity]);
    }
  }
  hud.updateHotbar();

  // Fase 4: evento de morte de mob para quests.
  questLog.handleEvent({ type: "mobKilled", target: mob.def.id });
}

/** Mob acertou o jogador (callback do spawner). */
function onPlayerAttacked(mob: Mob, damage: number): void {
  const knock = player.pos.clone().sub(mob.pos).setY(0).normalize();
  const died = player.takeDamage(damage, knock);
  if (player.hurtCooldown === 0.6) {
    // Dano de fato aplicado (não estava invulnerável).
    hud.flashHurt();
    floatingText.spawn(player.eyePosition().add(new THREE.Vector3(0, 0.4, 0)), `-${damage}`, "#ff6a5a");
  }
  if (died) respawnPlayer();
}

function respawnPlayer(): void {
  if (!world) return;
  hud.toast("☠ Você morreu! Renascendo no ponto inicial…", "#ff6a5a");
  player.pos.set(CHUNK_X / 2 + 0.5, 60, CHUNK_Z / 2 + 0.5);
  world.loadAround(player.pos.x, player.pos.z, 2);
  player.pos.y = world.surfaceY(player.pos.x, player.pos.z);
  player.respawn();
}

// ---------- Loop ----------

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (playing && world) {
    // Inventário/crafting (também funciona com pointer lock liberado).
    if (input.pressed("KeyE")) {
      if (hud.isInventoryOpen()) {
        hud.returnHeld();
        hud.toggleInventory();
      } else {
        hud.toggleInventory();
      }
    }

    if (input.locked && !hud.isInventoryOpen() && !hud.isQuestLogOpen()) {
      if (input.clicked(0)) playerModel.triggerSwing();
      if (input.pressed("KeyF")) {
        if (interactNpc(player.pos, villageNpcs, questLog, captions)) {
          // NPC abriu diálogo: libera pointer lock para clicar nas legendas.
          document.exitPointerLock?.();
        }
      }
      if (input.pressed("KeyV")) cameraController.toggle();
      if (input.pressed("KeyL")) hud.toggleQuestLog();

      // Seleção da hotbar (teclas 1–9).
      for (let i = 0; i < HOTBAR_SIZE; i++) {
        if (input.pressed(`Digit${i + 1}`)) {
          inventory.selectHotbar(i);
          hud.updateHotbar();
        }
      }
      if (input.scrollDelta !== 0) {
        inventory.scroll(input.scrollDelta);
        hud.updateHotbar();
      }

      player.update(dt, input, world.solidAt, world.fluidAt);

      // Respawn se cair no void (não deveria acontecer com bedrock, mas por via das dúvidas).
      if (player.pos.y < -12) {
        player.pos.y = world.surfaceY(player.pos.x, player.pos.z);
        player.vel.set(0, 0, 0);
      }

      attackCooldown = Math.max(0, attackCooldown - dt);
      handleBlockInteraction(dt);
      cameraController.update(player, world.solidAt);
    }

    // Fase 3: mobs (FSM/spawn/despawn), regen e números de dano.
    player.tickStats(dt);
    const isNight = dayNight.timeOfDay > 0.27 && dayNight.timeOfDay < 0.73;
    spawner?.update(
      dt,
      {
        playerPos: player.pos,
        playerAlive: player.hp > 0,
        solid: world.solidAt,
        attackPlayer: onPlayerAttacked,
      },
      isNight
    );
    // Fase 4: boss regional (update separado, não spawna naturalmente).
    if (bossMob && !bossMob.dead) {
      bossMob.update(dt, {
        playerPos: player.pos,
        playerAlive: player.hp > 0,
        solid: world.solidAt,
        attackPlayer: onPlayerAttacked,
      });
      if (bossMob.finished) {
        scene.remove(bossMob.group);
        bossMob.dispose();
        bossMob = null;
      }
    }
    floatingText.update(dt);

    dayNight.update(dt);
    world.update(player.pos.x, player.pos.z);
    hud.update(
      dt,
      player,
      cameraController.firstPerson,
      generator!.biomeAt(Math.floor(player.pos.x), Math.floor(player.pos.z)),
      dayNight.timeOfDay,
      formatTime(dayNight.timeOfDay)
    );

    // Posiciona/anima o modelo do jogador (oculto em 1ª pessoa).
    playerModel.update(player, dt);
    playerModel.group.visible = !cameraController.firstPerson;
    playerModel.setHeldItem(
      inventory.hand,
      scene,
      camera,
      cameraController.firstPerson
    );

    // Autosave periódico (doc §4.8).
    autosaveTimer += dt;
    if (autosaveTimer >= AUTOSAVE_INTERVAL) {
      autosaveTimer = 0;
      void persist();
    }
  }

  input.endFrame();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- Resize ---
function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// --- Helpers ---

/** Textura de céu em gradiente vertical (barato e agradável). */
function makeSkyTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#8fc7ff");
  grad.addColorStop(1, "#cfe8ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
