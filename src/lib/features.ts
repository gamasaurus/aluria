/**
 * Feature flags — centralised runtime feature toggles driven by environment variables.
 *
 * Usage:
 *   import { FEATURES } from '@/lib/features'
 *   if (FEATURES.AI_ENABLED) { ... }
 */

export const FEATURES = {
  /** Enable AI-powered extraction. Set USE_AI=true to enable. */
  AI_ENABLED: process.env.USE_AI === 'true',

  /** Enable KB V2 routing. On by default — set PSB_V2=false to disable. */
  PSB_V2: process.env.PSB_V2 !== 'false',

  /** Enable streaming AI responses. Set STREAMING=true to enable. */
  STREAMING: process.env.STREAMING === 'true',

  /** Enable analytics tracking. Set ANALYTICS=true to enable. */
  ANALYTICS: process.env.ANALYTICS === 'true',
} as const
