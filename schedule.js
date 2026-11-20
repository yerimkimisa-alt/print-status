// 일정 기준과 신호등 판정. 기준: 홍보인쇄물 제작관리규정 v1.3안 별표 2·3(도어), 제19조(신호등).
// 브라우저와 node(test.js) 양쪽에서 씀.

// ponytail: 공휴일 직접 입력. 대체공휴일·선거일은 [확인 필요], 매년 갱신하거나 공휴일 API로 바꿀 것.
const HOLIDAYS = new Set([
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-03-02", "2026-05-05", "2026-05-25",
  "2026-06-03", "2026-08-17", "2026-09-24", "2026-09-25", "2026-10-05", "2026-10-09", "2026-12-25",
  "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-01", "2027-05-05", "2027-05-13", "2027-08-16",
  "2027-09-14", "2027-09-15", "2027-09-16", "2027-10-04", "2027-10-11", "2027-12-27",
]);

const DEPTS = ["R&D", "영업", "승인협의체", "그래픽디자인팀"];

// week: D-Day 기준 주 (음수 = D-Day 전). kind: submit(부서 제출) / gate(★ 승인) / task(그래픽디자인팀 업무)
const DOOR = [
  { step: "-", title: "제작 요청 (출시 계획 통보)", dept: "R&D", week: -26, kind: "submit", form: "현황시스템" },
  { step: "-", title: "제작 요청 (배포 수요 통보)", dept: "영업", week: -26, kind: "submit", form: "현황시스템" },
  { step: "1", title: "킥오프 · 역산 일정표 확정", dept: "그래픽디자인팀", week: -24, kind: "task", form: "일정표, 회의록" },
  { step: "1", title: "필요 수량·배포처 확정", dept: "영업", week: -24, kind: "submit", form: "별지 2" },
  { step: "2", title: "라인업 확정 목록 (신규·단종·유지)", dept: "R&D", week: -21, kind: "submit", form: "품목 마스터" },
  { step: "2", title: "제품정보서", dept: "R&D", week: -21, kind: "submit", form: "별지 1" },
  { step: "2", title: "품목 마스터 제출 (품번·규격·성능·인증번호)", dept: "R&D", week: -21, kind: "submit", form: "엑셀" },
  { step: "2", title: "인증서·성적서 원본 PDF", dept: "R&D", week: -21, kind: "submit", form: "PDF" },
  { step: "2", title: "도면·구조도 CAD 원본", dept: "R&D", week: -21, kind: "submit", form: "CAD" },
  { step: "2", title: "제품군 간 컬러·품번 대응표 제출", dept: "R&D", week: -21, kind: "submit", form: "엑셀" },
  { step: "2", title: "영업 요구사항서", dept: "영업", week: -21, kind: "submit", form: "별지 2" },
  { step: "2", title: "운영 색상·재고 운영 품목·리드타임", dept: "영업", week: -21, kind: "submit", form: "품목 마스터" },
  { step: "2", title: "타사·협력사 로고·이미지·인증서 사용 승인", dept: "영업", week: -21, kind: "submit", form: "승인 회신" },
  { step: "3", title: "품목 마스터·컬러 대응표 확정", dept: "R&D", week: -18, kind: "submit", form: "엑셀" },
  { step: "3", title: "문안 사실 확인 회신", dept: "R&D", week: -18, kind: "submit", form: "현황시스템" },
  { step: "3", title: "문안 메시지 검토 회신", dept: "영업", week: -18, kind: "submit", form: "현황시스템" },
  { step: "3", title: "★ 기획·문안 확정", dept: "승인협의체", week: -18, kind: "gate", form: "페이지 구성안, 문안" },
  { step: "0", title: "선행 3D 착수 (늦어도)", dept: "그래픽디자인팀", week: -18, kind: "task", form: "와이드컷 3D 발주" },
  { step: "4", title: "3D 자산 결정 · 1차 발주", dept: "그래픽디자인팀", week: -17, kind: "task", form: "컷 리스트, 발주서" },
  { step: "5", title: "★ 20p 템플릿 승인", dept: "승인협의체", week: -14, kind: "gate", form: "20p 템플릿" },
  { step: "6", title: "전체 작업 완료", dept: "그래픽디자인팀", week: -8, kind: "task", form: "전체 시안" },
  { step: "6-1", title: "교차 검수 완료", dept: "그래픽디자인팀", week: -6, kind: "task", form: "별지 4" },
  { step: "7", title: "컬러 테스트용 실물 샘플", dept: "R&D", week: -7, kind: "submit", form: "실물" },
  { step: "7", title: "컬러 테스트 완료 (1~2회)", dept: "그래픽디자인팀", week: -5, kind: "task", form: "승인 교정지" },
  { step: "8", title: "인쇄·납품 (D-Day)", dept: "그래픽디자인팀", week: 0, kind: "task", form: "인쇄물" },
  { step: "9", title: "3D 자산 등록", dept: "그래픽디자인팀", week: 2, kind: "task", form: "라이브러리 항목" },
];

const TEMPLATES = { 도어: { weeks: 24, items: DOOR } };

// 날짜는 모두 "YYYY-MM-DD" 문자열로 다룸 (시간대 문제 회피)
const toDate = (s) => new Date(s + "T00:00:00Z");
const fmt = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => fmt(new Date(toDate(s).getTime() + n * 86400000));
const isBizDay = (s) => { const w = toDate(s).getUTCDay(); return w !== 0 && w !== 6 && !HOLIDAYS.has(s); };

// 기한이 휴일이면 직전 영업일로 당김
function deadlineOf(dDay, week) {
  let d = addDays(dDay, week * 7);
  while (!isBizDay(d)) d = addDays(d, -1);
  return d;
}

// a 다음 날부터 b까지 영업일 수 (a < b 일 때 양수, a >= b 이면 0)
function bizDaysBetween(a, b) {
  let n = 0;
  for (let d = addDays(a, 1); d <= b; d = addDays(d, 1)) if (isBizDay(d)) n++;
  return n;
}

// 제19조: 파랑=완료, 노랑=기한까지 3영업일 이하, 빨강=기한 경과, 빨강 3영업일 이상=본부장 보고
function signal(item, today) {
  if (item.status === "accepted" || item.status === "submitted") return { color: "blue", left: 0, over: 0 };
  if (today > item.deadline) {
    const over = bizDaysBetween(item.deadline, today);
    return { color: "red", left: 0, over, escalate: over >= 3 };
  }
  const left = bizDaysBetween(today, item.deadline);
  return { color: left <= 3 ? "yellow" : "green", left, over: 0 };
}

const RANK = { red: 3, yellow: 2, green: 1, blue: 0 };
const worst = (colors) => colors.reduce((a, c) => (RANK[c] > RANK[a] ? c : a), "blue");

function makeProject(name, type, dDay) {
  const t = TEMPLATES[type];
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, type, dDay,
    items: t.items.map((it, i) => ({ ...it, id: i, deadline: deadlineOf(dDay, it.week), status: "open", log: [] })),
  };
}

// 기한이 지났거나 이미 제출한 항목 중 기한 안에 제출(접수 포함)한 비율. 보완 요청 후 미보완은 미준수.
// 오늘이 기한인 미제출 항목은 아직 판정하지 않음.
function compliance(projects, today, dept) {
  let due = 0, ok = 0;
  for (const p of projects) for (const it of p.items) {
    const done = it.status === "submitted" || it.status === "accepted";
    if (it.dept !== dept || (!done && it.deadline >= today)) continue;
    due++;
    if (done && it.submittedAt <= it.deadline) ok++;
  }
  return { due, ok, rate: due ? Math.round((ok / due) * 100) : null };
}

if (typeof module !== "undefined") {
  module.exports = { HOLIDAYS, DEPTS, TEMPLATES, deadlineOf, bizDaysBetween, signal, worst, makeProject, compliance, addDays, isBizDay };
}
