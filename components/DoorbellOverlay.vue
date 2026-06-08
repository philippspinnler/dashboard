<template>
  <Transition name="doorbell">
    <div v-if="visible" class="doorbell-overlay" @click="dismiss">
      <div class="doorbell-header">
        <span class="doorbell-title">
          <span class="doorbell-dot" />
          {{ friendlyName }}
        </span>
      </div>
      <!-- src only set while visible so the proxied stream connection closes on dismiss -->
      <img class="doorbell-video" :src="visible ? '/api/doorbell/stream' : ''" alt="Doorbell camera" />
    </div>
  </Transition>
</template>

<script setup>
const { visible, friendlyName, dismiss } = useDoorbell()
</script>

<style scoped>
.doorbell-overlay {
  position: fixed;
  top: 1.2vh;
  right: 1.2vh;
  /* G6 Entry sensor is portrait (1920×2560 = 3:4) */
  width: 75vw;
  min-width: 380px;
  max-width: none;
  aspect-ratio: 1920 / 2560;
  z-index: 1000;
  overflow: hidden;
  cursor: pointer;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 1.1rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.doorbell-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 1vh;
  padding: 1vh 1.4vh;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
  /* fade the title over the video for legibility */
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0));
}

.doorbell-title {
  display: flex;
  align-items: center;
  gap: 0.8vh;
  min-width: 0;
  font-size: 2vh;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doorbell-dot {
  width: 1vh;
  height: 1vh;
  border-radius: 50%;
  background: #e74c3c;
  box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.6);
  animation: doorbell-pulse 1.4s infinite;
}

.doorbell-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #000;
}

@keyframes doorbell-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.6);
  }
  70% {
    box-shadow: 0 0 0 0.8vh rgba(231, 76, 60, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(231, 76, 60, 0);
  }
}

/* Slide + fade in from the top-right */
.doorbell-enter-active,
.doorbell-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.doorbell-enter-from,
.doorbell-leave-to {
  opacity: 0;
  transform: translate(1.5vw, -1.5vh) scale(0.96);
}
</style>
