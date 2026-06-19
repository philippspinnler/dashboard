<template>
  <div>
    <h1 class="title">Internet</h1>
    <div v-for="speedtest in speedtests" :key="speedtest.provider" class="speedtest">
      <p v-if="speedtests.length > 1" class="subtitle">{{ speedtest.provider }}</p>
      <div class="metric-grid">
        <span class="metric-label">Down</span>
        <Download class="metric-icon" :style="{ color: '#34d399' }" />
        <span class="metric-value">{{ speedtest.download.num }}<span class="metric-unit">&nbsp;{{ speedtest.download.unit }}</span></span>

        <span class="metric-label">Up</span>
        <Upload class="metric-icon" :style="{ color: '#60a5fa' }" />
        <span class="metric-value">{{ speedtest.upload.num }}<span class="metric-unit">&nbsp;{{ speedtest.upload.unit }}</span></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import Download from 'iconoir-vue/regular/Download'
import Upload from 'iconoir-vue/regular/Upload'

const { data } = useWidgetData('/api/speedtest', 1800000)
const speedtests = computed(() => data.value || [])
</script>

<style scoped>
.speedtest + .speedtest {
  margin-top: 0.6rem;
}
</style>
