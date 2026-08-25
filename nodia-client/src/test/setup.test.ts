import { describe, expect, it } from 'vitest'

describe('test environment', () => {
  it('provides jsdom and jest-dom matchers', () => {
    const element = document.createElement('div')
    document.body.append(element)

    expect(element).toBeInTheDocument()
  })
})
