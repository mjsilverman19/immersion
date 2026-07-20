/**
 * Runtime half of the taste-space artifact (see pipeline/build_taste_space.py).
 *
 * Decodes the shipped base64 int8 venue vectors into typed arrays and exposes
 * the small linear-algebra kernel the personalization and adaptive-quiz layers
 * share. Pure functions only — no React, no data loading.
 */
import type { TasteChannelKey, TasteSpace, TasteSpaceArtifact, TasteSpaceChannel } from "@/types/data";

function decodeBase64(value: string): Int8Array {
  const binary = atob(value);
  const bytes = new Int8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    const code = binary.charCodeAt(i);
    bytes[i] = code > 127 ? code - 256 : code;
  }
  return bytes;
}

export function decodeTasteSpace(raw: TasteSpaceArtifact, venueCount: number): TasteSpace {
  const quantized = decodeBase64(raw.vectors);
  if (quantized.length !== venueCount * raw.dims) {
    throw new Error(`taste space misaligned: ${quantized.length} values for ${venueCount} venues x ${raw.dims} dims`);
  }
  const scale = raw.quantClip / 127;
  const vectors = new Float32Array(quantized.length);
  for (let i = 0; i < quantized.length; i += 1) vectors[i] = quantized[i] * scale;
  const covariance = new Float32Array(raw.dims * raw.dims);
  raw.covariance.forEach((row, i) => row.forEach((value, j) => { covariance[i * raw.dims + j] = value; }));
  return {
    version: raw.version,
    bankVersion: raw.bankVersion,
    dims: raw.dims,
    channels: raw.channels,
    matchGain: raw.matchGain,
    viewGain: raw.viewGain,
    venueCount,
    vectors,
    covariance,
    interpretiveAxes: Object.fromEntries(
      Object.entries(raw.interpretiveAxes).map(([key, axis]) => [key, Float32Array.from(axis)]),
    ) as TasteSpace["interpretiveAxes"],
    areaCentroids: new Map(Object.entries(raw.areaCentroids).map(([key, centroid]) => [key, Float32Array.from(centroid)])),
    questions: raw.questions,
  };
}

/** Zero-copy view of one venue's vector (row `index` of the flat matrix). */
export function venueVector(space: TasteSpace, index: number): Float32Array {
  return space.vectors.subarray(index * space.dims, (index + 1) * space.dims);
}

export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

export function norm(a: ArrayLike<number>): number {
  return Math.sqrt(dot(a, a));
}

export function normalize(a: ArrayLike<number>): Float32Array {
  const length = norm(a);
  const out = new Float32Array(a.length);
  if (length < 1e-9) return out;
  for (let i = 0; i < a.length; i += 1) out[i] = a[i] / length;
  return out;
}

/** Per-channel partial dot products (for explanation chips). */
export function channelDots(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  channels: TasteSpaceChannel[],
): Record<TasteChannelKey, number> {
  const out = {} as Record<TasteChannelKey, number>;
  for (const channel of channels) {
    let sum = 0;
    for (let i = channel.start; i < channel.start + channel.len; i += 1) sum += a[i] * b[i];
    out[channel.key] = sum;
  }
  return out;
}

/** rᵀ Σ r over the flat dims x dims covariance. */
export function covarianceQuadraticForm(covariance: Float32Array, r: ArrayLike<number>, dims: number): number {
  let total = 0;
  for (let i = 0; i < dims; i += 1) {
    if (r[i] === 0) continue;
    let rowSum = 0;
    for (let j = 0; j < dims; j += 1) rowSum += covariance[i * dims + j] * r[j];
    total += r[i] * rowSum;
  }
  return total;
}
