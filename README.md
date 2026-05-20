# ЦыпКлик — Capacitor Android App

## Требования
- Node.js 18+
- Android Studio (с Android SDK)
- Java JDK 17

## Сборка APK

### 1. Установи зависимости
```bash
npm install
```

### 2. Собери веб-часть
```bash
npm run build
```

### 3. Добавь Android платформу (только первый раз)
```bash
npx cap add android
```

### 4. Синхронизируй с Android
```bash
npx cap sync android
```

### 5. Открой в Android Studio
```bash
npx cap open android
```

### 6. В Android Studio
- Подожди пока Gradle синхронизируется
- Меню: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- APK будет в: `android/app/build/outputs/apk/debug/app-debug.apk`

## Для релизного APK (Play Store)
- **Build → Generate Signed Bundle / APK**
- Создай keystore или используй существующий
