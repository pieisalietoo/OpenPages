import { Plus } from '@lucide/vue'
import { describe, expect, it } from 'vitest'

describe('@lucide/vue', () => {
  it('exports Vue icon components used by the toolbar', () => {
    expect(Plus).toBeTruthy()
    expect(['object', 'function']).toContain(typeof Plus)
  })
})
