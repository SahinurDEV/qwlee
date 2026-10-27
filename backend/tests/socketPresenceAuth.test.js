const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

function mockSocket({ verifiedUserId } = {}) {
  const emitted = [];
  const joined = [];
  const handlers = {};
  const socket = {
    verifiedUserId,
    userId: undefined,
    on(event, fn) { handlers[event] = fn; },
    emit(event, payload) { emitted.push({ event, payload }); },
    join(id) { joined.push(id); },
    broadcast: { emit() {} },
  };
  return { socket, handlers, emitted, joined };
}

describe("socket user/connect auth", () => {
  before(() => {
    require.cache[require.resolve("../src/socket/presence")] = {
      id: require.resolve("../src/socket/presence"),
      filename: require.resolve("../src/socket/presence"),
      loaded: true,
      exports: { addConnection: async () => ({}) },
    };
  });

  it("refuses bind without verifiedUserId", async () => {
    delete require.cache[require.resolve("../src/socket/events/user")];
    const userEvents = require("../src/socket/events/user");
    const { socket, handlers, emitted, joined } = mockSocket();
    userEvents(socket);
    await handlers["user/connect"]({ userId: "507f1f77bcf86cd799439011" });
    assert.equal(joined.length, 0);
    assert.ok(emitted.some((e) => e.event === "auth/required"));
  });

  it("binds only the verified userId (ignores client id)", async () => {
    delete require.cache[require.resolve("../src/socket/events/user")];
    const userEvents = require("../src/socket/events/user");
    const vid = "507f1f77bcf86cd799439011";
    const { socket, handlers, joined } = mockSocket({ verifiedUserId: vid });
    userEvents(socket);
    await handlers["user/connect"]({ userId: "507f191e810c19729de860ea" });
    assert.deepEqual(joined, [vid]);
    assert.equal(socket.userId, vid);
  });
});
