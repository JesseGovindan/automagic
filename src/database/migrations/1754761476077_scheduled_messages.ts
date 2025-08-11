import { Database } from '../index.js'

export async function apply(database: Database) {
  await database.raw.exec(`CREATE TABLE IF NOT EXISTS recipient (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL UNIQUE
  )`)

  await database.raw.exec(`CREATE TABLE IF NOT EXISTS scheduled_message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    scheduled_date BIGINT NOT NULL,
    failed_to_send BOOLEAN DEFAULT 0,
    FOREIGN KEY (recipient_id) REFERENCES recipient(id)
  )`)
}
