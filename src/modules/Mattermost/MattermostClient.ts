import axios from 'axios'
import { fromPromise } from "neverthrow"
import { MattermostConfig } from "../../database/mattermost"
import { createLogger } from "../../utilities/Logger"
import _  from 'lodash'
import { pick } from '../../utilities/functional'

const log = createLogger('MattermostClient')

export function login(config: Pick<MattermostConfig , 'url' | 'username' | 'password'>) {
  return makeRequest<{ id: string, token: string, username: string }>({
    method: 'post',
    baseURL: config.url,
    url: '/api/v4/users/login',
    data: {
      login_id: config.username,
      password: config.password,
    },
  })
    .andTee((r) => log('Logged in', JSON.stringify(r.data, null, 2)))
    .map(response => [axios.create({
      baseURL: config.url,
      headers: {
        'Authorization': `Bearer ${response.headers.token}`,
      },
    }),
    response.data.id,
    response.data.username,
    ] as const)
}

export type Channel = {
  id: string,
  name: string
  display_name: string
  type: string,
}

export function getMattermostChannels(client: axios.AxiosInstance, userId: string) {
  return makeRequest<Channel[]>({
    method: 'get',
    url: `/api/v4/users/${userId}/channels`,
    client,
  })
    .map(pick('data'))
}

export function postToChannel(client: axios.AxiosInstance, channelId: string, message: string) {
  return makeRequest<{ id: string }>({
    method: 'post',
    url: '/api/v4/posts',
    data: {
      channel_id: channelId,
      message,
    },
    client,
  })
}

export type Post = {
  message: string
  create_at: number
}

export type PostsResponse = {
  posts: Record<string, Post>
}

export function getChannelPosts(client: axios.AxiosInstance, channelId: string, since: number) {
  const params = new URLSearchParams()
  params.set('per_page', '3')
  params.set('page', '0')
  params.set('since', since.toString())
  return makeRequest<PostsResponse>({
    method: 'get',
    url: `/api/v4/channels/${channelId}/posts?${params.toString()}`,
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
