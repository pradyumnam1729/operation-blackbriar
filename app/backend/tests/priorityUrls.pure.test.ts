import test from "node:test";
import assert from "node:assert/strict";
import { excludeKnownUrls } from "../src/services/competitive";

test("drops priority URLs already covered by existing sources", () => {
  const result = excludeKnownUrls(
    ["https://x.com/a", "https://x.com/b/", "https://x.com/c"],
    ["https://x.com/a", "https://x.com/c"]
  );
  assert.deepEqual(result, ["https://x.com/b"]);
});

test("dedupes the priority list itself and trims whitespace", () => {
  const result = excludeKnownUrls(["  https://x.com/a  ", "https://x.com/a/"], []);
  assert.deepEqual(result, ["https://x.com/a"]);
});

test("returns an empty list when given no priority URLs", () => {
  assert.deepEqual(excludeKnownUrls([], ["https://x.com/a"]), []);
});
