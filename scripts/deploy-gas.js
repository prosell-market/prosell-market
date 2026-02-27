#!/usr/bin/env node
/**
 * deploy-gas.js
 * Автоматически:
 *   1. Читает токен из ~/.clasprc.json
 *   2. Создаёт новую версию скрипта через GAS REST API
 *   3. Обновляет существующий деплоймент до новой версии
 * 
 * Использование: node scripts/deploy-gas.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Конфигурация ────────────────────────────────────────────────────────────
const SCRIPT_ID = '1oBhM3dLIBrIsbzx89_t8zEq5HPAzkkSqG2Sq6pgFnQFWXEtJGYsY5Iy1';
const DEPLOYMENT_ID = 'AKfycbxpk3MuAwW3DUF5TKapc32utnKhrEWRA7ozUHEiW3vFq_7KFQAjr4RrLEQBvX3DxUiy';
// ────────────────────────────────────────────────────────────────────────────

function readClaspToken() {
  const clasprc = path.join(os.homedir(), '.clasprc.json');
  const data = JSON.parse(fs.readFileSync(clasprc, 'utf8'));
  const tokens = data.tokens;
  // берём первый аккаунт
  const account = Object.values(tokens)[0];
  return account;
}

function refreshAccessToken(token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      client_id: token.client_id,
      client_secret: token.client_secret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    });

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.access_token) resolve(parsed.access_token);
        else reject(new Error('Token refresh failed: ' + data));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function gasRequest(method, path, accessToken, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: 'script.googleapis.com',
      path: path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data)); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('🔑 Читаю токен из ~/.clasprc.json...');
  const token = readClaspToken();

  console.log('🔄 Обновляю access token...');
  const accessToken = await refreshAccessToken(token);
  console.log('✅ Token получен');

  // 1. Создать новую версию
  console.log('📦 Создаю новую версию скрипта...');
  const version = await gasRequest(
    'POST',
    `/v1/projects/${SCRIPT_ID}/versions`,
    accessToken,
    { description: 'Auto-deploy: ' + new Date().toISOString() }
  );

  if (!version.versionNumber) {
    console.error('❌ Ошибка создания версии:', JSON.stringify(version, null, 2));
    process.exit(1);
  }
  console.log(`✅ Создана версия: ${version.versionNumber}`);

  // 2. Обновить деплоймент до новой версии
  console.log(`🚀 Обновляю деплоймент ${DEPLOYMENT_ID} до версии ${version.versionNumber}...`);
  const deployment = await gasRequest(
    'PUT',
    `/v1/projects/${SCRIPT_ID}/deployments/${DEPLOYMENT_ID}`,
    accessToken,
    {
      deploymentConfig: {
        scriptId: SCRIPT_ID,
        versionNumber: version.versionNumber,
        manifestFileName: 'appsscript',
        description: 'Auto-deploy: ' + new Date().toISOString(),
      },
    }
  );

  if (deployment.error) {
    console.error('❌ Ошибка обновления деплоймента:', JSON.stringify(deployment.error, null, 2));
    process.exit(1);
  }

  console.log('✅ Деплоймент обновлён!');
  console.log(`🌐 URL: https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec`);
}

main().catch(err => {
  console.error('❌ Критическая ошибка:', err.message);
  process.exit(1);
});
