import { Application, Request } from 'express'
import {
  createSheduledMessageUseCases
} from './use_cases'
import { addScheduledTask } from '../../utilities/TaskScheduler'
import { runScheduledMessagesTask } from './scheduler'
import { createLogger } from '../../utilities/Logger'
import { Database, DatabaseError } from '../../database'
import { useRequestHandler } from '../../utilities/RequestHandler'

const Created = <T>(value: T) => ({ body: value, status: 201 })
const OK = <T>(value: T) => ({ body: value, status: 200 })

export function bootstrapScheduledMessagesModule(server: Application, database: Database) {
  registerScheduledMessagesEndpoints(server, database)
  addScheduledTask({
    getNextDate: () => Date.now() + 60 * 1000, // every minute
    task: () => runScheduledMessagesTask(database).match(
      () => {},
      error => { throw new Error(`Failed to run scheduled messages task: ${error}`) },
    ),
    taskName: 'ScheduledMessages',
    runImmediately: true,
  })
}

function registerScheduledMessagesEndpoints(app: Application, database: Database) {
  const useCases = createSheduledMessageUseCases(database)

  app.post('/recipients', useRequestHandler((req) => useCases.createRecipient(req.body).match(
    Created,
    error => {
      if (error instanceof DatabaseError) {
        return { status: 500, body: { error: error.message } }
      }

      return { status: 400, body: { error: error } }
    }
  ))
  )

  app.get('/recipients', useRequestHandler((req) => useCases.listRecipients(req.query.name as string).match(
    recipients => OK(recipients),
    error => ({ status: 500, body: { error: error.message }}),
  )))

  app.post('/scheduled-messages', useRequestHandler((req) => useCases.createScheduledMessage(req.body).match(
    Created,
    error => {
      if (error instanceof DatabaseError) {
        return { status: 500, body: { error: error.message } }
      }
      return { status: 400, body: { error: error } }
    }
  )))

  app.get('/scheduled-messages', useRequestHandler((req) => useCases.listScheduledMessages().match(
    messages => OK(messages),
    error => ({ status: 500, body: { error: error.message } })
  )))

  app.delete('/scheduled-messages/:id', useRequestHandler((req) => useCases.deleteScheduledMessage(parseInt(req.params.id!)).match(
    (value) => ({ status: value ? 204 : 404 }),
    error => ({ status: 500, body: { error: error.message } })
  )))

  app.get('/scheduled-messages/failed', useRequestHandler((req) => useCases.listFailedMessages().match(
    messages => OK(messages),
    error => ({ status: 500, body: { error: error.message } })
  )))
}