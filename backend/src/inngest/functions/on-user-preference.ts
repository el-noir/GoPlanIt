import { inngest } from "../client.js"
import UserPreference, { type IUserPreference } from "../../models/UserPreference.js"
import { sendMail } from "../../services/mailer.js"
import { cacheService } from "../../services/cache.js"
import { optimizedAmadeusService } from "../../services/amadeusOptimized.js"

interface UserPreferenceCreatedEvent {
  data: {
    preferenceId: string
    userId: string
    priority?: "high" | "normal" | "low"
  }
}

export const onUserPreferenceCreated = inngest.createFunction(
  {
    id: "on-user-preference-created",
    retries: 3,
    concurrency: { limit: 5 }, // Added concurrency control
  },
  { event: "user.preference/created" },

  async ({ event, step }: { event: UserPreferenceCreatedEvent; step: any }) => {
    try {
      const { preferenceId, userId, priority = "normal" } = event.data

      await step.run("set-processing-status", async () => {
        await cacheService.set(
          `processing:${preferenceId}`,
          {
            status: "started",
            progress: 10,
            startedAt: new Date().toISOString(),
          },
          { ttl: 3600 },
        )
      })

      // Step 1: Fetch user preference document
      const pref = await step.run("fetch-preference", async (): Promise<IUserPreference> => {
        const doc = await UserPreference.findById(preferenceId)
        if (!doc) throw new Error(`UserPreference with ID ${preferenceId} not found`)
        return doc
      })

      console.log("STEP 1: Got user preference", pref)

      await step.run("update-status-fetching", async () => {
        await cacheService.set(
          `processing:${preferenceId}`,
          {
            status: "generating",
            progress: 30,
            message: "Fetching travel data from Amadeus...",
          },
          { ttl: 3600 },
        )
      })

      // Step 2: Generate optimized itinerary with Amadeus data
      const itinerary = await step.run("generate-itinerary", async () => {
        return await generateOptimizedItinerary(pref)
      })

      console.log("STEP 2: Itinerary generated", itinerary)

      await step.run("update-status-saving", async () => {
        await cacheService.set(
          `processing:${preferenceId}`,
          {
            status: "saving",
            progress: 80,
            message: "Saving itinerary...",
          },
          { ttl: 3600 },
        )
      })

      // Step 3: Save itinerary back into user preference document
      await step.run("save-itinerary", async (): Promise<void> => {
        await UserPreference.findByIdAndUpdate(pref._id, { itinerary }, { new: true })
      })

      console.log("STEP 3: Updating MongoDB")

      // Step 4: Send enhanced email notification
      await step.run("email-notify", async (): Promise<void> => {
        const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Your ${pref.destination || "Travel"} Itinerary is Ready! 🎉</h2>
            
            <p>Hello,</p>
            
            <p>Great news! We've created a personalized ${itinerary.days?.length || 0}-day itinerary for your trip using real travel data from our partners.</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1e40af;">Your Trip Highlights:</h3>
              <ul>
                <li><strong>Destination:</strong> ${pref.destination || "Your chosen destination"}</li>
                <li><strong>Duration:</strong> ${itinerary.days?.length || 0} days</li>
                <li><strong>Budget:</strong> $${pref.budget || "Flexible"}</li>
               <li><strong>Activities:</strong> ${itinerary.days?.reduce((total: number, day: { activities?: any[] }) => total + (day.activities?.length || 0), 0) || 0} curated experiences</li>
            </div>
            
            <p>Your itinerary includes:</p>
            <ul>
              <li>✈️ Real flight and transfer options</li>
              <li>🏨 Accommodation recommendations</li>
              <li>🎯 Activities based on your interests</li>
              <li>💰 Budget-friendly tips and suggestions</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || "https://goplanit.com"}/itinerary/${preferenceId}" 
                 style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Your Complete Itinerary
              </a>
            </div>
            
            <p>Safe travels!</p>
            
            <p style="color: #6b7280; font-size: 14px;">
              Best regards,<br>
              The GoPlanIt Team
            </p>
          </div>
        `

        await sendMail({
          to: pref.email,
          subject: `Your ${pref.destination || "Travel"} itinerary is ready! 🎉`,
          html: emailContent.trim(),
        })
      })

      await step.run("cleanup", async () => {
        await cacheService.del(`processing:${preferenceId}`)
      })

      return { success: true, itineraryId: preferenceId }
    } catch (error) {
      console.error("❌ Error in itinerary pipeline:", (error as Error).message)

      await cacheService.set(
        `processing:${event.data.preferenceId}`,
        {
          status: "error",
          progress: 0,
          error: (error as Error).message,
        },
        { ttl: 3600 },
      )

      return { success: false, error: (error as Error).message }
    }
  },
)

async function generateOptimizedItinerary(pref: IUserPreference): Promise<any> {
  const cacheKey = `itinerary:${pref._id}`

  // Check cache first
  const cached = await cacheService.get(cacheKey)
  if (cached) return cached

  // Get real travel data from Amadeus
  const [cityData, activities] = await Promise.allSettled([
    optimizedAmadeusService.searchCitiesBatch([pref.destination || ""]),
    pref.destination ? getActivitiesForDestination(pref.destination) : Promise.resolve([]),
  ])

  const cities = cityData.status === "fulfilled" ? cityData.value : []
  const realActivities = activities.status === "fulfilled" ? activities.value : []

  // Generate itinerary with AI using real data
  const itinerary = await generateItineraryWithRealData(pref, cities[0], realActivities)

  // Cache the result
  await cacheService.set(cacheKey, itinerary, { ttl: 7200 }) // 2 hours

  return itinerary
}

async function getActivitiesForDestination(destination: string): Promise<any[]> {
  try {
    const cities = await optimizedAmadeusService.searchCitiesBatch([destination])
    if (cities[0]?.geoCode) {
      return await optimizedAmadeusService.searchActivitiesOptimized(
        cities[0].geoCode.latitude,
        cities[0].geoCode.longitude,
      )
    }
    return []
  } catch (error) {
    console.error("Error fetching activities:", error)
    return []
  }
}

async function generateItineraryWithRealData(pref: IUserPreference, cityInfo: any, activities: any[]): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set")

  const days = Math.max(
    1,
    Math.ceil(
      (new Date(pref.travelDates.end).getTime() - new Date(pref.travelDates.start).getTime()) / (1000 * 60 * 60 * 24),
    ),
  )

  const realActivitiesContext =
    activities.length > 0
      ? `Real available activities: ${activities
          .slice(0, 10)
          .map((a) => `${a.name} (${a.shortDescription})`)
          .join(", ")}`
      : ""

  const cityContext = cityInfo
    ? `City information: ${cityInfo.name}, ${cityInfo.address?.countryCode}, coordinates: ${cityInfo.geoCode?.latitude}, ${cityInfo.geoCode?.longitude}`
    : ""

  const prompt = `You are a world-class professional travel planner AI with access to real travel data.

Generate a detailed itinerary using the following REAL travel data:

${cityContext}
${realActivitiesContext}

User preferences:
- Days: ${days}
- Budget: ${pref.budget || 0} USD
- Interests: ${pref.interests?.join(", ") || "general sightseeing"}
- Transport: ${pref.transportPreferences?.join(", ") || "public transport"}
- Accommodation: ${pref.accommodationPreferences?.join(", ") || "budget hotels"}

Return ONLY valid JSON in this exact format:
{
  "destination": "${pref.destination}",
  "days": [
    {
      "day": 1,
      "activities": [
        {
          "time": "09:00",
          "title": "Activity Name",
          "description": "Detailed description",
          "location": "Specific location",
          "link": "https://booking-link-if-available"
        }
      ]
    }
  ],
  "notes": "Travel tips and recommendations",
  "budgetTips": ["Tip 1", "Tip 2"],
  "suggestedBookings": [
    {
      "type": "hotel",
      "name": "Hotel Name",
      "link": "https://booking-link"
    }
  ]
}`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
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

  try {
    const parsed = JSON.parse(jsonString)

    if (cityInfo) {
      parsed.cityInfo = {
        name: cityInfo.name,
        iataCode: cityInfo.iataCode,
        countryCode: cityInfo.address?.countryCode,
        latitude: cityInfo.geoCode?.latitude,
        longitude: cityInfo.geoCode?.longitude,
      }
    }

    if (activities.length > 0) {
      parsed.availableActivities = activities.slice(0, 5).map((activity) => ({
        id: activity.id,
        name: activity.name,
        description: activity.shortDescription,
        rating: activity.rating?.toString() || "N/A",
        price: activity.price
          ? {
              amount: activity.price.amount,
              currency: activity.price.currencyCode,
            }
          : { amount: "0", currency: "USD" },
        coordinates: activity.geoCode
          ? {
              latitude: activity.geoCode.latitude.toString(),
              longitude: activity.geoCode.longitude.toString(),
            }
          : { latitude: "0", longitude: "0" },
        bookingLink: activity.bookingLink || "",
      }))
    }

    return parsed
  } catch {
    throw new Error("Failed to parse itinerary JSON from AI response")
  }
}
