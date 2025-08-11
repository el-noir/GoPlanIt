interface AmadeusTokenResponse {
  type: string
  username: string
  application_name: string
  client_id: string
  token_type: string
  access_token: string
  expires_in: number
  state: string
  scope: string
}

interface AmadeusGeoCode {
  latitude: string
  longitude: string
}

interface AmadeusAddress {
  line?: string
  zip?: string
  countryCode: string
  cityName: string
  stateCode?: string
  latitude?: number
  longitude?: number
}

interface AmadeusActivity {
  id: string
  type: string
  name: string
  shortDescription: string
  geoCode: AmadeusGeoCode
  rating: string
  pictures: string[]
  bookingLink: string
  price: {
    currencyCode: string
    amount: string
  }
}

interface AmadeusCity {
  type: string
  subType: string
  name: string
  iataCode: string
  address: AmadeusAddress
  geoCode: AmadeusGeoCode
}

interface AmadeusTransferOffer {
  type: string
  id: string
  transferType: string
  start: {
    dateTime: string
    locationCode: string
  }
  end: {
    address: AmadeusAddress
    googlePlaceId?: string
    name?: string
  }
  vehicle: {
    code: string
    category: string
    description: string
    seats: Array<{ count: number }>
    baggages: Array<{ count: number; size: string }>
    imageURL?: string
  }
  quotation: {
    monetaryAmount: string
    currencyCode: string
    isEstimated: boolean
  }
  distance: {
    value: number
    unit: string
  }
}

interface AmadeusApiResponse<T> {
  data: T[]
  meta?: {
    count: number
    links?: {
      self: string
      next?: string
      last?: string
    }
  }
  warnings?: Array<{
    code: number
    title: string
    detail: string
  }>
}

interface AmadeusTripPurpose {
  id: string
  probability: string
  result: "LEISURE" | "BUSINESS"
  subType: string
  type: string
}

interface AmadeusMarketInsight {
  type: string
  destination?: string
  period?: string
  subType: string
  analytics: {
    flights?: { score: number }
    travelers: { score: number }
  }
}

class AmadeusService {
  private baseUrl: string
  private clientId: string
  private clientSecret: string
  private accessToken: string | null = null
  private tokenExpiry = 0

  constructor() {
    this.baseUrl = process.env.AMADEUS_BASE_URL || "https://test.api.amadeus.com"
    this.clientId = process.env.AMADEUS_CLIENT_ID!
    this.clientSecret = process.env.AMADEUS_CLIENT_SECRET!

    if (!this.clientId || !this.clientSecret) {
      throw new Error("Amadeus API credentials are required")
    }
  }

  private async getAccessToken(): Promise<string> {
    // Check if current token is still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/security/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.statusText}`)
      }

      const tokenData: AmadeusTokenResponse = await response.json()
      this.accessToken = tokenData.access_token
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000

      return this.accessToken
    } catch (error) {
      throw new Error(`Amadeus authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, string>): Promise<AmadeusApiResponse<T>> {
    const token = await this.getAccessToken()
    const url = new URL(`${this.baseUrl}${endpoint}`)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      throw new Error(`Amadeus API request failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  // City Search API
  async searchCities(keyword: string, countryCode?: string, max = 10): Promise<AmadeusCity[]> {
    const params: Record<string, string> = {
      keyword,
      max: max.toString(),
    }

    if (countryCode) {
      params.countryCode = countryCode
    }

    const response = await this.makeRequest<AmadeusCity>("/v1/reference-data/locations/cities", params)
    return response.data
  }

  // Tours and Activities API
  async searchActivitiesByLocation(latitude: number, longitude: number, radius = 1): Promise<AmadeusActivity[]> {
    const params = {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius: radius.toString(),
    }

    const response = await this.makeRequest<AmadeusActivity>("/v1/shopping/activities", params)
    return response.data
  }

  async searchActivitiesBySquare(north: number, west: number, south: number, east: number): Promise<AmadeusActivity[]> {
    const params = {
      north: north.toString(),
      west: west.toString(),
      south: south.toString(),
      east: east.toString(),
    }

    const response = await this.makeRequest<AmadeusActivity>("/v1/shopping/activities/by-square", params)
    return response.data
  }

  async getActivityById(activityId: string): Promise<AmadeusActivity> {
    const response = await this.makeRequest<AmadeusActivity>(`/v1/shopping/activities/${activityId}`)
    return response.data[0] as AmadeusActivity
  }

  // Transfer Search API
  async searchTransfers(searchParams: {
    startLocationCode: string
    endAddressLine?: string
    endCityName?: string
    endCountryCode?: string
    endGeoCode?: string
    transferType:
      | "PRIVATE"
      | "SHARED"
      | "TAXI"
      | "HOURLY"
      | "AIRPORT_EXPRESS"
      | "AIRPORT_BUS"
      | "HELICOPTER"
      | "PRIVATE_JET"
    startDateTime: string
    passengers: number
  }): Promise<AmadeusTransferOffer[]> {
    const response = await fetch(`${this.baseUrl}/v1/shopping/transfer-offers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(searchParams),
    })

    if (!response.ok) {
      throw new Error(`Transfer search failed: ${response.statusText}`)
    }

    const result: AmadeusApiResponse<AmadeusTransferOffer> = await response.json()
    return result.data
  }

  // Trip Purpose Prediction API
  async predictTripPurpose(
    originLocationCode: string,
    destinationLocationCode: string,
    departureDate: string,
    returnDate?: string,
  ): Promise<AmadeusTripPurpose | undefined> {
    const params: Record<string, string> = {
      originLocationCode,
      destinationLocationCode,
      departureDate,
    }

    if (returnDate) {
      params.returnDate = returnDate
    }

    try {
      const response = await this.makeRequest<AmadeusTripPurpose>("/v1/travel/predictions/trip-purpose", params)
      return response.data && response.data.length > 0 ? response.data[0] : undefined
    } catch (error) {
      console.warn("Trip purpose prediction failed:", error)
      return undefined
    }
  }

  // Market Insights APIs
  async getMostTraveledDestinations(originCityCode: string, period: string): Promise<AmadeusMarketInsight[]> {
    const params = {
      originCityCode,
      period,
    }

    const response = await this.makeRequest<AmadeusMarketInsight>("/v1/travel/analytics/air-traffic/traveled", params)
    return response.data
  }

  async getMostBookedDestinations(originCityCode: string, period: string): Promise<AmadeusMarketInsight[]> {
    const params = {
      originCityCode,
      period,
    }

    const response = await this.makeRequest<AmadeusMarketInsight>("/v1/travel/analytics/air-traffic/booked", params)
    return response.data
  }

  async getBusiestTravelingPeriod(
    cityCode: string,
    period: string,
    direction: "ARRIVING" | "DEPARTING" = "ARRIVING",
  ): Promise<AmadeusMarketInsight[]> {
    const params = {
      cityCode,
      period,
      direction,
    }

    const response = await this.makeRequest<AmadeusMarketInsight>(
      "/v1/travel/analytics/air-traffic/busiest-period",
      params,
    )
    return response.data
  }
}

export const amadeusService = new AmadeusService()
export type { AmadeusCity, AmadeusActivity, AmadeusTransferOffer, AmadeusTripPurpose, AmadeusMarketInsight }
