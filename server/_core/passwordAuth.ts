import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import * as db from "../db";
import { sendPasswordResetEmail } from "./email";

const PASSWORD_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function validatePassword(password: string) {
  if (password.length < 8 || password.length > 128) {
    throw new Error("A senha deve ter entre 8 e 128 caracteres.");
  }
}

export async function registerWithPassword(input: { email: string; name: string; password: string }) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!email.includes("@")) throw new Error("Informe um e-mail válido.");
  if (name.length < 2 || name.length > 120) throw new Error("Informe um nome válido.");
  validatePassword(input.password);
  if (await db.getUserByEmail(email)) throw new Error("Já existe uma conta criada com esse email.");

  const passwordHash = await bcrypt.hash(input.password, PASSWORD_ROUNDS);
  return db.createPasswordUser({ email, name, passwordHash });
}

export async function authenticateWithPassword(input: { email: string; password: string }) {
  const user = await db.getUserByEmail(normalizeEmail(input.email));
  const valid = user?.passwordHash ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !valid) throw new Error("E-mail ou senha inválidos.");
  await db.updateLastSignedIn(user.id);
  return db.getUserById(user.id);
}

export async function requestPasswordReset(email: string, baseUrl: string) {
  const user = await db.getUserByEmail(normalizeEmail(email));
  if (!user) return;

  const token = randomBytes(32).toString("hex");
  await db.createPasswordResetToken({
    userId: user.id,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });
  await sendPasswordResetEmail({
    email: user.email!,
    name: user.name ?? "",
    resetUrl: `${baseUrl}/redefinir-senha?token=${encodeURIComponent(token)}`,
  });
}

export async function resetPassword(input: { token: string; password: string }) {
  validatePassword(input.password);
  const resetToken = await db.getPasswordResetToken(hashResetToken(input.token));
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() <= Date.now()) {
    throw new Error("O link de recuperação é inválido ou expirou.");
  }

  const passwordHash = await bcrypt.hash(input.password, PASSWORD_ROUNDS);
  await db.updateUserPassword(resetToken.userId, passwordHash);
  await db.markPasswordResetTokenUsed(resetToken.id);
}

export function publicUser(user: Awaited<ReturnType<typeof db.getUserById>> | null) {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}
