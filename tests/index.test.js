// tests/index.test.js
const request = require('supertest');

describe('Always true', () => {
  it('should always pass', () => {
    expect(false).toBe(false);
  });
});

console.log('Iniciando os testes...');

jest.setTimeout(30000);