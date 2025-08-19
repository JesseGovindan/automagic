import express from 'express';
import { createLogger } from './utilities/Logger';

const log = createLogger('HttpServer')

export async function startHttpServer() {
    const PORT = process.env.PORT || 12120;
    const app = express();
    app.use(express.json());
    return new Promise<typeof app>((resolve) => {
        app.listen(PORT, () => {
            log(`Running on port ${PORT}`);
            resolve(app);
        });
    });
}
