// Health check (parity with the old FastAPI `GET /`).
export default defineEventHandler(() => ({ message: 'Hello World' }))
