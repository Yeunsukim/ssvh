// 병동 간호 + 간호기록(ENR): 인수 → 처방 확인 → 간호사정 → 투약·처치 → 활력징후·기록 → 소통 → 인계
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const F = H.flow;
  const V = H.view;
  const T = H.t;
  const MIN = 60000, HR = 3600000;

  const ms = (k, d) => A.ms(k, d);
  const set = (k, v) => A.set(k, v);
  const unit = () => ms('unit', '7A');
  const shift = () => ms('shift', T.shiftOf());
  const range = () => T.shiftRange(shift(), Date.now());
  const inShift = (ts) => { const [a, b] = range(); return ts >= a && ts < b; };
  const curEnc = () => { const e = A.enc(); return e && (e.ward === unit() || (unit() === 'ER' && e.type === 'ER')) ? e : null; };

  function unitEncs() {
    const u = unit();
    return S.where('encounters', (e) => (u === 'ER' ? e.type === 'ER' && ['대기', '진료중'].includes(e.status) : e.type === 'IPD' && e.ward === u && e.status === '입원중'))
      .sort((a, b) => u === 'ER' ? a.ktas - b.ktas || a.at - b.at : (a.room + a.bed).localeCompare(b.room + b.bed));
  }

  // ── 조기경보점수 (NEWS2 간이) ──
  function news(v) {
    if (!v) return null;
    let s = 0; let red = false;
    const add = (n) => { s += n; if (n === 3) red = true; };
    const rr = H.num(v.rr), sp = H.num(v.spo2), sbp = H.num(v.sbp), hr = H.num(v.hr), bt = H.num(v.bt);
    if (rr != null) add(rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3);
    if (sp != null) add(sp <= 91 ? 3 : sp <= 93 ? 2 : sp <= 95 ? 1 : 0);
    if (sbp != null) add(sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3);
    if (hr != null) add(hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3);
    if (bt != null) add(bt <= 35 ? 3 : bt <= 36 ? 1 : bt <= 38 ? 0 : bt <= 39 ? 1 : 2);
    if (v.avpu && v.avpu !== 'A') add(3);
    if (v.o2) add(2);
    const level = s >= 7 ? { t: '높음 — 신속대응팀 호출', c: 'stat' } : s >= 5 || red ? { t: '중간 — 바로 의사에게 알림', c: 'prog' } : s >= 1 ? { t: '낮음 — 관찰 강화', c: 'sent' } : { t: '정상', c: 'done' };
    return { s, level };
  }
  H.news = news;

  // ── 투약 시간표 ──
  function medOrders(pid) {
    return S.where('orders', (o) => o.patientId === pid && (o.cat === 'MED' || o.cat === 'INJ') && !o.outside && !F.isOff(o) && !o.done);
  }
  function slotsFor(o) {
    const today = T.startOfDay();
    if (o.freq === 'PRN') return [];
    const start = o.arrivedAt || o.at;
    if (['STAT', 'ONCE'].includes(o.freq) || o.stat) return [{ ts: start, label: '즉시' }];
    if (o.freq === 'CONT') return [{ ts: start, label: '주입 시작' }];
    const f = H.M.FREQ[o.freq];
    if (!f || !f.times.length) return [];
    const endTs = o.at + o.days * 86400000;
    let slots = f.times.map((h) => ({ ts: T.at(today, h), label: H.pad(h) + ':00' })).filter((s) => s.ts >= o.at - 30 * MIN && s.ts <= endTs);
    if (o.at >= today && !slots.some((s) => s.ts <= start + 3 * HR)) slots.unshift({ ts: start, label: '첫 회' });
    return slots;
  }
  function marOf(o, ts) { return S.all('mar').find((m) => m.orderId === o.id && Math.abs(m.slot - ts) < MIN); }
  function slotState(o, s) {
    const m = marOf(o, s.ts);
    if (m) return { k: m.status === '투약' ? 'done' : 'off', m };
    if (o.status !== '불출') return { k: 'wait' };
    if (s.ts < Date.now() - HR) return { k: 'late' };
    if (s.ts <= Date.now() + HR) return { k: 'due' };
    return { k: 'future' };
  }
  function dueCount(pid) {
    let n = 0;
    medOrders(pid).forEach((o) => slotsFor(o).forEach((s) => { const st = slotState(o, s).k; if (st === 'due' || st === 'late') n++; }));
    S.where('orders', (o) => o.patientId === pid && o.cat === 'BLOOD' && o.status === '출고' && !o.transfused).forEach(() => n++);
    return n;
  }
  const unacked = (pid) => S.where('orders', (o) => o.patientId === pid && !o.nurseAck && !F.isOff(o) && o.encType !== 'OPD');

  // ── 근무 일과 7단계 ──
  const meName = () => (A.user() || {}).name || '?';
  const isMine = (h) => String(h.by).startsWith(meName()) && !h.src;
  function pendingHandoff(pid) {
    const [a] = range();
    const list = S.where('handoffs', (h) => h.patientId === pid && !isMine(h)).sort((x, y) => y.at - x.at);
    return list.find((h) => !h.ackBy && h.at > a - 12 * HR) || list.find((h) => h.at < a && h.at > a - 12 * HR) || null;
  }
  function steps(p, e) {
    const ho = pendingHandoff(p.id);
    const recvDone = !ho || !!ho.ackBy;
    const ackDone = !unacked(p.id).length;
    const assessDone = S.where('assess', (x) => x.patientId === p.id && inShift(x.at)).length > 0;
    const medsLate = medOrders(p.id).some((o) => slotsFor(o).some((s) => s.ts < Date.now() && inShift(s.ts) && ['due', 'late'].includes(slotState(o, s).k)));
    const vsDone = S.where('vitals', (x) => x.patientId === p.id && inShift(x.at)).length > 0;
    const noteDone = S.where('nnotes', (x) => x.patientId === p.id && inShift(x.at)).length > 0;
    const commDone = S.where('acts', (x) => x.patientId === p.id && inShift(x.at)).length + S.where('comms', (x) => x.patientId === p.id && inShift(x.at)).length > 0;
    const hoDone = S.where('handoffs', (h) => h.patientId === p.id && inShift(h.at) && isMine(h)).length > 0;
    return [
      { id: 'handoff', n: 1, t: '인수', s: ho ? (recvDone ? '인수 확인함' : '이전 근무자 인계 확인') : '받을 인계 없음', done: recvDone },
      { id: 'orders', n: 2, t: '처방 확인', s: ackDone ? '모두 확인함' : `새 처방 ${unacked(p.id).length}건`, done: ackDone },
      { id: 'assess', n: 3, t: '간호사정', s: assessDone ? '이번 근무 사정함' : '라운딩·사정 필요', done: assessDone },
      { id: 'mar', n: 4, t: '투약·처치', s: medsLate ? '지난 투약 있음' : `투약할 것 ${dueCount(p.id)}건`, done: !medsLate },
      { id: 'vs', n: 5, t: '활력징후·기록', s: vsDone && noteDone ? '측정·기록함' : vsDone ? '간호기록 필요' : '측정 필요', done: vsDone && noteDone },
      { id: 'comm', n: 6, t: '소통·교육', s: commDone ? '함' : '노티·교육·라운딩', done: commDone },
      { id: 'handover', n: 7, t: '인계', s: hoDone ? '인계 작성함' : '근무 끝에 작성', done: hoDone },
    ];
  }

  // ───────── 탭들 ─────────
  function tabDay(p, e) {
    const st = steps(p, e);
    const todo = [];
    unacked(p.id).forEach((o) => todo.push({ t: H.t.hm(o.at), txt: `새 처방 확인: ${o.name}`, tab: 'orders', c: o.stat ? 'stat' : 'sent' }));
    medOrders(p.id).forEach((o) => slotsFor(o).forEach((s) => { const k = slotState(o, s).k; if (k === 'due' || k === 'late') todo.push({ t: s.label.includes(':') ? s.label : H.t.hm(s.ts), txt: `${k === 'late' ? '[지연] ' : ''}투약: ${o.name}`, tab: 'mar', c: k === 'late' ? 'stat' : 'prog' }); }));
    S.where('orders', (o) => o.patientId === p.id && o.cat === 'LAB' && o.status === '전송' && o.encType !== 'OPD').forEach((o) => todo.push({ t: H.t.hm(o.at), txt: o.code === 'L1026' ? `혈당 측정: ${o.name}` : `채혈: ${o.name}`, tab: 'orders', c: 'sent' }));
    S.where('orders', (o) => o.patientId === p.id && o.cat === 'BLOOD' && o.status === '출고' && !o.transfused).forEach((o) => todo.push({ t: H.t.hm(o.arrivedAt || o.at), txt: `수혈 시작: ${o.name}`, tab: 'mar', c: 'stat' }));
    S.where('orders', (o) => o.patientId === p.id && o.cat === 'RAD' && o.status === '검사접수').forEach((o) => todo.push({ t: '', txt: `영상 검사 이송 준비: ${o.name} (${o.room || ''})`, tab: 'orders', c: 'sent' }));
    S.where('orders', (o) => o.patientId === p.id && o.cat === 'LAB' && o.status === '결과보고' && !o.nurseSeen).forEach((o) => todo.push({ t: H.t.hm(o.result.at), txt: `결과 확인: ${o.name}${o.result.items.some((r) => r.flag === 'C') ? ' ⚠ 위험값' : ''}`, tab: 'result', c: o.result.items.some((r) => r.flag === 'C') ? 'stat' : 'sent' }));
    if (!H.lastAssess(p.id, 'initial') && e.type === 'IPD') todo.unshift({ t: '', txt: '입원 초기 간호사정 (24시간 안에)', tab: 'assess', c: 'stat' });
    const lv = H.lastVs(p.id); const nw = news(lv);
    return `<div class="gap-m">
      <div class="row between"><div class="row"><b>${esc(T.shiftName[shift()])}</b><span class="muted small">근무 단계를 누르면 그 화면으로 갑니다</span></div>
        ${UI.seg('wd.shift', [{ v: 'D', l: '낮번' }, { v: 'E', l: '초번' }, { v: 'N', l: '밤번' }], shift())}</div>
      <div class="shift-bar">${st.map((s) => `<button class="step ${s.done ? 'done' : ''}" data-act="wd.tab" data-v="${s.id}"><span class="n">${s.n}단계</span><b>${esc(s.t)}</b><span class="s">${s.done ? '✓ ' : ''}${esc(s.s)}</span></button>`).join('')}</div>
      <div class="grid2">
        <div class="panel"><div class="panel-h"><h3>이 환자 할 일</h3>${UI.chip(`${todo.length}건`, todo.length ? 'prog' : 'done')}</div><div class="todo">${todo.map((x) => `<button data-act="wd.tab" data-v="${x.tab}"><span class="t">${esc(x.t)}</span><span class="dot ${x.c}"></span><span class="grow">${esc(x.txt)}</span>${H.icon('send')}</button>`).join('') || '<div class="empty"><b>지금 할 일이 없습니다</b>라운딩·교육을 해 보세요.</div>'}</div></div>
        <div class="panel"><div class="panel-h"><h3>환자 요약</h3></div><div class="panel-b"><dl class="kv">
          <dt>진단</dt><dd>${esc((e.dx || []).map((d) => d.name).join(', ') || e.cc || '-')}</dd><dt>입원</dt><dd>${T.d(e.at)} (${Math.floor((Date.now() - e.at) / 86400000) + 1}일째)</dd>
          <dt>과거력</dt><dd>${esc(p.hx || '-')}</dd><dt>알레르기</dt><dd>${(p.allergies || []).map((a) => `<b style="color:var(--t-stat)">${esc(a.name)}</b> (${esc(a.reaction)})`).join(', ') || '없음'}</dd>
          <dt>식이</dt><dd>${esc(e.diet || '-')}</dd><dt>보호자</dt><dd>${esc(p.guardian || '-')}</dd>
          <dt>조기경보점수</dt><dd>${nw ? `<b class="num">${nw.s}점</b> ${UI.chip(nw.level.t, nw.level.c)}` : '-'}</dd></dl></div></div>
      </div></div>`;
  }

  function tabOrders(p, e) {
    const un = unacked(p.id);
    const act = S.where('orders', (o) => o.patientId === p.id && o.encId === e.id && !F.isOff(o) && (!F.isDone(o) || ['MED', 'INJ', 'NUR', 'DIET'].includes(o.cat))).sort((a, b) => a.cat.localeCompare(b.cat));
    const draw = S.where('orders', (o) => o.patientId === p.id && o.cat === 'LAB' && o.status === '전송' && o.code !== 'L1026');
    const bst = S.where('orders', (o) => o.patientId === p.id && o.code === 'L1026' && o.status === '전송');
    const proc = S.where('orders', (o) => o.patientId === p.id && o.cat === 'PROC' && o.status === '전송' && !(H.M.item(o.code) || {}).func);
    const nur = S.where('orders', (o) => o.patientId === p.id && o.cat === 'NUR' && !F.isOff(o));
    const ops = S.where('orders', (o) => o.patientId === p.id && o.cat === 'OP' && ['전송', '수술확정'].includes(o.status));
    const opPanel = ops.map((o) => { const op = o.op || {}; return `<div class="panel" style="border-color:var(--t-sent)"><div class="panel-h" style="background:var(--t-sent-soft)"><h3>수술 전 준비 — ${esc(o.name)}</h3>${F.chip(o)}</div><div class="panel-b">
      ${o.status === '전송' ? UI.note('수술실에서 아직 일정을 확정하지 않았습니다. 확정되면 알림이 옵니다.', 'info')
        : op.preop ? UI.note(`수술 전 준비 완료 (${esc(op.preop.by)} ${T.hm(op.preop.at)}) — ${esc(op.date)} ${esc(op.start)} ${esc(op.room)}`, 'ok')
        : `<form data-submit="wd.preop" class="gap-m"><input type="hidden" name="id" value="${o.id}">${UI.note(`수술: ${esc(op.date)} ${esc(op.start)} ${esc(op.room)} · ${esc(op.anes)}. 수술실에 내려가기 전에 모두 확인합니다.`, 'info')}
          <div class="gap-s">${(H.PREOP || []).map((t) => UI.check('c', t, false, { multi: true, value: t })).join('')}</div>
          <div class="btn-row end">${UI.btn('수술 전 준비 완료', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'check' })}</div></form>`}</div></div>`; }).join('');
    const dcPanel = e.dc ? `<div class="panel" style="border-color:var(--t-done)"><div class="panel-h" style="background:var(--t-done-soft)"><h3>퇴원 준비 — ${esc(e.dc.date || '')} ${esc(e.dc.form || '')}</h3></div><div class="panel-b">
      ${e.dc.ward ? UI.note(`퇴원 준비 완료 (${esc(e.dc.ward.by)} ${T.hm(e.dc.ward.at)}) — 보험 심사 → 원무 수납을 기다립니다.${e.dc.review ? ' 심사 완료.' : ''}`, 'ok')
        : `<form data-submit="wd.dcPrep" class="gap-m">${UI.note(`의사 메모: ${esc(e.dc.memo || '-')} · 다음 외래: ${esc(e.dc.fu || '-')}`, 'info')}
          <div class="gap-s">${['퇴원약 받아서 복용법·부작용 교육', '다음 외래 날짜·검사 안내', '정맥 주사로 제거 (출혈 확인)', '상처·배액관 관리 교육', '이상 증상 생기면 연락할 곳 안내 (응급실)', '식이·활동 교육', '개인 물품·귀중품 돌려드림'].map((t) => UI.check('c', t, false, { multi: true, value: t })).join('')}</div>
          <div class="btn-row end">${UI.btn('퇴원 준비 완료', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'check' })}</div></form>`}</div></div>` : '';
    return `<div class="gap-m">${dcPanel}${opPanel}
      ${un.length ? `<div class="panel" style="border-color:var(--t-prog)"><div class="panel-h" style="background:var(--t-prog-soft)"><h3>새 처방 — 간호사 확인 필요 (${un.length})</h3><span class="grow"></span>${UI.btn('모두 확인', 'wd.ackAll', { kind: 'pri', size: 'sm', icon: 'check' })}</div><div class="panel-b">
        ${UI.note('의사 처방을 받으면 간호사는 내용(환자·약·용량·방법·시간)을 확인하고 서명합니다. 이상하면 수행 전에 의사에게 물어봅니다. 구두처방은 반드시 확인 서명합니다.', 'info')}
        <div style="margin-top:.6rem">${V.orderTable(un, { actions: (o) => UI.btn(o.verbal ? '구두처방 확인 서명' : '확인', 'wd.ack', { size: 'sm', kind: 'pri', data: { id: o.id } }) })}</div></div></div>` : UI.note('새로 받은 처방을 모두 확인했습니다.', 'ok')}
      ${draw.length ? `<div class="panel"><div class="panel-h"><h3>병동 채혈 (${draw.length})</h3><span class="grow"></span>${UI.btn('라벨 출력', 'wd.label', { size: 'sm', icon: 'barcode' })}${UI.btn('채혈 완료 → 검사실', 'wd.draw', { size: 'sm', kind: 'pri', icon: 'drop' })}</div><div class="panel-b small">${draw.map((o) => `${esc(o.name)} <span class="muted">(${esc(H.M.item(o.code).tube)})</span>`).join(' · ')}</div></div>` : ''}
      ${bst.length ? `<div class="panel"><div class="panel-h"><h3>침상 옆 혈당 측정</h3></div><div class="panel-b"><form data-submit="wd.bst" class="row"><input type="hidden" name="id" value="${bst[0].id}">${UI.input('v', '혈당 (mg/dL)', '', { type: 'number' })}${UI.btn('측정값 저장', '', { type: 'submit', kind: 'pri' })}</form></div></div>` : ''}
      ${proc.length ? `<div class="panel"><div class="panel-h"><h3>처치·시술</h3></div><div class="panel-b">${UI.table([{ h: '처치' }, { h: '처방 시각' }, { h: '' }], proc.map((o) => [`<b>${esc(o.name)}</b>${o.stat ? ' ' + UI.chip('응급', 'stat') : ''}`, `<span class="num small">${T.mdhm(o.at)}</span>`, UI.btn('시행 완료', 'wd.proc', { size: 'sm', kind: 'pri', data: { id: o.id } })]))}</div></div>` : ''}
      ${nur.length ? `<div class="panel"><div class="panel-h"><h3>간호처방 수행</h3></div><div class="panel-b">${UI.table([{ h: '간호처방' }, { h: '이번 근무 수행' }, { h: '' }], nur.map((o) => { const n = S.where('acts', (a) => a.orderId === o.id && inShift(a.at)).length; return [`<b>${esc(o.name)}</b>`, `<span class="num">${n}회</span>`, UI.btn('수행 기록', 'wd.nur', { size: 'sm', data: { id: o.id } })]; }))}</div></div>` : ''}
      <div class="panel"><div class="panel-h"><h3>현재 유효한 처방 (카덱스)</h3></div><div class="panel-b">${V.orderTable(act)}</div></div>
    </div>`;
  }

  function tabMar(p, e) {
    const meds = medOrders(p.id);
    const today = T.startOfDay();
    const cell = (o, s) => {
      const st = slotState(o, s);
      if (st.k === 'done') return `<button class="btn sm" style="border-color:var(--t-done);color:var(--t-done)" data-act="wd.marView" data-id="${st.m.id}">✓ ${T.hm(st.m.at)}</button>`;
      if (st.k === 'off') return `<button class="btn sm" data-act="wd.marView" data-id="${st.m.id}">${esc(st.m.status)}</button>`;
      if (st.k === 'wait') return `<span class="chip plain" title="약제부에서 아직 올라오지 않음">${esc(s.label)} 약 미도착</span>`;
      if (st.k === 'future') return `<span class="muted small num">${esc(s.label)}</span>`;
      return UI.btn(`${s.label} ${st.k === 'late' ? '지연' : '투약'}`, 'wd.give', { size: 'sm', kind: st.k === 'late' ? 'danger' : 'pri', data: { id: o.id, ts: s.ts } });
    };
    const rows = meds.map((o) => {
      const it = H.M.item(o.code);
      const slots = slotsFor(o);
      const prnN = S.where('mar', (m) => m.orderId === o.id && m.at >= today).length;
      return [
        `<b>${esc(o.name)}</b> ${it.highAlert ? UI.chip('고위험', 'stat') : ''}${it.narcotic ? UI.chip(it.narcotic, 'purple') : ''}<div class="small muted">${esc(V.doseText(o))}${o.note ? ' · ' + esc(o.note) : ''}</div>`,
        F.chip(o),
        o.freq === 'PRN' ? `<div class="row">${o.status === '불출' ? UI.btn('필요시 투약', 'wd.give', { size: 'sm', data: { id: o.id, ts: '' } }) : UI.chip('약 미도착', 'plain')}<span class="small muted">오늘 ${prnN}회</span></div>`
          : o.freq === 'CONT' ? (() => { const ms2 = S.where('mar', (m) => m.orderId === o.id).sort((a, b) => b.at - a.at)[0]; return `<div class="row">${ms2 ? `${UI.chip('주입 중', 'done')}<span class="small muted">시작 ${T.mdhm(ms2.at)}</span>` : ''}${o.status === '불출' ? UI.btn(ms2 ? '수액 교체 기록' : '주입 시작', 'wd.give', { size: 'sm', kind: ms2 ? '' : 'pri', data: { id: o.id, ts: ms2 ? '' : o.arrivedAt || o.at } }) : UI.chip('약 미도착', 'plain')}</div>`; })()
          : `<div class="row" style="gap:.3rem">${slots.map((s) => cell(o, s)).join('') || '<span class="muted small">오늘 투약 없음</span>'}</div>`,
      ];
    });
    const blood = S.where('orders', (o) => o.patientId === p.id && o.cat === 'BLOOD' && !F.isOff(o));
    return `<div class="gap-m">
      ${UI.note('투약 5가지 원칙: 맞는 <b>환자</b>·<b>약</b>·<b>용량</b>·<b>경로</b>·<b>시간</b>. 투약 전 환자 팔찌와 약 바코드를 찍어 확인합니다. 시간 기준 ±1시간 안에 투약합니다.', 'info')}
      <div class="panel"><div class="panel-h"><h3>투약 기록 (MAR) — ${T.d(Date.now())}</h3></div><div class="panel-b">${UI.table([{ h: '약 · 용량' }, { h: '약제부' }, { h: '오늘 투약 시간' }], rows, { empty: UI.empty('투약할 약이 없습니다') })}</div></div>
      ${blood.length ? `<div class="panel"><div class="panel-h"><h3>수혈</h3></div><div class="panel-b">${UI.table([{ h: '혈액제제' }, { h: '상태' }, { h: '혈액번호' }, { h: '' }], blood.map((o) => [`<b>${esc(o.name)}</b><div class="small muted">${esc(o.note || '')}</div>`, F.chip(o), `<span class="mono small">${esc(o.bagNo || '-')}</span>`,
        o.status !== '출고' ? '<span class="small muted">혈액은행 준비 중</span>' : o.transfused ? `${UI.chip(o.transfused.end ? '수혈 완료' : '수혈 중', o.transfused.end ? 'done' : 'prog')} ${!o.transfused.end ? UI.btn('수혈 종료 기록', 'wd.bloodEnd', { size: 'sm', data: { id: o.id } }) : ''}` : UI.btn('수혈 시작', 'wd.bloodStart', { size: 'sm', kind: 'danger', data: { id: o.id } })]))}</div></div>` : ''}
    </div>`;
  }

  function vsForm(p) {
    const on = S.where('orders', (o) => o.patientId === p.id && o.code === 'N5007' && !F.isOff(o)).length > 0;
    return `<form data-submit="wd.vs" class="gap-m"><div class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))">
      ${UI.input('sbp', '수축기 혈압', '', { type: 'number' })}${UI.input('dbp', '이완기 혈압', '', { type: 'number' })}${UI.input('hr', '맥박 (회/분)', '', { type: 'number' })}
      ${UI.input('rr', '호흡 (회/분)', '', { type: 'number' })}${UI.input('bt', '체온 (℃)', '', { type: 'number', step: '0.1' })}${UI.input('spo2', '산소포화도 (%)', '', { type: 'number' })}
      ${UI.input('pain', '통증 (0~10)', '', { type: 'number' })}${UI.input('bst', '혈당 (선택)', '', { type: 'number' })}</div>
      <div class="row">${UI.fld('의식 (AVPU)', UI.pick('avpu', [{ v: 'A', l: '명료 (A)' }, { v: 'V', l: '부르면 반응 (V)' }, { v: 'P', l: '통증에만 반응 (P)' }, { v: 'U', l: '반응 없음 (U)' }], 'A'))}${UI.check('o2', '산소 투여 중', on)}</div>
      <div class="btn-row end">${UI.btn('측정기에서 불러오기 (사례값)', 'wd.vsFill', { icon: 'refresh' })}${UI.btn('활력징후 저장', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'check' })}</div></form>`;
  }
  function tabVs(p) {
    const io = S.where('io', (x) => x.patientId === p.id && x.at > Date.now() - 24 * HR).sort((a, b) => b.at - a.at);
    const sum = (k, f) => io.filter((x) => x.kind === k && (!f || inShift(x.at))).reduce((s, x) => s + Number(x.amount || 0), 0);
    const lv = H.lastVs(p.id); const nw = news(lv);
    return `<div class="gap-m">
      <div class="grid2"><div class="panel"><div class="panel-h"><h3>활력징후 측정</h3>${nw ? `<span class="grow"></span><span class="small">최근 조기경보점수 <b class="num">${nw.s}</b></span>${UI.chip(nw.level.t, nw.level.c)}` : ''}</div><div class="panel-b">${vsForm(p)}</div></div>
      <div class="panel"><div class="panel-h"><h3>섭취량·배설량 (I/O)</h3></div><div class="panel-b gap-m">
        <form data-submit="wd.io" class="gap-s">${UI.fld('구분', UI.pick('kind', [{ v: 'in', l: '섭취 (들어간 것)' }, { v: 'out', l: '배설 (나온 것)' }], 'in'))}
          <div class="form-grid">${UI.select('type', '종류', ['먹은 물·음식', '정맥 수액·주사', '경관 영양', '수혈', '소변', '대변', '구토', '배액관', '출혈'], '먹은 물·음식')}${UI.input('amount', '양 (mL)', '', { type: 'number' })}</div>
          <div class="btn-row end">${UI.btn('기록', '', { type: 'submit', kind: 'pri' })}</div></form>
        <div class="mini-vs"><div><div class="k">이번 근무 섭취</div><div class="v">${sum('in', 1)}mL</div></div><div><div class="k">이번 근무 배설</div><div class="v">${sum('out', 1)}mL</div></div>
          <div><div class="k">24시간 섭취</div><div class="v">${sum('in')}mL</div></div><div><div class="k">24시간 균형</div><div class="v" style="${sum('in') - sum('out') > 500 ? 'color:var(--t-stat)' : ''}">${sum('in') - sum('out') > 0 ? '+' : ''}${sum('in') - sum('out')}mL</div></div></div>
      </div></div></div>
      <div class="panel"><div class="panel-h"><h3>활력징후 흐름표 (최근 3일)</h3></div><div class="panel-b">${V.vsChart(p.id)}</div></div>
      <div class="panel"><div class="panel-h"><h3>기록 목록</h3></div><div class="panel-b">${UI.table([{ h: '시각' }, { h: '혈압' }, { h: '맥박' }, { h: '호흡' }, { h: '체온' }, { h: '산소' }, { h: '통증' }, { h: '경보점수' }, { h: '기록자' }], S.where('vitals', (v) => v.patientId === p.id).sort((a, b) => b.at - a.at).slice(0, 18).map((v) => { const n = news(v); return [`<span class="num">${T.mdhm(v.at)}</span>`, `${v.sbp || '-'}/${v.dbp || '-'}`, v.hr, v.rr, v.bt >= 38 ? `<span class="hl-h">${v.bt}</span>` : v.bt, v.spo2, v.pain, n ? UI.chip(String(n.s), n.level.c) : '', `<span class="small">${esc(v.by)}</span>`]; }), { maxH: '24rem' })}</div></div>
    </div>`;
  }

  // ── 간호사정 도구 ──
  const opt = (pairs) => pairs.map(([v, l]) => ({ v, l: `${l} (${v})` }));
  const SCALES = {
    initial: { l: '입원 초기 간호사정' },
    morse: { l: '낙상 위험 (Morse)', items: [
      ['hx', '3개월 안에 넘어진 적', opt([[0, '없음'], [25, '있음']])], ['dx2', '진단이 2개 이상', opt([[0, '아니오'], [15, '예']])],
      ['aid', '걸을 때 도움', opt([[0, '없음·침상 안정·간호사 도움'], [15, '목발·지팡이·보행기'], [30, '가구를 붙잡고 걸음']])], ['iv', '정맥주사·헤파린 잠금', opt([[0, '없음'], [20, '있음']])],
      ['gait', '걸음걸이', opt([[0, '정상·침상 안정·휠체어'], [10, '허약함'], [20, '장애 있음']])], ['mental', '정신 상태', opt([[0, '자기 능력을 정확히 앎'], [15, '능력을 과대평가하거나 잊음']])]],
      level: (s) => s >= 45 ? '고위험' : s >= 25 ? '중위험' : '저위험' },
    braden: { l: '욕창 위험 (Braden)', items: [
      ['sens', '감각 인지', opt([[1, '완전 제한'], [2, '매우 제한'], [3, '약간 제한'], [4, '장애 없음']])], ['moist', '습기', opt([[1, '항상 젖어 있음'], [2, '자주 젖음'], [3, '가끔 젖음'], [4, '거의 젖지 않음']])],
      ['act', '활동', opt([[1, '침상 안정'], [2, '의자에 앉을 수 있음'], [3, '가끔 걸음'], [4, '자주 걸음']])], ['mob', '움직임', opt([[1, '전혀 못 움직임'], [2, '매우 제한'], [3, '약간 제한'], [4, '제한 없음']])],
      ['nut', '영양', opt([[1, '매우 나쁨'], [2, '부족할 수 있음'], [3, '적절함'], [4, '아주 좋음']])], ['fric', '마찰·밀림', opt([[1, '문제 있음'], [2, '잠재적 문제'], [3, '문제 없음']])]],
      level: (s) => s <= 9 ? '매우 높은 위험' : s <= 12 ? '높은 위험' : s <= 14 ? '중등도 위험' : s <= 18 ? '경도 위험' : '위험 없음' },
    pain: { l: '통증 (숫자 척도 NRS)', items: [['score', '통증 점수 (0 = 없음, 10 = 상상할 수 있는 가장 심한 통증)', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => ({ v, l: String(v) }))]],
      extra: () => `<div class="form-grid">${UI.input('site', '부위', '')}${UI.select('type', '양상', ['쑤시는 듯', '찌르는 듯', '쥐어짜는 듯', '타는 듯', '욱신거림', '뻐근함'], '쑤시는 듯')}${UI.input('dur', '지속 시간', '')}${UI.input('factor', '악화·완화 요인', '')}</div>`,
      level: (s) => s >= 7 ? '심한 통증' : s >= 4 ? '중등도 통증' : s >= 1 ? '경도 통증' : '통증 없음' },
    flacc: { l: '통증 (말 못 하는 환자 FLACC)', items: [
      ['f', '얼굴', opt([[0, '편안함'], [1, '가끔 찡그림'], [2, '자주 찡그림·턱 떨림']])], ['l', '다리', opt([[0, '편안함'], [1, '불안·긴장'], [2, '발차기·다리 들어올림']])],
      ['a', '활동', opt([[0, '조용히 누워 있음'], [1, '몸을 비틂'], [2, '몸이 활처럼 휨·경직']])], ['c', '울음', opt([[0, '울지 않음'], [1, '신음·훌쩍임'], [2, '계속 울음·비명']])], ['co', '달래짐', opt([[0, '편안함'], [1, '안아 주면 달래짐'], [2, '달래기 어려움']])]],
      level: (s) => s >= 7 ? '심한 통증' : s >= 4 ? '중등도 통증' : s >= 1 ? '경도 통증' : '통증 없음' },
    gcs: { l: '의식 (GCS)', items: [
      ['e', '눈 뜨기 (E)', opt([[4, '저절로'], [3, '부르면'], [2, '통증 자극에'], [1, '안 뜸']])], ['v', '말 (V)', opt([[5, '지남력 있음'], [4, '혼돈'], [3, '부적절한 단어'], [2, '이해 못 할 소리'], [1, '없음']])],
      ['m', '움직임 (M)', opt([[6, '지시에 따름'], [5, '통증 위치 앎'], [4, '회피'], [3, '이상 굴곡'], [2, '이상 신전'], [1, '없음']])]],
      extra: () => `<div class="form-grid">${UI.select('pupR', '오른쪽 동공', ['3mm 빛 반사 있음', '2mm 빛 반사 있음', '4mm 느림', '6mm 반사 없음'], '3mm 빛 반사 있음')}${UI.select('pupL', '왼쪽 동공', ['3mm 빛 반사 있음', '2mm 빛 반사 있음', '4mm 느림', '6mm 반사 없음'], '3mm 빛 반사 있음')}</div>`,
      level: (s) => s <= 8 ? '중증 (기도 확보 고려)' : s <= 12 ? '중등도' : '경도' },
    nutri: { l: '영양 선별', items: [
      ['bmi', '체질량지수 20.5 미만', opt([[0, '아니오'], [1, '예']])], ['loss', '최근 3개월 체중 감소', opt([[0, '아니오'], [1, '예']])],
      ['intake', '지난주 식사량 줄어듦', opt([[0, '아니오'], [1, '예']])], ['sev', '중환자이거나 심한 질병', opt([[0, '아니오'], [1, '예']])]],
      level: (s) => s >= 1 ? '영양 위험 — 영양팀 상담 의뢰' : '영양 위험 없음' },
    adl: { l: '일상생활 수행 (간이 바델)', items: ['식사', '옷 입기', '화장실 이용', '침대↔의자 이동', '목욕'].map((t, i) => ['a' + i, t, opt([[0, '전적으로 도움 필요'], [5, '일부 도움'], [10, '혼자 함']])]),
      level: (s) => s >= 45 ? '독립' : s >= 25 ? '부분 의존' : '전적 의존' },
  };
  function scaleScore(kind, d) { const sc = SCALES[kind]; return sc.items.reduce((s, [k]) => s + (H.num(d[k]) || 0), 0); }
  function tabAssess(p, e) {
    const kind = ms('scale', H.lastAssess(p.id, 'initial') || e.type !== 'IPD' ? 'morse' : 'initial');
    const sc = SCALES[kind];
    let form;
    if (kind === 'initial') {
      form = `<form data-submit="wd.assess" class="gap-m"><input type="hidden" name="_kind" value="initial">
        ${UI.note('입원 초기 간호사정: 입원 후 24시간 안에 환자 전체 상태를 확인하고 기록합니다.', 'info')}
        <div class="form-grid">
          ${UI.fld('입원 경로', UI.pick('route', ['외래 경유', '응급실 경유', '다른 병원 전원'], e.fromEnc ? '응급실 경유' : '외래 경유'))}
          ${UI.input('cc', '주호소', e.cc || '', { cls: 'wide' })}${UI.input('pmh', '과거력', p.hx || '', { cls: 'wide' })}
          ${UI.fld('알레르기 재확인', `<b>${(p.allergies || []).map((a) => esc(a.name)).join(', ') || '없음'}</b> — 환자에게 직접 다시 물어봄`, 'wide')}
          ${UI.fld('의사소통', UI.pick('comm', ['원활함', '청력 저하', '언어 장애', '외국어 (통역 필요)'], '원활함'))}
          ${UI.fld('시력', UI.pick('vision', ['정상', '안경', '저하'], '정상'))}
          ${UI.select('habit', '흡연·음주', ['안 함', '흡연', '음주', '흡연·음주'], '안 함')}${UI.select('elim', '배설', ['정상', '변비', '설사', '배뇨 곤란', '도뇨관'], '정상')}
          ${UI.select('sleep', '수면', ['정상', '잠들기 어려움', '자주 깸', '수면제 복용'], '정상')}${UI.select('mind', '심리 상태', ['안정', '불안', '우울', '분노'], '안정')}
          ${UI.input('religion', '종교', '')}${UI.input('care', '주 돌봄 제공자', p.guardian || '')}
        </div>
        ${UI.sec('입원 생활 안내 (환자·보호자에게)')}
        <div class="row">${['병실·화장실 위치', '호출벨 사용법', '낙상 예방', '식사 시간', '면회 규칙', '귀중품 관리', '화재 시 대피로'].map((t) => UI.check('guide', t, false, { multi: true, value: t })).join('')}</div>
        <div class="btn-row end">${UI.btn('초기 간호사정 저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
    } else {
      form = `<form data-submit="wd.assess" class="gap-m" id="as-form"><input type="hidden" name="_kind" value="${kind}">
        ${sc.items.map(([k, q, o]) => `<div class="q-block"><div class="q">${esc(q)}</div>${UI.pick(k, o, '', { on: 'wd.calc' })}</div>`).join('')}
        ${sc.extra ? sc.extra() : ''}
        <div class="row between box"><div><span class="muted small">점수</span> <span class="score-big" id="as-score">-</span> <span id="as-level"></span></div>${UI.btn('사정 저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
    }
    const hist = S.where('assess', (a) => a.patientId === p.id).sort((a, b) => b.at - a.at);
    return `<div class="gap-m">${UI.seg('wd.scale', Object.entries(SCALES).map(([k, v]) => ({ v: k, l: v.l })), kind)}
      <div class="grid2" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)"><div class="panel"><div class="panel-h"><h3>${esc(sc.l)}</h3></div><div class="panel-b">${form}</div></div>
      <div class="panel"><div class="panel-h"><h3>사정 기록</h3></div><div class="panel-b">${UI.table([{ h: '시각' }, { h: '도구' }, { h: '점수' }, { h: '판정' }], hist.map((a) => [`<span class="num small">${T.mdhm(a.at)}</span>`, esc((SCALES[a.kind] || { l: a.kind }).l), a.score == null ? '-' : `<b class="num">${a.score}</b>`, esc(a.level)]), { empty: UI.empty('사정 기록이 없습니다') })}</div></div></div></div>`;
  }

  // ── 간호기록 ──
  function notesList(pid) {
    const list = S.where('nnotes', (n) => n.patientId === pid).sort((a, b) => b.at - a.at);
    if (!list.length) return UI.empty('간호기록이 없습니다');
    return `<div class="gap-s">${list.map((n) => `<div class="box" style="background:var(--surface)"><div class="row between"><div class="row">${UI.chip(n.format === 'DAR' ? 'Focus-DAR' : n.format === 'NANDA' ? '간호과정' : '서술', n.format === 'DAR' ? 'sent' : n.format === 'NANDA' ? 'purple' : 'plain')}<b class="small">${esc(n.by)}</b></div><span class="num small muted">${T.dhm(n.at)}</span></div>
      ${n.format === 'DAR' ? `<dl class="kv" style="margin:.4rem 0 0"><dt>초점 (Focus)</dt><dd><b>${esc(n.focus)}</b></dd><dt>D 자료</dt><dd>${esc(n.D)}</dd><dt>A 간호활동</dt><dd>${esc(n.A)}</dd><dt>R 반응</dt><dd>${esc(n.R)}</dd></dl>`
        : n.format === 'NANDA' ? `<dl class="kv" style="margin:.4rem 0 0"><dt>간호진단</dt><dd><b>${esc(n.dx)}</b></dd><dt>목표</dt><dd>${esc(n.goal)}</dd><dt>중재</dt><dd>${(n.iv || []).map(esc).join(' · ')}</dd><dt>평가</dt><dd>${esc(n.eval)}</dd></dl>`
        : `<p class="pre" style="margin:.4rem 0 0">${esc(n.text)}</p>`}</div>`).join('')}</div>`;
  }
  H.wardView = { notesList };
  function tabNote(p) {
    const fmt = ms('nfmt', 'DAR');
    const nd = H.M.NANDA.find((x) => x.code === ms('nanda', '00132')) || H.M.NANDA[0];
    let form;
    if (fmt === '서술') form = `${UI.textarea('text', '서술 기록', '', { h: '8rem', ph: '시간 순서대로 관찰한 것과 한 일을 씁니다. 예: 14:00 라운딩 시 침상에서 휴식 중. 통증 3점 호소...' })}`;
    else if (fmt === 'DAR') form = `<div class="form-grid">${UI.input('focus', '초점 (Focus) — 환자의 문제·관심사', '', { cls: 'wide', ph: '예: 고체온, 급성 통증, 낙상 위험' })}
      ${UI.textarea('D', 'D 자료 (Data) — 관찰한 주관적·객관적 자료', '', { h: '4rem' })}${UI.textarea('A', 'A 간호활동 (Action) — 내가 한 간호', '', { h: '4rem' })}${UI.textarea('R', 'R 반응 (Response) — 간호 후 환자 반응', '', { h: '4rem' })}</div>`;
    else form = `<div class="gap-m"><div class="fld"><label for="nanda-sel">간호진단 (NANDA)</label><select id="nanda-sel" class="inp" data-chg="wd.nanda">${H.M.NANDA.map((x) => `<option value="${x.code}"${x.code === nd.code ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
      ${UI.input('goal', '목표 (기대 결과)', nd.goal, { cls: 'wide' })}
      <div class="fld"><span class="lbl">간호 중재 (한 것에 표시)</span><div class="gap-s">${nd.iv.map((t) => UI.check('iv', t, true, { multi: true, value: t })).join('')}</div></div>
      ${UI.textarea('eval', '평가', '', { h: '3rem', ph: '목표를 얼마나 이루었는지' })}<input type="hidden" name="dx" value="${esc(nd.name)}"></div>`;
    return `<div class="grid2"><div class="panel"><div class="panel-h"><h3>간호기록 쓰기</h3></div><div class="panel-b"><form data-submit="wd.note" class="gap-m">
      ${UI.seg('wd.nfmt', [{ v: 'DAR', l: 'Focus-DAR' }, { v: 'NANDA', l: '간호과정 (진단-중재-평가)' }, { v: '서술', l: '서술 기록' }], fmt)}
      <input type="hidden" name="_fmt" value="${fmt}">${form}
      <div class="btn-row end">${fmt === 'DAR' ? UI.btn('최근 자료로 채우기', 'wd.noteFill', { icon: 'refresh' }) : ''}${UI.btn('서명하고 저장', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'check' })}</div></form></div></div>
      <div class="panel"><div class="panel-h"><h3>간호기록 목록</h3></div><div class="panel-b" style="max-height:44rem;overflow-y:auto">${notesList(p.id)}</div></div></div>`;
  }

  // ── 소통 (SBAR) ──
  function tabComm(p, e) {
    const list = S.where('comms', (c) => c.patientId === p.id).sort((a, b) => b.at - a.at);
    const verbal = S.where('orders', (o) => o.patientId === p.id && o.verbal && !o.nurseAck);
    return `<div class="grid2"><div class="panel"><div class="panel-h"><h3>의사에게 알리기 (SBAR 노티)</h3></div><div class="panel-b"><form data-submit="wd.sbar" class="gap-m">
        ${UI.note('SBAR: <b>S</b> 상황(지금 무슨 일) → <b>B</b> 배경(관련 병력·치료) → <b>A</b> 평가(내 판단) → <b>R</b> 요청(무엇을 원하는지). 짧고 정확하게!', 'info')}
        ${UI.select('to', '받는 사람', [`${H.M.doctor(e.doctorId).name} (${H.M.doctor(e.doctorId).dept} 주치의)`, '당직 전공의', '신속대응팀 (RRT)'], `${H.M.doctor(e.doctorId).name} (${H.M.doctor(e.doctorId).dept} 주치의)`)}
        ${UI.textarea('S', 'S 상황', '', { h: '3rem' })}${UI.textarea('B', 'B 배경', '', { h: '3rem' })}${UI.textarea('A', 'A 평가', '', { h: '3rem' })}${UI.textarea('R', 'R 요청', '', { h: '3rem' })}
        ${UI.check('urgent', '긴급 (바로 와서 봐 주세요)', false)}
        <div class="btn-row end">${UI.btn('현재 자료로 채우기', 'wd.sbarFill', { icon: 'refresh' })}${UI.btn('노티 보내기', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'send' })}</div></form></div></div>
      <div class="gap-m">${verbal.length ? `<div class="panel" style="border-color:var(--t-prog)"><div class="panel-h" style="background:var(--t-prog-soft)"><h3>구두처방 확인 서명 필요 (${verbal.length})</h3></div><div class="panel-b">${V.orderTable(verbal, { actions: (o) => UI.btn('되읽기 후 서명', 'wd.ack', { size: 'sm', kind: 'pri', data: { id: o.id } }) })}</div></div>` : ''}
        <div class="panel"><div class="panel-h"><h3>주고받은 노티</h3></div><div class="panel-b gap-s">${list.map((c) => `<div class="bubble me"><div class="row between"><div class="row">${c.urgent ? UI.chip('긴급', 'stat') : ''}${UI.chip(c.status, c.status === '보냄' ? 'sent' : 'done')}<b class="small">${esc(c.from)} → ${esc(c.to)}</b></div><span class="num small muted">${T.mdhm(c.at)}</span></div>
          <div class="small" style="margin-top:.3rem"><b>S</b> ${esc(c.S)}<br><b>B</b> ${esc(c.B)}<br><b>A</b> ${esc(c.A)}<br><b>R</b> ${esc(c.R)}</div></div>
          ${c.reply ? `<div class="bubble" style="margin-left:1.5rem"><b class="small">${esc(c.replyBy)}</b> <span class="num small muted">${T.mdhm(c.replyAt)}</span><div>${esc(c.reply)}</div></div>` : '<p class="small muted" style="margin:0 0 0 1.5rem">의사 답변 기다리는 중 — 처방 화면(간호사 노티 탭)에서 의사 역할로 답할 수 있습니다.</p>'}`).join('') || UI.empty('주고받은 노티가 없습니다')}</div></div></div></div>`;
  }

  // ── 응급 (코드블루) ──
  let code = null; let codeTimer = null;
  const CODE_BTNS = [['흉부 압박 시작', ''], ['기도 확보 (앰부 백 환기)', ''], ['심전도 리듬: 심실세동 (VF)', 'warn'], ['심전도 리듬: 무수축', 'warn'], ['제세동 200J', 'danger'], ['에피네프린 1mg 정맥주사', 'danger'], ['아미오다론 300mg 정맥주사', 'danger'], ['기관 내 삽관', ''], ['정맥로 확보', ''], ['맥박 확인 (2분마다)', ''], ['자발 순환 회복 (ROSC)', 'pri'], ['보호자에게 연락', '']];
  function tabCode(p) {
    const past = S.where('codes', (c) => c.patientId === p.id).sort((a, b) => b.start - a.start);
    if (!code || code.pid !== p.id) {
      return `<div class="gap-m">${p.flags && p.flags.dnr ? UI.note('<b>이 환자는 심폐소생술 거부(DNR) 동의서가 있습니다.</b> 동의서 범위를 확인하고, 심정지 시 심폐소생술을 하지 않습니다. 주치의와 보호자에게 알립니다.', 'danger') : ''}
        <div class="grid2"><div class="panel"><div class="panel-h"><h3>심정지 — 코드블루</h3></div><div class="panel-b gap-m">
          ${UI.note('환자가 반응이 없고 숨을 쉬지 않으면: ① 도움 요청 (코드블루 방송 ☎ 원내 응급번호) ② 바로 흉부 압박 ③ 응급카트·제세동기 가져오기. 아래 버튼을 누르면 기록지가 시작되고 시간이 자동으로 기록됩니다.', 'danger')}
          ${UI.btn('코드블루 시작 (심폐소생술 기록 시작)', 'wd.codeStart', { kind: 'danger', size: 'lg', block: true, icon: 'siren' })}</div></div>
        <div class="panel"><div class="panel-h"><h3>신속대응팀 (RRT) 호출</h3></div><div class="panel-b gap-m">
          ${UI.note('심정지 전에 상태가 나빠지는 신호(조기경보점수 7점 이상, 갑자기 의식 저하, 산소포화도 90% 미만 등)가 보이면 신속대응팀을 부릅니다.', 'warn')}
          ${UI.btn('신속대응팀 호출', 'wd.rrt', { kind: 'warn', size: 'lg', block: true, icon: 'alert' })}</div></div></div>
        <div class="panel"><div class="panel-h"><h3>지난 응급 기록</h3></div><div class="panel-b">${past.map((c) => `<div class="box" style="background:var(--surface)"><div class="row between"><b>${T.dhm(c.start)} 시작 · ${Math.round((c.end - c.start) / 60000)}분</b>${UI.chip(c.outcome, c.outcome.includes('회복') ? 'done' : 'stat')}</div><div class="timeline" style="margin-top:.5rem">${c.events.map((ev) => `<div class="ti"><span class="t">${T.hm(ev.t)} (+${Math.floor((ev.t - c.start) / 60000)}:${H.pad(Math.floor(((ev.t - c.start) % 60000) / 1000))})</span> ${esc(ev.text)}</div>`).join('')}</div></div>`).join('') || UI.empty('응급 기록이 없습니다')}</div></div></div>`;
    }
    return `<div class="panel" style="border-color:var(--t-stat)"><div class="panel-h" style="background:var(--t-stat-soft)"><h3 style="color:var(--t-stat)">${H.icon('siren')} 코드블루 진행 중 — ${esc(p.name)}</h3></div><div class="panel-b gap-m">
      <div class="code-timer" id="code-timer">00:00</div>
      <div class="code-btns">${CODE_BTNS.map(([t, k]) => UI.btn(t, 'wd.codeEv', { kind: k, data: { t } })).join('')}</div>
      <div class="timeline">${code.events.slice().reverse().map((ev) => `<div class="ti"><span class="t">${T.hm(ev.t)} (+${Math.floor((ev.t - code.start) / 60000)}:${H.pad(Math.floor(((ev.t - code.start) % 60000) / 1000))})</span> ${esc(ev.text)}</div>`).join('')}</div>
      <form data-submit="wd.codeEnd" class="row">${UI.select('outcome', '결과', ['자발 순환 회복 → 중환자실 이송', '자발 순환 회복 → 병동 관찰', '사망 선언'], '자발 순환 회복 → 중환자실 이송')}${UI.btn('코드블루 종료·기록 저장', '', { type: 'submit', kind: 'danger', size: 'lg' })}</form>
    </div></div>`;
  }
  function tickCode() {
    const el = document.getElementById('code-timer');
    if (!el || !code) return;
    const s = Math.floor((Date.now() - code.start) / 1000);
    el.textContent = `${H.pad(Math.floor(s / 60))}:${H.pad(s % 60)}`;
  }

  // ── 평시 활동 ──
  function tabActs(p) {
    const list = S.where('acts', (a) => a.patientId === p.id && !a.orderId).sort((a, b) => b.at - a.at);
    return `<div class="grid3">
      <div class="panel"><div class="panel-h"><h3>환자 교육</h3></div><div class="panel-b"><form data-submit="wd.edu" class="gap-m">${UI.select('topic', '교육 주제', H.M.EDU, H.M.EDU[0])}
        ${UI.fld('대상', UI.pick('who', ['환자', '보호자', '환자·보호자'], '환자'))}${UI.fld('방법', UI.pick('how', ['말로 설명', '안내문', '시범·따라 하기', '동영상'], '말로 설명'))}
        ${UI.fld('이해도 (되묻기로 확인)', UI.pick('und', ['잘 이해함', '일부 이해', '재교육 필요'], '잘 이해함'))}${UI.btn('교육 기록', '', { type: 'submit', kind: 'pri', block: true })}</form></div></div>
      <div class="panel"><div class="panel-h"><h3>시간별 라운딩</h3></div><div class="panel-b"><form data-submit="wd.round" class="gap-m">
        ${UI.note('1~2시간마다 병실을 돌며 4가지를 확인합니다.', 'info')}
        <div class="gap-s">${['통증 확인 (Pain)', '화장실 필요 (Potty)', '자세·체위 (Position)', '호출벨·물건 손 닿게 (Possession)', '침상 난간·바퀴 잠금', '수액·라인 상태'].map((t) => UI.check('r', t, false, { multi: true, value: t })).join('')}</div>
        ${UI.input('memo', '메모', '')}${UI.btn('라운딩 기록', '', { type: 'submit', kind: 'pri', block: true })}</form></div></div>
      <div class="panel"><div class="panel-h"><h3>활동 기록</h3></div><div class="panel-b gap-s" style="max-height:30rem;overflow-y:auto">${list.map((a) => `<div class="box"><div class="row between"><b class="small">${esc(a.kind)}</b><span class="num small muted">${T.mdhm(a.at)}</span></div><div class="small">${esc(a.text)}</div></div>`).join('') || UI.empty('기록이 없습니다')}</div></div>
    </div>`;
  }

  // ── 인수인계 ──
  function draftHandoff(p, e) {
    const lv = H.lastVs(p.id); const nw = news(lv);
    const meds = medOrders(p.id).map((o) => o.name.replace(/\s*\(.+\)/, '')).slice(0, 6).join(', ');
    const abn = S.where('orders', (o) => o.patientId === p.id && o.cat === 'LAB' && o.status === '결과보고' && o.result.at > Date.now() - 36 * HR).flatMap((o) => o.result.items.filter((r) => r.flag).map((r) => `${r.n} ${r.v}${r.flag === 'C' ? '(위험값)' : r.flag === 'H' ? '↑' : r.flag === 'L' ? '↓' : ''}`));
    const morse = H.lastAssess(p.id, 'morse'); const braden = H.lastAssess(p.id, 'braden');
    const lastNote = S.where('nnotes', (n) => n.patientId === p.id && inShift(n.at)).sort((a, b) => b.at - a.at)[0];
    const next = [];
    medOrders(p.id).forEach((o) => slotsFor(o).forEach((s) => { const k = slotState(o, s).k; if (['future', 'due', 'late', 'wait'].includes(k)) next.push(`${s.label} ${o.name.split(' ')[0]}`); }));
    const pend = S.where('orders', (o) => o.patientId === p.id && ['LAB', 'RAD', 'PATH', 'BLOOD'].includes(o.cat) && !F.isDone(o)).map((o) => `${o.name}(${o.status})`);
    const loc = e.type === 'ER' ? `응급실 ${e.room}-${e.bed}` : `${e.room}-${e.bed}`;
    return {
      S: `${loc} ${p.name} (${H.sexAge(p)}) ${(e.dx.find((d) => d.main) || e.dx[0] || { name: e.cc || '' }).name}, 입원 ${Math.floor((Date.now() - e.at) / 86400000) + 1}일째. ${lv ? `최근 활력징후 ${lv.sbp}/${lv.dbp}-${lv.hr}-${lv.rr}-${lv.bt}℃, 산소포화도 ${lv.spo2}%, 통증 ${lv.pain}점 (조기경보점수 ${nw.s})` : ''}`,
      B: `과거력: ${p.hx || '-'}. 알레르기: ${(p.allergies || []).map((a) => a.name).join(', ') || '없음'}. 주요 약: ${meds || '-'}. 식이: ${e.diet || '-'}.${p.flags && p.flags.dnr ? ' DNR 동의서 있음.' : ''}`,
      A: `${morse ? `낙상 ${morse.score}점(${morse.level})` : ''}${braden ? `, 욕창 ${braden.score}점(${braden.level})` : ''}. ${abn.length ? '이상 검사: ' + abn.join(', ') + '. ' : ''}${lastNote ? '이번 근무: ' + (lastNote.format === 'DAR' ? `${lastNote.focus} — ${lastNote.R}` : lastNote.format === 'NANDA' ? `${lastNote.dx} — ${lastNote.eval}` : lastNote.text) : ''}`,
      R: `${next.length ? '다음 투약: ' + next.slice(0, 5).join(', ') + '. ' : ''}${pend.length ? '결과 대기: ' + pend.join(', ') + '. ' : ''}${morse && morse.score >= 45 ? '낙상 주의. ' : ''}`,
    };
  }
  function tabHandoff(p, e) {
    const [a] = range();
    const recv = S.where('handoffs', (h) => h.patientId === p.id).sort((x, y) => y.at - x.at);
    const last = pendingHandoff(p.id) || recv.find((h) => h.at < a && !isMine(h)) || null;
    const mine = recv.find((h) => inShift(h.at) && isMine(h));
    const d = ms('hoDraft_' + p.id, null) || (mine ? { S: mine.S, B: mine.B, A: mine.A, R: mine.R } : { S: '', B: '', A: '', R: '' });
    return `<div class="grid2">
      <div class="panel"><div class="panel-h"><h3>인수 — 이전 근무자에게 받은 인계</h3></div><div class="panel-b gap-m">
        ${last ? `<div class="bubble"><div class="row between"><b>${esc(last.by)}</b><span class="num small muted">${T.dhm(last.at)}</span></div>
          <dl class="kv" style="margin:.5rem 0 0"><dt>S 상황</dt><dd>${esc(last.S)}</dd><dt>B 배경</dt><dd>${esc(last.B)}</dd><dt>A 평가</dt><dd>${esc(last.A)}</dd><dt>R 요청</dt><dd>${esc(last.R)}</dd></dl></div>
          ${last.ackBy ? UI.note(`${esc(last.ackBy)} 님이 ${T.hm(last.ackAt)}에 인수 확인함${last.q ? ` · 질문: ${esc(last.q)}` : ''}`, 'ok') : `<form data-submit="wd.recv" class="gap-s"><input type="hidden" name="id" value="${last.id}">${UI.input('q', '궁금한 점 (침상 옆에서 함께 확인)', '', { ph: '예: 새벽 진통제 몇 시에 줬나요?' })}${UI.check('bed', '환자 침상 옆에서 함께 확인함 (수액·라인·피부·안전)', false)}${UI.btn('인수 확인', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'check' })}</form>`}`
          : UI.empty('받을 인계가 없습니다', '새 입원 환자이거나 이전 근무 인계가 없습니다.')}
      </div></div>
      <div class="panel"><div class="panel-h"><h3>인계 — 다음 근무자에게</h3>${mine ? UI.chip('이번 근무 작성함', 'done') : ''}</div><div class="panel-b"><form data-submit="wd.handover" class="gap-m">
        ${UI.note('근무 중 기록(활력징후·검사·투약·간호기록)을 모아 자동 초안을 만들 수 있습니다. 초안은 꼭 읽고 고쳐 쓰세요.', 'info')}
        ${UI.textarea('S', 'S 상황', d.S, { h: '4rem' })}${UI.textarea('B', 'B 배경', d.B, { h: '4rem' })}${UI.textarea('A', 'A 평가', d.A, { h: '4rem' })}${UI.textarea('R', 'R 요청·할 일', d.R, { h: '4rem' })}
        <div class="btn-row end">${UI.btn('자동 초안 만들기', 'wd.hoDraft', { icon: 'refresh' })}${UI.btn('인계 완료', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'send' })}</div></form></div></div>
    </div>`;
  }

  function tabResult(p) {
    S.where('orders', (o) => o.patientId === p.id && o.cat === 'LAB' && o.status === '결과보고').forEach((o) => { o.nurseSeen = true; });
    S.save();
    const sub = ms('rsub', 'lab');
    return `<div class="gap-m">${UI.seg('wd.rsub', [{ v: 'lab', l: '진단검사' }, { v: 'rad', l: '영상 (PACS)' }, { v: 'path', l: '병리' }, { v: 'md', l: '의사 기록' }], sub)}
      ${{ lab: () => V.labCumulative(p.id), rad: () => V.radList(p.id), path: () => V.pathList(p.id), md: () => S.where('notes', (n) => n.patientId === p.id).sort((a, b) => b.at - a.at).map((n) => `<div class="box" style="background:var(--surface)"><div class="row between">${UI.chip(n.type, 'sent')}<span class="small muted">${esc(n.by)} · ${T.dhm(n.at)}</span></div><div class="small pre" style="margin-top:.4rem">${esc(Object.values(n.content).join('\n'))}</div></div>`).join('') || UI.empty('의사 기록이 없습니다') }[sub]()}</div>`;
  }

  // ── 병동 현황판 (환자 고르기 전) ──
  function board() {
    const encs = unitEncs();
    return `<div class="panel"><div class="panel-h"><h3>${esc(H.M.ward(unit()).name)} 현황판 — ${esc(T.shiftName[shift()])}</h3><span class="grow"></span>${UI.btn('병동 물품·안전 점검', 'wd.unitCheck', { size: 'sm', icon: 'clip' })}</div><div class="panel-b gap-m">
      ${UI.note('환자를 누르면 그 환자의 간호 업무 화면으로 들어갑니다. 근무 시작하면 ① 인수부터 하세요.', 'info')}
      ${UI.table([{ h: '병상' }, { h: '환자' }, { h: '진단' }, { h: '경보점수' }, { h: '새 처방' }, { h: '투약' }, { h: '인수' }, { h: '' }], encs.map((e) => {
        const p = H.pat(e.patientId); const nw = news(H.lastVs(p.id)); const st = steps(p, e);
        return [`<span class="mono">${esc(e.type === 'ER' ? e.room + ' ' + e.bed : e.room + '-' + e.bed)}</span>`, `<b>${esc(p.name)}</b> <span class="small muted">${H.sexAge(p)}</span>${e.type === 'ER' ? ' ' + UI.chip('KTAS ' + e.ktas, 'ktas' + e.ktas) : ''}`,
          `<span class="small">${esc((e.dx.find((d) => d.main) || e.dx[0] || { name: e.cc || '-' }).name)}</span>`, nw ? UI.chip(String(nw.s), nw.level.c) : '-',
          unacked(p.id).length ? UI.chip(`${unacked(p.id).length}건`, 'prog') : '-', dueCount(p.id) ? UI.chip(`${dueCount(p.id)}건`, 'sent') : '-',
          st[0].done ? UI.chip('완료', 'done') : UI.chip('필요', 'prog'), UI.btn('들어가기', 'shell.pick', { size: 'sm', kind: 'pri', data: { pid: p.id, enc: e.id } })];
      }), { empty: UI.empty('이 병동에 환자가 없습니다') })}
      ${UI.sec('병동 활동 기록 (이번 근무)')}
      ${S.where('acts', (a) => !a.patientId && a.unit === unit() && inShift(a.at)).map((a) => `<div class="small">${T.hm(a.at)} · <b>${esc(a.kind)}</b> ${esc(a.text)} <span class="muted">${esc(a.by)}</span></div>`).join('') || '<p class="muted small">아직 없습니다</p>'}
    </div></div>`;
  }

  const TABS = [
    { id: 'day', label: '근무 일과', icon: 'clock' }, { id: 'handoff', label: '인수인계', icon: 'swap' }, { id: 'orders', label: '처방 확인', icon: 'clip' },
    { id: 'assess', label: '간호사정', icon: 'steth' }, { id: 'mar', label: '투약 (MAR)', icon: 'pill' }, { id: 'vs', label: '활력징후·I/O', icon: 'heart' },
    { id: 'note', label: '간호기록', icon: 'doc' }, { id: 'result', label: '결과 조회', icon: 'flask' }, { id: 'comm', label: '소통 (SBAR)', icon: 'chat' },
    { id: 'acts', label: '교육·라운딩', icon: 'user' }, { id: 'code', label: '응급 (코드블루)', icon: 'siren' },
  ];
  const TAB_ALIAS = { handover: 'handoff', ack: 'orders' };
  const UNITS = [{ v: '7A', l: '7A 내과' }, { v: '8B', l: '8B 외과' }, { v: 'ER', l: '응급실' }, { v: 'ICU', l: '중환자실' }, { v: 'LD', l: '분만실' }, { v: 'NB', l: '신생아실' }];
  H.wardKit = { ms: (k, d) => ms(k, d), set: (k, v) => set(k, v), unit: () => unit(), shift: () => shift(), inShift: (t) => inShift(t), curEnc: () => curEnc(), news, medOrders: (pid) => medOrders(pid), unitEncs: () => unitEncs() };

  H.reg({
    id: 'ward', title: '병동 간호', actor: '간호사', layout: 'patient',
    channels: () => ['ward:' + unit()],
    onEnter() { if (!UNITS.some((u) => u.v === unit())) set('unit', '7A'); },
    list() {
      const u = unit();
      return {
        title: H.M.ward(u).name,
        filter: `<div class="gap-s">${UI.seg('wd.unit', UNITS, u)}${UI.btn('병동 현황판', 'wd.board', { size: 'sm', block: true, icon: 'list' })}</div>`,
        rows: unitEncs().map((e) => {
          const p = H.pat(e.patientId); const un = unacked(p.id).length; const due = dueCount(p.id);
          const crit = S.where('orders', (o) => o.patientId === p.id && o.cat === 'LAB' && o.status === '결과보고' && !o.nurseSeen && o.result.items.some((r) => r.flag === 'C')).length;
          const nw = news(H.lastVs(p.id));
          return { pid: p.id, encId: e.id, loc: e.type === 'ER' ? `${e.room.replace('구역', '')} ${e.bed}` : `${e.room}-${e.bed}`, name: p.name,
            marks: `${crit ? '<span class="dot stat" title="위험값"></span>' : ''}${un ? '<span class="dot prog" title="새 처방"></span>' : ''}${due ? '<span class="dot sent" title="투약"></span>' : ''}${e.type === 'ER' ? UI.chip(String(e.ktas), 'ktas' + e.ktas) : nw && nw.s >= 5 ? UI.chip('경보 ' + nw.s, nw.level.c) : ''}`,
            sub: `${H.sexAge(p)} · ${esc((e.dx.find((d) => d.main) || e.dx[0] || { name: e.cc || '' }).name)}` };
        }),
        empty: '이 병동에 환자가 없습니다',
      };
    },
    render() {
      const p = A.pat(); const e = curEnc();
      if (!p || !e || ms('board', false)) return board();
      let tab = ms('tab', 'day'); tab = TAB_ALIAS[tab] || tab;
      const ext = (H.wardExt || {})[unit()];
      const all = [TABS[0], ...(ext ? (typeof ext.tabs === 'function' ? ext.tabs(p, e) : ext.tabs) : []), ...TABS.slice(1)];
      if (!all.some((t) => t.id === tab)) tab = 'day';
      const tabs = all.map((t) => Object.assign({}, t, { cnt: t.id === 'orders' ? unacked(p.id).length || '' : t.id === 'mar' ? dueCount(p.id) || '' : '' }));
      const fn = { day: tabDay, handoff: tabHandoff, orders: tabOrders, assess: tabAssess, mar: tabMar, vs: tabVs, note: tabNote, result: tabResult, comm: tabComm, acts: tabActs, code: tabCode }[tab] || ext.render[tab];
      return `<div class="panel">${UI.tabs('wd.tab', tabs, tab)}<div class="panel-b">${fn(p, e)}</div></div>`;
    },
    side() {
      const p = A.pat(); const e = curEnc();
      if (!p || !e || ms('board', false)) return '';
      const lv = H.lastVs(p.id); const nw = news(lv);
      return `${V.sideVitals(p.id)}${nw && nw.s >= 5 ? UI.note(`<b>조기경보점수 ${nw.s}점</b> — ${esc(nw.level.t)}`, nw.s >= 7 ? 'danger' : 'warn') : ''}${V.sideCritical(p.id)}
        <div class="panel"><div class="panel-h"><h3>이번 근무 기록</h3></div><div class="panel-b small"><dl class="kv">
        <dt>활력징후</dt><dd>${S.where('vitals', (v) => v.patientId === p.id && inShift(v.at)).length}회</dd><dt>투약</dt><dd>${S.where('mar', (m) => m.patientId === p.id && inShift(m.at)).length}회</dd>
        <dt>간호기록</dt><dd>${S.where('nnotes', (n) => n.patientId === p.id && inShift(n.at)).length}건</dd><dt>사정</dt><dd>${S.where('assess', (a) => a.patientId === p.id && inShift(a.at)).length}건</dd></dl></div></div>`;
    },
    after() { if (code) { clearInterval(codeTimer); tickCode(); codeTimer = setInterval(tickCode, 1000); } },
    onPick() { set('board', false); },
    acts: {
      'wd.unit': (el) => { set('unit', el.dataset.v); set('board', true); A.st.pid = null; A.st.encId = null; A.render(); },
      'wd.board': () => { set('board', true); A.render(); },
      'wd.tab': (el) => { set('tab', TAB_ALIAS[el.dataset.v] || el.dataset.v); A.render(); window.scrollTo(0, 0); },
      'wd.shift': (el) => { set('shift', el.dataset.v); A.render(); },
      'wd.scale': (el) => { set('scale', el.dataset.v); A.render(); },
      'wd.nfmt': (el) => { set('nfmt', el.dataset.v); A.render(); },
      'wd.rsub': (el) => { set('rsub', el.dataset.v); A.render(); },
      'wd.nanda': (el) => { set('nanda', el.value); A.render(); },
      'wd.ack': (el) => { const o = S.get('orders', el.dataset.id); o.nurseAck = true; o.ackBy = H.who(); o.ackAt = Date.now(); if (['NUR', 'DIET'].includes(o.cat) && o.status === '전송') F.advance(o, F.steps(o)[1]); else S.save(); H.log(o.verbal ? '구두처방 확인 서명' : '처방 확인', o.name, o.patientId); UI.toast('처방 확인 서명', 'ok'); A.render(); },
      'wd.ackAll': () => { const p = A.pat(); unacked(p.id).forEach((o) => { o.nurseAck = true; o.ackBy = H.who(); o.ackAt = Date.now(); if (['NUR', 'DIET'].includes(o.cat) && o.status === '전송') F.advance(o, F.steps(o)[1]); }); S.save(); H.log('처방 모두 확인', p.name, p.id); UI.toast('새 처방을 모두 확인했습니다', 'ok'); A.render(); },
      'wd.label': () => { const p = A.pat(); const os = S.where('orders', (o) => o.patientId === p.id && o.cat === 'LAB' && o.status === '전송' && o.code !== 'L1026'); UI.modal({ title: '검체 라벨 — 출력 미리보기', size: 'wide', body: V.labelCards(os) }); },
      'wd.draw': async () => {
        const p = A.pat();
        const ok = await UI.confirm({ title: '병동 채혈', text: `${p.name} 님 채혈\n\n• 환자 이름·생년월일 두 가지로 확인했나요?\n• 수액 맞는 팔 반대편에서 채혈했나요?\n• 라벨을 환자 앞에서 붙였나요?`, ok: '모두 확인 — 채혈 완료' });
        if (!ok) return;
        const os = S.where('orders', (o) => o.patientId === p.id && o.cat === 'LAB' && o.status === '전송' && o.code !== 'L1026');
        os.forEach((o) => F.advance(o, '채혈완료', { specimenAt: Date.now() }));
        H.notify('lab', `${p.name} 병동 검체 ${os.length}건 도착 예정`, { patientId: p.id });
        UI.toast(`채혈 완료 — 검사실로 보냈습니다 (${os.length}건)`, 'ok'); A.render();
      },
      'wd.bst': (f, d) => {
        const o = S.get('orders', d.id); const it = H.M.item('L1026'); const j = F.judge(it.items[0], d.v);
        if (!d.v) return UI.toast('혈당 값을 넣어 주세요', 'warn');
        F.advance(o, '결과보고', { result: { at: Date.now(), by: H.who(), items: [{ c: 'BST', n: '혈당', u: 'mg/dL', v: d.v, flag: j.flag, dir: j.dir, ref: '70~140' }] } });
        S.add('vitals', { id: H.uid('vs'), patientId: o.patientId, encId: o.encId, at: Date.now(), by: H.who(), bst: d.v });
        UI.toast(`혈당 ${d.v} 저장${Number(d.v) >= 200 ? ' — 인슐린 슬라이딩 스케일 확인!' : ''}`, Number(d.v) >= 200 ? 'warn' : 'ok'); A.render();
      },
      'wd.dcPrep': (f, d) => {
        if ((d.c || []).length < 5) return UI.toast('퇴원 교육 항목을 확인하세요 (5개 이상)', 'warn');
        const e = curEnc(); const p = A.pat(); e.dc.ward = { at: Date.now(), by: H.who(), checks: d.c }; S.save();
        S.add('acts', { id: H.uid('ac'), patientId: p.id, kind: '환자 교육', text: `퇴원 교육 — ${d.c.join(', ')}`, at: Date.now(), by: H.who() });
        H.notify('review', `병동 퇴원 준비 완료: ${p.name} — 퇴원 심사 해 주세요`, { patientId: p.id });
        H.log('퇴원 준비', p.name, p.id); UI.toast('퇴원 준비 완료 — 보험 심사팀에 알렸습니다', 'ok'); A.render();
      },
      'wd.preop': (f, d) => {
        if ((d.c || []).length < (H.PREOP || []).length) return UI.toast('수술 전 준비 항목을 모두 확인해야 합니다', 'err');
        const o = S.get('orders', d.id); o.op = o.op || {}; o.op.preop = { checks: d.c, by: H.who(), at: Date.now() }; S.save();
        H.notify('or', `수술 전 준비 완료: ${H.pat(o.patientId).name} — 입실 가능`, { patientId: o.patientId });
        H.log('수술 전 준비', o.name, o.patientId); UI.toast('수술 전 준비 완료 — 수술실에 알렸습니다', 'ok'); A.render();
      },
      'wd.proc': (el) => { F.advance(S.get('orders', el.dataset.id), '시행완료'); UI.toast('처치 시행 기록', 'ok'); A.render(); },
      'wd.nur': (el) => { const o = S.get('orders', el.dataset.id); S.add('acts', { id: H.uid('ac'), patientId: o.patientId, orderId: o.id, kind: '간호처방 수행', text: o.name, at: Date.now(), by: H.who() }); UI.toast(`${o.name} 수행 기록`, 'ok'); A.render(); },
      'wd.give': (el) => {
        const o = S.get('orders', el.dataset.id); const p = H.pat(o.patientId); const it = H.M.item(o.code);
        const ts = el.dataset.ts ? Number(el.dataset.ts) : Date.now();
        const insulin = o.code === 'J0209';
        UI.modal({ title: `투약 — ${o.name}`, icon: 'pill', body: `<form data-submit="wd.giveGo" class="gap-m"><input type="hidden" name="id" value="${o.id}"><input type="hidden" name="ts" value="${ts}">
          <div class="box"><dl class="kv"><dt>환자</dt><dd><b>${esc(p.name)}</b> ${H.sexAge(p)} · ${esc(p.mrn)}</dd><dt>약</dt><dd><b>${esc(o.name)}</b></dd><dt>용량·방법</dt><dd>${esc(V.doseText(o))}</dd><dt>예정 시각</dt><dd class="num">${T.hm(ts)}</dd>${o.note ? `<dt>지시</dt><dd>${esc(o.note)}</dd>` : ''}</dl></div>
          ${(p.allergies || []).length ? UI.note(`알레르기: ${(p.allergies || []).map((a) => esc(a.name)).join(', ')}`, 'danger') : ''}
          <div class="row">${UI.btn('환자 팔찌 바코드 찍기', 'wd.scan', { data: { k: 'p' }, icon: 'barcode' })}${UI.btn('약 바코드 찍기', 'wd.scan', { data: { k: 'd' }, icon: 'barcode' })}<span id="scan-res" class="small"></span></div>
          <div class="gap-s">${['맞는 환자', '맞는 약', '맞는 용량', '맞는 경로', '맞는 시간'].map((t) => UI.check('checks', t, false, { multi: true, value: t })).join('')}</div>
          ${it.highAlert || it.narcotic ? UI.check('double', `${it.narcotic ? '마약류' : '고위험 약물'} — 다른 간호사와 2명이 확인함`, false) : ''}
          ${insulin ? UI.input('bstv', '투약 전 혈당 (mg/dL) — 스케일 확인', '', { type: 'number' }) : ''}
          ${o.freq === 'PRN' ? UI.input('prn', '필요시 투약 이유 (예: 체온 38.5℃, 통증 7점)', '') : ''}
          ${o.route === 'IV' || o.route === 'IM' || o.route === 'SC' ? UI.select('site', '주사 부위', ['왼팔 정맥로', '오른팔 정맥로', '복부 피하', '위팔 근육', '엉덩이 근육'], o.route === 'SC' ? '복부 피하' : o.route === 'IM' ? '엉덩이 근육' : '왼팔 정맥로') : ''}
          ${UI.fld('결과', UI.pick('result', ['투약', '보류', '환자 거부', '금식으로 보류'], '투약'))}
          ${UI.input('reason', '보류·거부 이유 (투약 안 했을 때)', '')}
          <div class="btn-row end">${UI.btn('투약 기록 저장', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'check' })}</div></form>` });
      },
      'wd.scan': (el) => { const r = document.getElementById('scan-res'); if (r) r.innerHTML = (r.innerHTML ? r.innerHTML + ' · ' : '') + `<b style="color:var(--t-done)">✓ ${el.dataset.k === 'p' ? '환자 일치' : '약 일치'}</b>`; el.disabled = true; },
      'wd.giveGo': (f, d) => {
        const o = S.get('orders', d.id); const it = H.M.item(o.code);
        const status = d.result || '투약';
        if (status === '투약') {
          if ((d.checks || []).length < 5) return UI.toast('투약 5가지 원칙을 모두 확인하세요', 'err');
          if ((it.highAlert || it.narcotic) && !d.double) return UI.toast('고위험·마약류는 2명이 확인해야 합니다', 'err');
          if (o.freq === 'PRN' && !d.prn) return UI.toast('필요시 투약 이유를 써 주세요', 'warn');
        } else if (!d.reason) return UI.toast('투약하지 않은 이유를 써 주세요', 'warn');
        S.add('mar', { id: H.uid('ma'), orderId: o.id, patientId: o.patientId, slot: Number(d.ts), status, at: Date.now(), by: H.who(), checks: d.checks, double: !!d.double, prnReason: d.prn, reason: d.reason, site: d.site, bst: d.bstv });
        if (status !== '투약') H.notify('doctor', `투약 ${status}: ${H.pat(o.patientId).name} ${o.name} — ${d.reason}`, { patientId: o.patientId });
        H.log(`투약 ${status}`, o.name, o.patientId);
        UI.close(); UI.toast(`${o.name} ${status} 기록`, status === '투약' ? 'ok' : 'warn'); A.render();
      },
      'wd.marView': (el) => { const m = S.get('mar', el.dataset.id); const o = S.get('orders', m.orderId); UI.modal({ title: '투약 기록', size: 'narrow', body: `<dl class="kv"><dt>약</dt><dd>${esc(o.name)}</dd><dt>결과</dt><dd>${esc(m.status)}</dd><dt>시각</dt><dd>${T.dhm(m.at)}</dd><dt>기록자</dt><dd>${esc(m.by)}</dd>${m.site ? `<dt>부위</dt><dd>${esc(m.site)}</dd>` : ''}${m.prnReason ? `<dt>투약 이유</dt><dd>${esc(m.prnReason)}</dd>` : ''}${m.reason ? `<dt>사유</dt><dd>${esc(m.reason)}</dd>` : ''}${m.bst ? `<dt>혈당</dt><dd>${esc(m.bst)}</dd>` : ''}<dt>확인</dt><dd>${(m.checks || []).map(esc).join(', ')}${m.double ? ' · 2인 확인' : ''}</dd></dl>` }); },
      'wd.bloodStart': (el) => {
        const o = S.get('orders', el.dataset.id); const p = H.pat(o.patientId);
        UI.modal({ title: `수혈 시작 — ${o.name}`, icon: 'drop', body: `<form data-submit="wd.bloodGo" class="gap-m"><input type="hidden" name="id" value="${o.id}">
          ${UI.note(`혈액번호 <b class="mono">${esc(o.bagNo)}</b> · 환자 ${esc(p.name)} ${esc(p.blood)}`, 'info')}
          <div class="gap-s">${['간호사 2명이 침상 옆에서 함께 확인', '환자 이름·등록번호·혈액형 일치', '혈액번호·유효기간·혈액백 상태 확인', '수혈 동의서 확인', '수혈 전 활력징후 측정', '처음 15분은 천천히 주입하며 곁에서 관찰'].map((t) => UI.check('c', t, false, { multi: true, value: t })).join('')}</div>
          <div class="btn-row end">${UI.btn('수혈 시작', '', { type: 'submit', kind: 'danger', size: 'lg' })}</div></form>` });
      },
      'wd.bloodGo': (f, d) => { if ((d.c || []).length < 6) return UI.toast('수혈 전 확인 항목을 모두 확인해야 합니다', 'err'); const o = S.get('orders', d.id); o.transfused = { start: Date.now(), by: H.who() }; S.save(); H.log('수혈 시작', o.name, o.patientId); UI.close(); UI.toast('수혈 시작 — 15분 뒤 활력징후를 다시 재세요', 'ok'); A.render(); },
      'wd.bloodEnd': (el) => {
        UI.modal({ title: '수혈 종료', size: 'narrow', body: `<form data-submit="wd.bloodEndGo" class="gap-m"><input type="hidden" name="id" value="${el.dataset.id}">${UI.fld('수혈 부작용', UI.pick('rx', ['없음', '발열·오한', '두드러기', '호흡곤란', '혈압 저하'], '없음'))}${UI.input('vol', '주입량 (mL)', '320', { type: 'number' })}<div class="btn-row end">${UI.btn('종료 기록', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` });
      },
      'wd.bloodEndGo': (f, d) => {
        const o = S.get('orders', d.id); o.transfused.end = Date.now(); o.transfused.reaction = d.rx;
        S.add('io', { id: H.uid('io'), patientId: o.patientId, at: Date.now(), kind: 'in', type: '수혈', amount: Number(d.vol) || 0, by: H.who() }, true);
        S.save();
        if (d.rx !== '없음') H.notify('doctor', `수혈 부작용: ${H.pat(o.patientId).name} — ${d.rx}`, { patientId: o.patientId, level: 'stat' });
        UI.close(); UI.toast(d.rx === '없음' ? '수혈 종료 기록' : '수혈 부작용 — 의사에게 알렸습니다. 수혈 중단·혈액은행 보고!', d.rx === '없음' ? 'ok' : 'err'); A.render();
      },
      'wd.vsFill': (el) => {
        const p = A.pat(); const lv = H.lastVs(p.id) || { sbp: 120, dbp: 75, hr: 80, rr: 18, bt: 36.6, spo2: 98, pain: 2 };
        const f = el.closest('form'); const j = (v, r, d = 0) => v == null ? '' : (Number(v) + (Math.random() * 2 - 1) * r).toFixed(d);
        const set2 = (n, v) => { const i = f.querySelector(`[name="${n}"]`); if (i && !i.value) i.value = v; };
        set2('sbp', j(lv.sbp, 6)); set2('dbp', j(lv.dbp, 4)); set2('hr', j(lv.hr, 4)); set2('rr', j(lv.rr, 1)); set2('bt', j(lv.bt, 0.2, 1)); set2('spo2', Math.min(100, Math.round(j(lv.spo2, 1)))); set2('pain', lv.pain != null ? lv.pain : 0);
      },
      'wd.vs': (f, d) => {
        const p = A.pat(); const e = curEnc();
        if (!d.sbp && !d.hr && !d.bt) return UI.toast('측정값을 넣어 주세요', 'warn');
        const v = S.add('vitals', { id: H.uid('vs'), patientId: p.id, encId: e.id, at: Date.now(), by: H.who(), sbp: H.num(d.sbp), dbp: H.num(d.dbp), hr: H.num(d.hr), rr: H.num(d.rr), bt: H.num(d.bt), spo2: H.num(d.spo2), pain: H.num(d.pain), bst: H.num(d.bst), avpu: d.avpu, o2: !!d.o2 });
        const n = news(v);
        H.log('활력징후 기록', `${v.sbp}/${v.dbp}-${v.hr}-${v.rr}-${v.bt} 경보 ${n.s}`, p.id);
        if (n.s >= 5) { UI.toast(`조기경보점수 ${n.s}점 — ${n.level.t}. 소통(SBAR) 탭에서 노티하세요`, 'err'); }
        else UI.toast('활력징후 저장', 'ok');
        A.render();
      },
      'wd.io': (f, d) => { const p = A.pat(); if (!d.amount) return UI.toast('양을 넣어 주세요', 'warn'); S.add('io', { id: H.uid('io'), patientId: p.id, at: Date.now(), kind: d.kind, type: d.type, amount: Number(d.amount), by: H.who() }); UI.toast('I/O 기록', 'ok'); A.render(); },
      'wd.calc': (el) => {
        const form = el.closest('form'); const d = H.formData(form); const kind = d._kind; const sc = SCALES[kind];
        const s = scaleScore(kind, d); const done = sc.items.every(([k]) => d[k] !== '');
        const se = document.getElementById('as-score'); const le = document.getElementById('as-level');
        if (se) se.textContent = String(s); if (le) le.innerHTML = done ? UI.chip(sc.level(s), /고위험|높은|심한|중증|전적 의존|영양 위험 —/.test(sc.level(s)) ? 'stat' : /중|경도|부분/.test(sc.level(s)) ? 'prog' : 'done') : '<span class="small muted">모든 문항을 고르면 판정이 나옵니다</span>';
      },
      'wd.assess': (f, d) => {
        const p = A.pat(); const kind = d._kind;
        if (kind === 'initial') {
          S.add('assess', { id: H.uid('as'), patientId: p.id, kind, score: null, level: '완료', at: Date.now(), by: H.who(), answers: d });
          H.log('입원 초기 간호사정', p.name, p.id); UI.toast('입원 초기 간호사정 저장 — 이어서 낙상·욕창 위험을 사정하세요', 'ok'); set('scale', 'morse'); A.render(); return;
        }
        const sc = SCALES[kind];
        if (!sc.items.every(([k]) => d[k] !== '' && d[k] != null)) return UI.toast('모든 문항을 골라 주세요', 'warn');
        const s = scaleScore(kind, d);
        S.add('assess', { id: H.uid('as'), patientId: p.id, kind, score: s, level: sc.level(s), at: Date.now(), by: H.who(), answers: d });
        if (kind === 'morse' && s >= 45) { const e = curEnc(); if (!S.where('orders', (o) => o.patientId === p.id && o.code === 'N5009' && !F.isOff(o)).length) UI.toast('낙상 고위험 — 낙상 예방 활동(침상 난간·호출벨·교육)을 하세요', 'warn'); }
        if (kind === 'pain' && s >= 4) UI.toast('통증 4점 이상 — 진통제 처방 확인 후 투약, 30~60분 뒤 재사정', 'warn');
        H.log(`간호사정: ${sc.l}`, `${s}점 ${sc.level(s)}`, p.id);
        UI.toast(`${sc.l}: ${s}점 (${sc.level(s)}) 저장`, 'ok'); A.render();
      },
      'wd.noteFill': (el) => {
        const p = A.pat(); const lv = H.lastVs(p.id); const f = el.closest('form');
        const set2 = (n, v) => { const i = f.querySelector(`[name="${n}"]`); if (i && !i.value) i.value = v; };
        if (lv && lv.bt >= 38) { set2('focus', '고체온'); set2('D', `체온 ${lv.bt}℃, 맥박 ${lv.hr}회`); set2('A', '처방된 해열제 투여, 미온수 마사지, 수분 섭취 격려'); set2('R', '1시간 뒤 체온 재측정 예정'); }
        else if (lv && lv.pain >= 4) { set2('focus', '급성 통증'); set2('D', `통증 ${lv.pain}점 호소`); set2('A', '통증 사정, 처방된 진통제 투여, 편한 자세 도움'); set2('R', '30분 뒤 통증 재사정 예정'); }
        else { set2('focus', '낙상 위험'); set2('D', '침상 안정 중, 화장실 이동 시 어지러움 호소'); set2('A', '침상 난간 올림, 호출벨 손 닿는 곳에 둠, 낙상 예방 교육'); set2('R', '이해했다고 말함, 화장실 갈 때 호출함'); }
      },
      'wd.note': (f, d) => {
        const p = A.pat(); const e = curEnc(); const fmt = d._fmt;
        const rec = { id: H.uid('nn'), patientId: p.id, encId: e.id, at: Date.now(), by: H.who(), format: fmt };
        if (fmt === '서술') { if (!d.text) return UI.toast('내용을 써 주세요', 'warn'); rec.text = d.text; }
        else if (fmt === 'DAR') { if (!d.focus || !d.D) return UI.toast('초점과 자료(D)는 꼭 써 주세요', 'warn'); Object.assign(rec, { focus: d.focus, D: d.D, A: d.A, R: d.R }); }
        else { Object.assign(rec, { dx: d.dx, goal: d.goal, iv: d.iv || [], eval: d.eval }); }
        S.add('nnotes', rec); H.log('간호기록', fmt, p.id); UI.toast('간호기록 저장 (전자서명)', 'ok'); A.render();
      },
      'wd.sbarFill': (el) => {
        const p = A.pat(); const e = curEnc(); const lv = H.lastVs(p.id); const nw = news(lv); const f = el.closest('form');
        const crit = S.where('orders', (o) => o.patientId === p.id && o.cat === 'LAB' && o.status === '결과보고' && o.result.items.some((r) => r.flag === 'C')).flatMap((o) => o.result.items.filter((r) => r.flag === 'C').map((r) => `${r.n} ${r.v}`));
        const problem = crit.length ? `위험값 ${crit.join(', ')} 나와 보고드립니다` : lv && lv.bt >= 38 ? `체온 ${lv.bt}℃ 발열 있어 보고드립니다` : lv && lv.spo2 < 92 ? `산소포화도 ${lv.spo2}%로 떨어져 보고드립니다` : lv && lv.sbp < 90 ? `혈압 ${lv.sbp}/${lv.dbp}로 떨어져 보고드립니다` : lv && lv.pain >= 7 ? `통증 ${lv.pain}점 호소하여 보고드립니다` : '상태 보고드립니다';
        const set2 = (n, v) => { const i = f.querySelector(`[name="${n}"]`); if (i) i.value = v; };
        set2('S', `${e.type === 'ER' ? '응급실' : e.ward + ' ' + e.room + '-' + e.bed} ${p.name} 님 ${problem}.`);
        set2('B', `${(e.dx.find((d) => d.main) || e.dx[0] || { name: e.cc }).name}로 ${e.type === 'ER' ? '응급실 진료 중' : '입원 ' + (Math.floor((Date.now() - e.at) / 86400000) + 1) + '일째'}. ${p.hx || ''} 투약 중: ${medOrders(p.id).map((o) => o.name.split(' ')[0]).slice(0, 4).join(', ')}.`);
        set2('A', lv ? `활력징후 ${lv.sbp}/${lv.dbp}, 맥박 ${lv.hr}, 호흡 ${lv.rr}, 체온 ${lv.bt}, 산소포화도 ${lv.spo2}%. 조기경보점수 ${nw.s}점 (${nw.level.t}).` : '');
        set2('R', '직접 보시고 처방 부탁드립니다.');
      },
      'wd.sbar': (f, d) => {
        const p = A.pat();
        if (!d.S || !d.R) return UI.toast('S(상황)와 R(요청)은 꼭 써 주세요', 'warn');
        S.add('comms', { id: H.uid('cm'), patientId: p.id, at: Date.now(), from: H.who(), to: d.to, S: d.S, B: d.B, A: d.A, R: d.R, urgent: !!d.urgent || d.to.includes('신속'), status: '보냄' });
        H.notify('doctor', `${d.urgent ? '[긴급] ' : ''}간호사 노티: ${p.name} — ${d.S}`, { patientId: p.id, level: d.urgent || d.to.includes('신속') ? 'stat' : '' });
        H.log('SBAR 노티', d.S, p.id); UI.toast('노티를 보냈습니다. 의사 답변·처방을 기다리세요', 'ok'); A.render();
      },
      'wd.rrt': () => { set('tab', 'comm'); A.render(); setTimeout(() => { const s = document.getElementById('f-to'); if (s) { s.value = '신속대응팀 (RRT)'; } const b = document.querySelector('[data-act="wd.sbarFill"]'); if (b) b.click(); }, 50); },
      'wd.codeStart': async () => {
        const p = A.pat();
        if (p.flags && p.flags.dnr && !(await UI.confirm({ title: 'DNR 환자', text: '이 환자는 심폐소생술 거부(DNR) 동의서가 있습니다.\n그래도 기록을 시작할까요? (실습용)', ok: '기록 시작', danger: true }))) return;
        code = { pid: p.id, start: Date.now(), events: [{ t: Date.now(), text: '코드블루 방송·심폐소생술 시작' }] };
        H.notify('doctor', `🚨 코드블루: ${p.name} — 즉시 와 주세요`, { patientId: p.id, level: 'stat' });
        H.log('코드블루 시작', p.name, p.id); A.render();
      },
      'wd.codeEv': (el) => { code.events.push({ t: Date.now(), text: el.dataset.t }); A.render(); },
      'wd.codeEnd': (f, d) => {
        code.events.push({ t: Date.now(), text: `종료: ${d.outcome}` });
        S.add('codes', { id: H.uid('cd'), patientId: code.pid, start: code.start, end: Date.now(), events: code.events, outcome: d.outcome, by: H.who() });
        S.add('nnotes', { id: H.uid('nn'), patientId: code.pid, encId: (curEnc() || {}).id, at: Date.now(), by: H.who(), format: '서술', text: `[심폐소생술 기록] ${T.hm(code.start)} 시작, ${Math.round((Date.now() - code.start) / 60000)}분 진행.\n${code.events.map((e) => `${T.hm(e.t)} ${e.text}`).join('\n')}` });
        H.log('코드블루 종료', d.outcome, code.pid);
        if (d.outcome.includes('중환자실')) { const ce = H.activeEnc(code.pid); if (ce && ce.type === 'IPD' && ce.ward !== 'ICU' && H.transfer(ce, 'ICU', '내과계')) UI.toast('중환자실로 옮겼습니다 (전동)', 'ok'); }
        code = null; clearInterval(codeTimer); UI.toast('심폐소생술 기록 저장', 'ok'); A.render();
      },
      'wd.edu': (f, d) => { const p = A.pat(); S.add('acts', { id: H.uid('ac'), patientId: p.id, kind: '환자 교육', text: `${d.topic} — ${d.who}에게 ${d.how}, ${d.und}`, at: Date.now(), by: H.who() }); H.log('환자 교육', d.topic, p.id); UI.toast('교육 기록', 'ok'); A.render(); },
      'wd.round': (f, d) => { const p = A.pat(); if (!(d.r || []).length) return UI.toast('확인한 항목에 표시하세요', 'warn'); S.add('acts', { id: H.uid('ac'), patientId: p.id, kind: '라운딩', text: `${(d.r || []).join(', ')}${d.memo ? ' — ' + d.memo : ''}`, at: Date.now(), by: H.who() }); UI.toast('라운딩 기록', 'ok'); A.render(); },
      'wd.unitCheck': () => UI.modal({ title: '병동 물품·안전 점검', icon: 'clip', body: `<form data-submit="wd.unitCheckGo" class="gap-m">${UI.fld('점검 종류', UI.pick('kind', ['응급카트 점검', '냉장 약품 온도', '마약류 인수인계 (수량 확인)', '제세동기 작동 확인', '병동 환경 (복도·바닥)'], '응급카트 점검'))}
        <div class="gap-s">${['봉인 번호 확인', '약품 유효기간', '수량 일치', '기기 작동 정상'].map((t) => UI.check('c', t, false, { multi: true, value: t })).join('')}</div>${UI.input('memo', '특이사항', '')}<div class="btn-row end">${UI.btn('점검 기록', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` }),
      'wd.unitCheckGo': (f, d) => { S.add('acts', { id: H.uid('ac'), patientId: null, unit: unit(), kind: d.kind, text: `${(d.c || []).join(', ')}${d.memo ? ' — ' + d.memo : ''}`, at: Date.now(), by: H.who() }); H.log('병동 점검', d.kind); UI.close(); UI.toast('점검 기록', 'ok'); A.render(); },
      'wd.recv': (f, d) => { const h = S.get('handoffs', d.id); if (!d.bed) return UI.toast('침상 옆에서 함께 확인했는지 표시하세요', 'warn'); h.ackBy = H.who(); h.ackAt = Date.now(); h.q = d.q; S.save(); H.log('인수 확인', H.pat(h.patientId).name, h.patientId); UI.toast('인수 확인 — 이제 이 환자를 책임집니다', 'ok'); A.render(); },
      'wd.hoDraft': () => { const p = A.pat(); set('hoDraft_' + p.id, draftHandoff(p, curEnc())); A.render(); UI.toast('자동 초안을 만들었습니다. 읽고 고쳐 쓰세요', ''); },
      'wd.handover': (f, d) => {
        const p = A.pat(); const e = curEnc();
        if (!d.S || !d.R) return UI.toast('S와 R은 꼭 써 주세요', 'warn');
        S.add('handoffs', { id: H.uid('ho'), patientId: p.id, ward: e.type === 'ER' ? 'ER' : e.ward, at: Date.now(), fromShift: shift(), by: H.who(), S: d.S, B: d.B, A: d.A, R: d.R, status: '인계', ackBy: null });
        set('hoDraft_' + p.id, null); H.log('인계 작성', p.name, p.id); UI.toast('인계 완료 — 다음 근무자가 인수 확인합니다', 'ok'); A.render();
      },
    },
  });
})();
