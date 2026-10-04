import { config, DOMWrapper, VueWrapper } from '@vue/test-utils'

function queryInShadow(root: ParentNode, selector: string): Element | null {
  const direct = root.querySelector(selector)
  if (direct) return direct
  if (root instanceof Element && root.shadowRoot) {
    return root.shadowRoot.querySelector(selector)
  }
  return null
}

function queryAllInShadow(root: ParentNode, selector: string): Element[] {
  const direct = [...root.querySelectorAll(selector)]
  if (direct.length > 0) return direct
  if (root instanceof Element && root.shadowRoot) {
    return [...root.shadowRoot.querySelectorAll(selector)]
  }
  return []
}

type FindFn = (selector: string) => DOMWrapper<Element>
type FindAllFn = (selector: string) => DOMWrapper<Element>[]

const vueFind = VueWrapper.prototype.find as FindFn
VueWrapper.prototype.find = function find(this: VueWrapper, selector: string) {
  const result = vueFind.call(this, selector)
  if (result.exists()) return result
  if (typeof selector !== 'string') return result
  const el = queryInShadow(this.element as ParentNode, selector)
  return el ? new DOMWrapper(el) : result
} as typeof VueWrapper.prototype.find

const vueGet = VueWrapper.prototype.get as FindFn
VueWrapper.prototype.get = function get(this: VueWrapper, selector: string) {
  const found = this.find(selector)
  if (found.exists()) return found
  return vueGet.call(this, selector)
} as typeof VueWrapper.prototype.get

const vueFindAll = VueWrapper.prototype.findAll as FindAllFn
VueWrapper.prototype.findAll = function findAll(this: VueWrapper, selector: string) {
  const result = vueFindAll.call(this, selector)
  if (result.length > 0 || typeof selector !== 'string') return result
  return queryAllInShadow(this.element as ParentNode, selector).map((el) => new DOMWrapper(el))
} as typeof VueWrapper.prototype.findAll

const vueText = VueWrapper.prototype.text
VueWrapper.prototype.text = function text(this: VueWrapper) {
  const el = this.element as HTMLElement
  if (el?.shadowRoot) {
    return (el.shadowRoot.textContent ?? '').replace(/\s+/g, ' ').trim()
  }
  return vueText.call(this)
}

const domFind = DOMWrapper.prototype.find as FindFn
DOMWrapper.prototype.find = function find(this: DOMWrapper<Element>, selector: string) {
  const result = domFind.call(this, selector)
  if (result.exists()) return result
  if (typeof selector !== 'string') return result
  const el = queryInShadow(this.element, selector)
  return el ? new DOMWrapper(el) : result
} as typeof DOMWrapper.prototype.find

const domFindAll = DOMWrapper.prototype.findAll as FindAllFn
DOMWrapper.prototype.findAll = function findAll(this: DOMWrapper<Element>, selector: string) {
  const result = domFindAll.call(this, selector)
  if (result.length > 0 || typeof selector !== 'string') return result
  return queryAllInShadow(this.element, selector).map((el) => new DOMWrapper(el))
} as typeof DOMWrapper.prototype.findAll

config.global.renderStubDefaultSlot = true
