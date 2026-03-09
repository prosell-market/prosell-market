const API_URL = 'https://script.google.com/macros/s/AKfycbxpk3MuAwW3DUF5TKapc32utnKhrEWRA7ozUHEiW3vFq_7KFQAjr4RrLEQBvX3DxUiy/exec';
const fetch = require('node-fetch') || globalThis.fetch;
fetch(API_URL + '?action=debug_sheet', {
  method: 'POST',
  body: JSON.stringify({ token: "ps_admin_2026_02_13" }),
  headers: {'Content-Type': 'application/json'}
}).then(r => r.json()).then(console.log).catch(console.error);
