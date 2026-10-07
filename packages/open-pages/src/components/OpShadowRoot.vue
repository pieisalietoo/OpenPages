<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import {
  injectOpenPagesStyles,
  normalizeShadowStyles,
  type ShadowStyleHandle,
} from '../shadow/inject-styles'
import { OP_SHADOW_ISOLATED } from '../shadow/keys'
import openPagesCss from '../style.css?inline'

const props = withDefaults(
  defineProps<{
    /** Extra CSS text injected into this shadow root (after package chrome). */
    extraStyles?: string | string[]
  }>(),
  {
    extraStyles: () => [],
  },
)

const alreadyIsolated = inject(OP_SHADOW_ISOLATED, false)
provide(OP_SHADOW_ISOLATED, true)

const hostRef = ref<HTMLElement | null>(null)
const mountRef = ref<HTMLElement | null>(null)
let styleHandle: ShadowStyleHandle | null = null

onMounted(() => {
  if (alreadyIsolated) return
  const host = hostRef.value
  const mount = mountRef.value
  if (!host || !mount || host.shadowRoot) return
  const shadow = host.attachShadow({ mode: 'open' })
  styleHandle = injectOpenPagesStyles(
    shadow,
    openPagesCss,
    normalizeShadowStyles(props.extraStyles),
  )
  shadow.appendChild(mount)
})

watch(
  () => props.extraStyles,
  (styles) => {
    styleHandle?.setExtras(styles)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  styleHandle = null
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
