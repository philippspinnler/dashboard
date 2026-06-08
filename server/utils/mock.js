import { mocks } from '../mocks/index.js'

// Auto-imported into server routes by Nitro.

export function isMockEnabled(event) {
  // Env overrides are parsed by destr(), so "true" may arrive as boolean true.
  const v = useRuntimeConfig(event).public.useMockData
  return v === true || v === 'true'
}

export function getMock(name) {
  return mocks[name] ?? null
}
