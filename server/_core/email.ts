import { ENV } from "./env";
import { Resend } from "resend";

type PasswordResetEmail = { email: string; name: string; resetUrl: string };

export async function sendPasswordResetEmail(input: PasswordResetEmail) {
  if (!ENV.resendApiKey || !ENV.emailFrom) {
    if (ENV.isProduction) throw new Error("O serviço de e-mail não está configurado.");
    console.info(`[Auth] Password reset link for ${input.email}: ${input.resetUrl}`);
    return;
  }

  const resend = new Resend(ENV.resendApiKey);
  const { error } = await resend.emails.send({
    from: ENV.emailFrom,
    to: [input.email],
    subject: "Redefinição de senha | Gincana Sedentos",
    text: `Olá${input.name ? `, ${input.name}` : ""}. Use este link para redefinir sua senha: ${input.resetUrl}`,
    html: `<p>Olá${input.name ? `, ${input.name}` : ""}.</p><p>Use este link para redefinir sua senha: <a href="${input.resetUrl}">Redefinir senha</a></p>`,
  });

  if (error) {
    console.error("[Auth] Resend error:", error.message);
    throw new Error("Não foi possível enviar o e-mail de recuperação.");
  }
}
