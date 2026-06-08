<template>
  <div>
    <h1 class="title">Netatmo</h1>
    <p class="subtitle">Innen</p>
    <h2>{{ inside }} °C</h2>
    <p class="subtitle">Aussen</p>
    <h2>{{ outside }} °C</h2>
    <p class="subtitle">CO2</p>
    <h2>{{ co2 }} ppm</h2>
  </div>
</template>

<script setup>
const { data } = useWidgetData('/api/netatmo', 900000)

const inside = computed(() => data.value?.indoor_temperature ?? '')
const co2 = computed(() => data.value?.indoor_co2 ?? '')
const outside = computed(() => data.value?.outdoor_temperature ?? '')
</script>
