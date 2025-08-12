import axios from 'axios'
import { createLogger } from "../../utilities/Logger"
import { Database, DatabaseError } from '../../database'
import { addScheduledTask } from '../../utilities/TaskScheduler'
import { merge, errorIf, expectDefined } from '../../utilities/functional'
import _ from 'lodash'
import { notify } from '../../utilities/Notification'
import { MattermostConfig } from '../../database/mattermost'
import { getMattermostChannels, login, postToChannel } from './MattermostClient'
import { Application } from 'express'
import { useRequestHandler } from '../../utilities/RequestHandler'
import { ok } from 'neverthrow'

const log = createLogger('Mattermost')

export function bootstrapMattermostModule(server: Application, database: Database) {
  registerScheduledMessagesEndpoints(server, database)
  startGoodMorningMessageSchedule(database)
}

function startGoodMorningMessageSchedule(database: Database) {
  addScheduledTask({
    getNextDate: getDateTomorrow,
    task: () => sendGoodMorningMessage(database).orElse((error) => {
      const errorMessage = typeof error === 'string' ? error : error.message
      notify('Mattermost', 'Error sending good morning message: ' + errorMessage)
      return ok({ stopRunning: true })
    }),
    taskName: 'GoodMorningMessage',
    runImmediately: true,
  })
}

const Created = <T>(value: T) => ({ body: value, status: 201 })

function createMattermostUseCases(database: Database) {
  return {
    saveConfig: (config: any) => {
      return merge({
        url: expectDefined('No url field provided')<string>(config.url),
        username: expectDefined('No username field provided')<string>(config.username),
        password: expectDefined('No password field provided')<string>(config.password),
        channelName: expectDefined('No channelName field provided')<string>(config.channelName),
      })
      .asyncAndThen(database.mattermost.saveConfig)
    },
  }
}

function registerScheduledMessagesEndpoints(app: Application, database: Database) {
  const useCases = createMattermostUseCases(database)

  app.post('/mattermost-config', useRequestHandler((req) => useCases.saveConfig(req.body).match(
    Created,
    error => {
      if (error instanceof DatabaseError) {
        return { status: 500, body: { error: error.message } }
      }

      return { status: 400, body: { error: error } }
    }
  )))

  app.post('/mattermost-send-morning-message', useRequestHandler(async () => {
    startGoodMorningMessageSchedule(database)
    return Created(undefined)
  }))
}

function getDateTomorrow() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.valueOf()
}

const EIGHT_HOURS = 8 * 60 * 60 * 6000

function sendGoodMorningMessage(database: Database) {
  return ensureEnoughTimeHasPassed(database)
    .andThen(database.mattermost.getConfig)
    .andThen(config =>
      login(config)
        .andThen(([userClient, userId]) => getChannelToMessage(config, userClient, userId)
            .andThen(channelId => postToChannel(userClient, channelId, 'Good morning! Have a great day!')
            )))
    .andThen(() => database.mattermost.setTimeOfLastGoodMorningMessage(Date.now()))
    .map(() => notify('Mattermost', 'Good morning message sent successfully!'))
}

function ensureEnoughTimeHasPassed(database: Database) {
  return database.mattermost.getTimeOfLastGoodMorningMessage()
    .andThen(lastTime => errorIf(
      !!lastTime && (Date.now() - lastTime) < EIGHT_HOURS,
      'Good morning message already sent today, skipping.',
    ))
}

function getChannelToMessage(config: MattermostConfig, client: axios.AxiosInstance, userId: string) {
  return getMattermostChannels(client, userId)
    .andTee(channels => log(`Found ${channels.length} channels for user`))
    .map(data => data.find(channel => channel.name === config.channelName))
    .andThen(expectDefined(`Channel ${config.channelName} not found for user`))
    .andTee(channel => log(`Selected channel: ${JSON.stringify(channel)}`))
    .map(channel => channel.id)
}
