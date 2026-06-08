<template>
  <div class="inverter">
    <h1 class="title">Wechselrichter</h1>

    <div class="metrics">
      <span class="m-label">Solar</span>
      <SunLight class="m-icon" :style="{ color: '#fbbf24' }" />
      <span class="m-value">{{ pv.num }}<span class="m-unit">{{ pv.unit }}</span></span>

      <span class="m-label">Speicher</span>
      <component :is="getBatteryIcon" class="m-icon" :style="{ color: batteryAccent }" />
      <span class="m-value m-value--battery">
        <span>{{ batterySOCFormatted }}<span class="m-unit">&nbsp;%</span></span>
        <span v-if="batteryFlow" class="bat-flow" :style="{ color: batteryFlowColor }">
          {{ batteryFlowText }} {{ batteryFlowWatts }}
        </span>
      </span>

      <span class="m-label">Haus</span>
      <Home class="m-icon" :style="{ color: '#f97316' }" />
      <span class="m-value">{{ home.num }}<span class="m-unit">{{ home.unit }}</span></span>

      <span class="m-label">{{ gridLabel }}</span>
      <component :is="getGridIcon" class="m-icon" :style="{ color: gridAccent }" />
      <span class="m-value" :style="{ color: gridAccent }">{{ grid.num }}<span class="m-unit">{{ grid.unit }}</span></span>
    </div>
  </div>
</template>

<script setup>
import SunLight from 'iconoir-vue/regular/SunLight'
import BatteryEmpty from 'iconoir-vue/regular/BatteryEmpty'
import Battery25 from 'iconoir-vue/regular/Battery25'
import Battery50 from 'iconoir-vue/regular/Battery50'
import Battery75 from 'iconoir-vue/regular/Battery75'
import BatteryFull from 'iconoir-vue/regular/BatteryFull'
import Home from 'iconoir-vue/regular/Home'
import EvPlug from 'iconoir-vue/regular/EvPlug'
import EvPlugCharging from 'iconoir-vue/regular/EvPlugCharging'

const { data } = useWidgetData('/api/inverter', 10000)

const pvPower = computed(() => parseFloat(data.value?.pv_power) || 0)
const gridConsumption = computed(() => parseFloat(data.value?.grid_consumption) || 0)
const gridFeedin = computed(() => parseFloat(data.value?.grid_feedin) || 0)
const powerConsumption = computed(() => parseFloat(data.value?.power_consumption) || 0)
const batterySOC = computed(() => parseFloat(data.value?.battery_state_of_charge) || 0)

// kW with 1 decimal at >= 1000 W, else whole watts.
const formatPower = (watts) => (watts >= 1000 ? `${(watts / 1000).toFixed(1)} kW` : `${Math.round(watts)} W`)

// Split "405 W" -> { num, unit } so the unit can be dimmed.
const split = (s) => {
  const str = String(s)
  const i = str.indexOf(' ')
  return i < 0 ? { num: str, unit: '' } : { num: str.slice(0, i), unit: ' ' + str.slice(i + 1) }
}

const pv = computed(() => split(formatPower(pvPower.value)))
const home = computed(() => split(formatPower(powerConsumption.value)))
// Show one decimal until truly full, then a clean "100".
const batterySOCFormatted = computed(() => (batterySOC.value >= 100 ? '100' : batterySOC.value.toFixed(1)))

// Battery charge direction (signed power: + charging / - discharging).
const batteryPower = computed(() => parseFloat(data.value?.battery_power) || 0)
const FLOW_DEADBAND = 15 // W — ignore near-zero idle flow
const batteryFlow = computed(() => {
  const p = batteryPower.value
  if (p > FLOW_DEADBAND) return 'charging'
  if (p < -FLOW_DEADBAND) return 'discharging'
  return null
})
const batteryFlowText = computed(() => (batteryFlow.value === 'charging' ? 'lädt' : 'entlädt'))
const batteryFlowColor = computed(() => (batteryFlow.value === 'charging' ? '#22c55e' : '#fb923c'))
const batteryFlowWatts = computed(() => formatPower(Math.abs(batteryPower.value)))

const getBatteryIcon = computed(() => {
  if (batterySOC.value > 80) return BatteryFull
  if (batterySOC.value > 60) return Battery75
  if (batterySOC.value > 40) return Battery50
  if (batterySOC.value > 20) return Battery25
  return BatteryEmpty
})

const batteryAccent = computed(() => {
  const s = batterySOC.value
  if (s > 80) return '#22c55e'
  if (s > 60) return '#84cc16'
  if (s > 40) return '#eab308'
  if (s > 20) return '#f59e0b'
  return '#ef4444'
})

const getGridIcon = computed(() => (gridFeedin.value > 0 ? EvPlugCharging : EvPlug))

const grid = computed(() => {
  if (gridConsumption.value > 0) return split(formatPower(gridConsumption.value))
  if (gridFeedin.value > 0) return split(formatPower(gridFeedin.value))
  return split('0 W')
})

const gridAccent = computed(() => {
  if (gridConsumption.value > 0) return '#f87171'
  if (gridFeedin.value > 0) return '#34d399'
  return 'rgba(255, 255, 255, 0.55)'
})

const gridLabel = computed(() => {
  if (gridConsumption.value > 0) return 'Bezug'
  if (gridFeedin.value > 0) return 'Einspeisung'
  return 'Netz'
})
</script>

<style scoped>
/* inline-grid is inline-level, so it follows the column's text-align (right in
   the right column, left in the left) — keeping the widget aligned like its
   siblings and never overflowing/clipping. */
.metrics {
  display: inline-grid;
  grid-template-columns: auto auto auto;
  align-items: center;
  column-gap: 0.7rem;
  row-gap: 0.45rem;
  margin-top: 0.4rem;
}

.m-label {
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.92rem;
  letter-spacing: 0.04em;
  text-align: right;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.55);
}

.m-icon {
  width: 1.45rem;
  height: 1.45rem;
  justify-self: center;
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.55));
}

.m-value {
  font-size: 1.7rem;
  font-weight: 400;
  line-height: 1.05;
  color: #fff;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.m-unit {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
}

/* Battery cell stacks SOC above a small charge/discharge indicator */
.m-value--battery {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.05;
}

.bat-flow {
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  white-space: nowrap;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
}
</style>
