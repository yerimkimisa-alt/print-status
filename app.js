// 화면과 상태. 시제품: 데이터는 이 브라우저(localStorage)에만 저장됨. 다음 단계에서 Supabase로 바꿈.
const KEY = "printstatus.v2";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const realToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); // KST

const state = { projects: [], selected: null, today: realToday(), viewer: "전체", dept: "전체", status: "전체", q: "" };

function seed() {
  const p = makeProject("도어 카다로그 2027", "도어", "2027-04-16");
  const done = (title, at, status = "accepted") => {
    const it = p.items.find((x) => x.title.startsWith(title));
    Object.assign(it, { status, submittedAt: at, path: `\\\\fileserver\\인쇄물\\도어2027\\${it.title}` });
  };
  done("제작 요청 (출시", "2026-10-15");
  done("제작 요청 (배포", "2026-10-16");
  done("킥오프", "2026-10-30");
  done("제품정보서", "2026-11-18", "submitted");
  done("영업 요구사항서", "2026-11-19", "submitted");
  p.items.find((x) => x.title.startsWith("필요 수량")).nudges = ["2026-11-04", "2026-11-11"];
  p.owners = { "그래픽디자인팀": "그래픽디자인팀장" }; // 제7조: 나머지 부서는 담당자 지정 전
  return [p];
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.projects?.length) return s.projects; } catch {}
  return seed();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ projects: state.projects })); } catch {} }

const STATUS = { open: "미제출", submitted: "접수 대기", accepted: "완료", returned: "보완 요청" };
const SEG = { 전체: null, 미이행: "red", 임박: "yellow", 진행: "green", 완료: "blue" };
const weekLabel = (w) => (w === 0 ? "D-Day" : w < 0 ? `D${w}주` : `D+${w}주`);
const dayName = (s) => "일월화수목금토"[new Date(s + "T00:00:00Z").getUTCDay()];
const md = (s) => `${+s.slice(5, 7)}/${+s.slice(8)}(${dayName(s)})`;
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const current = () => state.projects.find((x) => x.id === state.selected);
const owner = (p, d) => p.owners?.[d] || "";
const who = (p, d) => owner(p, d) ? `<span class="who">${esc(owner(p, d))}</span>` : `<span class="who unset">담당자 미지정</span>`;

function analyze(p) {
  const rows = p.items.map((it) => ({ it, s: signal(it, state.today) }));
  const by = (c) => rows.filter((r) => r.s.color === c);
  const reds = by("red").sort((a, b) => b.s.over - a.s.over);
  const delay = reds.reduce((m, { it }) => Math.max(m, days(it.deadline, state.today)), 0);
  const all = DEPTS.map((d) => compliance([p], state.today, d)).reduce((a, c) => ({ due: a.due + c.due, ok: a.ok + c.ok }), { due: 0, ok: 0 });
  return { rows, reds, yellows: by("yellow").sort((a, b) => a.it.deadline.localeCompare(b.it.deadline)), delay,
    esc: reds.filter((r) => r.s.escalate).length, color: worst(rows.map((r) => r.s.color)),
    rate: all.due ? Math.round((all.ok / all.due) * 100) : null, all };
}

function btn(act, id, label, cls = "pri") { return `<button class="btn xs ${cls}" data-act="${act}" data-item="${id}">${label}</button>`; }
function actionsFor(p, it, g) {
  const v = state.viewer, out = [], mine = v === "전체" || v === it.dept, design = v === "전체" || v === "그래픽디자인팀";
  if (it.kind === "submit" && mine && (it.status === "open" || it.status === "returned")) out.push(btn("submit", it.id, "제출"));
  if (it.kind === "submit" && it.status === "submitted" && design) out.push(btn("accept", it.id, "접수"), btn("return", it.id, "보완", "sec"));
  if (it.kind === "gate" && it.status === "open" && (v === "전체" || v === "승인협의체")) out.push(btn("approve", it.id, "승인"));
  if (it.kind === "task" && it.status === "open" && design) out.push(btn("done", it.id, "완료"));
  if (g.color === "red" && it.dept !== "그래픽디자인팀" && design) out.push(btn("nudge", it.id, "독촉", "redline"));
  if (g.escalate && mine) out.push(btn("plan", it.id, "처리 계획", "sec"));
  return `<div class="acts">${out.join("")}</div>`;
}

// ── 부서별 일정 레인: 열 = 기한 날짜, 행 = 부서, 가운데 TODAY ──
const DEPT_FULL = { "R&D": "라이프스타일디자인센터", "영업": "영업본부", "승인협의체": "승인협의체 (3인 합의)", "그래픽디자인팀": "마케팅부 그래픽디자인팀" };
// 이 단계가 밀리면 바로 막히는 다음 단계 (규정 별표 1 순서)
const NEXT = { "-": "1 킥오프", "1": "2 자료 제출", "2": "3 ★ 기획·문안 확정", "3": "4 3D 자산 결정", "0": "6 전체 작업",
  "4": "5 ★ 20p 템플릿 승인", "5": "6 전체 작업", "6": "6-1 교차 검수", "6-1": "7 컬러 테스트", "7": "8 인쇄", "8": "배포·출시", "9": "" };

function dueText(s, it) {
  if (s.color === "blue") return it.submittedAt ? `${md(it.submittedAt)} 처리` : "완료";
  if (s.color === "red") return `${s.over}영업일 경과`;
  return s.left === 0 ? "오늘 마감" : `${s.left}영업일 남음`;
}

function tcard(p, it, s) {
  const step = it.step === "-" ? "제작 요청" : `${it.step}단계`;
  const owner = it.dept === "승인협의체" ? "3인 합의" : (p.owners?.[it.dept] || "");
  return `<div class="tcard st-${s.color}" tabindex="0">
    <div class="tc-top"><i class="dot ${s.color}"></i><span>${step}${it.kind === "gate" ? " · 승인" : ""}</span><b class="tc-due">${dueText(s, it)}</b></div>
    <div class="tc-title">${esc(it.title)}</div>
    <div class="tc-who">${owner ? esc(owner) : '<span class="unset">담당자 미지정</span>'}</div>
    <div class="tc-more">
      <dl>
        <dt>소속</dt><dd>${DEPT_FULL[it.dept]}</dd>
        <dt>기한</dt><dd>${md(it.deadline)} · ${weekLabel(it.week)}</dd>
        <dt>제출물</dt><dd>${esc(it.form)}</dd>
        <dt>상태</dt><dd>${STATUS[it.status]}${it.nudges?.length ? ` · 독촉 ${it.nudges.length}회` : ""}</dd>
        ${NEXT[it.step] && s.color !== "blue" ? `<dt>밀리면</dt><dd class="hit">${NEXT[it.step]} 지연</dd>` : ""}
        ${it.plan ? `<dt>처리 계획</dt><dd>${esc(it.plan)}</dd>` : s.escalate ? `<dt>처리 계획</dt><dd class="hit">미입력 · 본부장 보고 대상</dd>` : ""}
        ${it.path ? `<dt>경로</dt><dd class="path">${esc(it.path)}</dd>` : ""}
      </dl>
      ${actionsFor(p, it, s)}
    </div>
  </div>`;
}

function renderLanes(p, a) {
  const dates = [...new Set(p.items.map((it) => it.deadline))].sort();
  const t = state.today;
  const ti = dates.findIndex((d) => d >= t); // TODAY 는 이 날짜 열 앞에 놓임
  const cols = [];
  dates.forEach((d, i) => { if (i === (ti < 0 ? dates.length : ti)) cols.push({ today: true }); cols.push({ d }); });
  if (ti < 0) cols.push({ today: true });
  const lanes = DEPTS.filter((d) => state.dept === "전체" || d === state.dept);
  // 한 칸에 카드가 몰리면 두 장씩 옆으로 펼쳐 레인 높이를 카드 2장 안으로 묶음
  const per = (dept, d) => p.items.filter((it) => it.dept === dept && it.deadline === d).length;
  cols.forEach((c) => { if (!c.today) c.n = Math.max(1, Math.ceil(Math.max(...lanes.map((l) => per(l, c.d))) / 2)); });
  const tpl = cols.map((c) => (c.today ? "64px" : `${c.n * 204 + 8}px`)).join(" ");
  const head = cols.map((c, i) => c.today
    ? `<div class="ln-today" style="grid-column:${i + 2};grid-row:1/${lanes.length + 2}"><span>TODAY<br>${md(t)}</span></div>`
    : `<div class="ln-head ${c.d < t ? "past" : ""} ${c.d === t ? "is-today" : ""}" style="grid-column:${i + 2}" data-col="${i}">
        <b>${md(c.d)}</b><span>${c.d === t ? "오늘 마감" : days(t, c.d) > 0 ? `D-${days(t, c.d)}일` : `${-days(t, c.d)}일 지남`}</span></div>`).join("");
  const rows = lanes.map((dept, r) => {
    const reds = a.reds.filter((x) => x.it.dept === dept).length;
    const owner = dept === "승인협의체" ? "3인 합의" : (p.owners?.[dept] || "");
    const label = `<div class="ln-label" style="grid-row:${r + 2}"><b>${dept}</b><span>${DEPT_FULL[dept]}</span>
      <span class="${owner ? "" : "unset"}">${owner ? esc(owner) : "담당자 미지정"}</span>${reds ? `<em>미이행 ${reds}</em>` : ""}</div>`;
    const cells = cols.map((c, i) => c.today ? "" : `<div class="ln-cell ${c.d < t ? "past" : ""}" style="grid-column:${i + 2};grid-row:${r + 2};--n:${c.n}" data-col="${i}">
      ${a.rows.filter(({ it }) => it.dept === dept && it.deadline === c.d).map(({ it, s }) => tcard(p, it, s)).join("")}</div>`).join("");
    return label + cells;
  }).join("");
  return `<section class="panel lanes">
    <header><h2>부서별 제출 일정</h2><span class="hint">좌우로 끌어서 이동 · 카드에 마우스를 올리면 상세</span><span class="sp"></span>
      <button class="btn xs sec" id="to-today">TODAY로</button></header>
    <div class="ln-scroll" id="lnScroll"><div class="ln-grid" style="grid-template-columns:var(--lw,168px) ${tpl};grid-template-rows:auto repeat(${lanes.length},auto)">
      <div class="ln-corner"></div>${head}${rows}</div></div>
  </section>`;
}

// 드래그 이동 · 가운데 열 확대 · TODAY 가운데 맞춤
function setupLanes() {
  const el = $("#lnScroll"); if (!el) return;
  const lw = () => el.querySelector(".ln-corner").offsetWidth; // 왼쪽 부서 이름 칸 너비
  const center = () => {
    const m = el.querySelector(".ln-today"); if (!m) return;
    el.scrollLeft = m.offsetLeft + m.offsetWidth / 2 - (el.clientWidth + lw()) / 2;
  };
  if (state.lnLeft == null) center(); else el.scrollLeft = state.lnLeft;
  const focus = () => {
    const mid = el.scrollLeft + (el.clientWidth + lw()) / 2;
    el.querySelectorAll(".ln-head,.ln-cell").forEach((c) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) / 360;
      c.style.setProperty("--k", Math.max(0, 1 - d).toFixed(3)); // 가운데일수록 1
    });
  };
  let raf = 0;
  el.addEventListener("scroll", () => { state.lnLeft = el.scrollLeft; cancelAnimationFrame(raf); raf = requestAnimationFrame(focus); });
  focus();
  // 마우스 드래그로 좌우 이동 (터치·트랙패드는 기본 스크롤). 리스너는 매번 새로 그려지는 el 에만 붙임.
  let sx = 0, sl = 0, drag = false;
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || e.target.closest("button")) return;
    sx = e.clientX; sl = el.scrollLeft; drag = true;
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 4 && !el.classList.contains("dragging")) { el.classList.add("dragging"); el.setPointerCapture(e.pointerId); }
    if (el.classList.contains("dragging")) el.scrollLeft = sl - dx;
  });
  const end = () => { drag = false; el.classList.remove("dragging"); };
  el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  $("#to-today").onclick = () => { el.scrollTo({ left: 0, behavior: "instant" }); state.lnLeft = null; center(); focus(); };
}

function renderSide() {
  const p = current();
  const projects = state.projects.map((x) => {
    const a = analyze(x);
    return `<button class="nav ${x.id === state.selected ? "on" : ""}" data-id="${x.id}"><i class="dot ${a.color}"></i>
      <span class="grow">${esc(x.name)}</span><span class="cnt ${a.reds.length ? "red" : "zero"}">${a.reds.length}</span></button>`;
  }).join("");
  const depts = p ? ["전체", ...DEPTS].map((d) => {
    const n = d === "전체" ? analyze(p).reds.length : analyze(p).reds.filter((r) => r.it.dept === d).length;
    const sub = d === "전체" ? "" : d === "승인협의체" ? `<span class="who">3인 합의</span>`
      : `<span class="who ${owner(p, d) ? "" : "unset"}">${owner(p, d) ? esc(owner(p, d)) : "담당자 미지정"}</span>`;
    return `<button class="nav ${state.dept === d ? "on" : ""}" data-dept="${d}"><span class="grow">${d}${sub}</span>
      <span class="cnt ${n ? "red" : "zero"}">${n}</span></button>`;
  }).join("") : "";
  $("#side").innerHTML = `<h6>인쇄물</h6>${projects}
    <h6>부서별 미이행 <button class="btn xs sec" id="owners" style="float:right;margin-top:-4px">담당자 지정</button></h6>${depts}
    <div class="foot legend">
      <span><i class="dot red"></i>미이행: 기한 경과 · 3영업일 이상 본부장 보고</span>
      <span><i class="dot yellow"></i>임박: 3영업일 이내 마감</span>
      <span><i class="dot green"></i>진행: 4영업일 이상 남음</span>
      <span><i class="dot blue"></i>완료: 제출·접수·승인</span>
      <p style="margin:8px 0 0">시제품: 데이터는 이 브라우저에만 저장됨. 실시간 공유·메일 독촉은 DB 연결 후 동작.</p>
    </div>`;
}

function renderMain() {
  const p = current();
  if (!p) { $("#main").innerHTML = `<div class="empty">등록된 인쇄물이 없음</div>`; return; }
  const a = analyze(p), dleft = days(state.today, p.dDay);
  const badge = { red: "미이행 발생", yellow: "마감 임박", green: "정상 진행", blue: "완료" }[a.color];

  const shame = a.reds.length ? `<div class="tw"><table>
      <thead><tr><th>부서 · 담당자</th><th>미이행 항목</th><th>기한</th><th class="r">경과</th><th>처리 계획</th><th></th></tr></thead><tbody>
      ${a.reds.map(({ it, s }) => `<tr>
        <td class="nw"><div>${esc(it.dept)}</div>${who(p, it.dept)}</td>
        <td><div>${esc(it.title)}</div><div class="sub">${it.step === "-" ? "제작 요청" : `${esc(it.step)}단계`} · ${esc(it.form)}
          ${s.escalate ? ` <span class="tag esc">본부장 보고</span>` : ""}${it.nudges?.length ? ` <span class="tag nudge">독촉 ${it.nudges.length}회</span>` : ""}${it.status === "returned" ? ` <span class="tag ret">보완 요청</span>` : ""}</div></td>
        <td class="nw num">${md(it.deadline)}<div class="sub">${weekLabel(it.week)}</div></td>
        <td class="r nw"><span class="over num">${s.over}<small>영업일</small></span></td>
        <td>${it.plan ? `<span class="plan">${esc(it.plan)}</span>` : s.escalate ? `<span class="plan none">미입력</span>` : `<span class="sub">-</span>`}</td>
        <td>${actionsFor(p, it, s)}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">미이행 항목 없음</div>`;

  const ranking = DEPTS.map((d) => ({ d, ...compliance([p], state.today, d), red: a.reds.filter((r) => r.it.dept === d).length }))
    .sort((x, y) => (x.rate ?? 101) - (y.rate ?? 101) || y.red - x.red)
    .map((r, i) => `<li><span class="no">${i + 1}</span><span class="nm">${r.d}</span>
      <span class="bar"><i class="${r.rate !== null && r.rate < 80 ? "low" : ""}" style="width:${r.rate ?? 0}%"></i></span>
      <span class="pct num ${r.rate !== null && r.rate < 80 ? "low" : ""}">${r.rate === null ? "–" : r.rate + "%"}</span>
      <span class="meta num">기한 준수 ${r.ok}/${r.due} · 미이행 ${r.red}건</span></li>`).join("");

  const soon = a.yellows.length ? `<ul class="soon">${a.yellows.map(({ it, s }) => `<li><i class="dot yellow"></i>
      <span class="grow"><div>${esc(it.title)}</div><div class="sub">${esc(it.dept)} · ${owner(p, it.dept) ? esc(owner(p, it.dept)) : "담당자 미지정"}</div></span>
      <span class="d num">${s.left === 0 ? "오늘" : `${s.left}영업일`}</span></li>`).join("")}</ul>` : `<div class="empty">3영업일 안에 마감되는 항목 없음</div>`;

  const q = state.q.trim();
  const list = a.rows
    .filter(({ it, s }) => (state.dept === "전체" || it.dept === state.dept) && (!SEG[state.status] || s.color === SEG[state.status]) && (!q || (it.title + it.dept + it.form).includes(q)))
    .sort((x, y) => x.it.deadline.localeCompare(y.it.deadline))
    .map(({ it, s }) => {
      const left = s.color === "red" ? `<span class="over num">${s.over}<small>영업일 경과</small></span>` : s.color === "blue" ? "" : s.left === 0 ? `<b style="color:var(--yellow)">오늘 마감</b>` : `<span class="num">${s.left}영업일</span>`;
      return `<tr class="st-${s.color}">
        <td class="c"><i class="dot ${s.color}"></i></td>
        <td class="nw sub">${it.step === "-" ? "요청" : esc(it.step)}</td>
        <td><div>${esc(it.title)}</div><div class="sub">${esc(it.form)}${it.path ? ` · ${esc(it.path)}` : ""}${it.note ? ` · ${esc(it.note)}` : ""}</div></td>
        <td class="nw">${esc(it.dept)}</td>
        <td class="nw">${it.dept === "승인협의체" ? '<span class="sub">3인 합의</span>' : who(p, it.dept)}</td>
        <td class="nw num">${md(it.deadline)}<div class="sub">${weekLabel(it.week)}</div></td>
        <td class="nw">${STATUS[it.status]}</td>
        <td class="r nw">${left}</td>
        <td>${actionsFor(p, it, s)}</td></tr>`;
    }).join("");

  $("#main").innerHTML = `
    <div class="ph">
      <div><h1>${esc(p.name)}</h1>
        <div class="meta num">${p.type} 카다로그 · ${TEMPLATES[p.type].weeks}주 일정 · 납품(D-Day) ${p.dDay} · ${dleft >= 0 ? `D-${dleft}일` : `D+${-dleft}일`} · 기준일 ${state.today}</div></div>
      <span class="badge ${a.color}"><i class="dot ${a.color === "red" ? "" : a.color}" style="${a.color === "red" ? "background:#fff" : ""}"></i>${badge}</span>
    </div>
    <div class="kpis">
      <div class="kpi ${a.reds.length ? "alarm" : ""}"><div class="l">미이행</div><div class="v num">${a.reds.length}<small>건</small></div><div class="s">기한 경과 · 미제출</div></div>
      <div class="kpi ${a.esc ? "alarm" : ""}"><div class="l">본부장 보고 대상</div><div class="v num">${a.esc}<small>건</small></div><div class="s">3영업일 이상 경과</div></div>
      <div class="kpi ${a.yellows.length ? "warn" : ""}"><div class="l">3영업일 내 마감</div><div class="v num">${a.yellows.length}<small>건</small></div><div class="s">지금 제출해야 함</div></div>
      <div class="kpi ${a.delay ? "alarm" : ""}"><div class="l">예상 납품 지연</div><div class="v num">${a.delay}<small>일</small></div><div class="s">가장 오래 밀린 항목 기준</div></div>
      <div class="kpi"><div class="l">기한 준수율</div><div class="v num">${a.rate === null ? "–" : a.rate}<small>${a.rate === null ? "" : "%"}</small></div><div class="s">${a.all.ok}/${a.all.due}건 · KPI 20% 반영</div></div>
    </div>
    ${renderLanes(p, a)}
    <div class="cols">
      <section class="panel shame">
        <header><h2>미이행 공개</h2><span class="hint">기한이 지났는데 제출하지 않은 항목 · 전 직원 공개 (규정 제19·21조)</span><span class="sp"></span><b class="num">${a.reds.length}건</b></header>
        ${shame}
      </section>
      <div>
        <section class="panel"><header><h2>부서별 기한 준수율</h2><span class="hint">낮은 순</span></header><ul class="rank">${ranking}</ul></section>
        <section class="panel"><header><h2>마감 임박</h2><span class="hint">3영업일 이내</span><span class="sp"></span><b class="num" style="color:var(--yellow)">${a.yellows.length}건</b></header>${soon}</section>
      </div>
    </div>
    <section class="panel all">
      <header><h2>전체 일정</h2><span class="hint">규정 별표 2·3 · 납품일 역산</span><span class="sp"></span>
        <div class="filters">
          <div class="seg">${Object.keys(SEG).map((k) => `<button class="${state.status === k ? "on" : ""}" data-status="${k}">${k}</button>`).join("")}</div>
          <input class="search" id="q" placeholder="항목 검색" value="${esc(state.q)}">
        </div>
      </header>
      <div class="tw"><table>
        <thead><tr><th></th><th>단계</th><th>항목 · 양식</th><th>부서</th><th>담당자</th><th>기한</th><th>상태</th><th class="r">남은 기간</th><th></th></tr></thead>
        <tbody>${list || `<tr><td colspan="9" class="empty">조건에 맞는 항목 없음</td></tr>`}</tbody></table></div>
    </section>`;
  setupLanes();
}

function render() { renderSide(); renderMain(); }

function act(kind, id) {
  const p = current(), it = p.items.find((x) => x.id === +id), t = state.today;
  const by = state.viewer === "전체" ? it.dept : state.viewer;
  it.log = it.log || [];
  if (kind === "submit") {
    const path = prompt("파일서버 경로 (파일은 사내 파일서버에 두고 경로만 기록)", it.path || `\\\\fileserver\\인쇄물\\${p.name}\\`);
    if (path === null) return;
    Object.assign(it, { status: "submitted", submittedAt: t, path });
  } else if (kind === "accept") it.status = "accepted";
  else if (kind === "return") {
    const why = prompt("보완 요청 사유"); if (!why) return;
    Object.assign(it, { status: "returned", note: `보완 요청: ${why}` });
  } else if (kind === "approve" || kind === "done") Object.assign(it, { status: "accepted", submittedAt: t });
  else if (kind === "nudge") (it.nudges = it.nudges || []).push(t);
  else if (kind === "plan") {
    const plan = prompt("처리 계획과 제출 예정일 (부서장 입력, 제19조)", it.plan || ""); if (!plan) return;
    it.plan = plan;
  }
  it.log.push(`${t} ${by} ${kind}`);
  save(); render();
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("button"); if (!el) return;
  if (el.id === "owners") {
    const p = current(); p.owners = p.owners || {};
    for (const d of DEPTS.filter((d) => d !== "승인협의체")) {
      const v = prompt(`${d} 부서 담당자 (제7조)`, p.owners[d] || ""); if (v === null) break; p.owners[d] = v.trim();
    }
    save(); render();
  } else if (el.dataset.id) { state.selected = el.dataset.id; state.lnLeft = null; render(); }
  else if (el.dataset.dept) { state.dept = el.dataset.dept; state.lnLeft = null; render(); }
  else if (el.dataset.status) { state.status = el.dataset.status; renderMain(); }
  else if (el.dataset.act) act(el.dataset.act, el.dataset.item);
});
document.addEventListener("input", (e) => {
  if (e.target.id !== "q") return;
  state.q = e.target.value; renderMain();
  const q = $("#q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length);
});
$("#today").addEventListener("change", (e) => { state.today = e.target.value || realToday(); state.lnLeft = null; render(); });
$("#viewer").addEventListener("change", (e) => { state.viewer = e.target.value; render(); });
$("#reset").addEventListener("click", () => {
  if (!confirm("예시 데이터로 되돌릴까요? 이 브라우저에 저장한 내용이 지워짐.")) return;
  state.projects = seed(); state.selected = state.projects[0].id; state.today = realToday(); state.lnLeft = null; $("#today").value = state.today; save(); render();
});
$("#newform").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const p = makeProject(f.get("name").trim(), "도어", f.get("dday"));
  state.projects.push(p); state.selected = p.id; state.lnLeft = null; save(); render(); e.target.reset();
  $("#newdlg").close();
});
$("#newbtn").addEventListener("click", () => $("#newdlg").showModal());
$("#cancel").addEventListener("click", () => $("#newdlg").close());

// 앱 설치: 서비스워커 등록 + 브라우저가 설치 가능하다고 알려주면 "앱 설치" 버튼을 보여줌
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
let installEvt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; $("#install").hidden = false; });
addEventListener("appinstalled", () => { $("#install").hidden = true; });
$("#install").addEventListener("click", async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $("#install").hidden = true; });

$("#viewer").innerHTML =["전체", ...DEPTS].map((d) => `<option>${d}</option>`).join("");
state.projects = load();
state.selected = state.projects[0]?.id;
$("#today").value = state.today;
render();
