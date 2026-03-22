# PSYVIT YBT Gamification

Статическое приложение для scripted-упражнений PSYVIT / YBT с двумя форматами запуска: web-app и desktop launcher.

## Для редакторов контента

Подробная инструкция по изменению упражнений находится здесь:

[ИНСТРУКЦИЯ_ПО_РЕДАКТИРОВАНИЮ_УПРАЖНЕНИЙ.md](C:\Users\evstygney\Documents\геймификация\ИНСТРУКЦИЯ_ПО_РЕДАКТИРОВАНИЮ_УПРАЖНЕНИЙ.md)

## Web-app

```powershell
python -m http.server 4173
```

Откройте [http://localhost:4173](http://localhost:4173).

Что добавлено для web-app:

- `site.webmanifest`;
- `service-worker.js` для offline cache;
- кнопка `Установить web-app` в поддерживаемых браузерах;
- иконка приложения `assets/icon.svg`.

### GitHub Pages

Репозиторий: `ybt-dialogs`

Что уже подготовлено:

- workflow [deploy-pages.yml](C:\Users\evstygney\Documents\геймификация\.github\workflows\deploy-pages.yml);
- файл [.nojekyll](C:\Users\evstygney\Documents\геймификация\.nojekyll);
- все пути в приложении относительные, поэтому сайт корректно работает из подпути репозитория.

После пуша в `main` GitHub Pages будет публиковать сайт. Адрес будет такого вида:

```text
https://<ваш-github-username>.github.io/ybt-dialogs/
```

Что нужно нажать в GitHub один раз:

1. Открыть `Settings -> Pages`.
2. В `Source` выбрать `GitHub Actions`.
3. Запушить этот проект в репозиторий `ybt-dialogs`.

## Desktop

Запуск под Windows:

```powershell
.\launch_desktop.bat
```

Или напрямую:

```powershell
python .\desktop_launcher.py
```

Launcher поднимает локальный HTTP-сервер на `127.0.0.1` и открывает приложение в браузере.

## EXE build

Сборка через `PyInstaller`:

```powershell
python -m PyInstaller --noconfirm --clean .\pysyvit_ybt.spec
```

Или:

```powershell
.\build_exe.bat
```

Результат появится в папке `dist/PSYVIT_YBT_Desktop/`.

## Что реализовано

- загрузка всех упражнений из `data/manifest.json`;
- single-choice сценарии с немедленным consequence и feedback;
- подсчёт score и YBT-профиля по осям `self / business / team`;
- ретрай упражнения;
- история прохождений в `localStorage`;
- экспорт текущего результата и всей истории в `JSON` и `CSV`;
- упаковка в PWA/web-app и desktop-friendly launcher без внешних зависимостей.
