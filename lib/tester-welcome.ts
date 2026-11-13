export const FOUNDER_SCOPE = "Acceso personal gratuito de por vida a las funciones de inventario, compras, pesajes, etiquetas y proyectos de esta versión. Sin cobros recurrentes. Vinculado a tu cuenta.";
export const FOUNDER_EXCLUSIONS = "Los servicios externos y futuros planes adicionales no están incluidos.";
export const APP_URL = "https://properformakers.com/";
export const SUPPORT_EMAIL = "hola@properformakers.com";
export const WELCOME_SUBJECT = "Te invitamos al piloto de Proper";

function welcomeCopy(name: string, email: string) {
  return {
    greeting: name ? `Hola, ${name}:` : "Hola:",
    intro: "Proper te ayuda a organizar los materiales, las compras y los proyectos de tu taller de impresión 3D.",
    reason: "Te invitamos a un piloto privado de 14 días para conocer cómo usás Proper en tu taller y qué podemos mejorar.",
    next: `Entrá con ${email}. Te enviaremos un enlace seguro y, en tu primer ingreso, vas a completar un breve cuestionario para activar tu acceso al piloto.`,
    feedback: "Durante la prueba, contanos qué te sirvió, qué te confundió o qué falló. Podés hacerlo desde Tu espacio → Compartir una idea o respondiendo este correo."
  };
}

export function welcomeText(name: string, email: string) {
  const copy = welcomeCopy(name, email);
  return [copy.greeting, copy.intro, copy.reason, copy.next, `Entrar a Proper: ${APP_URL}`,
    copy.feedback, `¿Necesitás ayuda? Escribinos a ${SUPPORT_EMAIL}.`, "El equipo de Proper"].join("\n\n");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function welcomePayload(name: string, email: string, from: string) {
  const copy = welcomeCopy(name, email);
  const paragraph = (text: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55">${escapeHtml(text)}</p>`;
  return {
    from, to: [email], reply_to: SUPPORT_EMAIL, subject: WELCOME_SUBJECT,
    text: welcomeText(name, email),
    html: `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${WELCOME_SUBJECT}</title>
  <style>@media(prefers-color-scheme:dark){.canvas{background:#192C24!important}.paper{background:#243A30!important}.ink,.support{color:#FFFFFF!important}.muted{color:#E8EFE5!important}}</style>
</head>
<body class="canvas" bgcolor="#F8F4EB" style="margin:0;background:#F8F4EB;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="canvas" bgcolor="#F8F4EB">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="paper" bgcolor="#FFFFFF" style="max-width:552px;border-radius:16px">
        <tr><td class="ink" style="padding:32px 24px;color:#192C24;overflow-wrap:anywhere">
          <p class="ink" style="margin:0 0 24px;font-size:30px;font-weight:800;letter-spacing:-1.2px">Proper<span style="color:#C76F56">.</span></p>
          <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2">Te invitamos al piloto</h1>
          ${[copy.greeting, copy.intro, copy.reason, copy.next].map(paragraph).join("")}
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#23634B" style="border-radius:8px">
            <a href="${APP_URL}" style="display:inline-block;background:#23634B;border:1px solid #23634B;border-radius:8px;color:#FFFFFF;font-size:16px;font-weight:bold;line-height:22px;padding:13px 20px;text-decoration:none">Entrar a Proper</a>
          </td></tr></table>
          <div style="padding-top:24px">${paragraph(copy.feedback)}</div>
          <p class="muted" style="margin:16px 0 0;color:#58695E;font-size:14px;line-height:1.55">¿Necesitás ayuda? Escribinos a <a class="support" href="mailto:${SUPPORT_EMAIL}" style="color:#23634B">${SUPPORT_EMAIL}</a>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  };
}

// Resend retains idempotency keys for 24 hours. Stop early if an old attempt
// remains uncertain instead of risking another welcome after that window.
export function canRetryWelcome(firstAttemptAt: string, now = Date.now()) {
  const age = now - Date.parse(firstAttemptAt);
  return Number.isFinite(age) && age >= -60000 && age < 23 * 60 * 60 * 1000;
}

export async function sendWelcomeEmail(membershipId: string, payload: unknown, apiKey: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `founder-welcome/${membershipId}` },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(12000)
  });
  const result = await response.json() as { id?: string };
  if (!response.ok || !result.id) throw new Error("welcome_not_confirmed");
  return result.id;
}
