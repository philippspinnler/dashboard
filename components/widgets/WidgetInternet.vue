<template>
  <div>
    <h1 class="title">Internet</h1>

    <!-- One line: the classic Down / Up rows. -->
    <div v-if="speedtests.length === 1" class="metric-grid">
      <span class="metric-label">Down</span>
      <Download class="metric-icon" :style="{ color: DOWN }" />
      <span class="metric-value">{{ num(speedtests[0].download) }}<span class="metric-unit">&nbsp;{{ unit(speedtests[0].download) }}</span></span>

      <span class="metric-label">Up</span>
      <Upload class="metric-icon" :style="{ color: UP }" />
      <span class="metric-value">{{ num(speedtests[0].upload) }}<span class="metric-unit">&nbsp;{{ unit(speedtests[0].upload) }}</span></span>
    </div>

    <!-- Several lines (e.g. main + backup): one compact row per provider. A
         provider without a fresh reading shows dashes. -->
    <div v-else class="metric-grid speedtest-rows">
      <template v-for="speedtest in speedtests" :key="speedtest.provider">
        <span class="metric-label">{{ speedtest.provider }}</span>
        <Download class="metric-icon" :style="{ color: DOWN }" />
        <span class="metric-value">{{ num(speedtest.download) }}<span class="metric-unit">&nbsp;{{ unit(speedtest.download) }}</span></span>
        <Upload class="metric-icon" :style="{ color: UP }" />
        <span class="metric-value">{{ num(speedtest.upload) }}<span class="metric-unit">&nbsp;{{ unit(speedtest.upload) }}</span></span>
      </template>
    </div>
  </div>
</template>

<script setup>
import Download from 'iconoir-vue/regular/Download'
import Upload from 'iconoir-vue/regular/Upload'

const DOWN = '#34d399'
const UP = '#60a5fa'

const { data } = useWidgetData('/api/speedtest', 1800000)
const speedtests = computed(() => data.value || [])

const num = (speed) => speed?.num ?? '—'
const unit = (speed) => speed?.unit ?? ''
</script>

<style scoped>
/* label · ↓ value · ↑ value. Slightly smaller numbers than the single-line
   layout so two values fit side by side. */
.speedtest-rows {
  grid-template-columns: auto auto auto auto auto;
  column-gap: 0.5rem;
}

.speedtest-rows .metric-value {
  font-size: 1.25rem;
}
</style>
