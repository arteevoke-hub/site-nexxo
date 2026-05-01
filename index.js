import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Registra o loader do TSX para permitir importar arquivos .ts
register('tsx', pathToFileURL('./'));

// Importa o servidor principal
import './server.ts';
