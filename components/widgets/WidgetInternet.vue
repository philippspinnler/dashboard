<template>
  <div>
    <h1 class="title">Internet</h1>
    <div v-for="speedtest in speedtests" :key="speedtest.provider">
      <p class="subtitle">{{ speedtest.provider }}</p>
      <h2>
        {{ speedtest.download }} <Download />
        {{ speedtest.upload }} <Upload />
      </h2>
    </div>
  </div>
</template>

<script setup>
import Download from 'iconoir-vue/regular/Download'
import Upload from 'iconoir-vue/regular/Upload'

const { data } = useWidgetData('/api/speedtest', 1800000)
const speedtests = computed(() => data.value || [])
</script>
