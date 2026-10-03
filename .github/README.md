# Web osu!mania (but in standalone bruh)

An unofficial osu!mania-style rhythm game with a browser client, desktop and Android packaging, and an experimental .NET MAUI native app.

## Project status

The React, TypeScript, and PixiJS game is the complete gameplay implementation. The Windows desktop build uses Electron to package that client, and the Android build uses Capacitor. Both can play beatmaps that have already been installed locally. Searching for and downloading beatmaps requires an internet connection and the Web osu!mania API.

The `native/WebOsuMania.Native` directory is an experimental MAUI port, not a replacement for the complete game yet. Its current library and editor screens are prototypes; gameplay, `.osz` importing, and map export are not implemented there.

## Features

- osu!mania-style gameplay with keyboard, gamepad, and touch input in the React client
- Local `.osz` beatmap import and offline play in the React client
- Beatmap search and downloads when online
- Local settings, collections, scores, and replays
- A browser-based beatmap editor prototype at `/editor`
- Electron desktop packaging for Windows and Linux
- Capacitor Android debug APK packaging

## Requirements

- Node.js 20 or newer and npm
- For Android builds: a Java JDK and Android SDK command-line/build tools, with `ANDROID_HOME` or `ANDROID_SDK_ROOT` configured
- For the experimental MAUI project: .NET 10 SDK and the relevant MAUI workload

## Run the game locally

```sh
npm ci
npm run dev
```

The development server prints its local URL in the terminal. Some online API features require the configured backend; local beatmaps are stored in browser storage.

## Build desktop apps

Run the desktop app without creating an installer:

```sh
npm run desktop
```

Create a Windows installer:

```sh
npm run dist:windows
```

Create a Linux x86_64 AppImage (run on Linux):

```sh
npm run dist:linux
```

Desktop build output is written to `release/`.

## Build Android APK

```sh
npm run android:apk
```

The debug APK is written to `android/app/build/outputs/apk/debug/`. Android packaging requires the JDK, Android SDK, and accepted SDK licenses.

## Offline use

Import or install beatmaps while online, or load local `.osz` files in the React client. Installed maps and game data are kept in local browser storage for subsequent offline play. Beatmap search and new downloads need internet access. The Electron desktop shell also forwards API requests to `https://webosumania.com` by default; set `WEB_OSU_MANIA_API_URL` to use a compatible alternative backend.

## Configuration

See [`.env.example`](.env.example) for the server-side osu! API and rate-limit variables. Keep real credentials in a local `.env` file and never commit them. The `.env` file is ignored by Git.

## Repository layout

- `src/`: React application, gameplay engine, beatmap parsing, and browser editor
- `desktop/`: Electron desktop shell
- `android/`: Capacitor Android project
- `native/WebOsuMania.Native/`: experimental .NET MAUI port
- `public/`: game skins, sounds, and static assets

## License and attribution

The repository is published under the [Unlicense](LICENSE). This project is unofficial and is not affiliated with or endorsed by osu! or its creators. osu! and third-party assets remain the property of their respective owners; see the in-app credits and source providers for attribution.