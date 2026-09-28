import { toJpeg, toPng } from 'html-to-image'

export type ExportFormat = 'print' | 'png' | 'pdf'

export type ExportEvent = {
  format: ExportFormat
  result: unknown
}

export interface ExportAdapters {
  print?: (element: HTMLElement) => void | Promise<void>
  toPng?: (element: HTMLElement) => Promise<string>
  toPdf?: (element: HTMLElement) => Promise<unknown>
}

export interface ExportOptions {
  element?: HTMLElement
}

export interface Exporter {
  export: (format: ExportFormat, options?: ExportOptions) => Promise<unknown>
  on: (event: 'export', listener: (event: ExportEvent) => void) => () => void
}

export type PrintPagePayload = {
  dataUrl: string
  width: number
  height: number
}

export type BrowserExportAdapterOptions = {
  capturePng?: (element: HTMLElement) => Promise<string>
  captureJpeg?: (element: HTMLElement) => Promise<string>
  printPage?: (payload: PrintPagePayload) => void | Promise<void>
}

export function createExporter(adapters: ExportAdapters = {}): Exporter {
  const listeners = new Set<(event: ExportEvent) => void>()

  return {
    async export(format, options = {}) {
      let result: unknown
      if (format === 'print') {
        if (!options.element) {
          throw new Error('print export requires options.element')
        }
        if (!adapters.print) {
          throw new Error('print adapter not configured')
        }
        result = await adapters.print(options.element)
      } else if (format === 'png') {
        if (!options.element) {
          throw new Error('png export requires options.element')
        }
        if (!adapters.toPng) {
          throw new Error('png adapter not configured')
        }
        result = await adapters.toPng(options.element)
      } else if (format === 'pdf') {
        if (!options.element) {
          throw new Error('pdf export requires options.element')
        }
        if (!adapters.toPdf) {
          throw new Error('pdf adapter not configured')
        }
        result = await adapters.toPdf(options.element)
      }
      const event: ExportEvent = { format, result }
      for (const listener of listeners) {
        listener(event)
      }
      return result
    },
    on(_event, listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function elementSize(element: HTMLElement): { width: number; height: number } {
  const rect = element.getBoundingClientRect()
  return {
    width: Math.max(1, Math.round(rect.width || element.clientWidth || 794)),
    height: Math.max(1, Math.round(rect.height || element.clientHeight || 1123)),
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  if (!base64) {
    throw new Error('data URL encode failed')
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** Minimal PDF-1.4 embedding a JPEG (does not use window.print). */
export function jpegBytesToPdfDataUrl(jpeg: Uint8Array, widthPx: number, heightPx: number): string {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  let size = 0

  const pushStr = (value: string) => {
    const bytes = encoder.encode(value)
    chunks.push(bytes)
    size += bytes.length
  }

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes)
    size += bytes.length
  }

  const content = `q ${widthPx} 0 0 ${heightPx} 0 0 cm /Im0 Do Q`
  const offsets: number[] = []

  pushStr('%PDF-1.4\n')

  const writeObj = (num: number, body: string, binary?: Uint8Array) => {
    offsets[num] = size
    pushStr(`${num} 0 obj\n`)
    pushStr(body)
    if (binary) {
      pushBytes(binary)
      pushStr('\nendstream\nendobj\n')
    } else {
      pushStr('\nendobj\n')
    }
  }

  writeObj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  writeObj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  writeObj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPx} ${heightPx}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>`,
  )
  writeObj(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  writeObj(
    5,
    `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
  )

  const xrefStart = size
  let xref = `xref\n0 6\n0000000000 65535 f \n`
  for (let i = 1; i <= 5; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  pushStr(xref)

  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }

  let binary = ''
  for (let i = 0; i < out.length; i++) {
    const byte = out[i]
    if (byte === undefined) continue
    binary += String.fromCharCode(byte)
  }
  return `data:application/pdf;base64,${btoa(binary)}`
}

const captureOptions = { cacheBust: true, pixelRatio: 2 } as const

async function defaultCapturePng(element: HTMLElement): Promise<string> {
  return toPng(element, captureOptions)
}

async function defaultCaptureJpeg(element: HTMLElement): Promise<string> {
  return toJpeg(element, { ...captureOptions, quality: 0.92 })
}

export async function printPageImage(payload: PrintPagePayload): Promise<void> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('data-op-print-frame', '')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const frameDoc = iframe.contentDocument
  const frameWin = iframe.contentWindow
  if (!frameDoc || !frameWin) {
    iframe.remove()
    throw new Error('print frame unavailable')
  }

  frameDoc.open()
  frameDoc.write(`<!doctype html><html><head><title>OpenPages</title>
<style>
  @page { margin: 0; }
  html, body { margin: 0; padding: 0; }
  img { display: block; width: ${payload.width}px; height: ${payload.height}px; max-width: 100%; }
</style></head><body>
<img src="${payload.dataUrl}" width="${payload.width}" height="${payload.height}" alt="" />
</body></html>`)
  frameDoc.close()

  await new Promise<void>((resolve, reject) => {
    const img = frameDoc.querySelector('img')
    const run = () => {
      try {
        frameWin.focus()
        frameWin.print()
        resolve()
      } catch (error) {
        reject(error)
      }
    }
    if (img && !img.complete) {
      img.onload = () => run()
      img.onerror = () => reject(new Error('print image failed to load'))
    } else {
      run()
    }
  })

  window.setTimeout(() => iframe.remove(), 500)
}

export function createBrowserExportAdapters(
  options: BrowserExportAdapterOptions = {},
): ExportAdapters {
  const capturePng = options.capturePng ?? defaultCapturePng
  const captureJpeg = options.captureJpeg ?? defaultCaptureJpeg
  const printPage = options.printPage ?? printPageImage

  return {
    print: async (element) => {
      const dataUrl = await capturePng(element)
      const { width, height } = elementSize(element)
      await printPage({ dataUrl, width, height })
    },
    toPng: (element) => capturePng(element),
    toPdf: async (element) => {
      const jpegUrl = await captureJpeg(element)
      const { width, height } = elementSize(element)
      return jpegBytesToPdfDataUrl(dataUrlToBytes(jpegUrl), width, height)
    },
  }
}
