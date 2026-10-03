# Native Builds

The desktop and Android apps package the existing React game; they do not rewrite its game engine. Installed `.osz` files and downloaded maps are stored in IndexedDB and are available offline. Searching osu! and downloading new maps still requires an internet connection and the hosted Web osu!mania API.

## Windows installer

Requirements: Node.js 20 or newer.

```powershell
npm ci
npm run dist:windows
```

The NSIS installer is written to `release/`. To run the desktop app without packaging it:

```powershell
npm run desktop
```

The desktop shell serves the local static app and forwards only the app's `/api` requests to `https://webosumania.com`. To use a different compatible backend, set `WEB_OSU_MANIA_API_URL` before launching the packaged app.

## Android debug APK

Requirements: Node.js 20 or newer, a Java JDK, and Android SDK command-line/build tools. Set `ANDROID_HOME` or `ANDROID_SDK_ROOT` to the SDK directory and accept the required Android SDK licenses.

```powershell
npm ci
npm run android:apk
```

The command creates the Capacitor Android project when needed, builds and syncs the web assets, then runs Gradle `assembleDebug`. The APK is written under `android/app/build/outputs/apk/debug/`.

To target another API deployment, set `VITE_API_BASE_URL` to its HTTPS base URL before running `npm run android:apk`. The default is `https://webosumania.com`.

## Linux x86_64

On Linux with Node.js 20 or newer:

```sh
npm ci
npm run dist:linux
```

The AppImage is written to `release/`.
