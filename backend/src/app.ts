import 'dotenv/config'
import express from "express"
import type { Request, Response } from "express"
import cors from "cors"
import type { CorsOptions } from "cors"
import cookieParser from "cookie-parser"
import preferencesRouter from './routes/preferences.js'

const app = express()

const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true)

    const allowedOrigins = [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      process.env.CORS_ORIGIN,
    ].filter((o): o is string => Boolean(o))

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error("Not allowed by CORS"))
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Origin",
    "Content-Type",
    "Authorization",
  ],
}

app.use(cors(corsOptions))

// Body parsing middleware
app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(cookieParser())

app.use('/preferences', preferencesRouter)

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Server is running successfully",
    timestamp: new Date().toISOString(),
  })
})

export default app
