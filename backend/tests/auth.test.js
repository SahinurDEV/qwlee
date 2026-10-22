// Password-reset flow against a running stack with the bundled Mailpit.
//   API_URL=http://localhost:7171 MAILPIT_URL=http://localhost:8025 npm test
const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const MAILPIT = (process.env.MAILPIT_URL || "http://localhost:8025").replace(/\/+$/, "");
const EMAIL = "james.oconnor@example.com";
const PASSWORD = "Seller123!";

const post = async (path, body) => {
  const res = await fetch(`${API}/v1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

const mailpitUp = async () => {
  try { return (await fetch(`${MAILPIT}/livez`)).ok; } catch { return false; }
};

// Latest reset code mailed to EMAIL.
const latestCode = async () => {
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL} subject:"Reset"`)}&limit=1`)).json();
    const id = list.messages?.[0]?.ID;
    if (id) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
      const m = String(msg.Text || msg.HTML || "").match(/\b(\d{6})\b/);
      if (m) return { id, code: m[1] };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("reset email not received");
};

const clearInbox = () => fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });

test("password reset: email delivered, code works once, wrong guesses lock it", async (t) => {
  if (!(await mailpitUp())) return t.skip("Mailpit not reachable");

  await clearInbox();
  let r = await post("/auth/forgot-password", { email: EMAIL });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  let { code } = await latestCode();

  // 5 wrong guesses burn the code; the right one then fails.
  for (let i = 0; i < 5; i++) {
    const wrong = String((Number(code) + 1 + i) % 900000 + 100000);
    r = await post("/auth/reset-password", { email: EMAIL, password: "Another123!", oneTimeCode: wrong });
    assert.equal(r.status, 400);
  }
  r = await post("/auth/reset-password", { email: EMAIL, password: "Another123!", oneTimeCode: code });
  assert.equal(r.status, 400, "code must be locked after 5 wrong attempts");

  // Fresh code resets the password, then put it back.
  for (const next of ["Another123!", PASSWORD]) {
    await clearInbox();
    r = await post("/auth/forgot-password", { email: EMAIL });
    assert.equal(r.status, 200);
    ({ code } = await latestCode());
    r = await post("/auth/reset-password", { email: EMAIL, password: next, oneTimeCode: code });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    r = await post("/auth/reset-password", { email: EMAIL, password: next + "x", oneTimeCode: code });
    assert.equal(r.status, 400, "code is single-use");
  }
  r = await post("/auth/login", { email: EMAIL, password: PASSWORD });
  assert.equal(r.status, 200);
});

test("login does not reveal whether an email exists or is unverified", async () => {
  const email = `enum-${Date.now()}@example.com`;
  const reg = await post("/auth/register", { email, password: "Passw0rd!x", fullName: "Enum Test" });
  assert.ok([200, 201].includes(reg.status), `register ${reg.status}`);
  const unknown = await post("/auth/login", { email: `nobody-${Date.now()}@example.com`, password: "Wrong123!x" });
  const unverifiedWrong = await post("/auth/login", { email, password: "Wrong123!x" });
  const knownWrong = await post("/auth/login", { email: EMAIL, password: "Wrong123!x" });
  for (const r of [unknown, unverifiedWrong, knownWrong]) {
    assert.equal(r.status, 401);
    assert.equal(r.json.message, "Incorrect email or password");
  }
  const unverifiedRight = await post("/auth/login", { email, password: "Passw0rd!x" });
  assert.equal(unverifiedRight.status, 400, "correct password still learns it needs verification");
});
