/**
 * Issue #551: Invalid Bull backoff type 'webhookRetry'
 *
 * Root cause:
 * - BullModule.registerQueue() in webhooks.module.ts defines a custom
 *   backoff strategy 'webhookRetry' inside `settings.backoffStrategies`
 * - @nestjs/bull's registerQueue does not reliably pass nested `settings`
 *   to the underlying Bull Queue constructor
 * - When webhooks.service.ts adds a job with backoff: { type: 'webhookRetry' },
 *   Bull cannot find the strategy and throws "Invalid backoff type"
 *
 * Fix: Use `options.settings` with a flat structure so @nestjs/bull
 *      correctly propagates the custom backoff strategy to Bull.
 */

// ---- FLAWED (webhooks.module.ts) ----
const WEBHOOK_RETRY_DELAYS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];

BullModule.registerQueue({
  name: 'webhooks',
  settings: {
    backoffStrategies: {
      webhookRetry: (attemptsMade: number) =>
        WEBHOOK_RETRY_DELAYS[Math.min(attemptsMade, WEBHOOK_RETRY_DELAYS.length - 1)],
    },
  },
})

// ---- FIXED (webhooks.module.ts) ----
const WEBHOOK_RETRY_DELAYS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];

BullModule.registerQueue({
  name: 'webhooks',
  // Move settings into the Queue constructor options object
  // so @nestjs/bull passes them to new Bull(...)
  options: {
    settings: {
      backoffStrategies: {
        webhookRetry: (attemptsMade: number) =>
          WEBHOOK_RETRY_DELAYS[Math.min(attemptsMade, WEBHOOK_RETRY_DELAYS.length - 1)],
      },
    },
  },
})

// ---- FIXED (webhooks.service.ts) remains the same ----
// backoff: { type: 'webhookRetry' } works once the strategy is
// correctly registered via options.settings above.
