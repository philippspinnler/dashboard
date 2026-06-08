// Reads widget layout + display flags from runtimeConfig.public.
// Replaces the old build-time/.env + window.ENV (config.js) lookup.
export function useWidgetConfig() {
  const cfg = useRuntimeConfig().public

  const parseWidgets = (value) => {
    if (!value || value.trim() === '') return []
    return value
      .split(',')
      .map((w) => w.trim())
      .filter((w) => w !== '')
  }

  return {
    topLeftWidgets: parseWidgets(cfg.widgetsTopLeft),
    topRightWidgets: parseWidgets(cfg.widgetsTopRight),
    leftWidgets: parseWidgets(cfg.widgetsLeft),
    rightWidgets: parseWidgets(cfg.widgetsRight),
    bottomWidgets: parseWidgets(cfg.widgetsBottom),
    // Env overrides are parsed by destr(), so "true" may arrive as boolean true.
    enableGlassmorphism: cfg.enableGlassmorphism === true || cfg.enableGlassmorphism === 'true',
  }
}
