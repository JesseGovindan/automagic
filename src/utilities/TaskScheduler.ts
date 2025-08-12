import { inspect } from 'util'

import { sleepUntil } from '../utilities/Delay'
import { createLogger } from '../utilities/Logger'
import { ResultAsync } from 'neverthrow'
import _ from 'lodash'

const log = createLogger('scheduler')

export type TaskOutput = {
  stopRunning?: boolean
} | void

export function addScheduledTask(taskDetails: {
  getNextDate: () => number,
  task: () => ResultAsync<TaskOutput, Error>,
  taskName: string,
  runImmediately?: boolean,
}) {
  const { getNextDate, task, taskName } = taskDetails

  // Purposefully not awaiting the promise to allow the task to run in the background
  new Promise<void>(async () => {
    if (!taskDetails.runImmediately) {
      await sleepUntil(getNextDate())
    }

    const continueSchedule = await task()
      .orTee(error => log(`Task ${taskName} failed. Error: ${inspect(error)}`))
      .match(result => _.get(result, 'stopRunning', true), () => false)

    if (continueSchedule) {
      setTimeout(() => addScheduledTask({ ...taskDetails, runImmediately: false }), 1)
    }
  }).catch(error => log(`Error in task ${taskName}: ${error}`))
}

async function runTask(task: () => Promise<void>, taskName: string) {
  try {
    await task()
    return 'Succeeded'
  } catch (error) {
    log(`Task ${taskName} failed. Error: ${inspect(error)}`)
    return 'Failed'
  }
}

function notifyOnError(taskName: string | undefined, taskState: 'Succeeded' | 'Failed') {
  if (!taskName || taskState === 'Succeeded') {
    return
  }

  log(`Task ${taskName} failed. Notifying...`)
}
