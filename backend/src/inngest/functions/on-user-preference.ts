import { inngest } from '../client.js'
import UserPreference, { ItineraryPlan, IUserPreference } from '../../models/UserPreference.js'
import { sendMail } from '../../services/mailer.js'
import { generateItinerary } from '../../services/ai.js'

export const onUserPreferenceCreated = inngest.createFunction(
  {
    id: 'on-user-preference-created',
    retries: 3, // increased retries to 3 for resilience
  },
  { event: 'user.preference/created' },

  async ({ event, step }) => {
    try {
      const { userPreferenceId } = event.data as { userPreferenceId: string }

      // Step 1: Fetch user preference document
      const pref = await step.run('fetch-preference', async () => {
        const doc = await UserPreference.findById(userPreferenceId)
        if (!doc) throw new Error(`UserPreference with ID ${userPreferenceId} not found`)
        return doc
      }) as IUserPreference

      // Step 2: Generate itinerary with AI service
      const itinerary = await step.run('generate-itinerary', async (): Promise<ItineraryPlan> => {
        return generateItinerary(pref)
      })

      // Step 3: Save itinerary back into user preference document
      await step.run('save-itinerary', async () => {
        await UserPreference.findByIdAndUpdate(pref._id, { itinerary }, { new: true })
      })

      // Step 4: Notify user via email with dynamic content & link
      await step.run('email-notify', async () => {
        const emailContent = `
          Hello,

          Your personalized travel itinerary has been successfully generated and is now ready for review.

          You can log in to your account to view the full details and start planning your trip.

          Safe travels!

          Best regards,
          The GoPlanIt Team
        `

        await sendMail(
          pref.email,
          'Your Personalized Travel Itinerary is Ready!',
          emailContent.trim()
        )
      })

      return { success: true }
    } catch (error) {
      console.error('❌ Error in itinerary pipeline:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }
)
