import { okAsync } from 'neverthrow';
import {
    RecipientTemplate,
    ScheduledTemplate,
} from '../../types';
import { Database, DatabaseError } from '../../database';
import _ from 'lodash';
import { pick, conditionalResultAsync, errorIf, expectDefined, expectFalsy, merge, mergeAsync } from '../..//utilities/functional';

export function createSheduledMessageUseCases(db: Database) {
    const createRecipient = (template: Partial<RecipientTemplate>) => merge({
        name: expectDefined('NoNameProvided')(template.name),
        phoneNumber: expectDefined('NoPhoneNumberProvided')(template.phoneNumber)
    })
        .asyncAndThrough(({ name, phoneNumber }) => mergeAsync({
            name: db.recipients.findByName(name).andThen(expectFalsy('RecipientNameTaken')),
            phoneNumber: db.recipients.findByPhoneNumber(phoneNumber).andThen(expectFalsy('PhoneNumberTaken')),
        }))
        .andThen(template => db.recipients.create(template))

    return {
        createRecipient,

        listRecipients: (name?: string) => {
            return name
                ? db.recipients.findByName(name).map(value => value ? [value] : [])
                : db.recipients.findAll()
        },

        createScheduledMessage: (template: ScheduledTemplate) => {
            return mergeAsync({
                message: okAsync(template.message).andThen(expectDefined('NoMessageProvided')),
                scheduledDate: okAsync(template.scheduledDate).andThen(expectDefined('NoScheduledDateProvided')),
                recipientId: conditionalResultAsync(
                    'recipientId' in template,
                    () => okAsync(_.get(template, 'recipientId')!),
                    () => createRecipient({
                        name: _.get(template, 'name'),
                        phoneNumber: _.get(template, 'phoneNumber'),
                    }).map(pick('id'))
                ),
            })
                .andThrough(({ scheduledDate }) => errorIf(scheduledDate < Date.now(), 'ScheduledDateInPast'))
                .andThen(db.scheduledMessages.create)
        },

        listScheduledMessages: db.scheduledMessages.findAll,

        deleteScheduledMessage: db.scheduledMessages.delete,

        listFailedMessages:  db.scheduledMessages.findFailedMessages,
    }
}