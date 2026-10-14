// WebRTC signaling for the doorbell camera via Home Assistant's built-in go2rtc
// (websocket `camera/webrtc/offer`). Unlike /api/doorbell/stream (HA stitches
// stills into MJPEG at ~2 fps), this gets the camera's real 30 fps H.264 stream.
//
// The browser POSTs its SDP offer (ICE gathering already complete, so no
// browser→HA trickle). We answer with an NDJSON stream of HA's session events
// ({type: 'answer'|'candidate'|'error', ...}) and keep the response open: HA
// closes the WebRTC session when its websocket subscription ends, so the HTTP
// request's lifetime IS the video's lifetime — the client aborts it on dismiss.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const baseUrl = config.homeAssistantUrl
  const token = config.homeAssistantToken
  const cameraEntity = config.doorbellCameraEntity

  if (!baseUrl || !token || !cameraEntity) {
    throw createError({ statusCode: 503, statusMessage: 'Doorbell camera not configured.' })
  }

  const { offer } = await readBody(event)
  if (typeof offer !== 'string' || !offer.startsWith('v=')) {
    throw createError({ statusCode: 400, statusMessage: 'Missing SDP offer.' })
  }

  const ws = new WebSocket(`${baseUrl.replace(/^http/, 'ws')}/api/websocket`)
  const close = () => ws.close()
  event.node.res.on('close', close) // res, not req: req 'close' fires once the body is read

  setHeader(event, 'content-type', 'application/x-ndjson')
  setHeader(event, 'cache-control', 'no-store')

  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
        } catch {
          close() // client already gone
        }
      }
      const fail = (message: string) => {
        send({ type: 'error', message })
        close()
      }

      ws.onmessage = ({ data }) => {
        const msg = JSON.parse(String(data))
        if (msg.type === 'auth_required') {
          ws.send(JSON.stringify({ type: 'auth', access_token: token }))
        } else if (msg.type === 'auth_ok') {
          ws.send(JSON.stringify({ id: 1, type: 'camera/webrtc/offer', entity_id: cameraEntity, offer }))
        } else if (msg.type === 'auth_invalid') {
          fail('HA auth failed')
        } else if (msg.type === 'result' && !msg.success) {
          fail(msg.error?.message || 'HA rejected the WebRTC offer')
        } else if (msg.type === 'event') {
          send(msg.event)
          if (msg.event?.type === 'error') close()
        }
      }
      ws.onerror = () => fail('HA websocket error')
      ws.onclose = () => {
        event.node.res.off('close', close)
        try {
          controller.close()
        } catch {}
      }
    },
    cancel: close,
  })
})
