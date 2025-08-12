import _ from 'lodash'

import { Database } from './'

import { getMigrations, MigrationSet } from './migrations'
import { createLogger } from '../utilities/Logger'

const log = createLogger('runMigrations')

const CREATE_MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS migrations (
  ID INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT
)`

const ADD_MIGRATION_NAME = `INSERT INTO migrations (name) VALUES (?)`

const SELECT_ALL_MIGRATIONS = `SELECT name from migrations`

export async function runMigrations(database: Database, migrationSet?: MigrationSet) {
  log('Running migrations...')
  await database.raw.exec(CREATE_MIGRATIONS_TABLE)

  const migrations = migrationSet ?? await getMigrations()
  const migrationNames = _.keys(migrations)
  const appliedMigrationNames = await getAppliedMigrationNames(database)

  for (const migrationName of getApplicableMigrations(migrationNames, appliedMigrationNames)) {
    log(`Applying migration: ${migrationName}`)
    await migrations[migrationName]!.apply(database)
    log(`Applied migration: ${migrationName}`)
    await database.raw.run(ADD_MIGRATION_NAME, migrationName)
  }
}

async function getAppliedMigrationNames(database: Database): Promise<string[]> {
  const rows = await database.raw.all<{ name: string }[]>(SELECT_ALL_MIGRATIONS)
  return rows.map((row: any) => row.name)
}

function getApplicableMigrations(migrationNames: string[], appliedMigrationNames: string[]): string[] {
  return migrationNames
    .sort()
    .filter(name => !appliedMigrationNames.includes(name))
}
