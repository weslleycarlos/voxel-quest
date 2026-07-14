import * as THREE from "three";
import { CHUNK_X, CHUNK_Z } from "../world/chunk.ts";
import { ChunkManager, RENDER_DISTANCE } from "../world/chunkManager.ts";
import { TerrainGenerator } from "../world/terrainGen.ts";
import { raycastVoxel } from "../world/raycast.ts";
import { createDetailTexture } from "../world/textures.ts";
import { Block, BLOCKS, PLACEABLE_BLOCKS } from "../world/blocks.ts";
import { Input } from "./input.ts";
import { CameraController } from "./camera.ts";
import { Player } from "../entities/player.ts";
import { createPlayerModel } from "../entities/playerModel.ts";
import { Hud } from "../ui/hud.ts";
import { TitleScreen } from "../screens/titleScreen.ts";
import { loadWorldSave, saveWorld, type PlayerSave } from "../save/saveManager.ts";
import type { WorldMeta } from "../save/worldRegistry.ts";

/**
 * Bootstrap e game loop (doc §3 /core/main.ts). Fase 1 — Mundo:
 * tela inicial com múltiplos mundos, chunks dinâmicos ao redor do jogador,
 * terreno procedural por seed (biomas + cavernas), quebrar/colocar blocos com
 * rebuild localizado, física de água (nado) e autosave em IndexedDB.
 */

const SKY_TOP = 0x8fc7ff;
const SKY_BOTTOM = 0xcfe8ff;
const FOG_COLOR = 0xbfe0ff;
const REACH = 6; // alcance de interação com blocos
const AUTOSAVE_INTERVAL = 30; // s (doc §4.8)

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(FOG_COLOR);

const scene = new THREE.Scene();
const viewDist = RENDER_DISTANCE * CHUNK_X;
scene.fog = new THREE.Fog(FOG_COLOR, viewDist * 0.55, viewDist * 0.95);
scene.background = makeSkyTexture();

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.05,
  600
);

// --- Iluminação suave (sem sombras dinâmicas, doc §5) ---
const hemi = new THREE.HemisphereLight(0xdff1ff, 0x556644, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.7);
sun.position.set(0.5, 1, 0.3);
scene.add(sun);

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
scene.add(playerModel);

const cameraController = new CameraController(camera);
const input = new Input(canvas);
const hud = new Hud();

// --- Estado do mundo ativo ---
let world: ChunkManager | null = null;
let activeWorld: WorldMeta | null = null;
let generator: TerrainGenerator | null = null;
let selectedBlock: Block = PLACEABLE_BLOCKS[0];
let autosaveTimer = 0;
let playing = false;

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
  selectedBlock = PLACEABLE_BLOCKS[0];
  hud.setSelectedBlock(selectedBlock);

  if (save.player) {
    player.pos.set(...save.player.pos);
    player.yaw = save.player.yaw;
    player.pitch = save.player.pitch;
  } else {
    player.pos.set(CHUNK_X / 2 + 0.5, 60, CHUNK_Z / 2 + 0.5);
    player.yaw = 0;
    player.pitch = 0;
  }
  player.vel.set(0, 0, 0);

  // Garante chão sob o jogador antes do primeiro frame.
  world.loadAround(player.pos.x, player.pos.z, 2);
  if (!save.player) {
    player.pos.y = world.surfaceY(player.pos.x, player.pos.z);
  }

  autosaveTimer = 0;
  playing = true;
  input.requestLock();
  hud.show();
}

function stopWorld(): void {
  playing = false;
  world?.dispose();
  world = null;
  activeWorld = null;
  generator = null;
  highlight.visible = false;
  hud.hide();
}

async function persist(): Promise<void> {
  if (!world || !activeWorld) return;
  const playerSave: PlayerSave = {
    pos: [player.pos.x, player.pos.y, player.pos.z],
    yaw: player.yaw,
    pitch: player.pitch,
  };
  await saveWorld(activeWorld.id, playerSave, world.modifiedData);
}

// ---------- Interação com blocos ----------

function handleBlockInteraction(): void {
  if (!world) return;

  const cp = Math.cos(player.pitch);
  const dir = new THREE.Vector3(
    -Math.sin(player.yaw) * cp,
    Math.sin(player.pitch),
    -Math.cos(player.yaw) * cp
  );
  const hit = raycastVoxel(player.eyePosition(), dir, REACH, world);

  if (!hit) {
    highlight.visible = false;
    return;
  }
  highlight.visible = true;
  highlight.position.set(hit.block.x + 0.5, hit.block.y + 0.5, hit.block.z + 0.5);

  // Esquerdo: quebrar (instantâneo na Fase 1; dureza/ferramentas na Fase 2).
  if (input.clicked(0)) {
    const target = world.getBlock(hit.block.x, hit.block.y, hit.block.z);
    if (BLOCKS[target].breakable) {
      world.setBlock(hit.block.x, hit.block.y, hit.block.z, Block.Air);
    }
  }

  // Direito: colocar o bloco selecionado na célula anterior ao impacto.
  if (input.clicked(2)) {
    const p = hit.previous;
    const occupied = world.getBlock(p.x, p.y, p.z);
    if (
      (occupied === Block.Air || occupied === Block.Water) &&
      !player.intersectsBlock(p.x, p.y, p.z)
    ) {
      world.setBlock(p.x, p.y, p.z, selectedBlock);
    }
  }
}

// ---------- Loop ----------

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (playing && world) {
    if (input.locked) {
      if (input.pressed("KeyV")) cameraController.toggle();

      // Seleção da hotbar (teclas 1–7).
      for (let i = 0; i < PLACEABLE_BLOCKS.length; i++) {
        if (input.pressed(`Digit${i + 1}`)) {
          selectedBlock = PLACEABLE_BLOCKS[i];
          hud.setSelectedBlock(selectedBlock);
        }
      }

      player.update(dt, input, world.solidAt, world.fluidAt);

      // Respawn se cair no void (não deveria acontecer com bedrock, mas por via das dúvidas).
      if (player.pos.y < -12) {
        player.pos.y = world.surfaceY(player.pos.x, player.pos.z);
        player.vel.set(0, 0, 0);
      }

      handleBlockInteraction();
      cameraController.update(player, world.solidAt);
      hud.update(
        dt,
        player,
        cameraController.firstPerson,
        generator!.biomeAt(Math.floor(player.pos.x), Math.floor(player.pos.z))
      );

      // Autosave periódico (doc §4.8).
      autosaveTimer += dt;
      if (autosaveTimer >= AUTOSAVE_INTERVAL) {
        autosaveTimer = 0;
        void persist();
      }
    }

    world.update(player.pos.x, player.pos.z);

    // Posiciona/orienta o modelo do jogador (oculto em 1ª pessoa).
    playerModel.position.copy(player.pos);
    playerModel.rotation.y = player.yaw;
    playerModel.visible = !cameraController.firstPerson;
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
  grad.addColorStop(0, `#${SKY_TOP.toString(16).padStart(6, "0")}`);
  grad.addColorStop(1, `#${SKY_BOTTOM.toString(16).padStart(6, "0")}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
