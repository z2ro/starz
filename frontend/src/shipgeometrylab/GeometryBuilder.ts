import * as THREE from 'three';

export type Point3 = readonly [number, number, number];

/** Small static-geometry batcher. Returned BufferGeometry is owned/disposed by its mesh. */
export class GeometryBuilder {
  private positions: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];
  private transform = new THREE.Matrix4();
  private stack: THREE.Matrix4[] = [];

  push(matrix: THREE.Matrix4) {
    if (!matrix.elements.every(Number.isFinite) || matrix.determinant() <= 0) throw new Error('Transform must be finite, invertible and non-reflecting');
    this.stack.push(this.transform.clone());
    this.transform = this.transform.clone().multiply(matrix);
    return this;
  }

  pop() {
    const previous = this.stack.pop();
    if (!previous) throw new Error('Unbalanced transform stack');
    this.transform = previous;
    return this;
  }

  private face(points: readonly Point3[], color: THREE.ColorRepresentation) {
    const vertices = points.map(point => new THREE.Vector3(...point).applyMatrix4(this.transform));
    if (vertices.some(point => !point.toArray().every(Number.isFinite))) throw new Error('Non-finite vertex');
    const normal = new THREE.Vector3().crossVectors(vertices[1].clone().sub(vertices[0]), vertices[2].clone().sub(vertices[0]));
    if (normal.lengthSq() < 1e-16) throw new Error('Degenerate face');
    const offset = this.positions.length / 3;
    const rgb = new THREE.Color(color);
    for (const vertex of vertices) {
      this.positions.push(vertex.x, vertex.y, vertex.z);
      this.colors.push(rgb.r, rgb.g, rgb.b);
    }
    this.indices.push(offset, offset + 1, offset + 2);
    if (points.length === 4) this.indices.push(offset, offset + 2, offset + 3);
    return this;
  }

  triangle(a: Point3, b: Point3, c: Point3, color: THREE.ColorRepresentation) { return this.face([a, b, c], color); }
  quad(a: Point3, b: Point3, c: Point3, d: Point3, color: THREE.ColorRepresentation) { return this.face([a, b, c, d], color); }

  box(center: Point3, size: Point3, color: THREE.ColorRepresentation) {
    return this.taperedBox(center, size, size[0], size[2], color);
  }

  taperedBox(center: Point3, size: Point3, topWidth: number, topDepth: number, color: THREE.ColorRepresentation) {
    if ([...size, topWidth, topDepth].some(value => !Number.isFinite(value) || value <= 0)) throw new Error('Positive box dimensions required');
    const [x, y, z] = center, [width, height, depth] = size;
    const ring = (w: number, d: number, py: number): Point3[] => [[x - w / 2, py, z - d / 2], [x - w / 2, py, z + d / 2], [x + w / 2, py, z + d / 2], [x + w / 2, py, z - d / 2]];
    const bottom = ring(width, depth, y - height / 2), top = ring(topWidth, topDepth, y + height / 2);
    this.quad(bottom[3], bottom[2], bottom[1], bottom[0], color);
    this.quad(top[0], top[1], top[2], top[3], color);
    for (let index = 0; index < 4; index++) {
      const next = (index + 1) % 4;
      this.quad(bottom[index], bottom[next], top[next], top[index], color);
    }
    return this;
  }

  /** Cylinder along local +Z; optional open ends support real engine nozzles. */
  cylinder(center: Point3, radius: number, length: number, color: THREE.ColorRepresentation, endRadius = radius, segments = 12, caps = true) {
    if (![radius, endRadius, length].every(value => Number.isFinite(value) && value > 0) || !Number.isInteger(segments) || segments < 3) throw new Error('Invalid cylinder dimensions');
    const [x, y, z] = center;
    for (let index = 0; index < segments; index++) {
      const angle = index / segments * Math.PI * 2, next = (index + 1) / segments * Math.PI * 2;
      const a: Point3 = [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z - length / 2];
      const b: Point3 = [x + Math.cos(next) * radius, y + Math.sin(next) * radius, z - length / 2];
      const c: Point3 = [x + Math.cos(next) * endRadius, y + Math.sin(next) * endRadius, z + length / 2];
      const d: Point3 = [x + Math.cos(angle) * endRadius, y + Math.sin(angle) * endRadius, z + length / 2];
      this.quad(a, b, c, d, color);
      if (caps) {
        this.triangle([x, y, z - length / 2], b, a, color);
        this.triangle([x, y, z + length / 2], d, c, color);
      }
    }
    return this;
  }

  beam(from: Point3, to: Point3, thickness: number, color: THREE.ColorRepresentation) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    if (direction.lengthSq() < 1e-12) throw new Error('Beam endpoints must differ');
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize());
    const matrix = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), quaternion, new THREE.Vector3(1, 1, 1));
    return this.push(matrix).box([0, 0, 0], [thickness, thickness, direction.length()], color).pop();
  }

  build() {
    if (this.stack.length) throw new Error('Unbalanced transform stack');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}
