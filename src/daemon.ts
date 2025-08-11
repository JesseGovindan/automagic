import { bootstrap as bootstrapMattermostAutomation } from './modules/Mattermost';
import { createSingleInstanceLock } from './utilities/SingleInstanceLock';
import { startHttpServer } from './server';
import { bootstrapScheduledMessagesModule } from './modules/ScheduledMessages/index';
import { initialiseDatabase } from './database';

const closeApp = async () => process.exit(0)

export async function startDaemon() {
  await createSingleInstanceLock(closeApp);
  const database = await initialiseDatabase()
  const server = await startHttpServer();

  await bootstrapMattermostAutomation();
  bootstrapScheduledMessagesModule(server, database);
}