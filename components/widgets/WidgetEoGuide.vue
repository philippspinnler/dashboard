<template>
  <div>
    <h1 class="title">EO-Guide</h1>

    <div class="metric-grid">
      <span class="metric-label">Jährlich</span>
      <span class="metric-icon"></span>
      <span class="metric-value">{{ yearly }}</span>

      <span class="metric-label">Monatlich</span>
      <span class="metric-icon"></span>
      <span class="metric-value">{{ monthly }}</span>

      <span class="metric-label">Bewertung</span>
      <span class="metric-icon"></span>
      <span class="metric-value rating-value">
        <span class="stars">
          <component
            v-for="(star, index) in starsArray"
            :key="index"
            :is="star.component"
            :class="star.class"
          />
        </span>
        {{ overall_rating.toFixed(1) }}
      </span>
    </div>
  </div>
</template>

<script setup>
import Star from 'iconoir-vue/regular/Star'
import StarSolid from 'iconoir-vue/solid/Star'
import StarHalfDashed from 'iconoir-vue/regular/StarHalfDashed'

const { data } = useWidgetData('/api/eo-guide', 21600000)

const yearly = computed(() => data.value?.subscriptions?.yearly ?? 0)
const monthly = computed(() => data.value?.subscriptions?.monthly ?? 0)
const overall_rating = computed(() => data.value?.overall_rating ?? 0)

// Generate stars array based on rating (rounded to nearest half)
const starsArray = computed(() => {
  const rating = overall_rating.value
  if (!rating) return []

  const roundedRating = Math.round(rating * 2) / 2
  const stars = []

  const fullStars = Math.floor(roundedRating)
  for (let i = 0; i < fullStars; i++) stars.push({ component: StarSolid, class: 'filled' })

  if (roundedRating % 1 !== 0) stars.push({ component: StarHalfDashed, class: 'filled' })

  const emptyStars = 5 - Math.ceil(roundedRating)
  for (let i = 0; i < emptyStars; i++) stars.push({ component: Star, class: 'outline' })

  return stars
})
</script>

<style scoped>
/* Rating sits in the value cell: small stars followed by the numeric score. */
.rating-value {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.stars {
  display: inline-flex;
  align-items: center;
  gap: 0.12rem;
}

.rating-value svg {
  width: 0.9em;
  height: 0.9em;
}

.rating-value .filled {
  color: #fbbf24;
}

.rating-value .outline {
  color: rgba(255, 255, 255, 0.4);
}
</style>
