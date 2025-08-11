import { ScheduledMessage } from '../types';
import { spawn } from 'child_process';
import { createLogger } from './Logger';

const log = createLogger('mudslide');

export function sendWithMudslide(message: { phoneNumber: string, message: string }): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const args = [
            message.phoneNumber,
            message.message,
        ];
        const proc = spawn('npx', ['mudslide@latest', 'send', ...args]);

        proc.stdout.on('data', (data) => {
            log(data);
        });
        proc.stderr.on('data', (data) => {
            log(`Error: ${data}`);
        });

        proc.on('close', (code) => {
            console.log(`Exited with code ${code}`);
            resolve(code === 0);
        });
        proc.on('error', (err) => {
            console.error(`Error: ${err}`);
            reject(err);
        });
    });
}
