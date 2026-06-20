import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(helmet())
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } })
})

app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`)
})

export default app
