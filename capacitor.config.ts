import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.webosumania.app",
  appName: "Web osu!mania",
  webDir: "dist/client",
  android: {
    allowMixedContent: false,
  },
};

export default config;
