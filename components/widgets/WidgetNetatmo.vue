<template>
  <div>
    <h1 class="title">Netatmo</h1>
    <div class="metric-grid">
      <span class="metric-label">Innen</span>
      <HomeTemperatureIn class="metric-icon" :style="{ color: '#f97316' }" />
      <span class="metric-value">{{ inside }}<span class="metric-unit">&nbsp;°C</span></span>

      <span class="metric-label">Aussen</span>
      <HomeTemperatureOut class="metric-icon" :style="{ color: '#60a5fa' }" />
      <span class="metric-value">{{ outside }}<span class="metric-unit">&nbsp;°C</span></span>

      <span class="metric-label">CO2</span>
      <Wind class="metric-icon" :style="{ color: '#a3e635' }" />
      <span class="metric-value">{{ co2 }}<span class="metric-unit">&nbsp;ppm</span></span>
    </div>
  </div>
</template>

<script setup>
import HomeTemperatureIn from 'iconoir-vue/regular/HomeTemperatureIn'
import HomeTemperatureOut from 'iconoir-vue/regular/HomeTemperatureOut'
import Wind from 'iconoir-vue/regular/Wind'

const { data } = useWidgetData('/api/netatmo', 900000)

const inside = computed(() => data.value?.indoor_temperature ?? '')
const co2 = computed(() => data.value?.indoor_co2 ?? '')
const outside = computed(() => data.value?.outdoor_temperature ?? '')
</script>
