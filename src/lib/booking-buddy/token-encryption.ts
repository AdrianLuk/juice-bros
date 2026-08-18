import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encrypts `mailbox_links.encrypted_refresh_token` at rest (issue #62).
 *
 * Resolves #59's open "how to encrypt the refresh token" decision with an
 * app-level key (the alternative named alongside Supabase Vault) rather than
 * `pgcrypto`: the key never has to enter Postgres at all this way, which
 * keeps the same "server-only, decrypted only in server-only code, never
 * selected into anything the browser reads" discipline `SUPABASE_SERVICE_ROLE_KEY`
 * already gets (see `requireMailboxLinkEncryptionKey` in `env.ts`) — a
 * `pgcrypto` approach would instead mean handing the key to Postgres on every
 * decrypt.
 *
 * Kept free of Next.js/Supabase imports and of `env.ts` itself so it's unit
 * tested directly with a throwaway key; callers pass the real key in.
 */

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;

function decodeKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");

  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `MAILBOX_LINK_ENCRYPTION_KEY must decode to ${KEY_LENGTH_BYTES} bytes (base64-encoded). ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }

  return key;
}

/** `iv.authTag.ciphertext`, each part base64 — plain string, easy to store in a `text` column. */
export function encryptRefreshToken(plainText: string, keyBase64: string): string {
  const key = decodeKey(keyBase64);
  const iv = randomBytes(IV_LENGTH_BYTES);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext].map((part) => part.toString("base64")).join(".");
}

export type DecryptOutcome = { ok: true; plainText: string } | { ok: false };

/**
 * Never throws on a malformed/tampered value — the auth tag check inside GCM
 * decryption is exactly what would fail on tampering, and a caller (the sync
 * flow) has an honest way to react (treat the Mailbox Link as unusable)
 * rather than a route handler crashing.
 */
export function decryptRefreshToken(stored: string, keyBase64: string): DecryptOutcome {
  try {
    const key = decodeKey(keyBase64);
    const [ivB64, authTagB64, ciphertextB64] = stored.split(".");

    if (!ivB64 || !authTagB64 || !ciphertextB64) {
      return { ok: false };
    }

    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const plainText = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return { ok: true, plainText: plainText.toString("utf8") };
  } catch {
    return { ok: false };
  }
}
