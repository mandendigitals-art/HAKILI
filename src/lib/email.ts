import nodemailer from "nodemailer";

export type EmailOptions = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendEmail(opts: EmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  // 1. Resend API support if RESEND_API_KEY is configured
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM ?? "HAKILI <support@mandendigital.com>";

  if (resendKey && !resendKey.includes("changeme") && resendKey.trim().length > 0) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [opts.to],
          subject: opts.subject,
          text: opts.text,
          html: opts.html,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Resend HTTP ${res.status}`);
      }
      const data = await res.json();
      return { success: true, id: data.id };
    } catch (e) {
      console.error("[email] Erreur envoi via Resend :", e);
      return { success: false, error: e instanceof Error ? e.message : "Erreur Resend" };
    }
  }

  // 2. SMTP transport if SMTP_HOST is configured
  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost && !smtpHost.includes("changeme") && smtpHost.trim().length > 0) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS ?? "",
            }
          : undefined,
      });

      const info = await transporter.sendMail({
        from: fromEmail,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      });

      return { success: true, id: info.messageId };
    } catch (e) {
      console.error("[email] Erreur envoi SMTP :", e);
      return { success: false, error: e instanceof Error ? e.message : "Erreur SMTP" };
    }
  }

  // 3. Fallback for development / test
  if (process.env.NODE_ENV !== "production") {
    console.info(`[email-dev] Simulation envoi vers ${opts.to} : ${opts.subject}`);
  }
  return { success: true, id: "dev-simulated" };
}

export function buildPasswordResetEmail(resetUrl: string) {
  const subject = "Réinitialisation de votre mot de passe — HAKILI";
  const text = `Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe pour votre compte HAKILI (Manden Digital SARL).

Veuillez cliquer sur le lien suivant pour choisir un nouveau mot de passe (ce lien est valable 1 heure) :
${resetUrl}

Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.

L'équipe HAKILI — Manden Digital SARL
support@mandendigital.com | +223 77 47 47 97
https://mandendigital.com`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Réinitialisation de mot de passe HAKILI</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background-color: #0b1b3a; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 24px; margin: 0; letter-spacing: 0.15em;">HAKILI</h1>
      <p style="color: #94a3b8; font-size: 12px; margin: 6px 0 0 0;">Une solution Manden Digital SARL</p>
    </div>
    <div style="padding: 32px 24px;">
      <h2 style="color: #0b1b3a; font-size: 18px; margin-top: 0;">Réinitialisation de votre mot de passe</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Vous avez demandé la réinitialisation de votre mot de passe sur la plateforme HAKILI.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="background-color: #1e6fe8; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; display: inline-block;">
          Réinitialiser mon mot de passe
        </a>
      </div>
      <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
        Ce lien est à usage unique et expire dans <strong>1 heure</strong>.<br>
        Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.
      </p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">
        Manden Digital SARL · Bamako, Mali · support@mandendigital.com · +223 77 47 47 97
      </p>
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}
