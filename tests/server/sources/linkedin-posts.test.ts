import { describe, expect, it } from "vitest";
import { createHttp } from "@/server/sources/http";
import {
  activityPostedAt,
  extractEmails,
  LINKEDIN_POSTS_URL,
  linkedinPostsSource,
  parseLinkedinPosts,
  POST_READY,
  postTitle,
} from "@/server/sources/linkedin-posts";
import { fixtureBrowser, sourceFixture } from "../../helpers/http";

const html = sourceFixture("linkedin-posts.html");

describe("linkedin posts", () => {
  it("uses the exact search url", () => {
    expect(LINKEDIN_POSTS_URL).toBe(
      "https://www.linkedin.com/search/results/content/?keywords=%22desenvolvedor%22%20and%20%22contratando%22%20%20&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D&datePosted=%5B%22past-24h%22%5D",
    );
  });

  it("parses the three posts", () => {
    const posts = parseLinkedinPosts(html);
    expect(posts).toHaveLength(3);
    for (const p of posts) {
      expect(p.source).toBe("linkedin_posts");
      expect(p.descriptionText).not.toMatch(/</);
    }
    const [a, b, c] = posts;
    expect(a).toMatchObject({
      sourceJobId: "7518974430412812345",
      url: "https://www.linkedin.com/feed/update/urn:li:activity:7518974430412812345/",
      title: "Vaga: Desenvolvedor PHP Pleno (remoto)",
      company: "Pessoa Recrutadora A",
      location: null,
      salaryText: null,
      contactEmail: "vagas@exemplo.com.br",
    });
    expect(a.postedAt?.toISOString()).toBe("2026-10-22T10:00:00.000Z");
    expect(a.descriptionText).toContain("Envie seu CV");
    expect(a.descriptionText).toContain("Vaga: Desenvolvedor PHP Pleno (remoto)\nEnvie seu CV para vagas@exemplo.com.br.");
    expect(a.descriptionText).not.toMatch(/… mais/);
    expect(b).toMatchObject({
      title: "Procuramos dev React sênior, híbrido em SP. Me chama no direct!",
      company: "Pessoa Recrutadora B",
      contactEmail: null,
    });
    expect(c).toMatchObject({ title: "Vaga aberta: Desenvolvedora Full Stack", company: "Pessoa Recrutadora C", contactEmail: "rh@exemplo.com" });
  });

  it("extractEmails", () => {
    expect(extractEmails("mande p/ a@b.com.")).toEqual(["a@b.com"]);
    expect(extractEmails("X@Y.COM e x@y.com")).toEqual(["x@y.com"]);
    expect(extractEmails("noreply@x.com no-reply@x.com rh@x.com")).toEqual(["rh@x.com"]);
    expect(extractEmails("sem email")).toEqual([]);
    expect(extractEmails("foo@bar")).toEqual([]);
  });

  it("activityPostedAt reads the timestamp inside the activity id", () => {
    expect(activityPostedAt("7518974430412812345")?.toISOString()).toBe("2026-10-22T10:00:00.000Z");
    expect(activityPostedAt("abc")).toBeNull();
  });

  it("postTitle prefers the first line about a role", () => {
    expect(postTitle("Estamos contratando!\nVaga: Desenvolvedor PHP Pleno\nmais")).toBe("Vaga: Desenvolvedor PHP Pleno");
    expect(postTitle("Bom dia, rede!\nNovidades em breve")).toBe("Bom dia, rede!");
    expect(postTitle("Procuramos tech lead Node")).toBe("Procuramos tech lead Node");
    expect(postTitle(`Desenvolvedor ${"x".repeat(200)}`)).toHaveLength(100);
    expect(postTitle(`Desenvolvedor ${"x".repeat(200)}`).endsWith("…")).toBe(true);
    expect(postTitle("  \n ")).toBe("Post de contratação");
  });

  it("search uses the fixed url with 3 scrolls", async () => {
    const ctx = fixtureBrowser([[/linkedin\.com\/search\/results\/content/, html]]);
    const jobs = await linkedinPostsSource.search({ keywords: "ignorada", location: null }, 1, createHttp(), ctx);
    expect(jobs).toHaveLength(3);
    // O data-urn só existe depois que o ajudante anota a página: espera pelo post renderizado.
    expect(POST_READY).toBe('[data-view-name="feed-full-update"]');
    expect(ctx.calls).toEqual([{ url: LINKEDIN_POSTS_URL, waitFor: POST_READY, scrolls: 3 }]);
    expect(linkedinPostsSource).toMatchObject({ id: "linkedin_posts", label: "LinkedIn (posts)", defaultEnabled: false, maxPages: 1 });
  });

  it("returns no posts on LinkedIn's real empty state", async () => {
    const ctx = fixtureBrowser([[/linkedin\.com\/search\/results\/content/, sourceFixture("linkedin-posts-empty.html")]]);
    await expect(linkedinPostsSource.search({ keywords: "x", location: null }, 1, createHttp(), ctx)).resolves.toEqual([]);
  });
});
