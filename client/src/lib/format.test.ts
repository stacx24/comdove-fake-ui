import { describe, expect, it } from 'vitest'
import { businessLabel, hhmm, plus } from './format'

describe('format', () => {
  it('hhmm pads hours and minutes in local time', () => {
    const t = new Date(2026, 8, 19, 9, 5).getTime() / 1000
    expect(hhmm(t)).toBe('09:05')
  })

  it('plus prefixes the number', () => {
    expect(plus('919876543210')).toBe('+919876543210')
  })

  it('businessLabel finds the label, or undefined', () => {
    const list = [{ display_number: '918888800001', label: 'Sales', phone_number_id: 'P1', token: 't' }]
    expect(businessLabel('918888800001', list)).toBe('Sales')
    expect(businessLabel('000', list)).toBeUndefined()
  })
})
