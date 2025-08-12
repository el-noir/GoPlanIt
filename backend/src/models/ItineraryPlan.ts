import type { AmadeusCity, AmadeusActivity, AmadeusTripPurpose, AmadeusTransferOffer } from "../services/types.js"

export interface Activity {
  id: string
  name: string
  description: string
  duration: string
  cost: string
  location: string
  bookingUrl?: string
}

export interface Day {
  day: number
  date: string
  activities: Activity[]
}

export interface ItineraryPlan {
  id: string
  destination: string
  totalDays: number
  estimatedCost: number
  days: Day[]
  cityInfo?: AmadeusCity
  tripPurpose?: AmadeusTripPurpose
  transferOptions?: AmadeusTransferOffer[]
  createdAt?: Date
  updatedAt?: Date
}

// Re-export types for convenience
export type { AmadeusCity, AmadeusActivity, AmadeusTripPurpose, AmadeusTransferOffer }
