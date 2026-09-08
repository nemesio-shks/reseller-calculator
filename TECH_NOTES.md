# Технічні нотатки проекту (для наступної моделі/розробника)

## Що це
Односторінковий сайт-калькулятор для перекупів авто. Персональний кабінет (Firebase Auth),
історія авто зберігається в Firestore per-user. Хостинг — GitHub Pages.

## Репозиторій і деплой
- GitHub repo: https://github.com/nemesio-shks/reseller-calculator
- Публічна сторінка (GitHub Pages): https://nemesio-shks.github.io/reseller-calculator/
- Гілка деплою: `master`, шлях `/` (корінь репо)
- Деплой автоматичний при кожному `git push` в `master` (GitHub Pages build)
- Локальна папка проекту: `C:\Users\plato\WebstormProjects\tst`

## Стек
- Чистий HTML/CSS/JS (без збірки, без npm, без бандлера)
- Firebase v10.12.2 підключений через CDN (`type="module"`, `https://www.gstatic.com/firebasejs/...`)
- Firebase Authentication — email/password
- Firestore — зберігання даних користувача: документ `users/{uid}` з полем `state` (весь стан застосунку одним об'єктом)

## Файлова структура
```
index.html          — розмітка, всі модалки (adjust, settings, bg editor)
style.css           — всі стилі, теми через CSS-змінні (:root, [data-theme="light"/"purple"])
script.js           — вся логіка застосунку (ES-модуль)
i18n.js             — переклади uk/ru, функції t(), setLang(), applyTranslations()
firebase-config.js  — реальні ключі Firebase-проекту (apiKey, projectId і т.д.) — ВАЖЛИВО: не публічний секрет,
                       але прив'язаний до конкретного проекту reseller-calculator-b7217
firebase-init.js    — ініціалізація Firebase SDK, експортує window.__firebase з методами auth/firestore
assets/
  radmirlogo.png     — favicon + іконка в правому нижньому куті сторінки (corner-logo)
  r_rp.png           — лого збоку в шапці кабінету (з CSS-ефектом "shine" — золоте світіння/пульсація)
  bg-video.mp4       — дефонове відео (стиснуте, ~12.8MB, 1280px, без звуку, 2x швидкість, повна тривалість
                       оригіналу з D:\Adobe Premier Projects\20250112162259_1.mp4), opacity 0.07 в CSS
README.md            — інструкція по налаштуванню Firebase (auth, firestore, security rules)
TECH_NOTES.md        — цей файл
```

## Модель даних (Firestore: users/{uid}.state)
```js
{
  activeId: "project-id",       // id активного проекту
  theme: "dark" | "light" | "purple",
  bgType: "video" | "image",     // тип фону (video — дефолт)
  bgImage: "data:image/...;base64,..." | null,  // фото фону, base64 (обережно з лімітом документа Firestore 1MB!)
  bgPos: { x: number, y: number, zoom: number }, // позиція/зум фону (пікселі зсуву + % зуму)
  projects: [
    {
      id: "uid",
      name: "Назва проекту",
      currency: "RUB" | "UAH" | "USD" | "EUR",  // дефолт тепер RUB
      cars: [
        {
          id: "uid",
          name: "BMW E39",
          buyPrice: number,
          sellPrice: number | null,   // null = ще не продано
          comment: "текст (коментар до покупки)",
          adjustments: [ { desc: "покраска", amount: -1000 }, ... ],  // правки +/-
          comments: [ "текст коментаря", ... ]  // коментарі до продажу
        }
      ]
    }
  ]
}
```

## Ключові функції в script.js
- `renderAll()` — головний рендер: applyTheme, applyBackground, renderTabs, renderProjectHeader, renderHistory
- `getCarProfit(car)` — прибуток = sellPrice - buyPrice + сума adjustments (null якщо не продано)
- `parseNumberInput(str)` / `formatNumberPlain(n)` — парсинг/форматування чисел з розділювачами тисяч (пробіл)
- `attachThousandsFormatting(input)` — форматує число наживо під час вводу (input event), зберігає позицію курсора
- `openBgEditor()` / `updateBgEditorTransform()` — редактор фону: зображення показується з оригінальними пропорціями
  (aspect-ratio preserved), базовий масштаб = cover viewport, zoom — множник поверх бази, drag через translate(px)
- `applyBackground()` — застосовує фон на сторінці: якщо bgType === 'video' показує <video>, інакше <img> з тими ж
  transform-обчисленнями що й в редакторі (щоб превью 1:1 співпадало з реальним фоном)
- `animateTabSwitch()` — анімація переходу між вкладками проектів: емблема radmirlogo.png "летить" від старої
  вкладки до нової з rotate(360deg), контент <main> fade-out/fade-in

## Важливі нюанси / TODO на майбутнє
1. **Ліміт Firestore документа 1MB** — якщо користувач завантажить велике фото фону (base64), запис може не
   пройти. Варто або стискати фото перед збереженням (canvas resize), або зберігати фон у Firebase Storage
   замість Firestore.
2. **bg-video.mp4 важить ~12.8MB** — прийнятно для GitHub Pages, але при повільному інтернеті у відвідувача
   перше завантаження може бути помітним. Відео закешується браузером після першого візиту.
3. Firebase Spark (безкоштовний) план: 50k reads/day, 20k writes/day, 1GiB storage — для цього проекту з
   запасом вистачить, гроші не спишуться без ручного переходу на Blaze план.
4. Валюта за замовчуванням для нових проектів — RUB (₽), встановлено у `defaultProject()` в script.js.
5. Мова інтерфейсу — uk/ru, зберігається в localStorage (`appLang`), не в Firestore (тобто локальна для браузера,
   не синхронизується між пристроями користувача).
6. Немає збірки/бандлера — всі зміни в .js/.css/.html відразу відображаються після push + деплою GitHub Pages
   (зазвичай 30-60 сек на build).
7. ffmpeg для стиснення відео встановлений через winget (Gyan.FFmpeg), шлях:
   `C:\Users\plato\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe`
   (може знадобитись новий термінал/сесія, щоб alias `ffmpeg` підхопився з PATH).

## Команди для роботи
```bash
# Локальний перегляд — просто відкрити index.html в браузері (Firebase працює навіть локально, це CDN)

# Деплой (просто push в master):
git add -A
git commit -m "опис змін"
git push

# Перевірити статус останнього деплою GitHub Pages:
gh api repos/nemesio-shks/reseller-calculator/pages/builds/latest
```
