import { ENV } from "./env";

type PasswordResetEmail = { email: string; name: string; resetUrl: string };

export async function sendPasswordResetEmail(input: PasswordResetEmail) {
  if (!ENV.resendApiKey || !ENV.emailFrom) {
    if (ENV.isProduction) throw new Error("O serviço de e-mail não está configurado.");
    console.info(`[Auth] Password reset link for ${input.email}: ${input.resetUrl}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ENV.emailFrom,
      to: [input.email],
      subject: "Redefinição de senha | Gincana Sedentos",
      text: `Olá${input.name ? `, ${input.name}` : ""}. Use este link para redefinir sua senha: ${input.resetUrl}`,
    }),
  });

  if (!response.ok) {
    throw new Error("Não foi possível enviar o e-mail de recuperação.");
  }
}
