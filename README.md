# job-look-up

Busca vagas de emprego com base no **seu** perfil, dá uma nota de match para cada uma e preenche e envia a candidatura no **seu** Chrome. Se faltar alguma informação, para antes de enviar e pergunta para você.

- Roda **100% na sua máquina** (Docker). Sem servidor online, sem conta, sem login.
- A IA roda pela **sua assinatura do Claude** (via Claude Code). Não precisa de chave de API.
- Open source (MIT).

> English summary at the end.

## Como funciona

```
┌──────────────────────── Docker (127.0.0.1) ────────────────────────┐
│  app  (Next.js: telas + API)        worker (mesmo código)           │
│     │  lê/escreve                     │  busca, analisa, agenda     │
│     └──────────► SQLite ./data/app.db ◄┘                            │
└──────────────▲─────────────────────────────────────────────────────┘
               │ HTTP localhost:3000 + token (o ajudante faz polling)
┌──────────────┴──────── Seu computador ─────────────────────────────┐
│  ajudante (bridge/, Node + playwright-core)                         │
│   • análise:     claude -p --json-schema …  (sua assinatura)        │
│   • candidatura: claude -p --chrome …  → Claude in Chrome → Chrome  │
│   • Indeed/Glassdoor: busca num Chrome separado (playwright-core)   │
└────────────────────────────────────────────────────────────────────┘
```

1. **Onboarding.** Você monta o perfil em 8 etapas. Dá para importar o currículo em PDF, `.md` ou texto colado; no LinkedIn, use **Perfil → Mais → Salvar como PDF**.
2. **Busca.** A IA gera consultas a partir do perfil e o worker consulta as fontes em paralelo, junta duplicatas e filtra pelo que você procura.
3. **Análise.** As 40 melhores vagas recebem nota de 0 a 100, "por que combina", o que a vaga oferece, o que você vai fazer e os requisitos.
4. **Candidatura.** Em "Quero participar", o ajudante abre a vaga no seu Chrome, preenche com os seus dados, anexa o CV e **envia** quando está tudo preenchido. O que faltou volta para o app para você responder.

## Requisitos

- Docker (Docker Desktop no macOS).
- Node **20.12+** no computador, só para o ajudante.
- [Claude Code](https://claude.com/claude-code) instalado e logado.
- Google Chrome com a extensão **Claude in Chrome** ativa (só para a candidatura automática).
- Google Chrome também para Indeed e Glassdoor, se ligar essas fontes (sem extensão, com um perfil separado do seu).

Testado em macOS. Linux deve funcionar; no Windows, use WSL2 (não testado).

## Começando

```bash
git clone <este repositório> job-look-up && cd job-look-up
make up        # cria o .env com segredos novos, sobe o Docker e inicia o ajudante
```

Abra **http://127.0.0.1:3000** e siga o onboarding.

| Comando | O que faz |
|---|---|
| `make up` | `make setup` + `docker compose up -d --build` + ajudante em primeiro plano |
| `make bridge` | só o ajudante (se o Docker já estiver de pé); na primeira vez instala o `playwright-core` dele |
| `make down` | para os containers |
| `make logs` | logs do app e do worker |

Seus dados ficam em `./data` (banco SQLite e CV). Para backup, copie essa pasta.

## Privacidade

- Tudo fica em `./data`, na sua máquina. O app escuta **só em 127.0.0.1**.
- **O que sai da máquina:**
  - consultas às fontes de vaga (só palavras-chave, sem dados pessoais);
  - durante a análise (modo padrão), seu perfil e o texto das vagas vão para a Anthropic via Claude Code;
  - durante a candidatura, seu perfil e seu CV vão para a Anthropic via Claude in Chrome, e para o site da vaga, claro.
- Quer a análise 100% local? Em **Configuração → IA**, escolha **OpenAI-compatible** e aponte para o Ollama (`http://host.docker.internal:11434/v1`). A candidatura automática continua usando o Claude.
- **Não exponha o app na rede.** Ele não tem login, porque foi feito para uma pessoa só, na própria máquina.

## Candidatura automática: o que o ajudante faz e não faz

**Faz:** abre a vaga, avança as etapas, preenche os campos com dados do seu perfil e das suas respostas prontas, anexa o CV e usa rascunhos da IA em perguntas abertas, sempre marcados como rascunho.

**Envia** quando todos os campos obrigatórios foram preenchidos com dados seus e a página confirma o envio. Se faltar algo, para e deixa a aba aberta para você.

**Não faz, nunca:**
- criar conta;
- aceitar termos ou LGPD;
- fazer testes ou vídeos;
- inventar fatos (anos, salário, certificações).

Se pedir login, ele para e avisa.

**LinkedIn é só manual:** para vagas do LinkedIn existe o **Kit de candidatura**, com tudo pronto para copiar. Automação ali pode bloquear a sua conta.

## Fontes de vaga

| Fonte | Tipo | Padrão |
|---|---|---|
| Gupy, Programathor, Vagas.com.br, InfoJobs | Brasil | ligadas |
| Remotive, Remote OK, Himalayas, We Work Remotely, Working Nomads, Jobicy | remoto internacional | ligadas |
| Arbeitnow | Europa | desligada |
| LinkedIn (endpoint público, **nunca usa seu login**) | global | desligada; pode ser bloqueada |
| Indeed, Glassdoor (pelo ajudante, num Chrome separado do seu) | Brasil | desligadas; podem ser bloqueadas |

**Indeed e Glassdoor** recusam qualquer cliente que não seja navegador (desafio do Cloudflare). O ajudante abre a busca no Google Chrome instalado, com um perfil só do app (sem o seu login), minimizado (a janela só pisca ao abrir) e uma página por vez. Se o site pedir verificação, a fonte para e aparece como "limitada": o app não resolve captcha nem disfarça o navegador. Do Glassdoor vem só o resumo de cada vaga, porque a página de detalhes sempre pede verificação. Raspar esses sites vai contra os termos de uso deles, por isso as duas vêm desligadas.

**Ficaram de fora:**
- **NetVagas, Remotar, Catho, Trampos e Coodesh** só montam a lista de vagas via JavaScript.

Regras de boa convivência:
- poucas requisições por busca, com cache de 6 h nas APIs que pedem isso;
- crédito e link para a fonte em todo card, como pedem Remotive, Remote OK e Jobicy;
- nada de login, captcha resolvido ou navegador disfarçado: se o site bloquear, a fonte para.

Ligue e desligue as fontes em **Configuração → Fontes de vaga**.

### Adicionar uma fonte

Implemente `JobSource` (`src/server/sources/types.ts`): `search(query, page, http, ctx)` devolve `RawJob[]`, e `fetchDetail` é opcional. Site que recusa requisições simples usa `ctx.browser.getHtml(url, { waitFor })`, que abre a página no Chrome pelo ajudante; libere o domínio em `bridge/browser.mjs`. Registre em `src/server/sources/registry.ts` e escreva um teste com uma fixture real em `tests/fixtures/sources/`. Para olhar uma fonte ao vivo: `npx tsx scripts/probe-source.ts <id> "<palavras>"`.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "Ajudante desligado" | rode `make bridge` no terminal, na pasta do projeto |
| `BRIDGE_TOKEN não confere com o .env do app` | rode `make setup` e reinicie o Docker (`make down && make up`) |
| Vagas "aguardando análise" | o ajudante está desligado; a fila anda sozinha quando ele volta |
| "Teto diário de IA atingido" | ajuste o teto em **Configuração → IA** (0 = sem teto) |
| Fonte "limitada" | o site respondeu 429 ou pediu verificação anti-robô; a próxima busca tenta de novo |
| Indeed/Glassdoor: `falta o playwright-core no ajudante` | rode `make bridge` (ou `npm --prefix bridge install`) |
| Indeed/Glassdoor: `não consegui abrir o Google Chrome` | instale o Google Chrome |
| A extensão pede permissão para um site | aprove no Chrome; o ajudante espera até 10 min |
| Limite do plano do Claude | a análise usa a mesma cota do Claude Code; diminua a busca automática ou defina um teto |

## Desenvolvimento

```bash
npm install
npm run dev            # app em http://localhost:3000 (DATA_DIR=./data)
npm run quality        # eslint + tsc + vitest (portão obrigatório)
npm run worker:build   # bundle do worker
```

A stack inclui Next.js 16, React 19, Tailwind v4, shadcn/ui, SQLite (better-sqlite3 + Drizzle), zod, cheerio e vitest. O ajudante (`bridge/`) é Node puro; a única dependência é o `playwright-core`, para Indeed e Glassdoor.

## English

**job-look-up** is a local-first, open-source job finder.
1. You build a profile in an onboarding wizard; importing a PDF or text works.
2. It searches several job boards in parallel: Brazilian boards plus remote-first international ones. Indeed and Glassdoor are opt-in: the helper opens them in a separate Chrome profile and stops if the site asks for a captcha.
3. Claude (through your own Claude Code subscription, via a small host helper) scores each job against your profile and summarizes it.
4. On "apply", Claude in Chrome fills and **submits** the application in **your** Chrome; if a required answer is missing it stops before submitting and asks you.

Everything runs on your machine with Docker (`make up`, then http://127.0.0.1:3000). Data stays in `./data`. LinkedIn is never automated; the app gives you a copy-paste kit for those jobs instead. MIT licensed.

## Licença

MIT. Veja [LICENSE](LICENSE).
