import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const getDbMock = vi.hoisted(() => vi.fn());
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: getDbMock };
});

type DbStub = {
  select: () => { from: () => { where: () => { limit: () => Promise<unknown[]> } } };
  insert: () => { values: (values: unknown) => Promise<Array<{ insertId: number }>> };
};

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-test",
      email: "admin@example.com",
      name: "Admin Test",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function questionInput(position = 2) {
  return {
    roundId: 30001,
    position,
    prompt: "Qual é a capital do Brasil?",
    points: 25,
    options: [
      { label: "Brasília", isCorrect: true },
      { label: "São Paulo", isCorrect: false },
    ],
  };
}

describe("admin.saveQuestion", () => {
  beforeEach(() => getDbMock.mockReset());

  it("returns a clear error when the position is already occupied", async () => {
    const db: DbStub = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [{ id: 30001 }] }),
        }),
      }),
      insert: () => ({ values: async () => [{ insertId: 99 }] }),
    };
    getDbMock.mockResolvedValue(db);

    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.admin.saveQuestion(questionInput(1))).rejects.toThrow(
      "A posição 1 já está ocupada nesta rodada",
    );
  });

  it("persists the requested point value and alternatives for a free position", async () => {
    const insertedValues: unknown[] = [];
    let selectCount = 0;
    const db: DbStub = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              selectCount += 1;
              return selectCount === 1 ? [{ id: 30001 }] : [];
            },
          }),
        }),
      }),
      insert: () => ({
        values: async (values: unknown) => {
          insertedValues.push(values);
          return [{ insertId: 91001 }];
        },
      }),
    };
    getDbMock.mockResolvedValue(db);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.admin.saveQuestion(questionInput(2));

    expect(result).toEqual({ id: 91001 });
    expect(insertedValues).toHaveLength(2);
    expect(insertedValues[0]).toMatchObject({ roundId: 30001, position: 2, points: 25 });
    expect(insertedValues[1]).toEqual([
      { questionId: 91001, position: 1, label: "Brasília", isCorrect: true },
      { questionId: 91001, position: 2, label: "São Paulo", isCorrect: false },
    ]);
  });
});
