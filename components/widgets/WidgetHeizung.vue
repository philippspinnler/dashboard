<template>
  <div class="heizung">
    <h1 class="title">Heizung</h1>

    <div class="state" :style="{ color: stateColor }">
      <component :is="stateIcon" class="state-icon" />
      <span class="state-label">{{ stateLabel }}</span>
    </div>

    <div class="metrics">
      <template v-if="roomActual !== null">
        <span class="m-label">Raum</span>
        <span class="m-value">
          {{ fmt(roomActual)
          }}<template v-if="roomTarget !== null"><span class="arrow"> → </span>{{ fmt(roomTarget) }}</template>
        </span>
      </template>
      <template v-if="outdoor !== null">
        <span class="m-label">Außen</span>
        <span class="m-value">{{ fmt(outdoor) }}</span>
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
/* inline-flex / inline-grid follow the column's text-align (right column → right),
   matching how WidgetInverter aligns itself within the column. */
.state {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.state-icon {
  width: 1.9rem;
  height: 1.9rem;
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.55));
}

.state-label {
  font-size: 1.9rem;
  font-weight: 400;
  line-height: 1.05;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.55);
}

.metrics {
  display: inline-grid;
  grid-template-columns: auto auto;
  align-items: center;
  column-gap: 0.7rem;
  row-gap: 0.45rem;
  margin-top: 0.55rem;
}

.m-label {
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.92rem;
  letter-spacing: 0.04em;
  text-align: right;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.55);
}

.m-value {
  font-size: 1.5rem;
  font-weight: 400;
  line-height: 1.05;
  color: #fff;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.arrow {
  color: rgba(255, 255, 255, 0.5);
}
</style>
