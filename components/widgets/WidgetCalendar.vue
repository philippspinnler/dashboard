<template>
  <div ref="root">
    <div v-for="day in filteredDays" :key="day.date">
      <div class="date-container">
        <div class="day">
          <h1 class="title">{{ day.day }}</h1>
        </div>
        <div class="date subtitle">{{ day.date }}</div>
      </div>
      <div class="event-container" v-for="event in day.events" :key="event.summary">
        <div class="event-special" v-if="event.special_event">
          <div>
            <h2>
              <Gift v-if="event.special_event.type === 'birthday'" />
              <Heart v-else />
              {{ event.special_event.name }}
            </h2>
          </div>
          <div>{{ event.special_event.years }}</div>
        </div>
        <div
          class="event"
          v-if="!event.special_event"
          :style="{ borderLeft: `solid #${event.color} 0.22rem` }"
        >
          <div v-if="event.all_day" class="event-all-day">
            <span>Den ganzen Tag</span>
          </div>
          <h2 v-if="!event.all_day">{{ event.start_time }}</h2>
          {{ event.summary }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import Gift from 'iconoir-vue/regular/Gift'
import Heart from 'iconoir-vue/regular/Heart'

const { data } = useWidgetData('/api/calendar', 900000)
const days = computed(() => data.value || [])

const scoredDays = computed(() => {
  const MAX_SCORE = 11
  const SCORE_DAY = 0.8
  const SCORE_SPECIAL_EVENT = 0.8
  const SCORE_EVENT = 1.0

  let totalScore = 0
  const result = []

  for (const day of days.value) {
    if (totalScore + SCORE_DAY > MAX_SCORE) {
      break
    }

    totalScore += SCORE_DAY
    const dayData = {
      day: day.day,
      date: day.date,
      events: [],
    }

    for (const event of day.events) {
      const eventScore = event.special_event ? SCORE_SPECIAL_EVENT : SCORE_EVENT

      if (totalScore + eventScore > MAX_SCORE) {
        if (dayData.events.length === 0) {
          totalScore -= SCORE_DAY
        } else {
          result.push(dayData)
        }
        return result
      }

      totalScore += eventScore
      dayData.events.push(event)
    }

    result.push(dayData)
  }

  return result
})

// The score above is only a rough cap. What really fits depends on the height
// the column gets (the warnings bar takes a line when it shows), so measure:
// render the scored list, find the first event that would reach past the
// clipping content area, and cut there. Whole events only, and a day left
// without any event is dropped, so no lone day heading remains.
const root = ref(null)
const maxEvents = ref(Infinity)

const filteredDays = computed(() => {
  let left = maxEvents.value
  const result = []
  for (const day of scoredDays.value) {
    const events = day.events.slice(0, left)
    left -= events.length
    if (events.length) result.push({ ...day, events })
  }
  return result
})

async function fit() {
  maxEvents.value = Infinity
  await nextTick()
  const el = root.value
  const clip = el?.closest('.container-content')
  if (!clip) return // not in a height-limited zone
  // Space taken below the calendar's own content: its widget padding/margin
  // plus any widgets that follow it in the column.
  const last = el.closest('.widget')?.parentElement?.lastElementChild
  const trailing = last
    ? last.getBoundingClientRect().bottom + parseFloat(getComputedStyle(last).marginBottom) - el.getBoundingClientRect().bottom
    : 0
  const limit = clip.getBoundingClientRect().bottom - trailing
  const events = [...el.querySelectorAll('.event-container')]
  const firstCut = events.findIndex((e) => e.getBoundingClientRect().bottom > limit + 0.5)
  if (firstCut >= 0) maxEvents.value = firstCut
}

watch(scoredDays, fit, { flush: 'post' })
let resizeObserver = null
onMounted(() => {
  const clip = root.value?.closest('.container-content')
  if (clip) {
    resizeObserver = new ResizeObserver(fit) // fires once on observe, then on every height change
    resizeObserver.observe(clip)
  }
  document.fonts?.ready.then(fit)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<style scoped>
.date-container {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.date-container .date {
  margin-bottom: 0.22rem;
}

.event-container {
  margin-bottom: 0.66rem;
}

.event-container:last-child {
  margin-bottom: 2.2rem;
}

div:last-child > .event-container:last-child {
  margin-bottom: 0;
}

.event {
  background-color: rgb(255, 255, 255, 0.2);
  padding: 1.1rem;
  border-radius: 0.66rem;
}

.event-special {
  background-color: rgb(255, 255, 255, 0.2);
  display: flex;
  justify-content: space-between;
  padding: 1.1rem;
  align-items: center;
  border-radius: 0.66rem;
}

.event-special h2 {
  display: flex;
  align-items: center;
  gap: 0.44rem;
}

.event-all-day {
  margin-bottom: 0.44rem;
}

.event-all-day span {
  background-color: rgb(255, 255, 255, 0.7);
  padding: 0.22rem;
  border-radius: 0.33rem;
  color: rgb(50, 50, 50);
}
</style>
