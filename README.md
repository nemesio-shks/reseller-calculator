# Калькулятор перекупа

Сайт-калькулятор для перекупів авто: облік покупки/продажу, історія по кожному "проекту" (темі), підрахунок чистого прибутку.

Персональні кабінети та історія користувачів зберігаються через Firebase (Authentication + Firestore).

## Налаштування Firebase (потрібно один раз)

1. Зайти на https://console.firebase.google.com/ і створити новий проект.
2. У розділі **Authentication -> Sign-in method** увімкнути провайдера **Email/Password**.
3. У розділі **Firestore Database** створити базу (режим production або test).
4. У **Project settings -> General -> Your apps** додати Web-app і скопіювати конфіг.
5. Вставити цей конфіг у файл `firebase-config.js` замість заглушок.
6. У Firestore додати правила безпеки (Firestore -> Rules), щоб кожен користувач бачив тільки свої дані:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Локальний запуск

Просто відкрити `index.html` у браузері (авторизація працюватиме, якщо Firebase налаштований).

## Деплой на GitHub Pages

Репозиторій вже налаштований на публікацію з гілки `main`, папка `/root`. Сторінка доступна за адресою вказаною в Settings -> Pages репозиторію.
