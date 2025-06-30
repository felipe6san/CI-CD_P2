require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const port = 5200;
const winston = require('winston');
const { Logtail } = require("@logtail/node");
const { LogtailTransport } = require("@logtail/winston");

// Configuração do Winston
const transports = [
  new winston.transports.Console()
];

if (process.env.LOGTAIL_TOKEN) {
  const logtail = new Logtail(process.env.LOGTAIL_TOKEN);
  transports.push(new LogtailTransport(logtail));
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports
});

const app = express();
app.use(express.json());

const db = new Pool({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: process.env.POSTGRES_PORT
});

db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255)
  )
`).then(() => {
  console.log('Conectado ao PostgreSQL!');
  logger.info("Servidor iniciado!");
}).catch(err => {
  console.error('Erro ao conectar ao PostgreSQL:', err);
  logger.error("Erro ao conectar ao banco", { error: err });
});

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'User API',
      version: '1.0.0',
      description: 'CRUD de usuários com PostgreSQL'
    }
  },
  apis: ['./src/index.js']
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Lista todos os usuários
 *     responses:
 *       200:
 *         description: Lista de usuários
 */
app.get('/users', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM users');
    res.json(rows);
    logger.info('Listou usuários', { quantidade: rows.length });
  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
    logger.error('Erro ao buscar usuários', { error: err });
    res.status(500).json({ error: 'Erro ao buscar usuários', details: err.message });
  }
});

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Cria um novo usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuário criado
 */
app.post('/users', async (req, res) => {
  const { name, email } = req.body;
  try {
    const result = await db.query('INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id', [name, email]);
    res.status(201).json({ id: result.rows[0].id, name, email });
    logger.info('Usuário criado', { id: result.rows[0].id, name, email });
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    logger.error('Erro ao criar usuário', { error: err });
    res.status(500).send(err);
  }
});

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Atualiza um usuário
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuário atualizado
 */
app.put('/users/:id', async (req, res) => {
  const { name, email } = req.body;
  try {
    await db.query('UPDATE users SET name = $1, email = $2 WHERE id = $3', [name, email, req.params.id]);
    res.json({ id: req.params.id, name, email });
    logger.info('Usuário atualizado', { id: req.params.id, name, email });
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    logger.error('Erro ao atualizar usuário', { error: err });
    res.status(500).send(err);
  }
});

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Remove um usuário
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Usuário removido
 */
app.delete('/users/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.status(204).send();
    logger.info('Usuário removido', { id: req.params.id });
  } catch (err) {
    console.error('Erro ao remover usuário:', err);
    logger.error('Erro ao remover usuário', { error: err });
    res.status(500).send(err);
  }
});

/**
 * @swagger
 * /mensagem:
 *   get:
 *     summary: Retorna uma mensagem personalizada
 *     responses:
 *       200:
 *         description: Mensagem personalizada
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Fatec DSM
 */
app.get('/mensagem', (req, res) => {
  res.send(process.env.APP_MESSAGE || 'Mensagem padrão');
  logger.info('Endpoint /mensagem acessado', { mensagem: process.env.APP_MESSAGE || 'Mensagem padrão' });
  if(process.env.NODE_ENV === 'development') {
    console.log(`Segredo de dev: ${process.env.JWT_SECRET}`);
    logger.info('Segredo de dev acessado', { segredo: process.env.JWT_SECRET });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    if (process.env.NODE_ENV === 'development') {
      logger.info(`Servidor rodando em http://localhost:${port}`);
      logger.info(`Swagger em http://localhost:${port}/swagger`);
    } else {
      logger.info('Servidor rodando em ambiente de produção');
    }
  });
}

module.exports = app;
