// Loads the locally built game data (if present) before any test touches the engine.
import fs from 'node:fs';
import { loadContent } from '../src/engine/content';

if (fs.existsSync('data/content.json')) loadContent(JSON.parse(fs.readFileSync('data/content.json', 'utf8')));
