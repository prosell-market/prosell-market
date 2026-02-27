#!/usr/bin/env node
/**
 * scripts/deploy-gas.js
 * Надёжный деплой Google Apps Script через clasp:
 * 1. clasp push
 * 2. создать новую version
 * 3. найти существующий web app deployment (приоритет — KNOWN_DEPLOYMENT_ID)
 * 4. redeploy существующего ИЛИ создать новый
 * 5. если URL изменился — обновить frontend/api.js
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CLASP = "npx clasp";
const API_JS_PATH = path.join(__dirname, "..", "frontend", "api.js");

// Текущий действующий web app deployment ID (совпадает с DATA_URL в api.js).
// При redeploy именно он обновляется => /exec URL остаётся тем же.
const KNOWN_DEPLOYMENT_ID =
  "AKfycbxpk3MuAwW3DUF5TKapc32utnKhrEWRA7ozUHEiW3vFq_7KFQAjr4RrLEQBvX3DxUiy";

function run(cmd) {
  console.log(`\n▶ ${cmd}`);
  const result = execSync(cmd, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });
  console.log(result);
  return result.trim();
}

function getCurrentDataUrl() {
  const content = fs.readFileSync(API_JS_PATH, "utf8");
  const match = content.match(/const DATA_URL\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function updateDataUrl(newUrl) {
  let content = fs.readFileSync(API_JS_PATH, "utf8");
  const oldMatch = content.match(/const DATA_URL\s*=\s*"([^"]+)"/);
  if (!oldMatch) {
    console.warn("⚠️  DATA_URL не найден в api.js — пропускаем обновление");
    return false;
  }
  const oldUrl = oldMatch[1];
  if (oldUrl === newUrl) {
    console.log("✅ DATA_URL не изменился, api.js не трогаем");
    return false;
  }
  content = content.replace(
    /const DATA_URL\s*=\s*"([^"]+)"/,
    `const DATA_URL = "${newUrl}"`
  );
  fs.writeFileSync(API_JS_PATH, content, "utf8");
  console.log(
    `✅ DATA_URL обновлён в api.js:\n   было: ${oldUrl}\n   стало: ${newUrl}`
  );
  return true;
}

function parseDeployments(output) {
  const lines = output.split("\n").filter(Boolean);
  return lines
    .map((line) => {
      const m = line.match(/-\s+(AK\S+)\s+@(\d+)/);
      if (m) {
        return { id: m[1], version: parseInt(m[2], 10) };
      }
      return null;
    })
    .filter(Boolean);
}

async function main() {
  console.log("\n🚀 ProSell Market — GAS Deploy Script\n");

  const currentUrl = getCurrentDataUrl();
  console.log(`📌 Текущий DATA_URL: ${currentUrl || "НЕ НАЙДЕН"}`);

  // 1. Push
  console.log("\n--- [1/4] clasp push ---");
  run(`${CLASP} push --force`);

  // 2. Создать новую версию
  console.log("\n--- [2/4] Создаём новую версию ---");
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  let versionOutput;
  try {
    versionOutput = run(`${CLASP} version "Auto deploy ${now}"`);
  } catch (e) {
    console.error("❌ Не удалось создать версию:", e.message);
    process.exit(1);
  }

  const versionMatch = versionOutput.match(/(\d+)/);
  const versionNumber = versionMatch ? versionMatch[1] : null;
  if (!versionNumber) {
    console.error(
      "❌ Не удалось определить номер версии из вывода:",
      versionOutput
    );
    process.exit(1);
  }
  console.log(`✅ Версия создана: ${versionNumber}`);

  // 3. Определяем deployment для redeploy
  console.log("\n--- [3/4] Определяем deployment ---");
  let deploymentsOutput = "";
  try {
    deploymentsOutput = run(`${CLASP} deployments`);
  } catch (e) {
    console.warn("⚠️  Не удалось получить deployments:", e.message);
  }

  const deployments = parseDeployments(deploymentsOutput);

  // Приоритет: известный ID → любой non-HEAD с версией > 0
  let targetDeployment =
    deployments.find((d) => d.id === KNOWN_DEPLOYMENT_ID) ||
    deployments.find((d) => d.version > 0);

  if (targetDeployment) {
    console.log(
      `♻️  Найден deployment для redeploy: ${targetDeployment.id} @${targetDeployment.version}`
    );
  } else {
    console.log("🆕 Подходящий deployment не найден — создадим новый");
  }

  // 4. Redeploy или Deploy
  console.log("\n--- [4/4] Деплоим ---");
  let deploymentId = null;
  let urlChanged = false;

  if (targetDeployment) {
    try {
      run(
        `${CLASP} redeploy ${targetDeployment.id} ${versionNumber} "Auto deploy ${now}"`
      );
      deploymentId = targetDeployment.id;
      // При redeploy /exec URL сохраняется — обновлять api.js не нужно
      console.log(`✅ Redeploy выполнен, /exec URL сохранён`);
    } catch (e) {
      console.error("❌ Redeploy завершился с ошибкой:", e.message);
      process.exit(1);
    }
  } else {
    let deployOut = "";
    try {
      deployOut = run(
        `${CLASP} deploy --versionNumber ${versionNumber} --description "Auto deploy ${now}"`
      );
    } catch (e) {
      console.error("❌ Deploy завершился с ошибкой:", e.message);
      process.exit(1);
    }

    // Пытаемся вытащить новый deployment ID из вывода
    const newIdMatch = deployOut.match(/- (AK\S+)/);
    if (newIdMatch) {
      deploymentId = newIdMatch[1];
      const newExecUrl = `https://script.google.com/macros/s/${deploymentId}/exec`;
      urlChanged = updateDataUrl(newExecUrl);
      // Обновляем KNOWN_DEPLOYMENT_ID для будущих запусков — сообщаем вручную
      console.log(
        `\nℹ️  Новый deployment ID: ${deploymentId}\n` +
        `   Обновите KNOWN_DEPLOYMENT_ID в scripts/deploy-gas.js на:\n   ${deploymentId}`
      );
    } else {
      console.warn(
        "⚠️  Не удалось определить новый deployment ID из вывода.\n" +
        `   Вручную проверьте: https://script.google.com/home/projects/1oBhM3dLIBrIsbzx89_t8zEq5HPAzkkSqG2Sq6pgFnQFWXEtJGYsY5Iy1/deployments`
      );
    }
  }

  // Итоговый отчёт
  console.log("\n════════════════════════════════════════");
  console.log("📋 ОТЧЁТ О ДЕПЛОЕ GAS");
  console.log("════════════════════════════════════════");
  console.log(`✅ clasp push           : выполнен`);
  console.log(`✅ GAS version          : ${versionNumber}`);
  console.log(`✅ Deployment ID        : ${deploymentId || "неизвестен"}`);
  console.log(`📌 /exec URL            : ${currentUrl || "неизвестен"}`);
  console.log(
    `📝 api.js обновлён      : ${urlChanged ? "ДА (URL изменился)" : "НЕТ (URL сохранён)"}`
  );
  console.log("════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error("🔴 Критическая ошибка:", e.message);
  process.exit(1);
});
