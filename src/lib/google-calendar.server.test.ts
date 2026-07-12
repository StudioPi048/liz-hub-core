import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getValidAccessToken } from "./google-calendar.server";

declare global {
  var mockRow: any;
  var mockFetchResponse: any;
}

// Mock dependencies
vi.mock("@/integrations/supabase/client.server", () => {
  const select = vi.fn();
  const eq = vi.fn().mockReturnValue({ maybeSingle: vi.fn() });
  const update = vi.fn().mockReturnValue({ eq: vi.fn() });
  const deleteFn = vi.fn().mockReturnValue({ eq: vi.fn() });

  return {
    supabaseAdmin: {
      from: vi.fn((table) => {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => {
                if (table === "google_oauth_tokens") {
                  return Promise.resolve({ data: globalThis.mockRow });
                }
                return Promise.resolve({ data: null });
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn() }),
          delete: deleteFn,
        };
      }),
    },
  };
});

describe("getValidAccessToken", () => {
  beforeEach(() => {
    globalThis.mockRow = null;
    vi.clearAllMocks();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        if (globalThis.mockFetchResponse) {
          return Promise.resolve(globalThis.mockFetchResponse);
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ access_token: "new_token", expires_in: 3600, scope: "all" }),
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return disconnected when no token exists", async () => {
    const result = await getValidAccessToken("user1");
    expect(result).toEqual({ status: "disconnected", reason: "not_connected" });
  });

  it("should return needs_reconnect and delete token on invalid_client", async () => {
    globalThis.mockRow = {
      user_id: "user1",
      access_token: "expired_token",
      refresh_token: "refresh_token",
      token_expires_at: new Date(Date.now() - 10000).toISOString(),
    };

    globalThis.mockFetchResponse = {
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ error: "invalid_client" })),
    };

    const result = await getValidAccessToken("user1");

    expect(result).toEqual({ status: "needs_reconnect", reason: "invalid_client" });
  });

  it("should return temporarily_unavailable on other errors and NOT delete token", async () => {
    globalThis.mockRow = {
      user_id: "user1",
      access_token: "expired_token",
      refresh_token: "refresh_token",
      token_expires_at: new Date(Date.now() - 10000).toISOString(),
    };

    globalThis.mockFetchResponse = {
      ok: false,
      status: 500,
      text: () => Promise.resolve(JSON.stringify({ error: "internal_error" })),
    };

    const result = await getValidAccessToken("user1");

    expect(result).toEqual({ status: "temporarily_unavailable", reason: "google_unavailable" });
  });
});
