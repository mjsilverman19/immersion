export type WeekdayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type Intent = "anything" | "eat" | "drink" | "coffee" | "culture" | "outside" | "nightlife";
export type MapMode = "baseline" | "personalized";
/** Reserved for methodology/debug inspection; not exposed in the primary map UI. */
export type MapLayer = "immersion" | "activity" | "localOrientation" | "visitorPressure" | "confidence";

export interface DatasetManifest {
  schemaVersion: number;
  datasetVersion: string;
  city: "nyc";
  coverageLabel: string;
  timeModel: "typical_week";
  timeResolutionMinutes: number;
  hexResolution: number;
  generatedAt: string;
  files: {
    hexes: string;
    metricsByDay: Record<WeekdayKey, string>;
    venues: string;
    categoryCurves: string;
    neighborhoods: string;
    placeNeighbors?: string;
  };
}

export interface HexTimeMetric {
  activity: number;
  localOrientation: number;
  visitorPressure: number;
  confidence: number;
  activityConfidence: number;
  localOrientationConfidence: number;
  visitorPressureConfidence: number;
}

export interface HexDayRecord {
  activity: number[];
  localOrientation: number[];
  visitorPressure: number[];
  confidence: { activity: number; localOrientation: number; visitorPressure: number };
}

export interface CompactMetricSlice {
  dayOfWeek: number;
  intervalMinutes: number;
  records: Record<string, [number[], number[], number[], [number, number, number]]>;
}

export interface MetricSlice {
  dayOfWeek: number;
  intervalMinutes: number;
  records: Record<string, HexDayRecord>;
}

export interface HexFeatures {
  venueDensity: number;
  categoryDiversity: number;
  foodDensity: number;
  drinkDensity: number;
  coffeeDensity: number;
  cultureDensity: number;
  nightlifeDensity: number;
  outdoorDensity: number;
  wanderingScore: number;
  anchorConcentration: number;
  venueCount: number;
  evidenceConfidence: number;
}

export interface HexGeometryFeature {
  type: "Feature";
  id?: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: {
    h3: string;
    neighborhoodId: string | null;
    borough: string | null;
    features: HexFeatures;
  };
}

export interface HexGeometryCollection {
  type: "FeatureCollection";
  features: HexGeometryFeature[];
}

export interface VenueFeatureScores {
  informal: number;
  novel: number;
  institution: number;
  soloFriendly: number;
  linger: number;
  destination: number;
  evidenceConfidence: number;
}

export interface VenueRecord {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  h3: string;
  neighborhoodId?: string | null;
  category: "restaurant" | "bar" | "cafe" | "museum" | "park" | "nightlife";
  qualityPrior: number;
  qualityConfidence: number;
  qualitySource: "engine_prior";
  featureScores: VenueFeatureScores;
}

export interface TasteProfile {
  energy: number;
  novelty: number;
  wandering: number;
  formality: number;
  neighborhoodOrientation: number;
  confidence: number;
  version: number;
  dimensions?: Record<TasteDimensionKey, TasteDimension>;
  quizCompletedAt?: string;
  updatedAt?: string;
}

export type TasteDimensionKey = "energy" | "novelty" | "wandering" | "formality" | "neighborhoodOrientation";

export interface TasteDimension {
  explicitValue: number | null;
  learnedValue: number;
  learnedConfidence: number;
  effectiveValue: number;
}

export interface RadarProfile {
  energy: number;
  novelty: number;
  wandering: number;
  formality: number;
  neighborhoodOrientation: number;
}

export type RadarEvidenceSource = "venue" | "category" | "area" | "unknown";

export interface RadarEvidence {
  values: RadarProfile;
  confidence: RadarProfile;
  source: Record<TasteDimensionKey, RadarEvidenceSource>;
}

export interface ScoreContribution {
  feature: string;
  contribution: number;
  label: string;
  evidenceConfidence: number;
}

export interface RankedVenue {
  venue: VenueRecord;
  score: number;
  contributions: ScoreContribution[];
  rank: number;
  isRecommended: boolean;
  timeFit: number;
  recommendationLabel: "People like you" | "Strong fit";
  radarEvidence: RadarEvidence;
}

export interface ActiveCell {
  h3: string;
  score: number;
  confidence: number;
}

export interface SelectedArea {
  id: string;
  name: string;
  borough: string;
  center: [number, number];
  h3Ids: string[];
  activeCells: ActiveCell[];
  score: number;
  baselineScore: number;
  confidence: number;
  venueCount: number;
  relevantVenueCount: number;
  contributions: ScoreContribution[];
  mapVenues: RankedVenue[];
  recommendedVenues: RankedVenue[];
  distanceMiles?: number;
  baselineRank: number;
  rankChange: number;
  personalizationLift: number;
  glowStrength: number;
  glowBasis: "taste" | "activity";
}

export interface UserPlaceState {
  venueId: string;
  saved: boolean;
  visited: boolean;
  endorsed: boolean;
  mapViews?: number;
  note?: string;
  bestFor?: string[];
  updatedAt: string;
}

export interface MapExperienceState {
  selectedTime: { dayOfWeek: WeekdayKey; hour: number };
  intent: Intent;
  mapMode: MapMode;
  tasteProfile: TasteProfile | null;
  selectedAreaId: string | null;
  selectedVenueId: string | null;
}

export type CategoryCurves = Record<VenueRecord["category"], number[]>;
export interface UserLocation { latitude: number; longitude: number }

// --- Venue-to-venue retrieval (place fingerprints) -------------------------
export type SimilarChannel = "time" | "ecology" | "area" | "category" | "spend" | "role";
export type ComplementFactor = "walk" | "complement" | "area";
export type ComplementRole = "alongside" | "after" | "before";

/** On-disk compact row: [candidateVenueIndex, ...channel scores 0-100]. */
export type CompactSimilar = number[];
/** On-disk compact row: [candidateVenueIndex, distanceMeters, roleIndex, ...factor scores 0-100]. */
export type CompactComplement = number[];

/** The shipped place_neighbors.json contract (schema v3). Arrays are aligned to venues.json order. */
export interface PlaceNeighborsArtifact {
  similarScoreOrder: SimilarChannel[];
  complementScoreOrder: ComplementFactor[];
  roles: ComplementRole[];
  similar: CompactSimilar[][];
  complements: CompactComplement[][];
}

/** A candidate resolved against the venue list, scores rescaled to 0-1. */
export interface SimilarNeighbor {
  venue: VenueRecord;
  scores: Record<SimilarChannel, number>;
}

export interface ComplementNeighbor {
  venue: VenueRecord;
  distanceMeters: number;
  role: ComplementRole;
  scores: Record<ComplementFactor, number>;
}

export interface PlaceNeighborEntry {
  similar: SimilarNeighbor[];
  complements: ComplementNeighbor[];
}

/** Resolved retrieval index, keyed by seed venue id. */
export type PlaceNeighborIndex = Map<string, PlaceNeighborEntry>;

/** A ranked retrieval result carrying reconstructed reasons. */
export interface SimilarResult {
  venue: VenueRecord;
  score: number;
  scores: Record<SimilarChannel, number>;
  reasons: string[];
}

export interface ComplementResult {
  venue: VenueRecord;
  distanceMeters: number;
  role: ComplementRole;
  score: number;
  reasons: string[];
}
