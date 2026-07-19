import type { VenueRecord } from "@/types/data";

export function googleMapsPlaceUrl(
  venue: Pick<VenueRecord, "name" | "latitude" | "longitude">,
): string {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", `${venue.name} ${venue.latitude},${venue.longitude}`);
  return url.toString();
}
