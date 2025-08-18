import { ok, err, fromPromise, Result } from "neverthrow";
import { DatabaseError } from ".";
import { Database } from "sqlite";
import { expectDefined, ifDefined, ifDefinedThen, pick } from "../utilities/functional";

export type MattermostConfig = {
    url: string,
    username: string,
    password: string,
    channelName: string,
}

type MattermostConfigRecord = {
    id: number,
    url: string,
    channel_name: string,
    username: string,
    password: string,
}

type BirthdayWish = { name: string, date: number }

const mapMatterMostConfigRecord = (row: any): MattermostConfig => ({
    url: row.url,
    username: row.username,
    password: row.password,
    channelName: row.channel_name,
});

const ONE_DAY = 24 * 60 * 60 * 1000
const SEVEN_DAYS = ONE_DAY * 7

export function createMattermostDatabaseOperations(database: Database) {
  const getMessageHistory = (type: 'BirthdayWishes' | 'GoodMorning') => fromPromise(
    database.get<{ data: string }>(`SELECT data FROM mattermost_message_history WHERE type = "${type}"`),
    (error) => new DatabaseError(`Failed to get ${type}: ${error}`)
  )

  const saveMessageHistory = (type: 'BirthdayWishes' | 'GoodMorning') => (data: string) => fromPromise(
    database.run('INSERT OR REPLACE INTO mattermost_message_history (type, data) VALUES ("GoodMorning", ?)', data),
    (error) => new DatabaseError(`Failed to save ${type}: ${error}`)
  )

  const getRecentBirthdayWishes = () => getMessageHistory('BirthdayWishes')
    .andThen(expectDefined('No birthday wishes stored'))
    .map(pick('data'))
    .andThen(parseBirthdayWishes)
    .orElse(() => ok([] as BirthdayWish[]))
  
    return {
        getConfig: () => fromPromise(
            database.get<MattermostConfigRecord>('SELECT * FROM mattermost_config LIMIT 1'),
            (error) => new DatabaseError(`Failed to get Mattermost config: ${error}`)
        )
            .andThen(expectDefined('MattermostConfigNotFound'))
            .map(mapMatterMostConfigRecord),

        saveConfig: ({ url, channelName, username, password }: MattermostConfig) => fromPromise(
            database.run('INSERT OR REPLACE INTO mattermost_config (id, url, channel_name, username, password) VALUES (1, ?, ?, ?, ?)', url, channelName, username, password),
            (error) => new DatabaseError(`Failed to save Mattermost config: ${error}`)
        )
            .map(() => {}),

        getTimeOfLastGoodMorningMessage: () => getMessageHistory('GoodMorning')
            .map(ifDefined(pick('data')))
            .andThen(ifDefinedThen(parseGoodMorningData)),

        setTimeOfLastGoodMorningMessage: (time: number) => ok({ time })
          .map(JSON.stringify)
          .asyncAndThen(saveMessageHistory('GoodMorning'))
          .map(() => {}),

        getRecentBirthdayWishes: () => getRecentBirthdayWishes().map(wishes => wishes.map(({ name }) => name)),

        addBirthdayWishes: (celebrants: string[]) => {
          const newCelebrants = celebrants.map(name => ({ name, date: Date.now() }))
          const keepRecentBirthdayWishes = ((wish: BirthdayWish) => wish.date > Date.now() - SEVEN_DAYS)

          return getRecentBirthdayWishes()
            .map(wishes => wishes.filter(keepRecentBirthdayWishes))
            .map(recentCelebrants => recentCelebrants.concat(newCelebrants))
            .map(JSON.stringify)
            .andThen(saveMessageHistory('BirthdayWishes'))
            .map(() => {})
        },
    }
}

function parseGoodMorningData(data: string) {
  return Result.fromThrowable(
    () => JSON.parse(data) as unknown,
    () => new DatabaseError('Invalid GoodMorning data stored'),
  )()
  .andThen(data => {
    if (typeof data !== 'object') {
      return err(new DatabaseError('GoodMorning data was not an object'))
    }

    if (data === null) {
      return err(new DatabaseError('GoodMorngin data was null'))
    }

    if (!('time' in data)) {
      return err(new DatabaseError('No time stored in GoodMorning data'))
    }

    const time = data.time
    if (typeof time !== 'number') {
      return err(new DatabaseError('Invalid time value stored in GoodMorning data'))
    }

    return ok(time)
  })
}

function parseBirthdayWishes(data: string) {
  return Result.fromThrowable(
    () => JSON.parse(data) as unknown,
    () => new DatabaseError('Invalid BirthdayWishes data stored'),
  )()
  .andThen(data => {
    if (typeof data !== 'object') {
      return err(new DatabaseError('BirthdayWishes data was not an object'))
    }

    if (data === null) {
      return err(new DatabaseError('GoodMorngin data was null'))
    }

    return ok(data as BirthdayWish[])
  })
}
