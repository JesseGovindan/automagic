import axios from 'axios'
import { createLogger } from "../../utilities/Logger"
import { Database } from '../../database'
import { addScheduledTask } from '../../utilities/TaskScheduler'
import { errorIf, expectDefined, pick } from '../../utilities/functional'
import { fromPromise } from 'neverthrow'
import _ from 'lodash'
import { notify } from '../../utilities/Notification'
import { MattermostConfig } from '../../database/mattermost'

const log = createLogger('Mattermost')

export function bootstrapMattermostModule(database: Database) {
  addScheduledTask({
    getNextDate: getDateTomorrow,
    task: () => sendGoodMorningMessage(database),
    taskName: 'GoodMorningMessage',
    runImmediately: true,
  })
}

function getDateTomorrow() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.valueOf()
}

const EIGHT_HOURS = 8 * 60 * 60 * 6000

function sendGoodMorningMessage(database: Database) {
  return ensureAtLeastOneDayPassed(database)
    .andThen(database.mattermost.getConfig)
    .andThen(config =>
      login(config)
        .andThen(([userClient, userId]) => getChannelToMessage(config, userClient, userId)
            .andThen(channelId => postGoodMorningMessage(config, userClient, channelId)
            )))
    .andThen(() => database.mattermost.setTimeOfLastGoodMorningMessage(Date.now()))
    .match(
      () => notify('Mattermost', 'Good morning message sent successfully!'),
      (error) => {
        const errorMessage = typeof error === 'string' ? error : error.message
        notify('Mattermost', 'Error sending good morning message: ' + errorMessage)
      })
}

function ensureAtLeastOneDayPassed(database: Database) {
  return database.mattermost.getTimeOfLastGoodMorningMessage()
    .andThen(lastTime => errorIf(
      !!lastTime && (Date.now() - lastTime) < EIGHT_HOURS,
      'Good morning message already sent today, skipping.',
    ))
}

function login(config: MattermostConfig) {
  return makeRequest<{ id: string, token: string }>({
    method: 'post',
    baseURL: config.url,
    url: '/api/v4/users/login',
    data: {
      login_id: config.username,
      password: config.password,
    },
  })
    .andTee(() => log('Logged in'))
    .map(response => [axios.create({
      baseURL: config.url,
      headers: {
        'Authorization': `Bearer ${response.headers.token}`,
      },
    }), response.data.id] as const)
}

function getChannelToMessage(config: MattermostConfig, client: axios.AxiosInstance, userId: string) {
  return makeRequest<{ id: string, name: string }[]>({
    method: 'get',
    url: `/api/v4/users/${userId}/channels`,
    client,
  })
    .map(pick('data'))
    .andTee(channels => log(`Found ${channels.length} channels in team ${config.teamName}`))
    .map(data => data.find(channel => channel.name === config.channelName))
    .andThen(expectDefined(`Channel ${config.channelName} not found in team ${config.teamName}`))
    .andTee(channel => log(`Selected channel: ${JSON.stringify(channel)}`))
    .map(channel => channel.id)
}

function postGoodMorningMessage(config: MattermostConfig, client: axios.AxiosInstance, channelId: string) {
  return makeRequest<{ id: string }>({
    method: 'post',
    url: '/api/v4/posts',
    data: {
      channel_id: channelId,
      message: 'Good morning! Have a great day!',
    },
    client,
  })
}

function makeRequest<T>(params: {
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  data?: any
} & ({
  baseURL: string
} | {
  client: axios.AxiosInstance
})) {
  const axiosClient = _.get(params, 'client', axios.create({
    baseURL: _.get(params, 'baseURL', ''),
  }))


  return fromPromise(
    axiosClient[params.method]<T>(params.url, params.data),
    (error) => `Failed to make request to ${params.url}: ${error}`,
  )
}