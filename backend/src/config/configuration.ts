export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'werkstatt',
    password: process.env.DB_PASSWORD || 'werkstatt2024',
    name: process.env.DB_NAME || 'werkstattweb',
  },
  ollama: {
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2',
  },
  watchFolder: process.env.WATCH_FOLDER || 'C:\\WerkstattWeb\\rechnungen_pdf',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
});
