import UserPreference from "../models/UserPreference.js"
import { optimizedAmadeusService } from "./amadeusOptimized.js"
import { cacheService } from "./cache.js"
import type { ItineraryPlan, AmadeusCity, AmadeusActivity, AmadeusTripPurpose, Day } from "../models/ItineraryPlan.js"

interface OptimizedItineraryRequest {
  preferenceId: string
  userId: string
  priority: "high" | "normal" | "low"
}

export class ItineraryOptimizer {
  async generateOptimizedItinerary(request: OptimizedItineraryRequest): Promise<ItineraryPlan> {
    const { preferenceId, userId } = request

    // Check if itinerary already exists in cache
    const cacheKey = `itinerary:${preferenceId}`
    const cached = await cacheService.get<ItineraryPlan>(cacheKey)
    if (cached) return cached

    // Get user preference with minimal fields first
    const preference = await UserPreference.findById(preferenceId)
      .select("destination originLocationCode destinationLocationCode travelDates budget interests")
      .lean()

    if (!preference) throw new Error("Preference not found")

    // Batch all external API calls
    const [cityInfo, activities, tripPurpose] = await Promise.allSettled([
      this.getCityInfoOptimized(preference.destination || ""),
      this.getActivitiesOptimized(preference.destination || "", preference.interests || []) ,
      this.predictTripPurposeOptimized(      preference.originLocationCode || "",
      preference.destinationLocationCode || ""),
    ])

    // Build itinerary with available data
    const itinerary: ItineraryPlan = {
      id: preferenceId,
      destination: preference.destination || "Unknown Destination",
     totalDays: this.calculateDays(preference.travelDates.start, preference.travelDates.end),
      estimatedCost: preference.budget || 0,
      days: await this.generateDaysOptimized(
        cityInfo.status === "fulfilled" ? cityInfo.value : null,
        activities.status === "fulfilled" ? activities.value : [],
        preference.travelDates,
      ),
      ...(cityInfo.status === "fulfilled" && cityInfo.value && { cityInfo: cityInfo.value }),
      ...(tripPurpose.status === "fulfilled" && tripPurpose.value && { tripPurpose: tripPurpose.value }),
    }

    // Cache the result for 2 hours
    await cacheService.set(cacheKey, itinerary, { ttl: 7200 })

    return itinerary
  }

  private async getCityInfoOptimized(destination: string): Promise<AmadeusCity | null> {
    const cities = await optimizedAmadeusService.searchCitiesBatch([destination])
    return cities[0] || null
  }

  private async getActivitiesOptimized(destination: string, interests: string[]): Promise<AmadeusActivity[]> {
    // Get city coordinates first
    const city = await this.getCityInfoOptimized(destination)
    if (!city?.geoCode) return []

    return optimizedAmadeusService.searchActivitiesOptimized(city.geoCode.latitude, city.geoCode.longitude)
  }

  private async predictTripPurposeOptimized(origin: string, destination: string): Promise<AmadeusTripPurpose | null> {
    const cacheKey = `trip-purpose:${origin}:${destination}`
    return cacheService.getOrSet(
      cacheKey,
      async () => {
        // Implementation for trip purpose prediction
        return null // Placeholder
      },
      { ttl: 604800 }, // 7 days cache
    )
  }

  private async generateDaysOptimized(
    cityInfo: AmadeusCity | null,
    activities: AmadeusActivity[],
    travelDates: { start: Date; end: Date },
  ): Promise<Day[]> {
    const days: Day[] = []
    const totalDays = this.calculateDays(travelDates.start, travelDates.end)

    // Distribute activities across days intelligently
    const activitiesPerDay = Math.ceil(activities.length / totalDays)

    for (let i = 0; i < totalDays; i++) {
      const dayActivities = activities.slice(i * activitiesPerDay, (i + 1) * activitiesPerDay)

      days.push({
        day: i + 1,
        date: new Date(travelDates.start.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split("T")[0] as string,
    // Change the activity mapping to:
activities: dayActivities.map((activity) => ({
  id: activity.id,
  name: activity.name,
  description: activity.shortDescription,
  duration: "2-3 hours",
  cost: activity.price?.amount ? `$${activity.price.amount}` : "Free",
  location: activity.geoCode ? `${activity.geoCode.latitude}, ${activity.geoCode.longitude}` : "TBD",
  bookingUrl: activity.bookingLink || "", // Provide default empty string
})),
      })
    }

    return days
  }

  private calculateDays(start: Date, end: Date): number {
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  }
}

export const itineraryOptimizer = new ItineraryOptimizer()
