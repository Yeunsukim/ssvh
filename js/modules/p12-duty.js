// 간호행정 — 3교대 근무표(듀티): 한 달 단위로 짜고, 주 단위·월 단위로 조회, 휴무 사유(휴가·교육·병가 등) 구분
// 자료: staff[].sched = { 'YYYY-MM-DD': 근무 코드 }  · 확정 기록: recs kind 'duty' { ward, ym, status }
(function () {
  const H = window.H; const S = H.store; const UI = H.ui; const A = H.app; const T = H.t; const esc = H.esc;
  const DAY = 86400000;
  const PAIRS = (H.I18N_PAIRS = H.I18N_PAIRS || []);

  // 근무 코드: g = work(병동 근무) · edu(근무 인정, 병동 밖) · off(쉼)
  const CODES = [
    { v: 'D', s: 'D', en: 'D', l: '낮번', le: 'Day shift', t: '07:00~15:00', g: 'work', bg: 'var(--t-sent-soft)', fg: 'var(--t-sent)' },
    { v: 'E', s: 'E', en: 'E', l: '초번', le: 'Evening shift', t: '15:00~23:00', g: 'work', bg: 'var(--t-prog-soft)', fg: 'var(--t-prog)' },
    { v: 'N', s: 'N', en: 'N', l: '밤번', le: 'Night shift', t: '23:00~07:00', g: 'work', bg: 'var(--t-purple-soft)', fg: 'var(--t-purple)' },
    { v: 'OFF', s: 'OFF', en: 'OFF', l: '정규 휴무', le: 'Regular day off', g: 'off', bg: 'var(--surface-3)', fg: '' },
    { v: 'AL', s: '연차', en: 'AL', l: '연차 휴가', le: 'Annual leave', g: 'off', bg: 'var(--t-done-soft)', fg: 'var(--t-done)' },
    { v: 'EDU', s: '교육', en: 'EDU', l: '교육 (근무 인정)', le: 'Education (counted as work)', g: 'edu', bg: 'var(--accent-soft)', fg: 'var(--accent)' },
    { v: 'SL', s: '병가', en: 'SL', l: '병가', le: 'Sick leave', g: 'off', bg: 'var(--t-stat-soft)', fg: 'var(--t-stat)' },
    { v: 'FL', s: '경조', en: 'FL', l: '경조 휴가 (결혼·장례 등)', le: 'Family event leave', g: 'off', bg: 'var(--t-off-soft)', fg: '' },
    { v: 'PL', s: '공가', en: 'PL', l: '공가 (예비군·투표·건강검진 등)', le: 'Official leave', g: 'off', bg: 'var(--t-off-soft)', fg: '' },
    { v: 'HL', s: '보건', en: 'HL', l: '보건 휴가 (생리 휴가)', le: 'Menstrual leave', g: 'off', bg: 'var(--t-off-soft)', fg: '' },
    { v: 'ML', s: '출산', en: 'ML', l: '출산·육아 휴가', le: 'Maternity/parental leave', g: 'off', bg: 'var(--t-off-soft)', fg: '' },
  ];
  const C = {}; CODES.forEach((c) => { C[c.v] = c; });
  const WORK = new Set(['D', 'E', 'N']); const ONDUTY = new Set(['D', 'E', 'N', 'EDU']); const OFFS = new Set(CODES.filter((c) => c.g === 'off').map((c) => c.v));
  const LEAVE = new Set(CODES.filter((c) => c.g !== 'work' && c.v !== 'OFF').map((c) => c.v)); // 사유가 있는 휴무·교육 (자동 짜기·지우기에서 보존)
  const WARDS = [{ v: '7A', l: '7A 내과병동' }, { v: '8B', l: '8B 외과병동' }];

  // 공휴일 (교육용 — 실제 달력과 다를 수 있음)
  const HOL = { '2026-01-01': '신정', '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴', '2026-03-01': '삼일절', '2026-03-02': '대체 공휴일', '2026-05-05': '어린이날', '2026-05-24': '부처님오신날', '2026-05-25': '대체 공휴일', '2026-06-03': '지방선거일',
    '2026-06-06': '현충일', '2026-08-15': '광복절', '2026-08-17': '대체 공휴일', '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴', '2026-10-03': '개천절', '2026-10-05': '대체 공휴일', '2026-10-09': '한글날', '2026-12-25': '성탄절',
    '2027-01-01': '신정', '2027-02-06': '설날 연휴', '2027-02-07': '설날', '2027-02-08': '설날 연휴', '2027-02-09': '대체 공휴일', '2027-03-01': '삼일절', '2027-05-05': '어린이날', '2027-05-13': '부처님오신날', '2027-06-06': '현충일', '2027-08-15': '광복절', '2027-08-16': '대체 공휴일',
    '2027-09-14': '추석 연휴', '2027-09-15': '추석', '2027-09-16': '추석 연휴', '2027-10-03': '개천절', '2027-10-04': '대체 공휴일', '2027-10-09': '한글날', '2027-10-11': '대체 공휴일', '2027-12-25': '성탄절', '2027-12-27': '대체 공휴일' };
  const HOLF = { '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날', '06-06': '현충일', '08-15': '광복절', '10-03': '개천절', '10-09': '한글날', '12-25': '성탄절' };

  // ── 날짜 도구 ──
  const toT = (ds) => new Date(`${ds}T12:00:00`).getTime();
  const add = (ds, k) => T.d(toT(ds) + k * DAY);
  const dow = (ds) => new Date(`${ds}T12:00:00`).getDay();
  const hol = (ds) => HOL[ds] || (Number(ds.slice(0, 4)) > 2027 || Number(ds.slice(0, 4)) < 2026 ? HOLF[ds.slice(5)] : '') || '';
  const isRest = (ds) => dow(ds) === 0 || dow(ds) === 6 || !!hol(ds);
  const ymOf = (t) => T.d(t).slice(0, 7);
  const addYm = (ym, k) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const monthDays = (ym) => { const [y, m] = ym.split('-').map(Number); const n = new Date(y, m, 0).getDate(); return [...Array(n)].map((_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`); };
  const ymLabel = (ym) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월`;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const md = (ds) => `${Number(ds.slice(5, 7))}/${Number(ds.slice(8))}`;
  // 그 달의 주(월요일 시작)
  const weeksOf = (ym) => { const ds = monthDays(ym); let st = add(ds[0], -((dow(ds[0]) + 6) % 7)); const out = []; while (st <= ds[ds.length - 1]) { out.push([...Array(7)].map((_, i) => add(st, i))); st = add(st, 7); } return out; };

  // ── 필요 인원 (병동 12명 기준) ──
  const needOf = (ds) => (isRest(ds) ? { D: 2, E: 2, N: 2 } : { D: 3, E: 3, N: 2 });
  const MAX_N_RUN = 3, MAX_WORK_RUN = 5, MAX_N_MONTH = 8;
  const senior = (s) => (s.career || 0) >= 3;
  const staffOf = (w) => S.all('staff').filter((s) => s.ward === w).sort((a, b) => (b.career || 0) - (a.career || 0) || a.name.localeCompare(b.name));
  const get = (s, d) => (s.sched || {})[d] || '';
  const sset = (s, d, v) => { s.sched = s.sched || {}; if (v) s.sched[d] = v; else delete s.sched[d]; };
  const runBack = (s, d, pred) => { let n = 0; for (let k = 1; k <= 10; k++) { if (pred(get(s, add(d, -k)))) n++; else break; } return n; };

  // ── 한 달 자동 짜기: 빈칸만 채움 (미리 넣은 휴가·교육·희망 근무는 그대로) ──
  function auto(ward, ym) {
    const staff = staffOf(ward); const days = monthDays(ym); const short = []; let filled = 0;
    days.forEach((d, di) => {
      const need = needOf(d); const have = { D: 0, E: 0, N: 0 };
      staff.forEach((s) => { const v = get(s, d); if (have[v] != null) have[v]++; });
      const free = staff.filter((s) => !get(s, d)); const taken = new Set();
      const cnt = (s, f) => days.slice(0, di).filter((x) => f(get(s, x))).length;
      const offTarget = Math.round((days.filter(isRest).length * (di + 1)) / days.length);
      const ok = (s, sh) => {
        const p = get(s, add(d, -1)); const nx = get(s, add(d, 1));
        if (runBack(s, d, (v) => ONDUTY.has(v)) >= MAX_WORK_RUN) return false;
        if (sh === 'N') { if (p === 'N' && runBack(s, d, (v) => v === 'N') >= MAX_N_RUN) return false; if (cnt(s, (v) => v === 'N') >= MAX_N_MONTH) return false; return !(nx === 'D' || nx === 'E'); }
        if (p === 'N') return false;
        if (sh === 'D' && p === 'E') return false;
        if (sh === 'E' && nx === 'D') return false;
        return true;
      };
      const score = (s, sh) => {
        const offs = cnt(s, (v) => OFFS.has(v)); const deficit = Math.max(0, offTarget - offs);
        let sc = cnt(s, (v) => v === sh) * 2 + cnt(s, (v) => WORK.has(v)) + deficit * 3 + (((di * 7) + staff.indexOf(s) * 5) % staff.length) * 0.01;
        if (sh === 'N' && get(s, add(d, -1)) === 'N') sc -= 30; // 밤번은 몰아서(연속)
        if (sh === 'N' && (s.career || 0) <= 1) sc += 4; // 신규는 밤번을 덜
        return sc;
      };
      ['N', 'D', 'E'].forEach((sh) => { // 낮번은 조건이 가장 까다로워(전날 밤·초번 불가) 초번보다 먼저 채움
        const k = need[sh] - have[sh]; if (k <= 0) return;
        const c = free.filter((s) => !taken.has(s.id) && ok(s, sh)).sort((a, b) => score(a, sh) - score(b, sh));
        const pick = c.slice(0, k);
        if (!staff.some((s) => get(s, d) === sh && senior(s)) && pick.length && !pick.some(senior)) { const sn = c.find((s) => senior(s) && !pick.includes(s)); if (sn) pick[pick.length - 1] = sn; }
        pick.forEach((s) => { sset(s, d, sh); taken.add(s.id); filled++; });
        if (pick.length < k) short.push(`${md(d)} ${C[sh].l} ${k - pick.length}명 부족`);
      });
      free.filter((s) => !taken.has(s.id)).forEach((s) => { sset(s, d, 'OFF'); filled++; });
    });
    return { filled, short };
  }

  // ── 규칙 점검 ──
  function check(ward, days, monthly) {
    const staff = staffOf(ward); const out = [];
    staff.forEach((s) => {
      days.forEach((d) => {
        const v = get(s, d); const nx = get(s, add(d, 1)); if (!v) return;
        if (v === 'N' && (nx === 'D' || nx === 'E') && days.includes(add(d, 1))) out.push(`${s.name}: ${md(d)} 밤번 다음 날 ${C[nx].l} — 쉬지 못함`);
        if (v === 'E' && nx === 'D' && days.includes(add(d, 1))) out.push(`${s.name}: ${md(d)} 초번 다음 날 낮번 — 쉬는 시간 8시간뿐`);
        if (v === 'N' && nx !== 'N' && runBack(s, add(d, 1), (x) => x === 'N') > MAX_N_RUN) out.push(`${s.name}: ${md(d)}까지 밤번 ${runBack(s, add(d, 1), (x) => x === 'N')}번 연속 — ${MAX_N_RUN}번까지`);
        if (ONDUTY.has(v) && !ONDUTY.has(nx) && runBack(s, add(d, 1), (x) => ONDUTY.has(x)) > MAX_WORK_RUN) out.push(`${s.name}: ${md(d)}까지 ${runBack(s, add(d, 1), (x) => ONDUTY.has(x))}일 연속 근무 — ${MAX_WORK_RUN}일까지`);
      });
      if (monthly && days.every((d) => get(s, d))) {
        const n = days.filter((d) => get(s, d) === 'N').length; if (n > MAX_N_MONTH) out.push(`${s.name}: 이 달 밤번 ${n}번 — ${MAX_N_MONTH}번까지`);
        const off = days.filter((d) => OFFS.has(get(s, d))).length; const need = days.filter(isRest).length; if (off < need) out.push(`${s.name}: 쉬는 날 ${off}일 — 토·일·공휴일 수(${need}일) 이상 필요`);
      }
    });
    days.forEach((d) => { const need = needOf(d); ['D', 'E', 'N'].forEach((sh) => { const on = staff.filter((s) => get(s, d) === sh); if (!staff.every((s) => get(s, d))) return; /* 그날 모든 칸을 채운 뒤에만 인원 점검 */ if (on.length < need[sh]) out.push(`${md(d)} ${C[sh].l} ${on.length}명 — ${need[sh]}명 필요`); else if (!on.some(senior)) out.push(`${md(d)} ${C[sh].l} — 경력 3년 이상 간호사 없음`); }); });
    return out;
  }
  const posted = (ward, ym) => S.all('recs').filter((r) => r.kind === 'duty' && r.ward === ward && r.ym === ym).sort((a, b) => b.at - a.at)[0];

  // ── 화면 ──
  const lang = () => (H.i18n && H.i18n.lang) || 'ko';
  // 한 글자 낱말(요일·일·년)은 사전에 넣으면 다른 화면까지 바뀌므로 여기서 직접 언어별로 씀
  const L = (ko, en) => `<span class="no-tr">${lang() === 'en' ? en : ko}</span>`;
  const WDE = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cellTxt = (v) => (v && C[v] ? `<span class="no-tr">${esc(lang() === 'en' ? C[v].en : C[v].s)}</span>` : '<span class="muted">·</span>');
  const cellStyle = (v) => (v && C[v] ? `background:${C[v].bg};${C[v].fg ? `color:${C[v].fg};` : ''}` : '');
  const thDay = (d, ym) => { const w = dow(d); const h = hol(d); const cls = h || w === 0 ? 'rest' : w === 6 ? 'sat' : ''; return `<th class="duty-h ${cls}${ym && d.slice(0, 7) !== ym ? ' other' : ''}" title="${esc(h)}"><div class="num">${md(d)}</div><div class="small">${L(WD[w], WDE[w])}${h ? ' ★' : ''}</div></th>`; };

  function body() {
    const ward = A.ms('dward', '7A'); const ym = A.ms('dym', addYm(ymOf(Date.now()), 1)); const view = A.ms('dview', 'month'); const brush = A.ms('dbrush', 'D');
    const staff = staffOf(ward); const mdays = monthDays(ym); const weeks = weeksOf(ym);
    const wi = Math.min(A.ms('dweek', 0), weeks.length - 1); const days = view === 'week' ? weeks[wi] : mdays;
    const p = posted(ward, ym); const filledN = staff.reduce((n, s) => n + mdays.filter((d) => get(s, d)).length, 0); const total = staff.length * mdays.length;
    const warn = check(ward, days, view === 'month');
    const top = `<div class="duty-top">
      <div class="fld"><label>병동</label>${UI.seg('du.ward', WARDS, ward)}</div>
      <div class="fld"><label>기간 (한 달)</label><div class="row" style="gap:.4rem;flex-wrap:wrap">${UI.btn('◀ 이전 달', 'du.ym', { data: { k: -1 } })}<b class="duty-ym">${esc(ymLabel(ym))}</b>${UI.btn('다음 달 ▶', 'du.ym', { data: { k: 1 } })}${UI.btn('이번 달', 'du.ym', { data: { k: 0 } })}</div>
        <div class="small muted" style="margin-top:.2rem"><span>기간</span>: ${mdays[0]} ~ ${mdays[mdays.length - 1]} (${mdays.length}${L('일', ' d')}) · <span>토·일·공휴일</span> ${mdays.filter(isRest).length}${L('일', ' d')}</div></div>
      <div class="fld"><label>조회</label>${UI.seg('du.view', [{ v: 'month', l: '월 단위' }, { v: 'week', l: '주 단위' }], view)}</div>
      <div class="fld"><label>상태</label><div>${p ? `${UI.chip(p.status, p.status === '확정' ? 'done' : 'prog')} <span class="small">${esc(p.by)} · ${T.d(p.at)}</span>` : UI.chip('작성 중', 'sent')} <span class="small muted"><span>채운 칸</span> ${filledN}/${total}</span></div></div>
    </div>`;
    const weekBar = view === 'week' ? `<div class="row" style="gap:.4rem;flex-wrap:wrap">${UI.btn('◀ 이전 주', 'du.wk', { data: { k: -1 } })}${UI.seg('du.week', weeks.map((w, i) => ({ v: i, l: `${i + 1}주 (${md(w[0])}~${md(w[6])})` })), wi)}${UI.btn('다음 주 ▶', 'du.wk', { data: { k: 1 } })}</div>` : '';
    const palette = `<div class="duty-pal"><span class="small"><b>칸에 넣을 근무를 고른 뒤</b> 표의 칸을 한 번씩 누르세요</span><div class="row" style="gap:.3rem;flex-wrap:wrap;margin-top:.3rem">${CODES.map((c) => `<button type="button" class="duty-b${brush === c.v ? ' on' : ''}" data-act="du.brush" data-v="${c.v}" style="${cellStyle(c.v)}" title="${esc(c.l)}">${cellTxt(c.v)}<span class="small">${esc(c.l)}</span></button>`).join('')}<button type="button" class="duty-b${brush === '' ? ' on' : ''}" data-act="du.brush" data-v=""><span>지우개</span><span class="small">빈칸으로</span></button></div></div>`;
    const big = view === 'week';
    const head = `<tr><th class="duty-name">간호사</th>${days.map((d) => thDay(d, ym)).join('')}${view === 'month' ? '<th>D</th><th>E</th><th>N</th><th>휴무</th><th>교육</th>' : ''}</tr>`;
    const rows = staff.map((s) => `<tr><td class="duty-name"><b>${esc(s.name)}</b><div class="small muted">${esc(s.role === '책임 간호사' ? '책임' : '일반')} · ${s.career}${L('년', ' yr')}</div></td>${days.map((d) => { const v = get(s, d); return `<td class="duty-td"><button type="button" class="duty-c${big ? ' big' : ''}" data-act="du.cell" data-id="${s.id}" data-d="${d}" style="${cellStyle(v)}" aria-label="${esc(s.name)} ${d}">${cellTxt(v)}${big && v && C[v].t ? `<span class="small">${C[v].t}</span>` : ''}</button></td>`; }).join('')}${view === 'month' ? ['D', 'E', 'N'].map((x) => `<td class="num c">${days.filter((d) => get(s, d) === x).length}</td>`).join('') + `<td class="num c">${days.filter((d) => OFFS.has(get(s, d))).length}</td><td class="num c">${days.filter((d) => get(s, d) === 'EDU').length}</td>` : ''}</tr>`).join('');
    const foot = ['D', 'E', 'N'].map((sh) => `<tr class="duty-sum"><td class="duty-name"><b>${esc(C[sh].l)}</b> <span class="small muted">${C[sh].t}</span></td>${days.map((d) => { const on = staff.filter((s) => get(s, d) === sh); const need = needOf(d)[sh]; const bad = staff.every((s) => get(s, d)) && on.length < need; return `<td class="c${bad ? ' bad' : ''}">${big ? `<div class="num"><b>${on.length}</b>/${need}</div><div class="small">${on.map((s) => esc(s.name)).join('<br>')}</div>` : `<span class="num">${on.length}</span>`}</td>`; }).join('')}${view === 'month' ? '<td colspan="5"></td>' : ''}</tr>`).join('');
    const legend = `<div class="small muted duty-leg">${CODES.map((c) => `<span><span class="duty-dot" style="${cellStyle(c.v)}">${cellTxt(c.v)}</span> ${esc(c.l)}${c.t ? ` ${c.t}` : ''}</span>`).join('')}</div>`;
    const rules = UI.note('근무표 규칙 (교육용): 밤번 다음 날 낮번·초번 금지 · 초번 다음 날 낮번 금지 · 밤번 연속 3번까지 · 연속 근무 5일까지 · 한 달 밤번 8번까지 · 쉬는 날은 그 달 토·일·공휴일 수 이상 · 근무조마다 경력 3년 이상 1명 · 필요 인원 평일 낮3·초3·밤2, 주말·공휴일 낮2·초2·밤2. <b>먼저 휴가·교육 신청을 넣고</b> "한 달 자동 짜기"를 누르면 빈칸만 채웁니다.', 'info');
    const actions = `<div class="btn-row">${UI.btn('한 달 자동 짜기 (빈칸만)', 'du.auto', { kind: 'pri', icon: 'refresh' })}${UI.btn('근무 지우기 (휴가·교육은 남김)', 'du.clear')}${UI.btn('근무표 확정 (게시)', 'du.post', { icon: 'check' })}</div>`;
    const warnBox = warn.length ? UI.note(`<b>규칙 위반·확인 ${warn.length}건</b> (${view === 'week' ? '이번 주' : '이번 달'})<ul style="margin:.3rem 0 0;padding-left:1.2rem">${warn.slice(0, 40).map((x) => `<li>${esc(x)}</li>`).join('')}${warn.length > 40 ? `<li>… ${warn.length - 40}건 더</li>` : ''}</ul>`, 'warn') : UI.note(filledN ? '규칙 위반 없음' : '아직 근무를 넣지 않았습니다', filledN ? 'ok' : '');
    return `<div class="gap-m">${top}${rules}${palette}${actions}${weekBar}
      <div class="tbl-wrap duty-wrap"><table class="tbl duty${big ? ' wk' : ''}"><thead>${head}</thead><tbody>${rows}${foot}</tbody></table></div>
      ${legend}${warnBox}</div>`;
  }

  const ACTS = {
    'du.ward': (el) => { A.set('dward', el.dataset.v); A.render(); },
    'du.view': (el) => { A.set('dview', el.dataset.v); if (el.dataset.v === 'week') { const ym = A.ms('dym', addYm(ymOf(Date.now()), 1)); const today = T.d(Date.now()); const i = weeksOf(ym).findIndex((w) => w.includes(today)); A.set('dweek', Math.max(0, i)); } A.render(); },
    'du.ym': (el) => { const k = Number(el.dataset.k); const cur = A.ms('dym', addYm(ymOf(Date.now()), 1)); A.set('dym', k === 0 ? ymOf(Date.now()) : addYm(cur, k)); A.set('dweek', 0); A.render(); },
    'du.week': (el) => { A.set('dweek', Number(el.dataset.v)); A.render(); },
    'du.wk': (el) => { const ym = A.ms('dym', addYm(ymOf(Date.now()), 1)); const n = weeksOf(ym).length; let i = A.ms('dweek', 0) + Number(el.dataset.k);
      if (i < 0) { A.set('dym', addYm(ym, -1)); i = weeksOf(addYm(ym, -1)).length - 1; } else if (i >= n) { A.set('dym', addYm(ym, 1)); i = 0; } A.set('dweek', i); A.render(); },
    'du.brush': (el) => { A.set('dbrush', el.dataset.v); A.render(); },
    'du.cell': (el) => {
      const s = S.get('staff', el.dataset.id); const d = el.dataset.d; const v = A.ms('dbrush', 'D'); if (get(s, d) === v) return;
      sset(s, d, v); const ym = d.slice(0, 7); const p = posted(s.ward, ym); if (p && p.status === '확정') { p.status = '확정 후 수정 중'; }
      S.save(); A.render();
    },
    'du.auto': () => {
      const ward = A.ms('dward', '7A'); const ym = A.ms('dym', addYm(ymOf(Date.now()), 1)); const r = auto(ward, ym); S.save();
      H.log('근무표 작성', `${ward} ${ymLabel(ym)} 자동 짜기 ${r.filled}칸`);
      UI.toast(r.filled ? `${r.filled}칸을 채웠습니다${r.short.length ? ` — 인원 부족 ${r.short.length}건: 휴가·교육이 겹친 날을 확인하세요` : ''}` : '빈칸이 없습니다 — 다시 짜려면 "근무 지우기"를 먼저 누르세요', r.short.length ? 'warn' : 'ok'); A.render();
    },
    'du.clear': async () => {
      const ward = A.ms('dward', '7A'); const ym = A.ms('dym', addYm(ymOf(Date.now()), 1));
      if (!(await UI.confirm({ title: '근무 지우기', text: `${ward} ${ymLabel(ym)}의 낮번·초번·밤번·정규 휴무를 지웁니다.\n연차·교육·병가 등 사유가 있는 칸은 남깁니다.`, ok: '지우기', danger: true }))) return;
      staffOf(ward).forEach((s) => monthDays(ym).forEach((d) => { if (!LEAVE.has(get(s, d))) sset(s, d, ''); }));
      const p = posted(ward, ym); if (p) p.status = '확정 후 수정 중'; S.save(); H.log('근무표 작성', `${ward} ${ymLabel(ym)} 근무 지우기`); A.render();
    },
    'du.post': () => {
      const ward = A.ms('dward', '7A'); const ym = A.ms('dym', addYm(ymOf(Date.now()), 1)); const staff = staffOf(ward); const days = monthDays(ym);
      const empty = staff.reduce((n, s) => n + days.filter((d) => !get(s, d)).length, 0); if (empty) return UI.toast(`빈칸이 ${empty}칸 있습니다 — 모두 채운 뒤 확정하세요`, 'warn');
      const w = check(ward, days, true); const by = H.who ? H.who() : ((S.session().user || {}).name || '-');
      S.add('recs', { id: H.uid('rc'), kind: 'duty', patientId: null, at: Date.now(), by, ward, ym, status: '확정', warn: w.length });
      H.log('근무표 작성', `${ward} ${ymLabel(ym)} 확정 (규칙 확인 ${w.length}건)`); UI.toast(`${ward} ${ymLabel(ym)} 근무표를 확정해 병동에 게시했습니다${w.length ? ` — 규칙 확인 ${w.length}건이 남아 있습니다` : ''}`, w.length ? 'warn' : 'ok'); A.render();
    },
  };

  // 샘플: 병동마다 간호사 12명, 지난달·이번 달 근무표(확정)와 다음 달 휴가·교육 신청
  function seedDuty(db, now) {
    const NAMES = { '7A': ['김은하', '박서윤', '이하늘', '최지우', '서민지', '문가영', '장수희', '노지원', '홍예은', '백소연', '안다현', '유하람'], '8B': ['정다은', '한소율', '오예린', '윤채원', '권나래', '송지아', '임채린', '조윤희', '신아름', '배서영', '황보라', '남궁별'] };
    const CAREER = [12, 9, 7, 5, 4, 4, 3, 2, 2, 1, 1, 1];
    const edu0 = db.staff[0] ? Object.keys(db.staff[0].edu || {}) : []; const hl0 = db.staff[0] ? Object.keys(db.staff[0].health || {}) : [];
    Object.entries(NAMES).forEach(([w, list]) => list.forEach((n, i) => {
      let s = db.staff.find((x) => x.name === n); if (!s) { s = { id: H.uid('sf'), name: n, ward: w, career: CAREER[i], role: i < 2 ? '책임 간호사' : '일반 간호사', edu: {}, health: {}, sched: {} }; edu0.forEach((k, j) => { s.edu[k] = (i + j) % 4 !== 0; }); hl0.forEach((k, j) => { s.health[k] = (i + j) % 5 !== 1; }); db.staff.push(s); }
      s.sched = s.sched || {};
    }));
    const prevStore = H.store.db; H.store.db = db; // auto()가 S.all을 쓰므로 잠시 이 자료를 가리킴
    try {
      const cur = ymOf(now); const months = [addYm(cur, -1), cur, addYm(cur, 1)];
      let r = 3; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
      months.forEach((ym, mi) => ['7A', '8B'].forEach((w) => {
        const st = staffOf(w); const ds = monthDays(ym);
        // 휴가·교육 신청
        const wdays = ds.filter((d) => !isRest(d)); // 교육은 평일에만
        st.forEach((s, i) => { const k = Math.floor(rnd() * 2) + 1; for (let j = 0; j < k; j++) { const edu = j === 0 && i % 3 === 0; const pool = edu ? wdays : ds; const d = pool[Math.floor(rnd() * pool.length)]; if (!get(s, d)) sset(s, d, edu ? 'EDU' : 'AL'); } });
        const nb = st.filter((s) => s.career <= 1); const eduDay = ds.find((d) => dow(d) === 3 && Number(d.slice(8)) > 7); nb.forEach((s) => sset(s, eduDay, 'EDU')); // 신규 간호사 BLS 교육
        sset(st[5], ds[Math.min(ds.length - 1, 13 + mi)], 'PL'); sset(st[3], ds[Math.min(ds.length - 1, 20)], 'FL'); if (mi === 0) sset(st[7], ds[9], 'SL');
        if (mi < 2) { auto(w, ym); db.recs.push({ id: H.uid('rc'), kind: 'duty', patientId: null, at: toT(ds[0]) - 10 * DAY, by: w === '7A' ? '7A 수간호사' : '8B 수간호사', ward: w, ym, status: '확정', warn: check(w, ds, true).length }); }
      }));
    } finally { H.store.db = prevStore; }
  }

  // 영어 화면 문구
  [['병동', 'Ward'], ['기간 (한 달)', 'Period (1 month)'], ['◀ 이전 달', '◀ Prev month'], ['다음 달 ▶', 'Next month ▶'], ['이번 달', 'This month'], ['기간', 'Period'], ['토·일·공휴일', 'Weekends/holidays'],
    ['@: # 밤번 다음 날 낮번 — 쉬지 못함', '@: # Day shift right after Night — no rest'], ['@: # 밤번 다음 날 초번 — 쉬지 못함', '@: # Evening shift right after Night — no rest'], ['@: # 초번 다음 날 낮번 — 쉬는 시간 #시간뿐', '@: # Day shift right after Evening — only # h rest'],
    ['@: #까지 밤번 #번 연속 — #번까지', '@: through #, # Nights in a row — max #'], ['@: #까지 #일 연속 근무 — #일까지', '@: through #, # workdays in a row — max #'], ['@: 이 달 밤번 #번 — #번까지', '@: # Nights this month — max #'],
    ['@: 쉬는 날 #일 — 토·일·공휴일 수(#일) 이상 필요', '@: # days off — need at least # (weekends+holidays)'], ['# 낮번 #명 — #명 필요', '# Day shift: # staff — # needed'], ['# 초번 #명 — #명 필요', '# Evening shift: # staff — # needed'], ['# 밤번 #명 — #명 필요', '# Night shift: # staff — # needed'],
    ['# 낮번 — 경력 #년 이상 간호사 없음', '# Day shift — no nurse with #+ years'], ['# 초번 — 경력 #년 이상 간호사 없음', '# Evening shift — no nurse with #+ years'], ['# 밤번 — 경력 #년 이상 간호사 없음', '# Night shift — no nurse with #+ years'],
    ['규칙 위반·확인 #건', 'Rule issues: #'], ['(이번 달)', '(this month)'], ['(이번 주)', '(this week)'], ['… #건 더', '… # more'], ['#주 (#~#)', 'Wk # (#–#)'], ['확정 후 수정 중', 'Edited after posting'],
    ['#칸을 채웠습니다', 'Filled # cells'], ['빈칸이 없습니다 — 다시 짜려면 "근무 지우기"를 먼저 누르세요', 'No empty cells — press "Clear shifts" first to rebuild'], ['빈칸이 #칸 있습니다 — 모두 채운 뒤 확정하세요', '# empty cells — fill them all before posting'],
    ['#A #월 근무표를 확정해 병동에 게시했습니다', 'Posted the #A month # roster to the ward'], ['#B #월 근무표를 확정해 병동에 게시했습니다', 'Posted the #B month # roster to the ward'], ['조회', 'View'], ['월 단위', 'Monthly'], ['주 단위', 'Weekly'], ['상태', 'Status'],
    ['작성 중', 'Drafting'], ['확정 후 수정 중', 'Edited after posting'], ['채운 칸', 'Filled cells'], ['◀ 이전 주', '◀ Prev week'], ['다음 주 ▶', 'Next week ▶'], ['칸에 넣을 근무를 고른 뒤', 'Pick a shift'], ['표의 칸을 한 번씩 누르세요', 'then tap each cell once'], ['지우개', 'Eraser'], ['빈칸으로', 'Make empty'],
    ['간호사', 'Nurse'], ['휴무', 'Off'], ['교육', 'Edu'], ['책임', 'Charge'], ['일반', 'Staff'],['한 달 자동 짜기 (빈칸만)', 'Auto-build month (empty cells only)'], ['근무 지우기 (휴가·교육은 남김)', 'Clear shifts (keep leave/education)'], ['근무표 확정 (게시)', 'Post roster'],
    ['규칙 위반 없음', 'No rule violations'], ['아직 근무를 넣지 않았습니다', 'No shifts entered yet'], ['이번 주', 'this week'], ['이번 달', 'this month'], ['근무 지우기', 'Clear shifts'], ['지우기', 'Clear'], ['근무표 작성', 'Roster edit'],
    ['근무표 규칙 (교육용): 밤번 다음 날 낮번·초번 금지 · 초번 다음 날 낮번 금지 · 밤번 연속 3번까지 · 연속 근무 5일까지 · 한 달 밤번 8번까지 · 쉬는 날은 그 달 토·일·공휴일 수 이상 · 근무조마다 경력 3년 이상 1명 · 필요 인원 평일 낮3·초3·밤2, 주말·공휴일 낮2·초2·밤2.', 'Roster rules (educational): no Day/Evening after Night · no Day after Evening · max 3 Nights in a row · max 5 workdays in a row · max 8 Nights a month · days off ≥ weekends+holidays that month · ≥1 nurse with 3+ yrs per shift · staffing weekdays D3·E3·N2, weekends/holidays D2·E2·N2.'],
    ['먼저 휴가·교육 신청을 넣고', 'Enter leave/education requests first,'], ['"한 달 자동 짜기"를 누르면 빈칸만 채웁니다.', 'then "Auto-build month" fills only the empty cells.'],
    ['7A 내과병동', '7A Medical ward'], ['8B 외과병동', '8B Surgical ward'], ['7A 수간호사', '7A head nurse'], ['8B 수간호사', '8B head nurse'], ['확정', 'Posted'], ['책임 간호사', 'Charge nurse'], ['일반 간호사', 'Staff nurse'],
    ['#/# 밤번 다음 날 낮번 — 쉬지 못함', '#/# Day shift right after Night — no rest'], ['#년 #월', '#-#']]
    .concat(CODES.map((c) => [c.l, c.le]), Object.values(HOL).map((h) => [h, { 신정: "New Year's Day", '설날 연휴': 'Lunar New Year holiday', 설날: 'Lunar New Year', 삼일절: 'Independence Movement Day', '대체 공휴일': 'Substitute holiday', 어린이날: "Children's Day", 부처님오신날: "Buddha's Birthday", 지방선거일: 'Local election day', 현충일: 'Memorial Day', 광복절: 'Liberation Day', '추석 연휴': 'Chuseok holiday', 추석: 'Chuseok', 개천절: 'National Foundation Day', 한글날: 'Hangeul Day', 성탄절: 'Christmas' }[h] || h]))
    .forEach((x) => PAIRS.push(x));

  H.duty = { body, acts: ACTS, auto, check, seedDuty, CODES, monthDays };
  H.seed.phase10 = (db) => seedDuty(db, Date.now()); // 10차 샘플: 병동 간호사 12명씩 + 근무표 (store.js p10)
  if (H.mods.nadmin) Object.assign(H.mods.nadmin.acts, ACTS);
})();
