// Maps a configured corner to the .overlay-corner modifier class shared by
// conditional corner overlays (Sonos now; a future low-battery overlay, etc.).
// Pair with `<Transition name="overlay-pop">` and the .overlay-corner styles in
// assets/css/main.css. The doorbell stays its own fixed top-right overlay.
const CORNERS = {
  'top-left': 'is-top-left',
  'top-right': 'is-top-right',
  'bottom-left': 'is-bottom-left',
  'bottom-right': 'is-bottom-right',
}

export function useOverlayPosition(position, fallback = 'bottom-right') {
  return CORNERS[position] || CORNERS[fallback]
}
