import * as THREE from "three";
import { Chunk, generateChunk, CHUNK_X, CHUNK_Z } from "../world/chunk.ts";
import { buildChunkGeometry } from "../world/mesher.ts";
import { createDetailTexture } from "../world/textures.ts";
import { isSolid } from "../world/blocks.ts";
import { Input } from "./input.ts";
import { CameraController } from "./camera.ts";
import { Player, type SolidAt } from "../entities/player.ts";
import { createPlayerModel } from "../entities/playerModel.ts";
import { Hud } from "../ui/hud.ts";

/**
 * Bootstrap e game loop (doc §3 /core/main.ts). Fase 0 — Fundação:
 * um chunk renderizado + câmera 3ª/1ª pessoa + movimento WASD com colisão e
 * gravidade. Elementos visuais: céu em gradiente, névoa, luz suave (hemisférica +
 * direcional) e o chunk assado com greedy meshing + oclusão de ambiente.
 */

const SKY_TOP = 0x8fc7ff;
const SKY_BOTTOM = 0xcfe8ff;
const FOG_COLOR = 0xbfe0ff;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(FOG_COLOR);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(FOG_COLOR, 24, 70);
scene.background = makeSkyTexture();

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.05,
  400
);

// --- Iluminação suave (sem sombras dinâmicas, doc §5) ---
const hemi = new THREE.HemisphereLight(0xdff1ff, 0x556644, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.7);
sun.position.set(0.5, 1, 0.3);
scene.add(sun);

// --- Mundo: um único chunk (Fase 0) ---
const chunk = new Chunk();
generateChunk(chunk);

const geometry = buildChunkGeometry(chunk);
const material = new THREE.MeshBasicMaterial({
  vertexColors: true,
  map: createDetailTexture(),
  fog: true,
});
const chunkMesh = new THREE.Mesh(geometry, material);
scene.add(chunkMesh);

// Chão-guia sutil sob o void, ajuda a perceber a borda do chunk.
const gridHelper = new THREE.GridHelper(64, 8, 0x88aacc, 0x6688aa);
gridHelper.position.set(CHUNK_X / 2, 0.02, CHUNK_Z / 2);
(gridHelper.material as THREE.Material).transparent = true;
(gridHelper.material as THREE.Material).opacity = 0.15;
scene.add(gridHelper);

// --- Colisão compartilhada (voxel sólido) ---
const solidAt: SolidAt = (bx, by, bz) => isSolid(chunk.get(bx, by, bz));

// --- Jogador ---
const player = new Player();
// Nasce sobre a superfície central.
player.pos.set(CHUNK_X / 2, dropHeight(CHUNK_X / 2, CHUNK_Z / 2), CHUNK_Z / 2);

const playerModel = createPlayerModel();
scene.add(playerModel);

// --- Câmera, input, HUD ---
const cameraController = new CameraController(camera);
const input = new Input(canvas);
const hud = new Hud();

// --- Overlay (entrar / pausa) ---
const overlay = document.getElementById("overlay")!;
const playBtn = document.getElementById("playBtn")!;
playBtn.addEventListener("click", () => input.requestLock());
document.addEventListener("pointerlockchange", () => {
  if (input.locked) {
    overlay.classList.add("hidden");
    hud.show();
  } else {
    overlay.classList.remove("hidden");
    hud.hide();
  }
});

// --- Loop ---
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (input.locked) {
    if (input.pressed("KeyV")) cameraController.toggle();
    player.update(dt, input, solidAt);

    // Respawn se cair no void (chunk único não tem chão infinito).
    if (player.pos.y < -12) {
      player.pos.set(CHUNK_X / 2, dropHeight(CHUNK_X / 2, CHUNK_Z / 2), CHUNK_Z / 2);
      player.vel.set(0, 0, 0);
    }

    cameraController.update(player, solidAt);
    hud.update(dt, player, cameraController.firstPerson);
  }

  // Posiciona/orienta o modelo do jogador (oculto em 1ª pessoa).
  playerModel.position.copy(player.pos);
  playerModel.rotation.y = player.yaw;
  playerModel.visible = !cameraController.firstPerson;

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

/** Altura de spawn: primeiro bloco de ar acima da coluna. */
function dropHeight(x: number, z: number): number {
  for (let y = 63; y >= 0; y--) {
    if (isSolid(chunk.get(Math.floor(x), y, Math.floor(z)))) return y + 1.05;
  }
  return 40;
}

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
