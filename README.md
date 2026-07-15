# LitOverlay

LitOverlay - статическое ES-модульное приложение для чтения интерактивных книг. В проекте есть библиотека произведений, reader, медиа-вставки, подсказки, полнотекстовый поиск, настройки чтения, кастомные темы и возрастной гейт.

Публичная версия проекта задумана для GitHub Pages:

<https://greek-salad.github.io/LitOverlay/>

## Возможности

- Библиотека книг с обложками, метаданными, поиском, list/grid-переключателем и блоком продолжения чтения.
- Reader с оглавлением, footer-навигацией, поиском по тексту, прогрессом чтения и подсветкой абзацев.
- Медиа-инъекции по правилам: изображения, inline-аудиоплееры, глобальный аудиоплеер в тулбаре, панель lyrics.
- Hint-инъекции по правилам с предупреждениями, если anchor не найден.
- Настройки чтения: шрифт, размер текста, ширина читального блока, межстрочный интервал.
- Темы: светлая, тёмная и custom colors через собственный color picker.
- Возрастной гейт для 18+ книг.

## Быстрый Старт

Проект не требует сборки и не имеет npm-зависимостей. Нужен локальный HTTP-сервер, потому что главы, JSON и медиа загружаются через `fetch`.

```bash
npm run serve
```

Откройте:

```text
http://127.0.0.1:8000/
```

`npm run serve` запускает `tools/static-server.js`. Он отдаёт статические файлы и поддерживает byte ranges, что важно для нормальной промотки audio.

Для быстрой проверки можно использовать и `npx serve`. В проекте есть `serve.json`, который отключает clean URL redirect и directory listing:

```bash
npx serve
```

## Тесты

Unit-проверки:

```bash
npm test
```

Браузерные тесты подключаются к уже запущенному Chrome через Chrome DevTools Protocol. Обычно нужен локальный сервер и headless Chrome.

Пример:

```bash
npm run serve
google-chrome-stable --headless=new --remote-debugging-port=9222 about:blank
CDP_ENDPOINT=http://127.0.0.1:9222/json BROWSER_TEST_BASE_URL=http://127.0.0.1:8000 npm run browser-routing
```

Доступные browser-тесты:

- `npm run browser-library` - библиотека, карточки, continue-блок, controls.
- `npm run browser-routing` - root routing, открытие всех книг, footer на коротких главах.
- `npm run browser-smoke` - основной smoke reader-а, age gate, media, search, warnings.
- `npm run browser-storage-migration` - применение legacy `localStorage`.
- `npm run browser-audio-seek` - промотка аудио до полной загрузки.
- `npm run browser-settings-overflow` - настройки, шрифты, слайдеры, отсутствие overflow.
- `npm run browser-hints` - hint-инъекции и предупреждения.

## Структура Проекта

```text
.
├── index.html                  # entry point библиотеки
├── book.html                   # entry point reader-а
├── manifest.json               # PWA manifest
├── favicon.ico
├── css/
│   ├── normalize.css
│   ├── fonts.css
│   └── app.css                 # основной stylesheet ремастера
├── js/
│   ├── library.js              # custom element библиотеки
│   ├── reader.js               # custom element reader-а
│   ├── core/
│   │   ├── icons.js
│   │   ├── storage.js
│   │   ├── theme.js
│   │   └── utils.js
│   ├── data/
│   │   └── books.js
│   ├── reader/
│   │   ├── audio.js
│   │   ├── color-picker.js
│   │   ├── hints.js
│   │   ├── media.js
│   │   └── search.js
│   └── ui/
│       └── modals.js
├── books/
│   ├── index.json
│   └── {bookId}/
│       ├── info.json
│       ├── cover.png
│       ├── chapters/
│       ├── media-rules.json
│       ├── hint-rules.json
│       └── media/
├── fonts/                      # локальные WOFF2-шрифты
├── tests/                      # unit и browser smoke tests
├── tools/
│   └── static-server.js
└── serve.json                  # конфиг для npx serve
```

## Формат Книг

Список книг находится в `books/index.json`:

```json
{
  "lastUpdated": "2026-03-03",
  "books": ["hellfire", "train", "mondschein", "digitalfever"]
}
```

Каждая книга лежит в `books/{bookId}/` и содержит `info.json`:

```json
{
  "id": "my-book",
  "title": "Название книги",
  "author": "Автор",
  "writtenDate": "2026-01-01",
  "description": "Описание книги",
  "tags": ["фантастика", "юмор"],
  "cover": "cover.png",
  "finished": false,
  "hasPreface": true,
  "totalChapters": 10,
  "hasMedia": true,
  "hasHints": true,
  "ageRating": 18,
  "showAgeGate": true
}
```

Главы лежат в `chapters/`. Поддерживаются имена вида:

- `0.html`, `00.html`, `000.html`, `0000.html`;
- `1.html`, `01.html`, `001.html`, `0001.html`;
- и так далее.

Reader сам ищет доступный вариант имени, запоминает найденную ширину нумерации и догружает полный список глав в фоне.

Минимальный HTML главы:

```html
<h2>Название главы</h2>
<p>Первый абзац.</p>
<p>Второй абзац.</p>
```

HTML глав считается доверенным контентом проекта. Runtime удаляет очевидно опасные `script`, `object`, `embed`, inline handlers и `javascript:` URL, но это не замена полноценной sanitation pipeline для внешних книг.

## Media Rules

Правила хранятся в `books/{bookId}/media-rules.json`:

```json
{
  "version": "1.0",
  "media": [
    {
      "id": "image-15-1",
      "type": "image",
      "src": ["media/images/ch15comments.png"],
      "format": "image/png",
      "chapter": 15,
      "position": "instead",
      "anchor": "получили, гады!",
      "alt": "Скриншот комментариев"
    },
    {
      "id": "audio-15-1",
      "type": "audio",
      "title": "Heretoir - Burial",
      "src": ["media/audio/burial.mp3"],
      "format": "audio/mpeg",
      "chapter": 15,
      "position": "before",
      "anchor": "В наушниках играла песня"
    }
  ]
}
```

`position`:

- `before` - вставить перед anchor-элементом;
- `after` - вставить после anchor-элемента;
- `instead` - заменить anchor-элемент медиа-вставкой.

Если anchor или файл не найден, reader показывает кнопку предупреждений в тулбаре.

## Hint Rules

Подсказки хранятся в `books/{bookId}/hint-rules.json`:

```json
{
  "version": "1.0",
  "hints": [
    {
      "id": "hint-05-3",
      "chapter": 5,
      "text": "API",
      "hint": "Интерфейс, через который разные программные компоненты взаимодействуют друг с другом"
    }
  ]
}
```

Hint-инъектор ищет текст в содержимом главы, оборачивает первое подходящее вхождение и сообщает warning, если текст не найден.

## Hosting

Baseline-ссылки строятся так:

```text
book.html?id={bookId}&chapter={chapter}
```

Reader также умеет извлечь book id из path вида `/book/{bookId}`, если такой entry point уже отдан сервером. Для GitHub Pages основной безопасный вариант - `book.html?id=...`.

---

> 💡 **Совет для стримеров и чтецов**: используйте подсветку абзацев, чтобы не терять место в тексте во время общения с аудиторией. Один клик — и нужный абзац всегда будет выделен!

Разработано с ❤️ для создания атмосферных интерактивных повествований.
