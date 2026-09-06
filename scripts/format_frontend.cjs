const fs = require('node:fs');

const file = 'frontend/app.js';
const source = fs.readFileSync(file, 'utf8');
fs.writeFileSync(file, source.replace(/[ \t]+$/gm, '').replace(/ +\t/g, '\t'));
