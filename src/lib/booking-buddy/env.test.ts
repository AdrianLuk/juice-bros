import assert from "node:assert/strict";
import test from "node:test";

import { readPublicSupabaseEnv } from "./env.ts";

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

