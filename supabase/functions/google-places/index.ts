const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!GOOGLE_API_KEY) {
    return new Response(JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { placeNames } = await req.json() as { placeNames: string[] }

    if (!Array.isArray(placeNames) || placeNames.length === 0 || placeNames.length > 20) {
      return new Response(JSON.stringify({ error: 'placeNames must be an array of 1-20 strings' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results = await Promise.all(
      placeNames.map(async (name) => {
        try {
          // Text Search to find place
          const searchRes = await fetch(
            `https://places.googleapis.com/v1/places:searchText`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.photos,places.location,places.addressComponents',
              },
              body: JSON.stringify({ textQuery: name, maxResultCount: 1 }),
            }
          )
          const searchData = await searchRes.json()
          const place = searchData.places?.[0]
          if (!place) return { name, found: false }

          // Extract neighborhood from address components
          let neighborhood = ''
          if (place.addressComponents) {
            const nbhd = place.addressComponents.find((c: any) =>
              c.types?.includes('neighborhood') || c.types?.includes('sublocality') || c.types?.includes('sublocality_level_1')
            )
            neighborhood = nbhd?.longText || ''

            if (!neighborhood) {
              const locality = place.addressComponents.find((c: any) => c.types?.includes('locality'))
              neighborhood = locality?.longText || ''
            }
          }

          // Build photo URL
          let photoUrl = ''
          if (place.photos?.[0]?.name) {
            photoUrl = `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=400&maxWidthPx=600&key=${GOOGLE_API_KEY}`
          }

          return {
            name: place.displayName?.text || name,
            placeId: place.id,
            neighborhood,
            photoUrl,
            lat: place.location?.latitude,
            lng: place.location?.longitude,
            found: true,
          }
        } catch (err) {
          console.error(`Error fetching place "${name}":`, err)
          return { name, found: false }
        }
      })
    )

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('google-places error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
