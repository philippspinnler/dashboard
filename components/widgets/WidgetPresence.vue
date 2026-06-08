<template>
  <div class="presence-container">
    <div v-for="person in persons" :key="person.name" class="presence-person">
      <img
        v-if="person.avatar_url"
        :src="person.avatar_url"
        class="presence-avatar"
        :class="{ muted: person.state === 'not_home' }"
        :alt="person.name"
      />
    </div>
  </div>
</template>

<script setup>
const { data } = useWidgetData('/api/presence', 120000)
const persons = computed(() => data.value?.persons || [])
</script>

<style scoped>
.presence-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1.1rem;
}

.presence-person {
  display: flex;
}

.presence-avatar {
  width: 2.7rem;
  height: 2.7rem;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.muted {
  opacity: 0.5;
  filter: grayscale(80%);
  transition: opacity 0.3s, filter 0.3s;
}
</style>
