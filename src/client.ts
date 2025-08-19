import axios from "axios"
import { combineSequentially, conditionalResult, errorIf, expectDefined, merge, mergeAsync, onlyIfAsync, parseNumber, pick } from "./utilities/functional"
import { ok, fromPromise, okAsync, ResultAsync, fromSafePromise, err } from "neverthrow"
import { Recipient, ScheduledMessage } from "./types"
import { Channel, getMattermostChannels, login } from "./modules/Mattermost/MattermostClient"
import { read } from 'read'

export function scheduleMessage(
  recipientName: string | undefined,
  timeSpecifier: string | undefined,
  message: string | undefined,
) {
  return mergeAsync({
    recipientId: getRecipientId(recipientName),
    scheduledDate: parseTimeSpecifier(timeSpecifier),
    message: okAsync(message).andThen(expectDefined('No message provided')),
  })
  .andThen(({ recipientId, scheduledDate, message }) => {
    return makeRequest<ScheduledMessage>({
      method: 'post',
      url: '/scheduled-messages',
      data: {
        recipientId,
        scheduledDate,
        message,
      },
    })
    .map(pick('data'))
    .andThen(expectDefined('Failed to schedule message'))
  })
  .match(
    value => {
      console.log(`Message scheduled successfully: ${value.id}`)
    },
    error => {
      console.error(`Failed to schedule message: ${error}`)
    }
  )
}

function getRecipientId(recipientName: string | undefined) {
  return expectDefined('No recipient name provided')(recipientName)
  .asyncAndThen(name => makeRequest<Recipient[]>({ method: 'get', url: `/recipients?name=${name}` }))
  .map(pick('data'))
  .map(values => values[0])
  .andTee(value => console.log(`Found recipient: ${value ? value.name : 'not found'}`))
  .andThen(expectDefined('Recipient not found'))
  .map(pick('id'))
}

const TIME_SPECIFIER_REGEX = /^(?:(\d{1,2})\/(\d{1,2})-)?(\d{1,2}):(\d{2})$/
  // time is specified in either dd/mm-hh:mm or hh:mm format
  function parseTimeSpecifier(timeSpecifier: string | undefined) {
  return okAsync(timeSpecifier)
  .andThen(expectDefined('No time specifier provided'))
  .map(timeSpec => TIME_SPECIFIER_REGEX.exec(timeSpec))
  .andThen(expectDefined('Invalid time specifier format'))
  .andThen(match => {
    const now = new Date()
    return merge({
      day: conditionalResult(
        !!match[1],
        () => parseNumber(match[1], 'Invalid day format'),
          () => ok(now.getDate()),
      ),
        month: conditionalResult(
          !!match[2],
          () => parseNumber(match[2], 'Invalid month format').map(value => value - 1),
            () => ok(now.getMonth()),
        ),
          hour: parseNumber(match[3], 'Invalid hour format'),
          minute: parseNumber(match[4], 'Invalid minute format'),
    })
  })
  .andThrough(verifyDate)
  .map(({ day, month, hour, minute }) => {
    const now = new Date()
    return new Date(now.getFullYear(), month, day, hour, minute, 0, 0).valueOf()
  })
  .andTee(date => console.log(`Scheduled date: ${new Date(date).toISOString()}`))
  .andThrough(scheduledDate => errorIf(scheduledDate < Date.now(), 'Scheduled date cannot be in the past'))
}

function verifyDate({ day, month, hour, minute }: { day: number, month: number, hour: number, minute: number }) {
  console.log(`Verifying date parts: day=${day}, month=${month}, hour=${hour}, minute=${minute}`)
  if (month < 0 || month > 11) {
    return err('Invalid month: must be between 0 (January) and 11  (December)')
  }
  if (day < 1 || day > 31) {
    return err('Invalid day: must be between 1 and 31')
  }
  if (day > 30 && (month === 3 || month === 5 || month === 8 || month === 10)) {
    return err('Invalid day: month has only 30 days')
  }
  const year = new Date().getFullYear()
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
  if (day > 29 && month === 1 && isLeapYear) {
    return err('Invalid day: February has only 29 days in a leap year')
  }
  if (day > 28 && month === 1 && !isLeapYear) {
    return err('Invalid day: February has only 28 days in a non-leap year')
  }
  if (day > 31) {
    return err('Invalid day: must be between 1 and 31')
  }

  if (hour < 0 || hour > 23) {
    return err('Invalid hour: must be between 0 and 23')
  }
  if (minute < 0 || minute > 59)  {
    return err('Invalid minute: must be between 0 and 59')
  }
  return ok({ day, month, hour, minute })  
}

export function listScheduledMessages() {
  return makeRequest<ScheduledMessage[]>({ method: 'get', url: '/scheduled-messages' })
  .map(pick('data'))
  .map(values => values.map(msg => `ID: ${msg.id}, Recipient: ${msg.recipient.name}, Scheduled Date: ${new Date(msg.scheduledDate).toISOString()}, Message: ${msg.message}`))
  .map(values => values.join('\n'))
  .match(
    values => {
      console.log('Scheduled messages:')
      console.log(values)
    },
    error => {
      console.error(`Failed to list scheduled messages: ${error}`)
    }
  )
}

export function deleteScheduledMessage(id: string | undefined) {
  return parseNumber(id, 'Invalid ID format')
  .asyncAndThen(parsedId => makeRequest({ method: 'delete', url: `/scheduled-messages/${parsedId}` }))
  .match(
    () => {
      console.log(`Scheduled message with ID ${id} deleted successfully`)
    },
    error => {
      console.error(`Failed to delete scheduled message: ${error}`)
    }
  )
}

export function addRecipient(name: string | undefined, phoneNumber: string | undefined) {
  return mergeAsync({
    name: okAsync(name).andThen(expectDefined('No name provided')),
    phoneNumber: okAsync(phoneNumber).andThen(expectDefined('No phone number provided')),
  })
  .andThen(({ name, phoneNumber }) => makeRequest<Recipient>({
    method: 'post',
    url: '/recipients',
    data: { name, phoneNumber },
  }))
  .map(pick('data'))
  .match(
    value => {
      console.log(`Recipient added successfully: ${value.name} (${value.phoneNumber})`)
    },
    error => {
      console.error(`Failed to add recipient: ${error}`)
    }
  )
}

export function configureMattermost() {
  return combineSequentially([
    () => prompt('Mattermost server url:'),
      () => prompt('Email:'),
      () => prompt('Password:', { secret: true }),
  ])
    .andThen(([url, email, password]) => login({ url, username: email, password })
             .andThen(([client, userId]) => getMattermostChannels(client, userId)
                      .andTee(displayChannels)
                      .andThen(channels => retryUntilOk(() => pickAChannel(channels)))
                     )
                     .map(channelName => ({ url, username: email, password, channelName }))
            )

            .andThen(config => makeRequest({
              method: 'post',
              url: '/mattermost-config',
              data: config,
            }))
            .andTee(() => console.log('Mattermost config saved!'))

            .andThen(() => retryUntilOk(() => yesOrNoPrompt('Send good morning message now? (yes/no): ')))
            .andThen(choice => onlyIfAsync(choice === 'yes', () => makeRequest({
              method: 'post',
              url: '/mattermost-send-morning-message',
            })))
            .andTee(() => console.log('Good morning message sent!'))

            .match(
              () => {},
                (error) => console.error('Unable to save matter most config. ' + error),
            )
}

function pickAChannel(channels: Channel[]) {
  return prompt('Choose channel:')
  .andThen(choice => parseNumber(choice, 'Input must be a number'))
  .map(channelIndex => channels[channelIndex - 1])
  .andThen(expectDefined('Please select a valid channel'))
  .map(pick("name"))
}

function yesOrNoPrompt(message: string) {
  return prompt(message)
  .andThrough(choice => errorIf(
    !['yes', 'no'].includes(choice.toLowerCase()),
    'Invalid choice'
  )) as ResultAsync<'yes' | 'no', 'Invalid choice'>
}

function prompt(message: string, options: { secret: boolean } = { secret: false }): ResultAsync<string, never> {
  return fromSafePromise(read({
    prompt: message,
    silent: options.secret,
  }))
}

function displayChannels(channels: Channel[]) {
  // TODO: this needs some work to show channels in a more user friendly manner.
  console.log(
    channels
    .map((channel, index) => `${(index + 1).toString().padStart(3, ' ')}. ${channel.name}`)
    .join('\n')
  )
}

function retryUntilOk<T>(action: () => ResultAsync<T, string>): ResultAsync<T, string> {
  return action()
  .orTee(error => console.log(`${error}.`, 'Please try again'))
  .orElse(() => retryUntilOk(action))
}

function makeRequest<T>({ method, url, data }: {
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  data?: any
}) {
  return fromPromise(axios<T>({
    method,
    url: 'http://localhost:12120' + url,
      data,
  }),
  (error) => `Failed to make request to ${url}: ${error}`,
                    )
}
