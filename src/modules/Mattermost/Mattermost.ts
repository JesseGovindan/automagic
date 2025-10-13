import axios from 'axios'
import { createLogger } from "../../utilities/Logger"
import { Database, DatabaseError } from '../../database'
import { addScheduledTask } from '../../utilities/TaskScheduler'
import { merge, errorIf, expectDefined, tuple, conditionalResultAsync } from '../../utilities/functional'
import _ from 'lodash'
import { desktopInput, desktopPrompt, notify } from '../../utilities/Notification'
import { MattermostConfig } from '../../database/mattermost'
import { getChannelPosts, getMattermostChannels, login, PostsResponse, postToChannel } from './MattermostClient'
import { Application } from 'express'
import { useRequestHandler } from '../../utilities/RequestHandler'
import { ok, okAsync } from 'neverthrow'
import { generateBirthdayMessage } from './GeminiClient'
import { timeSpan } from '../../utilities/TimeSpan'

const log = createLogger('Mattermost')

export function bootstrapMattermostModule(server: Application, database: Database) {
  registerScheduledMessagesEndpoints(server, database)
  startGoodMorningMessageSchedule(database)
}

const logAndStopRunning = (context: string) => (error: DatabaseError | string) => {
  const errorMessage = typeof error === 'string' ? error : error.message
  notify('Mattermost', `${context}: ` + errorMessage)
  return ok({ stopRunning: true })
}

function startGoodMorningMessageSchedule(database: Database) {
  addScheduledTask({
    getNextDate: getDateTomorrow,
    task: () => sendGoodMorningMessage(database)
      .orElse(logAndStopRunning('Error sending good morning message'))
      .andTee(() => {
        addScheduledTask({
          getNextDate: () => Date.now() + timeSpan(2, 'hours'),
          task: () => sendBirthdayMessage(database)
            .orElse(logAndStopRunning('Error sending birthday message')),
          taskName: 'Send birthday wishes',
        })
      })
      ,
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

function sendGoodMorningMessage(database: Database) {
  return ensureEnoughTimeHasPassed(database)
    .andThrough(checkIfUserWantsToSendGoodMorningMessage)
    .andThen(database.mattermost.getConfig)
    .andThen(config => login(config)
      .andThen(([userClient, userId]) => getChannelToMessage(config, userClient, userId)
        .andThen(channelId => postToChannel(userClient, channelId, createGoodMorningMessage(new Date()))
    )))
    .andThen(() => database.mattermost.setTimeOfLastGoodMorningMessage(Date.now()))
    .map(() => notify('Mattermost', 'Good morning message sent successfully!'))
}

function ensureEnoughTimeHasPassed(database: Database) {
  return database.mattermost.getTimeOfLastGoodMorningMessage()
    .andThen(lastTime => errorIf(
      !!lastTime && (Date.now() - lastTime) < timeSpan(20, 'hours'),
      'Good morning message already sent today, skipping.',
    ))
}

function checkIfUserWantsToSendGoodMorningMessage() {
  return desktopPrompt('Mattermost Goodmorning Message', 'Do you want to send a good morning message?')
    .mapErr(() => 'Unable to get user permission to send good morning message')
    .andThen(response => errorIf(!response, 'User chose not to send a good morning message'))
}

function getChannelToMessage(config: MattermostConfig, client: axios.AxiosInstance, userId: string) {
  return getMattermostChannels(client, userId)
    .map(data => data.find(channel => channel.name === config.channelName))
    .andThen(expectDefined(`Channel ${config.channelName} not found for user`))
    .map(channel => channel.id)
}

const EMOJIS = [':wave:', ':chillisoft:', ':coffee:', ':slightly_smiling_face:'] as const
type EmojieIndexes = Exclude<keyof typeof EMOJIS, keyof any[]> extends infer K ? K extends `${infer N extends number}` ? N : never : never
const ran: () => EmojieIndexes = () => _.random(0, EMOJIS.length - 1) as EmojieIndexes
const randomEmoji = () => EMOJIS[ran()]

function createGoodMorningMessage(currentDate: Date) {
  return `${getDaySpecificMessage(currentDate.getDay())} ${randomEmoji()}`
}

function getDaySpecificMessage(day: number) {
  switch (day) {
    case 1: return 'Good morning all. Have a great week ahead!'
    case 2: return 'Good morning everyone'
    case 3: return 'Good morning'
    case 4: return 'Good morning guys. Have a great day'
    case 5: return 'Good morning. Happy Friday!'
    default: return 'Good morning everyone'
  }
}

function sendBirthdayMessage(database: Database) {
  return database.mattermost.getConfig()
    .andThen(config => login(config)
      .andThen(([client, userId]) => getChannelToMessage(config, client, userId)
        .andThen(channelId => getChannelPosts(client, channelId, getTodayMorning())
           .map(extractBirthdayMessages)
           .andThen(getUsersToWish(database))
           .andThen(([messages, alreadyWishedUsers]) => generateBirthdayMessage(
             messages, [...alreadyWishedUsers.map(m => `@${m}`)],
           )
                    .andThen(promptUserToSendBirthdayMessage(messages, alreadyWishedUsers)))
           .andThen(message => postToChannel(client, channelId, message))
    )))
    .map(() => log('Sent birthday messages'))
    .map(() => ({ stopRunning: true }))
}

function promptUserToSendBirthdayMessage(currentMessages: string[], users: string[]) {
  const userList = users.join(', ')
  return (generatedMessage: string) => {
    return desktopPrompt(`It's ${userList} birthday today`, `Messages seen:
${currentMessages.map(m => `- ${m}`).join('\n')}

Generated message: "${generatedMessage}"

Send message?`)
      .mapErr(() => 'Unable to get response from desktop prompt')
      
      .andThen(response => conditionalResultAsync(
        response,
        () => okAsync(generatedMessage),
        () => desktopInput('Custom Birtday message', `Suggest a birthday message to ${userList}.`)
          .mapErr(() => 'User rejected AI generated message and did not want to send a custom message')
      ))
  }
}

function getUsersToWish(database: Database) {
  return (birthdayWishes: string[]) => {
    const celebrants = Array.from(new Set(birthdayWishes.flatMap(wish => extractMentionedUsernames(wish))))

    return errorIf(birthdayWishes.length === 0, 'No birthdays today')
      .asyncAndThen(() => database.mattermost.getRecentBirthdayWishes())
      .map(pastCelebrants => celebrants.filter(celebrant => !pastCelebrants.includes(celebrant)))
      .andThrough(toWish => errorIf(!toWish.length, 'Wishes already granted'))
      .andThrough(database.mattermost.addBirthdayWishes)
      .map(celebrants => tuple(birthdayWishes, celebrants))
  }
}

function extractMentionedUsernames(message: string): string[] {
  return Array.from(message.matchAll(/@([a-zA-Z0-9_]+)/g), m => m[1])
    .filter(v => !!v) as string[]
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
