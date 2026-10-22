# Lote, envio automático, posts do LinkedIn e e-mail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quatro melhorias no job-look-up v1: (1) cache de vagas descartadas com botão "Limpar cache"; (2) candidatura que **envia sozinha** no fim; (3) "Quero participar" em lote (multi-seleção / selecionar todas); (4) nova fonte com posts de contratação do LinkedIn das últimas 24 h, com botão **Enviar e-mail** (mensagem calorosa + CV anexado + LinkedIn + portfólio) via SMTP do Gmail.

**Architecture:** Tudo segue os padrões do v1. O lote só enfileira N candidaturas pelo mesmo caminho do botão atual, e o ajudante já processa `apply` com 1 slot, uma de cada vez. Os posts do LinkedIn são uma `JobSource` nova que abre a busca de conteúdo no Chrome do ajudante (`browser_fetch`, perfil `data/chrome-profile`, logado 1x via `make linkedin-login`). O parser roda no servidor com cheerio. O e-mail sai do servidor Next (server action) por nodemailer, com credenciais só no `.env`.

**Tech Stack:** o do v1 (Next 16.2.x, React 19.2.x, Drizzle + better-sqlite3, zod 4, cheerio, vitest), mais `nodemailer` (novo) no app e `playwright-core` (já existe) no ajudante.

**Spec:** não há documento separado. Os requisitos são os pedidos da pessoa, citados abaixo, e as decisões tomadas na conversa de 2026-10-22. Ler junto com `docs/superpowers/specs/2026-10-21-job-look-up-design.md` (spec do v1).

### Requisitos (palavras da pessoa)

1. "Tem que salvar em cache as vagas que eu já rejeitei e/ou [não] quero mais, e se em uma nova busca ela vier, deverá ser ignorada, até que eu limpe o cache."
2. "Quero multi select ou aplicar pra todas, e então entra no fluxo automatizado pelo Quero participar. Então abre o Chrome extension com Claude e preencha a vaga pra mim até o final."
3. "No fluxo de busca pelo LinkedIn, quero que faça uma etapa a mais, consultando no link `https://www.linkedin.com/search/results/content/?keywords=%22desenvolvedor%22%20and%20%22contratando%22%20%20&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D&datePosted=%5B%22past-24h%22%5D`. Se cair aí, o card na aba Lista de Vagas deverá ter um botão Enviar Email, e esse email vai ser disparado com uma mensagem calorosa informando que eu estou procurando um emprego e enviando meu currículo + LinkedIn + portfólio (link configurado no meu perfil com valor mizunotech.com.br)."

### Decisões da pessoa (2026-10-22)

- **Envio automático:** o Claude in Chrome clica em Enviar sozinho no fim de cada candidatura, em lote ou individual.
- **E-mail:** SMTP do Gmail com senha de app, configurado no `.env`.
- **LinkedIn logado:** o Chrome do ajudante (perfil separado, o mesmo do Indeed/Glassdoor), logado 1x pela pessoa.

### Decisões minhas (a pessoa pode reverter)

- "Rejeitei / não quero mais" é o botão **Descartar** que já existe. O cache é o `status = 'discarded'`, que já sobrevive a buscas novas (o `upsertJob` não mexe no status). Falta só o contador e o "Limpar cache".
- O envio automático **continua sem** marcar caixa de termos/LGPD, sem criar conta e sem fazer teste/vídeo. Formulário que exige uma dessas coisas termina em `needs_review` sem enviar.
- "Selecionar todas" seleciona as vagas elegíveis **carregadas na tela**, não todas do banco. O lote tem teto de 50.
- Posts sem e-mail também viram card. O botão fica desabilitado, com dica para abrir o post.
- Antes de enviar, o e-mail abre num diálogo com Para, Assunto e Mensagem editáveis, e só sai no clique em **Enviar**.
- Os posts são uma fonte separada, "LinkedIn (posts)", desligada por padrão e ligada em Configuração → Fontes. O status/erro dela fica independente da fonte LinkedIn (vagas) que já existe.
- No card do post, "empresa" é o nome de quem postou. O título é a primeira linha do post que fala de cargo.
- Depois do e-mail enviado, a vaga fica com `status = 'applied'` e o botão vira "E-mail enviado ✓".

## Global Constraints

- Copy da UI só em pt-BR, em `copy.ts` por feature, nunca solta no JSX. Nomes de código em inglês. Comentários em pt-BR explicando o *porquê*. Siga a densidade de comentários do arquivo vizinho.
- Next 16 tem breaking changes. Leia o guia relevante em `node_modules/next/dist/docs/` antes de escrever página, server action ou config.
- Dependência nova é pinada na versão exata (`npm install --save-exact`), sem `^`.
- Schema mudou → `npm run db:generate`. Commite o SQL gerado em `drizzle/` e não edite à mão.
- Conteúdo raspado (texto de post) só é renderizado como texto. Toda URL exibida passa por `safeHttpUrl`.
- URLs do LinkedIn nunca viram tarefa `apply` (regra do v1, inalterada). Posts usam e-mail, nunca auto-preenchimento.
- No LinkedIn, o Chrome do ajudante só **lê**: 1 carregamento da busca por rodada, no máximo `3` rolagens, espera de `1500` ms por rolagem. Nunca clica, curte, comenta ou manda mensagem.
- URL da busca de posts, exata: `https://www.linkedin.com/search/results/content/?keywords=%22desenvolvedor%22%20and%20%22contratando%22%20%20&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D&datePosted=%5B%22past-24h%22%5D`.
- E-mail só sai por clique explícito em **Enviar** no diálogo. Nunca em lote, nunca automático. `SMTP_PASS` só existe no `.env`: nunca no banco, na UI, em log ou em mensagem de erro.
- Lote: teto `BULK_APPLY_MAX = 50`. O ajudante continua com `apply` em 1 slot.
- Fixture de teste com dado de terceiro (posts reais) é **anonimizada** antes do commit. Captura bruta fica em `spike/out/` (gitignored).
- Portão de qualidade: `npm run quality` verde ao fim de cada tarefa.
- Git: branch `feat/lote-posts-email` a partir de `main`, um commit por tarefa, **sem trailer `Co-Authored-By`** (preferência da pessoa).

## Review Focus

1. **Vaga descartada volta numa busca nova pela mesma empresa+título, vinda de outra fonte:** continua escondida da lista e da análise até "Limpar cache". Depois de limpar, reaparece. Teste: Task 1 (`discarded job stays hidden when found again`).
2. **Post com e-mail colado em pontuação ("rh@x.com.br."), com dois e-mails ou com e-mail `noreply`:** o card usa o primeiro e-mail válido, sem pontuação. Sem e-mail utilizável, o botão fica desabilitado. Teste: Task 7 (`extractEmails`).
3. **Sessão do LinkedIn expirada (redireciona para /login, /authwall ou /checkpoint):** a fonte "LinkedIn (posts)" fica em erro com "rode `make linkedin-login`" e as outras fontes da rodada terminam normalmente. Testes: Task 5 (`loginRequired`) e Task 7 (`login wall marks only linkedin_posts as error`).
4. **Gmail recusa a senha (535/EAUTH), SMTP não configurado ou sem CV:** aparece mensagem legível, nada fica marcado como enviado e dá para tentar de novo. A senha nunca aparece no erro. Teste: Task 8.
5. **Duplo clique e repetição:** o lote com vaga já em andamento, em revisão ou enviada não cria candidatura duplicada, e o mesmo `jobId` repetido conta uma vez. Um segundo envio de e-mail para a mesma vaga é recusado. Testes: Task 3 (`applyJobs skips active and dedupes`) e Task 8 (`already_sent`).

---

### Task 1: Cache de descartadas + "Limpar cache"

**Files:**
- Modify: `src/server/jobs/list.ts` (novas funções no fim)
- Modify: `src/app/(app)/vagas/actions.ts`
- Modify: `src/app/(app)/vagas/page.tsx`
- Create: `src/components/jobs/discarded-cache.tsx`
- Modify: `src/components/jobs/copy.ts`, `src/components/jobs/job-list.tsx`
- Test: `tests/server/jobs/discarded-cache.test.ts`, `tests/components/jobs/discarded-cache.test.tsx`

**Interfaces:**
- Produces: `countDiscarded(db: Db): number`; `restoreDiscarded(db: Db): number` (devolve quantas voltaram); server actions `clearDiscardedCache(): Promise<number>`; componente `DiscardedCache({ count, onConfirm }: { count: number; onConfirm: () => Promise<void> })`; `JobList` ganha a prop `discardedCount: number`.

- [ ] **Step 1: Criar a branch**

```bash
git checkout main && git pull --ff-only && git checkout -b feat/lote-posts-email
```

- [ ] **Step 2: Testes que falham (servidor)** em `tests/server/jobs/discarded-cache.test.ts`, usando `memDb()`, `upsertJob` e `normalizeRawJob`:
  - `discarded job stays hidden when found again`: insere uma vaga `gupy` "Dev PHP" / "Acme", chama `setJobStatus(db, id, "discarded", 1)` e depois faz `upsertJob` da mesma empresa+título vindo de `indeed`. Espera: o mesmo `id`, `status` ainda `discarded`, `listJobs(...).items` sem a vaga e `countDiscarded(db) === 1`.
  - `restoreDiscarded brings them back as seen`: com 2 descartadas e 1 nova, `restoreDiscarded(db)` devolve `2`, as duas ficam `seen`, `countDiscarded(db) === 0` e `listJobs` traz as 3.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/server/jobs/discarded-cache.test.ts`
Expected: FAIL com "countDiscarded is not a function".

- [ ] **Step 4: Implementar `countDiscarded` e `restoreDiscarded` em `src/server/jobs/list.ts`.** `restoreDiscarded` faz `update jobs set status = 'seen' where status = 'discarded'` e devolve `changes`.

- [ ] **Step 5: Rodar e ver passar** (mesmo comando). Expected: PASS.

- [ ] **Step 6: Teste de componente que falha** em `tests/components/jobs/discarded-cache.test.tsx`:
  - `count = 0` não renderiza nada.
  - `count = 3` mostra o botão "Descartadas: 3 · Limpar cache". O clique abre o diálogo com "As 3 vagas voltam para a lista e para as próximas buscas.". "Limpar cache" chama `onConfirm` uma vez. "Cancelar" não chama.

- [ ] **Step 7: Implementar `DiscardedCache`** com `Dialog` de `@/components/ui/dialog`. Copy em `JOBS_COPY.discardedCache`:

```ts
discardedCache: {
  button: (n: number) => `Descartadas: ${n} · Limpar cache`,
  title: "Limpar o cache de descartadas?",
  body: (n: number) => `As ${n} vagas voltam para a lista e para as próximas buscas.`,
  confirm: "Limpar cache",
  cancel: "Cancelar",
  done: (n: number) => `${n} vagas restauradas`,
},
```

- [ ] **Step 8: Ligar na tela.** Adicione a action `clearDiscardedCache()` em `vagas/actions.ts`. `VagasPage` passa `discardedCount={countDiscarded(db)}`. `JobList` guarda o contador em estado: `+1` no descartar, `-1` no desfazer. No confirmar, chama `clearDiscardedCache()`, zera o contador, mostra `toast(C.discardedCache.done(n))` e faz `reload(filters)`. Renderize ao lado do switch "compacto".

- [ ] **Step 9: Portão**

Run: `npm run quality`
Expected: verde.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(jobs): discarded-jobs cache counter and clear action"
```

---

### Task 2: Candidatura envia sozinha no fim

**Files:**
- Modify: `bridge/apply-prompt.md`, `bridge/apply.mjs` (`STATUSES`, comentário do topo), `bridge/apply.test.mjs`
- Modify: `src/server/applications/schema.ts` (`ApplyReportSchema`)
- Modify: `src/server/applications/repo.ts` (`REPORT_STATUS`, `applyReport`)
- Modify: `src/components/applications/copy.ts` (se faltar texto para "enviada pelo ajudante")
- Modify: `README.md` (seção "Candidatura automática: o que o ajudante faz e não faz")
- Test: `tests/server/applications/applications.test.ts`, `bridge/apply.test.mjs`

**Interfaces:**
- Produces: `ApplyReport["status"]` passa a ser `"submitted" | "needs_review" | "login_required" | "blocked" | "error"`. `applyReport` com `submitted` grava `applications.status = 'submitted'` e `jobs.status = 'applied'`.

- [ ] **Step 1: Testes que falham**
  - Em `applications.test.ts`, na tabela de `applyReport maps statuses`, adicione `["submitted", "submitted"]`, e crie um teste novo, `submitted report marks the job applied`: `jobs.status === 'applied'` e `finished_at === NOW`.
  - Em `bridge/apply.test.mjs`, em `contains every non-negotiable rule`, troque `"Nunca clicar no botão final"` por `"submitted"`, `"Nunca clique em enviar duas vezes"` e `"NÃO envie"`. Adicione um teste em que o stream falso termina com o bloco `{"status":"submitted",...}` e `runApply` devolve `status: "submitted"`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/server/applications bridge/apply.test.mjs`
Expected: FAIL (`submitted` rejeitado pelo zod e pelo `STATUSES`; o prompt ainda tem a regra antiga).

- [ ] **Step 3: Implementar.** Coloque `"submitted"` no enum do zod e no `STATUSES` do ajudante. Em `REPORT_STATUS`, `submitted: "submitted"`. Em `applyReport`, quando o status final for `submitted`, faça também `update jobs set status = 'applied' where id = (select job_id from applications where id = ?)`. Mantenha o `status != 'cancelled'`.

- [ ] **Step 4: Reescrever as regras de envio em `bridge/apply-prompt.md`.** Primeira linha: "Você vai preencher e enviar uma candidatura de emprego…". Troque a linha "Nunca clicar no botão final…" por exatamente:

```
- Envio: quando TODOS os campos obrigatórios estiverem preenchidos (com fatos, respostas prontas ou rascunhos permitidos) e "unanswered" estiver vazio, clique no botão final ("Enviar", "Finalizar", "Concluir candidatura", "Submit") uma única vez. Depois confirme que a página mostrou a confirmação de envio (ex.: "candidatura enviada", "obrigado por se candidatar") e reporte status "submitted".
- Se algum campo obrigatório ficou sem resposta, se a caixa de aceite de termos/LGPD for obrigatória, ou se houver dúvida sobre um fato, NÃO envie: deixe a aba aberta e reporte "needs_review".
- Se clicou em enviar e a confirmação não apareceu, reporte "needs_review" e explique em "notes". Nunca clique em enviar duas vezes.
```

No formato de saída: `"status":"submitted|needs_review|login_required|blocked|error"`. As outras regras (não criar conta, não marcar termos/LGPD, não fazer teste, não inventar fato) ficam.

- [ ] **Step 5: README.** Na seção "Candidatura automática", troque "Não faz, nunca: clicar no botão final de enviar" por "**Envia** quando todos os campos obrigatórios foram preenchidos com dados seus e a página confirma o envio. Se faltar algo, para e deixa a aba aberta para você." Mantenha os outros "nunca".

- [ ] **Step 6: Rodar e ver passar** (comando do Step 2), depois `npm run quality`. Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(apply): submit the application when every required field is filled"
```

---

### Task 3: Lote — servidor

**Files:**
- Modify: `src/server/applications/repo.ts` (nova `queueApplication`)
- Modify: `src/app/(app)/vagas/actions.ts` (`applyToJob` passa a usar `queueApplication`; nova `applyToJobs`)
- Create: `src/lib/bulk-apply.ts` (pode ir para o cliente: sem imports de servidor)
- Test: `tests/server/applications/bulk-apply.test.ts`, `tests/lib/bulk-apply.test.ts`

**Interfaces:**
- Produces:
  - `queueApplication(db: Db, jobId: number, now: number): { ok: true; id: number } | { ok: false; error: "linkedin" | "not_found" }`: repete a última candidatura `failed`/`login_required` da vaga ou cria uma nova (a lógica que hoje está em `applyToJob`).
  - `BULK_APPLY_MAX = 50` (em `src/lib/bulk-apply.ts`).
  - `type BulkSkipReason = "not_found" | "linkedin" | "active" | "limit"`.
  - `applyJobs(db: Db, jobIds: number[], now: number): { queued: number[]; skipped: { jobId: number; reason: BulkSkipReason }[] }` em `repo.ts`. A server action `applyToJobs(jobIds: number[])` só chama essa função com `Date.now()`.
  - `canBulkApply(job: Pick<JobListItem, "url" | "status" | "application">): boolean`: `isAutoApplyAllowed(url)`, `status !== "applied"` e (`application` nulo ou com status `failed`/`login_required`).

- [ ] **Step 1: Testes que falham**
  - `applyJobs skips active and dedupes`: com vagas A (sem candidatura), B (candidatura `running`), C (`needs_review`), D (`submitted`), E (URL `linkedin.com`), F (`failed`) e o id 999 (não existe), `applyJobs(db, [A, A, B, C, D, E, F, 999], NOW)` devolve `queued` = `[A, F]`. A ganha 1 candidatura nova e F é reenfileirada (mesmo id, `queued`). Em `skipped`: B, C e D com `active`, E com `linkedin`, 999 com `not_found`.
  - `caps the batch at 50`: com 55 ids válidos, enfileira 50 e os 5 últimos ficam `limit`.
  - `tests/lib/bulk-apply.test.ts`: tabela de `canBulkApply`, com `true` para sem candidatura, `failed` e `login_required`, e `false` para `queued`, `running`, `needs_review`, `submitted`, `status: "applied"` e URL do LinkedIn.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/server/applications/bulk-apply.test.ts tests/lib/bulk-apply.test.ts`
Expected: FAIL ("applyJobs is not a function").

- [ ] **Step 3: Implementar** `queueApplication`, `applyJobs` (dedupe com `new Set`, teto antes de processar, uma transação `db.$client.transaction`) e `canBulkApply`. Uma candidatura conta como "ativa" com status `queued`, `running`, `needs_review` ou `submitted`. `applyToJob` passa a delegar para `queueApplication`, sem mudar o comportamento.

- [ ] **Step 4: Rodar e ver passar**, depois `npm run quality`. Expected: verde, incluindo os testes antigos de `applyToJob`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(apply): bulk queue with dedupe, active-skip and 50 cap"
```

---

### Task 4: Lote — UI (multi-seleção e "Quero participar (N)")

**Files:**
- Modify: `src/components/jobs/job-card.tsx` (props `selected`, `onSelectedChange`)
- Create: `src/components/jobs/bulk-apply-bar.tsx`
- Modify: `src/components/jobs/copy.ts`, `src/components/jobs/job-list.tsx`
- Test: `tests/components/jobs/bulk-apply.test.tsx`, `tests/components/jobs/job-card.test.tsx`

**Interfaces:**
- Consumes: `canBulkApply`, `BULK_APPLY_MAX` (Task 3) e a action `applyToJobs` (Task 3).
- Produces:
  - `JobCardProps` ganha `selected?: boolean` e `onSelectedChange?: (v: boolean) => void`. O checkbox só aparece quando `onSelectedChange` existe e tem `aria-label` = `C.bulk.selectOne(job.title)`.
  - `BulkApplyBar({ eligibleCount, selectedCount, onToggleAll, onApply, onClear, busy }: { eligibleCount: number; selectedCount: number; onToggleAll: (all: boolean) => void; onApply: () => void; onClear: () => void; busy: boolean })`.

- [ ] **Step 1: Testes que falham**
  - O card com `onSelectedChange` mostra o checkbox, e o clique chama `onSelectedChange(true)`. Sem a prop, não há checkbox.
  - A barra com `eligibleCount=4, selectedCount=0` mostra "Selecionar todas (4)" desmarcado e "Quero participar (0)" desabilitado. Com `selectedCount=2`, o checkbox fica `indeterminate` e o botão "Quero participar (2)" habilitado chama `onApply`. Com `selectedCount=4`, marcado. Com `eligibleCount=0`, não renderiza.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/components/jobs`
Expected: FAIL.

- [ ] **Step 3: Implementar.** Copy em `JOBS_COPY.bulk`:

```ts
bulk: {
  selectAll: (n: number) => `Selecionar todas (${n})`,
  selectOne: (title: string) => `Selecionar ${title}`,
  apply: (n: number) => `Quero participar (${n})`,
  clear: "Limpar seleção",
  queued: (q: number, s: number) => (s > 0 ? `${q} na fila · ${s} puladas` : `${q} na fila`),
  bridgeOff: "Ajudante desligado: as candidaturas começam quando você rodar `make bridge`.",
},
```

`JobList`: `const [selected, setSelected] = useState<Set<number>>(new Set())`. A seleção efetiva é a interseção com `items.filter(canBulkApply)`, recalculada a cada render, de modo que vaga que deixou de ser elegível sai sozinha. `onSelectedChange` só vai para os cards elegíveis. "Selecionar todas" marca os elegíveis carregados, no máximo `BULK_APPLY_MAX`. No `onApply`, com o ajudante offline, aparece `toast.warning(C.bulk.bridgeOff)` e o lote enfileira mesmo assim. Depois vêm `applyToJobs([...])`, `toast.success(C.bulk.queued(queued.length, skipped.length))`, limpeza da seleção e `reload(filters, true)`. A barra fica `sticky top-0` acima da lista.

- [ ] **Step 4: Rodar e ver passar**, depois `npm run quality`. Expected: verde.

- [ ] **Step 5: Verificar no navegador, com o ajudante PARADO** (Ctrl+C no `make bridge`: com ele ligado, as candidaturas saem de verdade em segundos). Com `docker compose up -d --build`, abra `http://127.0.0.1:3000/vagas`, selecione 2 vagas não-LinkedIn, clique "Quero participar (2)" e confira 2 linhas `queued` em `/candidaturas`. **Cancele as duas** na própria tela antes de religar o ajudante.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(jobs): multi-select and bulk 'Quero participar'"
```

---

### Task 5: Chrome do ajudante no LinkedIn (allowlist, rolagem, login)

**Files:**
- Modify: `bridge/browser.mjs` (`ALLOWED_HOSTS`, `scrolls`, detecção de login; exportar `launchChrome` com `{ minimized }`)
- Create: `bridge/login.mjs`
- Modify: `Makefile` (alvo `linkedin-login`)
- Modify: `src/server/sources/types.ts` (`PageBrowser.getHtml` opts), `src/server/sources/browser.ts`
- Modify: `README.md` (tabela de comandos e seção do LinkedIn)
- Test: `bridge/browser.test.mjs`, `bridge/login.test.mjs`, `tests/server/sources/bridge-browser.test.ts`

**Interfaces:**
- Produces:
  - Payload de `browser_fetch`: `{ url: string; waitFor: string; scrolls?: number }`. O resultado ganha `loginRequired?: boolean`.
  - `PageBrowser.getHtml(url, opts: { waitFor: string; scrolls?: number })`.
  - `export class LoginRequiredError extends HttpError` em `src/server/sources/browser.ts`, com a mensagem `o LinkedIn pediu login no Chrome do ajudante: rode \`make linkedin-login\``.
  - `bridge/login.mjs`: `export async function openLinkedinLogin({ profileDir, launch }): Promise<void>` resolve quando a pessoa fecha o Chrome.

- [ ] **Step 1: Testes que falham**
  - `browser.test.mjs`: `https://www.linkedin.com/search/results/content/?…` é aceito. `https://evil.com` continua recusado. Com `scrolls: 3`, a página falsa recebe 3 `evaluate` de rolagem e 3 `waitForTimeout(1500)`. Com `scrolls: 9`, recebe só 3 (teto). Quando o `page.url()` falso termina em `https://www.linkedin.com/authwall?…` (e também `/login`, `/checkpoint/…`, `/uas/login`), devolve `{ status, html: null, blocked: false, loginRequired: true }` sem esperar o `waitForSelector`.
  - `login.test.mjs`: `openLinkedinLogin` lança o contexto com `minimized: false`, navega para `https://www.linkedin.com/login` e só resolve depois do evento `close` do contexto falso.
  - `bridge-browser.test.ts`: tarefa `browser_fetch` concluída com `{ loginRequired: true }` faz `getHtml` rejeitar com `LoginRequiredError` e a mensagem acima. O payload enfileirado leva `scrolls` quando informado.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run bridge/browser.test.mjs bridge/login.test.mjs tests/server/sources/bridge-browser.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
  - `ALLOWED_HOSTS = /(^|\.)(indeed\.com|glassdoor\.com(\.br)?|linkedin\.com)$/i`.
  - `const LOGIN_WALL = /^\/(login|authwall|checkpoint|uas\/login|signup)/`. A checagem roda logo depois do `goto`, pelo `new URL(page.url())`, só quando o host é do LinkedIn.
  - Rolagem: `MAX_SCROLLS = 3`, `SCROLL_WAIT_MS = 1500`. Ela roda depois do `waitForSelector` e antes do `page.content()`, com `page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))`.
  - `launchChrome(profileDir, { minimized = true } = {})`, exportada. O runner continua chamando minimizado.
  - `login.mjs`: quando executado direto, usa `profileDir = data/chrome-profile` (mesma resolução do `index.mjs`) e imprime `Faça login no LinkedIn nessa janela e feche o Chrome quando terminar.`. Se o launch falhar com perfil em uso, imprime `Pare o ajudante (Ctrl+C no make bridge) antes: o perfil do Chrome está em uso.` e sai com código 1.
  - `Makefile`: `linkedin-login: bridge-deps` → `node bridge/login.mjs`. Inclua no `.PHONY`.
  - `createBridgeBrowser`: repassa `scrolls` no payload e lança `LoginRequiredError` quando `res.loginRequired`.

- [ ] **Step 4: Rodar e ver passar**, depois `npm run quality`. Expected: verde.

- [ ] **Step 5: README.** Coloque `make linkedin-login` na tabela de comandos e crie a seção "Posts de contratação do LinkedIn". Ela explica que essa fonte usa a **sua conta** no Chrome separado do ajudante, só lê 1 página por busca, e avisa: "automação em conta logada vai contra os termos do LinkedIn; existe risco de restrição da conta. Use por sua conta e risco." Corrija a frase da fonte LinkedIn (vagas): ela continua sem login.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(bridge): linkedin in helper chrome with scroll, login-wall detection and make linkedin-login"
```

---

### Task 6: Fixture real dos posts (interativa, com a pessoa)

**Files:**
- Create: `tests/fixtures/sources/linkedin-posts.html` (anonimizada)
- Saída descartável: `spike/out/linkedin-posts-raw.html` (gitignored, nunca commitar)

**Interfaces:**
- Produces: a fixture e o seletor real de cada post, anotado num comentário HTML no topo dela (`<!-- POST_SELECTOR: … | TEXT: … | AUTHOR: … -->`). A Task 7 usa exatamente esses seletores.

- [ ] **Step 1: Login.** Pare o ajudante. Peça à pessoa para rodar `! make linkedin-login`, entrar no LinkedIn na janela aberta e fechar o Chrome.

- [ ] **Step 2: Capturar** com o runner do ajudante (sem o app):

```bash
node --input-type=module -e '
import { createBrowserRunner } from "./bridge/browser.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
const r = createBrowserRunner({ profileDir: "data/chrome-profile" });
const url = "https://www.linkedin.com/search/results/content/?keywords=%22desenvolvedor%22%20and%20%22contratando%22%20%20&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D&datePosted=%5B%22past-24h%22%5D";
const res = await r.run({ url, waitFor: "[data-urn^=\"urn:li:activity:\"]", scrolls: 3 });
mkdirSync("spike/out", { recursive: true });
writeFileSync("spike/out/linkedin-posts-raw.html", res.html ?? "");
console.log({ status: res.status, loginRequired: res.loginRequired, bytes: res.html?.length });
await r.close();'
```

Expected: `loginRequired` falso e alguns centenas de KB de HTML. Se vier `loginRequired: true`, volte ao Step 1.

- [ ] **Step 3: Achar os seletores** no HTML bruto: o contêiner de cada post (o que carrega `urn:li:activity:<id>`, seja em `data-urn` ou em outro atributo), o texto do post e o nome de quem postou. Se `[data-urn^="urn:li:activity:"]` não existir, use o atributo real. Anote os três no comentário do topo da fixture.

- [ ] **Step 4: Montar a fixture anonimizada** com o esqueleto real de **3** contêineres de post (sem `<script>`, `<style>`, `<img>`, `<svg>`), mantendo os atributos e classes que os seletores usam e trocando todo dado real:
  - Post A: autor "Pessoa Recrutadora A", id `7518974430412812345` (2026-10-22T10:00Z). Primeira linha "Estamos contratando!" e segunda linha "Vaga: Desenvolvedor PHP Pleno (remoto)". Corpo com "Envie seu CV para vagas@exemplo.com.br." (e-mail colado no ponto final).
  - Post B: autor "Pessoa Recrutadora B", id `7518951781171212345` (2026-10-22T08:30Z). Texto "Procuramos dev React sênior, híbrido em SP. Me chama no direct!" (sem e-mail).
  - Post C: autor "Pessoa Recrutadora C", id `7518797011353612345` (2026-10-21T22:15Z). Texto com "Desenvolvedora Full Stack", "noreply@exemplo.com", "RH@Exemplo.com" e "talentos@exemplo.com", nessa ordem.

- [ ] **Step 5: Revisar com a pessoa.** Mostre o diff da fixture e confirme que não ficou nome, foto, e-mail ou URL de perfil real. Só depois disso:

```bash
git add tests/fixtures/sources/linkedin-posts.html && git commit -m "test(sources): anonymized linkedin posts search fixture"
```

---

### Task 7: Fonte "LinkedIn (posts)" + e-mail de contato na vaga

**Files:**
- Create: `src/server/sources/linkedin-posts.ts`
- Modify: `src/server/sources/types.ts` (`SourceId`, `RawJob.contactEmail`, `JobSource.fixedQueries`), `labels.ts`, `registry.ts`
- Modify: `src/server/pipeline/search-run.ts` (`s.fixedQueries ?? queries`)
- Modify: `src/server/pipeline/normalize.ts` (`NewJob.contactEmail`)
- Modify: `src/server/db/schema.ts` (`jobs.contactEmail: text()`) + `npm run db:generate` → `drizzle/0001_*.sql`
- Modify: `src/server/jobs/repo.ts` (insert e `contact_email = coalesce(contact_email, ?)` no update)
- Test: `tests/server/sources/linkedin-posts.test.ts`, `tests/server/pipeline/search-run-posts.test.ts`

**Interfaces:**
- Consumes: `LoginRequiredError`, `getHtml(url, { waitFor, scrolls })` (Task 5) e a fixture e os seletores (Task 6).
- Produces:
  - `SourceId` ganha `"linkedin_posts"`. Rótulo `"LinkedIn (posts)"`.
  - `RawJob.contactEmail?: string | null`; `NewJob.contactEmail: string | null`; coluna `jobs.contact_email`.
  - `JobSource.fixedQueries?: SearchQuery[]`: quando existe, a rodada usa essas consultas e ignora as do perfil.
  - Em `linkedin-posts.ts`: `LINKEDIN_POSTS_URL` (a URL exata das Global Constraints), `POST_SELECTOR` (da Task 6), `parseLinkedinPosts(html: string): RawJob[]`, `extractEmails(text: string): string[]`, `activityPostedAt(activityId: string): Date | null`, `postTitle(text: string): string` e `linkedinPostsSource: JobSource`.

- [ ] **Step 1: Testes que falham** (`linkedin-posts.test.ts`, com `sourceFixture("linkedin-posts.html")` e `fixtureBrowser`):
  - `parses the three posts`: 3 itens.

    | | `title` | `company` | `contactEmail` | `postedAt` |
    |---|---|---|---|---|
    | A | `"Vaga: Desenvolvedor PHP Pleno (remoto)"` | `"Pessoa Recrutadora A"` | `"vagas@exemplo.com.br"` | `2026-10-22T10:00:00.000Z` |
    | B | `"Procuramos dev React sênior, híbrido em SP. Me chama no direct!"` | — | `null` | — |
    | C | — | — | `"rh@exemplo.com"` | — |

    A tem `url` = `https://www.linkedin.com/feed/update/urn:li:activity:7518974430412812345/`, `sourceJobId` = `"7518974430412812345"` e `descriptionText` contendo "Envie seu CV". Todos têm `source === "linkedin_posts"` e `descriptionText` sem `<`.
  - `extractEmails`: `"mande p/ a@b.com."` → `["a@b.com"]`. `"X@Y.COM e x@y.com"` → `["x@y.com"]`. `"noreply@x.com no-reply@x.com rh@x.com"` → `["rh@x.com"]`. `"sem email"` → `[]`. `"foo@bar"` → `[]`.
  - `activityPostedAt("7518974430412812345")` → `2026-10-22T10:00:00.000Z`. `"abc"` → `null`.
  - `postTitle`: escolhe a primeira linha com cargo (`/desenvolvedor|desenvolvedora|developer|engenheir|engineer|programador|\bdev\b|tech lead|full ?stack|front-?end|back-?end/i`). Sem linha de cargo, usa a primeira linha não vazia. Corta em 100 caracteres com "…". Texto vazio vira `"Post de contratação"`.
  - `search uses the fixed url with 3 scrolls`: `fixtureBrowser.calls[0]` é `{ url: LINKEDIN_POSTS_URL, waitFor: POST_SELECTOR, scrolls: 3 }` (estenda o tipo `calls` do helper com `scrolls?`).
- [ ] `search-run-posts.test.ts`:
  - `fixed queries run once`: com 5 consultas salvas no perfil, a fonte de posts recebe exatamente 1 chamada de `search`.
  - `login wall marks only linkedin_posts as error`: browser falso que lança `LoginRequiredError` + uma fonte HTTP falsa que devolve 1 vaga. `per_source.linkedin_posts.status === "error"` com `error` contendo `make linkedin-login`, a outra fonte `ok` e a rodada `done`.
  - `contact email survives a later upsert without email`: o primeiro `upsertJob` traz `contactEmail`, o segundo vem com `null` e o e-mail fica.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/server/sources/linkedin-posts.test.ts tests/server/pipeline/search-run-posts.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
  - `extractEmails`: regex `/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi`, minúsculas, sem `.`/`,`/`;`/`)` no fim, sem duplicatas, sem `^(no-?reply|naoresponda)@`. Mantém a ordem de aparição.
  - `activityPostedAt`: `new Date(Number(BigInt(id) >> 22n))`. `null` quando o id não é só dígitos.
  - `parseLinkedinPosts`: usa cheerio com os seletores da Task 6 e passa o texto do post por `htmlToText`. O `RawJob` leva `location: null`, `workModelHint` e `contractHint` = o texto do post (o `normalize` infere remoto/CLT dele), `salaryText: null` e `contactEmail = extractEmails(text)[0] ?? null`. Post sem id ou sem texto é ignorado.
  - `linkedinPostsSource`: `id: "linkedin_posts"`, `homepage: "https://www.linkedin.com/search/results/content/"`, `defaultEnabled: false`, `maxPages: 1`, `fixedQueries: [{ keywords: '"desenvolvedor" and "contratando"', location: null }]`. `search` ignora `q`/`page` e chama `requireBrowser(ctx).getHtml(LINKEDIN_POSTS_URL, { waitFor: POST_SELECTOR, scrolls: 3 })`.
  - Registre no fim de `SOURCES` (desligada por padrão). Em `searchSource`/`runSearch`, use `s.fixedQueries ?? queries`.
  - Schema + `npm run db:generate` + `repo.ts` + `normalize.ts` (`raw.contactEmail?.trim().toLowerCase() || null`).

- [ ] **Step 4: Rodar e ver passar**, depois `npm run quality`. Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(sources): linkedin hiring posts (last 24h) with contact email"
```

---

### Task 8: E-mail — servidor (SMTP Gmail, mensagem, envio, histórico)

**Files:**
- Modify: `package.json` (`nodemailer`, `@types/nodemailer` dev, ambos exatos), `next.config.ts` (`serverExternalPackages: ["better-sqlite3", "nodemailer"]`)
- Modify: `.env.example`
- Create: `src/server/outreach/config.ts`, `src/server/outreach/message.ts`, `src/server/outreach/send.ts`
- Modify: `src/server/db/schema.ts` (tabela `outreach_emails`) + `npm run db:generate` → `drizzle/0002_*.sql`
- Test: `tests/server/outreach/message.test.ts`, `tests/server/outreach/send.test.ts`

**Interfaces:**
- Consumes: `jobs.contact_email` e `jobs.company` (autor do post), da Task 7. Perfil (`personal.name/email/phone/linkedin/portfolio`, `headline`, `skills`, `cvPath`).
- Produces:
  - `type MailConfig = { host: string; port: number; user: string; pass: string }`; `getMailConfig(env?: NodeJS.ProcessEnv): MailConfig | null`. Devolve `null` sem `SMTP_USER` ou `SMTP_PASS`. Padrões `smtp.gmail.com` e `465`.
  - `type OutreachInput = { name: string; headline: string; skills: string[]; phone: string; linkedin: string; portfolio: string; recipientName: string | null }`; `buildOutreachEmail(input: OutreachInput): { subject: string; body: string }`; `withScheme(url: string): string`.
  - `type OutreachDraft = { to: string; subject: string; body: string }`.
  - `type MailMessage = { from: string; replyTo?: string; to: string; subject: string; text: string; attachments?: { filename: string; path: string }[] }`; `type MailTransport = { sendMail(msg: MailMessage): Promise<unknown> }`; `createMailTransport(cfg: MailConfig): MailTransport` (nodemailer, `secure: cfg.port === 465`).
  - `type SendError = "not_found" | "not_configured" | "no_cv" | "invalid_to" | "already_sent" | "smtp"`; `type SendResult = { ok: true } | { ok: false; error: SendError; message?: string }`.
  - `getOutreachDraft(db: Db, jobId: number): { draft: OutreachDraft; cvFilename: string | null; sentAt: number | null } | null`.
  - `sendOutreachEmail(db: Db, jobId: number, draft: OutreachDraft, deps: { config: MailConfig | null; transport?: MailTransport; now: number }): Promise<SendResult>`.
  - `sendTestEmail(deps: { config: MailConfig | null; transport?: MailTransport }): Promise<SendResult>`.
  - `friendlySmtpError(err: unknown, cfg: MailConfig): string`.

- [ ] **Step 1: Instalar**

```bash
npm install --save-exact nodemailer && npm install --save-exact -D @types/nodemailer
```

- [ ] **Step 2: `.env.example`** (ao fim). O `make setup` completa o `.env` existente com estas chaves:

```
# E-mail (opcional, botão "Enviar e-mail" dos posts): Gmail com senha de app.
# Crie em https://myaccount.google.com/apppasswords (exige verificação em 2 etapas).
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
```

- [ ] **Step 3: Testes que falham — mensagem.** `buildOutreachEmail` com `sampleProfile` (nome "Ana Dev", headline "Desenvolvedora Full Stack | PHP", skills PHP, Laravel, React, Vue; linkedin `linkedin.com/in/ana`, portfolio `mizunotech.com.br`, phone `+55 11 90000-0000`) e `recipientName: "Pessoa Recrutadora A"` gera exatamente:

```
subject: "Ana Dev — Desenvolvedora Full Stack em busca de nova oportunidade"
body:
Olá, Pessoa! Tudo bem?

Vi seu post sobre a vaga e quis entrar em contato. Meu nome é Ana Dev, atuo como Desenvolvedora Full Stack, com experiência em PHP, Laravel e React.

Estou em busca de uma nova oportunidade e adoraria fazer parte do time. Envio meu currículo em anexo e deixo também meus links:

LinkedIn: https://linkedin.com/in/ana
Portfólio: https://mizunotech.com.br

Fico à disposição para conversar quando for melhor para você. Agradeço desde já a atenção!

Abraços,
Ana Dev
+55 11 90000-0000
```

Casos extras: `recipientName: null` → `"Olá! Tudo bem?"`. LinkedIn ou portfólio vazio → a linha some (e o bloco "Envio meu currículo em anexo e deixo também meus links:" vira "Envio meu currículo em anexo." quando os dois estão vazios). Headline vazia → subject `"Ana Dev — em busca de nova oportunidade"` e a frase "atuo como…" some, ficando "com experiência em…" como no `buildCompanyMessage`. `withScheme("mizunotech.com.br")` → `"https://mizunotech.com.br"`, e `withScheme("http://x.com")` fica como está. A primeira palavra de `recipientName` é o primeiro nome.

- [ ] **Step 4: Testes que falham — envio** (transport falso que guarda as mensagens ou lança erro; CV temporário em `tmpFile("cv.pdf")`):
  - `sends with cv, links and reply-to`: `from` = `"Ana Dev" <eu@gmail.com>`, `replyTo` = e-mail do perfil, `to` = draft.to, `attachments[0].path` = `cvPath`, `text` = draft.body. Grava uma linha `outreach_emails` com `status = 'sent'`, e a vaga fica `applied`.
  - `already_sent`: um segundo envio para a mesma vaga devolve `{ ok: false, error: "already_sent" }` sem chamar o transport.
  - `gmail auth failure`: transport lança `Object.assign(new Error("Invalid login: 535-5.7.8 ... SENHA123"), { code: "EAUTH", responseCode: 535 })`. O retorno é `error: "smtp"`, com `message` contendo "senha de app" e **sem** "SENHA123". Grava linha `failed`, a vaga **não** fica `applied` e um envio seguinte com transport ok funciona.
  - `not_configured` (config `null`), `no_cv` (`cvPath` nulo ou arquivo apagado), `invalid_to` (`"foo@"`), `not_found` (jobId inexistente). Nenhum chama o transport.
  - `getOutreachDraft`: `to` = `contact_email`. `recipientName` vem do `company` da vaga, e o draft é igual ao `buildOutreachEmail` correspondente. `cvFilename` = basename do CV. `sentAt` nulo antes e preenchido depois do envio.
  - `getMailConfig`: `{}` → `null`; `{ SMTP_USER: "a", SMTP_PASS: "b" }` → host `smtp.gmail.com`, porta `465`.

- [ ] **Step 5: Rodar e ver falhar**

Run: `npx vitest run tests/server/outreach`
Expected: FAIL.

- [ ] **Step 6: Implementar.**
  - Tabela `outreachEmails`: `id` pk autoincrement, `jobId` → `jobs.id` on delete cascade, `toEmail`, `subject`, `body`, `status: "sent" | "failed"`, `error`, `createdAt`. Índice em `jobId`. Depois `npm run db:generate`.
  - Ordem das checagens em `sendOutreachEmail`: vaga existe → config → CV existe em disco → `to` passa em `z.email()` → nenhuma linha `sent` para a vaga → `sendMail`.
  - `friendlySmtpError`: `code === "EAUTH"` ou `responseCode === 535` → `O Gmail recusou o login: use uma senha de app (myaccount.google.com/apppasswords), não a senha da conta.`. `ECONNECTION`, `ETIMEDOUT`, `ESOCKET` ou `EDNS` → `Não consegui conectar em ${host}:${port}.`. Qualquer outro → `Falha no envio do e-mail (${code ?? "erro"}).`. Nunca devolve `err.message` cru, porque ele pode ecoar credenciais.
  - `sendTestEmail`: para `config.user`, assunto `job-look-up: teste de e-mail`, texto `Se você recebeu esta mensagem, o envio de e-mails do job-look-up está funcionando.`, sem anexo e sem gravar histórico.

- [ ] **Step 7: Rodar e ver passar**, depois `npm run quality`. Expected: verde.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(outreach): warm email with cv via gmail smtp, history and friendly errors"
```

---

### Task 9: E-mail — UI (botão no card, diálogo, Configuração → E-mail)

**Files:**
- Modify: `src/server/jobs/list.ts` (`JobListItem.contactEmail`, `JobListItem.emailSentAt`)
- Modify: `src/app/(app)/vagas/actions.ts` (`loadOutreachDraft`, `sendOutreach`)
- Create: `src/components/outreach/copy.ts`, `email-button.tsx`, `outreach-dialog.tsx`
- Modify: `src/components/jobs/job-list.tsx`
- Create: `src/app/(app)/config/email/page.tsx`, `src/app/(app)/config/email/actions.ts`, `src/components/outreach/email-settings.tsx`
- Modify: `src/components/app-sidebar.tsx` + copy do shell (`nav.email`, ícone `Mail`)
- Modify: `README.md` (seção "E-mail para posts do LinkedIn")
- Test: `tests/components/outreach/outreach.test.tsx`, `tests/server/jobs/list.test.ts`, e as fábricas de `JobListItem` nos testes de componente (campos novos)

**Interfaces:**
- Consumes: tudo de `src/server/outreach/*` (Task 8).
- Produces:
  - `JobListItem.contactEmail: string | null` e `JobListItem.emailSentAt: number | null` (`max(created_at)` das linhas `sent`).
  - Actions: `loadOutreachDraft(jobId: number): Promise<{ draft: OutreachDraft; cvFilename: string | null; sentAt: number | null; configured: boolean } | null>` e `sendOutreach(jobId: number, draft: OutreachDraft): Promise<SendResult>`.
  - `EmailButton({ contactEmail, sentAt, onOpen }: { contactEmail: string | null; sentAt: number | null; onOpen: () => void })`.
  - `OutreachDialog({ jobId, open, onOpenChange, load, send, onSent })`, com `load`/`send` injetados (mesmas assinaturas das actions), no padrão dos testes de `ApplyButton`.

- [ ] **Step 1: Testes que falham**
  - `list.test.ts`: uma vaga com `contact_email` e uma linha `sent` traz `contactEmail` e `emailSentAt` preenchidos. Uma linha só `failed` deixa `emailSentAt` nulo.
  - `EmailButton`: com e-mail e sem envio → botão "Enviar e-mail" habilitado chama `onOpen`. Sem e-mail → desabilitado com a dica "Esse post não tem e-mail. Abra o post e fale pelo LinkedIn.". Com `sentAt` → "E-mail enviado ✓" desabilitado.
  - `OutreachDialog`: `load` falso devolve um draft. O teste edita o campo Mensagem, clica "Enviar" e espera `send` chamado com `(jobId, { to, subject, body: <editado> })` e `onSent` chamado. Com `configured: false`, "Enviar" fica desabilitado com aviso e link para `/config/email`. Com `cvFilename: null`, desabilitado com link para `/perfil`. Resultado `{ ok: false, error: "smtp", message }` mostra a `message`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/components/outreach tests/server/jobs/list.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar.** Copy (`OUTREACH_COPY`):

```ts
button: { send: "Enviar e-mail", sent: "E-mail enviado ✓", noEmail: "Esse post não tem e-mail. Abra o post e fale pelo LinkedIn." },
dialog: { title: "Enviar e-mail", to: "Para", subject: "Assunto", body: "Mensagem", attachment: (f: string) => `Anexo: ${f}`,
  noCv: "Sem currículo no perfil: envie o PDF em Perfil.", notConfigured: "E-mail não configurado: veja Configuração → E-mail.",
  send: "Enviar", sending: "Enviando…", cancel: "Cancelar" },
toast: { sent: (to: string) => `E-mail enviado para ${to}` },
errors: { not_found: "Vaga não encontrada.", not_configured: "E-mail não configurado.", no_cv: "Sem currículo no perfil.",
  invalid_to: "E-mail do destinatário inválido.", already_sent: "Você já enviou e-mail para essa vaga." },
settings: { title: "E-mail", configured: (u: string, h: string, p: number) => `Envia como ${u} via ${h}:${p}.`,
  notConfigured: "Ainda não configurado.", steps: ["Ative a verificação em 2 etapas na sua Conta Google.",
  "Crie uma senha de app em myaccount.google.com/apppasswords.", "No arquivo .env, preencha SMTP_USER (seu Gmail) e SMTP_PASS (a senha de app).",
  "Rode `docker compose up -d` para o app ler o .env de novo."], test: "Enviar e-mail de teste para mim", testOk: "E-mail de teste enviado." },
```

Para `error: "smtp"`, mostre a `message` do servidor. No `JobList`, o slot `actions` fica `job.source === "linkedin_posts" ? <EmailButton …/> : <ApplyButton …/>`, com estado `emailJobId` e um `<OutreachDialog>` único, cujo `onSent` faz `reload(filters, true)`. A página `/config/email` (server component) lê `getMailConfig()` e passa só `{ user, host, port } | null` ao cliente, nunca a senha. O botão de teste chama a action `sendTestEmailAction()`.

- [ ] **Step 4: Rodar e ver passar**, depois `npm run quality`. Expected: verde.

- [ ] **Step 5: README.** Crie a seção "E-mail para posts do LinkedIn" com os 4 passos de `settings.steps`, o que vai no e-mail (mensagem, CV, LinkedIn, portfólio do perfil) e a regra "só sai quando você clica Enviar".

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(outreach): email button on post cards, review dialog and email settings page"
```

---

### Task 10: Verificação ponta a ponta (com a pessoa)

**Files:** nenhum código, a não ser correções que a verificação revelar (cada uma com teste, na task dona).

- [ ] **Step 1: Subir tudo**

```bash
make setup && docker compose up -d --build && make bridge
```

Expected: `/api/health` 200, e o ajudante loga "ajudante ligado".

- [ ] **Step 2: Cache.** Descarte 1 vaga, rode "Buscar vagas" e confira que ela não volta. Use "Limpar cache" e confira que ela volta.

- [ ] **Step 3: Posts.** Ligue "LinkedIn (posts)" em Configuração → Fontes e rode uma busca. Os cards da fonte aparecem com "Enviar e-mail" (ou desabilitado sem e-mail). Se a fonte mostrar o erro de login, rode `make linkedin-login` com o ajudante parado.

- [ ] **Step 4: E-mail.** A pessoa preenche `SMTP_USER`/`SMTP_PASS` e roda `docker compose up -d`. Em Configuração → E-mail, "Enviar e-mail de teste para mim" chega na caixa dela. **Envio real para recrutador só por decisão da pessoa**, no diálogo.

- [ ] **Step 5: Lote + envio automático.** A pessoa escolhe as vagas reais. Agente nenhum dispara lote sem ela, porque agora o envio é de verdade. Acompanhe em `/candidaturas`: cada uma termina `submitted` (Enviada ✓) ou `needs_review` com o motivo.

- [ ] **Step 6: Portão final**

Run: `npm run quality`
Expected: verde. Depois disso, siga `superpowers:finishing-a-development-branch`.
