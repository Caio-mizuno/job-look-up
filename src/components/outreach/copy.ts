import type { SendError } from "@/server/outreach/send";

export const OUTREACH_COPY = {
  button: {
    send: "Enviar e-mail",
    sent: "E-mail enviado ✓",
    noEmail: "Esse post não tem e-mail. Abra o post e fale pelo LinkedIn.",
  },
  dialog: {
    title: "Enviar e-mail",
    description: "Confira e ajuste a mensagem. Ela só sai quando você clicar em Enviar.",
    to: "Para",
    subject: "Assunto",
    body: "Mensagem",
    attachment: (f: string) => `Anexo: ${f}`,
    noCv: "Sem currículo no perfil: envie o PDF em Perfil.",
    notConfigured: "E-mail não configurado: veja Configuração → E-mail.",
    send: "Enviar",
    sending: "Enviando…",
    cancel: "Cancelar",
    loading: "Carregando…",
  },
  toast: { sent: (to: string) => `E-mail enviado para ${to}` },
  errors: {
    not_found: "Vaga não encontrada.",
    not_configured: "E-mail não configurado.",
    no_cv: "Sem currículo no perfil.",
    invalid_to: "E-mail do destinatário inválido.",
    already_sent: "Você já enviou e-mail para essa vaga.",
  } satisfies Record<Exclude<SendError, "smtp">, string>,
  settings: {
    title: "E-mail",
    description: "Usado pelo botão \"Enviar e-mail\" dos posts do LinkedIn. Sai da sua conta do Gmail, com o seu currículo anexado.",
    configured: (u: string, h: string, p: number) => `Envia como ${u} via ${h}:${p}.`,
    notConfigured: "Ainda não configurado.",
    steps: [
      "Ative a verificação em 2 etapas na sua Conta Google.",
      "Crie uma senha de app em myaccount.google.com/apppasswords.",
      "No arquivo .env, preencha SMTP_USER (seu Gmail) e SMTP_PASS (a senha de app).",
      "Rode `docker compose up -d` para o app ler o .env de novo.",
    ],
    test: "Enviar e-mail de teste para mim",
    testOk: "E-mail de teste enviado.",
  },
};
