const { register } = require('node:module');
const { pathToFileURL } = require('node:url');

console.log('>>> INICIANDO VIA COMMONJS (LEGACY MODE) <<<');

try {
  // Tenta registrar o loader para carregar o TS se necessário
  register('tsx', pathToFileURL('./'));
  require('./server.ts');
} catch (e) {
  console.log('Erro no carregamento:', e.message);
  // Se falhar o TS, tenta carregar o compilado
  try {
    require('./app.js');
  } catch (e2) {
    console.log('Falha total no carregamento.');
  }
}
