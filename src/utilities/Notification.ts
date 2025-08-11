import { createLogger } from './Logger';
import { spawn } from 'child_process';

const log = createLogger('Notification');
const NOTIFY_STRATEGY = process.env.NOTIFY_STRATEGY;

function notifySend(message: string) {
    spawn('notify-send', [message], { stdio: 'ignore', detached: true });
}

function logNotify(message: string) {
    log(message);
}

export function notify(message: string) {
    if (NOTIFY_STRATEGY === 'notify-send') {
        notifySend(message);
    } else {
        logNotify(message);
    }
}