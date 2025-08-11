import express from "express"
import dotenv from 'dotenv'

dotenv.config({
    path: "./.env"
})

const app = express()

const PORT = process.env.PORT || 3000

app.listen(PORT, () =>{
    console.log(`Server on http://localhost:${PORT}`)
})