<template>
  <Transition name="overlay-pop">
    <div v-if="playing" class="overlay-corner sonos-overlay" :class="cornerClass">
      <img v-if="image" class="sonos-art" :src="image" alt="Album artwork" />
      <div class="sonos-meta">
        <span class="sonos-artist">{{ artist }}</span>
        <span class="sonos-song">{{ song }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup>
// Compact now-playing pill, shown in a configurable corner only while a Sonos
// speaker is playing (see /api/sonos, backed by Home Assistant media_player
// entities). Disabled deployments never poll.
const cfg = useRuntimeConfig().public
const enabled = cfg.sonosOverlayEnabled === true || cfg.sonosOverlayEnabled === 'true'
const cornerClass = useOverlayPosition(cfg.sonosOverlayPosition)

const data = enabled ? useWidgetData('/api/sonos', 10000).data : ref(null)

const playing = computed(() => data.value?.playing || false)
const artist = computed(() => data.value?.artist || '')
const song = computed(() => data.value?.song || '')
const image = computed(() => data.value?.image || '')
</script>

<style scoped>
.sonos-overlay {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  max-width: 26vw;
  padding: 0.6rem 1.2rem 0.6rem 0.6rem;
  border-radius: 1rem;
  background: rgba(20, 20, 20, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.sonos-art {
  width: 3.4rem;
  height: 3.4rem;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: 0.6rem;
}

.sonos-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sonos-artist {
  font-size: 1.2rem;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sonos-song {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
