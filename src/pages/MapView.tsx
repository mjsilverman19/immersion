import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, LocateFixed, SlidersHorizontal, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

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
import { INTENT_ORDER, INTENT_VISUALS } from "@/lib/brand";
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
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "ready" | "outside" | "denied" | "unsupported">("idle");
  const [selectNearMeWhenReady, setSelectNearMeWhenReady] = useState(false);
  const [tasteOpen, setTasteOpen] = useState(false);
  const [previewTasteProfile, setPreviewTasteProfile] = useState<TasteProfile | null>(null);
  const [showTasteNudge, setShowTasteNudge] = useState(true);
  const [showTasteReveal, setShowTasteReveal] = useState(false);
  const [tasteControlsOpen, setTasteControlsOpen] = useState(false);
  const [areaRailCollapsed, setAreaRailCollapsed] = useState(false);
  const [intentMenuOpen, setIntentMenuOpen] = useState(false);
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

  const areas = useMemo(() => allAreas.slice(0, 3), [allAreas]);
  const selectedArea = useMemo(() => allAreas.find((area) => area.id === selectedAreaId) ?? null, [allAreas, selectedAreaId]);
  const selectedVenues = useMemo(() => selectedArea?.mapVenues ?? [], [selectedArea]);
  const selectedRankedVenue = selectedArea?.mapVenues.find((item) => item.venue.id === selectedVenueId) ?? null;
  const activeIntentVisual = INTENT_VISUALS[intent];

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
  const selectPlace = (venueId: string) => {
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
    }
  };
  const selectPlaceFromMap = (venue: VenueRecord) => selectPlace(venue.id);

  const updateSelectedPlace = (patch: Parameters<typeof updatePlace>[1]) => {
    if (!selectedPlace || !selectedPlaceRadarEvidence) return;
    const current = places[selectedPlace.id];
    if (patch.saved === true && !current?.saved) learnFromEvidence(selectedPlaceRadarEvidence, 0.5);
    if (patch.endorsed === true && !current?.endorsed) learnFromEvidence(selectedPlaceRadarEvidence, 2);
    updatePlace(selectedPlace.id, patch);
  };
  const recordMapView = () => {
    if (!selectedPlace || !selectedPlaceRadarEvidence) return;
    const current = places[selectedPlace.id];
    learnFromEvidence(selectedPlaceRadarEvidence, 1);
    updatePlace(selectedPlace.id, { mapViews: (current?.mapViews ?? 0) + 1 });
  };
  const closeTasteFlow = () => {
    setTasteOpen(false);
    setPreviewTasteProfile(null);
    setMapMode(tasteProfile ? "personalized" : "baseline");
  };

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <MapCanvas className="absolute inset-0" geometry={city.geometry} areas={areas} selectableAreas={allAreas} selectedArea={selectedArea} selectedVenues={selectedVenues} mapMode={mapMode} intent={intent} userLocation={userLocation} onSelectArea={(area) => { setSelectedVenueId(null); setCitySelectedVenueId(null); setSelectedAreaId(area.id); }} onSelectVenue={selectVenue} retrievalVenues={retrievalVenues} focusVenue={citySelectedVenue} onSelectPlace={selectPlaceFromMap} />
      <MapLoadingState progress={city.progress} label={city.loadingLabel} error={city.error} />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="brand-surface pointer-events-auto rounded-2xl px-4 py-2.5"><h1 className="font-serif text-2xl font-semibold leading-none tracking-[-0.035em]">immersion</h1><p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">New York City</p></div>
          <div className="pointer-events-auto flex items-center justify-end gap-1.5 sm:gap-2">
            <button type="button" onClick={findMe} disabled={locationStatus === "locating"} aria-label={locationStatus === "locating" ? "Finding your location" : locationStatus === "ready" ? "Using your location" : "Find recommendations near me"} className={cn("brand-icon-button text-xs sm:gap-1.5 sm:px-3", locationStatus === "ready" && "border-primary text-primary")}><LocateFixed className="h-4 w-4" /><span className="hidden sm:inline">{locationStatus === "locating" ? "Finding you…" : locationStatus === "ready" ? "Near you" : "Near me"}</span></button>
            <button type="button" onClick={() => { setTasteOpen(true); setShowTasteNudge(false); }} aria-label={tasteProfile ? "Adjust your map" : "Shape my map"} className="brand-icon-button text-xs sm:gap-1.5 sm:px-3"><Sparkles className="h-4 w-4 text-primary" /><span className="hidden sm:inline">{tasteProfile ? "Your map ✓" : "Shape my map"}</span></button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIntentMenuOpen((open) => !open)}
                aria-expanded={intentMenuOpen}
                aria-haspopup="menu"
                className="brand-icon-button gap-1.5 px-2.5 text-xs sm:px-3"
              >
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeIntentVisual.color }} />
                <span>{activeIntentVisual.label}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", intentMenuOpen && "rotate-180")} />
              </button>
              {intentMenuOpen && (
                <div role="menu" aria-label="Choose what to explore" className="brand-surface absolute right-0 top-[calc(100%+0.5rem)] z-50 w-44 rounded-2xl p-1.5">
                  {INTENT_ORDER.map((intentId) => {
                    const visual = INTENT_VISUALS[intentId];
                    const selected = intentId === intent;
                    return (
                      <button
                        key={intentId}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        onClick={() => { setIntent(intentId); setIntentMenuOpen(false); }}
                        className={cn("flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition hover:bg-background/70", selected && "bg-background/60")}
                      >
                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: visual.color }} />
                        <span className="flex-1">{visual.label}</span>
                        {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        {tasteProfile && <>
          <div className="pointer-events-auto mt-2 sm:hidden">
            <button
              type="button"
              onClick={() => setTasteControlsOpen((open) => !open)}
              aria-expanded={tasteControlsOpen}
              className="brand-surface flex min-h-10 items-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold"
            >
              <span className={cn("h-2 w-2 rounded-full", mapMode === "personalized" ? "bg-primary" : "bg-foreground")} />
              {mapMode === "personalized" ? "Your map" : "City baseline"}
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {tasteControlsOpen && <div className="brand-surface mt-1.5 w-[min(88vw,330px)] rounded-2xl p-2.5">
              <div className="flex gap-1">
                <button type="button" onClick={() => { setMapMode("personalized"); setTasteControlsOpen(false); }} aria-pressed={mapMode === "personalized"} className={cn("min-h-10 flex-1 rounded-full px-3 py-2 text-[11px] font-medium", mapMode === "personalized" ? "bg-primary text-primary-foreground" : "hover:bg-background/60")}>Your map</button>
                <button type="button" onClick={() => { setMapMode("baseline"); setTasteControlsOpen(false); }} aria-pressed={mapMode === "baseline"} className={cn("min-h-10 flex-1 rounded-full px-3 py-2 text-[11px] font-medium", mapMode === "baseline" ? "bg-foreground text-background" : "hover:bg-background/60")}>City baseline</button>
              </div>
              <div className="mt-2 flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
                <span className="min-w-0 flex-1">{tasteProfile.wandering >= 0 ? "Room to wander" : "Destination-led"} · {tasteProfile.formality <= 0 ? "Informal" : "Planned occasions"} · {tasteProfile.energy >= 0 ? "Lively" : "Quieter"}</span>
                <button type="button" onClick={() => { setTasteProfile(null); setMapMode("baseline"); setTasteControlsOpen(false); }} className="shrink-0 rounded-full p-2 hover:bg-background/60" aria-label="Reset taste"><SlidersHorizontal className="h-3.5 w-3.5" /></button>
              </div>
            </div>}
          </div>
          <div className="brand-surface pointer-events-auto mt-2 hidden w-fit max-w-[92vw] flex-wrap items-center rounded-2xl p-1 sm:flex"><button type="button" onClick={() => setMapMode("personalized")} aria-pressed={mapMode === "personalized"} className={cn("rounded-full px-3 py-1.5 text-[11px]", mapMode === "personalized" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Your map</button><button type="button" onClick={() => setMapMode("baseline")} aria-pressed={mapMode === "baseline"} className={cn("rounded-full px-3 py-1.5 text-[11px]", mapMode === "baseline" ? "bg-foreground text-background" : "text-muted-foreground")}>City baseline</button><span className="px-2 text-[10px] text-muted-foreground">{tasteProfile.wandering >= 0 ? "Room to wander" : "Destination-led"} · {tasteProfile.formality <= 0 ? "Informal" : "Planned occasions"} · {tasteProfile.energy >= 0 ? "Lively" : "Quieter"}</span><button type="button" onClick={() => { setTasteProfile(null); setMapMode("baseline"); }} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground" aria-label="Reset taste"><SlidersHorizontal className="h-3.5 w-3.5" /></button></div>
        </>}
        {tasteProfile === null && showTasteNudge && !selectedArea && <div className="brand-surface pointer-events-auto mt-2.5 w-[min(86vw,300px)] rounded-2xl p-4"><p className="font-serif text-xl font-medium leading-snug">Make this map more yours with 5 quick choices.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => { setTasteOpen(true); setShowTasteNudge(false); }} className="brand-primary-button min-h-10 px-3 py-2 text-xs">Shape my map</button><button type="button" onClick={() => setShowTasteNudge(false)} className="min-h-10 rounded-full px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-card">Explore first</button></div></div>}
      </header>

      {(locationStatus === "denied" || locationStatus === "unsupported") && <div role="status" className="brand-surface absolute right-3 top-28 z-20 max-w-[250px] rounded-xl px-3 py-2 text-[11px] text-muted-foreground">Location isn’t available. Recommendations still follow the visible NYC coverage.</div>}
      {locationStatus === "outside" && <div role="status" className="brand-surface absolute right-3 top-28 z-20 max-w-[250px] rounded-xl px-3 py-2 text-[11px] text-muted-foreground">You’re outside the supported NYC coverage. Move the map back to New York to explore neighborhood recommendations.</div>}

      {!selectedRankedVenue && !citySelectedVenue && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 safe-bottom md:pb-5">
        {!selectedArea && areas.length > 0 && <div className="pointer-events-auto w-full"><AreaRail areas={areas} collapsed={areaRailCollapsed} onCollapsedChange={setAreaRailCollapsed} onSelect={(area, venue) => { setSelectedAreaId(area.id); setSelectedVenueId(venue.id); setCitySelectedVenueId(null); }} /></div>}
        <div className="pointer-events-auto w-full max-w-md px-3"><TypicalTimeControl day={day} hour={hour} onDayChange={setDay} onHourChange={setHour} /></div>
        {city.manifest && <div className="pointer-events-auto rounded-full border border-white/50 bg-background/60 px-3 py-1 text-[9px] text-muted-foreground shadow-sm backdrop-blur-xl">Typical-week model · Dataset {city.manifest.datasetVersion} · <Link to="/methodology" className="underline underline-offset-2">methodology</Link></div>}
      </div>}

      <AreaSheet selected={selectedArea} day={day} hour={hour} onClose={() => setSelectedAreaId(null)} onSelectVenue={selectVenue} />
      <VenueSheet ranked={selectedRankedVenue} tasteProfile={activeTasteProfile} state={selectedRankedVenue ? places[selectedRankedVenue.venue.id] : undefined} onUpdate={updateSelectedPlace} onViewOnMaps={recordMapView} onShapeTaste={() => { setTasteOpen(true); setShowTasteNudge(false); }} onClose={() => setSelectedVenueId(null)} similar={similarResults} complements={complementResults} onSelectPlace={selectPlace} />
      <PlaceSheet venue={citySelectedVenue} tasteProfile={activeTasteProfile} state={citySelectedVenue ? places[citySelectedVenue.id] : undefined} onUpdate={updateSelectedPlace} onViewOnMaps={recordMapView} onShapeTaste={() => { setTasteOpen(true); setShowTasteNudge(false); }} onClose={() => setCitySelectedVenueId(null)} similar={similarResults} complements={complementResults} onSelectPlace={selectPlace} />
      <TasteFlow open={tasteOpen} surfacedVenues={(allAreas[0]?.recommendedVenues ?? []).slice(0, 2).map((item) => item.venue.name)} onClose={closeTasteFlow} onPreview={(profile) => { setPreviewTasteProfile(profile); setMapMode("personalized"); }} onComplete={(profile) => { setTasteProfile(profile); setPreviewTasteProfile(null); setMapMode("personalized"); setTasteOpen(false); setShowTasteReveal(true); }} />
      {tasteProfile && showTasteReveal && <TasteSummary profile={tasteProfile} topArea={areas[0]} onClose={() => setShowTasteReveal(false)} onAdjust={() => { setShowTasteReveal(false); setTasteOpen(true); }} />}
    </main>
  );
};

export default MapView;
