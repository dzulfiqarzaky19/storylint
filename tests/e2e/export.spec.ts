import { test, expect } from "@playwright/test";
import { loadEnv } from "@/lib/db/env";
import { getBook, getChaptersForBook } from "@/lib/db/queries";
import { novelToMarkdown } from "@/lib/export/exportMarkdown";
import { DEFAULT_BOOK_ID } from "@/lib/db/scope";

// The Playwright runner process does not inherit the server's env; load the
// same .env(.local) the standalone db scripts use so the direct DB reads below
// (for the independent expected-Markdown computation) connect to the seeded DB.
loadEnv();

// F8-S3 — book Markdown export, real download-event E2E.
//
// Drives the actual Export affordance in the Write header at the canonical
// 1440x900 frame: clicking it must trigger a NATIVE browser download (the route
// sets Content-Disposition: attachment) whose bytes are EXACTLY the assembled
// Markdown for the seeded "Ashkeld" book. We assert on the download event
// itself (filename + streamed body), and the body is compared byte-for-byte to
// novelToMarkdown(book, chapters) computed independently from the same DB — not
// merely a 200 / non-empty check.
//
// The seeded book is DEFAULT_BOOK_ID "book-1", name "Ashkeld" -> slug "ashkeld".

test.beforeEach(async ({ page }) => {
  await page.goto("/write");
  await expect(page.getByTestId("export-book")).toBeVisible();
});

test("write: Export book downloads the assembled Markdown for the whole novel", async ({
  page,
}) => {
  // Compute the expected Markdown independently, from the same live DB the route
  // reads, using the same pure assembler — so the assertion is exact equality,
  // not a structural approximation.
  const book = await getBook(DEFAULT_BOOK_ID);
  expect(book).not.toBeNull();
  const chapters = await getChaptersForBook(DEFAULT_BOOK_ID);
  const expectedMarkdown = novelToMarkdown(book!, chapters);

  // Clicking the anchor must fire a real download (attachment disposition).
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-book").click(),
  ]);

  // Filename comes from the slugified book title -> "ashkeld.md".
  expect(download.suggestedFilename()).toBe("ashkeld.md");

  // Read the downloaded bytes.
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const downloaded = Buffer.concat(chunks).toString("utf-8");

  // The downloaded file IS the assembled novel Markdown, byte-for-byte.
  expect(downloaded).toBe(expectedMarkdown);

  // Sanity anchors on the assembled contract (fail fast with a readable message
  // if the equality above regresses): single book H1, seeded chapter 7 heading.
  expect(downloaded.startsWith("# Ashkeld\n\n")).toBe(true);
  expect(downloaded.match(/^# /gm)).toHaveLength(1);
  expect(downloaded).toContain("## 7. Low Water");
});

test("api: export route serves markdown as an attachment (headers + body)", async ({
  request,
}) => {
  // Assert the behavior-bearing response headers directly (the download event
  // above only proves attachment-disposition + bytes; this pins the exact
  // Content-Type and the slugified attachment filename).
  const res = await request.get(`/api/export/${DEFAULT_BOOK_ID}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("text/markdown; charset=utf-8");
  expect(res.headers()["content-disposition"]).toBe(
    'attachment; filename="ashkeld.md"',
  );

  // Body is the independently-assembled novel Markdown, byte-for-byte.
  const book = await getBook(DEFAULT_BOOK_ID);
  const chapters = await getChaptersForBook(DEFAULT_BOOK_ID);
  expect(await res.text()).toBe(novelToMarkdown(book!, chapters));
});

test("api: export route 404s for an unknown book id", async ({ request }) => {
  const res = await request.get("/api/export/no-such-book");
  expect(res.status()).toBe(404);
});
