import sqlite3 from 'sqlite3'
import { open, Database as SqliteDatabase } from 'sqlite'
import { runMigrations } from './run_migrations'
import { MigrationSet } from './migrations'
import { ResultAsync } from 'neverthrow'
import { Recipient, ScheduledMessage } from '~/types'
import { createRecipentDatabaseOperations } from './recipients'
import { createScheduledMessageDatabaseOperations } from './scheduled_message'
import { createMattermostDatabaseOperations, MattermostConfig } from './mattermost'

export class DatabaseError extends Error {
  _tag: 'DatabaseError' = 'DatabaseError'

  constructor(message: string) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export type Database = {
  raw: SqliteDatabase
  recipients: {
    findAll: () => ResultAsync<Recipient[], DatabaseError>
    findById: (id: number) => ResultAsync<Recipient | undefined, DatabaseError>
    findByName: (name: string) => ResultAsync<Recipient | undefined, DatabaseError>
    findByPhoneNumber: (phoneNumber: string) => ResultAsync<Recipient | undefined, DatabaseError>
    create: (template: { name: string, phoneNumber: string }) => ResultAsync<Recipient, DatabaseError>
  },
  scheduledMessages: {
    findAll: () => ResultAsync<ScheduledMessage[], DatabaseError>
    findById: (id: number) => ResultAsync<ScheduledMessage | undefined, DatabaseError>
    findFailedMessages: () => ResultAsync<ScheduledMessage[], DatabaseError>
    create: (template: { message: string, scheduledDate: number, recipientId: number }) => ResultAsync<ScheduledMessage, DatabaseError>
    delete: (id: number) => ResultAsync<boolean, DatabaseError>
    markAsFailed: (msg: ScheduledMessage) => ResultAsync<ScheduledMessage, DatabaseError>
  },
  mattermost: {
    getConfig: () => ResultAsync<MattermostConfig, DatabaseError | 'MattermostConfigNotFound'>
    saveConfig: (config: MattermostConfig) => ResultAsync<void, DatabaseError>
    getTimeOfLastGoodMorningMessage: () => ResultAsync<number | undefined, DatabaseError | 'NoLastGoodMorningMessageTimeFound'>
    setTimeOfLastGoodMorningMessage: (time: number) => ResultAsync<void, DatabaseError>
    getRecentBirthdayWishes: () => ResultAsync<string[], never>
    addBirthdayWishes: (celebrants: string[]) => ResultAsync<void, DatabaseError>
  }
}

export async function getDb(): Promise<Database> {
  const db = await open({
    filename: './automagic.sqlite',
    driver: sqlite3.Database
  })

  const recipientDbOps = createRecipentDatabaseOperations(db)
  return {
    raw: db,
    recipients: recipientDbOps,
    scheduledMessages: createScheduledMessageDatabaseOperations(db, recipientDbOps),
    mattermost: createMattermostDatabaseOperations(db),
  }
}

export async function initialiseDatabase(options: {
  runMigrations?: boolean,
  runTypeChecking?: boolean,
  migrationSet?: MigrationSet,
} = {}): Promise<Database> {
  const database = await getDb()

  if (options.runMigrations !== false) {
    await runMigrations(database, options.migrationSet)
  }

  if (options.runTypeChecking !== false) {
    // await runTypeChecking()
  }

  return database
}
