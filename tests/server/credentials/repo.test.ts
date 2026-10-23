import { beforeEach, describe, expect, it } from "vitest";
import {
  baseDomain,
  CredentialUnreadableError,
  deleteCredential,
  findCredentialForUrl,
  listCredentials,
  revealPassword,
  saveCredential,
} from "@/server/credentials/repo";
import { memDb } from "../../helpers/db";

const gupy = { site: "Gupy", url: "https://login.gupy.io/candidates/signin", username: "ana@exemplo.com", password: "s3gredo forte", notes: "" };

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
  process.env.BRIDGE_TOKEN = "t".repeat(64);
});

describe("credentials", () => {
  it("encrypts the password at rest and never lists it", () => {
    const db = memDb();
    const id = saveCredential(db, gupy, 1000);
    const raw = db.$client.prepare("select password, host from credentials where id = ?").get(id) as { password: string; host: string };
    expect(raw.password).toMatch(/^v1:/);
    expect(raw.password).not.toContain("s3gredo");
    expect(raw.host).toBe("login.gupy.io");
    const list = listCredentials(db);
    expect(list).toEqual([
      { id, site: "Gupy", url: "https://login.gupy.io/candidates/signin", username: "ana@exemplo.com", notes: null, updatedAt: 1000 },
    ]);
    expect(JSON.stringify(list)).not.toContain("s3gredo");
    expect(revealPassword(db, id)).toBe("s3gredo forte");
  });

  it("keeps the saved password when an edit leaves it blank", () => {
    const db = memDb();
    const id = saveCredential(db, gupy, 1000);
    saveCredential(db, { ...gupy, id, username: "ana2@exemplo.com", password: "", notes: "conta pessoal" }, 2000);
    expect(listCredentials(db)[0]).toMatchObject({ username: "ana2@exemplo.com", notes: "conta pessoal", updatedAt: 2000 });
    expect(revealPassword(db, id)).toBe("s3gredo forte");
    saveCredential(db, { ...gupy, id, password: "nova" }, 3000);
    expect(revealPassword(db, id)).toBe("nova");
  });

  it("validates input", () => {
    const db = memDb();
    expect(() => saveCredential(db, { ...gupy, password: "" }, 1)).toThrow("Informe a senha.");
    expect(() => saveCredential(db, { ...gupy, site: "  " }, 1)).toThrow("Informe o site.");
    expect(() => saveCredential(db, { ...gupy, url: "javascript:alert(1)" }, 1)).toThrow("http:// ou https://");
    expect(() => saveCredential(db, { ...gupy, id: 99 }, 1)).toThrow("Credencial não encontrada.");
    const id = saveCredential(db, { ...gupy, url: "" }, 1);
    expect(listCredentials(db)[0]).toMatchObject({ id, url: null });
  });

  it("deletes", () => {
    const db = memDb();
    const id = saveCredential(db, gupy, 1);
    deleteCredential(db, id);
    expect(listCredentials(db)).toEqual([]);
    expect(revealPassword(db, id)).toBeNull();
  });

  it("explains when the APP_KEY changed", () => {
    const db = memDb();
    const id = saveCredential(db, gupy, 1);
    process.env.APP_KEY = "d".repeat(64);
    expect(() => revealPassword(db, id)).toThrow(CredentialUnreadableError);
  });

  it("finds the login for a job link: same host first, then same domain", () => {
    const db = memDb();
    saveCredential(db, gupy, 1);
    const catho = saveCredential(db, { ...gupy, site: "Catho", url: "https://www.catho.com.br/" }, 2);
    expect(findCredentialForUrl(db, "https://empresa.gupy.io/job/123")?.site).toBe("Gupy");
    expect(findCredentialForUrl(db, "https://www.catho.com.br/vagas/dev/123/")?.id).toBe(catho);
    expect(findCredentialForUrl(db, "https://seguro.catho.com.br/login")?.id).toBe(catho);
    expect(findCredentialForUrl(db, "https://www.infojobs.com.br/vaga")).toBeNull();
    expect(findCredentialForUrl(db, "nada")).toBeNull();
    const exact = saveCredential(db, { ...gupy, site: "Gupy empresa", url: "https://empresa.gupy.io/" }, 3);
    expect(findCredentialForUrl(db, "https://empresa.gupy.io/job/123")?.id).toBe(exact);
  });

  it("baseDomain keeps the second-level part of country domains", () => {
    expect(baseDomain("empresa.gupy.io")).toBe("gupy.io");
    expect(baseDomain("www.catho.com.br")).toBe("catho.com.br");
    expect(baseDomain("vagas.solides.com.br")).toBe("solides.com.br");
    expect(baseDomain("trampos.co")).toBe("trampos.co");
  });
});
