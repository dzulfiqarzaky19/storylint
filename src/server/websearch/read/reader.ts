import { parseHTML } from "linkedom";
import { Defuddle } from "defuddle/node";

import type { ReadResult } from "@/server/websearch/types";
import {
  safeFetch,
  type SafeFetchResult,
  type SafeFetchOptions,
} from "@/server/websearch/read/safeFetch";

export type SafeFetchImpl = (
  url: string,
  opts?: SafeFetchOptions,
) => Promise<SafeFetchResult>;

export interface ReadPageOptions extends SafeFetchOptions {
  safeFetchImpl?: SafeFetchImpl;
}

export async function readPage(
  url: string,
  opts: ReadPageOptions = {},
): Promise<ReadResult | null> {
  const fetchImpl = opts.safeFetchImpl ?? safeFetch;

  let fetched: SafeFetchResult;
  try {
    fetched = await fetchImpl(url, opts);
  } catch {
    return null;
  }

  try {
    const { document } = parseHTML(fetched.body);
    const result = await Defuddle(document, fetched.url, {
      markdown: true,
      useAsync: false,
    });
    const markdown = typeof result.content === "string" ? result.content.trim() : "";
    if (markdown.length === 0) return null;

    const title =
      (typeof result.title === "string" && result.title.trim()) ||
      fetched.url;
    return { url: fetched.url, title, markdown };
  } catch {
    return null;
  }
}
