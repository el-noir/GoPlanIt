import 'dotenv/config'
import app from "./app.js"
import { connectDatabase } from './config/db/index.js'

async function startServer() {
  try {
    await connectDatabase()
    const PORT = Number(process.env.PORT) || 3000
    app.listen(PORT, () => {
      console.log(`Server on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()