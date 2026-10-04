import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesToolbar from '../src/components/OpenPagesToolbar.vue'
import { shouldAlignPopoverEnd } from '../src/tooling/popover-align'
import { resolveToolbarEntries } from '../src/tooling/toolbar-order'
import type { ToolDefinition } from '../src/tooling/tools'

describe('popover edge alignment', () => {
  it('aligns end when the anchor would overflow the container to the right', () => {
    expect(
      shouldAlignPopoverEnd({
        anchorLeft: 100,
        containerRight: 400,
        minWidth: 192,
      }),
    ).toBe(false)
    expect(
      shouldAlignPopoverEnd({
        anchorLeft: 250,
        containerRight: 400,
        minWidth: 192,
      }),
    ).toBe(true)
  })

  it('adds is-align-end on a toolbar popover near the right edge', async () => {
    const tools: ToolDefinition[] = [
      {
        id: 'layout.exportJson',
        scope: 'document',
        label: 'Export JSON',
        icon: 'braces',
        enabled: true,
      },
    ]
    const entries = resolveToolbarEntries(['grow', 'layout.exportJson'], tools)
    expect(entries).toBeTruthy()
    if (!entries) return

    const host = document.createElement('div')
    host.style.cssText = 'position:relative;width:200px;margin-left:0;'
    document.body.appendChild(host)

    const wrapper = mount(OpenPagesToolbar, {
      props: {
        scope: 'document',
        entries,
        openPopoverId: 'layout.exportJson',
      },
      attachTo: host,
      slots: {
        'popover-layout-exportJson': '<p>Export menu</p>',
      },
    })

    const toolbar = wrapper.get('[data-op-toolbar="document"]').element as HTMLElement
    const wrap = wrapper.get('.op-tool-wrap').element as HTMLElement
    vi.spyOn(toolbar, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 40,
      right: 200,
      width: 200,
      height: 40,
      toJSON() {
        return {}
      },
    })
    vi.spyOn(wrap, 'getBoundingClientRect').mockReturnValue({
      x: 160,
      y: 0,
      top: 0,
      left: 160,
      bottom: 28,
      right: 188,
      width: 28,
      height: 28,
      toJSON() {
        return {}
      },
    })

    await wrapper.setProps({ openPopoverId: null })
    await nextTick()
    await wrapper.setProps({ openPopoverId: 'layout.exportJson' })
    await nextTick()
    await nextTick()

    const popover = wrapper.get('[data-op-popover="layout.exportJson"]')
    expect(popover.classes()).toContain('is-align-end')

    wrapper.unmount()
    host.remove()
  })
})
