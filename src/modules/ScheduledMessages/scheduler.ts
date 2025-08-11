import { sendWithMudslide } from '../../utilities/sendWithMudslide';
import { ResultAsync, okAsync } from 'neverthrow';
import { createLogger } from '../../utilities/Logger';
import { notify } from '../../utilities/Notification';
import { Database } from '../../database';
import { combineSequentially, conditionalResult, conditionalResultAsync } from '../../utilities/functional';
import { ScheduledMessage } from '../../types';

const log = createLogger('Scheduler');

export function runScheduledMessagesTask(database: Database) {
  return database.scheduledMessages.findAll()
    .andTee(messages => log(`Running scheduled messages task for ${messages.length} messages`))
    .andThen(messages => combineSequentially(messages.map(msg => () => processScheduledMessage(msg, database))))
}

function processScheduledMessage(msg: ScheduledMessage, db: Database) {
  return conditionalResultAsync(
    msg.scheduledDate <= Date.now() && !msg.failedToSend,
    () => sendScheduledMessage(msg, db),
    () => {
      log(`Skipping message ${msg.id} - either in the future or already failed`);
      return okAsync(true);
    }
  )
}

function sendScheduledMessage(msg: ScheduledMessage, db: Database) {
  return ResultAsync.fromPromise(
    sendWithMudslide({
      phoneNumber: msg.recipient.phoneNumber,
      message: msg.message,
    }),
    (error) => new Error(`Failed to send message: ${error}`)
  )
    .andThen(() => {
      log(`Sending message ${msg.id} to ${msg.recipient.phoneNumber}`);
      notify(`Sending scheduled message: To: ${msg.recipient.name} - ${msg.message}`);
      return db.scheduledMessages.delete(msg.id);
    })
    .orElse((error) => {
      log(`Failed to send message ${msg.id}: ${error}`);
      notify(`Failed to send scheduled message: ${msg.message}`);
      return db.scheduledMessages.markAsFailed(msg)
    });
}