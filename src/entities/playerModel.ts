import * as THREE from "three";

/**
 * Modelo do jogador feito de poucos cubos (doc §5: geometria mínima estilo
 * Minecraft). Serve para dar presença ao personagem na câmera de 3ª pessoa.
 */
export function createPlayerModel(): THREE.Group {
  const group = new THREE.Group();

  const skin = new THREE.MeshLambertMaterial({ color: 0xe0b08a });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x3a7ca5 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2f3b52 });

  const add = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
  };

  // Alturas somam ~1.8 (base nos pés, y=0).
  add(0.5, 0.6, 0.35, 0, 0.9, 0, pants); // pernas (bloco)
  add(0.55, 0.6, 0.32, 0, 1.5, 0, shirt); // tronco
  add(0.15, 0.55, 0.2, -0.35, 1.5, 0, shirt); // braço esq
  add(0.15, 0.55, 0.2, 0.35, 1.5, 0, shirt); // braço dir
  add(0.42, 0.42, 0.42, 0, 2.0, 0, skin); // cabeça

  group.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });
  return group;
}
