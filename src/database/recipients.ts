import { ResultAsync } from "neverthrow"
import { Recipient } from "../types"
import { Database, DatabaseError } from "."
import { expectDefined, pick } from "../utilities/functional"

type RecipientRecord = {
    id: number
    name: string
    phone_number: string
}

const toRecipient = (row: RecipientRecord): Recipient => ({
    id: row.id,
    name: row.name,
    phoneNumber: row.phone_number,
})

export const createRecipentDatabaseOperations = (db: Database['raw']) => {
    const findById = (id: number) => {
        return ResultAsync.fromPromise(
            db.get<RecipientRecord>('SELECT * FROM recipient WHERE id = ?', id),
            (error) => new DatabaseError(`Failed to find recipient by id: ${error}`)
        )
        .map(row => row ? toRecipient(row) : undefined)
    }

    return {
        findAll: () => {
            return ResultAsync.fromPromise(
                db.all<RecipientRecord[]>('SELECT * FROM recipient'),
                (error) => new DatabaseError(`Failed to find all recipients: ${error}`)
            )
            .map(rows => rows.map(toRecipient))
        },

        findById,

        findByName: (name: string) => {
            return ResultAsync.fromPromise(
                db.get<Recipient>('SELECT * FROM recipient WHERE name = ?', name),
                (error) => new DatabaseError(`Failed to find recipient by name: ${error}`)
            )
        },

        findByPhoneNumber: (phoneNumber: string) => {
            return ResultAsync.fromPromise(
                db.get<Recipient>('SELECT * FROM recipient WHERE phone_number = ?', phoneNumber),
                (error) => new DatabaseError(`Failed to find recipient by phone number: ${error}`)
            )
        },

        create: (template: { name: string, phoneNumber: string }) => {
            return ResultAsync.fromPromise(
                db.run(
                    'INSERT INTO recipient (name, phone_number) VALUES (?, ?)',
                    template.name,
                    template.phoneNumber
                ),
                (error) => new DatabaseError(`Failed to create recipient: ${error}`)
            )
                .map(pick('lastID'))
                .andThen(expectDefined(new DatabaseError('Failed to get last ID')))
                .map((id) => ({ id, name: template.name, phoneNumber: template.phoneNumber }))
        },
    }
}