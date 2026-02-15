/** Google Places API Text Search result */
export interface GoogleTextSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types?: string[];
  photos?: GooglePlacePhoto[];
}

/** Google Places API Place Details result */
export interface GooglePlaceDetailsResult {
  name: string;
  formatted_address?: string;
  geometry?: {
    location?: {
      lat: number;
      lng: number;
    };
  };
  types?: string[];
  photos?: GooglePlacePhoto[];
  url?: string;
}

export interface GooglePlacePhoto {
  photo_reference: string;
  height: number;
  width: number;
}

export interface GoogleTextSearchResponse {
  results: GoogleTextSearchResult[];
  status: string;
}

export interface GooglePlaceDetailsResponse {
  result: GooglePlaceDetailsResult;
  status: string;
}
