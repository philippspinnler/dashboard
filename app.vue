<template>
  <div class="app-root" :style="{ backgroundImage: image ? `url(${image})` : 'none' }">
    <!-- Dims the photo; opacity is GPU-composited, so the fade stays smooth on the Pi -->
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

const image = ref(null)
const previousImage = ref(null)
const dim = ref(1) // black overlay opacity: 1 = photo hidden, 0.5 = resting dim
const PHOTO_INTERVAL_MS = 5 * 60 * 1000
const photoCycle = ref(0) // bumped on each change to restart the progress line
const FADE_MS = 600 // keep in sync with .photo-dim transition in main.css

const preloadImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(url)
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })

const getImages = async () => {
  try {
    const data = await $fetch('/api/album')
    if (data && data.images && data.images.length > 0) {
      const shuffledImages = [...data.images].sort(() => Math.random() - 0.5)
      for (const imageUrl of shuffledImages) {
        try {
          await preloadImage(imageUrl)
          previousImage.value = image.value
          image.value = imageUrl
          return true
        } catch (error) {
          console.warn('Failed to load image, trying next:', error.message)
        }
      }
      if (previousImage.value) image.value = previousImage.value
      return false
    }
    return false
  } catch (error) {
    if (previousImage.value) image.value = previousImage.value
    return false
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const fadeToBlack = async () => {
  dim.value = 1
  await wait(FADE_MS)
}

const fadeToTransparent = async () => {
  await wait(1000)
  dim.value = 0.5
  await wait(FADE_MS)
}

let intervalId = null
onMounted(async () => {
  const initialLoad = await getImages()
  if (initialLoad) await fadeToTransparent()

  photoCycle.value++
  intervalId = setInterval(async () => {
    photoCycle.value++
    await fadeToBlack()
    const loaded = await getImages()
    if (loaded || image.value) await fadeToTransparent()
  }, PHOTO_INTERVAL_MS)
})
onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>
