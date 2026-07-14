import * as THREE from "three";
import { Chunk, CHUNK_X, CHUNK_Y, CHUNK_Z } from "./chunk.ts";
import { Block, isSolid, faceColor, type Face } from "./blocks.ts";

/**
 * Greedy meshing com oclusão de ambiente por vértice (doc §5). Faces expostas de
 * mesmo tipo de bloco e mesma AO são fundidas em quads grandes, reduzindo
 * drasticamente os triângulos. A iluminação (AO + sombreamento direcional "fake")
 * é assada nas cores de vértice, então uma única MeshBasicMaterial desenha o
 * chunk inteiro em 1 draw call, sem sombras dinâmicas.
 */

const DIMS = [CHUNK_X, CHUNK_Y, CHUNK_Z];

// Brilho por nível de oclusão (0 = canto muito ocluído … 3 = totalmente aberto).
const AO_LEVELS = [0.5, 0.7, 0.85, 1.0];

// Sombreamento direcional por eixo, estilo Minecraft (topo claro, base escura).
function axisShade(d: number, positive: boolean): number {
  if (d === 1) return positive ? 1.0 : 0.5; // Y: topo / base
  if (d === 2) return 0.82; // Z
  return 0.66; // X
}

interface MaskCell {
  block: Block;
  back: boolean; // true → normal aponta para -d
  ao: [number, number, number, number]; // cantos (0,0)(1,0)(1,1)(0,1)
}

function cellsEqual(a: MaskCell | null, b: MaskCell | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.block === b.block &&
    a.back === b.back &&
    a.ao[0] === b.ao[0] &&
    a.ao[1] === b.ao[1] &&
    a.ao[2] === b.ao[2] &&
    a.ao[3] === b.ao[3]
  );
}

function aoValue(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return 0;
  return 3 - ((side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0));
}

export function buildChunkGeometry(chunk: Chunk): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const solid = (x: number, y: number, z: number) => isSolid(chunk.get(x, y, z));

  const x = [0, 0, 0];
  const q = [0, 0, 0];

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const W = DIMS[u];
    const H = DIMS[v];
    q[0] = q[1] = q[2] = 0;
    q[d] = 1;

    const mask: (MaskCell | null)[] = new Array(W * H).fill(null);

    // Percorre cada "fatia" perpendicular ao eixo d.
    for (x[d] = -1; x[d] < DIMS[d]; x[d]++) {
      // 1) Constrói a máscara de faces desta fatia.
      for (x[v] = 0; x[v] < H; x[v]++) {
        for (x[u] = 0; x[u] < W; x[u]++) {
          const aSolid = x[d] >= 0 && solid(x[0], x[1], x[2]);
          const bSolid = x[d] < DIMS[d] - 1 && solid(x[0] + q[0], x[1] + q[1], x[2] + q[2]);

          let cell: MaskCell | null = null;
          if (aSolid !== bSolid) {
            const back = !aSolid; // se b é sólido e a é ar → face olha para -d
            const block = (back
              ? chunk.get(x[0] + q[0], x[1] + q[1], x[2] + q[2])
              : chunk.get(x[0], x[1], x[2])) as Block;
            // Camada "externa" (lado do ar) para amostrar oclusão.
            const od = back ? x[d] : x[d] + 1;
            cell = { block, back, ao: computeAO(solid, d, u, v, od, x[u], x[v]) };
          }
          mask[x[u] + x[v] * W] = cell;
        }
      }

      // 2) Fusão greedy da máscara em quads.
      for (let j = 0; j < H; j++) {
        for (let i = 0; i < W; ) {
          const c = mask[i + j * W];
          if (c === null) {
            i++;
            continue;
          }

          // Largura (ao longo de u).
          let w = 1;
          while (i + w < W && cellsEqual(mask[i + w + j * W], c)) w++;

          // Altura (ao longo de v), exigindo linha inteira igual.
          let h = 1;
          outer: while (j + h < H) {
            for (let k = 0; k < w; k++) {
              if (!cellsEqual(mask[i + k + (j + h) * W], c)) break outer;
            }
            h++;
          }

          emitQuad(
            { positions, normals, colors, uvs, indices },
            c,
            d,
            u,
            v,
            i,
            j,
            w,
            h,
            x[d]
          );

          // Zera as células consumidas.
          for (let l = 0; l < h; l++) {
            for (let k = 0; k < w; k++) mask[i + k + (j + l) * W] = null;
          }
          i += w;
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/** AO dos 4 cantos de uma face, amostrando a camada externa (lado do ar). */
function computeAO(
  solid: (x: number, y: number, z: number) => boolean,
  d: number,
  u: number,
  v: number,
  od: number,
  bu: number,
  bv: number
): [number, number, number, number] {
  const at = (uVal: number, vVal: number) => {
    const p = [0, 0, 0];
    p[d] = od;
    p[u] = uVal;
    p[v] = vVal;
    return solid(p[0], p[1], p[2]);
  };

  const corners: [number, number, number, number] = [0, 0, 0, 0];
  const cu = [0, 1, 1, 0];
  const cv = [0, 0, 1, 1];
  for (let i = 0; i < 4; i++) {
    const su = cu[i] === 1 ? bu + 1 : bu - 1;
    const sv = cv[i] === 1 ? bv + 1 : bv - 1;
    const side1 = at(su, bv);
    const side2 = at(bu, sv);
    const corner = at(su, sv);
    corners[i] = aoValue(side1, side2, corner);
  }
  return corners;
}

interface Buffers {
  positions: number[];
  normals: number[];
  colors: number[];
  uvs: number[];
  indices: number[];
}

function faceType(d: number, back: boolean): Face {
  if (d === 1) return back ? "bottom" : "top";
  return "side";
}

function emitQuad(
  buf: Buffers,
  cell: MaskCell,
  d: number,
  u: number,
  v: number,
  i: number,
  j: number,
  w: number,
  h: number,
  slice: number
): void {
  const positive = !cell.back;
  // A face fica sempre no plano de fronteira entre os voxels `slice` e `slice+1`.
  const base = [0, 0, 0];
  base[d] = slice + 1;
  base[u] = i;
  base[v] = j;

  const du = [0, 0, 0];
  du[u] = w;
  const dv = [0, 0, 0];
  dv[v] = h;

  const p0 = [base[0], base[1], base[2]];
  const p1 = [base[0] + du[0], base[1] + du[1], base[2] + du[2]];
  const p2 = [base[0] + du[0] + dv[0], base[1] + du[1] + dv[1], base[2] + du[2] + dv[2]];
  const p3 = [base[0] + dv[0], base[1] + dv[1], base[2] + dv[2]];

  const nx = [0, 0, 0];
  nx[d] = positive ? 1 : -1;

  const shade = axisShade(d, positive);
  const [cr, cg, cb] = faceColor(cell.block, faceType(d, cell.back));
  const ao = cell.ao;

  const startVertex = buf.positions.length / 3;
  const quad = [p0, p1, p2, p3];
  const quadUV = [
    [i, j],
    [i + w, j],
    [i + w, j + h],
    [i, j + h],
  ];

  for (let k = 0; k < 4; k++) {
    buf.positions.push(quad[k][0], quad[k][1], quad[k][2]);
    buf.normals.push(nx[0], nx[1], nx[2]);
    const l = AO_LEVELS[ao[k]] * shade;
    buf.colors.push(cr * l, cg * l, cb * l);
    buf.uvs.push(quadUV[k][0], quadUV[k][1]);
  }

  // Escolhe a diagonal que melhor preserva o gradiente de AO (anti "anisotropia").
  const flip = ao[0] + ao[2] > ao[1] + ao[3];

  let tris: number[];
  if (!flip) {
    tris = [0, 1, 2, 0, 2, 3];
  } else {
    tris = [1, 2, 3, 1, 3, 0];
  }

  // Inverte o winding para faces que apontam para -d, mantendo o back-face culling.
  if (!positive) tris = tris.slice().reverse();

  for (const t of tris) buf.indices.push(startVertex + t);
}
