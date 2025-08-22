import axios from 'axios'
import _ from 'lodash'
import { fromPromise, ok } from "neverthrow"
import { expectDefined } from "../../utilities/functional"
import { createLogger } from '../../utilities/Logger'

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

const log = createLogger('Gemini')

export function generateBirthdayMessage(messages: string[], omittedNames: string[]) {
  return getEnvironmentVariable('GEMINI_API_KEY')
    .asyncAndThen(apiKey => makeRequest({
      url: GEMINI_URL,
      method: 'post',
      baseURL: '',
      headers: {
        'X-goog-api-key': apiKey,
      },
      data: {
        contents: [{
          parts: [{
            text: generateBirthdayMessagePrompt(messages, omittedNames),
          }],
        }],
      }
    }))
    .map(response => _.get(response.data, 'candidates[0].content.parts[0].text', ''))
    .andThen(expectDefined('No birthday message generated'))
}

function generateBirthdayMessagePrompt(messages: string[], omittedNames: string[]) {
  const prompt = `You are a professional assistant. Produce a single short, unique, friendly and professional "Happy Birthday" message suitable for a colleague.
Birthday messages received so far:
${messages.map(m => `- ${m}`).join('\n')}

Constraints:
- Tone: cool, and friendly.
- Avoid slang, and overly familiar language.
- Output only the message, with no surrounding explanation or punctuation besides a single final period.
- Only wish the following users [${omittedNames.join(', ')}], do not wish any other users.
- If users are being wished using their tags, ensure that their tag is used in the message.
- If there is no one that can be wished. Reply with the text "Have a great day everyone."
`
  log('Birthday message prompt:', prompt)
  return prompt
}

function getEnvironmentVariable<T extends string>(name: T) {
  return ok(process.env[name])
    .andThen(value => expectDefined(`Environment variable ${name} is not set`)(value))
}

function makeRequest<T>(params: {
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  data?: any
  headers?: Record<string, string>
} & ({
  baseURL: string
} | {
  client: axios.AxiosInstance
})) {
  const axiosClient = _.get(params, 'client', axios.create({
    baseURL: _.get(params, 'baseURL', ''),
    headers: params.headers ?? {},
  }))


  return fromPromise(
    axiosClient[params.method]<T>(params.url, params.data),
    (error) => `Failed to make request to ${params.url}: ${error}`,
  )
}
