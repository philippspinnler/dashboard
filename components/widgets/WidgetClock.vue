<template>
  <div class="widget-clock">
    <div class="clock-container">
      <div class="time">{{ hours }}:{{ minutes }}</div>
      <div class="seconds">{{ seconds }}</div>
    </div>
    <div class="date-container">{{ date }}</div>
  </div>
</template>

<script setup>
import dayjs from '~/lib/datetime'

// Starts blank so SSR markup matches the client's first render (no hydration
// mismatch); onMounted runs client-only and begins ticking.
const hours = ref('')
const minutes = ref('')
const seconds = ref('')
const date = ref('')

const updateTime = () => {
  const now = new Date()
  date.value = dayjs(now).format('dddd, D. MMMM YYYY')
  hours.value = dayjs(now).format('HH')
  minutes.value = dayjs(now).format('mm')
  seconds.value = dayjs(now).format('ss')
}

let intervalId = null
onMounted(() => {
  updateTime()
  intervalId = setInterval(updateTime, 1000)
})
onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped>
.widget-clock .clock-container {
  display: flex;
  margin-bottom: -0.7rem;
}

.widget-clock .time {
  font-size: 4rem;
}

.widget-clock .seconds {
  margin-top: 0.6rem;
  font-size: 1.5rem;
  margin-left: 0.2rem;
  color: rgba(255, 255, 255, 0.6);
}

.widget-clock .date-container {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.7);
}
</style>
