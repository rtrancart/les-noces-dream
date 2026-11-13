import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { raisonBloqueMarketing } from "./brevo-opposition.ts";

Deno.test("hard bounce = opposition marketing", () => assertEquals(raisonBloqueMarketing("bounce"), true));
Deno.test("plainte = opposition marketing", () => assertEquals(raisonBloqueMarketing("complaint"), true));
Deno.test("désinscription email de service ≠ opposition marketing", () =>
  assertEquals(raisonBloqueMarketing("unsubscribe"), false));
