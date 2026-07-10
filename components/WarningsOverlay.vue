<template>
  <Transition name="overlay-pop">
    <div v-if="hasWarnings" class="overlay-corner warnings-overlay" :class="cornerClass">
      <ul class="warnings-list">
        <li v-for="w in warnings" :key="w.id" class="warning-row">
          <component
            :is="iconFor(w.kind)"
            class="warning-row-icon"
            :class="{ 'is-error': w.severity === 'error' }"
          />
          <span class="warning-name">{{ w.name }}</span>
          <span class="warning-detail" :style="{ color: detailColor(w) }">{{ w.detail }}</span>
        </li>
      </ul>
    </div>
  </Transition>
</template>

<script setup>
// Corner card aggregating home warnings from /api/warnings (low batteries, HA
// `device_class: problem` sensors, and configured watchlist entities like the
// vacuum). Shown only while at least one warning is active. Disabled deployments
// never poll.
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
const cornerClass = useOverlayPosition(cfg.warningsOverlayPosition, 'bottom-left')

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
.warnings-overlay {
  max-width: 44vw;
  padding: 0.8rem 1rem;
  border-radius: 1rem;
  background: rgba(20, 20, 20, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.warnings-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.warning-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.warning-row-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: #ffd24d;
  transform: translateY(0.15rem);
}

.warning-row-icon.is-error {
  color: #ff4d4d;
}

.warning-name {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.warning-detail {
  margin-left: auto;
  padding-left: 0.6rem;
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  text-align: right;
}
</style>
