import { Router, Request, Response } from 'express'
import UserPreference from '../models/UserPreference.js'
import { inngest } from '../inngest/client.js'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      email,
      travelDates,
      budget,
      interests,
      transportPreferences,
      accommodationPreferences,
    } = req.body || {}

    if (!userId || !email || !travelDates?.start || !travelDates?.end) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const doc = await UserPreference.create({
      userId,
      email,
      travelDates,
      budget,
      interests,
      transportPreferences,
      accommodationPreferences,
    })

    await inngest.send({
      name: 'user.preference/created',
      data: { userPreferenceId: String(doc._id) },
    })

    return res.status(202).json({ id: doc._id, message: 'Preference saved; itinerary will be generated.' })
  } catch (error) {
    return res.status(500).json({ message: (error as Error).message })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await UserPreference.findById(req.params.id)
    if (!doc) return res.status(404).json({ message: 'Not found' })
    return res.json(doc)
  } catch (error) {
    return res.status(500).json({ message: (error as Error).message })
  }
})

export default router

