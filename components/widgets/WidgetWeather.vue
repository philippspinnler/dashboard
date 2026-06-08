<template>
  <div class="weather-container">
    <div class="current-container">
      <h1>
        <component :is="current.iconComponent" />
      </h1>
      <h2>{{ current.temperature }} °C</h2>
    </div>
    <div class="daily-container" v-for="day in daily" :key="day.dateDay">
      <h2>{{ day.dateDay }}</h2>
      <h2>
        <component :is="day.iconComponent" />
      </h2>
      <h3>{{ day.temperature.max }} °C</h3>
      <h3>{{ day.temperature.min }} °C</h3>
    </div>
  </div>
</template>

<script setup>
import dayjs from '~/lib/datetime'
import SunLight from 'iconoir-vue/regular/SunLight'
import CloudSunny from 'iconoir-vue/regular/CloudSunny'
import Cloud from 'iconoir-vue/regular/Cloud'
import Rain from 'iconoir-vue/regular/Rain'
import Flash from 'iconoir-vue/regular/Flash'
import Snow from 'iconoir-vue/regular/Snow'
import Fog from 'iconoir-vue/regular/Fog'

const iconMap = {
  '01d': SunLight, '02d': CloudSunny, '03d': Cloud, '04d': Cloud,
  '09d': Rain, '10d': Rain, '11d': Flash, '13d': Snow, '50d': Fog,
  '01n': SunLight, '02n': CloudSunny, '03n': Cloud, '04n': Cloud,
  '09n': Rain, '10n': Rain, '11n': Flash, '13n': Snow, '50n': Fog,
}

const round1 = (n) => Math.round(n * 10) / 10

const { data } = useWidgetData('/api/weather', 3600000)

const current = computed(() => {
  const c = data.value?.current
  if (!c) return { temperature: '', iconComponent: SunLight }
  return {
    temperature: round1(c.temperature),
    temperatureFeelsLike: round1(c.temperatureFeelsLike),
    iconComponent: iconMap[c.weather?.[0]?.icon] || SunLight,
  }
})

const daily = computed(() => {
  const days = data.value?.daily
  if (!days) return []
  return days
    .map((day) => ({
      dateDay: dayjs(day.date).format('dd'),
      temperature: { min: round1(day.temperature.min), max: round1(day.temperature.max) },
      iconComponent: iconMap[day.weather?.[0]?.icon] || SunLight,
    }))
    .slice(1, 5)
})
</script>

<style scoped>
.weather-container {
  display: flex;
  justify-content: space-between;
}

.current-container h1 {
  font-size: 4rem;
}
</style>
