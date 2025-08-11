// Nodejs can't handle more than 2_147_483_647 milliseconds (24.8 days) in setTimeout
const MAX_SLEEP_DURATION = 2_147_400_000

export function delay(milliseconds: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds))
}

export async function sleepUntil(futureTime: number): Promise<void> {
  const sleepDuration = getSleepDurationUntil(futureTime)
  if (sleepDuration <= 0) {
    return
  }

  await delay(Math.min(sleepDuration, MAX_SLEEP_DURATION))
  await sleepUntil(futureTime)
}

function getSleepDurationUntil(futureTime: number): number {
  return futureTime - Date.now()
}
