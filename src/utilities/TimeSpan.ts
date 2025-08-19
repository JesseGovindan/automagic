type Unit = 
  | 'hours' | 'hour'
  | 'minutes' | 'minute'
  | 'seconds' | 'second'
export function timeSpan(quantity: number, unit: Unit) {
  switch (unit) {
    case "hours":
    case "hour":
      return timeSpan(quantity * 60, 'minutes')
    case "minutes":
    case "minute":
      return timeSpan(quantity * 60, 'seconds')
    case "seconds":
    case "second":
      return Math.ceil(quantity * 1000)
  }
}
