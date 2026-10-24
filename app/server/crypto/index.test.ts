import { describe, expect, it } from "vitest";
import {
  computeLookupHash,
  decryptContact,
  decryptField,
  deriveDurableScanCode,
  encryptContact,
  encryptField,
} from "./index";

describe("app/server/crypto", () => {
  it("seals and opens settings fields and subscriber contacts under separate keys", () => {
    const fieldCipher = encryptField("sk_live_sample_value");
    expect(fieldCipher.startsWith("fld1:")).toBe(true);
    expect(decryptField(fieldCipher)).toBe("sk_live_sample_value");

    const contactCipher = encryptContact("+447700900123");
    expect(contactCipher.startsWith("cnt1:")).toBe(true);
    expect(decryptContact(contactCipher)).toBe("+447700900123");
    expect(() => decryptField(contactCipher)).toThrow();
    expect(() => decryptContact("bad")).toThrow("Invalid sealed ciphertext");
  });

  it("derives deterministic lookup hashes and durable scan codes", () => {
    const h1 = computeLookupHash("contact", "Guest@Example.com ");
    const h2 = computeLookupHash("contact", "guest@example.com");
    expect(h1).toBe(h2);
    const scan1 = deriveDurableScanCode("acc_1", "site_1");
    const scan2 = deriveDurableScanCode("acc_1", "site_1");
    expect(scan1).toBe(scan2);
    expect(scan1).toHaveLength(16);
  });
});
