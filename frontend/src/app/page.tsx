"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { TravelPlanningForm } from "@/components/TravelPlan"
import { ItineraryResults } from "@/components/Results"

export default function Home() {
  const [step, setStep] = useState<"input" | "processing" | "results">("input")
  const [preferenceId, setPreferenceId] = useState<string>("")

  const handlePlanCreated = (id: string) => {
    setPreferenceId(id)
    setStep("processing")
  }

  const handleResultsReady = () => {
    setStep("results")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">GoPlanIt</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Tell us how you're feeling and where you'd like to go. Our AI will create the perfect itinerary for you.
          </p>
        </div>

        {step === "input" && <TravelPlanningForm onPlanCreated={handlePlanCreated} />}

        {step === "processing" && (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
                  <h3 className="text-lg font-semibold mb-2">Creating Your Perfect Trip</h3>
                  <p className="text-gray-600 mb-4">
                    Our AI is analyzing your preferences and finding the best destinations, activities, and experiences
                    for you.
                  </p>
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                      <span>Analyzing your travel mood...</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse delay-100"></div>
                      <span>Finding perfect destinations...</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse delay-200"></div>
                      <span>Curating activities and experiences...</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "results" && <ItineraryResults preferenceId={preferenceId} onStartOver={() => setStep("input")} />}
      </div>
    </div>
  )
}
