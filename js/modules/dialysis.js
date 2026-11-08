// 인공신장실: 투석 전 사정 → 처방·시작 → 30분마다 관찰 → 투석 후 → 기록·적절도
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const HR = 3600000;
  const pick = (name, opts, v) => UI.pick(name, opts.map((o) => (typeof o === 'object' ? o : { v: o, l: o })), v);

  const hdPats = () => S.where('patients', (p) => p.hd);
  const today = (pid) => H.recs(pid, 'hd').find((r) => r.at >= T.startOfDay());
  const lastDone = (pid) => H.recs(pid, 'hd').find((r) => r.done && r.at < T.startOfDay());
  const sesStatus = (s) => !s ? { t: '투석 전', c: 'plain' } : s.done ? { t: '완료', c: 'done' } : s.start ? { t: '투석 중', c: 'prog' } : { t: '사정 완료', c: 'sent' };

  function tabPre(p) {
    const s = today(p.id); const ld = lastDone(p.id);
    if (s) return UI.note(`오늘 투석 전 사정 완료 — 체중 ${s.pre}kg (지난 투석 후보다 ${ld ? (s.pre - ld.post).toFixed(1) : '-'}kg 늘어남), 제거 목표 ${s.ufGoal}mL, 혈압 ${s.sbpPre}/${s.dbpPre}`, 'ok');
    const cath = p.hd.access.includes('도관');
    return `<form data-submit="hd.pre" class="gap-m">
      <div class="row box" style="background:var(--surface)"><span><b>투석 요일</b> ${esc(p.hd.days)} ${esc(p.hd.time)}</span><span><b>건체중</b> ${p.hd.dry}kg</span><span><b>혈관 통로</b> ${esc(p.hd.access)}</span><span><b>지난 투석 후 체중</b> ${ld ? ld.post + 'kg' : '-'}</span></div>
      ${UI.note('건체중: 몸에 남는 물이 없을 때의 체중. 오늘 체중에서 건체중을 빼면 투석으로 뺄 물의 양이 됩니다. 투석 사이 체중 증가는 건체중의 3~5% 안이 좋습니다.', 'info')}
      <div class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))">${UI.input('pre', '투석 전 체중 (kg)', '', { type: 'number', step: '0.1' })}${UI.input('sbp', '수축기 혈압', '', { type: 'number' })}${UI.input('dbp', '이완기 혈압', '', { type: 'number' })}${UI.input('hr', '맥박', '', { type: 'number' })}${UI.input('bt', '체온', '', { type: 'number', step: '0.1' })}</div>
      ${cath ? `<div class="q-block"><div class="q">투석 도관 — 삽입 부위</div>${pick('acc1', ['깨끗함', '빨갛게 부음', '고름·삼출물'], '')}</div><div class="q-block"><div class="q">열·오한</div>${pick('acc2', ['없음', '있음 (도관 감염 의심)'], '')}</div>`
        : `<div class="q-block"><div class="q">동정맥루 — 손으로 만졌을 때 떨림 (진동)</div>${pick('acc1', ['잘 느껴짐', '약함', '없음 (막힘 의심)'], '')}</div><div class="q-block"><div class="q">청진기로 들었을 때 잡음</div>${pick('acc2', ['잘 들림', '약함·높은 음', '안 들림'], '')}</div>`}
      <div class="form-grid">${UI.select('edema', '부종', ['없음', '발목', '정강이까지', '온몸'], '없음')}${UI.select('dysp', '숨참', ['없음', '움직일 때', '쉴 때도'], '없음')}${UI.input('issue', '지난 투석 뒤 불편했던 점', '', { cls: 'wide' })}</div>
      <div class="btn-row end">${UI.btn('측정값 불러오기', 'hd.fill', { icon: 'refresh' })}${UI.btn('투석 전 사정 저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
  }
  function tabRun(p) {
    const s = today(p.id);
    if (!s) return UI.empty('투석 전 사정을 먼저 하세요');
    if (s.done) return UI.note('오늘 투석이 끝났습니다.', 'ok');
    if (!s.start) return `<form data-submit="hd.start" class="gap-m">
      ${UI.note(`제거 목표 <b>${s.ufGoal}mL</b> = (오늘 체중 ${s.pre} − 건체중 ${p.hd.dry})kg × 1000 + 식사·세척 200mL`, 'info')}
      <div class="form-grid">${UI.fld('투석 시간', pick('dur', [{ v: 210, l: '3시간 30분' }, { v: 240, l: '4시간' }, { v: 270, l: '4시간 30분' }], 240))}${UI.input('bfr', '혈류 속도 (mL/분)', '250', { type: 'number' })}
        ${UI.fld('투석액 칼륨', pick('k', ['2.0', '3.0'], '2.0'))}${UI.select('ca', '투석액 칼슘', ['2.5', '3.0'], '2.5')}
        ${UI.select('hep', '항응고제', ['헤파린: 시작 2,000단위 + 시간당 1,000단위', '헤파린 저용량 (출혈 위험)', '사용 안 함 (출혈·수술 직후)'], '헤파린: 시작 2,000단위 + 시간당 1,000단위', { cls: 'wide' })}${UI.input('uf', '목표 제거량 (mL)', s.ufGoal, { type: 'number' })}</div>
      <div class="gap-s">${['투석기 회로 점검·생리식염수로 공기 빼기', '환자 확인 (이름·생년월일)', p.hd.access.includes('도관') ? '도관 소독 후 연결 (마스크 착용)' : '동정맥루 천자 (동맥 쪽·정맥 쪽 바늘 방향 확인)', '경보 장치 켜짐 확인'].map((t) => UI.check('c', t, false, { multi: true, value: t })).join('')}</div>
      <div class="btn-row end">${UI.btn('투석 시작', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'refresh' })}</div></form>`;
    const mon = s.mon || [];
    return `<div class="gap-m">
      <div class="row box" style="background:var(--surface)">${UI.chip('투석 중', 'prog')}<span><b>시작</b> ${T.hm(s.start)}</span><span><b>경과</b> ${Math.round((Date.now() - s.start) / 60000)}분 / ${s.rx.dur}분</span><span><b>목표 제거</b> ${s.rx.uf}mL</span><span><b>혈류</b> ${s.rx.bfr}mL/분</span><span class="small muted">${esc(s.rx.hep)}</span></div>
      <form data-submit="hd.mon" class="panel"><div class="panel-h"><h3>30분마다 관찰</h3></div><div class="panel-b gap-m">
        <div class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr))">${UI.input('sbp', '수축기 혈압', '', { type: 'number' })}${UI.input('hr', '맥박', '', { type: 'number' })}${UI.input('bfr', '혈류 속도', s.rx.bfr, { type: 'number' })}${UI.input('vp', '정맥압 (mmHg)', '', { type: 'number' })}${UI.input('tmp', '막간압 (mmHg)', '', { type: 'number' })}${UI.input('ufNow', '누적 제거량 (mL)', '', { type: 'number' })}</div>
        <div class="q-block"><div class="q">증상</div>${pick('sym', ['없음', '어지러움·하품 (저혈압 신호)', '근육 경련', '메스꺼움·구토', '가슴 통증', '두통'], '없음')}</div>
        <div class="btn-row end">${UI.btn('측정값 불러오기', 'hd.monFill', { icon: 'refresh' })}${UI.btn('관찰 기록', '', { type: 'submit', kind: 'pri' })}</div></div></form>
      ${UI.note('<b>투석 중 저혈압 대처</b> (수축기 90 미만·어지러움): ① 머리를 낮추고 다리 올리기 ② 제거 속도 줄이거나 잠시 멈춤 ③ 생리식염수 100~200mL 주입 ④ 의사에게 알림. 근육 경련도 같은 방법으로 대처합니다.', 'warn')}
      ${UI.table([{ h: '시각' }, { h: '혈압' }, { h: '맥박' }, { h: '혈류' }, { h: '정맥압' }, { h: '막간압' }, { h: '제거량' }, { h: '증상' }], mon.slice().reverse().map((m) => [`<span class="num">${T.hm(m.t)}</span>`, m.sbp < 90 ? `<span class="hl-c">${m.sbp}</span>` : m.sbp, m.hr, m.bfr, m.vp, m.tmp, m.ufNow, esc(m.sym)]), { empty: '<p class="muted small">관찰 기록이 없습니다</p>' })}
    </div>`;
  }
  function tabPost(p) {
    const s = today(p.id);
    if (!s || !s.start) return UI.empty('투석을 시작한 뒤에 씁니다');
    if (s.done) return UI.note(`투석 후 체중 ${s.post}kg · 실제 제거 ${s.uf}mL · 혈압 ${s.sbpPost} · 지혈 ${s.hemo}분 · ${esc(s.note || '')}`, 'ok');
    return `<form data-submit="hd.post" class="gap-m"><div class="form-grid">${UI.input('post', '투석 후 체중 (kg)', '', { type: 'number', step: '0.1' })}${UI.input('sbp', '수축기 혈압', '', { type: 'number' })}${UI.input('hr', '맥박', '', { type: 'number' })}${UI.input('hemo', '바늘 뺀 뒤 지혈 시간 (분)', '10', { type: 'number' })}
      ${UI.select('comp', '합병증', ['없음', '투석 중 저혈압', '근육 경련', '지혈 지연', '혈관 통로 문제'], '없음')}${UI.input('next', '다음 투석', '')}</div>
      <div class="gap-s">${['일어설 때 어지러움 확인 (기립성 저혈압)', '지혈 부위 출혈 없음', '귀가 교육: 칼륨·인·물 제한, 동정맥루 팔로 무거운 것 들지 않기'].map((t) => UI.check('c', t, false, { multi: true, value: t })).join('')}</div>
      <div class="btn-row end">${UI.btn('투석 종료 기록', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
  }
  function tabHist(p) {
    const list = H.recs(p.id, 'hd'); const lab = H.recs(p.id, 'hdlab')[0];
    return `<div class="grid2">
      <div class="panel"><div class="panel-h"><h3>투석 기록</h3></div><div class="panel-b">${UI.table([{ h: '날짜' }, { h: '전 체중' }, { h: '후 체중' }, { h: '제거량' }, { h: '혈압 전→후' }], list.map((r) => [`<span class="num small">${T.md(r.at)}</span>`, `${r.pre}kg`, r.post ? `${r.post}kg` : '-', r.uf ? `${r.uf}mL` : '-', `${r.sbpPre || '-'} → ${r.sbpPost || '-'}`]), { empty: UI.empty('기록이 없습니다') })}</div></div>
      <form data-submit="hd.ktv" class="panel"><div class="panel-h"><h3>투석이 잘 되었는지 (투석 적절도)</h3></div><div class="panel-b gap-m">
        ${lab ? UI.note(`지난 검사 ${T.d(lab.at)}: 요소 제거율 ${lab.urr}% · Kt/V ${lab.ktv} · 칼륨 ${lab.k} · 인 ${lab.p} · 혈색소 ${lab.hb} · 알부민 ${lab.alb}`, 'info') : ''}
        <div class="form-grid">${UI.input('pre', '투석 전 요소질소 (BUN)', '', { type: 'number' })}${UI.input('post', '투석 후 요소질소 (BUN)', '', { type: 'number' })}${UI.input('hrs', '투석 시간 (시간)', '4', { type: 'number', step: '0.5' })}${UI.input('ufl', '제거량 (L)', '2.2', { type: 'number', step: '0.1' })}${UI.input('wt', '투석 후 체중 (kg)', p.hd.dry, { type: 'number', step: '0.1' })}</div>
        <div class="btn-row end">${UI.btn('계산·저장', '', { type: 'submit', kind: 'pri' })}</div>
        <p class="small muted" style="margin:0">요소 제거율 = (전 − 후) ÷ 전 × 100 → 65% 이상 / Kt/V (다우지르다스 공식) → 1.2 이상이 목표</p></div></form></div>`;
  }

  H.reg({
    id: 'dialysis', title: '인공신장실', actor: '인공신장실 간호사', layout: 'patient',
    channels: () => ['hd'],
    list() {
      return { title: '혈액투석 환자', rows: hdPats().map((p) => { const st = sesStatus(today(p.id)); return { pid: p.id, encId: '', loc: p.hd.days.replace(/·/g, ''), name: p.name, marks: UI.chip(st.t, st.c), sub: `${H.sexAge(p)} · ${esc(p.hd.access)} · 건체중 ${p.hd.dry}kg` }; }) };
    },
    render() {
      const p = A.pat();
      if (!p || !p.hd) return `<div class="panel"><div class="panel-b">${UI.empty('왼쪽에서 투석 환자를 고르세요', '혈액투석은 보통 일주일에 3번, 한 번에 4시간 합니다.')}</div></div>`;
      const tab = A.ms('tab', 'pre');
      return `<div class="panel">${UI.tabs('hd.tab', [{ id: 'pre', label: '투석 전 사정', icon: 'clip' }, { id: 'run', label: '투석 처방·관찰', icon: 'refresh' }, { id: 'post', label: '투석 후', icon: 'check' }, { id: 'hist', label: '기록·적절도', icon: 'list' }], tab)}<div class="panel-b">${{ pre: tabPre, run: tabRun, post: tabPost, hist: tabHist }[tab](p)}</div></div>`;
    },
    side() { const p = A.pat(); return p && p.hd ? H.view.sideVitals(p.id) : ''; },
    acts: {
      'hd.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'hd.fill': (el) => { const p = A.pat(); const ld = lastDone(p.id); const f = el.closest('form'); const s = (n, v) => { const i = f.querySelector(`[name="${n}"]`); if (i && !i.value) i.value = v; };
        s('pre', ((ld ? ld.post : p.hd.dry) + 1.8 + Math.random() * 1.2).toFixed(1)); s('sbp', 148 + Math.round(Math.random() * 16)); s('dbp', 82 + Math.round(Math.random() * 8)); s('hr', 76 + Math.round(Math.random() * 10)); s('bt', '36.6'); },
      'hd.pre': (f, d) => {
        const p = A.pat(); if (!d.pre || !d.sbp) return UI.toast('체중과 혈압은 꼭 넣어 주세요', 'warn'); if (!d.acc1 || !d.acc2) return UI.toast('혈관 통로 상태를 확인하세요', 'warn');
        const pre = Number(d.pre); const ld = lastDone(p.id); const gain = ld ? pre - ld.post : 0;
        const ufGoal = Math.max(0, Math.round((pre - p.hd.dry) * 1000 + 200));
        H.addRec('hd', p.id, { pre, sbpPre: Number(d.sbp), dbpPre: H.num(d.dbp), hrPre: H.num(d.hr), btPre: H.num(d.bt), acc: [d.acc1, d.acc2], edema: d.edema, dysp: d.dysp, issue: d.issue, ufGoal, gain, mon: [] });
        S.add('vitals', { id: H.uid('vs'), patientId: p.id, at: Date.now(), by: H.who(), sbp: Number(d.sbp), dbp: H.num(d.dbp), hr: H.num(d.hr), bt: H.num(d.bt) });
        p.weight = pre; S.save();
        const warn = [];
        if (d.acc1.includes('없음') || d.acc2.includes('안 들림')) warn.push('동정맥루 막힘 의심 — 투석하지 말고 의사에게 보고');
        if (d.acc2.includes('감염') || d.acc1.includes('고름')) warn.push('도관 감염 의심 — 혈액배양·의사 보고');
        if (gain > p.hd.dry * 0.05) warn.push(`체중 ${gain.toFixed(1)}kg 증가 (5% 넘음) — 수분 제한 교육`);
        if (Number(d.sbp) >= 180) warn.push('혈압 180 이상');
        if (warn.length) H.notify('doctor', `투석 전 이상: ${p.name} — ${warn.join(', ')}`, { patientId: p.id });
        UI.toast(warn.length ? warn.join(' / ') : `사정 저장 — 제거 목표 ${ufGoal}mL`, warn.length ? 'warn' : 'ok'); A.set('tab', 'run'); A.render();
      },
      'hd.start': (f, d) => {
        if ((d.c || []).length < 4) return UI.toast('시작 전 확인 항목을 모두 확인하세요', 'warn');
        const p = A.pat(); const s = today(p.id); s.start = Date.now(); s.rx = { dur: Number(d.dur), bfr: Number(d.bfr), k: d.k, ca: d.ca, hep: d.hep, uf: Number(d.uf) }; s.bfr = Number(d.bfr); s.dur = Number(d.dur);
        S.save(); H.log('투석 시작', p.name, p.id); UI.toast('투석 시작 — 30분마다 관찰하세요', 'ok'); A.render();
      },
      'hd.monFill': (el) => { const p = A.pat(); const s = today(p.id); const f = el.closest('form'); const n = (s.mon || []).length + 1; const st = (k, v) => { const i = f.querySelector(`[name="${k}"]`); if (i && !i.value) i.value = v; };
        st('sbp', Math.max(78, (s.sbpPre || 150) - n * 9 - Math.round(Math.random() * 8))); st('hr', 78 + n * 2); st('vp', 140 + Math.round(Math.random() * 30)); st('tmp', 90 + Math.round(Math.random() * 40)); st('ufNow', Math.min(s.rx.uf, Math.round((s.rx.uf / (s.rx.dur / 30)) * n))); },
      'hd.mon': (f, d) => {
        const p = A.pat(); const s = today(p.id); if (!d.sbp) return UI.toast('혈압을 넣어 주세요', 'warn');
        (s.mon = s.mon || []).push({ t: Date.now(), sbp: Number(d.sbp), hr: H.num(d.hr), bfr: H.num(d.bfr), vp: H.num(d.vp), tmp: H.num(d.tmp), ufNow: H.num(d.ufNow), sym: d.sym, by: H.who() });
        S.save();
        const low = Number(d.sbp) < 90 || d.sym.includes('어지러움');
        if (low) H.notify('doctor', `투석 중 저혈압: ${p.name} 혈압 ${d.sbp}`, { patientId: p.id, level: 'stat' });
        if (H.num(d.vp) > 250) UI.toast('정맥압이 높습니다 — 바늘 위치·회로 꺾임·혈관 협착 확인', 'warn');
        UI.toast(low ? '저혈압 — 다리 올리고 제거 속도 줄이기, 생리식염수, 의사 보고' : d.sym !== '없음' ? `${d.sym} — 대처하고 기록하세요` : '관찰 기록', low ? 'err' : d.sym !== '없음' ? 'warn' : 'ok'); A.render();
      },
      'hd.post': (f, d) => {
        const p = A.pat(); const s = today(p.id); if (!d.post) return UI.toast('투석 후 체중을 넣어 주세요', 'warn');
        Object.assign(s, { post: Number(d.post), sbpPost: H.num(d.sbp), hrPost: H.num(d.hr), hemo: H.num(d.hemo), comp: d.comp, next: d.next, uf: Math.round((s.pre - Number(d.post)) * 1000), end: Date.now(), done: true, note: d.comp });
        p.weight = Number(d.post); S.save(); H.log('투석 종료', `${p.name} 제거 ${s.uf}mL`, p.id);
        UI.toast(`투석 종료 — 실제 제거 ${s.uf}mL${Number(d.post) > p.hd.dry + 0.5 ? ' (건체중보다 0.5kg 넘게 남음)' : ''}`, 'ok'); A.set('tab', 'hist'); A.render();
      },
      'hd.ktv': (f, d) => {
        const p = A.pat(); const pre = H.num(d.pre), post = H.num(d.post); if (!pre || !post) return UI.toast('투석 전·후 요소질소를 넣어 주세요', 'warn');
        const R = post / pre; const t = H.num(d.hrs) || 4; const uf = H.num(d.ufl) || 0; const w = H.num(d.wt) || p.hd.dry;
        const urr = Math.round((1 - R) * 100); const ktv = (-Math.log(R - 0.008 * t) + (4 - 3.5 * R) * (uf / w)).toFixed(2);
        H.addRec('hdlab', p.id, { bunPre: pre, bunPost: post, urr, ktv, k: '-', p: '-', hb: '-', alb: '-' });
        UI.toast(`요소 제거율 ${urr}% · Kt/V ${ktv} — ${urr >= 65 && ktv >= 1.2 ? '적절' : '부족 (투석 시간·혈류 늘리기 검토)'}`, urr >= 65 && ktv >= 1.2 ? 'ok' : 'warn'); A.render();
      },
    },
  });

  // ───────── 외래 간호 ─────────
  const GUIDE = { LAB: '채혈실 (본관 1층)에서 채혈 — 결과는 다음 외래 때 설명', RAD: '영상의학과 예약 — 검사 날짜·금식 여부 안내', PATH: '조직검사 결과는 약 1주 뒤 외래에서 설명', INJ: '주사실에서 주사 맞기', PROC: '처치실 안내', CONSULT: '다른 과 협진 예약 안내' };
  const opdEncs = () => S.where('encounters', (e) => e.type === 'OPD' && (e.at >= T.startOfDay() || ['대기', '진료중'].includes(e.status))).sort((a, b) => a.at - b.at);
  const curOpd = () => { const e = A.enc(); return e && e.type === 'OPD' ? e : null; };
  function oPre(p, e) {
    const v = S.where('vitals', (x) => x.patientId === p.id && x.at >= T.startOfDay()).sort((a, b) => b.at - a.at)[0];
    return `<form data-submit="on.pre" class="gap-m">
      ${e.pre ? UI.note(`진료 전 준비 완료 (${esc(e.pre.by)} ${T.hm(e.pre.at)})`, 'ok') : UI.note('진료 전: 활력징후·키·몸무게를 재고, 오신 이유·복용 약·알레르기를 확인해 의사에게 전달합니다.', 'info')}
      <div class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr))">${UI.input('sbp', '수축기 혈압', v ? v.sbp : '', { type: 'number' })}${UI.input('dbp', '이완기 혈압', v ? v.dbp : '', { type: 'number' })}${UI.input('hr', '맥박', v ? v.hr : '', { type: 'number' })}${UI.input('bt', '체온', v ? v.bt : '', { type: 'number', step: '0.1' })}${UI.input('spo2', '산소포화도', v ? v.spo2 : '', { type: 'number' })}${UI.input('ht', '키 (cm)', p.height, { type: 'number' })}${UI.input('wt', '몸무게 (kg)', p.weight, { type: 'number', step: '0.1' })}</div>
      <div class="form-grid">${UI.input('cc', '오신 이유 (주호소)', e.cc || '', { cls: 'wide' })}${UI.input('meds', '지금 먹는 약', '', { cls: 'wide' })}${UI.input('pain', '통증 (0~10)', v ? v.pain : '', { type: 'number' })}</div>
      ${UI.check('allergy', `알레르기 다시 확인 — 기록: ${(p.allergies || []).map((a) => a.name).join(', ') || '없음'}`, false)}
      <div class="btn-row end">${UI.btn('진료 전 준비 완료 → 진료실에 알림', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
  }
  function oPost(p, e) {
    const os = S.where('orders', (o) => o.encId === e.id && !H.flow.isOff(o));
    const rx = os.some((o) => o.outside);
    return `<div class="gap-m">${e.status !== '진료완료' ? UI.note('아직 진료 중입니다. 진료가 끝나면 의사 처방에 따라 안내합니다.', 'warn') : ''}
      <div class="panel"><div class="panel-h"><h3>오늘 처방과 안내할 내용</h3>${rx ? UI.btn('원외처방전', 'paper.rx', { size: 'sm', icon: 'print', data: { enc: e.id } }) : ''}</div><div class="panel-b">${UI.table([{ h: '처방' }, { h: '진행' }, { h: '환자에게 안내' }], os.map((o) => [esc(o.name), H.flow.chip(o), esc(o.outside ? '원외처방전 → 병원 밖 약국에서 약 받기 (3일 안)' : GUIDE[o.cat] || '-')]), { empty: UI.empty('처방이 없습니다') })}</div></div>
      <form data-submit="on.post" class="panel"><div class="panel-h"><h3>진료 후 안내</h3></div><div class="panel-b gap-m">
        <div class="form-grid">${UI.input('next', '다음 외래 예약', e.guide ? e.guide.next : T.d(Date.now() + 14 * 86400000), { type: 'date' })}${UI.select('edu', '교육', H.M.EDU, H.M.EDU[1])}</div>
        <div class="gap-s">${['수납 창구 위치 안내 (원무과)', '검사 전 금식 안내', '이상 증상 생기면 응급실로 오도록 안내', '이해했는지 되묻기로 확인'].map((t) => UI.check('c', t, false, { multi: true, value: t })).join('')}</div>
        <div class="btn-row end">${UI.btn('안내 완료', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div>
        ${e.guide ? UI.note(`안내 완료 ${T.hm(e.guide.at)} — 다음 외래 ${esc(e.guide.next)}, 교육: ${esc(e.guide.edu)}`, 'ok') : ''}</div></form></div>`;
  }
  function oInj() {
    const list = S.where('orders', (o) => o.encType === 'OPD' && o.cat === 'INJ' && !H.flow.isOff(o) && !S.all('mar').some((m) => m.orderId === o.id));
    return `<div class="gap-m">${UI.note('간단히 보는 목록입니다. 관찰·이상반응·항암 주사까지 자세한 업무는 부서 지도의 <b>주사실</b>에서 하세요.', 'info')}
      ${UI.table([{ h: '처방 시각' }, { h: '환자' }, { h: '주사' }, { h: '약제부' }, { h: '' }], list.map((o) => { const pp = H.pat(o.patientId); return [`<span class="num small">${T.hm(o.at)}</span>`, `<b>${esc(pp.name)}</b> ${H.sexAge(pp)}`, `${esc(o.name)}<div class="small muted">${esc(H.view.doseText(o))}</div>`, H.flow.chip(o), o.status === '불출' ? UI.btn('주사 놓기', 'on.inj', { size: 'sm', kind: 'pri', data: { id: o.id } }) : '<span class="small muted">약제부 대기</span>']; }), { empty: UI.empty('주사 대기 환자가 없습니다') })}</div>`;
  }
  H.reg({
    id: 'opdnurse', title: '외래 간호', actor: '외래 간호사', layout: 'patient',
    channels: () => ['opd'],
    list() { return { title: '오늘 외래 환자', rows: opdEncs().map((e) => { const p = H.pat(e.patientId); return { pid: p.id, encId: e.id, loc: `${e.dept.slice(0, 2)} ${e.qno || ''}`, name: p.name, marks: `${e.pre ? '<span class="dot done" title="진료 전 준비 완료"></span>' : '<span class="dot prog" title="진료 전 준비 필요"></span>'}${UI.chip(e.status, e.status === '진료완료' ? 'done' : e.status === '진료중' ? 'prog' : 'sent')}`, sub: `${H.sexAge(p)} · ${esc(H.M.doctor(e.doctorId).name)} · ${esc(e.cc || '')}` }; }), empty: '오늘 외래 환자가 없습니다' }; },
    render() {
      const tab = A.ms('tab', 'pre');
      const p = A.pat(); const e = curOpd();
      const tabs = UI.tabs('on.tab', [{ id: 'pre', label: '진료 전 준비', icon: 'clip' }, { id: 'post', label: '진료 후 안내', icon: 'chat' }, { id: 'inj', label: '외래 주사실', icon: 'drop' }], tab);
      if (tab === 'inj') return `<div class="panel">${tabs}<div class="panel-b">${oInj()}</div></div>`;
      if (!p || !e) return `<div class="panel">${tabs}<div class="panel-b">${UI.empty('왼쪽에서 외래 환자를 고르세요')}</div></div>`;
      return `<div class="panel">${tabs}<div class="panel-b">${tab === 'pre' ? oPre(p, e) : oPost(p, e)}</div></div>`;
    },
    side() { const p = A.pat(); return p && curOpd() ? H.view.sideVitals(p.id) : ''; },
    acts: {
      'on.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'on.pre': (f, d) => {
        const p = A.pat(); const e = curOpd(); if (!d.sbp) return UI.toast('혈압을 재서 넣어 주세요', 'warn'); if (!d.allergy) return UI.toast('알레르기를 다시 확인하세요', 'warn');
        S.add('vitals', { id: H.uid('vs'), patientId: p.id, encId: e.id, at: Date.now(), by: H.who(), sbp: H.num(d.sbp), dbp: H.num(d.dbp), hr: H.num(d.hr), bt: H.num(d.bt), spo2: H.num(d.spo2), pain: H.num(d.pain) }, true);
        if (d.ht) p.height = Number(d.ht); if (d.wt) p.weight = Number(d.wt); e.cc = d.cc; e.meds = d.meds; e.pre = { at: Date.now(), by: H.who() }; S.save();
        const bmi = p.weight / ((p.height / 100) ** 2);
        H.notify('doctor', `진료 준비 완료: ${p.name} — 혈압 ${d.sbp}/${d.dbp}, 체질량지수 ${bmi.toFixed(1)}`, { patientId: p.id });
        H.log('외래 진료 전 준비', p.name, p.id); UI.toast(`진료 전 준비 완료 (체질량지수 ${bmi.toFixed(1)})${Number(d.sbp) >= 140 ? ' — 혈압이 높습니다' : ''}`, 'ok'); A.render();
      },
      'on.post': (f, d) => { const p = A.pat(); const e = curOpd(); e.guide = { next: d.next, edu: d.edu, checks: d.c || [], at: Date.now(), by: H.who() }; S.save(); S.add('acts', { id: H.uid('ac'), patientId: p.id, kind: '환자 교육', text: `외래 진료 후 안내 — ${d.edu}, 다음 외래 ${d.next}`, at: Date.now(), by: H.who() }); H.log('외래 진료 후 안내', p.name, p.id); UI.toast('진료 후 안내 완료', 'ok'); A.render(); },
      'on.inj': (el) => {
        const o = S.get('orders', el.dataset.id); const p = H.pat(o.patientId);
        UI.modal({ title: `주사 — ${o.name}`, body: `<form data-submit="on.injGo" class="gap-m"><input type="hidden" name="id" value="${o.id}"><p style="margin:0"><b>${esc(p.name)}</b> ${H.sexAge(p)} · ${esc(H.view.doseText(o))}</p>
          ${(p.allergies || []).length ? UI.note(`알레르기: ${(p.allergies || []).map((a) => esc(a.name)).join(', ')}`, 'danger') : ''}
          <div class="gap-s">${['맞는 환자', '맞는 약', '맞는 용량', '맞는 경로', '맞는 시간', '주사 후 15~30분 관찰 안내'].map((t) => UI.check('c', t, false, { multi: true, value: t })).join('')}</div>
          ${UI.select('site', '주사 부위', ['엉덩이 근육', '위팔 근육', '팔 정맥'], o.route === 'IV' ? '팔 정맥' : '엉덩이 근육')}
          <div class="btn-row end">${UI.btn('주사 기록', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` });
      },
      'on.injGo': (f, d) => { if ((d.c || []).length < 6) return UI.toast('모든 항목을 확인하세요', 'err'); const o = S.get('orders', d.id); S.add('mar', { id: H.uid('ma'), orderId: o.id, patientId: o.patientId, slot: Date.now(), status: '투약', at: Date.now(), by: H.who(), checks: d.c, site: d.site }); UI.close(); UI.toast('외래 주사 기록', 'ok'); A.render(); },
    },
  });
})();
