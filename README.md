# AniLinux

AniLinux - это десктопное приложение для просмотра аниме на Linux, построенное на Electron с интеграцией OAuth авторизации через Shikimori.

![Version](https://img.shields.io/badge/version-1.0.3-blue.svg)
![Electron](https://img.shields.io/badge/Electron-28.0.0-9BE349.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Особенности

- 🎬 **Просмотр аниме** - Stream аниме прямо из приложения с использованием mpv плеера
- 🔗 **Shikimori OAuth** - Авторизация через Shikimori для синхронизации просмотра
- 📜 **История просмотра** - Автоматическое сохранение истории просмотренных аниме
- ❤️ **Избранное** - Возможность добавлять аниме в избранное
- 🔍 **Поиск** - Поиск аниме по названию
- ⚙️ **Настройки** - Кастомизация источника данных и качества видео
- 🎨 **Современный интерфейс** - Приятный и интуитивный дизайн

## Требования

- Node.js (v16 или выше)
- npm
- mpv плеер (для Linux: `sudo pacman -S mpv` или `sudo apt install mpv`)

## Установка

### Клонирование репозитория

```bash
git clone https://github.com/Nikren2006/anilinux-electron.git
cd anilinux-electron
```

### Установка зависимостей

```bash
npm install
```

### Запуск приложения

```bash
npm start
```

## Сборка приложения

Для создания установочных пакетов:

```bash
npm run build
```

Собранные файлы будут находиться в директории `dist/`.

Поддерживаемые форматы для Linux:
- AppImage
- deb (Debian/Ubuntu)
- pacman (Arch Linux)

## Структура проекта

```
anilinux/
├── src/
│   ├── main/           # Main process (Electron)
│   │   ├── main.js     # Главный процесс приложения
│   │   └── preload.js  # Preload script
│   ├── renderer/       # Renderer process (UI)
│   │   ├── index.html  # Главная страница
│   │   ├── main.js     # Логика UI
│   │   └── styles/
│   │       └── main.css # Стили
│   └── utils/          # Утилиты и API
│       ├── animevost.js    # Парсер AnimeVost
│       └── shikimori.js    # API Shikimori
├── package.json
└── README.md
```

## Использование

### Просмотр аниме

1. Выберите аниме из списка на главной странице
2. Нажмите на карточку аниме для просмотра деталей
3. Выберите серию и качество видео
4. Нажмите на серию для запуска воспроизведения в mpv

### Shikimori OAuth

1. Перейдите в раздел "Настройки"
2. Нажмите "Войти через Shikimori"
3. Авторизуйтесь в браузере
4. После успешной авторизации ваш аккаунт будет подключен

### История и избранное

- **История** - Автоматически сохраняет последние 100 просмотренных аниме
- **Избранное** - Добавляйте любимые аниме в избранное для быстрого доступа

## Источники данных

Приложение поддерживает следующие источники:
- **AnimeVost** - Основной источник аниме (по умолчанию)
- **Shikimori** - API для получения информации об аниме и синхронизации

## Разработка

### Запуск в режиме разработки

```bash
npm run dev
```

### Сборка для Linux

```bash
npm run build
```

## Конфигурация

Настройки приложения хранятся в:
- Linux: `~/.config/anilinux/anilinux-store.json`

## Troubleshooting

### mpv не найден

Установите mpv плеер:
- Arch Linux: `sudo pacman -S mpv`
- Debian/Ubuntu: `sudo apt install mpv`
- Fedora: `sudo dnf install mpv`

### Порт 3000 занят

OAuth сервер использует порт 3000. Если порт занят, освободите его или измените порт в коде.

## Лицензия

MIT License

## Автор

nikren - [superdug000@gmail.com](mailto:superdug000@gmail.com)

## Ссылки

- [GitHub Repository](https://github.com/Nikren2006/anilinux-electron)
- [Shikimori](https://shikimori.one)
- [AnimeVost](https://animevost.org)
