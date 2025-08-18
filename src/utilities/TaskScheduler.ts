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

  const runTask = async () => {
    if (!taskDetails.runImmediately) {
      await sleepUntil(getNextDate())
    }

    const stopRunning = await task()
      .orTee(error => log(`Task ${taskName} failed. Error: ${inspect(error)}`))
      .match(result => _.get(result, 'stopRunning', false), () => true)

    if (!stopRunning) {
      setTimeout(() => addScheduledTask({ ...taskDetails, runImmediately: false }), 1)
    }
  }

  // Purposefully not awaiting the promise to allow the task to run in the background
  void runTask().catch(error => log(`Error in task ${taskName}: ${error}`))
}
