// Single-frame snapshot of the doorbell camera via Home Assistant — used as the
// overlay poster / a lightweight fallback if the continuous stream is too heavy.
// Buffers one JPEG, exactly like server/api/sonos/image-proxy.get.ts.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const baseUrl = config.homeAssistantUrl
  const token = config.homeAssistantToken
  const cameraEntity = config.doorbellCameraEntity

  if (!baseUrl || !token || !cameraEntity) {
    throw createError({ statusCode: 503, statusMessage: 'Doorbell camera not configured.' })
  }

  let res
  try {
    res = await $fetch.raw(`${baseUrl}/api/camera_proxy/${cameraEntity}`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arrayBuffer',
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Failed to fetch the camera snapshot.' })
  }

  setHeader(event, 'content-type', res.headers.get('content-type') || 'image/jpeg')
  setHeader(event, 'cache-control', 'no-store')
  return Buffer.from(res._data as ArrayBuffer)
})
