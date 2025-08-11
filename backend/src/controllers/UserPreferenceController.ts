import type { Request, Response } from "express"
import UserPreference from "../models/UserPreference.js"
import { inngest } from "../inngest/client.js"

export class UserPreferenceController {
  static async createPreference(req: Request, res: Response): Promise<Response> {
    try {
      const {
        userId,
        email,
        travelDates,
        budget,
        interests,
        transportPreferences,
        accommodationPreferences,
        originLocationCode,
        destinationLocationCode,
        travelers,
        tripType,
      } = req.body || {}

      if (!userId || !email || !travelDates?.start || !travelDates?.end) {
        return res.status(400).json({
          message: "Missing required fields: userId, email, travelDates.start, travelDates.end",
        })
      }

      if (!originLocationCode || !destinationLocationCode) {
        return res.status(400).json({
          message: "Missing required location codes for travel planning",
        })
      }

      const startDate = new Date(travelDates.start)
      const endDate = new Date(travelDates.end)

      if (startDate >= endDate) {
        return res.status(400).json({
          message: "End date must be after start date",
        })
      }

      if (startDate < new Date()) {
        return res.status(400).json({
          message: "Start date cannot be in the past",
        })
      }

      const doc = await UserPreference.create({
        userId,
        email,
        travelDates,
        budget,
        interests,
        transportPreferences,
        accommodationPreferences,
        originLocationCode,
        destinationLocationCode,
        travelers: travelers || 1,
        tripType: tripType || "LEISURE",
      })

      await inngest.send({
        name: "user.preference/created",
        data: {
          userPreferenceId: String(doc._id),
          originLocationCode,
          destinationLocationCode,
          travelDates,
        },
      })

      return res.status(202).json({
        id: doc._id,
        message: "Preference saved; AI-powered itinerary with real travel data will be generated.",
        estimatedProcessingTime: "2-3 minutes",
      })
    } catch (error) {
      console.error("Error creating user preference:", error)
      return res.status(500).json({
        message: "Failed to create preference",
        error: process.env.NODE_ENV === "development" ? (error as Error).message : undefined,
      })
    }
  }

  static async getPreference(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params

      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: "Invalid preference ID format" })
      }

      const doc = await UserPreference.findById(id)

      if (!doc) {
        return res.status(404).json({ message: "Preference not found" })
      }

      return res.json({
        ...doc.toObject(),
        processingStatus: doc.itinerary ? "completed" : "processing",
      })
    } catch (error) {
      console.error("Error fetching user preference:", error)
      return res.status(500).json({
        message: "Failed to fetch preference",
        error: process.env.NODE_ENV === "development" ? (error as Error).message : undefined,
      })
    }
  }

  static async getUserPreferences(req: Request, res: Response): Promise<Response> {
    try {
      const { userId } = req.params
      const { page = 1, limit = 10 } = req.query

      const preferences = await UserPreference.find({ userId })
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))

      const total = await UserPreference.countDocuments({ userId })

      return res.json({
        preferences,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      })
    } catch (error) {
      console.error("Error fetching user preferences:", error)
      return res.status(500).json({
        message: "Failed to fetch preferences",
        error: process.env.NODE_ENV === "development" ? (error as Error).message : undefined,
      })
    }
  }

  static async updatePreference(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const updates = req.body

      const allowedUpdates = ["interests", "budget", "transportPreferences", "accommodationPreferences"]
      const filteredUpdates = Object.keys(updates)
        .filter((key) => allowedUpdates.includes(key))
        .reduce((obj: any, key) => {
          obj[key] = updates[key]
          return obj
        }, {})

      const doc = await UserPreference.findByIdAndUpdate(
        id,
        { ...filteredUpdates, updatedAt: new Date() },
        { new: true, runValidators: true },
      )

      if (!doc) {
        return res.status(404).json({ message: "Preference not found" })
      }

      return res.json(doc)
    } catch (error) {
      console.error("Error updating user preference:", error)
      return res.status(500).json({
        message: "Failed to update preference",
        error: process.env.NODE_ENV === "development" ? (error as Error).message : undefined,
      })
    }
  }
}
