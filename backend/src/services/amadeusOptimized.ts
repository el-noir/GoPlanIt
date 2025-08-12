import { cacheService } from "./cache.js"
import type { AmadeusCity, AmadeusActivity } from "./types.js" // Declare AmadeusCity and AmadeusActivity

export class OptimizedAmadeusService {
  private baseURL: string
  private clientId: string
  private clientSecret: string
  private accessToken: string | null = null
  private tokenExpiry = 0

  constructor() {
    this.baseURL = process.env.AMADEUS_BASE_URL || "https://test.api.amadeus.com"
    this.clientId = process.env.AMADEUS_CLIENT_ID!
    this.clientSecret = process.env.AMADEUS_CLIENT_SECRET!
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now()

    // Check if token is still valid
    if (this.accessToken && now < this.tokenExpiry) {
      return this.accessToken
    }

    // Try to get token from cache first
    const cachedToken = await cacheService.get<{ token: string; expiry: number }>("amadeus:token")
    if (cachedToken && now < cachedToken.expiry) {
      this.accessToken = cachedToken.token
      this.tokenExpiry = cachedToken.expiry
      return this.accessToken
    }

    // Get new token
    const response = await fetch(`${this.baseURL}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    })

    const data = await response.json()
    this.accessToken = data.access_token
    this.tokenExpiry = now + data.expires_in * 1000 - 60000 // 1 minute buffer

    // Cache the token
    await cacheService.set(
      "amadeus:token",
      {
        token: this.accessToken,
        expiry: this.tokenExpiry,
      },
      { ttl: data.expires_in - 60 },
    )

    return this.accessToken as string
  }

  async searchCitiesBatch(queries: string[]): Promise<AmadeusCity[]> {
    const cacheKeys = queries.map((q) => `amadeus:city:${q.toLowerCase()}`)
    const cached = await cacheService.mget<AmadeusCity>(cacheKeys)

    const results: AmadeusCity[] = []
    const uncachedQueries: string[] = []
    const uncachedIndices: number[] = []

    cached.forEach((city, index) => {
      if (city) {
        results[index] = city
      } else {
        uncachedQueries.push(queries[index] !) 
        uncachedIndices.push(index)
      }
    })

    // Fetch uncached cities in parallel
    if (uncachedQueries.length > 0) {
      const promises = uncachedQueries.map((query) => this.searchCitySingle(query))
      const freshCities = await Promise.allSettled(promises)

// In the searchCitiesBatch method:

freshCities.forEach((result, i) => {
  const originalIndex = uncachedIndices[i];
  if (result.status === "fulfilled" && result.value && originalIndex !== undefined) {
    results[originalIndex] = result.value;
    // Cache the result - add null check for cacheKeys[originalIndex]
    const cacheKey = cacheKeys[originalIndex];
    if (cacheKey) {
      cacheService.set(cacheKey, result.value, { ttl: 86400 }); // 24 hours
    }
  }
});
    }

    return results.filter(Boolean)
  }

  private async searchCitySingle(query: string): Promise<AmadeusCity | null> {
    try {
      const token = await this.getAccessToken()
      const response = await fetch(
        `${this.baseURL}/v1/reference-data/locations/cities?keyword=${encodeURIComponent(query)}&max=1`,
        { headers: { Authorization: `Bearer ${token}` } },
      )

      const data = await response.json()
      return data.data?.[0] || null
    } catch (error) {
      console.error("City search error:", error)
      return null
    }
  }

  async searchActivitiesOptimized(latitude: number, longitude: number, radius = 20): Promise<AmadeusActivity[]> {
    const cacheKey = `amadeus:activities:${latitude}:${longitude}:${radius}`

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          const token = await this.getAccessToken()
          const response = await fetch(
            `${this.baseURL}/v1/shopping/activities?latitude=${latitude}&longitude=${longitude}&radius=${radius}`,
            { headers: { Authorization: `Bearer ${token}` } },
          )

          const data = await response.json()
          return data.data || []
        } catch (error) {
          console.error("Activities search error:", error)
          return []
        }
      },
      { ttl: 21600 }, // 6 hours cache
    )
  }
}

export const optimizedAmadeusService = new OptimizedAmadeusService()
