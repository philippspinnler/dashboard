<template>
  <div class="app-root" :style="{ backgroundImage: image ? `url(${image})` : 'none' }">
    <div class="container" :style="{ backgroundColor }">
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
    <DoorbellOverlay />
  </div>
</template>

<script setup>
import WidgetClock from '~/components/widgets/WidgetClock.vue'
import WidgetCalendar from '~/components/widgets/WidgetCalendar.vue'
import WidgetSonos from '~/components/widgets/WidgetSonos.vue'
import WidgetPresence from '~/components/widgets/WidgetPresence.vue'
import WidgetInternet from '~/components/widgets/WidgetInternet.vue'
import WidgetNetatmo from '~/components/widgets/WidgetNetatmo.vue'
import WidgetPublicTransportation from '~/components/widgets/WidgetPublicTransportation.vue'
import WidgetEoGuide from '~/components/widgets/WidgetEoGuide.vue'
import WidgetWeather from '~/components/widgets/WidgetWeather.vue'
import WidgetCars from '~/components/widgets/WidgetCars.vue'
import WidgetInverter from '~/components/widgets/WidgetInverter.vue'

const { topLeftWidgets, topRightWidgets, leftWidgets, rightWidgets, bottomWidgets, enableGlassmorphism } =
  useWidgetConfig()

// Maps widget ids to component objects; ids absent here are skipped by the v-if guard above.
const widgetComponents = {
  clock: WidgetClock,
  calendar: WidgetCalendar,
  sonos: WidgetSonos,
  presence: WidgetPresence,
  internet: WidgetInternet,
  netatmo: WidgetNetatmo,
  'public-transportation': WidgetPublicTransportation,
  'eo-guide': WidgetEoGuide,
  weather: WidgetWeather,
  cars: WidgetCars,
  inverter: WidgetInverter,
}

const image = ref(null)
const previousImage = ref(null)
const backgroundColor = ref('rgba(0, 0, 0, 1)')

const transitionStepSpeed = 50

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

const fadeToBlack = async () => {
  for (let x = 0.55; x <= 1.05; x += 0.05) {
    backgroundColor.value = `rgba(0, 0, 0, ${x})`
    await new Promise((r) => setTimeout(r, transitionStepSpeed))
  }
}

const fadeToTransparent = async () => {
  await new Promise((r) => setTimeout(r, 1000))
  for (let x = 0.9; x >= 0.5; x -= 0.05) {
    backgroundColor.value = `rgba(0, 0, 0, ${x})`
    await new Promise((r) => setTimeout(r, transitionStepSpeed))
  }
}

let intervalId = null
onMounted(async () => {
  const initialLoad = await getImages()
  if (initialLoad) await fadeToTransparent()

  intervalId = setInterval(async () => {
    await fadeToBlack()
    const loaded = await getImages()
    if (loaded || image.value) await fadeToTransparent()
  }, 5 * 1000 * 60)
})
onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>
