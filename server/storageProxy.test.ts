import type { Express, Request, RequestHandler, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getProfileById: vi.fn() }));
vi.mock("./_core/context", () => ({ createContext: vi.fn() }));
vi.mock("./storage", () => ({ storageGetSignedUrl: vi.fn() }));

import { getProfileById } from "./db";
import { createContext, type TrpcContext } from "./_core/context";
import { registerStorageProxy } from "./_core/storageProxy";
import { storageGetSignedUrl } from "./storage";

const profile = {
  id: 10, userId: 99, teamId: 1, fullName: "Nome privado", nickname: "Jogador",
  contact: "privado", avatarUrl: null, avatarKey: "gincana/avatar/10/photo.png",
  isBlocked: false, joinedAt: new Date(), updatedAt: new Date(),
};

async function requestAvatar(participantId = "10", path = "/api/media/avatar/:participantId") {
  const handlers = new Map<string, RequestHandler>();
  const app = { get: (route: string, handler: RequestHandler) => handlers.set(route, handler) } as unknown as Express;
  registerStorageProxy(app);
  const response = { set: vi.fn(), status: vi.fn(), send: vi.fn(), redirect: vi.fn() };
  response.status.mockReturnValue(response);
  response.set.mockReturnValue(response);
  await handlers.get(path)!({ params: { participantId, 0: profile.avatarKey } } as unknown as Request, response as unknown as Response, vi.fn());
  return response;
}

describe("acesso autenticado a fotos dos participantes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createContext).mockResolvedValue({ user: { id: 42, role: "user" } } as TrpcContext);
    vi.mocked(getProfileById).mockResolvedValue(profile);
    vi.mocked(storageGetSignedUrl).mockResolvedValue("https://storage.example/signed-photo");
  });

  it("permite que um participante logado veja a foto de outro sem cache publico", async () => {
    const response = await requestAvatar();
    expect(getProfileById).toHaveBeenCalledWith(10);
    expect(storageGetSignedUrl).toHaveBeenCalledWith(profile.avatarKey);
    expect(response.set).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(response.redirect).toHaveBeenCalledWith(307, "https://storage.example/signed-photo");
  });

  it("recusa visitante antes de consultar o perfil ou armazenamento", async () => {
    vi.mocked(createContext).mockResolvedValue({ user: null } as TrpcContext);
    const response = await requestAvatar();
    expect(response.status).toHaveBeenCalledWith(401);
    expect(getProfileById).not.toHaveBeenCalled();
    expect(storageGetSignedUrl).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "1.5", "invalido"])("recusa identificador %s", async participantId => {
    const response = await requestAvatar(participantId);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(getProfileById).not.toHaveBeenCalled();
  });

  it("retorna 404 para perfil inexistente", async () => {
    vi.mocked(getProfileById).mockResolvedValue(undefined);
    expect((await requestAvatar()).status).toHaveBeenCalledWith(404);
    expect(storageGetSignedUrl).not.toHaveBeenCalled();
  });

  it("retorna 404 para participante sem foto", async () => {
    vi.mocked(getProfileById).mockResolvedValue({ ...profile, avatarKey: null });
    expect((await requestAvatar()).status).toHaveBeenCalledWith(404);
    expect(storageGetSignedUrl).not.toHaveBeenCalled();
  });

  it("trata falha do armazenamento sem expor a chave", async () => {
    vi.mocked(storageGetSignedUrl).mockRejectedValue(new Error("private-storage-error"));
    const response = await requestAvatar();
    expect(response.status).toHaveBeenCalledWith(502);
    expect(response.send).toHaveBeenCalledWith("Storage backend error");
  });

  it("mantem bloqueado o acesso pelo proxy publico railway", async () => {
    const response = await requestAvatar("10", "/railway-storage/*");
    expect(response.status).toHaveBeenCalledWith(404);
    expect(storageGetSignedUrl).not.toHaveBeenCalled();
  });
});