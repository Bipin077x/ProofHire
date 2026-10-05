const fs = require('fs');
const path = require('path');
const svg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" stroke="#38BDF8" stroke-width="4"/></svg>`;

fs.mkdirSync('public/brand', {recursive: true});
['logo-wordmark.svg', 'favicon.svg'].forEach(f => fs.writeFileSync(path.join('public/brand', f), svg));

fs.mkdirSync('public/illustrations', {recursive: true});
['empty-history.svg', 'error.svg', 'rate-limited.svg'].forEach(f => fs.writeFileSync(path.join('public/illustrations', f), svg));
