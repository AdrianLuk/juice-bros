import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { decryptRefreshToken, encryptRefreshToken } from "./token-encryption.ts";

const KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");

test("a refresh token round-trips through encrypt/decrypt", () => {
  const encrypted = encryptRefreshToken("1//0gRealRefreshToken", KEY);
  const decrypted = decryptRefreshToken(encrypted, KEY);

  assert.deepEqual(decrypted, { ok: true, plainText: "1//0gRealRefreshToken" });
});

test("the stored value is never the plain refresh token", () => {
  const plainText = "1//0gRealRefreshToken";
  const encrypted = encryptRefreshToken(plainText, KEY);

  assert.notEqual(encrypted, plainText);
  assert.equal(encrypted.includes(plainText), false);
});

test("encrypting the same token twice yields different ciphertext (random IV)", () => {
  const first = encryptRefreshToken("same-token", KEY);
  const second = encryptRefreshToken("same-token", KEY);

  assert.notEqual(first, second);
});

test("decrypting with the wrong key fails closed rather than throwing", () => {
  const encrypted = encryptRefreshToken("1//0gRealRefreshToken", KEY);
  const result = decryptRefreshToken(encrypted, OTHER_KEY);

  assert.deepEqual(result, { ok: false });
});

test("decrypting a tampered value fails closed", () => {
  const encrypted = encryptRefreshToken("1//0gRealRefreshToken", KEY);
  const [iv, authTag, ciphertext] = encrypted.split(".");
  const tampered = [iv, authTag, `${ciphertext}AA`].join(".");

  const result = decryptRefreshToken(tampered, OTHER_KEY);
  assert.deepEqual(result, { ok: false });

  const resultRightKey = decryptRefreshToken(tampered, KEY);
  assert.deepEqual(resultRightKey, { ok: false });
});

test("decrypting a malformed (non-triple) value fails closed", () => {
  assert.deepEqual(decryptRefreshToken("not-the-right-shape", KEY), { ok: false });
  assert.deepEqual(decryptRefreshToken("", KEY), { ok: false });
});

test("a key that isn't 32 bytes once decoded throws — a misconfigured deploy should fail loudly", () => {
  assert.throws(() => encryptRefreshToken("token", "dG9vc2hvcnQ="));
});
