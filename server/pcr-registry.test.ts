import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assessPCR0, combineVerified, type PCRRegistry } from "./pcr-registry.js";

const PCR0_160 = "a5".repeat(48);
const PCR0_170 = "b7".repeat(48);
const UNLISTED = "c9".repeat(48);

const version = (name: string, pcr0: string) => ({
  version: name, pcr0, pcr1: "11".repeat(48), pcr2: "22".repeat(48), release_date: "2026-11-01", docker_image: "",
});
const registry: PCRRegistry = {
  current_version: "1.7.0",
  versions: [version("1.6.0", PCR0_160), version("1.7.0", PCR0_170)],
};

describe("assessPCR0", () => {
  it("matches any published version, not only the current one", () => {
    assert.equal(assessPCR0(PCR0_160, registry).entry?.version, "1.6.0");
    assert.deepEqual(assessPCR0(PCR0_170, registry), { status: "matched", entry: registry.versions[1] });
  });

  it("ignores the case of the hex", () => {
    assert.equal(assessPCR0(PCR0_160.toUpperCase(), registry).status, "matched");
  });

  it("reports a PCR0 in no published version as unregistered", () => {
    assert.deepEqual(assessPCR0(UNLISTED, registry), { status: "unregistered", entry: null });
  });

  it("is not assessed without a PCR0 or without published values", () => {
    for (const pcr0 of [null, undefined, ""]) {
      assert.equal(assessPCR0(pcr0, registry).status, "not_assessed");
    }
    assert.equal(assessPCR0(PCR0_160, { versions: [] }).status, "not_assessed");
    // An entry without a PCR0 publishes nothing to compare with
    assert.equal(assessPCR0(PCR0_160, { versions: [version("0.9.0", "")] }).status, "not_assessed");
  });
});

describe("combineVerified", () => {
  it("is verified only for a valid receipt of a registered image", () => {
    assert.equal(combineVerified(true, "matched"), true);
  });

  it("fails for an invalid receipt or an unregistered image", () => {
    assert.equal(combineVerified(false, "matched"), false);
    assert.equal(combineVerified(true, "unregistered"), false);
    assert.equal(combineVerified(false, "not_assessed"), false);
  });

  it("is undecided, never a pass, when the image was not assessed or the receipt says nothing", () => {
    assert.equal(combineVerified(true, "not_assessed"), null);
    assert.equal(combineVerified(undefined, "matched"), null);
    assert.equal(combineVerified(null, "matched"), null);
  });
});
