import { describe, expect, it } from 'vitest'
import {
  deletePlainRange,
  insertPlainText,
  plainTextLength,
  plainTextOf,
  wordRangeAtOffset,
} from '../src/model/text-edit/plain-offset'

describe('plain-offset HTML edits', () => {
  it('inserts into plain text and simple markup', () => {
    expect(insertPlainText('Hi', 2, '!')).toBe('Hi!')
    expect(plainTextOf(insertPlainText('<p>Hi</p>', 2, '!'))).toBe('Hi!')
    expect(plainTextLength('<b>Ab</b>')).toBe(2)
  })

  it('deletes a plain range inside markup', () => {
    expect(plainTextOf(deletePlainRange('<p>Hello</p>', 1, 4))).toBe('Ho')
  })
})

describe('wordRangeAtOffset', () => {
  it('expands to the word under the caret', () => {
    expect(wordRangeAtOffset('Hello World', 1)).toEqual({ start: 0, end: 5 })
    expect(wordRangeAtOffset('Hello World', 7)).toEqual({ start: 6, end: 11 })
  })

  it('prefers the nearest word when the caret is on whitespace', () => {
    expect(wordRangeAtOffset('Hi there', 2)).toEqual({ start: 0, end: 2 })
    expect(wordRangeAtOffset('Hi  there', 3)).toEqual({ start: 0, end: 2 })
  })
})
