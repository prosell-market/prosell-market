ProSell Mini App (GitHub Pages + Google Apps Script)

Файлы:
- index.html         Главная (магазин/корзина/профиль/инфо)
- styles.css         Весь дизайн
- api.js             Все сетевые запросы к Apps Script
- app.js             Логика приложения
- notifications.html Центр уведомлений

ВАЖНО:
1) Открой api.js и вставь URL деплоя Apps Script:
   const DATA_URL = "PASTE_YOUR_APPS_SCRIPT_WEBAPP_URL";
   Нужен URL веб-приложения, который заканчивается на /exec.

2) Локально проверить:
   - Можно открыть index.html двойным кликом.
   - Лучше через локальный сервер (например VS Code Live Server).

3) GitHub Pages:
   Settings -> Pages -> Branch: main, Folder: / (root)
   После пуша открой: https://<username>.github.io/<repo>/

4) Уведомления:
   https://<username>.github.io/<repo>/notifications.html
