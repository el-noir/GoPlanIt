import mongoose, { type Document, type Schema } from "mongoose"

export interface IActivity {
  time: string
  title: string
  description: string
  location?: string
  link?: string
  amadeusId?: string
  rating?: string
  price?: {
    amount: string
    currency: string
  }
  coordinates?: {
    latitude: string
    longitude: string
  }
}

export interface IDay {
  day: number
  activities: IActivity[]
}

export interface ISuggestedBooking {
  type: "hotel" | "transport" | "activity"
  name: string
  link: string
}

export interface IItinerary {
  destination?: string
  days?: IDay[]
  notes?: string
  budgetTips?: string[]
  suggestedBookings?: ISuggestedBooking[]
  cityInfo?: {
    name: string
    iataCode: string
    countryCode: string
    stateCode?: string
    latitude: number
    longitude: number
  }
  tripPurpose?: {
    result: "LEISURE" | "BUSINESS"
    probability: string
  }
  availableActivities?: Array<{
    id: string
    name: string
    description: string
    rating: string
    price: {
      amount: string
      currency: string
    }
    coordinates: {
      latitude: string
      longitude: string
    }
    bookingLink: string
  }>
  transferOptions?: Array<{
    id: string
    transferType: string
    price: {
      amount: string
      currency: string
    }
    vehicle: {
      description: string
      seats: number
    }
    distance: {
      value: number
      unit: string
    }
  }>
}

export interface ITravelDates {
  start: Date
  end: Date
}

export interface IUserPreference extends Document {
  userId: string
  email: string
  travelDates: ITravelDates
  budget?: number
  interests?: string[]
  transportPreferences?: string[]
  accommodationPreferences?: string[]
  destination?: string
  originCity?: string
  originLocationCode?: string
  destinationLocationCode?: string
  travelers?: number
  tripType?: "LEISURE" | "BUSINESS"
  itinerary?: IItinerary
  createdAt: Date
  updatedAt: Date
}

const userPreferenceSchema: Schema<IUserPreference> = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    travelDates: {
      start: {
        type: Date,
        required: true,
      },
      end: {
        type: Date,
        required: true,
      },
    },
    budget: {
      type: Number,
      default: 0,
    },
    interests: [
      {
        type: String,
      },
    ],
    transportPreferences: [
      {
        type: String,
      },
    ],
    accommodationPreferences: [
      {
        type: String,
      },
    ],
    destination: {
      type: String,
    },
    originCity: {
      type: String,
    },
    originLocationCode: {
      type: String,
    },
    destinationLocationCode: {
      type: String,
    },
    travelers: {
      type: Number,
      default: 1,
      min: 1,
      max: 9,
    },
    tripType: {
      type: String,
      enum: ["LEISURE", "BUSINESS"],
      default: "LEISURE",
    },
    itinerary: {
      destination: String,
      days: [
        {
          day: Number,
          activities: [
            {
              time: String,
              title: String,
              description: String,
              location: String,
              link: String,
              amadeusId: String,
              rating: String,
              price: {
                amount: String,
                currency: String,
              },
              coordinates: {
                latitude: String,
                longitude: String,
              },
            },
          ],
        },
      ],
      notes: String,
      budgetTips: [String],
      suggestedBookings: [
        {
          type: {
            type: String,
            enum: ["hotel", "transport", "activity"],
          },
          name: String,
          link: String,
        },
      ],
      cityInfo: {
        name: String,
        iataCode: String,
        countryCode: String,
        stateCode: String,
        latitude: Number,
        longitude: Number,
      },
      tripPurpose: {
        result: {
          type: String,
          enum: ["LEISURE", "BUSINESS"],
        },
        probability: String,
      },
      availableActivities: [
        {
          id: String,
          name: String,
          description: String,
          rating: String,
          price: {
            amount: String,
            currency: String,
          },
          coordinates: {
            latitude: String,
            longitude: String,
          },
          bookingLink: String,
        },
      ],
      transferOptions: [
        {
          id: String,
          transferType: String,
          price: {
            amount: String,
            currency: String,
          },
          vehicle: {
            description: String,
            seats: Number,
          },
          distance: {
            value: Number,
            unit: String,
          },
        },
      ],
    },
  },
  {
    timestamps: true,
  },
)

const UserPreference = mongoose.model<IUserPreference>("UserPreference", userPreferenceSchema)

export default UserPreference
