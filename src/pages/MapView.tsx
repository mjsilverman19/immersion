import { useEffect, useMemo, useState } from "react";
import { Info, LocateFixed, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";

import { CategoryChips } from "@/components/CategoryChips";
import { MapCanvas } from "@/components/MapCanvas";
import { AreaRail } from "@/components/map/AreaRail";
import { MapLoadingState } from "@/components/map/MapLoadingState";
import { TypicalTimeControl } from "@/components/map/TypicalTimeControl";
import { AreaSheet } from "@/components/sheets/AreaSheet";
import { PlaceSheet } from "@/components/sheets/PlaceSheet";
import { VenueSheet } from "@/components/sheets/VenueSheet";
import { TasteFlow } from "@/components/taste/TasteFlow";
import { TasteSummary } from "@/components/taste/TasteSummary";
import { useCityData } from "@/hooks/useCityData";
import { useTasteProfile } from "@/hooks/useTasteProfile";
import { useUserPlaceState } from "@/hooks/useUserPlaceState";
import { lensWeightsFromTaste, rankComplements, rankSimilar } from "@/lib/placeRetrieval";
import { buildAreaRecommendations, standaloneRadarEvidence } from "@/lib/recommendations";
import { localUserStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { Intent, MapMode, TasteProfile, UserLocation, VenueRecord, WeekdayKey } from "@/types/data";

const MapView = () => {
  const [day, setDay] = useState<WeekdayKey>("sat");
  const [hour, setHour] = useState(15);
  const [intent, setIntentState] = useState<Intent>(() => localUserStorage.getIntent());
  const [mapMode, setMapMode] = useState<MapMode>("baseline");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [citySelectedVenueId, setCitySelectedVenueId] = useState<string | null>(null);
  const [citySelectedReasons, setCitySelectedReasons] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "ready" | "outside" | "denied" | "unsupported">("idle");
  const [selectNearMeWhenReady, setSelectNearMeWhenReady] = useState(false);
  const [tasteOpen, setTasteOpen] = useState(false);
  const [previewTasteProfile, setPreviewTasteProfile] = useState<TasteProfile | null>(null);
  const [showTasteNudge, setShowTasteNudge] = useState(true);
  const [showTasteReveal, setShowTasteReveal] = useState(false);
  const [areaRailCollapsed, setAreaRailCollapsed] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const city = useCityData(day);
  const { tasteProfile, setTasteProfile, learnFromEvidence } = useTasteProfile();
  const { places, updatePlace } = useUserPlaceState();
  const activeTasteProfile = previewTasteProfile ?? tasteProfile;

  useEffect(() => { if (tasteProfile) setMapMode("personalized"); }, []);
  useEffect(() => { setSelectedVenueId(null); setCitySelectedVenueId(null); }, [intent]);

  const allAreas = useMemo(() => {
    if (!city.geometry || !city.metrics || !city.venues.length) return [];
    return buildAreaRecommendations({
      geometry: city.geometry, metrics: city.metrics, venues: city.venues, categoryCurves: city.categoryCurves,
      hour, intent, tasteProfile: activeTasteProfile, mapMode, userLocation,
    });
  }, [activeTasteProfile, city.categoryCurves, city.geometry, city.metrics, city.venues, hour, intent, mapMode, userLocation]);

  const areas = allAreas.slice(0, 3);
  const selectedArea = allAreas.find((area) => area.id === selectedAreaId) ?? null;
  const selectedRankedVenue = selectedArea?.mapVenues.find((item) => item.venue.id === selectedVenueId) ?? null;
  const glowUsesTaste = areas.some((area) => area.glowBasis === "taste");

  const venuesById = useMemo(() => new Map(city.venues.map((venue) => [venue.id, venue])), [city.venues]);
  const citySelectedVenue = citySelectedVenueId ? venuesById.get(citySelectedVenueId) ?? null : null;
  const selectedPlace = selectedRankedVenue?.venue ?? citySelectedVenue;
  const selectedPlaceRadarEvidence = selectedRankedVenue?.radarEvidence
    ?? (citySelectedVenue ? standaloneRadarEvidence(citySelectedVenue) : null);

  const similarWeights = useMemo(() => lensWeightsFromTaste(activeTasteProfile), [activeTasteProfile]);
  const neighborEntry = selectedPlace ? city.placeNeighbors?.get(selectedPlace.id) ?? null : null;
  const similarResults = useMemo(
    () => selectedPlace && neighborEntry
      ? rankSimilar(selectedPlace, neighborEntry.similar, { weights: similarWeights, limit: 6, perNeighborhoodCap: 2 })
      : [],
    [neighborEntry, selectedPlace, similarWeights],
  );
  const complementResults = useMemo(
    () => selectedPlace && neighborEntry
      ? rankComplements(selectedPlace, neighborEntry.complements, {
          limit: 6, perCategoryCap: 2, dayOfWeek: city.metrics?.dayOfWeek, hour, categoryCurves: city.categoryCurves,
        })
      : [],
    [city.categoryCurves, city.metrics?.dayOfWeek, hour, neighborEntry, selectedPlace],
  );
  const retrievalReasonsById = useMemo(() => {
    const map = new Map<string, string[]>();
    similarResults.forEach((result) => map.set(result.venue.id, result.reasons));
    complementResults.forEach((result) => { if (!map.has(result.venue.id)) map.set(result.venue.id, result.reasons); });
    return map;
  }, [complementResults, similarResults]);
  const retrievalVenues = useMemo(
    () => [...new Map([...similarResults, ...complementResults].map((result) => [result.venue.id, result.venue])).values()],
    [complementResults, similarResults],
  );

  useEffect(() => {
    if (selectedAreaId && allAreas.length && !selectedArea) setSelectedAreaId(null);
  }, [allAreas, selectedArea, selectedAreaId]);

  useEffect(() => {
    if (citySelectedVenueId && city.venues.length && !citySelectedVenue) setCitySelectedVenueId(null);
  }, [citySelectedVenue, citySelectedVenueId, city.venues.length]);

  useEffect(() => {
    if (!selectNearMeWhenReady || !userLocation || !allAreas.length) return;
    const nearest = [...allAreas].sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity))[0];
    setSelectNearMeWhenReady(false);
    if (nearest && (nearest.distanceMiles ?? Infinity) <= 3) {
      setSelectedVenueId(null);
      setSelectedAreaId(nearest.id);
      setLocationStatus("ready");
    } else {
      setSelectedAreaId(null);
      setLocationStatus("outside");
    }
  }, [allAreas, selectNearMeWhenReady, userLocation]);

  const setIntent = (next: Intent) => {
    localUserStorage.setIntent(next);
    setIntentState(next);
  };

  const findMe = () => {
    if (!("geolocation" in navigator)) { setLocationStatus("unsupported"); return; }
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setSelectNearMeWhenReady(true);
        setLocationStatus("ready");
      },
      () => setLocationStatus("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  const selectVenue = (venue: VenueRecord) => setSelectedVenueId(venue.id);

  /**
   * Navigate to a venue surfaced by retrieval. When it resolves inside the
   * currently ranked areas (same neighborhood, passes the active intent), reuse
   * the normal area+venue selection so the richer ranked sheet shows. Otherwise
   * fall back to the citywide place sheet — most cross-category "more like
   * this" / "continue from here" results land here, since they routinely fall
   * outside the active intent filter or a neighborhood not in the top areas.
   */
  const selectPlace = (venueId: string, reasons: string[] = []) => {
    const venue = venuesById.get(venueId);
    if (!venue) return;
    const area = venue.neighborhoodId ? allAreas.find((item) => item.id === venue.neighborhoodId) : undefined;
    const ranked = area?.mapVenues.find((item) => item.venue.id === venueId);
    if (area && ranked) {
      setSelectedAreaId(area.id);
      setSelectedVenueId(venueId);
      setCitySelectedVenueId(null);
    } else {
      setSelectedAreaId(null);
      setSelectedVenueId(null);
      setCitySelectedVenueId(venueId);
      setCitySelectedReasons(reasons);
    }
  };
  const selectPlaceFromMap = (venue: VenueRecord) => selectPlace(venue.id, retrievalReasonsById.get(venue.id));

  const updateSelectedPlace = (patch: Parameters<typeof updatePlace>[1]) => {
    if (!selectedPlace || !selectedPlaceRadarEvidence) return;
    const current = places[selectedPlace.id];
    if (patch.saved === true && !current?.saved) learnFromEvidence(selectedPlaceRadarEvidence, 0.5);
    if (patch.endorsed === true && !current?.endorsed) learnFromEvidence(selectedPlaceRadarEvidence, 2);
    updatePlace(selectedPlace.id, patch);
  };
  const recordDirections = () => {
    if (!selectedPlace || !selectedPlaceRadarEvidence) return;
    const current = places[selectedPlace.id];
    learnFromEvidence(selectedPlaceRadarEvidence, 1.5);
    updatePlace(selectedPlace.id, { directionsRequested: (current?.directionsRequested ?? 0) + 1 });
  };
  const closeTasteFlow = () => {
    setTasteOpen(false);
    setPreviewTasteProfile(null);
    setMapMode(tasteProfile ? "personalized" : "baseline");
  };

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <MapCanvas className="absolute inset-0" geometry={city.geometry} areas={areas} selectedArea={selectedArea} selectedVenues={selectedArea?.mapVenues ?? []} mapMode={mapMode} userLocation={userLocation} onSelectArea={(area) => { setSelectedVenueId(null); setCitySelectedVenueId(null); setSelectedAreaId(area.id); }} onSelectVenue={selectVenue} retrievalVenues={retrievalVenues} focusVenue={citySelectedVenue} onSelectPlace={selectPlaceFromMap} />
      <MapLoadingState progress={city.progress} label={city.loadingLabel} error={city.error} />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3 md:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="pointer-events-auto rounded-2xl border border-border bg-background/92 px-4 py-2.5 shadow-md backdrop-blur"><h1 className="font-serif text-2xl italic leading-none">immersion</h1><p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">New York City</p></div>
          <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
            <button type="button" onClick={findMe} disabled={locationStatus === "locating"} className={cn("flex items-center gap-1.5 rounded-full border border-border bg-background/92 px-3 py-2 text-xs shadow-md backdrop-blur", locationStatus === "ready" && "border-primary text-primary")}><LocateFixed className="h-4 w-4" />{locationStatus === "locating" ? "Finding you…" : locationStatus === "ready" ? "Near you" : "Near me"}</button>
            <button type="button" onClick={() => { setTasteOpen(true); setShowTasteNudge(false); }} className="flex items-center gap-1.5 rounded-full border border-border bg-background/92 px-3 py-2 text-xs shadow-md backdrop-blur"><Sparkles className="h-4 w-4 text-primary" />{tasteProfile ? "Your map ✓" : "Shape my map"}</button>
            <button type="button" onClick={() => setLegendOpen((open) => !open)} aria-expanded={legendOpen} className="flex items-center gap-1.5 rounded-full border border-border bg-background/92 px-3 py-2 text-xs shadow-md backdrop-blur"><Info className="h-4 w-4" /> Map key</button>
          </div>
        </div>
        <div className="pointer-events-auto mt-3"><CategoryChips active={intent} onChange={setIntent} /></div>
        {tasteProfile && <div className="pointer-events-auto mt-2 flex w-fit max-w-[92vw] flex-wrap items-center rounded-2xl border border-border bg-background/92 p-1 shadow-sm backdrop-blur"><button type="button" onClick={() => setMapMode("personalized")} aria-pressed={mapMode === "personalized"} className={cn("rounded-full px-3 py-1.5 text-[11px]", mapMode === "personalized" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Your map</button><button type="button" onClick={() => setMapMode("baseline")} aria-pressed={mapMode === "baseline"} className={cn("rounded-full px-3 py-1.5 text-[11px]", mapMode === "baseline" ? "bg-foreground text-background" : "text-muted-foreground")}>City baseline</button><span className="px-2 text-[10px] text-muted-foreground">{tasteProfile.wandering >= 0 ? "Room to wander" : "Destination-led"} · {tasteProfile.formality <= 0 ? "Informal" : "Planned occasions"} · {tasteProfile.energy >= 0 ? "Lively" : "Quieter"}</span><button type="button" onClick={() => { setTasteProfile(null); setMapMode("baseline"); }} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground" aria-label="Reset taste"><SlidersHorizontal className="h-3.5 w-3.5" /></button></div>}
      </header>

      {legendOpen && <aside className="absolute right-3 top-[150px] z-40 w-[min(88vw,260px)] rounded-2xl border border-border bg-background/96 p-4 shadow-xl backdrop-blur md:right-5">
        <button type="button" onClick={() => setLegendOpen(false)} aria-label="Close map key" className="absolute right-2 top-2 rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Map view</p>
        <dl className="mt-3 space-y-2 text-xs"><div className="flex gap-2"><dt className="w-20 shrink-0 font-medium">Light wash</dt><dd className="text-muted-foreground">More typical activity at the selected time</dd></div><div className="flex gap-2"><dt className="w-20 shrink-0 font-medium">Rust glow</dt><dd className="text-muted-foreground">{glowUsesTaste ? "Areas likely to fit your taste" : "Busy, well-supported areas at this time"}</dd></div><div className="flex gap-2"><dt className="w-20 shrink-0 font-medium">Rust streets</dt><dd className="text-muted-foreground">Stronger typical activity corridors—not live traffic</dd></div><div className="flex gap-2"><dt className="w-20 shrink-0 font-medium">Rust dots</dt><dd className="text-muted-foreground">Places matching the current intent</dd></div><div className="flex gap-2"><dt className="w-20 shrink-0 font-medium">Faded areas</dt><dd className="text-muted-foreground">Lower evidence confidence</dd></div></dl>
      </aside>}

      {tasteProfile === null && showTasteNudge && !selectedArea && <div className="absolute left-3 top-[138px] z-20 w-[min(86vw,290px)] rounded-2xl border border-border bg-background/94 p-4 shadow-xl backdrop-blur md:left-5 md:top-[146px]"><p className="font-serif text-xl">Make this map more yours with 5 quick choices.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => { setTasteOpen(true); setShowTasteNudge(false); }} className="rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Shape my map</button><button type="button" onClick={() => setShowTasteNudge(false)} className="rounded-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted">Explore first</button></div></div>}
      {(locationStatus === "denied" || locationStatus === "unsupported") && <div role="status" className="absolute right-3 top-28 z-20 max-w-[250px] rounded-xl border border-border bg-background/94 px-3 py-2 text-[11px] text-muted-foreground shadow-md">Location isn’t available. Recommendations still follow the visible NYC coverage.</div>}
      {locationStatus === "outside" && <div role="status" className="absolute right-3 top-28 z-20 max-w-[250px] rounded-xl border border-border bg-background/94 px-3 py-2 text-[11px] text-muted-foreground shadow-md">You’re outside the supported NYC coverage. Move the map back to New York to explore neighborhood recommendations.</div>}

      {!selectedRankedVenue && !citySelectedVenue && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 pb-3 md:pb-5">
        {!selectedArea && areas.length > 0 && <div className="pointer-events-auto w-full"><AreaRail areas={areas} selectedId={selectedAreaId} personalized={mapMode === "personalized"} collapsed={areaRailCollapsed} onCollapsedChange={setAreaRailCollapsed} onSelect={(area) => setSelectedAreaId(area.id)} /></div>}
        <div className="pointer-events-auto w-full max-w-md px-3"><TypicalTimeControl day={day} hour={hour} onDayChange={setDay} onHourChange={setHour} /></div>
        {city.manifest && <div className="pointer-events-auto rounded-full border border-border bg-background/88 px-3 py-1 text-[9px] text-muted-foreground shadow-sm backdrop-blur">Typical-week model · Dataset {city.manifest.datasetVersion} · <Link to="/methodology" className="underline underline-offset-2">methodology</Link></div>}
      </div>}

      <AreaSheet selected={selectedArea} day={day} hour={hour} onClose={() => setSelectedAreaId(null)} onSelectVenue={selectVenue} />
      <VenueSheet ranked={selectedRankedVenue} tasteProfile={activeTasteProfile} state={selectedRankedVenue ? places[selectedRankedVenue.venue.id] : undefined} onUpdate={updateSelectedPlace} onDirections={recordDirections} onClose={() => setSelectedVenueId(null)} similar={similarResults} complements={complementResults} onSelectPlace={selectPlace} />
      <PlaceSheet venue={citySelectedVenue} reasons={citySelectedReasons} tasteProfile={activeTasteProfile} state={citySelectedVenue ? places[citySelectedVenue.id] : undefined} onUpdate={updateSelectedPlace} onDirections={recordDirections} onClose={() => setCitySelectedVenueId(null)} similar={similarResults} complements={complementResults} onSelectPlace={selectPlace} />
      <TasteFlow open={tasteOpen} surfacedVenues={(allAreas[0]?.recommendedVenues ?? []).slice(0, 2).map((item) => item.venue.name)} onClose={closeTasteFlow} onPreview={(profile) => { setPreviewTasteProfile(profile); setMapMode("personalized"); }} onComplete={(profile) => { setTasteProfile(profile); setPreviewTasteProfile(null); setMapMode("personalized"); setTasteOpen(false); setShowTasteReveal(true); }} />
      {tasteProfile && showTasteReveal && <TasteSummary profile={tasteProfile} topArea={areas[0]} onClose={() => setShowTasteReveal(false)} onAdjust={() => { setShowTasteReveal(false); setTasteOpen(true); }} />}
    </main>
  );
};

export default MapView;
