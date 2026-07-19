import type { HexGeometryCollection, SelectedArea } from "@/types/data";

function pointInRing(point: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [x, y] = ring[index];
    const [previousX, previousY] = ring[previous];
    if ((y > point[1]) !== (previousY > point[1]) && point[0] < ((previousX - x) * (point[1] - y)) / (previousY - y) + x) {
      inside = !inside;
    }
  }
  return inside;
}

export function findAreaAtPoint(
  geometry: HexGeometryCollection | null,
  areas: SelectedArea[],
  point: [number, number],
): SelectedArea | null {
  if (!geometry || !areas.length) return null;
  const areasById = new Map(areas.map((area) => [area.id, area]));
  for (const feature of geometry.features) {
    const area = feature.properties.neighborhoodId ? areasById.get(feature.properties.neighborhoodId) : undefined;
    if (area && pointInRing(point, feature.geometry.coordinates[0])) return area;
  }
  return null;
}
