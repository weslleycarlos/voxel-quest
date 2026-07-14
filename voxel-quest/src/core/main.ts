import * as THREE from 'three';
import { ChunkManager } from '../world/chunkManager';
import { BlockIds } from '../world/blocks';

// Game state
const gameState = {
  scene: null as THREE.Scene | null,
  camera: null as THREE.PerspectiveCamera | null,
  renderer: null as THREE.WebGLRenderer | null,
  clock: new THREE.Clock(),
  chunkManager: null as ChunkManager | null,
  player: {
    x: 0,
    y: 30,
    z: 0,
    velocityY: 0,
    onGround: false,
  },
  keys: {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
  },
};

const GRAVITY = 30;
const JUMP_FORCE = 12;
const MOVE_SPEED = 8;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.3;

// Initialize Three.js scene
function init() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  
  // Scene
  gameState.scene = new THREE.Scene();
  gameState.scene.background = new THREE.Color(0x87ceeb);
  gameState.scene.fog = new THREE.Fog(0x87ceeb, 40, 80);

  // Camera (3rd person)
  gameState.camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  updateCamera(0);

  // Renderer
  gameState.renderer = new THREE.WebGLRenderer({ 
    canvas,
    antialias: true 
  });
  gameState.renderer.setSize(window.innerWidth, window.innerHeight);
  gameState.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  gameState.scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  gameState.scene.add(directionalLight);

  // Create chunk manager with seed
  const seed = Math.floor(Math.random() * 10000);
  console.log(`World seed: ${seed}`);
  gameState.chunkManager = new ChunkManager(gameState.scene!, seed);

  // Input handling
  setupInput();

  // Handle resize
  window.addEventListener('resize', onWindowResize);

  // Start game loop
  animate();

  console.log('Voxel Quest initialized!');
  console.log('Controls: WASD to move, SPACE to jump, Mouse to look');
}

function setupInput() {
  document.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyW': gameState.keys.forward = true; break;
      case 'KeyS': gameState.keys.backward = true; break;
      case 'KeyA': gameState.keys.left = true; break;
      case 'KeyD': gameState.keys.right = true; break;
      case 'Space': gameState.keys.jump = true; break;
    }
  });

  document.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': gameState.keys.forward = false; break;
      case 'KeyS': gameState.keys.backward = false; break;
      case 'KeyA': gameState.keys.left = false; break;
      case 'KeyD': gameState.keys.right = false; break;
      case 'Space': gameState.keys.jump = false; break;
    }
  });

  // Mouse look
  let yaw = 0;
  let pitch = 0;

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === document.getElementById('game-canvas')) {
      yaw -= e.movementX * 0.002;
      pitch -= e.movementY * 0.002;
      pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
      
      (gameState.camera as THREE.PerspectiveCamera).rotation.order = 'YXZ';
      (gameState.camera as THREE.PerspectiveCamera).rotation.y = yaw;
      (gameState.camera as THREE.PerspectiveCamera).rotation.x = pitch;
    }
  });

  document.getElementById('game-canvas')?.addEventListener('click', () => {
    document.getElementById('game-canvas')?.requestPointerLock();
  });
}

function updateCamera(delta: number) {
  if (!gameState.camera) return;
  
  const camera = gameState.camera as THREE.PerspectiveCamera;
  
  // 3rd person camera behind player
  const distance = 5;
  const height = 2;
  
  camera.position.x = gameState.player.x - Math.sin(camera.rotation.y) * distance;
  camera.position.z = gameState.player.z - Math.cos(camera.rotation.y) * distance;
  camera.position.y = gameState.player.y + height;
  
  camera.lookAt(
    gameState.player.x,
    gameState.player.y + PLAYER_HEIGHT,
    gameState.player.z
  );
}

function updatePlayer(delta: number) {
  const player = gameState.player;
  const keys = gameState.keys;
  
  // Get camera direction
  const camera = gameState.camera as THREE.PerspectiveCamera;
  const yaw = camera.rotation.y;
  
  // Movement
  let moveX = 0;
  let moveZ = 0;
  
  if (keys.forward) {
    moveX -= Math.sin(yaw);
    moveZ -= Math.cos(yaw);
  }
  if (keys.backward) {
    moveX += Math.sin(yaw);
    moveZ += Math.cos(yaw);
  }
  if (keys.left) {
    moveX -= Math.cos(yaw);
    moveZ += Math.sin(yaw);
  }
  if (keys.right) {
    moveX += Math.cos(yaw);
    moveZ -= Math.sin(yaw);
  }
  
  // Normalize movement
  const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
  if (length > 0) {
    moveX = (moveX / length) * MOVE_SPEED * delta;
    moveZ = (moveZ / length) * MOVE_SPEED * delta;
  }
  
  // Apply horizontal movement with collision
  player.x += moveX;
  player.z += moveZ;
  
  // Gravity and jumping
  if (player.onGround && keys.jump) {
    player.velocityY = JUMP_FORCE;
    player.onGround = false;
  } else {
    player.velocityY -= GRAVITY * delta;
  }
  
  // Apply vertical movement with collision
  const newY = player.y + player.velocityY * delta;
  
  // Simple ground collision
  const groundY = getGroundHeight(player.x, player.z);
  if (newY <= groundY) {
    player.y = groundY;
    player.velocityY = 0;
    player.onGround = true;
  } else {
    player.y = newY;
    player.onGround = false;
  }
  
  // Update chunks around player
  if (gameState.chunkManager) {
    gameState.chunkManager.updateChunksAroundPlayer(player.x, player.z);
  }
}

function getGroundHeight(x: number, z: number): number {
  if (!gameState.chunkManager) return 0;
  
  // Simple height check - in full implementation would check actual blocks
  return 25; // Temporary flat ground for testing
}

function onWindowResize() {
  if (!gameState.camera || !gameState.renderer) return;
  
  gameState.camera.aspect = window.innerWidth / window.innerHeight;
  gameState.camera.updateProjectionMatrix();
  gameState.renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  
  const delta = Math.min(gameState.clock.getDelta(), 0.1); // Cap delta to prevent large jumps
  
  updatePlayer(delta);
  updateCamera(delta);
  
  if (gameState.renderer && gameState.scene && gameState.camera) {
    gameState.renderer.render(gameState.scene, gameState.camera);
  }
}

// Start the game
init();
