import fs from 'fs'
import _ from 'lodash'
import path from 'path'

import { Database } from '../index.js'

export interface Migration {
  apply: (database: Database) => Promise<void>
}

// const __dirname = dirname(fileURLToPath(import.meta.url))

export type MigrationSet = Record<string, Migration>

export async function getMigrations(): Promise<MigrationSet> {
  const migrationFiles = getAllMigrationFiles()
  const migrationImports = startImporting(migrationFiles)
  const migrations = await Promise.all(migrationImports)
  return _.zipObject(migrationFiles.map(filename => filename.split('.').shift()!), migrations)
}

function getAllMigrationFiles(): string[] {
  return fs.readdirSync(__dirname)
    .filter(filename => !filename.startsWith('index'))
}

function startImporting(migrationFiles: string[]) {
  return migrationFiles.map(filename => import(path.join(__dirname, filename)) as Promise<Migration>)
}
