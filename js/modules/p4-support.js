// 4단계 지원 부서: 감염관리, 기능검사실, 종합검진센터, 중앙공급실
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const F = H.flow;
  const DAY = 86400000;
  const pick = (name, opts, v, on) => UI.pick(name, opts.map((o) => (typeof o === 'object' ? o : { v: o, l: o })), v, on ? { on } : {});
  const checks = (name, list, on = []) => `<div class="gap-s">${list.map((t) => UI.check(name, t, on.includes(t), { multi: true, value: t })).join('')}</div>`;
  const tabsOf = (act, list, def) => { const tab = A.ms('tab', def); return { tab, html: UI.tabs(act, list, tab) }; };
  const actives = () => S.where('encounters', (e) => ['입원중', '대기', '진료중'].includes(e.status) && e.type !== 'OPD');
  const patOpts = () => actives().map((e) => { const p = H.pat(e.patientId); return { v: p.id, l: `${p.name} (${e.type === 'ER' ? '응급실' : e.ward})` }; });

  // ───────── 감염관리 ─────────
  const ISO = ['없음', '접촉 격리', '비말 격리', '공기 격리 (음압 병실)', '보호 격리 (면역 저하)'];
  const NOTI = [['결핵', '2급 (24시간 안 신고)'], ['수두', '2급 (24시간 안 신고)'], ['홍역', '1급 (즉시 신고)'], ['카바페넴 내성 장내세균(CRE) 감염증', '2급 (24시간 안 신고)'], ['쯔쯔가무시증', '3급 (24시간 안 신고)'], ['인플루엔자 (표본 감시)', '4급 (7일 안 신고)'], ['코로나바이러스감염증-19', '4급 (7일 안 신고)'], ['중증열성혈소판감소증후군(SFTS)', '3급 (24시간 안 신고)']];
  function mdro() {
    const out = [];
    S.where('orders', (o) => o.cat === 'LAB' && o.result && o.status === '결과보고').forEach((o) => o.result.items.forEach((r) => { if (/MRSA|VRE|CRE|내성/.test(String(r.v))) out.push({ o, r }); }));
    S.where('patients', (p) => p.scenario && p.scenario.labs && /MRSA|VRE|CRE|내성/.test(String(p.scenario.labs.SCx || ''))).forEach((p) => { if (!out.some((x) => x.o.patientId === p.id)) out.push({ o: { patientId: p.id, name: '객담 배양 (예비 결과)' }, r: { v: p.scenario.labs.SCx } }); });
    return out;
  }
  H.reg({
    id: 'infection', title: '감염관리실', actor: '감염관리 간호사', layout: 'full', channels: () => ['ic'],
    render() {
      const { tab, html } = tabsOf('ic.tab', [{ id: 'iso', label: '격리·내성균', icon: 'alert' }, { id: 'report', label: '법정감염병 신고', icon: 'send' }, { id: 'surv', label: '의료관련감염 감시', icon: 'list' }, { id: 'hand', label: '손위생 관찰', icon: 'drop' }, { id: 'needle', label: '직원 노출 (주사침)', icon: 'user' }], 'iso');
      let body;
      if (tab === 'iso') {
        const md = mdro();
        body = `${md.length ? UI.note(`<b>다제내성균 검출 ${md.length}건</b> — 접촉 격리, 1인실 또는 같은 균 환자끼리 같은 방(코호트), 전용 청진기·혈압계, 가운·장갑 착용`, 'danger') : ''}
          ${UI.table([{ h: '환자' }, { h: '검사' }, { h: '균' }, { h: '현재 격리' }], md.map(({ o, r }) => { const p = H.pat(o.patientId); return [`<b>${esc(p.name)}</b>`, esc(o.name), `<b style="color:var(--t-stat)">${esc(r.v)}</b>`, p.flags.isolation ? UI.chip(p.flags.isolation, 'done') : UI.chip('격리 안 됨!', 'stat')]; }), { empty: '<p class="muted small">내성균 검출 없음</p>' })}
          <form data-submit="ic.iso" class="panel"><div class="panel-h"><h3>격리 지정·해제</h3></div><div class="panel-b"><div class="form-grid">${UI.select('pid', '환자', patOpts(), '')}${UI.select('type', '격리 종류', ISO, '접촉 격리')}${UI.input('why', '원인 (균·질병)', 'MRSA')}</div>
            <div class="btn-row end" style="margin-top:.6rem">${UI.btn('저장 → 병동 알림', '', { type: 'submit', kind: 'pri' })}</div></div></form>
          ${UI.sec('지금 격리 중인 환자')}${UI.table([{ h: '환자' }, { h: '위치' }, { h: '격리' }], actives().filter((e) => H.pat(e.patientId).flags.isolation).map((e) => { const p = H.pat(e.patientId); return [esc(p.name), `${esc(e.ward)} ${esc(e.room)}`, UI.chip(p.flags.isolation, 'sent')]; }), { empty: '<p class="muted small">없음</p>' })}`;
      } else if (tab === 'report') body = `<form data-submit="ic.report" class="gap-m">${UI.note('감염병예방법: 1급은 즉시, 2·3급은 24시간 안, 4급은 7일 안에 질병관리청(관할 보건소)에 신고합니다.', 'info')}
          <div class="form-grid">${UI.select('pid', '환자', S.all('patients').map((p) => ({ v: p.id, l: `${p.name} (${p.mrn})` })), '')}${UI.select('dz', '감염병', NOTI.map(([n, g]) => ({ v: n, l: `${n} — ${g}` })), NOTI[0][0])}${UI.input('date', '진단일', T.d(Date.now()), { type: 'date' })}${UI.select('kind', '구분', ['환자', '의사환자 (의심)', '병원체 보유자'], '환자')}</div>
          <div class="btn-row end">${UI.btn('질병관리청 신고 (가상)', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'send' })}</div>
          ${UI.table([{ h: '신고일' }, { h: '환자' }, { h: '감염병' }, { h: '구분' }], S.where('recs', (r) => r.kind === 'icreport').sort((a, b) => b.at - a.at).map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, esc(H.pat(r.patientId).name), esc(r.dz), esc(r.k)]), { empty: '<p class="muted small">신고 기록 없음</p>' })}</form>`;
      else if (tab === 'surv') {
        const icu = S.where('encounters', (e) => e.ward === 'ICU');
        const days = (e) => Math.ceil(((e.endAt || Date.now()) - e.at) / DAY);
        const dev = { 중심정맥관: 0, 유치도뇨관: 0, 인공호흡기: 0 };
        icu.forEach((e) => { const l = H.recs(e.patientId, 'line')[0]; if (l && l.cvc) dev.중심정맥관 += days(e); if (l && l.foley) dev.유치도뇨관 += days(e); if (H.recs(e.patientId, 'vent').length) dev.인공호흡기 += days(e); });
        const ev = S.where('recs', (r) => r.kind === 'hai');
        const cnt = (t) => ev.filter((x) => x.type === t).length;
        const rows = [['중심정맥관 관련 혈류감염', '중심정맥관'], ['유치도뇨관 관련 요로감염', '유치도뇨관'], ['인공호흡기 관련 폐렴', '인공호흡기']].map(([n, d]) => [esc(n), `<span class="num">${dev[d]}일</span>`, `<span class="num">${cnt(n)}건</span>`, `<span class="num">${dev[d] ? ((cnt(n) / dev[d]) * 1000).toFixed(1) : '0.0'}</span>`]);
        body = `${UI.note('의료관련감염 감시: 기구 사용 일수 1,000일당 감염 건수로 비교합니다 (감염률 = 감염 건수 ÷ 기구 사용 일수 × 1,000). 중환자실 기준.', 'info')}
          ${UI.table([{ h: '감시 항목' }, { h: '기구 사용 일수', cls: 'num' }, { h: '감염', cls: 'num' }, { h: '1,000일당 감염률', cls: 'num' }], rows)}
          <form data-submit="ic.hai" class="row box">${UI.select('pid', '환자', patOpts(), '')}${UI.select('type', '감염 종류', ['중심정맥관 관련 혈류감염', '유치도뇨관 관련 요로감염', '인공호흡기 관련 폐렴', '수술 부위 감염'], '중심정맥관 관련 혈류감염')}${UI.btn('감염 사례 등록', '', { type: 'submit', kind: 'warn' })}</form>`;
      } else if (tab === 'hand') {
        const obs = S.where('recs', (r) => r.kind === 'ic' && r.type === '손위생');
        const tot = obs.reduce((s, r) => s + r.done.length, 0), ok = obs.reduce((s, r) => s + r.done.filter(Boolean).length, 0);
        const M = ['환자 접촉 전', '무균 처치 전', '체액 노출 위험 후', '환자 접촉 후', '환자 주변 환경 접촉 후'];
        body = `<div class="row box"><span class="muted">손위생 수행률</span><span class="score-big">${tot ? Math.round((ok / tot) * 100) : 0}%</span><span class="small muted">(${ok}/${tot}회 관찰)</span></div>
          <form data-submit="ic.hand" class="gap-m">${UI.note('세계보건기구 손위생 5가지 순간을 몰래 관찰해서 기록합니다. 장갑을 껴도 손위생은 따로 해야 합니다.', 'info')}
            <div class="form-grid">${UI.select('ward', '병동', ['7A', '8B', 'ICU', 'ER', 'LD', 'NB'], '7A')}${UI.select('job', '관찰 대상 직종', ['간호사', '의사', '간호조무사', '이송 요원', '치료사'], '간호사')}</div>
            ${M.map((m, i) => `<div class="q-block"><div class="q">${i + 1}. ${m}</div>${pick('m' + i, [{ v: 1, l: '손위생 함' }, { v: 0, l: '안 함' }, { v: '', l: '해당 상황 없음' }], '')}</div>`).join('')}
            <div class="btn-row end">${UI.btn('관찰 기록', '', { type: 'submit', kind: 'pri' })}</div></form>`;
      } else body = `<form data-submit="ic.needle" class="gap-m">${UI.note('주사침 자상·혈액 노출 시: ① 즉시 흐르는 물과 비누로 씻기 ② 감염관리실·보건관리자에게 바로 보고 ③ 노출원 환자 혈액검사 (B형·C형간염, HIV) ④ 직원 검사와 필요하면 예방 투약 (HIV는 2시간 안 권장) ⑤ 산재 처리', 'warn')}
          <div class="form-grid">${UI.input('who', '노출된 직원', '')}${UI.select('src', '노출원 환자', [{ v: '', l: '모름' }, ...S.all('patients').map((p) => ({ v: p.id, l: p.name }))], '')}${UI.select('how', '노출 경로', ['사용한 주사바늘에 찔림', '수술 칼에 베임', '혈액이 눈·입에 튐', '상처 난 피부에 혈액 접촉'], '사용한 주사바늘에 찔림')}${UI.input('time', '노출 시각', T.hm(Date.now()))}</div>
          ${checks('c', ['즉시 씻음', '감염관리실 보고', '노출원 환자 검사 의뢰', '직원 기초 혈액검사', '예방 조치 상담', '사고 경위서 작성'])}
          <div class="btn-row end">${UI.btn('노출 보고', '', { type: 'submit', kind: 'danger', size: 'lg' })}</div>
          ${UI.table([{ h: '일시' }, { h: '직원' }, { h: '경로' }, { h: '조치' }], S.where('recs', (r) => r.kind === 'needle').map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, esc(r.who), esc(r.how), `<span class="small">${(r.c || []).length}/6 완료</span>`]), { empty: '<p class="muted small">보고 없음</p>' })}</form>`;
      return `<div class="panel">${html}<div class="panel-b gap-m">${body}</div></div>`;
    },
    acts: {
      'ic.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'ic.iso': (f, d) => { if (!d.pid) return UI.toast('환자를 고르세요', 'warn'); const p = H.pat(d.pid); p.flags.isolation = d.type === '없음' ? '' : `${d.type}${d.why ? ` (${d.why})` : ''}`; S.save(); const e = H.activeEnc(p.id); if (e) H.notify('ward:' + F.wardOf(e), `감염관리실: ${p.name} ${p.flags.isolation || '격리 해제'}`, { patientId: p.id, level: 'stat' }); H.log('격리 지정', `${p.name} ${p.flags.isolation || '해제'}`, p.id); UI.toast(`${p.name} ${p.flags.isolation || '격리 해제'}`, 'ok'); A.render(); },
      'ic.report': (f, d) => { if (!d.pid) return UI.toast('환자를 고르세요', 'warn'); H.addRec('icreport', d.pid, { dz: d.dz, date: d.date, k: d.kind }); H.log('법정감염병 신고', `${H.pat(d.pid).name} ${d.dz}`, d.pid); UI.toast(`${d.dz} 신고 완료 (가상 질병관리청)`, 'ok'); A.render(); },
      'ic.hai': (f, d) => { if (!d.pid) return UI.toast('환자를 고르세요', 'warn'); H.addRec('hai', d.pid, { type: d.type }); UI.toast('감염 사례 등록', 'warn'); A.render(); },
      'ic.hand': (f, d) => { const done = [0, 1, 2, 3, 4].map((i) => d['m' + i]).filter((v) => v !== '').map((v) => v === '1'); if (!done.length) return UI.toast('관찰한 순간을 하나 이상 고르세요', 'warn'); H.addRec('ic', null, { type: '손위생', ward: d.ward, job: d.job, done }); UI.toast('손위생 관찰 기록', 'ok'); A.render(); },
      'ic.needle': (f, d) => { if (!d.who) return UI.toast('직원 이름을 넣어 주세요', 'warn'); H.addRec('needle', d.src || null, { who: d.who, how: d.how, time: d.time, c: d.c || [] }); H.notify('ic', `직원 혈액 노출: ${d.who} — ${d.how}`, { level: 'stat' }); UI.toast('노출 보고 — 바로 검사·상담을 진행하세요', 'warn'); A.render(); },
    },
  });

  // ───────── 기능검사실 ─────────
  function ecg(pattern, hr = 75) {
    const W = 760, Hh = 170, base = 100;
    let g = '';
    for (let x = 0; x <= W; x += 8) g += `<line x1="${x}" y1="0" x2="${x}" y2="${Hh}" stroke="#f6cfcf" stroke-width="${x % 40 === 0 ? 1.2 : 0.5}"/>`;
    for (let y = 0; y <= Hh; y += 8) g += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#f6cfcf" stroke-width="${y % 40 === 0 ? 1.2 : 0.5}"/>`;
    const pts = []; let x = 10; let seed = 3; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const rr = () => pattern === 'af' ? 40 + rnd() * 70 : 60 * 76 / hr;
    pts.push(`0,${base}`);
    while (x < W - 60) {
      const st = pattern === 'ste' ? -18 : 0;
      const af = (n) => { for (let i = 0; i < n; i += 4) pts.push(`${x + i},${base + (pattern === 'af' ? (rnd() * 6 - 3) : 0)}`); x += n; };
      if (pattern !== 'af') { pts.push(`${x},${base}`, `${x + 6},${base - 8}`, `${x + 12},${base}`); x += 18; } else af(18);
      pts.push(`${x},${base}`, `${x + 3},${base + 8}`, `${x + 7},${base - 70}`, `${x + 11},${base + 18}`, `${x + 14},${base + st}`); x += 14;
      pts.push(`${x + 10},${base + st}`, `${x + 20},${base + st - 14}`, `${x + 30},${base}`); x += 30;
      af(Math.max(4, rr() - 62));
    }
    return `<svg viewBox="0 0 ${W} ${Hh}" style="width:100%;background:#fff8f7;border-radius:6px;border:1px solid #e4b4b4" role="img" aria-label="심전도 리듬 그래프">${g}<polyline points="${pts.join(' ')}" fill="none" stroke="#111" stroke-width="1.6"/><text x="8" y="16" font-size="12" fill="#933" font-family="monospace">II 유도 · 25mm/초 · 10mm/mV</text></svg>`;
  }
  const FUNCREAD = {
    ste: ['동성 빈맥, V2~V4 유도 ST 분절 상승 (2~3mm)', '급성 전벽 ST 분절 상승 심근경색 의심 — 즉시 순환기내과 보고, 관상동맥 중재술 고려'],
    af: ['불규칙한 RR 간격, P파 없음, 심실 반응 빠름', '심방세동 (빠른 심실 반응) — 뇌졸중 원인 가능성, 항응고 치료 검토'],
    lvh: ['동성 빈맥, 좌심실 비대 전압 기준 충족, 좌각 차단 없음', '좌심실 비대 소견 — 심부전과 관련'],
    normal: ['정상 동리듬, 심박 75회, 축 정상, ST-T 변화 없음', '정상 심전도'],
  };
  const patOf = (p) => /흉통|가슴/.test((H.activeEnc(p.id) || {}).cc || '') || p.name === '정순자' ? 'ste' : /심방세동/.test(p.hx || '') ? 'af' : (H.activeEnc(p.id) || {}).dx?.some((d) => d.code === 'I50.0') ? 'lvh' : 'normal';
  const funcOrders = () => S.where('orders', (o) => o.cat === 'PROC' && (H.M.item(o.code) || {}).func && !F.isOff(o)).sort((a, b) => b.stat - a.stat || a.at - b.at);
  H.reg({
    id: 'func', title: '기능검사실', actor: '기능검사 담당', layout: 'full', channels: () => ['func'],
    render() {
      const list = funcOrders(); const wait = list.filter((o) => o.status === '전송'); const done = list.filter((o) => o.status === '시행완료').slice(0, 15);
      const sel = A.ms('sel', ''); const cur = wait.find((o) => o.id === sel) || wait[0];
      let work = UI.empty('검사 대기가 없습니다', '심전도·폐기능·심장초음파 등은 처방(처치 탭)에서 냅니다.');
      if (cur) {
        const p = H.pat(cur.patientId); const v = H.lastVs(p.id) || {}; const pat = patOf(p); const it = H.M.item(cur.code);
        work = `<div class="gap-m"><div class="row between"><div><b>${esc(p.name)}</b> <span class="muted small">${H.sexAge(p)} · ${esc(it.name)}</span> ${cur.stat ? UI.chip('응급', 'stat') : ''}</div><span class="small muted">메모: ${esc(cur.note || '-')}</span></div>
          ${cur.code === 'C7001' || cur.code === 'C7011' ? ecg(pat, v.hr || 75) : UI.note(`${esc(it.name)} 시행 — 교육용으로 결과 문장만 기록합니다.`, 'info')}
          <form data-submit="fn.read" class="gap-m"><input type="hidden" name="id" value="${cur.id}">
            ${checks('c', ['환자 확인 (이름·생년월일)', cur.code === 'C7001' ? '전극 위치 확인 (가슴 V1~V6·팔다리)' : '검사 방법 설명·협조 요청', '움직이지 않게 안내'])}
            ${UI.textarea('find', '소견', '', { h: '3rem' })}${UI.textarea('impr', '결론', '', { h: '2.5rem' })}
            <div class="btn-row end">${UI.btn('판독 예시 불러오기', 'fn.fill', { icon: 'refresh', data: { pat: cur.code === 'C7001' || cur.code === 'C7011' ? pat : 'normal' } })}${UI.btn('결과 보고', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form></div>`;
      }
      return `<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)"><div class="panel"><div class="panel-h"><h3>검사 대기 (${wait.length})</h3></div><div class="panel-b gap-s">${wait.map((o) => `<button class="prow ${cur && o.id === cur.id ? 'on' : ''}" style="border:1px solid var(--line);border-radius:6px" data-act="fn.sel" data-id="${o.id}"><span class="loc">${esc((H.M.item(o.code).name).split(' ')[0])}</span><span class="nm">${esc(H.pat(o.patientId).name)}</span><span class="mk">${o.stat ? UI.chip('응급', 'stat') : ''}</span><span class="sub">${esc(o.name)}</span></button>`).join('') || '<p class="muted small">없음</p>'}</div></div>
        <div class="panel"><div class="panel-h"><h3>검사·판독</h3></div><div class="panel-b">${work}</div></div></div>
        <div class="panel"><div class="panel-h"><h3>보고 완료</h3></div><div class="panel-b">${UI.table([{ h: '시각' }, { h: '환자' }, { h: '검사' }, { h: '결론' }], done.map((o) => [`<span class="num small">${T.mdhm(o.result ? o.result.at : o.at)}</span>`, esc(H.pat(o.patientId).name), esc(o.name), esc(o.result ? o.result.impression : '-')]), { empty: '<p class="muted small">없음</p>' })}</div></div>`;
    },
    acts: {
      'fn.sel': (el) => { A.set('sel', el.dataset.id); A.render(); },
      'fn.fill': (el) => { const r = FUNCREAD[el.dataset.pat] || FUNCREAD.normal; const f = el.closest('form'); f.querySelector('[name=find]').value = r[0]; f.querySelector('[name=impr]').value = r[1]; },
      'fn.read': (f, d) => {
        if ((d.c || []).length < 2) return UI.toast('환자 확인을 하세요', 'err'); if (!d.impr) return UI.toast('결론을 써 주세요', 'warn');
        const o = S.get('orders', d.id); const p = H.pat(o.patientId);
        F.advance(o, '시행완료', { result: { at: Date.now(), by: H.who(), findings: d.find, impression: d.impr } });
        const urgent = /ST 분절 상승|심근경색|심방세동/.test(d.impr);
        H.notify('doctor', `기능검사 결과: ${p.name} ${o.name} — ${d.impr}`, { patientId: p.id, level: urgent ? 'stat' : '' });
        if (o.ward) H.notify('ward:' + o.ward, `기능검사 결과: ${p.name} ${o.name}`, { patientId: p.id });
        UI.toast(urgent ? '응급 소견 — 의사에게 바로 알렸습니다' : '결과 보고', urgent ? 'warn' : 'ok'); A.set('sel', ''); A.render();
      },
    },
  });
  H.ecgSvg = ecg;

  // ───────── 종합검진센터 ─────────
  const STATIONS = (pkg, sex) => ['접수·문진표', '신체 계측 (키·몸무게·허리둘레)', '혈압', '채혈·소변', '흉부 X선', '심전도', '시력·청력', ...(pkg.includes('위내시경') ? ['위내시경'] : []), ...(pkg.includes('대장') ? ['대장내시경'] : []), ...(pkg.includes('초음파') ? ['복부 초음파'] : []), ...(sex === 'F' && pkg.includes('자궁') ? ['자궁경부 세포검사'] : []), '결과 상담 예약'];
  function judge(v, sex) {
    const bmi = v.wt / (v.ht / 100) ** 2; const out = [];
    if (bmi >= 25) out.push(['비만', `체질량지수 ${bmi.toFixed(1)} (25 이상)`]);
    if (v.sbp >= 140 || v.dbp >= 90) out.push(['고혈압 의심', `${v.sbp}/${v.dbp}`]); else if (v.sbp >= 120) out.push(['혈압 주의', `${v.sbp}/${v.dbp}`]);
    if (v.glu >= 126) out.push(['당뇨병 의심', `공복혈당 ${v.glu}`]); else if (v.glu >= 100) out.push(['공복혈당장애', `${v.glu}`]);
    if (v.tc >= 240) out.push(['고콜레스테롤혈증 의심', `총콜레스테롤 ${v.tc}`]);
    if (v.ast > 40 || v.alt > 40) out.push(['간기능 이상', `AST ${v.ast} / ALT ${v.alt}`]);
    if (v.hb < (sex === 'F' ? 12 : 13)) out.push(['빈혈 의심', `혈색소 ${v.hb}`]);
    const dz = out.some(([t]) => /의심/.test(t));
    return { list: out, bmi, overall: dz ? '일반 질환 의심 — 정밀검사·진료 필요' : out.length ? '정상 B (경계 — 생활습관 관리)' : '정상 A' };
  }
  H.reg({
    id: 'checkup', title: '종합검진센터', actor: '검진센터 간호사', layout: 'patient', channels: () => ['chk'],
    list() { return { title: '오늘 수검자', rows: S.where('patients', (p) => p.chk).sort((a, b) => a.chk.seq - b.chk.seq).map((p) => ({ pid: p.id, encId: '', loc: `${p.chk.seq}번`, name: p.name, marks: UI.chip(p.chk.status, p.chk.status === '상담 완료' ? 'done' : p.chk.status === '예약' ? 'sent' : 'prog'), sub: `${H.sexAge(p)} · ${esc(p.chk.pkg)}` })) }; },
    render() {
      const p = A.pat(); if (!p || !p.chk) return `<div class="panel"><div class="panel-b">${UI.empty('왼쪽에서 수검자를 고르세요', '건강한 사람이 질병을 일찍 찾기 위해 받는 검진입니다. 동선 안내·결과 판정·상담이 간호사의 일입니다.')}</div></div>`;
      const { tab, html } = tabsOf('ck.tab', [{ id: 'q', label: '접수·문진', icon: 'clip' }, { id: 'route', label: '검사 동선', icon: 'list' }, { id: 'result', label: '결과 판정', icon: 'check' }, { id: 'paper', label: '결과지·상담', icon: 'doc' }], 'q');
      const c = p.chk; const st = STATIONS(c.pkg, p.sex); const done = c.done || [];
      let body;
      if (tab === 'q') body = `<form data-submit="ck.q" class="gap-m">${UI.note(`검진 종류: <b>${esc(c.pkg)}</b>. 내시경이 있으면 전날 저녁 9시 이후 금식, 수면 내시경은 보호자 동행·당일 운전 금지를 확인합니다.`, 'info')}
        <div class="fld"><span class="lbl">진단받은 병</span><div class="row">${['고혈압', '당뇨병', '고지혈증', '간질환', '암', '없음'].map((t) => UI.check('hx', t, (c.q || {}).hx?.includes(t), { multi: true, value: t })).join('')}</div></div>
        <div class="form-grid">${UI.select('smoke', '흡연', ['피운 적 없음', '끊음', '피움'], '피운 적 없음')}${UI.select('drink', '음주', ['안 마심', '주 1~2회', '주 3회 이상'], '주 1~2회')}${UI.select('ex', '운동', ['주 3회 이상', '가끔', '안 함'], '가끔')}${UI.select('fast', '금식 확인', ['8시간 이상 금식함', '금식 안 함 (채혈 미룸)'], '8시간 이상 금식함')}${UI.select('sed', '내시경 방식', ['수면 (보호자 동행 확인)', '비수면', '해당 없음'], c.pkg.includes('내시경') ? '수면 (보호자 동행 확인)' : '해당 없음')}</div>
        <div class="btn-row end">${UI.btn('접수 완료', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
      else if (tab === 'route') body = `<div class="gap-m">${UI.note('수검자가 기다리는 시간이 짧도록 검사 순서(동선)를 안내합니다. 공복이 필요한 채혈·내시경을 먼저 합니다.', 'info')}
        <div style="background:var(--surface-3);border-radius:6px;height:1.2rem"><div style="width:${Math.round((done.length / st.length) * 100)}%;height:100%;background:var(--accent);border-radius:6px"></div></div>
        ${UI.table([{ h: '순서' }, { h: '검사' }, { h: '상태' }, { h: '' }], st.map((s, i) => [`<span class="num">${i + 1}</span>`, esc(s), done.includes(s) ? UI.chip('완료', 'done') : UI.chip('대기', 'plain'), done.includes(s) ? '' : UI.btn('완료', 'ck.done', { size: 'sm', kind: 'pri', data: { s } })]))}</div>`;
      else if (tab === 'result') { const j = judge(c.values, p.sex); body = `<div class="gap-m">${UI.table([{ h: '항목' }, { h: '결과' }], [['키·몸무게', `${c.values.ht}cm · ${c.values.wt}kg (체질량지수 ${j.bmi.toFixed(1)})`], ['혈압', `${c.values.sbp}/${c.values.dbp}`], ['공복혈당', c.values.glu], ['총콜레스테롤', c.values.tc], ['AST / ALT', `${c.values.ast} / ${c.values.alt}`], ['혈색소', c.values.hb]].map(([a, b]) => [esc(a), `<span class="num">${esc(b)}</span>`]))}
        ${UI.sec('판정')}${j.list.map(([t, v]) => UI.chip(`${t} (${v})`, /의심/.test(t) ? 'stat' : 'prog')).join(' ') || UI.chip('이상 없음', 'done')}
        <form data-submit="ck.judge" class="gap-m" style="margin-top:.6rem">${UI.fld(`종합 판정 (추천: ${j.overall})`, pick('overall', ['정상 A', '정상 B (경계 — 생활습관 관리)', '일반 질환 의심 — 정밀검사·진료 필요', '유질환자 (치료 중)'], j.overall))}${UI.textarea('memo', '의사 소견', j.list.length ? j.list.map(([t]) => t).join(', ') + ' — 해당 진료과 외래 진료를 권합니다.' : '특이 소견 없습니다. 1~2년 뒤 정기 검진을 권합니다.', { h: '3rem' })}
          <div class="btn-row end">${UI.btn('판정 저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form></div>`; }
      else body = !c.result ? UI.empty('결과 판정을 먼저 하세요') : `<div class="paper"><h2>건강검진 결과 통보서</h2><table><tr><th>성명</th><td>${esc(p.name)} (${H.sexAge(p)})</td><th>검진일</th><td>${esc(c.date)}</td></tr><tr><th>검진 종류</th><td colspan="3">${esc(c.pkg)}</td></tr><tr><th>종합 판정</th><td colspan="3"><b>${esc(c.result.overall)}</b></td></tr><tr><th>소견</th><td colspan="3" class="pre">${esc(c.result.memo)}</td></tr></table><p style="font-size:.75rem;margin:.6rem 0 0">SSV 병원 검진센터 · 교육용 가상 결과지</p></div>
        <form data-submit="ck.counsel" class="gap-m" style="margin-top:.8rem">${checks('edu', ['결과 설명 (이해했는지 되묻기)', '식사·운동·금연·절주 교육', '해당 진료과 외래 예약 연결', '내시경 조직검사 결과는 1주 뒤 안내'])}
          <div class="form-grid">${UI.select('dept', '연결할 진료과 (필요 시)', ['연결 안 함', '내과', '순환기내과', '외과'], /의심/.test(c.result.overall) ? '내과' : '연결 안 함')}</div>
          <div class="btn-row end">${UI.btn('상담 완료', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
      return `<div class="panel">${html}<div class="panel-b">${body}</div></div>`;
    },
    acts: {
      'ck.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'ck.q': (f, d) => { const p = A.pat(); p.chk.q = d; p.chk.status = '검사 중'; p.chk.done = ['접수·문진표']; S.save(); UI.toast(d.fast.includes('안 함') ? '금식 안 함 — 채혈은 다른 날로 미룹니다' : '접수 완료 — 검사 동선 안내', d.fast.includes('안 함') ? 'warn' : 'ok'); A.set('tab', 'route'); A.render(); },
      'ck.done': (el) => { const p = A.pat(); (p.chk.done = p.chk.done || []).push(el.dataset.s); if (p.chk.status === '예약') p.chk.status = '검사 중'; S.save(); A.render(); },
      'ck.judge': (f, d) => { const p = A.pat(); p.chk.result = { overall: d.overall, memo: d.memo, at: Date.now(), by: H.who() }; p.chk.status = '판정 완료'; S.save(); H.log('검진 판정', `${p.name} ${d.overall}`, p.id); UI.toast('판정 저장', 'ok'); A.set('tab', 'paper'); A.render(); },
      'ck.counsel': (f, d) => {
        const p = A.pat(); p.chk.status = '상담 완료'; p.chk.counsel = { edu: d.edu || [], dept: d.dept, at: Date.now() };
        if (d.dept !== '연결 안 함') { const doc = H.M.DOCTORS.find((x) => x.dept === d.dept) || H.M.DOCTORS[0]; S.add('appts', { id: H.uid('ap'), pid: p.id, dept: d.dept, doctorId: doc.id, date: T.d(Date.now() + 7 * DAY), time: '10:00', status: '예약', memo: '검진 이상 소견 진료', at: Date.now(), by: H.who() }, true); }
        S.save(); UI.toast(d.dept !== '연결 안 함' ? `상담 완료 — ${d.dept} 외래 예약 (1주 뒤)` : '상담 완료', 'ok'); A.render();
      },
    },
  });

  // ───────── 중앙공급실 ─────────
  const SFLOW = ['사용 후 회수', '세척', '포장', '멸균 중', '멸균 완료', '불출'];
  const sets = () => S.where('items', (i) => i.kind === 'set');
  H.reg({
    id: 'csr', title: '중앙공급실', actor: '중앙공급실 간호사', layout: 'full', channels: () => ['csr'],
    render() {
      const { tab, html } = tabsOf('cs.tab', [{ id: 'flow', label: '기구 세트 흐름', icon: 'refresh' }, { id: 'load', label: '멸균·표시기 판독', icon: 'check' }, { id: 'out', label: '불출', icon: 'send' }], 'flow');
      let body;
      if (tab === 'flow') body = `${UI.note('재사용 기구 순서: 사용 후 회수 → 세척 (효소 세제·초음파) → 점검·포장 (화학적 표시기 넣기) → 멸균 → 표시기 판독 → 보관 (유효기간) → 불출', 'info')}
        <div class="row">${SFLOW.map((s, i) => `${i ? '<span class="muted">→</span>' : ''}${UI.chip(`${s} ${sets().filter((x) => x.status === s).length}`, 'plain')}`).join(' ')}</div>
        ${UI.table([{ h: '세트' }, { h: '번호' }, { h: '상태' }, { h: '위치' }, { h: '유효기간' }, { h: '' }], sets().map((x) => { const exp = x.expire && x.expire < Date.now(); return [esc(x.name), `<span class="mono small">${esc(x.no)}</span>`, UI.chip(x.status, x.status === '멸균 완료' ? 'done' : x.status === '사용 후 회수' ? 'stat' : 'prog'), esc(x.loc), x.expire ? (exp ? UI.chip('지남 — 재멸균', 'stat') : `<span class="num small">${T.d(x.expire)}</span>`) : '-',
          x.status === '사용 후 회수' ? UI.btn('세척', 'cs.wash', { size: 'sm', kind: 'pri', data: { id: x.id } }) : x.status === '세척' ? UI.btn('점검·포장', 'cs.pack', { size: 'sm', kind: 'pri', data: { id: x.id } }) : x.status === '불출' ? UI.btn('사용 후 회수', 'cs.back', { size: 'sm', data: { id: x.id } }) : exp ? UI.btn('재멸균으로', 'cs.back', { size: 'sm', kind: 'warn', data: { id: x.id } }) : '']; }))}`;
      else if (tab === 'load') {
        const packed = sets().filter((x) => x.status === '포장'); const loads = S.where('items', (i) => i.kind === 'load').sort((a, b) => b.at - a.at);
        body = `<form data-submit="cs.load" class="panel"><div class="panel-h"><h3>멸균기에 넣기 (로드)</h3></div><div class="panel-b gap-m">
          ${packed.length ? `<div class="gap-s">${packed.map((x) => UI.check('ids', `${x.name} ${x.no}`, true, { multi: true, value: x.id })).join('')}</div>` : '<p class="muted">포장된 세트가 없습니다</p>'}
          ${UI.fld('멸균 방법', pick('method', ['고압증기 134℃ 4분 (일반 금속 기구)', '고압증기 121℃ 30분', '산화에틸렌(EO) 가스 (열에 약한 기구, 환기 12시간)', '과산화수소 플라즈마 (내시경 부품)'], '고압증기 134℃ 4분 (일반 금속 기구)'))}
          <div class="btn-row end">${UI.btn('멸균 시작', '', { type: 'submit', kind: 'pri', disabled: !packed.length })}</div></div></form>
          ${loads.map((l) => `<form data-submit="cs.read" class="panel"><input type="hidden" name="id" value="${l.id}"><div class="panel-h"><h3>로드 ${esc(l.no)}</h3>${UI.chip(l.result || '판독 대기', l.result === '적합' ? 'done' : l.result ? 'stat' : 'prog')}<span class="grow"></span><span class="small muted">${esc(l.method)} · ${T.hm(l.at)}</span></div><div class="panel-b gap-m">
            <p class="small" style="margin:0">${l.ids.map((id) => { const s = S.get('items', id); return s ? `${esc(s.name)} ${esc(s.no)}` : ''; }).join(' · ')}</p>
            ${l.result ? '' : `<div class="q-block"><div class="q">물리적 표시 — 온도·압력·시간 기록지</div>${pick('phys', ['정상', '이상'], '')}</div><div class="q-block"><div class="q">화학적 표시기 — 색이 변했나</div>${pick('chem', ['색 변함 (통과)', '안 변함 (실패)'], '')}</div><div class="q-block"><div class="q">생물학적 표시기 — 24시간 배양 결과</div>${pick('bio', ['음성 (균 없음, 통과)', '양성 (균 자람, 실패)'], '')}</div>
            <div class="btn-row end">${UI.btn('판독 저장', '', { type: 'submit', kind: 'pri' })}</div>`}</div></form>`).join('')}`;
      } else {
        const ok = sets().filter((x) => x.status === '멸균 완료' && !(x.expire && x.expire < Date.now()));
        const reqs = S.where('items', (i) => i.kind === 'req' && /세트/.test(i.item || ''));
        body = `<form data-submit="cs.out" class="gap-m">${UI.note('불출: 멸균 완료·유효기간 안의 세트만 내보냅니다. 포장이 젖거나 찢어졌으면 오염으로 보고 다시 멸균합니다.', 'info')}
          <div class="form-grid">${UI.select('id', '세트', ok.map((x) => ({ v: x.id, l: `${x.name} ${x.no}` })), '')}${UI.select('to', '보낼 곳', ['수술실 1번방', '수술실 2번방', '수술실 3번방', '7A 병동', '8B 병동', '중환자실', '응급실', '분만실'], '수술실 2번방')}</div>
          ${UI.check('pkg', '포장 상태·표시기·유효기간 확인', false)}<div class="btn-row end">${UI.btn('불출', '', { type: 'submit', kind: 'pri', size: 'lg', disabled: !ok.length })}</div></form>${reqs.length ? '' : ''}`;
      }
      return `<div class="panel">${html}<div class="panel-b gap-m">${body}</div></div>`;
    },
    acts: {
      'cs.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'cs.wash': (el) => UI.modal({ title: '세척', size: 'narrow', body: `<form data-submit="cs.washGo" class="gap-m"><input type="hidden" name="id" value="${el.dataset.id}">${checks('c', ['보호구 착용 (가운·장갑·고글)', '효소 세제에 담가 혈액·조직 불리기', '초음파 세척기', '흐르는 물로 헹굼·건조'])}<div class="btn-row end">${UI.btn('세척 완료', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` }),
      'cs.washGo': (f, d) => { if ((d.c || []).length < 4) return UI.toast('세척 단계를 모두 확인하세요', 'warn'); const s = S.get('items', d.id); s.status = '세척'; s.loc = '중앙공급실'; s.at = Date.now(); S.save(); UI.close(); UI.toast('세척 완료', 'ok'); A.render(); },
      'cs.pack': (el) => UI.modal({ title: '점검·포장', size: 'narrow', body: `<form data-submit="cs.packGo" class="gap-m"><input type="hidden" name="id" value="${el.dataset.id}">${checks('c', ['기구 수·종류 목록과 대조', '녹·파손·날 무뎌짐 점검', '세트 안에 화학적 표시기 넣음', '포장지 2겹 포장', '라벨 (세트명·날짜·담당자)'])}<div class="btn-row end">${UI.btn('포장 완료', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` }),
      'cs.packGo': (f, d) => { if ((d.c || []).length < 5) return UI.toast('포장 단계를 모두 확인하세요', 'warn'); const s = S.get('items', d.id); s.status = '포장'; s.at = Date.now(); S.save(); UI.close(); UI.toast('포장 완료 — 멸균 탭에서 멸균기에 넣으세요', 'ok'); A.render(); },
      'cs.back': (el) => { const s = S.get('items', el.dataset.id); s.status = '사용 후 회수'; s.expire = null; s.loc = '중앙공급실 회수함'; S.save(); A.render(); },
      'cs.load': (f, d) => { const ids = d.ids || []; if (!ids.length) return UI.toast('세트를 고르세요', 'warn'); const no = `L${T.d(Date.now()).replace(/-/g, '').slice(4)}-${String(S.where('items', (i) => i.kind === 'load').length + 1).padStart(2, '0')}`; ids.forEach((id) => { const s = S.get('items', id); s.status = '멸균 중'; s.method = d.method; }); S.add('items', { id: H.uid('it'), kind: 'load', no, ids, method: d.method, at: Date.now(), by: H.who() }); UI.toast(`로드 ${no} 멸균 시작 — 끝나면 표시기를 판독하세요`, 'ok'); A.render(); },
      'cs.read': (f, d) => {
        if (!d.phys || !d.chem || !d.bio) return UI.toast('세 가지 표시기를 모두 판독하세요', 'warn');
        const l = S.get('items', d.id); const ok = d.phys === '정상' && d.chem.includes('통과') && d.bio.includes('통과'); l.result = ok ? '적합' : '부적합 — 리콜'; l.read = { phys: d.phys, chem: d.chem, bio: d.bio, by: H.who(), at: Date.now() };
        l.ids.forEach((id) => { const s = S.get('items', id); if (!s) return; if (ok) { s.status = '멸균 완료'; s.loc = '중앙공급실 보관'; s.expire = Date.now() + 30 * DAY; } else { s.status = '사용 후 회수'; s.loc = '중앙공급실'; s.expire = null; } });
        S.save(); if (!ok) H.notify('ic', `멸균 실패 로드 ${l.no} — 같은 로드 세트 회수(리콜)`, { level: 'stat' });
        UI.toast(ok ? '멸균 적합 — 보관 (유효기간 30일)' : '멸균 실패 — 모두 다시 세척·멸균, 이미 나간 세트는 회수', ok ? 'ok' : 'err'); A.render();
      },
      'cs.out': (f, d) => { if (!d.id) return; if (!d.pkg) return UI.toast('포장 상태를 확인하세요', 'warn'); const s = S.get('items', d.id); s.status = '불출'; s.loc = d.to; s.outAt = Date.now(); S.save(); H.log('멸균 세트 불출', `${s.name} → ${d.to}`); UI.toast(`${s.name} ${s.no} → ${d.to}`, 'ok'); A.render(); },
    },
  });
})();
