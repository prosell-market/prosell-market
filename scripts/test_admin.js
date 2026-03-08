const API_URL = 'https://script.google.com/macros/s/AKfycbxpk3MuAwW3DUF5TKapc32utnKhrEWRA7ozUHEiW3vFq_7KFQAjr4RrLEQBvX3DxUiy/exec';
const TOKEN = 'ps_admin_2026_02_13';

async function request(data) {
  const payload = JSON.stringify(data);
  const res = await fetch(API_URL, {
    method: 'POST',
    body: payload,
    headers: { 'Content-Type': 'application/json' }
  });
  return await res.json();
}

async function run() {
  console.log("1. Fetching current products...");
  let res = await request({ action: "admin_products", token: TOKEN });
  if (!res.products) return console.error("No products in response:", res);

  const testProd = res.products.filter(p => p.category === "Материнские платы" || p.category_id === "Материнские платы")[0] || res.products[0];
  console.log("Found product:", testProd.id, testProd.title);

  // 2. Save product with new specs_json
  const newSpecs = JSON.stringify({ "Форм-фактор": "ATX", "Тест": "Да" });
  const updatePayload = {
    action: "admin_save_product",
    token: TOKEN,
    item: {
      ...testProd,
      desc: "Тестовое описание",
      specs_json: newSpecs
    }
  };

  console.log("2. Saving product with specs_json...");
  let saveRes = await request(updatePayload);
  console.log("Save result:", saveRes);

  console.log("3. Fetching again...");
  let res2 = await request({ action: "admin_products", token: TOKEN });
  const updatedProd = res2.products.find(p => p.id === testProd.id);

  console.log("Updated product specs_json:");
  console.log(updatedProd.specs_json);
}

run().catch(console.error);
