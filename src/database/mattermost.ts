import { fromPromise } from "neverthrow";
import { DatabaseError } from ".";
import { Database } from "sqlite";
import { expectDefined } from "../utilities/functional";

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

const mapMatterMostConfigRecord = (row: any): MattermostConfig => ({
    url: row.url,
    username: row.username,
    password: row.password,
    channelName: row.channel_name,
});

export function createMattermostDatabaseOperations(database: Database) {
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

        getTimeOfLastGoodMorningMessage: () => fromPromise(
            database.get<{ time: number }>('SELECT * FROM mattermost_last_good_morning_message LIMIT 1'),
            (error) => new DatabaseError(`Failed to get last good morning message time: ${error}`)
        )
            .map(row => row?.time),

        setTimeOfLastGoodMorningMessage: (time: number) => fromPromise(
            database.run('INSERT OR REPLACE INTO mattermost_last_good_morning_message (id, time) VALUES (1, ?)', time),
            (error) => new DatabaseError(`Failed to set last good morning message time: ${error}`)
        )
            .map(() => {}),
    }
}
