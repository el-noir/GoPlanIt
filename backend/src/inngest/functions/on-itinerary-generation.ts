import { inngest } from "../client.js"
import { itineraryOptimizer } from "../../services/itinerary.js"
import UserPreference  from "../../models/UserPreference.js"
import { sendMail } from "../../services/mailer.js"
import { cacheService } from "../../services/cache.js"

export const optimizedItineraryGeneration = inngest.createFunction(
  {
    id: "optimized-itinerary-generation",
    retries: 3,
    concurrency: { limit: 10 }, // Process up to 10 itineraries concurrently
  },
  { event: "user.preference/created" },
  async ({ event, step }) => {
    const { preferenceId, userId, priority = "normal" } = event.data

    // Set processing status
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

    // Generate optimized itinerary
    const itinerary = await step.run("generate-itinerary", async () => {
      await cacheService.set(
        `processing:${preferenceId}`,
        {
          status: "generating",
          progress: 50,
          message: "Fetching travel data...",
        },
        { ttl: 3600 },
      )

      return itineraryOptimizer.generateOptimizedItinerary({
        preferenceId,
        userId,
        priority,
      })
    })

    // Update database with generated itinerary
    await step.run("save-itinerary", async () => {
      await cacheService.set(
        `processing:${preferenceId}`,
        {
          status: "saving",
          progress: 80,
          message: "Saving itinerary...",
        },
        { ttl: 3600 },
      )

      await UserPreference.findByIdAndUpdate(
        preferenceId,
        {
          $set: {
            itinerary,
            status: "completed",
            completedAt: new Date(),
          },
        },
        { new: true },
      )
    })

    // Send notification email
    await step.run("send-notification", async () => {
      const preference = await UserPreference.findById(preferenceId).select("email destination").lean()

      if (preference?.email) {
        await sendMail({
          to: preference.email,
          subject: `Your ${preference.destination} itinerary is ready!`,
          html: `
            <h2>Your personalized itinerary is ready!</h2>
            <p>We've created a detailed ${itinerary.totalDays}-day itinerary for your trip to ${preference.destination}.</p>
            <p><a href="${process.env.FRONTEND_URL}/itinerary/${preferenceId}">View your itinerary</a></p>
          `,
        })
      }
    })

    // Clean up processing status
    await step.run("cleanup", async () => {
      await cacheService.del(`processing:${preferenceId}`)
    })

    return { success: true, itineraryId: preferenceId }
  },
)
