/// <reference types="vite/client" />

interface Window {
  dataLayer?: any[];
  gtag?: (...args: any[]) => void;
  axeptioSettings?: {
    clientId: string;
    cookiesVersion: string;
    [key: string]: unknown;
  };
  _axcb?: Array<(sdk: any) => void>;
}
