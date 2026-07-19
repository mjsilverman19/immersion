import type { StyleSpecification } from "maplibre-gl";

import { MAP_FONT_STACKS } from "@/lib/brand";
import { GLYPHS_URL, PALETTE, TILE_URL } from "@/lib/config";

/**
 * A paper / ink base style built on the keyless OpenMapTiles vector source.
 *
 * The goal is a hand-tinted atlas plate: paper land, cool blue water,
 * hairline ink linework, and quiet sans labels — nothing else. Default
 * POI icons, transit, colored landuse, and highway shields are simply never
 * added, so the base reads nearly monochrome before the data layers go on.
 */
export function buildBaseStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      omt: {
        type: "vector",
        url: TILE_URL,
        attribution:
          '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
      },
    },
    layers: [
      // Paper ground.
      {
        id: "bg",
        type: "background",
        paint: { "background-color": PALETTE.paper },
      },

      // Greenspace uses the brand park tint without overpowering recommendations.
      {
        id: "park",
        type: "fill",
        source: "omt",
        "source-layer": "park",
        paint: { "fill-color": PALETTE.park, "fill-opacity": 0.62 },
      },
      {
        id: "landcover-wood",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["wood", "grass"]]],
        paint: { "fill-color": PALETTE.park, "fill-opacity": 0.42 },
      },

      // Water separates clearly from paper land using the brand blue tint.
      {
        id: "water",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        paint: { "fill-color": PALETTE.water },
      },
      {
        id: "waterway",
        type: "line",
        source: "omt",
        "source-layer": "waterway",
        paint: {
          "line-color": PALETTE.water,
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 16, 2],
        },
      },

      // Building footprints as faint plate texture at close zooms.
      {
        id: "building",
        type: "fill",
        source: "omt",
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-color": PALETTE.surface,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, 0.5],
          "fill-outline-color": PALETTE.border,
        },
      },

      // Street casings — hairline ink, weighted only by width so the map
      // stays monochrome. Minor streets barely register; motorways read.
      {
        id: "roads",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["!=", ["get", "class"], "ferry"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": PALETTE.text,
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            0.07,
            14,
            0.16,
            17,
            0.24,
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            [
              "match",
              ["get", "class"],
              ["motorway", "trunk"],
              0.45,
              ["primary"],
              0.3,
              ["secondary", "tertiary"],
              0.18,
              0.08,
            ],
            14,
            [
              "match",
              ["get", "class"],
              ["motorway", "trunk"],
              1.35,
              ["primary"],
              0.95,
              ["secondary", "tertiary"],
              0.65,
              0.34,
            ],
            18,
            [
              "match",
              ["get", "class"],
              ["motorway", "trunk"],
              6,
              ["primary"],
              4.5,
              ["secondary", "tertiary"],
              3,
              1.6,
            ],
          ],
        },
      },

      // Rail — a light dashed ink line.
      {
        id: "rail",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["==", ["get", "class"], "rail"],
        minzoom: 12,
        paint: {
          "line-color": PALETTE.muted,
          "line-opacity": 0.18,
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.4, 18, 1.2],
          "line-dasharray": [3, 3],
        },
      },

      // Administrative boundaries — faint dashed ink, atlas-plate style.
      {
        id: "boundary",
        type: "line",
        source: "omt",
        "source-layer": "boundary",
        filter: ["<=", ["get", "admin_level"], 6],
        paint: {
          "line-color": PALETTE.muted,
          "line-opacity": 0.15,
          "line-dasharray": [2, 2],
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 16, 1],
        },
      },

      // Water labels use the map sans face and route blue.
      {
        id: "water-labels",
        type: "symbol",
        source: "omt",
        "source-layer": "water_name",
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": [...MAP_FONT_STACKS.regular],
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 16, 14],
          "text-letter-spacing": 0.1,
          "text-max-width": 6,
        },
        paint: {
          "text-color": PALETTE.route,
          "text-opacity": 0.5,
          "text-halo-color": PALETTE.water,
          "text-halo-width": 1,
        },
      },

      // Place labels — neighborhoods, towns, cities — in Inter.
      {
        id: "place-labels",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["city", "town", "suburb", "neighbourhood", "quarter"]],
        ],
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": [...MAP_FONT_STACKS.regular],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            ["match", ["get", "class"], ["city", "town"], 13, 10],
            15,
            ["match", ["get", "class"], ["city", "town"], 20, 14],
          ],
          "text-letter-spacing": 0.08,
          "text-max-width": 7,
          "text-transform": [
            "match",
            ["get", "class"],
            ["neighbourhood", "quarter", "suburb"],
            "uppercase",
            "none",
          ],
        },
        paint: {
          "text-color": PALETTE.text,
          // City / borough names fade out once you're inside the city (z12+), so
          // "New York" / "Brooklyn" don't shout over the neighbourhood plate;
          // neighbourhood labels stay legible throughout.
          "text-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            0.55,
            12,
            ["case", ["in", ["get", "class"], ["literal", ["city", "town"]]], 0, 0.55],
          ],
          "text-halo-color": PALETTE.paper,
          "text-halo-width": 1.4,
        },
      },
    ],
  };
}
