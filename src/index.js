require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const port = 5200;

const { Logtail } = require("@logtail/node");

const logtail = new Logtail(process.env.LOGTAIL_TOKEN);

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
  logtail.info('Conectado ao PostgreSQL!');
}).catch(err => {
  logtail.error('Erro ao conectar ao PostgreSQL:', err);
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
  } catch (err) {
    logtail.error('Erro ao buscar usuários:', err);
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
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
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
  if(process.env.NODE_ENV === 'development') {
    logtail.info(`Segredo de dev: ${process.env.JWT_SECRET}`);
  }
});

if (require.main === module) {
  app.listen(port, () => {
    logtail.info(`Servidor rodando em http://localhost:${port}`);
    logtail.info(`Swagger em http://localhost:${port}/swagger`);
  });
}

module.exports = app;