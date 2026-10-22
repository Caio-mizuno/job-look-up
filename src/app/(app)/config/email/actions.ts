"use server";

import { getMailConfig } from "@/server/outreach/config";
import { sendTestEmail, type SendResult } from "@/server/outreach/send";

export async function sendTestEmailAction(): Promise<SendResult> {
  return sendTestEmail({ config: getMailConfig() });
}
