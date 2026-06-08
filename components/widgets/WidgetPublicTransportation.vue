<template>
  <div>
    <h1 class="title">ÖV</h1>
    <p class="subtitle">{{ subtitle }}</p>
    <h2>
      <small class="time-label">{{ departure }} Uhr</small>
      {{ departureRelative }}
    </h2>
  </div>
</template>

<script setup>
import dayjs from '~/lib/datetime'

// Connections come from NUXT_TRANSPORT_CONNECTIONS_JSON (server-side config).
const { data } = useWidgetData('/api/public-transportation', 300000)

const first = computed(() => data.value?.connections?.[0])
const subtitle = computed(() => first.value?.connection ?? '')
const departure = computed(() => (first.value?.departure ? dayjs(first.value.departure).format('HH:mm') : ''))
const departureRelative = computed(() => (first.value?.departure ? dayjs().to(first.value.departure) : ''))
</script>
