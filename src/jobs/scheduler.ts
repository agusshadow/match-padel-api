import cron, { type ScheduledTask } from 'node-cron'
import { logger } from '../lib/logger'

// Reusable wrapper around node-cron: names the job for logging, catches
// errors from the task so one failing run never crashes the process or kills
// the schedule, and exposes start/stop so src/index.ts can manage the
// lifecycle instead of each job file rolling its own cron.schedule() call.
export function registerJob(
  name: string,
  cronExpression: string,
  task: () => Promise<void>,
) {
  let scheduled: ScheduledTask | null = null

  function start() {
    if (scheduled) return
    scheduled = cron.schedule(
      cronExpression,
      () => {
        task().catch((err) => logger.error(err, `[Job:${name}] run failed`))
      },
      { timezone: 'America/Argentina/Buenos_Aires' },
    )
    logger.info({ cronExpression }, `[Job:${name}] started`)
  }

  function stop() {
    if (!scheduled) return
    scheduled.stop()
    scheduled = null
    logger.info({}, `[Job:${name}] stopped`)
  }

  return { start, stop, runNow: task }
}
