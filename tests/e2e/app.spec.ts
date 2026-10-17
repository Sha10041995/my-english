import { expect, test, type Page } from "@playwright/test";

async function onboard(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("button", { name: /O‘zbekcha/ }).click();
  await page.getByRole("button", { name: "Davom etish" }).click(); // goal
  await page.getByRole("button", { name: "Davom etish" }).click(); // minutes
  await page.getByRole("button", { name: "Davom etish" }).click(); // interests
  await page.getByRole("button", { name: "Davom etish" }).click(); // exam
  await page.getByLabel(/Ismingiz/).fill("Test");
  await page.getByRole("button", { name: "Daraja aniqlashni boshlash" }).click();
  await expect(page).toHaveURL(/\/placement/);
}

async function runPlacement(page: Page) {
  await page.getByRole("button", { name: "Boshlash", exact: true }).click();
  for (let i = 0; i < 20; i++) {
    const radios = page.getByRole("radio");
    if (!(await radios.first().isVisible().catch(() => false))) break;
    await radios.first().click();
    await page.getByRole("button", { name: "Keyingi" }).click();
  }
  // writing sample
  await page.locator("#pw").fill("My name is Aziz. I am from Tashkent. I want to learn English because I like travel.");
  await page.getByRole("button", { name: "Keyingi" }).click();
  await page.getByRole("button", { name: /natijani ko'rish/i }).first().click();
}

test("onboarding, adaptive placement with a provisional result, dashboard", async ({ page }) => {
  await onboard(page);
  await runPlacement(page);
  await expect(page.getByText("Taxminiy natija").first()).toBeVisible();
  await expect(page.getByText(/rasmiy CEFR natijasi emas/)).toBeVisible();
  await expect(page.getByText("baholanmadi").first()).toBeVisible(); // speaking not assessed
  await page.getByRole("link", { name: "Shaxsiy rejani ko'rish" }).click();
  await expect(page.getByRole("heading", { name: "Salom, Test!" })).toBeVisible();
  await expect(page.getByText("Bugungi reja")).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("linguaquest:state:v1")!));
  expect(stored.placementDone).toBe(true);
  expect(stored.assessments[0].type).toBe("placement");
  expect(stored.assessments[0].responses.length).toBeGreaterThan(5);
});

test("reading activity gives feedback, updates progress and tracks vocabulary honestly", async ({ page }) => {
  await onboard(page);
  await page.goto("/reading?a=read-a2-market");
  await expect(page.getByRole("heading", { name: "A new phone" })).toBeVisible();
  await page.waitForTimeout(21_000); // XP is withheld for rushed attempts
  await page.getByRole("button", { name: "Savollarga o'tish" }).click();
  await page.getByRole("radio", { name: "It was too expensive." }).click();
  await page.getByRole("button", { name: "Tekshirish" }).click();
  await expect(page.getByText("To'g'ri!")).toBeVisible();
  await page.getByRole("button", { name: "Keyingi" }).click();
  await page.getByRole("radio", { name: "Choosing a phone that fits your budget" }).click();
  await page.getByRole("button", { name: "Tekshirish" }).click();
  await page.getByRole("button", { name: "Keyingi" }).click();
  await page.getByRole("radio", { name: "He did not have enough money for it." }).click();
  await page.getByRole("button", { name: "Tekshirish" }).click();
  await page.getByRole("button", { name: "Yakunlash" }).click();
  await expect(page.getByText(/Natija: 100%/)).toBeVisible();
  await expect(page.getByText(/hali o'zlashtirilmagan/)).toBeVisible();

  await page.goto("/vocabulary");
  await page.getByRole("button", { name: /afford/ }).click();
  await expect(page.getByRole("listitem").getByText("Uchragan").first()).toBeVisible(); // only encountered, not "learned"
  await page.goto("/progress");
  await expect(page.getByText("reading").first()).toBeVisible();
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("linguaquest:state:v1")!));
  expect(st.skills.reading.evidence).toBe(1);
  expect(st.xp).toBeGreaterThan(0);
  expect(st.vocab.afford.recognition).toBe("encountered");
});

test("writing: rule-based feedback is labelled, and a phrase used independently is tracked", async ({ page }) => {
  await onboard(page);
  await page.goto("/writing?a=write-b1-opinion");
  await page.waitForTimeout(1000);
  const text =
    "In my opinion, learning with a teacher is better because she help me. However, I can't afford to pay every week, so I am agree that apps are useful. On the other hand, a teacher can correct my mistakes quickly and explain grammar clearly.";
  await page.locator("#writing-text").fill(text);
  await page.waitForTimeout(46_000); // minimum duration for writing XP
  await page.getByRole("button", { name: "Fikr-mulohaza olish" }).click();
  await expect(page.getByText("Demo: qoidaga asoslangan, AI emas").first()).toBeVisible();
  await expect(page.getByText("I agree").first()).toBeVisible(); // correction for "I am agree"
  await expect(page.getByText(/rasmiy imtihon bahosi emas/)).toBeVisible();
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("linguaquest:state:v1")!));
  expect(st.vocab.afford.productive).toBe("independent");
  expect(st.errors["i-am-agree"]).toBeGreaterThan(0);
  await page.goto("/vocabulary");
  await page.getByRole("button", { name: /afford/ }).click();
  await expect(page.getByRole("listitem").getByText("Mustaqil ishlatildi").first()).toBeVisible();
});

test("speaking: text fallback conversation works without microphone or AI keys", async ({ page }) => {
  await onboard(page);
  await page.goto("/speaking?a=speak-a2-routine");
  await expect(page.getByText(/talaffuz ballari berilmaydi/i)).toBeVisible();
  await page.locator("#speak-input").fill("I usually wake up at six. I go to work by bus because it is cheap.");
  await page.getByRole("button", { name: "Yuborish" }).click();
  await expect(page.getByText("Demo: qoidaga asoslangan, AI emas").first()).toBeVisible();
  await page.locator("#speak-input").fill("In the evening I often read a book and she go to sleep early.");
  await page.getByRole("button", { name: "Yuborish" }).click();
  await expect(page.getByRole("button", { name: /Suhbatni yakunlash \(2\/2\)/ })).toBeEnabled();
});

test("responsive navigation on a phone-sized viewport", async ({ page }) => {
  await onboard(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Lug'at" })).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("link", { name: "Lug'at" }).click();
  await expect(page).toHaveURL(/\/vocabulary/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("every main nav destination renders", async ({ page }) => {
  await onboard(page);
  for (const path of ["/", "/learn", "/speaking", "/reading", "/listening", "/writing", "/vocabulary", "/exam", "/progress", "/settings"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("main h1").first()).toBeVisible();
  }
});

test("API: validation, rate limiting and demo-mode labelling", async ({ request }) => {
  const bad = await request.post("/api/ai/tutor", { data: { activityId: "speak-a2-routine", learnerText: "" } });
  expect(bad.status()).toBe(400);
  const status = await (await request.get("/api/ai/status")).json();
  expect(status.llm).toBe("demo");
  expect(JSON.stringify(status)).not.toMatch(/key/i);
  const ok = await request.post("/api/ai/writing", { data: { activityId: "write-a1-me", text: "My name is Ali. I live in Tashkent. I like football." } });
  expect((await ok.json()).source).toBe("rule-based");
  const stt = await request.post("/api/speech/transcribe", { headers: { "x-audio-consent": "granted" }, multipart: { audio: { name: "a.webm", mimeType: "audio/webm", buffer: Buffer.alloc(2000) } } });
  expect(stt.status()).toBe(503);
  let limited = 0;
  for (let i = 0; i < 25; i++) {
    const r = await request.post("/api/ai/writing", { data: { activityId: "write-a1-me", text: "My name is Ali." } });
    if (r.status() === 429) limited++;
  }
  expect(limited).toBeGreaterThan(0);
});

test("authorization: other users' data and AI endpoints are unreachable without a valid session", async ({ request }) => {
  const base = "http://localhost:3101";
  for (const method of ["get", "put", "delete"] as const) {
    const r = await request[method](`${base}/api/sync`, { data: method === "put" ? { state: {} } : undefined });
    expect(r.status()).toBe(401);
  }
  const forged = await request.get(`${base}/api/sync`, { headers: { authorization: "Bearer forged.jwt.token" } });
  expect(forged.status()).toBe(401);
  const ai = await request.post(`${base}/api/ai/tutor`, { data: { activityId: "speak-a2-routine", learnerText: "hello" } });
  expect(ai.status()).toBe(401);
});

const stubServer = async (page: Page, transcribe: { status: number; body: unknown }) => {
  await page.route("**/api/ai/status", (r) => r.fulfill({ json: { llm: "demo", speechServer: true, accounts: false } }));
  await page.route("**/api/speech/transcribe", (r) => r.fulfill({ status: transcribe.status, json: transcribe.body }));
};

test("voice recording: consent is requested, refusal is honoured, allowed recording fills an editable transcript", async ({ page }) => {
  await onboard(page);
  await stubServer(page, { status: 200, body: { text: "I usually wake up at six.", pronunciationScore: null } });
  await page.goto("/speaking?a=speak-a2-routine");
  const record = page.getByRole("button", { name: /Yozib olish/ });
  await record.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/Talaffuz baholanmaydi/)).toBeVisible();
  // refuse: nothing recorded, record button disappears, typing still works
  await page.getByRole("button", { name: "Hozir emas" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(record).toHaveCount(0);
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem("linguaquest:state:v1")!))).profile.audioConsent).toBe("denied");
  await page.locator("#speak-input").fill("Typing still works.");
  await expect(page.getByRole("button", { name: "Yuborish" })).toBeEnabled();

  // re-enable asking in Settings, then allow and record
  await page.goto("/settings");
  await page.getByRole("button", { name: "Qayta so'rashga ruxsat berish" }).click();
  await page.goto("/speaking?a=speak-a2-routine");
  const reqPromise = page.waitForRequest("**/api/speech/transcribe");
  await page.getByRole("button", { name: /Yozib olish/ }).click();
  await page.getByRole("button", { name: "Yozishga ruxsat berish" }).click();
  await expect(page.getByRole("button", { name: /To'xtatish/ })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /To'xtatish/ }).click();
  const req = await reqPromise;
  expect(req.headers()["x-audio-consent"]).toBe("granted");
  await expect(page.locator("#speak-input")).toHaveValue("I usually wake up at six.");
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem("linguaquest:state:v1")!))).profile.audioConsent).toBe("granted");

  // withdraw consent
  await page.goto("/settings");
  await page.getByRole("button", { name: "Rozilikni qaytarib olish" }).click();
  await page.goto("/speaking?a=speak-a2-routine");
  await expect(page.getByRole("button", { name: /Yozib olish/ })).toHaveCount(0);
});

test("voice recording: blocked microphone gives an actionable message and typing remains available", async ({ page }) => {
  await onboard(page);
  await stubServer(page, { status: 200, body: { text: "x" } });
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
  });
  await page.goto("/speaking?a=speak-a2-routine");
  await page.getByRole("button", { name: /Yozib olish/ }).click();
  await page.getByRole("button", { name: "Yozishga ruxsat berish" }).click();
  await expect(page.getByText(/Mikrofonga ruxsat berilmadi/)).toBeVisible();
  await page.locator("#speak-input").fill("I can type instead.");
  await expect(page.getByRole("button", { name: "Yuborish" })).toBeEnabled();
});

test("voice recording: a speech-service outage is reported as not the learner's fault", async ({ page }) => {
  await onboard(page);
  await stubServer(page, { status: 503, body: { error: { code: "speech_unavailable", message: "x" } } });
  await page.goto("/speaking?a=speak-a2-routine");
  await page.getByRole("button", { name: /Yozib olish/ }).click();
  await page.getByRole("button", { name: "Yozishga ruxsat berish" }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /To'xtatish/ }).click();
  await expect(page.getByText(/sizning xatoingiz emas/)).toBeVisible();
  await page.locator("#speak-input").fill("Typed answer after outage.");
  await expect(page.getByRole("button", { name: "Yuborish" })).toBeEnabled();
});
