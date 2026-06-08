// Proxies Home Assistant's MJPEG camera stream through our origin so the kiosk
// <img> needs no HA token (the Authorization header stays server-side). Mirrors
// server/api/sonos/image-proxy.get.ts, but streams the continuous multipart body
// instead of buffering a single image.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const baseUrl = config.homeAssistantUrl
  const token = config.homeAssistantToken
  const cameraEntity = config.doorbellCameraEntity

  if (!baseUrl || !token || !cameraEntity) {
    throw createError({ statusCode: 503, statusMessage: 'Doorbell camera not configured.' })
  }

  const url = `${baseUrl}/api/camera_proxy_stream/${cameraEntity}`

  let res
  try {
    res = await $fetch.raw(url, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'stream',
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Failed to reach the camera stream.' })
  }

  setHeader(event, 'content-type', res.headers.get('content-type') || 'multipart/x-mixed-replace')
  setHeader(event, 'cache-control', 'no-store')
  return sendStream(event, res._data as ReadableStream)
})
