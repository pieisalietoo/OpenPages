import type { LaidOutLine } from '../../src/model/text-layout/layout'

/** Assign continuous modelStart/modelEnd for hand-built layout fixtures. */
export function withModelOffsets(
  lines: Array<
    Omit<LaidOutLine, 'modelStart' | 'modelEnd'> &
      Partial<Pick<LaidOutLine, 'modelStart' | 'modelEnd'>>
  >,
): LaidOutLine[] {
  let pos = 0
  return lines.map((line) => {
    const modelStart = pos
    const modelEnd = pos + line.text.length
    pos = modelEnd
    return { ...line, modelStart, modelEnd }
  })
}
