// Small display helpers shared by the tile.
import type { BusinessNumber } from '../types'

/** Unix seconds → local "HH:MM". */
export function hhmm(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** "919876543210" → "+919876543210". */
export const plus = (number: string) => `+${number}`

/** The registered label for a business number, e.g. "Sales", or undefined if unknown. */
export function businessLabel(number: string, list: BusinessNumber[]): string | undefined {
  return list.find((b) => b.display_number === number)?.label
}
