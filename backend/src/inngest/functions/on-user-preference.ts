import { inngest } from "../client.js"
import UserPreference, { type IUserPreference } from "../../models/UserPreference.js"
import { sendMail } from "../../services/mailer.js"
import type { ItineraryPlan } from "../../services/ai.js"

interface UserPreferenceCreatedEvent {
  data: {
    userPreferenceId: string
  }
}

export const onUserPreferenceCreated = inngest.createFunction(
  {
    id: "on-user-preference-created",
    retries: 3,
  },
  { event: "user.preference/created" },

  async ({ event, step }: { event: UserPreferenceCreatedEvent; step: any }) => {
    try {
      const { userPreferenceId } = event.data

      // Step 1: Fetch user preference document
      const pref = await step.run("fetch-preference", async (): Promise<IUserPreference> => {
        const doc = await UserPreference.findById(userPreferenceId)
        if (!doc) throw new Error(`UserPreference with ID ${userPreferenceId} not found`)
        return doc
      })

      console.log("STEP 1: Got user preference", pref)

      // Step 2: Generate itinerary with direct API call (avoiding nested steps)
      const itinerary = await step.run("generate-itinerary", async (): Promise<ItineraryPlan> => {
        return await generateItinerarySimple(pref)
      })

      console.log("STEP 2: Itinerary generated", itinerary)

      // Step 3: Save itinerary back into user preference document
      await step.run("save-itinerary", async (): Promise<void> => {
        await UserPreference.findByIdAndUpdate(pref._id, { itinerary }, { new: true })
      })

      console.log("STEP 3: Updating MongoDB")

      // Step 4: Notify user via email with dynamic content & link
      await step.run("email-notify", async (): Promise<void> => {
        const emailContent = `
          Hello,

          Your personalized travel itinerary has been successfully generated and is now ready for review.

          You can log in to your account to view the full details and start planning your trip.

          Safe travels!

          Best regards,
          The GoPlanIt Team
        `

        // await sendMail(pref.email, "Your Personalized Travel Itinerary is Ready!", emailContent.trim())
      })

      return { success: true }
    } catch (error) {
      console.error("❌ Error in itinerary pipeline:", (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  },
)

async function generateItinerarySimple(pref: IUserPreference): Promise<ItineraryPlan> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set")

  const days = Math.max(
    1,
    Math.ceil(
      (new Date(pref.travelDates.end).getTime() - new Date(pref.travelDates.start).getTime()) / (1000 * 60 * 60 * 24),
    ),
  )
  const budget = pref.budget ?? 0
  const interests = pref.interests?.join(", ") || "general sightseeing"
  const transport = pref.transportPreferences?.join(", ") || "public transport"
  const accommodation = pref.accommodationPreferences?.join(", ") || "budget hotels"

  const prompt = `You are a world-class professional travel planner AI with deep expertise in personalized trip planning.

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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
          maxOutputTokens: 2048,
        },
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error("No response from Gemini API")
  }

  const match = text.match(/```json\s*([\s\S]*?)\s*```/i)
  const jsonString = match?.[1] || text.trim()

  let parsed
  try {
    parsed = JSON.parse(jsonString)
  } catch {
    throw new Error("Failed to parse itinerary JSON from AI response")
  }

  const plan = parsed
  if (!plan || !Array.isArray(plan.days)) {
    throw new Error("AI returned invalid itinerary structure")
  }

  return plan
}
