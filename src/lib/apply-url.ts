const LINKEDIN = /(^|\.)linkedin\.com$|^lnkd\.in$/i;

/** LinkedIn nunca é preenchido automaticamente (risco de bloqueio da conta): só o Kit manual. */
export function isAutoApplyAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") && !LINKEDIN.test(u.hostname);
  } catch {
    return false;
  }
}
