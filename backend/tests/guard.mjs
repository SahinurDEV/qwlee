// Loaded before every test file (see "test" in package.json). The tests
// create orders, users and messages, so refuse to run unless the API under
// test says it is a throw-away test instance (TEST_MODE=true on the
// backend). Set ALLOW_NON_TEST_API=true to override on purpose.
const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
if (process.env.ALLOW_NON_TEST_API !== "true") {
  let ok = false;
  try {
    const r = await fetch(`${API}/health`);
    ok = (await r.json())?.testMode === true;
  } catch (e) {
    console.error(`guard: cannot reach ${API}/health (${e.message})`);
  }
  if (!ok) {
    console.error(
      `guard: ${API} is not a test instance (TEST_MODE is not "true"). ` +
        "Refusing to run tests that write data. Use scripts/test-isolated.sh."
    );
    process.exit(1);
  }
}
