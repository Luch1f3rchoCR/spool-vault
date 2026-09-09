export const FOUNDER_SCOPE = "Acceso personal gratuito de por vida a las funciones de inventario, compras, pesajes, etiquetas y proyectos de esta versión. Sin cobros recurrentes. Vinculado a tu cuenta.";
export const FOUNDER_EXCLUSIONS = "Los servicios externos y futuros planes adicionales no están incluidos.";
export const APP_URL = "https://spool-vault.vercel.app/";

export function welcomeText(name: string, email: string) {
  return `Hola, ${name || "probador fundador"}:\n\nTe damos la bienvenida al grupo de pruebas de Spool Vault.\n\nTu licencia: Probador fundador · gratis de por vida.\n${FOUNDER_SCOPE}\n${FOUNDER_EXCLUSIONS}\n\nEntrá a ${APP_URL} e iniciá sesión con ${email}. Recibirás un enlace seguro para verificar tu correo. Al ingresar por primera vez, completá un breve formulario sobre tu experiencia, uso e impresoras y activá tu acceso de probador. Después podrás administrar tus máquinas desde Perfil > Mis impresoras.\n\nNos gustaría que probés la app con tus filamentos y nos contés qué falla, qué resulta confuso y qué ideas tenés. Podés enviar tus aportes desde Tu espacio > Compartir una idea.\n\nGracias por ayudarnos a mejorar Spool Vault.\nEl equipo de Spool Vault`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function welcomePayload(name: string, email: string, from: string) {
  const text = welcomeText(name, email);
  const paragraphs = text.split("\n\n").map((paragraph) => `<p style="line-height:1.6;margin:0 0 18px">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
  return {
    from, to: [email], subject: "Bienvenido a Spool Vault · Probador fundador",
    text,
    html: `<!doctype html><html lang="es"><body style="margin:0;background:#f4f6f5;color:#172b24;font-family:Arial,sans-serif"><main style="max-width:560px;margin:auto;padding:32px 24px;background:white"><h1 style="font-size:28px;margin:0 0 24px">Spool Vault</h1>${paragraphs}<a href="${APP_URL}" style="display:inline-block;padding:14px 20px;background:#20684d;color:white;text-decoration:none;border-radius:6px">Entrar a Spool Vault</a><p style="font-size:12px;color:#64736b;margin-top:28px">Spool Vault by Stone Collective</p></main></body></html>`
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
