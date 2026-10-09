export type Point3 = [number, number, number];
export const BLOCH_RADIUS = 0.125;
// Height is the gap below the sphere, independent of its display scale.
export function blochSpherePosition(scale: number, height: number): Point3 {
  return [0, height + BLOCH_RADIUS * scale, 0];
}
// Right-handed mapping: quantum (X,Y,Z) -> Viro (X,Z,-Y).
export function blochToWorld([x, y, z]: Point3): Point3 {
  return [x, z, -y];
}
export function ringPoints(plane: 'xy' | 'xz' | 'yz'): Point3[] {
  return Array.from({ length: 97 }, (_, i) => {
    const a = (i / 96) * Math.PI * 2;
    const x = Math.cos(a) * BLOCH_RADIUS;
    const y = Math.sin(a) * BLOCH_RADIUS;
    return plane === 'xy' ? [x, y, 0] : plane === 'xz' ? [x, 0, y] : [0, x, y];
  });
}
export const BASIS_LABELS: { text: string; position: Point3 }[] = [
  { text: '|0>', position: [0, 0.16, 0] },
  { text: '|1>', position: [0, -0.16, 0] },
  { text: '|+>', position: [0.17, 0, 0] },
  { text: '|->', position: [-0.17, 0, 0] },
  { text: '|+i>', position: [0, 0, -0.17] },
  { text: '|-i>', position: [0, 0, 0.17] },
];
export const ARROW_VERTICES: Point3[] = [
  [0, 0.121, 0],
  [-0.008, 0.103, -0.008],
  [0.008, 0.103, -0.008],
  [0.008, 0.103, 0.008],
  [-0.008, 0.103, 0.008],
];
export const ARROW_TRIANGLES: Point3[] = [
  [0, 2, 1],
  [0, 3, 2],
  [0, 4, 3],
  [0, 1, 4],
  [1, 2, 3],
  [1, 3, 4],
];
