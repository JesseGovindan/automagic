import axios from 'axios'
import { createLogger } from "../../utilities/Logger"
import { Database, DatabaseError } from '../../database'
import { addScheduledTask } from '../../utilities/TaskScheduler'
import { merge, errorIf, expectDefined } from '../../utilities/functional'
import _  from 'lodash'
import { notify } from '../../utilities/Notification'
import { MattermostConfig } from '../../database/mattermost'
import { getChannelPosts, getMattermostChannels, login, PostsResponse, postToChannel } from './MattermostClient'
import { Application } from 'express'
import { useRequestHandler } from '../../utilities/RequestHandler'
import { ok } from 'neverthrow'
import { generateBirthdayMessage } from './GeminiClient'

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

  addScheduledTask({
    getNextDate: getDateTomorrow,
    task: () => sendBirthdayMessage(database).orElse((error) => {
      const errorMessage = typeof error === 'string' ? error : error.message
      notify('Mattermost', 'Error sending birthday message: ' + errorMessage)
      return ok()
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

function sendBirthdayMessage(database: Database) {
  return database.mattermost.getConfig()
    .andThen(config => login(config)
      .andThen(([client, userId, username]) => getChannelToMessage(config, client, userId)
        .andThen(channelId => getChannelPosts(client, channelId, getTodayMorning())
           .map(extractBirthdayMessages)
           .andThrough(messages => errorIf(messages.length === 0, 'No birthdays today'))
           .andTee(m => log('Current birthday messages:\n', m.join('\n')))
           .andThen(messages => generateBirthdayMessage(messages, username))
           .andThen(message => postToChannel(client, channelId, message))
    )))
    .map(() => log('Sent birthday messages'))
}

function extractBirthdayMessages(response: axios.AxiosResponse<PostsResponse>) {
  const endDate = getTodayMorning() + (24 * 60 * 60 * 1000)
  return _.toArray(response.data.posts)
  .filter(p => p.create_at < endDate)
  .map(p => p.message)
  .filter(p => /happy birthday/i.test(p))
  .map(p => p.replace(/\n/g, ' '))
}

function getTodayMorning() {
  const now = new Date()
  now.setHours(0)
  now.setMinutes(0)
  now.setMilliseconds(0)
  return now.valueOf()
}
