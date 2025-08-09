import axios from 'axios'
import { createLogger } from "../utilities/Logger"

const URL = 'https://chat.chillisoft.co.za'

const log = createLogger('Mattermost')

export async function bootstrap() {
  const client = axios.create()
  const userResponse = await client.request({
    method: 'POST',
    url: URL + '/api/v4/users/login',
    data: {
      login_id: 'jesse.govindan@chillisoft.co.za',
      password: 'Geforce970!',
    },
  })

  const userId = userResponse.data.id as string
  const token = userResponse.headers['token']! as string

  const teamsResponse = await client.request({
    method: 'GET',
    url: URL + '/api/v4/teams',
    headers: {
      'Authorization': 'Bearer ' + token,
    },
  })

  const teamId = teamsResponse.data[0].id! as string

  const channelsResponse = await client.request({
    method: 'GET',
    url: URL + `/api/v4/users/${userId}/channels`,
    headers: {
      'Authorization': 'Bearer ' + token,
    },
  })

  const usersResponse = await client.request({
    method: 'GET',
    url: URL + `/api/v4/users`,
    headers: {
      'Authorization': 'Bearer ' + token,
    },
  })

  // console.log(usersResponse.data)
  // console.log(channelsResponse.status)
  // console.log(channelsResponse.data)
  // console.log(channelsResponse.data.map(({ display_name }: { display_name: string }) => display_name))
  console.log(channelsResponse.data.filter((channel: any) => channel.type === 'D'))
  console.log(userId)

  const workingRemotelyChannel = channelsResponse.data.filter((channel: any) => {
    return channel.display_name === 'Working Remotely'
  })

  const myPrivateChat = channelsResponse.data.find((channel: any) => {
    return channel.name === `${userId}__${userId}`
  })

  const postMessageResponse = await client.request({
    method: 'POST',
    url: URL + '/api/v4/posts',
    data: {
      channel_id: myPrivateChat.id,
      message: 'This is a test automated message',
    },
    headers: {
      'Authorization': 'Bearer ' + token,
    },
  })
}
