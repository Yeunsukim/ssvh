// 내시경실 + 주사실 (외래 주사·항암 주사)
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const F = H.flow;
  const MIN = 60000;
  const pick = (name, opts, v, on) => UI.pick(name, opts.map((o) => (typeof o === 'object' ? o : { v: o, l: o })), v, on ? { on } : {});
  const checks = (name, list, on = []) => `<div class="gap-s">${list.map((t) => UI.check(name, t, on.includes(t), { multi: true, value: t })).join('')}</div>`;
  const ms = (k, d) => A.ms(k, d); const set = (k, v) => A.set(k, v);
  const ageOf = (p) => H.age(p.birth);

  // ───────── 내시경실 ─────────
  const enOrders = () => S.where('orders', (o) => o.cat === 'EN' && !F.isOff(o));
  const curEn = () => { const p = A.pat(); if (!p) return null; const l = enOrders().filter((o) => o.patientId === p.id).sort((a, b) => a.at - b.at); return l.find((o) => o.status !== '검사완료') || l[l.length - 1] || null; };
  const enOf = (o) => (o.en = o.en || {});
  const colon = (o) => ['E8102', 'E8105'].includes(o.code);
  function scopeImg(kind) {
    const lesion = kind === 'ulcer' ? '<ellipse cx="215" cy="160" rx="34" ry="24" fill="#f4efe2"/><ellipse cx="215" cy="160" rx="40" ry="30" fill="none" stroke="#c4343c" stroke-width="7" opacity=".7"/>'
      : kind === 'polyp' ? '<ellipse cx="190" cy="175" rx="26" ry="22" fill="#e07a6e"/><ellipse cx="184" cy="168" rx="10" ry="7" fill="#f6b3a6" opacity=".7"/><path d="M190 197 L196 230" stroke="#c96a5e" stroke-width="10"/>'
      : kind === 'bleed' ? '<ellipse cx="205" cy="150" rx="30" ry="20" fill="#f1e8dc"/><circle cx="210" cy="150" r="6" fill="#5a0b10"/><path d="M210 156 Q215 200 205 260" stroke="#a3101a" stroke-width="12" fill="none" opacity=".85"/>' : '';
    return `<svg viewBox="0 0 400 300" style="width:100%;max-width:24rem;background:#000;border-radius:6px" role="img" aria-label="교육용 가상 내시경 사진"><defs><radialGradient id="mu" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#3a0d0d"/><stop offset=".45" stop-color="#b54a45"/><stop offset="1" stop-color="#e48a7c"/></radialGradient></defs>
      <circle cx="200" cy="150" r="140" fill="url(#mu)"/>${[0, 1, 2, 3, 4].map((i) => `<path d="M${80 + i * 20} ${60 + i * 8} Q200 ${130 + i * 6} ${320 - i * 20} ${60 + i * 8}" stroke="#f0a596" stroke-width="3" fill="none" opacity=".45"/>`).join('')}
      ${lesion}<ellipse cx="150" cy="95" rx="22" ry="8" fill="#fff" opacity=".35"/><text x="12" y="20" fill="#8fe6d8" font-size="11" font-family="monospace">SSV 내시경 · 교육용 가상 사진</text></svg>`;
  }
  const RASSL = ['깨어 있음 (말로 반응)', '졸림 (부르면 반응)', '깊은 진정 (통증에만 반응)', '반응 없음'];
  const PADSS = [['vs', '활력징후 (시술 전 대비)', ['20% 넘게 차이 (0)', '20% 안 (1)', '거의 같음 (2)']], ['walk', '걷기', ['어지러워 못 걸음 (0)', '부축하면 걸음 (1)', '혼자 안정적으로 걸음 (2)']], ['nv', '오심·구토', ['심함 (0)', '중간 (1)', '거의 없음 (2)']], ['pain', '통증·복부 팽만', ['심함 (0)', '중간 (1)', '거의 없음 (2)']], ['bleed', '출혈', ['많음 (0)', '조금 (1)', '없음 (2)']]];

  function enList() {
    const all = enOrders().filter((o) => o.status !== '검사완료' || Date.now() - o.at < 12 * 3600000).sort((a, b) => b.stat - a.stat || ((a.en || {}).time || '99').localeCompare((b.en || {}).time || '99'));
    return { title: '내시경 환자', rows: all.map((o) => { const p = H.pat(o.patientId); return { pid: p.id, encId: o.encId, loc: o.stat ? '응급' : ((o.en || {}).time || '미정'), name: p.name, marks: `${o.stat ? UI.chip('응급', 'stat') : ''}${F.chip(o)}`, sub: `${H.sexAge(p)} · ${esc(o.name)}` }; }), empty: '내시경 처방이 없습니다 (처방 → 내시경)' };
  }
  function eSched(o, p) {
    const en = enOf(o); const it = H.M.item(o.code);
    const anti = H.flow.activeMeds(p.id).filter((x) => /antiplatelet|anticoagulant/.test((H.M.item(x.code) || {}).cls || '')).map((x) => x.name);
    return `<div class="gap-m">
      ${o.status === '전송' ? `<form data-submit="en.sched" class="panel"><div class="panel-h"><h3>예약</h3></div><div class="panel-b gap-m"><div class="form-grid">${UI.fld('날짜', pick('date', [{ v: T.d(Date.now()), l: '오늘' }, { v: T.d(Date.now() + 86400000), l: '내일' }, { v: T.d(Date.now() + 7 * 86400000), l: '1주 뒤' }], o.stat ? T.d(Date.now()) : T.d(Date.now() + 86400000)))}${UI.input('time', '시각', o.stat ? T.hm(Date.now() + 20 * MIN) : '10:00')}${UI.fld('검사실', pick('room', ['내시경실 1', '내시경실 2', '병상 옆 (중환자실)'], '내시경실 1'))}${UI.fld('진정 (수면)', pick('sed', [{ v: '1', l: '수면 내시경' }, { v: '', l: '비수면' }], '1'))}</div>
        <div class="btn-row end">${UI.btn('예약 확정', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></div></form>` : UI.note(`예약: ${esc(en.date || '')} ${esc(en.time || '')} · ${esc(en.room || '')} · ${en.sed ? '수면' : '비수면'}`, 'ok')}
      ${anti.length ? UI.note(`<b>항혈소판제·항응고제 복용 중</b>: ${anti.map(esc).join(', ')} — 조직검사·용종 절제가 있으면 중단 여부를 처방 의사와 심장내과에 확인합니다 (와파린은 보통 5일 전 중단). 마음대로 끊으면 혈전 위험!`, 'warn') : ''}
      <form data-submit="en.edu" class="panel"><div class="panel-h"><h3>검사 전 교육 — ${esc(it.name)}</h3>${en.edu ? UI.chip('교육 완료', 'done') : ''}</div><div class="panel-b gap-m">
        ${checks('e', colon(o) ? ['3일 전부터 씨 있는 과일·김·잡곡·채소 피하기', '전날 점심부터 흰죽, 저녁부터 금식', '장 정결제 2L를 둘로 나눠 마심 (전날 저녁 8시 1L, 당일 새벽 5시 1L)', '맑은 노란 물 같은 변이 나오면 준비 완료', '당뇨약·인슐린은 검사 당일 아침 쉼', '수면 내시경 — 보호자 동행, 당일 운전 금지'] : ['전날 저녁 9시 이후 금식 (물도 검사 4시간 전부터 금지)', '혈압약은 당일 아침 물 조금과 복용', '당뇨약·인슐린은 검사 당일 아침 쉼', '틀니·안경·장신구 빼기', '수면 내시경 — 보호자 동행, 당일 운전 금지'], en.edu || [])}
        <div class="btn-row end">${UI.btn('교육 기록', '', { type: 'submit', kind: 'pri' })}</div></div></form></div>`;
  }
  function ePrep(o, p) {
    const en = enOf(o);
    if (o.status === '전송') return UI.empty('예약을 먼저 확정하세요');
    if (en.prep) return UI.note(`전처치 완료 — 미다졸람 ${en.prep.dose}mg · ASA ${esc(en.prep.asa)}${en.prep.boston != null ? ` · 장정결 점수 ${en.prep.boston}/9` : ''}`, 'ok');
    const age = ageOf(p); const per = age >= 70 ? 0.03 : 0.05; const dose = Math.min(5, Math.round(p.weight * per * 10) / 10);
    return `<form data-submit="en.prep" class="gap-m" id="en-prep">
      ${checks('c', ['내시경·진정·조직검사 동의서', '금식 확인 (마지막 식사 시각 확인)', '알레르기·복용 약 확인', '틀니·장신구 제거', en.sed ? '보호자 동행 확인 · 당일 운전·중요 결정 금지 서약' : '비수면 — 검사 중 숨쉬기 방법 설명', '정맥로 확보', '산소포화도 감시 장치·산소·흡인기 준비', '해독제 플루마제닐 준비'])}
      ${UI.fld('미국마취과학회 신체 등급 (ASA)', pick('asa', ['1 건강함', '2 가벼운 전신 질환', '3 심한 전신 질환', '4 생명 위협 질환'], ''))}
      ${colon(o) ? `<div class="q-block"><div class="q">장 정결 상태 (보스턴 점수 — 구역별 0~3, 합 6 이상이면 적절)</div><div class="grid3">${['오른쪽 대장', '가로 대장', '왼쪽 대장'].map((l, i) => `<div><div class="small">${l}</div>${pick('b' + i, [0, 1, 2, 3].map((v) => ({ v, l: String(v) })), '')}</div>`).join('')}</div></div>` : `${UI.check('lido', '인두 마취 — 리도카인 스프레이 (마취 후 1시간 금식 안내)', false)}`}
      ${en.sed ? UI.note(`진정제 용량: 미다졸람 ${per}mg/kg × ${p.weight}kg = <b>${dose}mg</b> ${age >= 70 ? '(70세 이상이라 줄임)' : ''} — 최대 5mg, 1~2mg씩 나눠 천천히`, 'info') : ''}
      <div class="btn-row end">${UI.btn('전처치 완료 → 검사실', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div><input type="hidden" name="dose" value="${en.sed ? dose : 0}"></form>`;
  }
  function eIntra(o, p, e) {
    const en = enOf(o); const sc = ((p.scenario || {}).endo || {})[o.code] || {};
    if (!['전처치', '시술중'].includes(o.status)) return o.status === '회복' || o.status === '검사완료' ? UI.note('검사가 끝났습니다. 회복 탭으로 가세요.', 'ok') : UI.empty('전처치를 먼저 하세요');
    if (o.status === '전처치') return `<div class="gap-m">${UI.note('타임아웃: 환자 확인·검사명·진정 계획·응급 약물 위치를 팀이 함께 확인한 뒤 내시경을 넣습니다.', 'info')}${UI.btn('타임아웃 확인 → 내시경 삽입 (검사 시작)', 'en.start', { kind: 'danger', size: 'lg', icon: 'eye' })}</div>`;
    const mon = en.mon || [];
    return `<div class="gap-m"><div class="grid2"><div class="gap-m">${en.shot ? scopeImg(sc.lesion) : `<div class="box" style="text-align:center">${UI.btn('사진 촬영 (병변 기록)', 'en.shot', { icon: 'image' })}</div>`}
        <form data-submit="en.mon" class="panel"><div class="panel-h"><h3>진정 감시 (5분마다)</h3></div><div class="panel-b gap-m">
          <div class="form-grid">${UI.input('spo2', '산소포화도', '', { type: 'number' })}${UI.input('hr', '맥박', '', { type: 'number' })}${UI.input('sbp', '수축기 혈압', '', { type: 'number' })}</div>${UI.fld('진정 정도', pick('sed', RASSL, RASSL[1]))}
          <div class="btn-row end">${UI.btn('감시 장치 불러오기', 'en.monFill', { size: 'sm', icon: 'refresh' })}${UI.btn('기록', '', { type: 'submit', kind: 'pri', size: 'sm' })}</div>
          ${UI.table([{ h: '시각' }, { h: '산소' }, { h: '맥박' }, { h: '혈압' }, { h: '진정' }], mon.slice().reverse().map((m) => [`<span class="num">${T.hm(m.t)}</span>`, m.spo2 < 90 ? `<span class="hl-c">${m.spo2}</span>` : m.spo2, m.hr, m.sbp, `<span class="small">${esc(m.sed)}</span>`]), { empty: '<p class="muted small">기록 없음</p>' })}</div></form></div>
      <form data-submit="en.find" class="panel"><div class="panel-h"><h3>소견·시술</h3></div><div class="panel-b gap-m">
        ${UI.textarea('find', '내시경 소견', en.find || '', { h: '5rem' })}${UI.textarea('impr', '결론', en.impr || '', { h: '3rem' })}
        <div class="fld"><span class="lbl">한 시술</span>${checks('proc', ['조직검사 (병리과 의뢰)', '헬리코박터 신속 요소분해효소 검사', '용종 절제 (올가미)', '지혈 — 에피네프린 주입', '지혈 — 클립', '지혈 — 소작'], en.proc || [])}</div>
        ${UI.input('pieces', '조직 개수', en.pieces || '2', { type: 'number' })}
        <div class="btn-row end">${UI.btn('판독 불러오기 (사례)', 'en.fill', { icon: 'refresh' })}${UI.btn('소견 저장', '', { type: 'submit', kind: 'pri' })}</div></div></form></div>
      <div class="btn-row end">${UI.btn('검사 종료 → 회복실', 'en.end', { kind: 'pri', size: 'lg', icon: 'check' })}</div></div>`;
  }
  function eRecov(o, p, e) {
    const en = enOf(o);
    if (!['회복', '검사완료'].includes(o.status)) return UI.empty('검사가 끝나면 회복을 관찰합니다');
    if (o.status === '검사완료') return UI.note(`회복 완료 — 귀가 점수 ${en.padss}점 · ${esc(en.dest || '')}`, 'ok');
    return `<form data-submit="en.recov" class="gap-m" id="padss">${UI.note('회복실: 진정에서 깨어날 때까지 산소포화도·활력징후를 보고, 귀가 점수(PADSS) 9점 이상이면 보호자와 귀가합니다.', 'info')}
      ${PADSS.map(([k, q, opts]) => `<div class="q-block"><div class="q">${esc(q)}</div>${pick(k, opts.map((l, i) => ({ v: i, l })), '', 'en.padss')}</div>`).join('')}
      <div class="box"><span class="muted small">귀가 점수</span> <span class="score-big" id="padss-score">-</span></div>
      ${UI.sec('귀가 교육')}${checks('edu', ['오늘은 운전·기계 조작·중요한 결정 금지', '1시간 뒤 물부터, 부드러운 음식 시작', en.proc && en.proc.some((x) => x.includes('용종')) ? '용종 절제 후 2일간 술·자극적 음식·무리한 운동 금지' : '조직검사 결과는 약 1주 뒤 외래에서', '검은 변·피를 토함·심한 배 통증·열이 나면 바로 응급실', '헬리코박터 양성이면 제균 치료 약 2주 꼭 다 먹기'])}
      <div class="btn-row end">${UI.btn('회복 완료', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
  }
  function eWash() {
    const recs = S.where('recs', (r) => r.kind === 'scope').sort((a, b) => b.at - a.at);
    const used = enOrders().filter((o) => o.en && o.en.scopeNo && !S.where('recs', (r) => r.kind === 'scope' && r.orderId === o.id).length);
    return `<div class="gap-m">${UI.note('내시경은 몸속 점막에 닿는 기구라 "고수준 소독"을 합니다. 어느 내시경을 어느 환자에게 썼는지 기록해 두어야 감염이 생겼을 때 추적할 수 있습니다.', 'info')}
      <form data-submit="en.wash" class="panel"><div class="panel-h"><h3>세척·소독 기록</h3></div><div class="panel-b gap-m">
        <div class="form-grid">${UI.select('oid', '사용한 검사', used.map((o) => ({ v: o.id, l: `${H.pat(o.patientId).name} — ${o.name} (${o.en.scopeNo})` })), '')}</div>
        ${checks('c', ['검사 직후 겉면 닦고 흡인 채널에 세제 흡인 (침상 옆 1차 세척)', '누수 검사', '효소 세제로 모든 채널 솔질 (수동 세척)', '흐르는 물로 헹굼', '자동 세척소독기 — 과아세트산 고수준 소독 (농도 확인 스트립)', '알코올 흘려 넣고 공기로 건조', '내시경 보관장에 수직으로 걸어 보관'])}
        <div class="btn-row end">${UI.btn('소독 완료 기록', '', { type: 'submit', kind: 'pri', disabled: !used.length })}</div></div></form>
      ${UI.table([{ h: '시각' }, { h: '내시경 번호' }, { h: '사용 환자' }, { h: '소독제 농도' }, { h: '담당' }], recs.map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, `<span class="mono">${esc(r.scope)}</span>`, esc(r.pname), UI.chip('적합', 'done'), `<span class="small">${esc(r.by)}</span>`]), { empty: UI.empty('소독 기록이 없습니다') })}</div>`;
  }

  H.reg({
    id: 'endo', title: '내시경실', actor: '내시경실 간호사', layout: 'patient', channels: () => ['endo'], list: enList,
    render() {
      const o = curEn(); const tab = ms('tab', 'sched');
      const tabs = [{ id: 'sched', label: '예약·검사 전 교육', icon: 'clock' }, { id: 'prep', label: '전처치', icon: 'clip' }, { id: 'intra', label: '검사 중', icon: 'eye' }, { id: 'recov', label: '회복·귀가', icon: 'home' }, { id: 'wash', label: '세척·소독', icon: 'drop' }];
      if (tab === 'wash' || !o) return `<div class="panel">${UI.tabs('en.tab', tabs, 'wash')}<div class="panel-b">${o ? '' : UI.empty('왼쪽에서 환자를 고르세요', '위·대장 내시경, 담췌관 조영술(ERCP), 응급 지혈술을 합니다.')}${eWash()}</div></div>`;
      const p = H.pat(o.patientId); const e = H.enc(o.encId);
      const body = { sched: eSched, prep: ePrep, intra: eIntra, recov: eRecov }[tab](o, p, e);
      return `<div class="panel"><div class="panel-h"><h3>${esc(o.name)}</h3>${o.stat ? UI.chip('응급', 'stat') : ''}${F.chip(o)}</div>${UI.tabs('en.tab', tabs, tab)}<div class="panel-b">${body}</div></div>`;
    },
    side() { const p = A.pat(); return p && curEn() ? H.view.sideVitals(p.id) : ''; },
    onPick() { const o = curEn(); if (o) set('tab', { 전송: 'sched', 예약확정: 'prep', 전처치: 'intra', 시술중: 'intra', 회복: 'recov', 검사완료: 'recov' }[o.status] || 'sched'); },
    acts: {
      'en.tab': (el) => { set('tab', el.dataset.v); A.render(); },
      'en.sched': (f, d) => { const o = curEn(); Object.assign(enOf(o), { date: d.date, time: d.time, room: d.room, sed: !!d.sed }); F.advance(o, '예약확정'); if (o.ward) H.notify('ward:' + o.ward, `내시경 예약: ${H.pat(o.patientId).name} ${d.date} ${d.time} — 금식·정맥로 준비`, { patientId: o.patientId }); UI.toast('예약 확정', 'ok'); A.render(); },
      'en.edu': (f, d) => { const o = curEn(); enOf(o).edu = d.e || []; S.save(); UI.toast('검사 전 교육 기록', 'ok'); A.render(); },
      'en.prep': (f, d) => {
        const o = curEn(); const en = enOf(o);
        if ((d.c || []).length < 6) return UI.toast('전처치 항목을 확인하세요 (6개 이상)', 'warn'); if (!d.asa) return UI.toast('ASA 등급을 고르세요', 'warn');
        let boston = null; if (colon(o)) { if (['b0', 'b1', 'b2'].some((k) => d[k] === '')) return UI.toast('장 정결 점수를 고르세요', 'warn'); boston = Number(d.b0) + Number(d.b1) + Number(d.b2); }
        en.prep = { checks: d.c, asa: d.asa, boston, dose: Number(d.dose), by: H.who(), at: Date.now() }; F.advance(o, '전처치');
        if (en.sed) S.add('mar', { id: H.uid('ma'), orderId: o.id, patientId: o.patientId, slot: Date.now(), status: '투약', at: Date.now(), by: H.who(), checks: ['미다졸람 ' + d.dose + 'mg (내시경 진정)'] }, true);
        S.save(); UI.toast(boston != null && boston < 6 ? `장 정결 ${boston}점 — 부적절, 의사와 재검사 여부 상의` : '전처치 완료', boston != null && boston < 6 ? 'warn' : 'ok'); set('tab', 'intra'); A.render();
      },
      'en.start': () => { const o = curEn(); const en = enOf(o); en.start = Date.now(); en.scopeNo = colon(o) ? 'CF-0' + (1 + Math.floor(Math.random() * 3)) : 'GIF-0' + (1 + Math.floor(Math.random() * 3)); en.mon = []; F.advance(o, '시술중'); UI.toast(`검사 시작 — 내시경 ${en.scopeNo}`, 'ok'); A.render(); },
      'en.shot': () => { const o = curEn(); enOf(o).shot = true; S.save(); A.render(); },
      'en.monFill': (el) => { const p = A.pat(); const f = el.closest('form'); const s = (n, v) => { const i = f.querySelector(`[name="${n}"]`); if (i && !i.value) i.value = v; }; const n = (curEn().en.mon || []).length; s('spo2', n === 1 && ageOf(p) >= 70 ? 88 : 96 + Math.round(Math.random() * 3)); s('hr', 78 + Math.round(Math.random() * 12)); s('sbp', 112 + Math.round(Math.random() * 15)); },
      'en.mon': (f, d) => { const o = curEn(); const en = enOf(o); (en.mon = en.mon || []).push({ t: Date.now(), spo2: H.num(d.spo2), hr: H.num(d.hr), sbp: H.num(d.sbp), sed: d.sed }); S.save(); if (H.num(d.spo2) < 90 || d.sed === '반응 없음') UI.toast('산소포화도 저하·과진정 — 턱 들어 올리기, 산소 늘리기, 계속 떨어지면 플루마제닐', 'err'); A.render(); },
      'en.fill': (el) => { const p = A.pat(); const o = curEn(); const sc = ((p.scenario || {}).endo || {})[o.code] || { find: '특이 소견 없음', impr: '정상' }; const f = el.closest('form'); f.querySelector('[name=find]').value = sc.find; f.querySelector('[name=impr]').value = sc.impr; if (sc.biopsy) f.querySelectorAll('[name=proc]').forEach((c) => { if (c.value.startsWith('조직검사') || (sc.lesion === 'polyp' && c.value.startsWith('용종'))) c.checked = true; }); if (sc.lesion === 'bleed') f.querySelectorAll('[name=proc]').forEach((c) => { if (c.value.includes('에피네프린') || c.value.includes('클립')) c.checked = true; }); },
      'en.find': (f, d) => {
        const o = curEn(); const en = enOf(o); const p = H.pat(o.patientId); const e = H.enc(o.encId);
        Object.assign(en, { find: d.find, impr: d.impr, proc: d.proc || [], pieces: d.pieces });
        if ((d.proc || []).some((x) => x.startsWith('조직검사') || x.startsWith('용종')) && !en.pathId) { const [x] = F.create(e, [{ code: 'P4001', note: `내시경 ${(d.proc || []).some((y) => y.startsWith('용종')) ? '용종 절제' : '생검'} ${d.pieces || 1}조각 — ${d.impr || ''}` }]); en.pathId = x.id; UI.toast('조직검사를 병리과로 보냈습니다 (검체 라벨·포르말린 확인)', 'ok'); }
        S.save(); A.render();
      },
      'en.end': () => { const o = curEn(); const en = enOf(o); if (!en.impr) return UI.toast('소견·결론을 저장하세요', 'warn'); en.end = Date.now(); F.advance(o, '회복'); set('tab', 'recov'); A.render(); },
      'en.padss': (el) => { const d = H.formData(el.closest('form')); const v = PADSS.map(([k]) => d[k]); const s = v.reduce((a, x) => a + (H.num(x) || 0), 0); document.getElementById('padss-score').textContent = v.every((x) => x !== '') ? `${s} ${s >= 9 ? '— 귀가 가능' : '— 더 관찰'}` : '-'; },
      'en.recov': (f, d) => {
        const v = PADSS.map(([k]) => d[k]); if (v.some((x) => x === '')) return UI.toast('귀가 점수 다섯 문항을 고르세요', 'warn');
        const s = v.reduce((a, x) => a + Number(x), 0); if (s < 9) return UI.toast(`귀가 점수 ${s}점 — 9점 이상이 될 때까지 관찰하세요`, 'warn');
        if ((d.edu || []).length < 3) return UI.toast('귀가 교육을 확인하세요', 'warn');
        const o = curEn(); const en = enOf(o); const p = H.pat(o.patientId); const e = H.enc(o.encId);
        en.padss = s; en.dest = e.type === 'IPD' ? `${e.ward} 병동 복귀` : '보호자와 귀가'; F.advance(o, '검사완료', { result: { at: Date.now(), by: H.who(), findings: en.find, impression: en.impr } });
        H.notify('doctor', `내시경 결과: ${p.name} — ${en.impr}`, { patientId: p.id, level: /출혈|지혈|암/.test(en.impr) ? 'stat' : '' });
        if (e.type === 'IPD') H.notify('ward:' + e.ward, `내시경 후 복귀: ${p.name} — ${en.impr}. 금식 해제 시점 의사 확인, 활력징후·출혈 관찰`, { patientId: p.id });
        H.log('내시경 완료', `${p.name} ${o.name}`, p.id); UI.toast('회복 완료', 'ok'); A.render();
      },
      'en.wash': (f, d) => { if (!d.oid) return; if ((d.c || []).length < 7) return UI.toast('세척·소독 7단계를 모두 확인하세요', 'warn'); const o = S.get('orders', d.oid); H.addRec('scope', o.patientId, { orderId: o.id, scope: o.en.scopeNo, pname: H.pat(o.patientId).name, c: d.c }); UI.toast(`${o.en.scopeNo} 고수준 소독 완료 — 보관`, 'ok'); A.render(); },
    },
  });

  // ───────── 주사실 (외래·항암) ─────────
  const injs = () => S.where('orders', (o) => o.encType === 'OPD' && o.cat === 'INJ' && !F.isOff(o));
  const given = (o) => S.all('mar').some((m) => m.orderId === o.id && m.status === '투약');
  const bsaOf = (p) => Math.sqrt((p.height * p.weight) / 3600);
  const obsList = () => S.where('recs', (r) => r.kind === 'injobs' && !r.done);
  function iQueue() {
    const list = injs().filter((o) => !H.M.item(o.code).chemo && !given(o));
    return `<div class="gap-m">${UI.note('외래 주사실: 처방 확인 → 약제부에서 주사실로 불출된 약 확인 → 환자 확인 (이름·생년월일, 팔찌 또는 신분 확인) → 투약 5원칙 → 주사 → 15~30분 관찰.', 'info')}
      ${UI.table([{ h: '순번' }, { h: '환자' }, { h: '주사' }, { h: '약제부' }, { h: '' }], list.map((o, i) => { const p = H.pat(o.patientId); return [`<span class="num">${i + 1}</span>`, `<b>${esc(p.name)}</b> <span class="small muted">${H.sexAge(p)}</span>${(p.allergies || []).length ? ' ' + UI.chip('알레르기', 'stat') : ''}`, `${esc(o.name)}<div class="small muted">${esc(H.view.doseText(o))}${o.note ? ' · ' + esc(o.note) : ''}</div>`, F.chip(o), o.status === '불출' ? UI.btn('주사', 'ij.give', { size: 'sm', kind: 'pri', data: { id: o.id } }) : '<span class="small muted">약제부 불출 대기</span>']; }), { empty: UI.empty('주사 대기 환자가 없습니다') })}</div>`;
  }
  function iObs() {
    const list = obsList();
    return `<div class="gap-m">${UI.note('주사 후 관찰: 처음 주사·항생제·철분·조영제·항암제는 이상반응이 잘 생깁니다. 아나필락시스는 대부분 30분 안에 생깁니다.', 'warn')}
      ${list.map((r) => { const p = H.pat(r.patientId); const left = Math.ceil((r.at + r.min * MIN - Date.now()) / MIN); return `<div class="box" style="background:var(--surface)"><div class="row between"><div><b>${esc(p.name)}</b> <span class="small muted">${esc(r.drug)} · 시작 ${T.hm(r.at)}</span></div>${left > 0 ? UI.chip(`관찰 ${left}분 남음`, 'prog') : UI.chip('관찰 시간 끝', 'done')}</div>
        <div class="btn-row end" style="margin-top:.5rem">${UI.btn('이상반응 발생', 'ij.adr', { kind: 'danger', data: { id: r.id } })}${UI.btn('이상 없음 — 귀가', 'ij.ok', { kind: 'pri', data: { id: r.id } })}</div></div>`; }).join('') || UI.empty('관찰 중인 환자가 없습니다')}
      ${UI.sec('이상반응 기록')}${UI.table([{ h: '시각' }, { h: '환자' }, { h: '약' }, { h: '증상' }, { h: '정도' }], S.where('recs', (r) => r.kind === 'adr').map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, esc(H.pat(r.patientId).name), esc(r.drug), `<span class="small">${(r.sym || []).map(esc).join(', ')}</span>`, UI.chip(r.grade, r.grade.includes('아나필락시스') ? 'stat' : 'prog')]), { empty: '<p class="muted small">없음</p>' })}</div>`;
  }
  function iChemo() {
    const pats = [...new Set(injs().filter((o) => H.M.item(o.code).chemo).map((o) => o.patientId))].map(H.pat);
    const sel = ms('cp', pats[0] ? pats[0].id : ''); const p = pats.find((x) => x.id === sel) || pats[0];
    if (!p) return UI.empty('항암 주사 환자가 없습니다');
    const os = injs().filter((o) => o.patientId === p.id); const chemo = os.filter((o) => H.M.item(o.code).chemo);
    const bsa = bsaOf(p); const c = p.chemo || {}; const ch = p.chemoCheck || {};
    const wbc = F.lastLab(p.id, 'WBC'), plt = F.lastLab(p.id, 'PLT');
    const okLab = wbc && plt && wbc.v >= 3.0 && plt.v >= 100;
    const cum = (c.cycle || 1) * 60;
    return `<div class="gap-m">${pats.length > 1 ? UI.seg('ij.cp', pats.map((x) => ({ v: x.id, l: x.name })), p.id) : ''}
      <div class="row box" style="background:var(--surface)"><b>${esc(p.name)}</b><span>${esc(c.regimen || '')}</span><span>${c.cycle || '-'} / ${c.of || '-'}회차</span>${c.noLeftArm ? UI.chip('왼팔 주사·혈압 금지 (림프절 절제)', 'stat') : ''}</div>
      <div class="grid2"><form data-submit="ij.cCheck" class="panel"><div class="panel-h"><h3>① 투여 전 확인</h3>${ch.at ? UI.chip('완료', 'done') : ''}</div><div class="panel-b gap-m">
        <dl class="kv"><dt>키·몸무게</dt><dd>${p.height}cm · ${p.weight}kg</dd><dt>체표면적 (모스텔러)</dt><dd class="num"><b>${bsa.toFixed(2)} m²</b> = √(키×몸무게÷3600)</dd>
          ${chemo.map((o) => { const it = H.M.item(o.code); const std = parseFloat(it.unit.includes('m²') ? it.dose : 0) * bsa; const diff = std ? Math.abs((o.dose - std) / std) * 100 : 0; return `<dt>${esc(it.ing)}</dt><dd class="num">처방 ${o.dose}mg / 계산 ${Math.round(std)}mg ${diff <= 5 ? UI.chip('일치', 'done') : UI.chip(`${diff.toFixed(0)}% 차이 — 의사 확인`, 'stat')}</dd>`; }).join('')}
          <dt>백혈구·혈소판</dt><dd>${wbc ? `${wbc.v} / ${plt ? plt.v : '-'}` : '결과 없음'} ${okLab ? UI.chip('투여 가능 (백혈구 3.0·혈소판 10만 이상)', 'done') : UI.chip('기준 미달 — 투여 보류, 의사 확인', 'stat')}</dd>
          <dt>독소루비신 누적</dt><dd class="num">${cum}mg/m² (평생 한도 450) ${cum > 400 ? UI.chip('한도 가까움', 'stat') : ''}</dd></dl>
        ${checks('c', ['항암 동의서 확인', '구토 예방 약(온단세트론) 30분 전 투여', '임신 가능성 없음 확인', '지난 회차 부작용 (구토·열·입안 염증) 확인'], ch.c || [])}
        <div class="btn-row end">${UI.btn('투여 전 확인 완료', '', { type: 'submit', kind: 'pri' })}</div></div></form>
      <form data-submit="ij.cGive" class="panel"><div class="panel-h"><h3>② 2인 확인·주입</h3></div><div class="panel-b gap-m">
        ${chemo.map((o) => `<div class="row">${UI.chip(o.status === '불출' ? '약 도착' : '약제부 조제 대기', o.status === '불출' ? 'done' : 'prog')}<b>${esc(o.name.split(' (')[0])}</b> <span class="num">${o.dose}mg</span> ${given(o) ? UI.chip('투여함', 'done') : ''}</div>`).join('')}
        ${checks('d', ['간호사 2명이 환자·약·용량·경로·주입 속도·유효기간 함께 확인', '보호구: 항암용 이중 장갑·방수 가운·보안경', `${c.noLeftArm ? '오른팔' : '팔'} 굵은 정맥에 새로 혈관 확보 — 손등·관절 피함`, '생리식염수로 혈액 역류·잘 들어가는지 먼저 확인', '자극성 강한 약(독소루비신)은 수액 옆 관으로 천천히, 2~3mL마다 역류 확인'])}
        <div class="btn-row end">${UI.btn('주입 시작 기록', '', { type: 'submit', kind: 'danger', disabled: !ch.at || !chemo.every((o) => o.status === '불출') })}</div>
        ${!ch.at ? '<p class="small muted" style="margin:0">① 투여 전 확인을 먼저 하세요.</p>' : !chemo.every((o) => o.status === '불출') ? '<p class="small muted" style="margin:0">약제부에서 항암제를 조제·불출해야 합니다 (약제부 → 2인 확인 조제 → 외래 주사실 불출).</p>' : ''}</div></form></div>
      <form data-submit="ij.cWatch" class="panel"><div class="panel-h"><h3>③ 혈관 밖 유출(일혈) 감시 — 5~10분마다</h3></div><div class="panel-b gap-m">
        <div class="q-block"><div class="q">주사 부위</div>${pick('site', ['통증·부종·붉어짐 없음, 역류 잘 됨', '따끔거림·약간 부음', '부음·붉어짐·역류 없음 (일혈 의심)'], '')}</div>
        <div class="btn-row end">${UI.btn('기록', '', { type: 'submit', kind: 'pri' })}</div>
        ${UI.table([{ h: '시각' }, { h: '주사 부위' }], S.where('recs', (r) => r.kind === 'chemowatch' && r.patientId === p.id).map((r) => [`<span class="num">${T.hm(r.at)}</span>`, esc(r.site)]), { empty: '<p class="muted small">기록 없음</p>' })}</div></form>
      <form data-submit="ij.cDone" class="panel"><div class="panel-h"><h3>④ 투여 후 교육·마무리</h3></div><div class="panel-b gap-m">
        ${checks('e', ['열 38℃ 이상이면 바로 응급실 (호중구 감소 — 감염 위험)', '구토 약 집에서 먹는 법', '입안 염증 예방 — 부드러운 칫솔·가글', '탈모는 일시적, 머리 보호', '소변이 붉을 수 있음 (독소루비신 색)', `다음 회차: 3주 뒤 (${c.cycle + 1 <= c.of ? `${c.cycle + 1}/${c.of}회차` : '마지막'})`, '사용한 항암 물품은 전용 폐기통에'])}
        <div class="btn-row end">${UI.btn('항암 회차 완료', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></div></form></div>`;
  }
  // 외래 처치실: 외래에서 낸 처치 처방(기능검사 제외)을 시행
  const opdProcs = () => S.where('orders', (o) => o.encType === 'OPD' && o.cat === 'PROC' && !(H.M.item(o.code) || {}).func && o.status === '전송');
  function iProc() {
    const list = opdProcs(); const done = S.where('orders', (o) => o.encType === 'OPD' && o.cat === 'PROC' && !(H.M.item(o.code) || {}).func && o.status === '시행완료' && o.result && o.result.at >= T.startOfDay());
    return `<div class="gap-m">${UI.note('외래 처치실: 외래 진료에서 낸 처치(상처 소독·도뇨·콧줄·분무 치료·부목 등)를 시행합니다. 환자 확인 → 설명·동의 → 손위생·무균술 → 시행 → 관찰 → 기록 순서입니다. 기록하면 처방이 "시행완료"가 되어 수납·청구로 이어집니다.', 'info')}
      ${list.map((o) => { const p = H.pat(o.patientId); return `<form data-submit="ij.proc" class="box" style="background:var(--surface)"><input type="hidden" name="id" value="${o.id}"><div class="row between"><div><b>${esc(p.name)}</b> <span class="small muted">${H.sexAge(p)} · ${esc(p.mrn)}</span></div><b>${esc(o.name)}</b></div>${o.note ? `<p class="small muted" style="margin:.2rem 0">처방 메모: ${esc(o.note)}</p>` : ''}
        ${checks('c', ['환자 확인 (이름·생년월일 두 가지)', '처치 목적·방법 설명, 동의 받음', '손위생·무균술 (멸균 장갑·소독)', '처치 후 통증·출혈·불편감 관찰'])}
        ${UI.input('find', '시행 소견 (상처 상태·배출물·환자 반응)', '')}
        <div class="btn-row end">${UI.btn('시행완료 기록', '', { type: 'submit', kind: 'pri' })}</div></form>`; }).join('') || UI.empty('외래 처치 대기가 없습니다', '외래 진료에서 처치 처방을 내면 여기에 나타납니다.')}
      ${UI.sec('오늘 시행한 처치')}${UI.table([{ h: '시각' }, { h: '환자' }, { h: '처치' }, { h: '소견' }, { h: '시행자' }], done.map((o) => [`<span class="num">${T.hm(o.result.at)}</span>`, esc(H.pat(o.patientId).name), esc(o.name), esc(o.result.findings || '-'), esc(o.result.by)]), { empty: '<p class="muted small">없음</p>' })}</div>`;
  }
  function iLog() {
    const today = S.where('mar', (m) => m.at >= T.startOfDay() && (S.get('orders', m.orderId) || {}).encType === 'OPD');
    return `<div class="gap-m"><div class="grid3"><div class="box"><div class="small muted">오늘 주사</div><div class="score-big">${today.length}건</div></div><div class="box"><div class="small muted">이상반응</div><div class="score-big">${S.where('recs', (r) => r.kind === 'adr' && r.at >= T.startOfDay()).length}건</div></div><div class="box"><div class="small muted">관찰 중</div><div class="score-big">${obsList().length}명</div></div></div>
      ${UI.table([{ h: '시각' }, { h: '환자' }, { h: '약' }, { h: '부위' }, { h: '간호사' }], today.map((m) => { const o = S.get('orders', m.orderId); return [`<span class="num">${T.hm(m.at)}</span>`, esc(H.pat(m.patientId).name), esc(o.name), esc(m.site || ''), `<span class="small">${esc(m.by)}</span>`]; }), { empty: UI.empty('오늘 주사 기록이 없습니다') })}
      <form data-submit="ij.waste" class="panel"><div class="panel-h"><h3>마약·향정 잔량 폐기 (2인)</h3></div><div class="panel-b"><div class="form-grid">${UI.select('drug', '약', ['모르핀 주사', '미다졸람 주사', '펜타닐 주사'], '미다졸람 주사')}${UI.input('amt', '버린 양 (mg)', '', { type: 'number', step: '0.1' })}${UI.input('witness', '함께 확인한 간호사', '')}</div><div class="btn-row end" style="margin-top:.6rem">${UI.btn('폐기 기록', '', { type: 'submit' })}</div></div></form></div>`;
  }

  H.reg({
    id: 'injection', title: '주사실', actor: '주사실 간호사', layout: 'full', channels: () => ['inj', 'opd'],
    render() {
      const tab = ms('tab', 'queue');
      const tabs = [{ id: 'queue', label: '주사 대기·시행', icon: 'drop', cnt: injs().filter((o) => !H.M.item(o.code).chemo && !given(o) && o.status === '불출').length || '' }, { id: 'obs', label: '관찰·이상반응', icon: 'alert', cnt: obsList().length || '' }, { id: 'chemo', label: '항암 주사', icon: 'pill' }, { id: 'log', label: '주사실 일지', icon: 'list' }];
      tabs.splice(1, 0, { id: 'proc', label: '외래 처치실', cnt: opdProcs().length || '' });
      return `<div class="panel">${UI.tabs('ij.tab', tabs, tab)}<div class="panel-b">${({ queue: iQueue, proc: iProc, obs: iObs, chemo: iChemo, log: iLog }[tab] || iQueue)()}</div></div>`;
    },
    acts: {
      'ij.tab': (el) => { set('tab', el.dataset.v); A.render(); },
      'ij.proc': (f, d) => { const c = Array.isArray(d.c) ? d.c : []; if (c.length < 4) return UI.toast('네 가지를 모두 확인하세요', 'warn'); const o = S.get('orders', d.id); F.advance(o, '시행완료', { result: { at: Date.now(), by: H.who(), findings: d.find || '특이 소견 없음' } }); H.addRec('opdproc', o.patientId, { orderId: o.id, name: o.name, find: d.find }); UI.toast('처치 시행완료 — 수납 자료로 넘어갑니다', 'ok'); A.render(); },
      'ij.cp': (el) => { set('cp', el.dataset.v); A.render(); },
      'ij.give': (el) => {
        const o = S.get('orders', el.dataset.id); const p = H.pat(o.patientId); const iv = o.route === 'IV';
        UI.modal({ title: `주사 — ${o.name}`, icon: 'drop', body: `<form data-submit="ij.giveGo" class="gap-m"><input type="hidden" name="id" value="${o.id}">
          <p style="margin:0"><b>${esc(p.name)}</b> ${H.sexAge(p)} · ${esc(H.view.doseText(o))}${o.note ? ` · ${esc(o.note)}` : ''}</p>
          ${(p.allergies || []).length ? UI.note(`알레르기: ${(p.allergies || []).map((a) => esc(a.name)).join(', ')}`, 'danger') : ''}${p.chemo && p.chemo.noLeftArm ? UI.note('왼팔 주사 금지 (림프절 절제)', 'danger') : ''}
          ${checks('c', ['환자 이름·생년월일 두 가지 확인', '맞는 약', '맞는 용량', '맞는 경로', '맞는 시간', '알레르기 다시 묻기'])}
          ${iv ? `<div class="form-grid">${UI.select('site', '주사 부위', ['오른팔 정맥', '왼팔 정맥', '손등 정맥'], '오른팔 정맥')}${UI.input('vol', '수액 총량 (mL)', '100', { type: 'number', ccls: '' })}${UI.input('mins', '주입 시간 (분)', '15', { type: 'number' })}</div>
            <p class="small" style="margin:0">방울 속도 = 총량 × 20방울(일반 수액세트) ÷ 분 → <b id="gtt">${Math.round((100 * 20) / 15)}</b> 방울/분 ${UI.btn('다시 계산', 'ij.gtt', { size: 'sm' })}</p>`
            : `${UI.fld('근육주사 부위', pick('site', ['엉덩이 앞쪽 (복측둔부) — 권장', '엉덩이 위바깥 (배측둔부)', '위팔 삼각근 — 2mL 이하만', '허벅지 바깥 (외측광근)'], '엉덩이 앞쪽 (복측둔부) — 권장'))}${UI.check('z', '피부를 옆으로 당겨 놓고 주사 (Z자 주사법) — 약이 새지 않게', false)}`}
          ${UI.fld('주사 후 관찰', pick('min', [{ v: 15, l: '15분' }, { v: 30, l: '30분 (철분·항생제·처음 맞는 약)' }], o.code === 'J0238' ? 30 : 15))}
          <div class="btn-row end">${UI.btn('주사 기록 → 관찰 시작', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` });
      },
      'ij.gtt': (el) => { const f = el.closest('form'); const v = H.num(f.querySelector('[name=vol]').value), m = H.num(f.querySelector('[name=mins]').value); document.getElementById('gtt').textContent = v && m ? Math.round((v * 20) / m) : '-'; },
      'ij.giveGo': (f, d) => {
        if ((d.c || []).length < 6) return UI.toast('투약 확인 6가지를 모두 하세요', 'err');
        const o = S.get('orders', d.id); const p = H.pat(o.patientId);
        if (p.chemo && p.chemo.noLeftArm && /왼팔/.test(d.site || '')) return UI.toast('왼팔은 림프절을 절제한 쪽이라 주사하면 안 됩니다', 'err');
        S.add('mar', { id: H.uid('ma'), orderId: o.id, patientId: o.patientId, slot: Date.now(), status: '투약', at: Date.now(), by: H.who(), checks: d.c, site: d.site }, true);
        H.addRec('injobs', o.patientId, { orderId: o.id, drug: o.name, min: Number(d.min) || 15 });
        H.log('외래 주사', `${p.name} ${o.name}`, p.id); UI.close(); UI.toast(`주사 완료 — ${d.min}분 관찰`, 'ok'); set('tab', 'obs'); A.render();
      },
      'ij.ok': (el) => { const r = S.get('recs', el.dataset.id); if (r.at + r.min * MIN > Date.now()) { UI.confirm({ title: '관찰 시간 전', text: `아직 ${Math.ceil((r.at + r.min * MIN - Date.now()) / MIN)}분 남았습니다. 그래도 귀가시킬까요? (실습용)`, ok: '귀가' }).then((ok) => { if (ok) { r.done = Date.now(); S.save(); A.render(); } }); return; } r.done = Date.now(); S.save(); UI.toast('이상 없음 — 귀가 안내', 'ok'); A.render(); },
      'ij.adr': (el) => {
        const r = S.get('recs', el.dataset.id);
        UI.modal({ title: '약물 이상반응', icon: 'alert', body: `<form data-submit="ij.adrGo" class="gap-m"><input type="hidden" name="id" value="${r.id}">
          <div class="fld"><span class="lbl">증상</span>${checks('sym', ['두드러기·가려움', '얼굴·입술 부음', '숨참·쌕쌕거림', '혈압 떨어짐·어지러움', '구토·배 아픔', '주사 부위 통증·부종'])}</div>
          ${UI.note('<b>아나필락시스 의심 (숨참 또는 혈압 저하) 응급 처치</b>: ① 주사 즉시 중단 ② 도움 요청·의사 호출 ③ 에피네프린 0.3~0.5mg 허벅지 바깥쪽 근육주사 (5~15분 뒤 반복 가능) ④ 눕히고 다리 올림 ⑤ 산소 ⑥ 생리식염수 빠르게 ⑦ 5분마다 활력징후', 'danger')}
          ${checks('act', ['주사 중단', '의사·응급팀 호출', '에피네프린 근육주사', '눕히고 다리 올림', '산소 투여', '수액 빠르게', '활력징후 5분마다'])}
          <div class="btn-row end">${UI.btn('이상반응 기록·보고', '', { type: 'submit', kind: 'danger', size: 'lg' })}</div></form>` });
      },
      'ij.adrGo': (f, d) => {
        const r = S.get('recs', d.id); const sym = d.sym || []; if (!sym.length) return UI.toast('증상을 고르세요', 'warn');
        const ana = sym.some((x) => /숨참|혈압/.test(x)); const grade = ana ? '아나필락시스 (중증)' : '경증';
        if (ana && !(d.act || []).some((x) => x.includes('에피네프린'))) return UI.toast('아나필락시스에는 에피네프린 근육주사가 가장 먼저입니다', 'err');
        H.addRec('adr', r.patientId, { drug: r.drug, sym, grade, act: d.act || [] }); r.done = Date.now(); r.adr = true;
        const p = H.pat(r.patientId); const o = S.get('orders', r.orderId); const cls = (H.M.item(o.code).cls || '').split(' ')[0];
        if (!p.allergies.some((a) => a.name.includes(H.M.item(o.code).ing))) p.allergies.push({ cls, name: H.M.item(o.code).ing, reaction: `${sym.join(', ')} (${T.d(Date.now())} 주사실)` });
        S.save(); H.notify('doctor', `약물 이상반응: ${p.name} — ${r.drug} → ${sym.join(', ')}`, { patientId: p.id, level: 'stat' }); H.notify('pharmacy', `약물 이상반응 보고: ${p.name} ${r.drug} (의약품안전관리원 보고 대상)`, { patientId: p.id });
        H.log('약물 이상반응', `${p.name} ${r.drug} ${grade}`, p.id); UI.close(); UI.toast(`${grade} 기록 — 의사·약제부 보고, 알레르기 목록에 추가`, 'warn'); A.render();
      },
      'ij.cCheck': (f, d) => { if ((d.c || []).length < 4) return UI.toast('투여 전 확인 4가지를 모두 하세요', 'warn'); const p = H.pat(ms('cp', '') || [...new Set(injs().filter((o) => H.M.item(o.code).chemo).map((o) => o.patientId))][0]); p.chemoCheck = { c: d.c, at: Date.now(), by: H.who() }; S.save(); UI.toast('투여 전 확인 완료', 'ok'); A.render(); },
      'ij.cGive': (f, d) => {
        if ((d.d || []).length < 5) return UI.toast('2인 확인·보호구·혈관 확인을 모두 하세요', 'err');
        const pid = ms('cp', '') || [...new Set(injs().filter((o) => H.M.item(o.code).chemo).map((o) => o.patientId))][0];
        injs().filter((o) => o.patientId === pid && !given(o)).forEach((o) => S.add('mar', { id: H.uid('ma'), orderId: o.id, patientId: pid, slot: Date.now(), status: '투약', at: Date.now(), by: H.who(), checks: d.d, double: true, site: '오른팔 정맥' }, true));
        S.save(); H.log('항암 주입', H.pat(pid).name, pid); UI.toast('항암 주입 시작 — 5~10분마다 주사 부위를 보세요', 'ok'); A.render();
      },
      'ij.cWatch': (f, d) => {
        if (!d.site) return UI.toast('주사 부위 상태를 고르세요', 'warn');
        const pid = ms('cp', '') || [...new Set(injs().filter((o) => H.M.item(o.code).chemo).map((o) => o.patientId))][0];
        H.addRec('chemowatch', pid, { site: d.site });
        if (d.site.includes('일혈')) { H.addRec('extravasation', pid, { drug: '독소루비신' }); H.notify('doctor', `항암제 일혈 의심: ${H.pat(pid).name}`, { patientId: pid, level: 'stat' }); UI.modal({ title: '항암제 혈관 밖 유출 (일혈) 대처', icon: 'alert', body: `${UI.note('① 즉시 주입 중단 ② 바늘은 그대로 두고 남은 약을 주사기로 빨아냄 ③ 바늘 제거, 누르거나 문지르지 않기 ④ 부위 표시·사진 ⑤ 독소루비신: 얼음찜질 15~20분 하루 4번, 팔 올리기, 해독제(덱스라족산) 의사 결정 ⑥ 의사 보고·기록·추적 관찰', 'danger')}`, foot: UI.btn('확인', 'ui.close', { kind: 'pri' }) }); }
        else UI.toast('주사 부위 기록', 'ok');
        A.render();
      },
      'ij.cDone': (f, d) => {
        if ((d.e || []).length < 5) return UI.toast('교육 항목을 확인하세요', 'warn');
        const pid = ms('cp', '') || [...new Set(injs().filter((o) => H.M.item(o.code).chemo).map((o) => o.patientId))][0]; const p = H.pat(pid);
        if (!injs().filter((o) => o.patientId === pid && H.M.item(o.code).chemo).every(given)) return UI.toast('항암제 투여 기록이 먼저 있어야 합니다', 'warn');
        p.chemo.cycle = Math.min(p.chemo.of, p.chemo.cycle + 1); p.chemo.lastAt = Date.now(); delete p.chemoCheck; S.save();
        H.log('항암 회차 완료', p.name, p.id); UI.toast('항암 회차 완료 — 3주 뒤 다음 회차 예약 안내', 'ok'); A.render();
      },
      'ij.waste': (f, d) => { if (!d.witness || !d.amt) return UI.toast('버린 양과 함께 확인한 간호사를 넣어 주세요', 'warn'); H.addRec('waste', null, { drug: d.drug, amt: d.amt, witness: d.witness }); H.log('마약류 잔량 폐기', `${d.drug} ${d.amt}mg (확인: ${d.witness})`); UI.toast('잔량 폐기 기록 — 마약류 관리 대장에 반영', 'ok'); },
    },
  });
})();
