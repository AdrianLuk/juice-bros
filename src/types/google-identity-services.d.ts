/**
 * Narrow ambient types for Google Identity Services (the
 * `accounts.google.com/gsi/client` script `auth/google-sign-in-button.tsx`
 * loads) — only the surface that component actually calls. See
 * https://developers.google.com/identity/gsi/web/reference/js-reference for
 * the full API.
 */

type GoogleCredentialResponse = {
  credential: string;
};

type GoogleIdConfiguration = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  nonce?: string;
  use_fedcm_for_prompt?: boolean;
};

type GoogleButtonConfiguration = {
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  width?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: GoogleIdConfiguration): void;
          renderButton(
            parent: HTMLElement,
            options: GoogleButtonConfiguration,
          ): void;
        };
      };
    };
  }
}

export {};
