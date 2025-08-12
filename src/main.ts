import { startDaemon } from './daemon'
import * as client from './client'

const DAEMON_COMMAND = '--daemon'
const SCHEDULE_COMMAND = '--schedule'
const LIST_SCHEDULED_COMMAND = '--list-scheduled'
const DELETE_COMMAND = '--delete'
const ADD_RECIPIENT_COMMAND = '--add-recipient'
const CONFIGURE_MATTERMOST = '--configure-mattermost'

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('No command provided. Use "-h" for help.')
    process.exit(1)
  }

  if (args.includes('-h') || args.includes('--help')) {
    console.log('Usage: node main.js [command]')
    console.log('Available commands:')
    console.log(`  ${DAEMON_COMMAND}: Start the daemon process`)
    console.log(`  ${SCHEDULE_COMMAND} <recipientName> <time-specifier> <message>: Schedule a message to be sent`)
    console.log(`  ${LIST_SCHEDULED_COMMAND}: List all scheduled messages`)
    console.log(`  ${DELETE_COMMAND} <id>: Delete a scheduled message by ID`)
    console.log(`  ${ADD_RECIPIENT_COMMAND} <name> <phoneNumber>: Add a new recipient`)
    console.log(`  ${CONFIGURE_MATTERMOST} Configure mattermost messaging settings`)
    console.log('  --help: Show this help message')
    process.exit(0)
  }

  try {
    if (args.includes(DAEMON_COMMAND)) {
      await startDaemon()
    } else if (args.includes(SCHEDULE_COMMAND)) {
      const recipientName = args[args.indexOf(SCHEDULE_COMMAND) + 1]
      const timeSpecifier = args[args.indexOf(SCHEDULE_COMMAND) + 2]
      const message = args.slice(args.indexOf(SCHEDULE_COMMAND) + 3).join(' ')
      await client.scheduleMessage(recipientName, timeSpecifier, message)
    } 
    else if (args.includes(LIST_SCHEDULED_COMMAND)) {
      await client.listScheduledMessages()
      process.exit(0)
    } 
    else if (args.includes(DELETE_COMMAND)) {
      const id = args[args.indexOf(DELETE_COMMAND) + 1]
      await client.deleteScheduledMessage(id)
      process.exit(0)
    } 
    else if (args.includes(ADD_RECIPIENT_COMMAND)) {
      const name = args[args.indexOf(ADD_RECIPIENT_COMMAND) + 1]
      const phoneNumber = args[args.indexOf(ADD_RECIPIENT_COMMAND) + 2]
      await client.addRecipient(name, phoneNumber)
      process.exit(0)
    }
    else if (args.includes(CONFIGURE_MATTERMOST)) {
      await client.configureMattermost()
      process.exit(0)
    }
    else {
      console.error(`Unknown command: ${args.join(' ')}`)
      process.exit(1)
    }
  } catch {
    process.exit(1)
  }
}

void main()
