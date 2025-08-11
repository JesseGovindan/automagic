import { okAsync, ResultAsync } from "neverthrow"
import { Database, DatabaseError } from "."
import { conditionalResultAsync, expectDefined, mergeAsync, pick } from "../utilities/functional"
import e from "express"
import { ScheduledMessage } from "~/types"

type CreateScheduledMessageTemplate = {
    message: string
    scheduledDate: number
    recipientId: number
}

type ScheduledMessageRecord = {
    id: number
    message: string
    scheduled_date: number
    recipient_id: number
    failed_to_send: number
    r_id: number
    r_name: string
    r_phone_number: string
}

const SELECT_SCHEDULED_MESSAGE_WITH_RECIPIENT = `
    SELECT sm.*, r.id as r_id, r.name as r_name, r.phone_number as r_phone_number
    FROM scheduled_message sm
    JOIN recipient r ON sm.recipient_id = r.id
`

const mapScheduledMessageRecord = (row: ScheduledMessageRecord): ScheduledMessage => ({
    id: row.id,
    recipient: {
        id: row.r_id,
        name: row.r_name,
        phoneNumber: row.r_phone_number
    },
    message: row.message,
    scheduledDate: row.scheduled_date,
    failedToSend: !!row.failed_to_send
})

export const createScheduledMessageDatabaseOperations = (db: Database['raw'], recipient: Database['recipients']) => {
    const findById = (id: number) => {
        return ResultAsync.fromPromise(
            db.get<ScheduledMessageRecord>(SELECT_SCHEDULED_MESSAGE_WITH_RECIPIENT + ' WHERE sm.id = ?', id),
            (error) => new DatabaseError(`Failed to find scheduled message by ID: ${error}`)
        )
        .map((row) => row ? mapScheduledMessageRecord(row) : undefined)
    }

    return {
        findAll: () => {
            return ResultAsync.fromPromise(
                db.all<ScheduledMessageRecord[]>(SELECT_SCHEDULED_MESSAGE_WITH_RECIPIENT),
                (error) => new DatabaseError(`Failed to list scheduled messages: ${error}`)
            )
            .map(rows => rows.map(mapScheduledMessageRecord));
        },

        findById,

        findFailedMessages: () => {
            return ResultAsync.fromPromise(
                db.all<ScheduledMessageRecord[]>(SELECT_SCHEDULED_MESSAGE_WITH_RECIPIENT + ' WHERE sm.failed_to_send = 1'),
                (error) => new DatabaseError(`Failed to list failed messages: ${error}`)
            )
            .map(rows => rows.map(mapScheduledMessageRecord));
        },

        create: (template: CreateScheduledMessageTemplate) => {
            return ResultAsync.fromPromise(
                db.run(
                    'INSERT INTO scheduled_message (message, scheduled_date, recipient_id) VALUES (?, ?, ?)',
                    template.message,
                    template.scheduledDate,
                    template.recipientId,
                ),
                (error) => new DatabaseError(`Failed to create scheduled message: ${error}`)
            )
                .map(pick('lastID'))
                .andThen(expectDefined(new DatabaseError('Failed to get last ID')))
                .andThen(findById)
                .andThen(expectDefined(new DatabaseError('Failed to find created scheduled message')))
        },

        delete: (id: number) => {
            return ResultAsync.fromPromise(
                db.run('DELETE FROM scheduled_message WHERE id = ?', id),
                (error) => new DatabaseError(`Failed to delete scheduled message: ${error}`)
            )
            .map(result => (result.changes ?? 0) > 0);
        },

        markAsFailed: (msg: ScheduledMessage) => {
            return ResultAsync.fromPromise(
                db.run('UPDATE scheduled_message SET failed_to_send = 1 WHERE id = ?', msg.id),
                (error) => new DatabaseError(`Failed to mark message as failed: ${error}`)
            )
            .andThen(() => findById(msg.id))
            .andThen(expectDefined(new DatabaseError('Failed to find updated scheduled message')));
        },
    }
}