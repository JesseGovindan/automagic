import { Database } from '..'

export async function apply(database: Database) {
    await database.raw.exec(`CREATE TABLE IF NOT EXISTS mattermost_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url VARCHAR(255) NOT NULL,
        channel_name VARCHAR(100) NOT NULL,
        username VARCHAR(100) NOT NULL,
        password VARCHAR(100) NOT NULL
    )`)

    await database.raw.exec(`CREATE TABLE IF NOT EXISTS mattermost_last_good_morning_message (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        time BIGINT NOT NULL
    )`)
}
