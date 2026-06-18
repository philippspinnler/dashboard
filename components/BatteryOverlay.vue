<template>
  <Transition name="overlay-pop">
    <div v-if="hasLow" class="overlay-corner battery-overlay" :class="cornerClass">
      <div class="battery-header">
        <BatteryWarning class="battery-icon" />
        <span>Schwache Batterien</span>
      </div>
      <ul class="battery-list">
        <li v-for="b in low" :key="b.entity_id" class="battery-row">
          <span class="battery-name">{{ b.name }}</span>
          <span class="battery-level" :style="{ color: levelColor(b.level) }">{{ b.level }}%</span>
        </li>
      </ul>
    </div>
  </Transition>
</template>

<script setup>
// Compact card listing Home Assistant `device_class: battery` entities at/below
// the configured threshold (see /api/batteries). Shown in a configurable corner
// only while at least one battery is low. Disabled deployments never poll.
import BatteryWarning from 'iconoir-vue/regular/BatteryWarning'

const cfg = useRuntimeConfig().public
const enabled = cfg.batteryOverlayEnabled === true || cfg.batteryOverlayEnabled === 'true'
const cornerClass = useOverlayPosition(cfg.batteryOverlayPosition, 'bottom-left')

const data = enabled ? useWidgetData('/api/batteries', 300000).data : ref(null)

const low = computed(() => data.value?.low || [])
const hasLow = computed(() => low.value.length > 0)

// Match the HA battery-state-card color steps: red < 10, yellow < 25.
function levelColor(level) {
  if (level < 10) return '#ff4d4d'
  if (level < 25) return '#ffd24d'
  return 'rgba(255, 255, 255, 0.9)'
}
</script>

<style scoped>
.battery-overlay {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 26vw;
  padding: 0.8rem 1rem;
  border-radius: 1rem;
  background: rgba(20, 20, 20, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.battery-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.05rem;
  color: #fff;
}

.battery-icon {
  width: 1.4rem;
  height: 1.4rem;
  flex-shrink: 0;
  color: #ffd24d;
}

.battery-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.battery-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1.2rem;
}

.battery-name {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.battery-level {
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
</style>
