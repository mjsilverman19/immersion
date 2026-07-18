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
  directionsRequested?: number;
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
