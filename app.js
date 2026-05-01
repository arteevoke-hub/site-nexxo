import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

console.log('>>> ENTRY POINT app.js INICIADO <<<');

try {
  register('tsx', pathToFileURL('./'));
  await import('./server.ts');
} catch (e) {
  console.error('ERRO FATAL NO ENTRY POINT:', e);
}
