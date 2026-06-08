// Reads a JSON-array/object config value. Nuxt's destr() may have already parsed
// the env string into a real object/array, so accept both forms.
export function parseJsonConfig(value, fallback = []) {
  if (value == null || value === '') return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

// Splits a comma-separated config value into a trimmed, non-empty array.
export function parseList(value) {
  if (!value || typeof value !== 'string') return []
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '')
}
