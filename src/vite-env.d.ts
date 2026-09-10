/// <reference types="vite/client" />

interface Window {
  dataLayer?: any[];
  gtag?: (...args: any[]) => void;
  axeptioSettings?: {
    clientId: string;
    cookiesVersion: string;
    googleConsentMode?: {
      default?: {
        analytics_storage?: "granted" | "denied";
        ad_storage?: "granted" | "denied";
        ad_user_data?: "granted" | "denied";
        ad_personalization?: "granted" | "denied";
        wait_for_update?: number;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  _axcb?: Array<(sdk: any) => void>;
}
