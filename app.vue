<template>
  <div class="app-root">
    <div
      v-for="(url, i) in layers"
      :key="i"
      class="photo-layer"
      :style="{ backgroundImage: url ? `url(${url})` : 'none', opacity: i === front ? 1 : 0 }"
    />
    <!-- Dims the photo; opacity is GPU-composited, so fades stay smooth on the Pi -->
    <div class="photo-dim" :style="{ opacity: dim }" />
    <div class="container">
      <div class="container-top">
        <div class="container-top-left">
          <div
            v-for="widgetId in topLeftWidgets"
            :key="widgetId"
            class="widget"
            :class="[`widget-${widgetId}`, { 'widget-glassmorphism': enableGlassmorphism }]"
          >
            <component :is="widgetComponents[widgetId]" v-if="widgetComponents[widgetId]" />
          </div>
        </div>
        <div class="container-top-right">
          <div
            v-for="widgetId in topRightWidgets"
            :key="widgetId"
            class="widget"
            :class="[`widget-${widgetId}`, { 'widget-glassmorphism': enableGlassmorphism }]"
          >
            <component :is="widgetComponents[widgetId]" v-if="widgetComponents[widgetId]" />
          </div>
        </div>
      </div>
      <div class="container-content">
        <div class="container-content-left">
          <div
            v-for="widgetId in leftWidgets"
            :key="widgetId"
            class="widget"
            :class="[`widget-${widgetId}`, { 'widget-glassmorphism': enableGlassmorphism }]"
          >
            <component :is="widgetComponents[widgetId]" v-if="widgetComponents[widgetId]" />
          </div>
        </div>
        <div class="container-content-right">
          <div
            v-for="widgetId in rightWidgets"
            :key="widgetId"
            class="widget"
            :class="[`widget-${widgetId}`, { 'widget-glassmorphism': enableGlassmorphism }]"
          >
            <component :is="widgetComponents[widgetId]" v-if="widgetComponents[widgetId]" />
          </div>
        </div>
      </div>
      <div class="container-bottom">
        <div
          v-for="widgetId in bottomWidgets"
          :key="widgetId"
          class="widget"
          :class="[`widget-${widgetId}`, { 'widget-glassmorphism': enableGlassmorphism }]"
        >
          <component :is="widgetComponents[widgetId]" v-if="widgetComponents[widgetId]" />
        </div>
      </div>
    </div>
    <!-- Hairline at the bottom edge that fills up until the next photo change -->
    <div :key="photoCycle" class="photo-progress" :style="{ animationDuration: `${PHOTO_INTERVAL_MS}ms` }" />
    <DoorbellOverlay />
    <SonosOverlay />
    <WarningsOverlay />
  </div>
</template>

<script setup>
import WidgetClock from '~/components/widgets/WidgetClock.vue'
import WidgetCalendar from '~/components/widgets/WidgetCalendar.vue'
import WidgetPresence from '~/components/widgets/WidgetPresence.vue'
import WidgetInternet from '~/components/widgets/WidgetInternet.vue'
import WidgetNetatmo from '~/components/widgets/WidgetNetatmo.vue'
import WidgetPublicTransportation from '~/components/widgets/WidgetPublicTransportation.vue'
import WidgetEoGuide from '~/components/widgets/WidgetEoGuide.vue'
import WidgetWeather from '~/components/widgets/WidgetWeather.vue'
import WidgetCars from '~/components/widgets/WidgetCars.vue'
import WidgetInverter from '~/components/widgets/WidgetInverter.vue'
import WidgetHeizung from '~/components/widgets/WidgetHeizung.vue'

const { topLeftWidgets, topRightWidgets, leftWidgets, rightWidgets, bottomWidgets, enableGlassmorphism } =
  useWidgetConfig()

// Maps widget ids to component objects; ids absent here are skipped by the v-if guard above.
const widgetComponents = {
  clock: WidgetClock,
  calendar: WidgetCalendar,
  presence: WidgetPresence,
  internet: WidgetInternet,
  netatmo: WidgetNetatmo,
  'public-transportation': WidgetPublicTransportation,
  'eo-guide': WidgetEoGuide,
  weather: WidgetWeather,
  cars: WidgetCars,
  inverter: WidgetInverter,
  heizung: WidgetHeizung,
}

// Two stacked photo layers: the new photo goes into the hidden one, then the
// layers swap opacity, so photos crossfade directly (no black in between).
const layers = ref([null, null])
const front = ref(0)
const dim = ref(1) // black overlay opacity: 1 = black until the first photo, 0.5 = resting dim
const PHOTO_INTERVAL_MS = (Number(useRuntimeConfig().public.photoIntervalSeconds) || 300) * 1000
const photoCycle = ref(0) // bumped on each change to restart the progress line

// decode() up front so the Pi doesn't decode the 4K photo mid-fade (rejects on load errors too)
const preloadImage = async (url) => {
  const img = new Image()
  img.src = url
  await img.decode()
}

const showImage = (url) => {
  const back = 1 - front.value
  layers.value[back] = url
  front.value = back
  dim.value = 0.5
}

const nextImage = async () => {
  try {
    const data = await $fetch('/api/album')
    const shuffled = [...(data?.images || [])].sort(() => Math.random() - 0.5)
    for (const url of shuffled) {
      try {
        await preloadImage(url)
        showImage(url)
        return
      } catch (error) {
        console.warn('Failed to load image, trying next:', url, error.message)
      }
    }
  } catch {
    // album unreachable: keep the current photo, retry next tick
  }
}

let intervalId = null
onMounted(async () => {
  await nextImage()
  photoCycle.value++
  intervalId = setInterval(() => {
    photoCycle.value++
    nextImage()
  }, PHOTO_INTERVAL_MS)
})
onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>
