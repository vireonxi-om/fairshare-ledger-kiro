/**
 * Integration regression for the storage/App shell wiring.
 *
 * This is deliberately NOT a domain test: it mounts the real <App /> inside
 * React.StrictMode (as main.tsx does) against a real jsdom localStorage and
 * verifies a concrete integration risk — that an unreadable/corrupt primary
 * payload is never overwritten by the empty fallback, even though StrictMode
 * double-invokes mount effects in development.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { render, cleanup, waitFor } from "@testing-library/react";
import App from "./App";
import { STORAGE_KEY, RECOVERY_KEY } from "./persistence/storage";

const CORRUPT_PAYLOAD = '{"schemaVersion":1,"ledger":{"currency":"USD"'; // truncated + wrong currency

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("App storage integration (StrictMode)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("preserves a corrupt primary payload across a StrictMode mount (does not overwrite with empty)", async () => {
    localStorage.setItem(STORAGE_KEY, CORRUPT_PAYLOAD);

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    // Give StrictMode's double-invoked mount effects a chance to run. If the
    // old effect-count guard were in use, the second effect would persist the
    // empty fallback over STORAGE_KEY here.
    await waitFor(() => {
      // The recovery copy must have been stashed by the loader.
      expect(localStorage.getItem(RECOVERY_KEY)).toBe(CORRUPT_PAYLOAD);
    });

    // The primary key must still contain the original corrupt bytes untouched —
    // it must NOT have been replaced by a serialised empty ledger.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(CORRUPT_PAYLOAD);
  });

  it("surfaces an accessible recovery error and offers a working recovery download", async () => {
    localStorage.setItem(STORAGE_KEY, CORRUPT_PAYLOAD);

    const { findByRole, getByRole } = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    // Accessible error is announced via role="alert".
    const alert = await findByRole("alert");
    expect(alert.textContent).toMatch(/unreadable/i);
    expect(alert.textContent).toMatch(/recovery/i);

    // The recovery control exists because a corrupt payload was preserved.
    const recoveryBtn = getByRole("button", { name: /download recovery data/i });

    // Capture what the download would contain by stubbing Blob + object URL.
    const blobSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:recovery");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const capturedBlobs: Blob[] = [];
    const RealBlob = globalThis.Blob;
    vi.stubGlobal(
      "Blob",
      class extends RealBlob {
        constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
          super(parts, opts);
          capturedBlobs.push(this as unknown as Blob);
        }
      },
    );
    // Prevent jsdom "navigation not implemented" noise from the anchor click.
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    recoveryBtn.click();

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(blobSpy).toHaveBeenCalledTimes(1);
    expect(capturedBlobs).toHaveLength(1);
    const text = await capturedBlobs[0].text();
    // The downloaded recovery payload must be the exact original corrupt bytes,
    // not a re-serialised empty ledger (which Export JSON would produce).
    expect(text).toBe(CORRUPT_PAYLOAD);
  });

  it("does not create a recovery copy or control when stored data is valid", async () => {
    // No STORAGE_KEY set at all → empty/fresh ledger, no recovery.
    const { queryByRole } = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await waitFor(() => {
      // Allow effects to settle; nothing to assert yet beyond stability.
      expect(true).toBe(true);
    });

    expect(localStorage.getItem(RECOVERY_KEY)).toBeNull();
    expect(
      queryByRole("button", { name: /download recovery data/i }),
    ).toBeNull();
  });
});
