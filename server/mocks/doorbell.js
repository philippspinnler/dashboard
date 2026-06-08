// At rest, nobody is ringing (pressedAt null). The overlay UI is exercised in
// offline/dev mode via the keydown trigger in composables/useDoorbell.js.
export default {
  pressedAt: null,
  cameraEntity: 'camera.mock_doorbell',
  friendlyName: 'Doorbell',
}
