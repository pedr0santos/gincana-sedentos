import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateAdminUserRole } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const getDbMock = vi.hoisted(() => vi.fn());
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: getDbMock };
});

function createContext(role: "user" | "admin"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-test",
      email: "admin@example.com",
      name: "Admin Test",
      loginMethod: "password",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin.users", () => {
  beforeEach(() => getDbMock.mockReset());

  it("blocks regular users", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.admin.users({ role: "all" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("promotes a user and records the actor and transition", async () => {
    const updates: unknown[] = [];
    const auditRows: unknown[] = [];
    let selectCount = 0;
    const transaction = async (callback: (tx: typeof txDb) => Promise<unknown>) => callback(txDb);
    const txDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              selectCount += 1;
              return selectCount === 1
                ? [{ id: 2, openId: "user-2", role: "user" }]
                : [{ id: 1 }, { id: 2 }];
            },
          }),
        }),
      }),
      update: () => ({
        set: (values: unknown) => ({
          where: async () => {
            updates.push(values);
          },
        }),
      }),
      insert: () => ({
        values: async (values: unknown) => {
          auditRows.push(values);
        },
      }),
    };
    const db = { transaction };
    getDbMock.mockResolvedValue(db);

    const result = await updateAdminUserRole(
      { actorUserId: 1, targetUserId: 2, role: "admin", ownerOpenId: "owner-test" },
      db as never,
    );

    expect(result).toEqual({ changed: true, role: "admin" });
    expect(updates).toEqual([{ role: "admin" }]);
    expect(auditRows).toEqual([
      { targetUserId: 2, actorUserId: 1, previousRole: "user", nextRole: "admin" },
    ]);
  });
});
