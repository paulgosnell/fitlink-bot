import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { generateOAuthState, generateSecureHash } from "../supabase/functions/shared/utils/encryption.ts";

// Test encryption utilities
Deno.test("OAuth state generation", () => {
  const state1 = generateOAuthState();
  const state2 = generateOAuthState();
  
  // Should generate different states
  assertEquals(state1 !== state2, true);
  
  // Should be 64 characters (32 bytes in hex)
  assertEquals(state1.length, 64);
  assertEquals(state2.length, 64);
  
  // Should only contain hex characters
  const hexRegex = /^[0-9a-f]+$/;
  assertEquals(hexRegex.test(state1), true);
  assertEquals(hexRegex.test(state2), true);
});

Deno.test("Secure hash generation", async () => {
  const input = "test-input";
  const hash1 = await generateSecureHash(input);
  const hash2 = await generateSecureHash(input);
  
  // Same input should produce same hash
  assertEquals(hash1, hash2);
  
  // Should be 64 characters (SHA-256 in hex)
  assertEquals(hash1.length, 64);
  
  // Different inputs should produce different hashes
  const hash3 = await generateSecureHash("different-input");
  assertEquals(hash1 !== hash3, true);
});

// Mock Telegram update for testing
export const mockTelegramUpdate = {
  update_id: 1,
  message: {
    message_id: 1,
    from: {
      id: 123456789,
      is_bot: false,
      first_name: "Test",
      username: "testuser"
    },
    chat: {
      id: 123456789,
      first_name: "Test",
      username: "testuser",
      type: "private" as const
    },
    date: Math.floor(Date.now() / 1000),
    text: "/start"
  }
};

// Test Telegram update structure
Deno.test("Telegram update mock structure", () => {
  assertExists(mockTelegramUpdate.message);
  assertExists(mockTelegramUpdate.message.from);
  assertExists(mockTelegramUpdate.message.chat);
  assertEquals(mockTelegramUpdate.message.text, "/start");
  assertEquals(typeof mockTelegramUpdate.message.from.id, "number");
});
