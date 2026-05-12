export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'werkstatt',
    password: process.env.DB_PASSWORD || 'werkstatt2024',
    name: process.env.DB_NAME || 'werkstattweb',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
  watchFolder: process.env.WATCH_FOLDER || 'C:\\Rechnungen\\Eingang',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
});
