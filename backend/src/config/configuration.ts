export default () => {
  // Railway / Supabase liefern DATABASE_URL als einzelne Connection-String
  const dbUrl = process.env.DATABASE_URL;

  return {
    port: parseInt(process.env.PORT, 10) || 3000,
    database: dbUrl
      ? { url: dbUrl }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT, 10) || 5432,
          username: process.env.DB_USERNAME || 'werkstatt',
          password: process.env.DB_PASSWORD || 'werkstatt2024',
          name: process.env.DB_NAME || 'werkstattweb',
        },
    groq: {
      apiKey: process.env.GROQ_API_KEY || '',
      model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
      enabled: process.env.GROQ_ENABLED !== 'false' && !!process.env.GROQ_API_KEY,
    },
    // Ollama (legacy – lokal)
    ollama: {
      url: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
      enabled: process.env.OLLAMA_ENABLED === 'true',
    },
    watchFolder: process.env.WATCH_FOLDER || 'C:\\WerkstattWeb\\rechnungen_pdf',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
  };
};
