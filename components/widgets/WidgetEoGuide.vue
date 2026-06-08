<template>
  <div>
    <h1 class="title">EO-Guide</h1>

    <p class="subtitle">Abonnements</p>
    <div class="abos">
      <span class="abo-label">Jährlich</span>
      <span class="abo-value">{{ yearly }}</span>
      <span class="abo-label">Monatlich</span>
      <span class="abo-value">{{ monthly }}</span>
    </div>

    <p class="subtitle">Bewertung</p>
    <h3 class="rating">
      <component
        v-for="(star, index) in starsArray"
        :key="index"
        :is="star.component"
        :class="star.class"
      />
      {{ overall_rating.toFixed(1) }}
    </h3>
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
/* inline-grid follows the column's text-align, like the other right-column
   widgets — label column + value column, neatly aligned. */
.abos {
  display: inline-grid;
  grid-template-columns: auto auto;
  align-items: baseline;
  column-gap: 0.9rem;
  row-gap: 0.1rem;
  margin-bottom: 0.4rem;
}

.abo-label {
  text-align: right;
  color: rgba(255, 255, 255, 0.55);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.55);
}

.abo-value {
  text-align: right;
  font-size: 1.7rem;
  font-variant-numeric: tabular-nums;
  color: #fff;
}

.rating {
  display: inline-flex;
  align-items: center;
  gap: 0.18rem;
}

.rating .filled {
  color: #fbbf24;
}

.rating .outline {
  color: rgba(255, 255, 255, 0.4);
}
</style>
