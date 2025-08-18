import { Database } from '..'

export async function apply(database: Database) {
  await database.raw.exec(`
    CREATE TABLE IF NOT EXISTS mattermost_message_history (
      type VARCHAR(20) PRIMARY KEY NOT NULL CHECK (type IN ('GoodMorning', 'BirthdayWishes')),
      data TEXT NOT NULL
    )
  `)

  const goodMorningRecord = await database.raw.get<{ time: number }>(
    `SELECT time FROM mattermost_last_good_morning_message LIMIT 1`,
  )

  if (goodMorningRecord) {
    await database.raw.run(`
      INSERT INTO mattermost_message_history (type, data)
      VALUES ('GoodMorning', ?)
    `, JSON.stringify({ time: goodMorningRecord.time }))
  }

  await database.raw.run(`DROP TABLE IF EXISTS mattermost_last_good_morning_message`)
}
