const API_URL = 'https://script.google.com/macros/s/AKfycbxpk3MuAwW3DUF5TKapc32utnKhrEWRA7ozUHEiW3vFq_7KFQAjr4RrLEQBvX3DxUiy/exec';
const fetch = require('node-fetch') || globalThis.fetch;

async function request(action, payload) {
  const res = await fetch(API_URL + "?action=" + action, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {'Content-Type': 'application/json'}
  });
  return res.json();
}

async function run() {
  console.log("Fetching...");
  const prodsRes = await request('admin_products', { token: 'ps_admin_2026_02_13' });
  let p = prodsRes.products.find(x => x.category_id === 'motherboards');
  if (!p) p = prodsRes.products[0];
  console.log("Original specs_json:", p.specs_json);
  
  console.log("Saving with TEST field...");
  p.specs_json = JSON.stringify({"Тест_Финальный": "Работает 100%"});
  const sRes = await request('admin_save_product', { token: 'ps_admin_2026_02_13', item: p });
  console.log("Save status:", sRes);
  
  console.log("Re-fetching...");
  const prodsRes2 = await request('admin_products', { token: 'ps_admin_2026_02_13' });
  const p2 = prodsRes2.products.find(x => x.id === p.id);
  console.log("New specs_json is:", p2 ? p2.specs_json : "Missing");
}
run();
