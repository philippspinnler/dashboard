<template>
  <div class="heizung">
    <h1 class="title">Heizung</h1>

    <div class="metric-grid">
      <span class="metric-label">Status</span>
      <component :is="stateIcon" class="metric-icon" :style="{ color: stateColor }" />
      <span class="metric-value" :style="{ color: stateColor }">{{ stateLabel }}</span>

      <template v-if="roomActual !== null">
        <span class="metric-label">Raum</span>
        <span class="metric-icon"></span>
        <span class="metric-value">
          {{ fmt(roomActual)
          }}<template v-if="roomTarget !== null"><span class="arrow"> → </span>{{ fmt(roomTarget) }}</template>
        </span>
      </template>

      <template v-if="outdoor !== null">
        <span class="metric-label">Außen</span>
        <span class="metric-icon"></span>
        <span class="metric-value">{{ fmt(outdoor) }}</span>
      </template>
    </div>
  </div>
</template>

<script setup>
import FireFlame from 'iconoir-vue/regular/FireFlame'
import SnowFlake from 'iconoir-vue/regular/SnowFlake'
import Minus from 'iconoir-vue/regular/Minus'

const { data } = useWidgetData('/api/heizung', 30000)

// null stays null (so the line hides); numbers pass through.
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))
// '21.5°' — one decimal.
const fmt = (v) => `${Number(v).toFixed(1)}°`

const roomActual = computed(() => num(data.value?.room_actual))
const roomTarget = computed(() => num(data.value?.room_target))
const outdoor = computed(() => num(data.value?.outdoor))

const state = computed(() => {
  if (data.value?.is_cooling) return 'cooling'
  if (data.value?.is_heating) return 'heating'
  return 'idle'
})

const stateLabel = computed(() => ({ heating: 'Heizt', cooling: 'Kühlt', idle: 'Aus' })[state.value])
const stateColor = computed(
  () => ({ heating: '#f97316', cooling: '#38bdf8', idle: 'rgba(255, 255, 255, 0.55)' })[state.value],
)
const stateIcon = computed(() => ({ heating: FireFlame, cooling: SnowFlake, idle: Minus })[state.value])
</script>

<style scoped>
.arrow {
  color: rgba(255, 255, 255, 0.5);
}
</style>
