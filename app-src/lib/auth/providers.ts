/** How OTP codes reach the user. Pick with AUTH_OTP_PROVIDER = "whatsapp" | "dev". */

export interface OtpProvider {
  name: "dev" | "whatsapp";
  send(phoneE164: string, code: string): Promise<void>;
}

const devProvider: OtpProvider = {
  name: "dev",
  async send(phone, code) {
    // Local development only: the code is printed here and echoed to the page.
    console.info(`[auth:dev] OTP for ${phone}: ${code}`);
  },
};

/**
 * WhatsApp Cloud API (Meta) using an approved *authentication* message template.
 * Needs WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_OTP_TEMPLATE.
 * NOTE: written to Meta's documented payload but not yet exercised against a live account.
 */
const whatsappProvider: OtpProvider = {
  name: "whatsapp",
  async send(phone, code) {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const template = process.env.WHATSAPP_OTP_TEMPLATE;
    if (!token || !phoneId || !template) throw new Error("WhatsApp provider is not fully configured");
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone.replace(/^\+/, ""),
        type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_OTP_LANG ?? "en" },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
          ],
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`WhatsApp send failed (${res.status})`);
  },
};

/** The dev provider is only ever the default outside production. */
export function getOtpProvider(): OtpProvider | null {
  const choice = process.env.AUTH_OTP_PROVIDER;
  if (choice === "whatsapp") return whatsappProvider;
  if (choice === "dev") return process.env.NODE_ENV === "production" ? null : devProvider;
  return process.env.NODE_ENV === "production" ? null : devProvider;
}
