// tests/index.test.js
const request = require('supertest');
const app = require('../src/index');

describe('GET /users', () => {
  it('should return a list of users', async () => {
    const res = await request(app).get('/users');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

console.log('Iniciando os testes...');

jest.setTimeout(30000);