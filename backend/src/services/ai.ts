import { createAgent, gemini } from "@inngest/agent-kit"

export interface Activity {
  time: string
  title: string
  description: string
  location?: string
  link?: string
}

export interface Day {
  day: number
  activities: Activity[]
}

export interface SuggestedBooking {
  type: "hotel" | "transport" | "activity"
  name: string
  link: string
}

export interface ItineraryPlan {
  destination: string
  days: Day[]
  notes?: string
  budgetTips?: string[]
  suggestedBookings?: SuggestedBooking[]
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
}

function buildPrompt(pref: UserPreference): string {
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

  return `You are a world-class professional travel planner AI with deep expertise in personalized trip planning.
  
  Your task: Generate a detailed, day-by-day travel itinerary perfectly tailored to the user's preferences.
  
  REQUIREMENTS:
  - Respond with a single JSON object only.
  - Do NOT include any markdown syntax, code fences, comments, explanations, or extraneous text.
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
            "link"?: string
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
  - Accommodation preferences: ${accommodation}
  
  ADDITIONAL INSTRUCTIONS:
  - Suggest activities, accommodations, and transport options that align with the user's preferences.
  - Provide hyperlinks only to reputable booking or information platforms.
  - DO NOT perform any bookings or reservations.
  - If information is unavailable, omit optional fields gracefully.
  - Ensure all dates and times are realistic and feasible within each day.
  
  Strictly output valid JSON only — no extra text.`
}

export async function generateItinerary(pref: UserPreference): Promise<ItineraryPlan> {
  const apiKey: string | undefined = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set")

  const agent = createAgent({
    model: gemini({ model: "gemini-1.5-flash-8b", apiKey }),
    name: "GoPlanIt",
    system: `You are a highly skilled AI travel planner. Output ONLY a valid JSON object strictly following the schema requested.  
  No markdown, no code fences, no explanations, no comments, no extra text.`,
  })

  const prompt: string = buildPrompt(pref)
  const response = await agent.run(prompt)
  const first = Array.isArray(response.output) ? response.output[0] : response.output
  const raw: string = typeof first === "string" ? first : JSON.stringify(first ?? "")
  const match: RegExpMatchArray | null = raw.match(/```json\s*([\s\S]*?)\s*```/i)
  const fenced: string | undefined = match?.[1]
  const jsonString: string = typeof fenced === "string" && fenced.length > 0 ? fenced : raw.trim()

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
  return plan
}
