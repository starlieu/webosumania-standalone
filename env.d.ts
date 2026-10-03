declare global {
  interface ImportMetaEnv {
    readonly VITE_STANDALONE?: string;
    readonly VITE_API_BASE_URL?: string;
  }

  namespace Cloudflare {
    interface Env {
      OSU_API_CLIENT_ID: string;
      OSU_API_CLIENT_SECRET: string;
      OSU_API_PROXY_URL: string;
      OSU_API_PROXY_KEY: string;
    }
  }
}

export {};
