import express from 'express';
import dotenv from 'dotenv';
import http from 'http';


dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en: http://localhost:${PORT}`)
  console.log(`📘 Documentación Swagger: http://localhost:${PORT}/api-docs`)
})