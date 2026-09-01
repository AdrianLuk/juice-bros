import assert from "node:assert/strict";
import test from "node:test";

import {
  readGooglePlacesApiBaseUrl,
  readMicrosoftApiBaseUrl,
  readMicrosoftOAuthClientId,
  readPublicSupabaseEnv,
  requireGoogleMapsApiKey,
  requireMicrosoftOAuthClientId,
  requireMicrosoftOAuthClientSecret,
  requireSupabaseServiceRoleKey,
} from "./env.ts";

const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

test("readPublicSupabaseEnv returns the url and anon key when both are set", () => {
  const env = readPublicSupabaseEnv(validPublic);

  assert.deepEqual(env, {
    url: "http://127.0.0.1:54321",
    anonKey: "anon-key",
  });
});

test("readPublicSupabaseEnv names the missing variable in the error", () => {
  assert.throws(
    () => readPublicSupabaseEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key" }),
    /NEXT_PUBLIC_SUPABASE_URL/,
  );
});

test("readPublicSupabaseEnv treats a blank value as missing", () => {
  assert.throws(
    () => readPublicSupabaseEnv({ ...validPublic, NEXT_PUBLIC_SUPABASE_ANON_KEY: "   " }),
    /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
  );
});

test("requireSupabaseServiceRoleKey returns the key when set", () => {
  assert.equal(
    requireSupabaseServiceRoleKey({ SUPABASE_SERVICE_ROLE_KEY: "service-key" }),
    "service-key",
  );
});

test("requireSupabaseServiceRoleKey names the variable when missing", () => {
  assert.throws(
    () => requireSupabaseServiceRoleKey({}),
    /SUPABASE_SERVICE_ROLE_KEY/,
  );
});

test("requireGoogleMapsApiKey returns the key when set", () => {
  assert.equal(
    requireGoogleMapsApiKey({ GOOGLE_MAPS_API_KEY: "maps-key" }),
    "maps-key",
  );
});

test("requireGoogleMapsApiKey names the variable when missing", () => {
  assert.throws(() => requireGoogleMapsApiKey({}), /GOOGLE_MAPS_API_KEY/);
});

test("readGooglePlacesApiBaseUrl defaults to the real API when unset", () => {
  assert.equal(readGooglePlacesApiBaseUrl({}), "https://places.googleapis.com");
});

test("readGooglePlacesApiBaseUrl defaults to the real API when blank", () => {
  assert.equal(
    readGooglePlacesApiBaseUrl({ GOOGLE_PLACES_API_BASE_URL: "   " }),
    "https://places.googleapis.com",
  );
});

test("readGooglePlacesApiBaseUrl uses the override when set", () => {
  assert.equal(
    readGooglePlacesApiBaseUrl({ GOOGLE_PLACES_API_BASE_URL: "http://127.0.0.1:5602" }),
    "http://127.0.0.1:5602",
  );
});

test("readMicrosoftOAuthClientId returns undefined when unset or blank", () => {
  assert.equal(readMicrosoftOAuthClientId({}), undefined);
  assert.equal(readMicrosoftOAuthClientId({ MICROSOFT_OAUTH_CLIENT_ID: "  " }), undefined);
});

test("readMicrosoftOAuthClientId returns the value when set", () => {
  assert.equal(
    readMicrosoftOAuthClientId({ MICROSOFT_OAUTH_CLIENT_ID: "ms-client" }),
    "ms-client",
  );
});

test("requireMicrosoftOAuthClientId names the variable when missing", () => {
  assert.throws(() => requireMicrosoftOAuthClientId({}), /MICROSOFT_OAUTH_CLIENT_ID/);
});

test("requireMicrosoftOAuthClientSecret names the variable when missing", () => {
  assert.throws(
    () => requireMicrosoftOAuthClientSecret({}),
    /MICROSOFT_OAUTH_CLIENT_SECRET/,
  );
});

test("readMicrosoftApiBaseUrl defaults to undefined (real host) when unset or blank", () => {
  assert.equal(readMicrosoftApiBaseUrl({}), undefined);
  assert.equal(readMicrosoftApiBaseUrl({ MICROSOFT_API_BASE_URL: "   " }), undefined);
});

test("readMicrosoftApiBaseUrl uses the override when set", () => {
  assert.equal(
    readMicrosoftApiBaseUrl({ MICROSOFT_API_BASE_URL: "http://127.0.0.1:5604" }),
    "http://127.0.0.1:5604",
  );
});

