import * as THREE from "three";

/**
 * Textura de detalhe grayscale gerada por código (sem assets externos). É
 * multiplicada pela cor de vértice (cor do bloco × AO × sombreamento), dando
 * granulação pixel-art às faces. RepeatWrapping + UV em unidades de mundo faz o
 * padrão se repetir por bloco, independente do tamanho do quad do greedy mesh.
 */
export function createDetailTexture(): THREE.Texture {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Ruído determinístico em tons de cinza próximos do branco (para não escurecer
  // demais a cor base do bloco).
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const shade = 205 + Math.floor(rand() * 50); // 205–255
    img.data[i * 4 + 0] = shade;
    img.data[i * 4 + 1] = shade;
    img.data[i * 4 + 2] = shade;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
