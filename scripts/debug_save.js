const API_URL = 'https://script.google.com/macros/s/AKfycbxpk3MuAwW3DUF5TKapc32utnKhrEWRA7ozUHEiW3vFq_7KFQAjr4RrLEQBvX3DxUiy/exec';

async function request(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });
  return res.json();
}

async function run() {
  try {
    const prodsRes = await request({ action: 'admin_products', token: 'ps_admin_2026_02_13' });
    const p = prodsRes.products[0];
    console.log("Editing PRODUCT ID:", p.id);
    console.log("Original specs_json:", p.specs_json);

    console.log("Saving new JSON...");
    p.specs_json = JSON.stringify({ "Тест скрипта": "Работает" });
    const sRes = await request({ action: 'admin_save_product', token: 'ps_admin_2026_02_13', item: p });
    console.log("Save Response:", sRes);

    console.log("Re-fetching from server...");
    const prodsRes2 = await request({ action: 'admin_products', token: 'ps_admin_2026_02_13' });
    const p2 = prodsRes2.products.find(x => x.id === p.id);
    console.log("Refetched specs_json:", p2 ? p2.specs_json : "Missing product");
  } catch (e) { console.error(e); }
}
run();
