import type { InjectionKey } from 'vue'

/** True when already under an OpenPages shadow root (skip nested attachShadow). */
export const OP_SHADOW_ISOLATED: InjectionKey<boolean> = Symbol('op-shadow-isolated')
