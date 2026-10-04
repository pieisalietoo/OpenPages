<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { injectOpenPagesStyles } from '../shadow/inject-styles'
import { OP_SHADOW_ISOLATED } from '../shadow/keys'
import openPagesCss from '../style.css?inline'

const alreadyIsolated = inject(OP_SHADOW_ISOLATED, false)
provide(OP_SHADOW_ISOLATED, true)

const hostRef = ref<HTMLElement | null>(null)
const mountRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (alreadyIsolated) return
  const host = hostRef.value
  const mount = mountRef.value
  if (!host || !mount || host.shadowRoot) return
  const shadow = host.attachShadow({ mode: 'open' })
  injectOpenPagesStyles(shadow, openPagesCss)
  shadow.appendChild(mount)
})

onBeforeUnmount(() => {
  // Vue unmounts the moved mount node via the vnode tree.
})
</script>

<template>
  <div v-if="alreadyIsolated" class="op-shadow-nested" data-op-shadow-nested>
    <slot />
  </div>
  <div v-else ref="hostRef" class="op-shadow-host" data-op-shadow-host>
    <div ref="mountRef" data-op-shadow-mount>
      <slot />
    </div>
  </div>
</template>
