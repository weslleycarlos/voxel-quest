import * as THREE from "three";
import type { Player } from "./player.ts";
import type { ItemDef } from "../items/item.ts";

/**
 * Modelo do jogador feito de poucos cubos (doc §5: geometria mínima estilo
 * Minecraft), agora articulado: braços e pernas pivotam no ombro/quadril e
 * balançam ao andar, com bob sutil do corpo e rotação suavizada — corrige o
 * visual de "boneco duro" e o modelo flutuando acima do chão da Fase 2.
 *
 * Fase 4 polimento:
 * - Braços levantam ao pular (evita clipping no torso) e gap aumentado.
 * - Item segurado (ferramenta/bloco) aparece na mão direita em 3ª pessoa e
 *   como viewmodel na tela em 1ª pessoa.
 */

export interface PlayerModel {
  group: THREE.Group;
  update(player: Player, dt: number): void;
  setHeldItem(
    item: ItemDef | null,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    firstPerson: boolean
  ): void;
  triggerSwing(): void;
}

/** Cubo com o pivô no TOPO (para membros que balançam a partir da junta). */
function limb(w: number, h: number, d: number, mat: THREE.Material): THREE.Group {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.y = -h / 2;
  pivot.add(mesh);
  return pivot;
}

function parseItemColor(color: string): number {
  return parseInt(color.replace("#", ""), 16);
}

/** Constrói um mesh simples representando o item segurado. */
function createItemMesh(item: ItemDef): THREE.Group {
  const g = new THREE.Group();
  const color = parseItemColor(item.color);
  const mat = new THREE.MeshLambertMaterial({ color });

  if (item.tool?.type === "pickaxe") {
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.28, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x8b5a2b })
    );
    handle.position.y = -0.1;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.07, 0.04),
      mat
    );
    head.position.y = 0.06;
    g.add(handle, head);
  } else if (item.tool?.type === "sword") {
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.2, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x8b5a2b })
    );
    handle.position.y = -0.08;
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.03, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x553322 })
    );
    guard.position.y = 0.03;
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.24, 0.025),
      mat
    );
    blade.position.y = 0.16;
    g.add(handle, guard, blade);
  } else {
    // Bloco ou recurso: cubinho colorido
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.14),
      mat
    );
    g.add(mesh);
  }
  return g;
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

  // Braços com gap maior do torso para evitar clipping ao rotacionar
  const armL = limb(0.16, 0.62, 0.2, shirt);
  armL.position.set(-0.38, 1.38, 0);
  const armR = limb(0.16, 0.62, 0.2, shirt);
  armR.position.set(0.38, 1.38, 0);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.62;

  body.add(legL, legR, torso, armL, armR, head);

  let walkPhase = 0;
  let smoothYaw = 0;
  let yawInit = false;
  let airLean = 0;

  // --- Animação de ataque (swing) ---
  let attackSwing = 0; // 1..0 decrescente
  const ATTACK_DURATION = 0.28;

  // --- Item segurado ---
  let heldItem3P: THREE.Group | null = null;
  let heldItem1P: THREE.Group | null = null;
  let currentItemId: string | null = null;

  function clearHeld(): void {
    if (heldItem3P) {
      armR.remove(heldItem3P);
      heldItem3P = null;
    }
    if (heldItem1P) {
      heldItem1P.parent?.remove(heldItem1P);
      heldItem1P = null;
    }
  }

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

    const s = Math.sin(walkPhase * Math.PI) * swing;
    const ease = Math.min(1, 14 * dt);

    // No ar/água: pernas levemente dobradas e braços levantados/abertos.
    const targetLean = player.onGround || player.inWater ? 0 : 1;
    airLean += (targetLean - airLean) * Math.min(1, 8 * dt);
    const armRaise = airLean * 0.9; // levanta braços ao pular (evita clipping)

    // Animação de ataque: braço direito sobe e desce rapidamente.
    let attackOffset = 0;
    let attackZ = 0;
    if (attackSwing > 0) {
      const t = 1 - attackSwing; // 0..1 durante o swing
      attackOffset = -Math.sin(t * Math.PI) * 1.35; // sobe bastante
      attackZ = Math.sin(t * Math.PI * 2) * 0.15; // leve torção
      attackSwing = Math.max(0, attackSwing - dt / ATTACK_DURATION);
    }

    legL.rotation.x += (s * 0.75 - airLean * 0.35 - legL.rotation.x) * ease;
    legR.rotation.x += (-s * 0.75 - airLean * 0.25 - legR.rotation.x) * ease;
    armL.rotation.x += (-s * 0.6 + armRaise - armL.rotation.x) * ease;
    armR.rotation.x += (s * 0.6 + armRaise + attackOffset - armR.rotation.x) * ease;

    // Abertura lateral dos braços no ar é mais sutil e reduzida durante a caminhada
    armL.rotation.z = (1 - swing) * airLean * 0.25;
    armR.rotation.z = -(1 - swing) * airLean * 0.25 + attackZ;

    // Viewmodel 1P balança junto com o ataque
    if (heldItem1P && attackSwing > 0) {
      const t = 1 - attackSwing;
      heldItem1P.position.x = 0.35 + Math.sin(t * Math.PI) * 0.15;
      heldItem1P.position.y = -0.4 + Math.sin(t * Math.PI) * 0.25;
      heldItem1P.rotation.x = -0.5 + Math.sin(t * Math.PI) * -0.8;
    }

    // Bob sutil do corpo ao andar (2 passos por ciclo).
    body.position.y = Math.abs(Math.sin(walkPhase * Math.PI)) * swing * 0.05;
    body.rotation.x = swing * 0.06;
  }

  function triggerSwing(): void {
    attackSwing = 1;
  }

  function setHeldItem(
    item: ItemDef | null,
    _scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    firstPerson: boolean
  ): void {
    if (!item) {
      if (currentItemId !== null) {
        clearHeld();
        currentItemId = null;
      }
      return;
    }

    if (item.id !== currentItemId) {
      clearHeld();
      currentItemId = item.id;

      const mesh = createItemMesh(item);

      // 3ª pessoa: anexado à mão direita
      heldItem3P = mesh.clone();
      heldItem3P.position.set(0, -0.62, 0.08);
      heldItem3P.rotation.set(-0.4, 0, 0);
      armR.add(heldItem3P);

      // 1ª pessoa: viewmodel anexado à câmera
      heldItem1P = mesh.clone();
      heldItem1P.position.set(0.35, -0.4, -0.6);
      heldItem1P.rotation.set(-0.5, 0.7, 0.1);
      camera.add(heldItem1P);
    }

    if (heldItem3P) heldItem3P.visible = !firstPerson;
    if (heldItem1P) heldItem1P.visible = firstPerson;
  }

  return { group, update, setHeldItem, triggerSwing };
}
