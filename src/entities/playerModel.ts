import * as THREE from "three";
import type { Player } from "./player.ts";

/**
 * Modelo do jogador feito de poucos cubos (doc §5: geometria mínima estilo
 * Minecraft), agora articulado: braços e pernas pivotam no ombro/quadril e
 * balançam ao andar, com bob sutil do corpo e rotação suavizada — corrige o
 * visual de "boneco duro" e o modelo flutuando acima do chão da Fase 2.
 */

export interface PlayerModel {
  group: THREE.Group;
  update(player: Player, dt: number): void;
}

/** Cubo com o pivô no TOPO (para membros que balançam a partir da junta). */
function limb(w: number, h: number, d: number, mat: THREE.Material): THREE.Group {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.y = -h / 2;
  pivot.add(mesh);
  return pivot;
}

export function createPlayerModel(): PlayerModel {
  const group = new THREE.Group();
  const body = new THREE.Group(); // recebe o bob vertical
  group.add(body);

  const skin = new THREE.MeshLambertMaterial({ color: 0xe0b08a });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x3a7ca5 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2f3b52 });

  // Proporções (total ~1.8, pés em y=0): pernas 0.8, tronco 0.6, cabeça 0.4.
  const legL = limb(0.22, 0.8, 0.26, pants);
  legL.position.set(-0.13, 0.8, 0);
  const legR = limb(0.22, 0.8, 0.26, pants);
  legR.position.set(0.13, 0.8, 0);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.6, 0.3), shirt);
  torso.position.y = 1.1;

  const armL = limb(0.16, 0.62, 0.2, shirt);
  armL.position.set(-0.36, 1.38, 0);
  const armR = limb(0.16, 0.62, 0.2, shirt);
  armR.position.set(0.36, 1.38, 0);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.62;

  body.add(legL, legR, torso, armL, armR, head);

  let walkPhase = 0;
  let smoothYaw = 0;
  let yawInit = false;
  let airLean = 0;

  function update(player: Player, dt: number): void {
    group.position.copy(player.pos);

    // Rotação suavizada (o corpo "persegue" o yaw da câmera em vez de travar).
    if (!yawInit) {
      smoothYaw = player.yaw;
      yawInit = true;
    }
    let delta = player.yaw - smoothYaw;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    smoothYaw += delta * Math.min(1, 12 * dt);
    group.rotation.y = smoothYaw;

    // Velocidade horizontal dita a passada.
    const speed = Math.hypot(player.vel.x, player.vel.z);
    const moving = speed > 0.3;
    walkPhase += speed * 1.7 * dt;
    const swing = moving ? Math.min(1, speed / 4.5) : 0;

    // Alvo dos membros; parado, volta suave ao neutro.
    const s = Math.sin(walkPhase * Math.PI) * swing;
    const ease = Math.min(1, 14 * dt);
    legL.rotation.x += (s * 0.75 - legL.rotation.x) * ease;
    legR.rotation.x += (-s * 0.75 - legR.rotation.x) * ease;
    armL.rotation.x += (-s * 0.6 - armL.rotation.x) * ease;
    armR.rotation.x += (s * 0.6 - armR.rotation.x) * ease;

    // No ar/água: pernas levemente dobradas e braços abertos.
    const targetLean = player.onGround || player.inWater ? 0 : 1;
    airLean += (targetLean - airLean) * Math.min(1, 8 * dt);
    legL.rotation.x -= airLean * 0.35;
    legR.rotation.x -= airLean * 0.25;
    armL.rotation.z = airLean * 0.3;
    armR.rotation.z = -airLean * 0.3;

    // Bob sutil do corpo ao andar (2 passos por ciclo).
    body.position.y = Math.abs(Math.sin(walkPhase * Math.PI)) * swing * 0.05;
    body.rotation.x = swing * 0.06;
  }

  return { group, update };
}
