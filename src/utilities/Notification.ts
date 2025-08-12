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

export function notify(title: string, message?: string) {
    if (NOTIFY_STRATEGY === 'notify-send') {
        notifySend(title, message);
    } else {
        log(title, message ?? '');
    }
}