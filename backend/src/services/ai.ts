import { createAgent, gemini } from '@inngest/agent-kit'
import type { IUserPreference, ItineraryPlan } from '../models/UserPreference.js'

function buildPrompt(pref: IUserPreference): string {
    const days = Math.max(
      1,
      Math.ceil(
        (new Date(pref.travelDates.end).getTime() - new Date(pref.travelDates.start).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const budget = pref.budget ?? 0;
    const interests = pref.interests?.join(', ') || 'general sightseeing';
    const transport = pref.transportPreferences?.join(', ') || 'public transport';
    const accommodation = pref.accommodationPreferences?.join(', ') || 'budget hotels';
  
    return `You are a world-class professional travel planner AI with deep expertise in personalized trip planning.
  
  Your task: Generate a detailed, day-by-day travel itinerary perfectly tailored to the user's preferences.
  
  REQUIREMENTS:
  - Respond with a single JSON object only.
  - Do NOT include any markdown syntax, code fences, comments, explanations, or extraneous text.
  - Strictly adhere to the following JSON schema:
  
  {
    "destination": string,
    "days": [
      {
        "day": number,
        "activities": [
          {
            "time": string,
            "title": string,
            "description": string,
            "location"?: string,
            "link"?: string
          }
        ]
      }
    ],
    "notes"?: string,
    "budgetTips"?: string[],
    "suggestedBookings"?: [
      {
        "type": "hotel" | "transport" | "activity",
        "name": string,
        "link": string
      }
    ]
  }
  
  INPUT DETAILS:
  - Number of days: ${days}
  - Approximate budget: ${budget} USD
  - Interests: ${interests}
  - Transport preferences: ${transport}
  - Accommodation preferences: ${accommodation}
  
  ADDITIONAL INSTRUCTIONS:
  - Suggest activities, accommodations, and transport options that align with the user's preferences.
  - Provide hyperlinks only to reputable booking or information platforms.
  - DO NOT perform any bookings or reservations.
  - If information is unavailable, omit optional fields gracefully.
  - Ensure all dates and times are realistic and feasible within each day.
  
  Strictly output valid JSON only — no extra text.`;
  }
  
  export async function generateItinerary(pref: IUserPreference): Promise<ItineraryPlan> {
    const apiKey = process.env.GEMINI_API_KEY as string;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  
    const agent = createAgent({
      model: gemini({ model: 'gemini-1.5-flash-8b', apiKey }),
      name: 'GoPlanIt',
      system: `You are a highly skilled AI travel planner. Output ONLY a valid JSON object strictly following the schema requested.  
  No markdown, no code fences, no explanations, no comments, no extra text.`,
    });
  
    const prompt = buildPrompt(pref);
    const response = await agent.run(prompt);
    const first = Array.isArray(response.output) ? response.output[0] : response.output;
    const raw = typeof first === 'string' ? first : JSON.stringify(first ?? '');
    const match = raw.match(/```json\s*([\s\S]*?)\s*```/i);
    const fenced = match?.[1];
    const jsonString = (typeof fenced === 'string' && fenced.length > 0) ? fenced : raw.trim();
  
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Failed to parse itinerary JSON from AI response');
    }
  
    const plan = parsed as ItineraryPlan;
    if (!plan || !Array.isArray(plan.days)) {
      throw new Error('AI returned invalid itinerary structure');
    }
    return plan;
  }
  