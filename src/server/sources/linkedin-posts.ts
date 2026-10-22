import * as cheerio from "cheerio";
import { requireBrowser } from "./browser";
import { SOURCE_LABELS } from "./labels";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

/** Busca de publicações pedida pela pessoa: "desenvolvedor" e "contratando", mais recentes, últimas 24 h. */
export const LINKEDIN_POSTS_URL =
  "https://www.linkedin.com/search/results/content/?keywords=%22desenvolvedor%22%20and%20%22contratando%22%20%20&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D&datePosted=%5B%22past-24h%22%5D";

// Seletores do DOM da busca de conteúdo (ver comentário no topo da fixture). O LinkedIn muda classes; o data-urn é o mais estável.
export const POST_SELECTOR = '[data-urn^="urn:li:activity:"]';
const TEXT_SELECTOR = ".update-components-text";
const AUTHOR_SELECTOR = '.update-components-actor__title span[aria-hidden="true"]';

const SCROLLS = 3;
const TITLE_MAX = 100;
const ROLE = /desenvolvedor|desenvolvedora|developer|engenheir|engineer|programador|\bdev\b|tech lead|full ?stack|front-?end|back-?end/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const NO_REPLY = /^(no-?reply|naoresponda)@/;

/** E-mails do texto, na ordem em que aparecem, sem duplicatas nem endereços de "não responda". */
export function extractEmails(text: string): string[] {
  const found = (text.match(EMAIL) ?? []).map((e) => e.toLowerCase().replace(/[.,;)]+$/, ""));
  return [...new Set(found)].filter((e) => !NO_REPLY.test(e));
}

/** O id de atividade do LinkedIn carrega o instante da publicação nos 41 bits mais altos. */
export function activityPostedAt(activityId: string): Date | null {
  if (!/^\d+$/.test(activityId)) return null;
  return new Date(Number(BigInt(activityId) >> BigInt(22)));
}

/** Post não tem título: usa a primeira linha que fala de cargo, senão a primeira linha. */
export function postTitle(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const line = lines.find((l) => ROLE.test(l)) ?? lines[0];
  if (!line) return "Post de contratação";
  return line.length > TITLE_MAX ? `${line.slice(0, TITLE_MAX - 1)}…` : line;
}

export function parseLinkedinPosts(html: string): RawJob[] {
  const $ = cheerio.load(html);
  const posts: RawJob[] = [];
  $(POST_SELECTOR).each((_, el) => {
    const id = /urn:li:activity:(\d+)/.exec($(el).attr("data-urn") ?? "")?.[1];
    const markup = $(el).find(TEXT_SELECTOR).first().html();
    const text = markup ? htmlToText(markup) : "";
    if (!id || !text) return;
    const author = $(el).find(AUTHOR_SELECTOR).first().text().replace(/\s+/g, " ").trim();
    posts.push({
      source: "linkedin_posts",
      sourceJobId: id,
      url: `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`,
      title: postTitle(text),
      company: author || null,
      location: null,
      // O normalize infere remoto/CLT/PJ destas dicas; o post inteiro é a única fonte.
      workModelHint: text,
      contractHint: text,
      salaryText: null,
      postedAt: activityPostedAt(id),
      descriptionText: text,
      contactEmail: extractEmails(text)[0] ?? null,
    });
  });
  return posts;
}

/**
 * Posts de contratação no LinkedIn. A busca de conteúdo exige login: abre no Chrome do ajudante,
 * com a sessão que a pessoa criou em `make linkedin-login`. Só lê; nunca interage com os posts.
 */
export const linkedinPostsSource: JobSource = {
  id: "linkedin_posts",
  label: SOURCE_LABELS.linkedin_posts,
  homepage: "https://www.linkedin.com/search/results/content/",
  defaultEnabled: false,
  maxPages: 1,
  fixedQueries: [{ keywords: '"desenvolvedor" and "contratando"', location: null }],
  async search(_q, _page, _http, ctx) {
    const html = await requireBrowser(ctx).getHtml(LINKEDIN_POSTS_URL, { waitFor: POST_SELECTOR, scrolls: SCROLLS });
    return parseLinkedinPosts(html);
  },
};
