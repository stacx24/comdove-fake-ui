// Input checks shared by the admin forms and the sample server.
// Each returns an error message, or null when the input is fine.

// 100 tiles per group: one business number messages 100 customers (WS-343).
export const MAX_GROUP_SIZE = 100

const PHONE = /^\d{8,15}$/
const GROUP_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function checkPhone(number: string): string | null {
  if (!number) return 'Enter a number.'
  if (!PHONE.test(number)) return `"${number}" is not a valid number: use 8–15 digits, no + or spaces.`
  return null
}

export function checkGroupName(name: string): string | null {
  if (!name) return 'Enter a group name.'
  if (!GROUP_NAME.test(name)) return 'Group name can use lowercase letters, numbers and dashes only (it goes in the URL).'
  return null
}

// Splits a textarea of numbers on commas, spaces or new lines.
export function parseNumberList(text: string): string[] {
  return text.split(/[\s,]+/).filter(Boolean)
}

export function checkGroupNumbers(numbers: string[]): string | null {
  if (numbers.length === 0) return 'Add at least one customer number.'
  if (numbers.length > MAX_GROUP_SIZE) return `A group can have at most ${MAX_GROUP_SIZE} numbers (you entered ${numbers.length}).`
  for (const number of numbers) {
    const error = checkPhone(number)
    if (error) return error
  }
  const seen = new Set<string>()
  for (const number of numbers) {
    if (seen.has(number)) return `${number} is listed twice.`
    seen.add(number)
  }
  return null
}
