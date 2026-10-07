# Job Tracker

Трекер откликов на вакансии: канбан-доска, фокус на сегодня и аналитика воронки.

**Открыть:** https://sukorone.github.io/jobtracker/

## Возможности

- **Доска** — отклики по этапам: Хочу → Отклик → Скрининг → Интервью → Тестовое → Финал → Оффер / Отказ. Карточки перетаскиваются мышью, на телефоне долгим нажатием.
- **Фокус** — просроченные шаги, дела на сегодня и на неделю, а также отклики «в тишине», о которых пора напомнить. Шаг можно закрыть одной кнопкой или добавить в календарь (.ics).
- **Карточка отклика** — все поля, следующий шаг с датой и временем, заметки, автоматическая история смены статусов, шаблоны писем (напоминание, спасибо после интервью, уточнить сроки).
- **Аналитика** — отклики по неделям, воронка с конверсией между этапами, ответы по источникам (hh.ru, LinkedIn, Хабр…), распределение по статусам.
- **Список** с сортировкой, поиск, фильтры по приоритету, источнику и формату, архив.
- Тёмная и светлая темы, PWA (можно установить на телефон, работает офлайн).
- Экспорт в JSON (бэкап) и CSV (Google Sheets / Excel), импорт JSON.

Данные хранятся на вашем сервере (Node + SQLite) под логином и паролем; регистрация закрыта, учётные записи создаются командой на сервере. Тема и вид — настройки устройства, они остаются в браузере.

## Горячие клавиши

| Клавиша | Действие |
| --- | --- |
| `N` | новый отклик |
| `/` | поиск |
| `1` `2` `3` | доска / список / аналитика |
| `Ctrl/⌘ + Enter` | сохранить новый отклик |
| `Esc` | закрыть панель |

## Сервер

Код в [`server/`](server): Hono, встроенный в Node `node:sqlite`, пароли — scrypt, вход по bearer-токену (хранится только хеш, срок 90 дней с продлением), защита от перебора паролей, CORS только для вашего фронтенда.

### Запустить на своём Mac (бесплатно)

Сервер отдаёт и API, и сам сайт, запускается при входе в систему и перезапускается, если упал.

```bash
git clone https://github.com/Sukorone/jobtracker.git ~/jobtracker
~/jobtracker/scripts/install-mac.sh
cd ~/jobtracker/server && node src/cli.ts add <логин>
```

- На Mac: http://localhost:8787/jobtracker/
- С айфона в той же Wi-Fi сети: `http://<IP Mac>:8787/jobtracker/` (скрипт покажет адрес).
- Вне дома — через [Tailscale](https://tailscale.com) (бесплатно): установите его на Mac и айфон под одним аккаунтом, затем `tailscale serve --bg 8787` — получится постоянный HTTPS-адрес вида `https://<mac>.<tailnet>.ts.net/jobtracker/`, доступный только вашим устройствам.
- Mac должен быть включён и не спать.
- Обновление: `cd ~/jobtracker && git pull && scripts/install-mac.sh`.

### Развернуть на VPS

Нужны Docker и домен (или поддомен) для API, например `api.example.com`, с A-записью на сервер.

```bash
git clone https://github.com/Sukorone/jobtracker.git && cd jobtracker/server
cp .env.example .env        # впишите API_DOMAIN и CORS_ORIGINS
docker compose up -d --build
docker compose exec api node src/cli.ts add <логин>   # спросит пароль
```

Caddy сам получит HTTPS-сертификат. База лежит в `server/data/jobtracker.db` — для бэкапа достаточно копировать эту папку.

Управление пользователями:

```bash
docker compose exec api node src/cli.ts list
docker compose exec api node src/cli.ts passwd <логин>   # сбросить пароль, разлогинит все устройства
docker compose exec api node src/cli.ts remove <логин>   # удалить вместе с данными
```

### Подключить фронтенд

В репозитории: **Settings → Secrets and variables → Actions → Variables** → `API_URL` = `https://api.example.com`. Следующий деплой Pages соберётся с этим адресом.

## Разработка

```bash
npm install && (cd server && npm install)
cd server && node src/cli.ts add dev && npm run dev   # API на :8787
npm run dev                                           # http://localhost:5173/jobtracker/, /api проксируется на :8787
npm run build
cd server && npm test
```

Стек: Vite, React 19, TypeScript, Zustand, dnd-kit, Motion; сервер — Hono + SQLite. Фронтенд деплоится на GitHub Pages через GitHub Actions при пуше в `main`.
