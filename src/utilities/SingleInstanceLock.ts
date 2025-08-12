import net from 'net'
import process from 'process'

import { createLogger } from './Logger'
import { notify } from './Notification'

const SOCKET_PATH = '\0automagic_server_lock'

const log = createLogger('single_instance_lock')

export async function createSingleInstanceLock(shutdown: () => Promise<void> = () => Promise.resolve()) {
  await checkConnectionToExistingLockServer(SOCKET_PATH)
  const lockServer = await createLockServer(SOCKET_PATH)
  sendAppStatusNotification(true)

  const shutdownApp = async () => {
    await new Promise<void>(resolve => lockServer.close(() => resolve()))

    log('Shutting down app')
    await shutdown()
    sendAppStatusNotification(false)
    process.exit(0)
  }

  lockServer.on('connection', async () => {
    log('New connection received. Closing lock server')
    await shutdownApp()
  })
  return shutdownApp
}

async function checkConnectionToExistingLockServer(socketPath: string): Promise<void> {
  return new Promise<void>(resolve => {
    const client = net.createConnection(socketPath, () => {
      log('lock server client connected')
      client.end()
      resolve()
    })
    client.on('error', () => {
      log('lock server client connection errored out')
      resolve()
    })
  })
}

async function createLockServer(socketPath: string) {
  return new Promise<net.Server>((resolve, reject) => {
    const lockServer = net.createServer()
    lockServer.listen(socketPath, () => {
      resolve(lockServer)
    })
    lockServer.on('error', error => {
      reject(error)
    })
  })
}

function sendAppStatusNotification(started: boolean) {
  return notify(
    started
      ? 'Daemon Started'
      : 'Daemon Stopped',
  )
}
