require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { Logtail } = require("@logtail/node");

const port = process.env.PORT || 5200;

const app = express();
const logtail = new Logtail(process.env.LOGTAIL_TOKEN);

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
  logtail.info("Conexão com o PostgreSQL estabelecida com sucesso.");
}).catch(err => {
  console.error('Erro ao conectar ou criar tabela no PostgreSQL:', err);
  logtail.error("Falha ao conectar ou criar tabela no PostgreSQL", { error: err.message });
});

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'User API',
      version: '1.0.0',
      description: 'API para CRUD de usuários com Node.js e PostgreSQL'
    }
  },
  apis: ['./src/index.js']
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get('/users', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM users ORDER BY id ASC');
    res.json(rows);
    logtail.info('Listagem de usuários realizada', { quantidade: rows.length });
  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
    logtail.error('Erro ao buscar usuários', { error: err.message });
    res.status(500).json({ error: 'Erro interno ao buscar usuários' });
  }
});

app.post('/users', async (req, res) => {
  const { name, email } = req.body;
  try {
    const result = await db.query('INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id', [name, email]);
    const newUser = { id: result.rows[0].id, name, email };
    res.status(201).json(newUser);
    logtail.info('Usuário criado com sucesso', { user: newUser });
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    logtail.error('Erro ao criar usuário', { error: err.message });
    res.status(500).json({ error: 'Erro interno ao criar usuário' });
  }
});

app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  try {
    await db.query('UPDATE users SET name = $1, email = $2 WHERE id = $3', [name, email, id]);
    const updatedUser = { id, name, email };
    res.json(updatedUser);
    logtail.info('Usuário atualizado com sucesso', { user: updatedUser });
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    logtail.error('Erro ao atualizar usuário', { error: err.message });
    res.status(500).json({ error: 'Erro interno ao atualizar usuário' });
  }
});

app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.status(204).send();
    logtail.info('Usuário removido com sucesso', { userId: id });
  } catch (err) {
    console.error('Erro ao remover usuário:', err);
    logtail.error('Erro ao remover usuário', { error: err.message });
    res.status(500).json({ error: 'Erro interno ao remover usuário' });
  }
});

app.get('/mensagem', (req, res) => {
  const message = process.env.APP_MESSAGE || 'Mensagem padrão';
  res.send(message);
  logtail.info('Endpoint /mensagem acessado', { mensagem: message });
});

if (require.main === module) {
  app.listen(port, () => {
    const environment = process.env.NODE_ENV || 'não definido';
    const message = `Servidor iniciado e ouvindo na porta ${port}. Ambiente: ${environment}`;
    
    console.log(message);
    logtail.info(message);

    if (environment === 'development') {
      const swaggerMessage = `Swagger UI disponível em http://localhost:${port}/swagger`;
      console.log(swaggerMessage);
      logtail.info(swaggerMessage);
    }
  });
}

module.exports = app;