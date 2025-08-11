import express from 'express';


export async function startHttpServer() {
    const PORT = process.env.PORT || 3000;
    const app = express();
    app.use(express.json());
    return new Promise<typeof app>((resolve) => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            resolve(app);
        });
    });
}
