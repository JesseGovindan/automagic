import { fromPromise, ResultAsync } from 'neverthrow';
import { createLogger } from './Logger';
import { spawn } from 'child_process';

const log = createLogger('Notification');
const NOTIFY_STRATEGY = process.env.NOTIFY_STRATEGY;

function notifySend(title: string, message?: string) {
    spawn('notify-send', [
        '--app-name=Automagic',
        title,
        message ?? '',
    ], { stdio: 'ignore', detached: true });
}

export function desktopPrompt(title: string, message: string): ResultAsync<boolean, Error> {
  const createZenityPromise = () => new Promise<boolean>(resolve => {
    const process = spawn('zenity', [
        '--question',
        `--text=${message}`,
        `--title=Automagic ${title}`,
        // message ?? '',
    ], { stdio: 'ignore', detached: true });

    process.on('error', log)
    process.on('exit', (code) => {
      resolve(code === 0)
    })
  })
  return fromPromise(createZenityPromise(), () => new Error())
}

export function desktopInput(title: string, message: string): ResultAsync<string, Error> {
  const createZenityPromise = () => new Promise<string>((resolve, reject) => {
    const process = spawn('zenity', [
      '--entry',
      `--text=${message}`,
        `--title=Automagic: ${title}`,
        // message ?? '',
    ], { detached: true });

    let userInput = ''
    process.stdout.on('data', data => { userInput = Buffer.from(data).toString() })

    process.on('error', log)
    process.on('exit', (code) => {
      log(`desktop input exitted with code ${code}`)
      if (code === 0) {
        resolve(userInput)
      }
      reject(code)
    })
  })
  return fromPromise(createZenityPromise(), () => new Error())
}

export function notify(title: string, message?: string) {
    if (NOTIFY_STRATEGY === 'notify-send') {
        notifySend(title, message);
    } else {
        log(title, message ?? '');
    }
}
