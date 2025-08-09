import { bootstrap as bootstrapMattermostAutomation } from './modules/Mattermost'
import { createSingleInstanceLock } from './utilities/SingleInstanceLock'

const closeApp = async () => process.exit(0)

async function startDaemon() {
  await createSingleInstanceLock(closeApp)
  await bootstrapMattermostAutomation()
}

void startDaemon()
