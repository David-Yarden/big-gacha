// Smoke tests against the running API (npm run dev must be running).
// Skipped automatically when the server is not reachable.
const { test, before } = require("node:test");
const assert = require("node:assert/strict");

const API = process.env.API_URL || "http://localhost:5000/api";

const RESOURCES = {
  genshin: ["characters", "weapons", "artifacts", "materials"],
  hsr: ["characters", "lightcones", "relics", "materials"],
  wuwa: ["characters", "weapons", "echoes", "echosets"],
};

let up = false;
before(async () => {
  try {
    const r = await fetch(`${API}/health`);
    up = r.ok;
  } catch {
    up = false;
  }
});

async function get(path) {
  const r = await fetch(`${API}${path}`);
  return { status: r.status, body: await r.json() };
}

test("API root answers", async (t) => {
  if (!up) return t.skip("server not running");
  const { status, body } = await get("/");
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.games));
});

for (const [game, resources] of Object.entries(RESOURCES)) {
  for (const resource of resources) {
    test(`${game}/${resource}: list then detail`, async (t) => {
      if (!up) return t.skip("server not running");
      const list = await get(`/${game}/${resource}?limit=2`);
      assert.equal(list.status, 200);
      assert.equal(list.body.success, true);
      if (list.body.total === 0) return t.skip(`no ${game} ${resource} in the database`);
      const name = list.body.data[0].name;
      const detail = await get(`/${game}/${resource}/${encodeURIComponent(name)}`);
      assert.equal(detail.status, 200);
      assert.equal(detail.body.data.name, name);
    });
  }
}

test("operator injection in the query string is ignored", async (t) => {
  if (!up) return t.skip("server not running");
  const all = await get("/genshin/characters?limit=1");
  const injected = await get("/genshin/characters?limit=1&name[$regex]=^A");
  assert.equal(injected.body.total, all.body.total);
});

test("special characters in a search do not crash", async (t) => {
  if (!up) return t.skip("server not running");
  const { status } = await get(`/genshin/characters?search=${encodeURIComponent("(((")}`);
  assert.equal(status, 200);
});

test("unknown game is rejected", async (t) => {
  if (!up) return t.skip("server not running");
  const { status } = await get("/nope/characters");
  assert.equal(status, 400);
});
