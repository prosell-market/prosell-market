const API_URL = 'https://script.google.com/macros/s/AKfycbxpk3MuAwW3DUF5TKapc32utnKhrEWRA7ozUHEiW3vFq_7KFQAjr4RrLEQBvX3DxUiy/exec';
const fetch = require('node-fetch') || globalThis.fetch;

async function run() {
  const res = await fetch(API_URL + '?action=admin_products', {
    method: 'POST',
    body: JSON.stringify({ token: "ps_admin_2026_02_13" })
  });
  const json = await res.json();
  const prods = json.products.slice(0, 3);
  console.log("Admin products keys:", Object.keys(prods[0]));
  console.log("Specs JSON field test:", prods.map(p => p.specs_json));
}
run();
