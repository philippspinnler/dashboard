<template>
  <Transition name="overlay-pop">
    <ul v-if="hasWarnings" class="warnings-list">
      <li v-for="w in warnings" :key="w.id" class="warning-chip">
        <component
          :is="iconFor(w.kind)"
          class="warning-icon"
          :class="{ 'is-error': w.severity === 'error' }"
        />
        <span class="warning-name">{{ w.name }}</span>
        <span class="warning-detail" :style="{ color: detailColor(w) }">{{ w.detail }}<span v-if="w.note" class="warning-note">{{ w.note }}</span></span>
      </li>
    </ul>
  </Transition>
</template>

<script setup>
// Home warnings from /api/warnings (low batteries, HA `device_class: problem`
// sensors, humidity, configured watchlist entities like the vacuum), one per
// line at the bottom of the left content column. The list is part of the page
// flow: it never covers a widget, takes no space while nothing is wrong, and
// each extra warning takes one line from the widgets above (the calendar drops
// whole events to fit). Disabled deployments never poll.
import BatteryWarning from 'iconoir-vue/regular/BatteryWarning'
import WarningTriangle from 'iconoir-vue/regular/WarningTriangle'
import Droplet from 'iconoir-vue/regular/Droplet'
import Wrench from 'iconoir-vue/regular/Wrench'

// Icon per warning kind; humidity gets a droplet, maintenance a wrench, and
// everything else (watch/problem) a warning triangle.
function iconFor(kind) {
  if (kind === 'battery') return BatteryWarning
  if (kind === 'humidity') return Droplet
  if (kind === 'maintenance') return Wrench
  return WarningTriangle
}

const cfg = useRuntimeConfig().public
const enabled = cfg.warningsOverlayEnabled === true || cfg.warningsOverlayEnabled === 'true'

const data = enabled ? useWidgetData('/api/warnings', 300000).data : ref(null)

const warnings = computed(() => data.value?.warnings || [])
const hasWarnings = computed(() => warnings.value.length > 0)

// Battery rows keep the battery-state-card color steps (red <10, yellow <25);
// everything else uses the default text color.
function detailColor(w) {
  if (w.kind !== 'battery' || typeof w.level !== 'number') return 'rgba(255, 255, 255, 0.9)'
  if (w.level < 10) return '#ff4d4d'
  if (w.level < 25) return '#ffd24d'
  return 'rgba(255, 255, 255, 0.9)'
}
</script>

<style scoped>
.warnings-list {
  list-style: none;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  margin: 0.4rem 0.4rem 0 1.9rem; /* left edge lines up with the widgets' inner edge */
  font-size: 0.95rem;
}

.warning-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-sizing: border-box;
  height: 2.3rem;
  max-width: 100%;
  padding: 0 0.9rem;
  border-radius: 1rem;
  white-space: nowrap;
  background: rgba(20, 20, 20, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.warning-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: #ffd24d;
}

.warning-icon.is-error {
  color: #ff4d4d;
}

.warning-name {
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
}

.warning-note {
  margin-left: 0.3em;
  color: rgba(255, 255, 255, 0.85);
}

.warning-detail {
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
</style>
