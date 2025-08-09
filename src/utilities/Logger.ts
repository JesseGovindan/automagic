import { openSync, writeSync } from 'fs'

type Logger = {
  isLogging: false
} | {
  isLogging: true
  logStream: number
}

const isLogEnabled = process.env.NODE_ENV === 'production'
const logger: Logger = isLogEnabled
  ? { isLogging: true, logStream: openSync('/tmp/automagic-log.txt', 'a') }
  : { isLogging: false }

function log(message: string) {
  if (process.env.NODE_ENV === 'test') {
    return
  }

  const date = new Date()
  const messageWithDate = `${date.toISOString()} (${date.valueOf()}) - ${message}\n`

  if (!logger.isLogging) {
    console.log(messageWithDate)
    return
  }

  writeSync(logger.logStream, messageWithDate)
}

export function createLogger(topic: string) {
  return (...messages: Array<{ toString: () => string }>) => {
    log(`${topic}: ${messages.map(m => m.toString()).join(' ')}`)
  }
}
