// 실행: node test.js  (신호등·기한 계산 자체 검사)
const assert = require("assert");
const S = require("./schedule.js");

// 기한: D-Day 2027-04-16(금) 기준 D-21주 = 2026-11-20(금)
assert.strictEqual(S.deadlineOf("2027-04-16", -21), "2026-11-20");
// 휴일이면 직전 영업일: 2026-10-03(토) → 10-02(금)
assert.strictEqual(S.deadlineOf("2026-10-03", 0), "2026-10-02");

// 영업일 수: 금→다음 주 수요일 = 3영업일 (월·화·수)
assert.strictEqual(S.bizDaysBetween("2026-11-20", "2026-11-25"), 3);

const it = (deadline, status = "open") => ({ deadline, status });
assert.strictEqual(S.signal(it("2026-11-26"), "2026-11-20").color, "green");   // 4영업일 남음
assert.strictEqual(S.signal(it("2026-11-25"), "2026-11-20").color, "yellow");  // 3영업일 남음
assert.strictEqual(S.signal(it("2026-11-20"), "2026-11-20").color, "yellow");  // 당일
const r = S.signal(it("2026-11-20"), "2026-11-25");
assert.deepStrictEqual([r.color, r.over, r.escalate], ["red", 3, true]);       // 3영업일 경과 → 보고
assert.strictEqual(S.signal(it("2026-11-20"), "2026-11-24").escalate, false);
assert.strictEqual(S.signal(it("2026-11-01", "submitted"), "2026-11-25").color, "blue");
assert.strictEqual(S.signal(it("2026-11-01", "returned"), "2026-11-25").color, "red"); // 보완 요청은 원 기한 기준

assert.strictEqual(S.worst(["blue", "green", "yellow"]), "yellow");
assert.strictEqual(S.worst(["green", "red"]), "red");

// 준수율: 기한 지난 2건 중 기한 내 제출 1건
const p = { items: [
  { dept: "R&D", deadline: "2026-11-10", status: "accepted", submittedAt: "2026-11-09" },
  { dept: "R&D", deadline: "2026-11-12", status: "submitted", submittedAt: "2026-11-15" },
  { dept: "R&D", deadline: "2026-12-30", status: "open" },
  { dept: "R&D", deadline: "2026-11-20", status: "open" },                           // 오늘 마감: 판정 안 함
  { dept: "R&D", deadline: "2026-11-30", status: "submitted", submittedAt: "2026-11-19" }, // 미리 제출: 준수
] };
assert.deepStrictEqual(S.compliance([p], "2026-11-20", "R&D"), { due: 3, ok: 2, rate: 67 });

// 도어 템플릿: 킥오프 D-24주
const proj = S.makeProject("t", "도어", "2027-04-16");
assert.strictEqual(proj.items.find((x) => x.title.startsWith("킥오프")).deadline, "2026-10-30");
console.log("ok");
