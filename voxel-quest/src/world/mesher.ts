import * as THREE from 'three';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './chunk';
import { BlockIds, Blocks, getBlock } from './blocks';

/**
 * Greedy meshing implementation for voxel chunks
 * This reduces the number of triangles by merging adjacent faces of the same block type
 */

interface Face {
  x: number;
  y: number;
  z: number;
  w: number; // width (for right/left faces, this is depth)
  h: number; // height
  d: number; // depth (for top/bottom faces, this is width)
  direction: number; // 0: -x, 1: +x, 2: -y, 3: +y, 4: -z, 5: +z
  blockId: number;
}

// Direction vectors for each face
const FACE_DIRECTIONS = [
  { x: -1, y: 0, z: 0 }, // -x (left)
  { x: 1, y: 0, z: 0 },  // +x (right)
  { x: 0, y: -1, z: 0 }, // -y (bottom)
  { x: 0, y: 1, z: 0 },  // +y (top)
  { x: 0, y: 0, z: -1 }, // -z (front)
  { x: 0, y: 0, z: 1 },  // +z (back)
];

export class Mesher {
  /**
   * Generate geometry for a chunk using greedy meshing
   */
  static generateMesh(chunk: Chunk, neighborChunks: {
    left?: Chunk;
    right?: Chunk;
    bottom?: Chunk;
    top?: Chunk;
    front?: Chunk;
    back?: Chunk;
  }): THREE.BufferGeometry | null {
    const faces: Face[] = [];

    // Process each direction
    for (let dir = 0; dir < 6; dir++) {
      const facesForDir = this.extractFacesForDirection(chunk, dir, neighborChunks);
      faces.push(...facesForDir);
    }

    if (faces.length === 0) {
      return null;
    }

    return this.buildGeometry(faces);
  }

  /**
   * Extract faces for a specific direction using greedy meshing
   */
  private static extractFacesForDirection(
    chunk: Chunk,
    direction: number,
    neighborChunks: any
  ): Face[] {
    const faces: Face[] = [];
    const visited = new Set<string>();

    const dirVec = FACE_DIRECTIONS[direction];
    
    // Determine which axes to iterate over based on direction
    let primaryAxis: 'x' | 'y' | 'z';
    let secondaryAxis: 'x' | 'y' | 'z';
    let tertiaryAxis: 'x' | 'y' | 'z';

    switch (direction) {
      case 0: // -x
      case 1: // +x
        primaryAxis = 'z';
        secondaryAxis = 'y';
        tertiaryAxis = 'x';
        break;
      case 2: // -y
      case 3: // +y
        primaryAxis = 'x';
        secondaryAxis = 'z';
        tertiaryAxis = 'y';
        break;
      case 4: // -z
      case 5: // +z
        primaryAxis = 'x';
        secondaryAxis = 'y';
        tertiaryAxis = 'z';
        break;
      default:
        return faces;
    }

    // Iterate through the surface
    for (let p = 0; p < CHUNK_SIZE; p++) {
      for (let s = 0; s < CHUNK_HEIGHT; s++) {
        const key = `${p},${s}`;
        if (visited.has(key)) continue;

        // Get the block at this position
        const coords: any = { x: 0, y: 0, z: 0 };
        coords[primaryAxis] = p;
        coords[secondaryAxis] = s;
        coords[tertiaryAxis] = direction % 2 === 0 ? 0 : CHUNK_SIZE - 1;

        const blockId = chunk.getBlock(coords.x, coords.y, coords.z);
        
        // Skip air blocks
        if (blockId === BlockIds.AIR) continue;

        // Check if there's an exposed face in this direction
        const neighborCoords = { ...coords };
        neighborCoords[tertiaryAxis] += dirVec[tertiaryAxis as keyof typeof dirVec];
        
        const neighborBlock = this.getNeighborBlock(chunk, neighborCoords, direction, neighborChunks);
        
        // Only create face if neighbor is air or different block
        if (neighborBlock !== BlockIds.AIR && neighborBlock !== blockId) continue;
        if (neighborBlock === blockId) continue;

        // Found an exposed face, now greedily merge
        let width = 1;
        let height = 1;

        // Try to extend in primary axis direction
        while (p + width < CHUNK_SIZE) {
          const testCoords: any = { x: 0, y: 0, z: 0 };
          testCoords[primaryAxis] = p + width;
          testCoords[secondaryAxis] = s;
          testCoords[tertiaryAxis] = coords[tertiaryAxis];

          const testBlock = chunk.getBlock(testCoords.x, testCoords.y, testCoords.z);
          if (testBlock !== blockId) break;

          const testNeighborCoords = { ...testCoords };
          testNeighborCoords[tertiaryAxis] += dirVec[tertiaryAxis as keyof typeof dirVec];
          const testNeighbor = this.getNeighborBlock(chunk, testNeighborCoords, direction, neighborChunks);
          
          if (testNeighbor !== BlockIds.AIR || testNeighbor === blockId) break;

          const testKey = `${p + width},${s}`;
          if (visited.has(testKey)) break;

          width++;
        }

        // Try to extend in secondary axis direction
        while (s + height < CHUNK_HEIGHT) {
          let canExtend = true;
          for (let w = 0; w < width; w++) {
            const testCoords: any = { x: 0, y: 0, z: 0 };
            testCoords[primaryAxis] = p + w;
            testCoords[secondaryAxis] = s + height;
            testCoords[tertiaryAxis] = coords[tertiaryAxis];

            const testBlock = chunk.getBlock(testCoords.x, testCoords.y, testCoords.z);
            if (testBlock !== blockId) {
              canExtend = false;
              break;
            }

            const testNeighborCoords = { ...testCoords };
            testNeighborCoords[tertiaryAxis] += dirVec[tertiaryAxis as keyof typeof dirVec];
            const testNeighbor = this.getNeighborBlock(chunk, testNeighborCoords, direction, neighborChunks);
            
            if (testNeighbor !== BlockIds.AIR || testNeighbor === blockId) {
              canExtend = false;
              break;
            }

            const testKey = `${p + w},${s + height}`;
            if (visited.has(testKey)) {
              canExtend = false;
              break;
            }
          }
          if (!canExtend) break;
          height++;
        }

        // Mark all covered positions as visited
        for (let w = 0; w < width; w++) {
          for (let h = 0; h < height; h++) {
            visited.add(`${p + w},${s + h}`);
          }
        }

        // Create the face
        const face: Face = {
          x: coords.x,
          y: coords.y,
          z: coords.z,
          w: direction === 0 || direction === 1 ? height : width,
          h: height,
          d: direction === 4 || direction === 5 ? height : width,
          direction,
          blockId,
        };

        faces.push(face);
      }
    }

    return faces;
  }

  /**
   * Get block from neighbor chunk when at border
   */
  private static getNeighborBlock(
    chunk: Chunk,
    coords: { x: number; y: number; z: number },
    direction: number,
    neighborChunks: any
  ): number {
    // Check if we're at the border and need to sample from neighbor
    if (coords.x < 0 || coords.x >= CHUNK_SIZE || coords.z < 0 || coords.z >= CHUNK_SIZE) {
      // Out of bounds, would need neighbor chunk
      return BlockIds.AIR; // Simplified for now
    }

    if (coords.y < 0 || coords.y >= CHUNK_HEIGHT) {
      return BlockIds.AIR;
    }

    return chunk.getBlock(coords.x, coords.y, coords.z);
  }

  /**
   * Build Three.js geometry from faces
   */
  private static buildGeometry(faces: Face[]): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    let vertexIndex = 0;

    for (const face of faces) {
      const blockData = getBlock(face.blockId);
      const textureIndex = blockData.textureIndex;

      // Calculate vertices for the face
      const vertices = this.calculateFaceVertices(face);

      // Add vertices
      for (const v of vertices) {
        positions.push(v.x, v.y, v.z);
      }

      // Calculate normal based on direction
      const normal = FACE_DIRECTIONS[face.direction];
      for (let i = 0; i < 4; i++) {
        normals.push(normal.x, normal.y, normal.z);
      }

      // UVs for texture atlas (simplified - each block gets full UV space)
      const uvSize = 1 / 16; // Assuming 16x16 atlas
      const u = (textureIndex % 16) * uvSize;
      const v = Math.floor(textureIndex / 16) * uvSize;
      
      for (let i = 0; i < 4; i++) {
        uvs.push(u, v);
        uvs.push(u + uvSize, v);
        uvs.push(u + uvSize, v + uvSize);
        uvs.push(u, v + uvSize);
      }

      // Indices for two triangles
      indices.push(
        vertexIndex, vertexIndex + 1, vertexIndex + 2,
        vertexIndex, vertexIndex + 2, vertexIndex + 3
      );

      vertexIndex += 4;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    return geometry;
  }

  /**
   * Calculate the 4 corner vertices of a face
   */
  private static calculateFaceVertices(face: Face): { x: number; y: number; z: number }[] {
    const dir = face.direction;
    const offset = dir % 2 === 0 ? 0 : 1;
    
    // Vertices ordered for counter-clockwise winding
    switch (dir) {
      case 0: // -x (left)
        return [
          { x: face.x, y: face.y + face.h, z: face.z },
          { x: face.x, y: face.y, z: face.z },
          { x: face.x, y: face.y, z: face.z + face.d },
          { x: face.x, y: face.y + face.h, z: face.z + face.d },
        ];
      case 1: // +x (right)
        return [
          { x: face.x + 1, y: face.y + face.h, z: face.z + face.d },
          { x: face.x + 1, y: face.y, z: face.z + face.d },
          { x: face.x + 1, y: face.y, z: face.z },
          { x: face.x + 1, y: face.y + face.h, z: face.z },
        ];
      case 2: // -y (bottom)
        return [
          { x: face.x, y: face.y, z: face.z },
          { x: face.x, y: face.y, z: face.z + face.w },
          { x: face.x + face.d, y: face.y, z: face.z + face.w },
          { x: face.x + face.d, y: face.y, z: face.z },
        ];
      case 3: // +y (top)
        return [
          { x: face.x + face.d, y: face.y + 1, z: face.z },
          { x: face.x + face.d, y: face.y + 1, z: face.z + face.w },
          { x: face.x, y: face.y + 1, z: face.z + face.w },
          { x: face.x, y: face.y + 1, z: face.z },
        ];
      case 4: // -z (front)
        return [
          { x: face.x, y: face.y + face.h, z: face.z },
          { x: face.x, y: face.y, z: face.z },
          { x: face.x + face.w, y: face.y, z: face.z },
          { x: face.x + face.w, y: face.y + face.h, z: face.z },
        ];
      case 5: // +z (back)
        return [
          { x: face.x + face.w, y: face.y + face.h, z: face.z + 1 },
          { x: face.x + face.w, y: face.y, z: face.z + 1 },
          { x: face.x, y: face.y, z: face.z + 1 },
          { x: face.x, y: face.y + face.h, z: face.z + 1 },
        ];
      default:
        return [];
    }
  }
}
