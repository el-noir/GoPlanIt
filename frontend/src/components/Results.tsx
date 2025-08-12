"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { MapPin, Clock, Star, DollarSign, Calendar, Users, Loader2, RefreshCw } from "lucide-react"
import { api } from "@/lib/api"

interface ItineraryResultsProps {
  preferenceId: string
  onStartOver: () => void
}

interface Activity {
  name: string
  description: string
  duration: string
  price?: string
  rating?: number
  location: string
  bookingUrl?: string
}

interface Day {
  day: number
  date: string
  activities: Activity[]
  theme: string
}

interface ItineraryData {
  _id: string
  destination: string
  budget: number
  travelers: number
  travelDates: {
    start: string
    end: string
  }
  itinerary?: {
    days: Day[]
    totalEstimatedCost: number
    recommendations: string[]
  }
  status: string
}

export function ItineraryResults({ preferenceId, onStartOver }: ItineraryResultsProps) {
  const [data, setData] = useState<ItineraryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItinerary = async () => {
    try {
      const result = await api.getUserPreference(preferenceId)

      if (result.success) {
        setData(result.data)
        if (result.data.status === "completed" && result.data.itinerary) {
          setIsLoading(false)
        }
      } else {
        throw new Error(result.message || "Failed to fetch itinerary")
      }
    } catch (err) {
      console.error("API Error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchItinerary()

    // Poll for updates every 3 seconds until completed
    const interval = setInterval(() => {
      if (isLoading) {
        fetchItinerary()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [preferenceId, isLoading])

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={onStartOver}>Start Over</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading || !data?.itinerary) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <h3 className="text-lg font-semibold mb-2">Still working on your itinerary...</h3>
            <p className="text-gray-600">This usually takes 1-2 minutes. We'll update automatically when ready!</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Perfect Trip to {data.destination}</h2>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(data.travelDates.start).toLocaleDateString()} -{" "}
              {new Date(data.travelDates.end).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {data.travelers} {data.travelers === 1 ? "traveler" : "travelers"}
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Budget: ${data.budget}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={onStartOver}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Plan Another Trip
        </Button>
      </div>

      <Tabs defaultValue="itinerary" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="itinerary">Day-by-Day Itinerary</TabsTrigger>
          <TabsTrigger value="overview">Trip Overview</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="itinerary" className="space-y-4">
          <ScrollArea className="h-[600px]">
            {data.itinerary.days.map((day) => (
              <Card key={day.day} className="mb-4">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>
                      Day {day.day} - {day.theme}
                    </span>
                    <Badge variant="outline">{day.date}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {day.activities.map((activity, index) => (
                      <div key={index} className="border-l-2 border-blue-200 pl-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-lg">{activity.name}</h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="h-4 w-4" />
                            {activity.duration}
                          </div>
                        </div>
                        <p className="text-gray-600 mb-2">{activity.description}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {activity.location}
                          </div>
                          {activity.rating && (
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              {activity.rating}
                            </div>
                          )}
                          {activity.price && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              {activity.price}
                            </div>
                          )}
                        </div>
                        {activity.bookingUrl && (
                          <Button size="sm" className="mt-2" asChild>
                            <a href={activity.bookingUrl} target="_blank" rel="noopener noreferrer">
                              Book Now
                            </a>
                          </Button>
                        )}
                        {index < day.activities.length - 1 && <Separator className="mt-4" />}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Trip Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Total Estimated Cost</h4>
                  <p className="text-2xl font-bold text-green-600">${data.itinerary.totalEstimatedCost}</p>
                  <p className="text-sm text-gray-600">
                    For {data.travelers} {data.travelers === 1 ? "person" : "people"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Trip Duration</h4>
                  <p className="text-2xl font-bold">{data.itinerary.days.length} Days</p>
                  <p className="text-sm text-gray-600">
                    {new Date(data.travelDates.start).toLocaleDateString()} -{" "}
                    {new Date(data.travelDates.end).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>Additional Recommendations</CardTitle>
              <CardDescription>Extra tips and suggestions for your trip</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {data.itinerary.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p>{rec}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
