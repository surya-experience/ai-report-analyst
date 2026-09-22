import "server-only";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export interface EmailSendResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

// Single seam for outbound email. Swap the body of this function for a real
// provider (Resend, Postmark, SES) — everything upstream (campaigns API,
// support notifications) calls this and doesn't need to change.
//
// Without RESEND_API_KEY set, this logs instead of sending, so the rest of
// the campaign flow (segment resolution, send tracking) is fully testable
// before an email provider is wired up.
export async function sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email:dev] to=${payload.to} subject="${payload.subject}"`);
    return { ok: true, providerId: "dev-noop" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Experience.com <notifications@experience.com>",
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${text}` };
  }
  const data = (await res.json()) as { id: string };
  return { ok: true, providerId: data.id };
}
