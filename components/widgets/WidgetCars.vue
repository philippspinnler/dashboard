<template>
  <div>
    <h1 class="title">{{ cars.length === 1 ? 'Auto' : 'Autos' }}</h1>
    <div v-for="car in cars" :key="car.name" class="car">
      <p class="subtitle" v-if="cars.length > 1">{{ car.name }}</p>
      <div class="metric-grid">
        <span class="metric-label">Akku</span>
        <component
          :is="getBatteryIcon(car.charge_procentage)"
          class="metric-icon"
          :style="{ color: batteryColor(car.charge_procentage) }"
        />
        <span class="metric-value">{{ car.charge_procentage }}<span class="metric-unit">&nbsp;%</span></span>

        <span class="metric-label">Reichweite</span>
        <EvPlugCharging class="metric-icon" :style="{ color: '#60a5fa' }" />
        <span class="metric-value">{{ car.range }}<span class="metric-unit">&nbsp;km</span></span>

        <template v-if="car.charging">
          <span class="metric-label">Geladen</span>
          <Clock class="metric-icon" :style="{ color: 'rgba(255, 255, 255, 0.7)' }" />
          <span class="metric-value">{{ endOfChargeTime(car.end_of_charge) }}</span>

          <span class="metric-label">Leistung</span>
          <Flash class="metric-icon" :style="{ color: '#4ade80' }" />
          <span class="metric-value">{{ car.charging_power }}<span class="metric-unit">&nbsp;kW</span></span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import dayjs from '~/lib/datetime'
import BatteryEmpty from 'iconoir-vue/regular/BatteryEmpty'
import BatteryWarning from 'iconoir-vue/regular/BatteryWarning'
import Battery50 from 'iconoir-vue/regular/Battery50'
import Battery75 from 'iconoir-vue/regular/Battery75'
import BatteryFull from 'iconoir-vue/regular/BatteryFull'
import EvPlugCharging from 'iconoir-vue/regular/EvPlugCharging'
import Clock from 'iconoir-vue/regular/Clock'
import Flash from 'iconoir-vue/regular/Flash'

const { data } = useWidgetData('/api/cars', 300000)
const cars = computed(() => (Array.isArray(data.value) ? data.value : []))

const endOfChargeTime = (endTime) => dayjs().to(endTime)

const getBatteryIcon = (percentage) => {
  if (percentage <= 20) return BatteryEmpty
  if (percentage <= 40) return BatteryWarning
  if (percentage <= 60) return Battery50
  if (percentage <= 80) return Battery75
  return BatteryFull
}

const batteryColor = (p) => {
  if (p > 80) return '#22c55e'
  if (p > 60) return '#84cc16'
  if (p > 40) return '#eab308'
  if (p > 20) return '#f59e0b'
  return '#ef4444'
}
</script>

<style scoped>
.car + .car {
  margin-top: 0.6rem;
}
</style>
