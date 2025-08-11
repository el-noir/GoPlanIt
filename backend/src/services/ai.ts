import {
  amadeusService,
  type AmadeusCity,
  type AmadeusActivity,
  type AmadeusTransferOffer,
  type AmadeusTripPurpose,
} from "./amadeus.js"

export interface Activity {
  time: string
  title: string
  description: string
  location?: string
  link?: string
  amadeusId?: string
  rating?: string
  price?: {
    amount: string
    currency: string
  }
  coordinates?: {
    latitude: string
    longitude: string
  }
}

export interface Day {
  day: number
  activities: Activity[]
}

export interface SuggestedBooking {
  type: "hotel" | "transport" | "activity"
  name: string
  link: string
  transferData?: AmadeusTransferOffer
}

export interface ItineraryPlan {
  destination: string
  days: Day[]
  notes?: string
  budgetTips?: string[]
  suggestedBookings?: SuggestedBooking[]
  cityInfo?: AmadeusCity
  tripPurpose?: AmadeusTripPurpose
  availableActivities?: AmadeusActivity[]
  transferOptions?: AmadeusTransferOffer[]
}

export interface TravelDates {
  start: Date
  end: Date
}

export interface UserPreference {
  userId: string
  email: string
  travelDates: TravelDates
  budget?: number
  interests?: string[]
  transportPreferences?: string[]
  accommodationPreferences?: string[]
  destination?: string
  originCity?: string
}

async function enrichWithAmadeusData(pref: UserPreference): Promise<{
  cityInfo?: AmadeusCity
  activities: AmadeusActivity[]
  tripPurpose?: AmadeusTripPurpose
  transferOptions: AmadeusTransferOffer[]
}> {
  try {
    const result: {
      cityInfo?: AmadeusCity
      activities: AmadeusActivity[]
      tripPurpose?: AmadeusTripPurpose
      transferOptions: AmadeusTransferOffer[]
    } = {
      activities: [],
      transferOptions: [],
    }

    // Search for destination city
    if (pref.destination) {
      const cities = await amadeusService.searchCities(pref.destination, undefined, 1)
      if (cities.length > 0) {
        result.cityInfo = cities[0] as AmadeusCity
      }

      // Get activities for the destination
      if (result.cityInfo?.geoCode) {
        result.activities = await amadeusService.searchActivitiesByLocation(
          Number.parseFloat(result.cityInfo.geoCode.latitude),
          Number.parseFloat(result.cityInfo.geoCode.longitude),
          5, // 5km radius
        )
      }

      // Predict trip purpose if origin city is provided
      if (pref.originCity && result.cityInfo?.iataCode) {
        try {
          const originCities = await amadeusService.searchCities(pref.originCity, undefined, 1)
          if (originCities[0]?.iataCode) {
            const purpose = await amadeusService.predictTripPurpose(
              originCities[0].iataCode,
              result.cityInfo.iataCode,
              pref.travelDates.start.toISOString().split("T")[0] as string,
              pref.travelDates.end.toISOString().split("T")[0],
            )
            if (purpose) {
              result.tripPurpose = purpose
            }
          }
        } catch (error) {
          console.warn("Trip purpose prediction failed:", error)
        }
      }

      // Search for transfer options if origin is provided
      if (pref.originCity && result.cityInfo) {
        try {
          const originCities = await amadeusService.searchCities(pref.originCity, undefined, 1)
          if (originCities[0]?.iataCode) {
            result.transferOptions = await amadeusService.searchTransfers({
              startLocationCode: originCities[0].iataCode,
              endCityName: result.cityInfo.name,
              endCountryCode: result.cityInfo.address.countryCode,
              transferType: "PRIVATE",
              startDateTime: pref.travelDates.start.toISOString(),
              passengers: 2,
            })
          }
        } catch (error) {
          console.warn("Transfer search failed:", error)
        }
      }
    }

    return result
  } catch (error) {
    console.warn("Amadeus data enrichment failed:", error)
    return { activities: [], transferOptions: [] }
  }
}

function buildPrompt(
  pref: UserPreference,
  amadeusData: {
    cityInfo?: AmadeusCity
    activities: AmadeusActivity[]
    tripPurpose?: AmadeusTripPurpose
    transferOptions: AmadeusTransferOffer[]
  },
): string {
  const days: number = Math.max(
    1,
    Math.ceil(
      (new Date(pref.travelDates.end).getTime() - new Date(pref.travelDates.start).getTime()) / (1000 * 60 * 60 * 24),
    ),
  )
  const budget: number = pref.budget ?? 0
  const interests: string = pref.interests?.join(", ") || "general sightseeing"
  const transport: string = pref.transportPreferences?.join(", ") || "public transport"
  const accommodation: string = pref.accommodationPreferences?.join(", ") || "budget hotels"

  // Build activities context from Amadeus data
  const activitiesContext =
    amadeusData.activities.length > 0
      ? `\n\nREAL AVAILABLE ACTIVITIES (use these in your itinerary):\n${amadeusData.activities
          .map(
            (activity) =>
              `- ${activity.name}: ${activity.shortDescription} (Rating: ${activity.rating}/5, Price: ${activity.price.amount} ${activity.price.currencyCode})`,
          )
          .join("\n")}`
      : ""

  const tripPurposeContext = amadeusData.tripPurpose
    ? `\n\nTRIP PURPOSE ANALYSIS: This trip is predicted to be ${amadeusData.tripPurpose.result.toLowerCase()} (${Math.round(Number.parseFloat(amadeusData.tripPurpose.probability) * 100)}% confidence)`
    : ""

  const cityContext = amadeusData.cityInfo
    ? `\n\nDESTINATION INFO: ${amadeusData.cityInfo.name}, ${amadeusData.cityInfo.address.countryCode} (IATA: ${amadeusData.cityInfo.iataCode})`
    : ""

  return `You are a world-class professional travel planner AI with deep expertise in personalized trip planning.
  
  Your task: Generate a detailed, day-by-day travel itinerary perfectly tailored to the user's preferences using REAL activity data.
  
  REQUIREMENTS:
  - Respond with a single JSON object only.
  - Do NOT include any markdown syntax, code fences, comments, explanations, or extraneous text.
  - PRIORITIZE using the real activities provided below in your itinerary
  - Include actual booking links and location coordinates when available
  - Strictly adhere to the following JSON schema:
  
  {
    "destination": string,
    "days": [
      {
        "day": number,
        "activities": [
          {
            "time": string,
            "title": string,
            "description": string,
            "location"?: string,
            "link"?: string,
            "amadeusId"?: string,
            "rating"?: string,
            "price"?: {
              "amount": string,
              "currency": string
            },
            "coordinates"?: {
              "latitude": string,
              "longitude": string
            }
          }
        ]
      }
    ],
    "notes"?: string,
    "budgetTips"?: string[],
    "suggestedBookings"?: [
      {
        "type": "hotel" | "transport" | "activity",
        "name": string,
        "link": string
      }
    ]
  }
  
  INPUT DETAILS:
  - Number of days: ${days}
  - Approximate budget: ${budget} USD
  - Interests: ${interests}
  - Transport preferences: ${transport}
  - Accommodation preferences: ${accommodation}${cityContext}${tripPurposeContext}${activitiesContext}
  
  ADDITIONAL INSTRUCTIONS:
  - Use the real activities provided above whenever possible
  - Include amadeusId, rating, price, and coordinates for real activities
  - Provide actual booking links from the activity data
  - Suggest realistic timing and logistics between activities
  - If information is unavailable, omit optional fields gracefully
  - Ensure all dates and times are realistic and feasible within each day
  
  Strictly output valid JSON only — no extra text.`
}

export async function generateItinerary(pref: UserPreference): Promise<ItineraryPlan> {
  const apiKey: string | undefined = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set")

  const amadeusData = await enrichWithAmadeusData(pref)

  const prompt: string = buildPrompt(pref, amadeusData)

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!generatedText) {
      throw new Error("No content generated by Gemini API")
    }

    // Parse the JSON response
    const match: RegExpMatchArray | null = generatedText.match(/```json\s*([\s\S]*?)\s*```/i)
    const fenced: string | undefined = match?.[1]
    const jsonString: string = typeof fenced === "string" && fenced.length > 0 ? fenced : generatedText.trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonString)
    } catch {
      throw new Error("Failed to parse itinerary JSON from AI response")
    }

    const plan = parsed as ItineraryPlan
    if (!plan || !Array.isArray(plan.days)) {
      throw new Error("AI returned invalid itinerary structure")
    }

    // Create enriched plan by building a new object with only defined properties
    const enrichedPlan: ItineraryPlan = { ...plan }

    if (amadeusData.cityInfo) {
      enrichedPlan.cityInfo = amadeusData.cityInfo
    }
    if (amadeusData.tripPurpose) {
      enrichedPlan.tripPurpose = amadeusData.tripPurpose
    }
    if (amadeusData.activities.length > 0) {
      enrichedPlan.availableActivities = amadeusData.activities
    }
    if (amadeusData.transferOptions.length > 0) {
      enrichedPlan.transferOptions = amadeusData.transferOptions
    }

    return enrichedPlan
  } catch (error) {
    throw new Error(`Failed to generate itinerary: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
