<template>
  <Transition name="overlay-pop">
    <div v-if="hasWarnings" class="warnings-bar">
      <ul ref="list" class="warnings-list">
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
      <span v-if="hidden" class="warning-chip warnings-more">+{{ hidden }} weitere</span>
    </div>
  </Transition>
</template>

<script setup>
// One-line bar of home warnings from /api/warnings (low batteries, HA
// `device_class: problem` sensors, humidity, configured watchlist entities like
// the vacuum). It sits in the page flow right above the bottom widget zone, so
// it never covers a widget, and takes no space while nothing is wrong. Warnings
// that don't fit the line collapse into "+N weitere". Disabled deployments
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

const data = enabled ? useWidgetData('/api/warnings', 300000).data : ref(null)

const warnings = computed(() => data.value?.warnings || [])
const hasWarnings = computed(() => warnings.value.length > 0)

// The list wraps, but only its first line is visible (fixed height + overflow
// hidden). Chips that wrapped are counted and shown as "+N weitere". Two passes:
// the "+N" chip itself takes room, so recount once it is on screen.
const list = ref(null)
const hidden = ref(0)
function wrapped() {
  const items = [...(list.value?.children || [])]
  return items.filter((el) => el.offsetTop > items[0].offsetTop).length
}
async function measure() {
  hidden.value = 0
  await nextTick()
  if (!wrapped()) return
  hidden.value = wrapped()
  await nextTick()
  hidden.value = wrapped()
}
watch(warnings, measure, { flush: 'post' })
onMounted(() => {
  measure()
  document.fonts?.ready.then(measure) // chip widths change once the webfont is in
})

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
.warnings-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin: 0.4rem 1.9rem 0; /* lines up with the widgets' inner edge */
  font-size: 0.95rem;
}

.warnings-list {
  list-style: none;
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  height: 2.3rem; /* one chip line; wrapped chips are clipped and counted */
  overflow: hidden;
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

.warnings-more {
  flex: 0 0 auto;
  color: rgba(255, 255, 255, 0.85);
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
