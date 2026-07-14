import * as THREE from "three";
import type { Player, SolidAt } from "../entities/player.ts";

/**
 * Câmera em 3ª pessoa com colisão contra voxels (doc §1, §3 /core/camera.ts),
 * com alternância para 1ª pessoa. Em 3ª pessoa orbita atrás da cabeça do jogador;
 * um raycast simples puxa a câmera para perto quando há bloco entre ela e o alvo.
 */
export class CameraController {
  firstPerson = false;
  private distance = 5;
  private readonly minDistance = 1.2;

  constructor(public camera: THREE.PerspectiveCamera) {}

  toggle(): void {
    this.firstPerson = !this.firstPerson;
  }

  update(player: Player, solid: SolidAt): void {
    // Vetor de visão a partir de yaw/pitch.
    const cp = Math.cos(player.pitch);
    const forward = new THREE.Vector3(
      -Math.sin(player.yaw) * cp,
      Math.sin(player.pitch),
      -Math.cos(player.yaw) * cp
    );

    if (this.firstPerson) {
      const eye = player.eyePosition();
      this.camera.position.copy(eye);
      this.camera.lookAt(eye.clone().add(forward));
      return;
    }

    // Alvo um pouco acima da cabeça.
    const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.9, player.pos.z);

    // Distância desejada, reduzida se houver bloco no caminho (colisão de câmera).
    let dist = this.distance;
    const step = 0.1;
    for (let t = this.minDistance; t <= this.distance; t += step) {
      const px = target.x - forward.x * t;
      const py = target.y - forward.y * t;
      const pz = target.z - forward.z * t;
      if (solid(Math.floor(px), Math.floor(py), Math.floor(pz))) {
        dist = Math.max(this.minDistance, t - step);
        break;
      }
    }

    this.camera.position.set(
      target.x - forward.x * dist,
      target.y - forward.y * dist,
      target.z - forward.z * dist
    );
    this.camera.lookAt(target);
  }
}
