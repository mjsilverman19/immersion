import { NextResponse } from "next/server";
import { authenticated } from "@/lib/api/handler";
import { createFromGoogleSchema } from "@/lib/validation/schemas";
import { CATEGORY_MAP } from "@/constants/tags";
import type { GooglePlaceDetailsResponse } from "@/lib/types/google-places";

export const POST = authenticated(createFromGoogleSchema, async (_req, { supabase }, body) => {
  // Check if already exists
  const { data: existing } = await supabase
    .from("places")
    .select("*")
    .eq("google_place_id", body.google_place_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ place: existing });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500 });
  }

  const detailsRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${body.google_place_id}&fields=name,formatted_address,geometry,types,photos,url&key=${apiKey}`
  );
  const detailsData: GooglePlaceDetailsResponse = await detailsRes.json();
  const result = detailsData.result;

  if (!result) {
    return NextResponse.json({ error: "Place not found on Google" }, { status: 404 });
  }

  // Map category
  let category = "experience";
  for (const type of (result.types || [])) {
    if (CATEGORY_MAP[type]) {
      category = CATEGORY_MAP[type];
      break;
    }
  }

  // Find closest city
  const lat = result.geometry?.location?.lat || 0;
  const lng = result.geometry?.location?.lng || 0;

  const { data: cities } = await supabase.from("cities").select("*");
  let closestCity = cities?.[0];
  let minDist = Infinity;

  for (const city of cities || []) {
    const dist = Math.sqrt(
      Math.pow(city.latitude - lat, 2) + Math.pow(city.longitude - lng, 2)
    );
    if (dist < minDist) {
      minDist = dist;
      closestCity = city;
    }
  }

  if (!closestCity) {
    return NextResponse.json({ error: "No cities in database" }, { status: 500 });
  }

  const photoUrls = (result.photos || []).slice(0, 4).map(
    (p) =>
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${apiKey}`
  );

  const { data: place, error } = await supabase
    .from("places")
    .insert({
      google_place_id: body.google_place_id,
      name: result.name,
      city_id: closestCity.id,
      address: result.formatted_address || null,
      latitude: lat,
      longitude: lng,
      category,
      photo_urls: photoUrls.length > 0 ? photoUrls : null,
      google_maps_url: result.url || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ place });
});
