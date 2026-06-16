<template>
  <div>
    <h1 class="title">ÖV</h1>
    <div class="metric-grid">
      <span class="metric-label">{{ subtitle }}</span>
      <Tram class="metric-icon" :style="{ color: '#f87171' }" />
      <span class="metric-value depart-value">
        <span>{{ departureRelative }}</span>
        <span class="metric-sub">{{ departure }} Uhr</span>
      </span>
    </div>
  </div>
</template>

<script setup>
import dayjs from '~/lib/datetime'
import Tram from 'iconoir-vue/regular/Tram'

// Connections come from NUXT_TRANSPORT_CONNECTIONS_JSON (server-side config).
const { data } = useWidgetData('/api/public-transportation', 300000)

const first = computed(() => data.value?.connections?.[0])
const subtitle = computed(() => first.value?.connection ?? '')
const departure = computed(() => (first.value?.departure ? dayjs(first.value.departure).format('HH:mm') : ''))
const departureRelative = computed(() => (first.value?.departure ? dayjs().to(first.value.departure) : ''))
</script>

<style scoped>
/* Stack the relative time above the absolute departure time, right-aligned. */
.depart-value {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.1;
}
</style>
