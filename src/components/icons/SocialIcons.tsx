import type { SVGProps } from "react";
import { Instagram, Facebook } from "lucide-react";

/** Icônes monochromes (currentColor) — pas de couleurs de marque. */

export function TikTokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      width={20}
      height={20}
      {...props}
    >
      <path d="M16.5 3c.3 1.9 1.4 3.4 3.5 3.7v2.4c-1.3.1-2.6-.3-3.7-1v5.6c0 4.2-3.4 6.8-6.9 5.9-2.6-.7-4.3-3.2-4.1-5.9.2-2.6 2.3-4.8 4.9-5 .4 0 .8 0 1.2.1v2.6c-.4-.1-.8-.2-1.2-.1-1.3.1-2.3 1.2-2.3 2.5 0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5V3h3.6z" />
    </svg>
  );
}

export function PinterestIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      width={20}
      height={20}
      {...props}
    >
      <path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9.2-.8 1.2-5.1 1.2-5.1s-.3-.6-.3-1.5c0-1.4.8-2.5 1.9-2.5.9 0 1.3.7 1.3 1.5 0 .9-.6 2.2-.9 3.5-.3 1 .5 1.9 1.6 1.9 1.9 0 3.3-2 3.3-4.9 0-2.6-1.8-4.4-4.5-4.4-3 0-4.8 2.3-4.8 4.6 0 .9.3 1.9.8 2.4.1.1.1.2.1.3l-.3 1.1c0 .2-.1.2-.3.1-1.3-.6-2-2.4-2-3.9 0-3.2 2.3-6.1 6.7-6.1 3.5 0 6.2 2.5 6.2 5.8 0 3.5-2.2 6.3-5.2 6.3-1 0-2-.5-2.3-1.2l-.6 2.4c-.2.9-.8 2-1.2 2.6A10 10 0 1 0 12 2z" />
    </svg>
  );
}

export const InstagramIcon = Instagram;
export const FacebookIcon = Facebook;
