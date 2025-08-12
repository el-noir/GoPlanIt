"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, DollarSign, Mail } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"

interface TravelPlanningFormProps {
  onPlanCreated: (preferenceId: string) => void
}

export function TravelPlanningForm({ onPlanCreated }: TravelPlanningFormProps) {
  const [travelDescription, setTravelDescription] = useState("")
  const [email, setEmail] = useState("")
  const [budget, setBudget] = useState("")
  const [travelers, setTravelers] = useState("2")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await api.createUserPreference({
        userId: "user_" + Date.now(), // Generate a simple user ID
        email,
        travelDescription, // This is the natural language input
        budget: budget ? Number.parseInt(budget) : 2000,
        travelers: Number.parseInt(travelers),
        tripType: "LEISURE",
        travelDates: {
          start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 1 week from now
          end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 2 weeks from now
        },
        originLocationCode: "NYC", // Default, will be enhanced by AI
        destinationLocationCode: "PAR", // Default, will be enhanced by AI
      })

      console.log("API Response:", response) // Debug log to see actual response

      // Handle both possible response formats
      const preferenceId = response.id || response._id || response.data?.id || response.data?._id
      const message = response.message || response.data?.message || "Travel plan created successfully!"

      if (preferenceId) {
        toast.success("Travel plan started!", {
          description: message,
        })
        onPlanCreated(preferenceId)
      } else {
        console.error("No preference ID found in response:", response)
        throw new Error("Failed to get preference ID from response")
      }
    } catch (error) {
      console.error("API Error:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to create travel plan"
      toast.error("Failed to create your travel plan", {
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const suggestions = [
    "I'm feeling stressed and need a relaxing beach vacation",
    "I want an adventure-filled trip with hiking and outdoor activities",
    "I'm craving culture and history, maybe somewhere in Europe",
    "I need a romantic getaway for my anniversary",
    "I want to explore vibrant nightlife and amazing food",
    "I'm looking for a family-friendly destination with kids activities",
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Describe Your Perfect Trip</CardTitle>
          <CardDescription>
            Tell us how you're feeling and what kind of experience you're looking for. Our AI will handle the rest!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="description">How are you feeling? What kind of trip do you want?</Label>
              <Textarea
                id="description"
                placeholder="I'm feeling adventurous and want to explore somewhere with amazing food and culture..."
                value={travelDescription}
                onChange={(e) => setTravelDescription(e.target.value)}
                className="min-h-[120px] mt-2"
                required
              />
              <div className="mt-3">
                <p className="text-sm text-gray-600 mb-2">Need inspiration? Try one of these:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-blue-50 text-xs"
                      onClick={() => setTravelDescription(suggestion)}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="travelers" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Travelers
                </Label>
                <Input
                  id="travelers"
                  type="number"
                  min="1"
                  max="10"
                  value={travelers}
                  onChange={(e) => setTravelers(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="budget" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Budget (optional)
                </Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="2000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || !travelDescription.trim()}>
              {isLoading ? "Creating Your Trip..." : "Plan My Perfect Trip"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
