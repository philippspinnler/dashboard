<template>
  <div class="weather-container">
    <div class="current-container">
      <h1 class="current-icon">
        <component :is="current.iconComponent" />
      </h1>
      <div class="current-temp">{{ current.temperature }}<span class="metric-unit">&nbsp;°C</span></div>
    </div>
    <div class="daily-container" v-for="day in daily" :key="day.dateDay">
      <div class="day-name">{{ day.dateDay }}</div>
      <div class="day-icon">
        <component :is="day.iconComponent" />
      </div>
      <div class="day-max">{{ day.temperature.max }}°</div>
      <div class="day-min">{{ day.temperature.min }}°</div>
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
  align-items: flex-start;
  gap: 0.6rem;
}

/* Current conditions stay a hero: large icon + prominent temperature. */
.current-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.current-icon {
  font-size: 4rem;
  line-height: 1;
}

.current-temp {
  font-size: 2rem;
  font-variant-numeric: tabular-nums;
  margin-top: 0.2rem;
}

/* Daily forecast columns aligned to the shared type scale. */
.daily-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.day-name {
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.92rem;
  letter-spacing: 0.04em;
}

.day-icon {
  font-size: 1.6rem;
  line-height: 1;
}

.day-max {
  font-size: 1.2rem;
  font-variant-numeric: tabular-nums;
}

.day-min {
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.6);
  font-variant-numeric: tabular-nums;
}
</style>
