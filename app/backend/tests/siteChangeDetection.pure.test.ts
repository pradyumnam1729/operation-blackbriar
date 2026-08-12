import test from "node:test";
import assert from "node:assert/strict";
import { shouldFlagSiteChange } from "../src/services/competitive";

test("flags a change when a previously-ok source's hash differs", () => {
  assert.equal(shouldFlagSiteChange(true, "abc", "def"), true);
});

test("does not flag when the hash is unchanged", () => {
  assert.equal(shouldFlagSiteChange(true, "abc", "abc"), false);
});

test("does not flag a source's first-ever successful scrape", () => {
  assert.equal(shouldFlagSiteChange(false, null, "abc"), false);
});
