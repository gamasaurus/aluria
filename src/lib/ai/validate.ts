/**
 * Gate 1 — Message too short to be meaningful.
 */
export function isTooShort(message: string): boolean {
  return message.trim().length < 5
}

export function clarifyResponse() {
  return {
    insight: 'Could you tell me a bit more?',
    next_question: 'Could you elaborate on that a bit more?',
    is_clarify: true,
  }
}