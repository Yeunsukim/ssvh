// 심혈관센터 (심혈관조영실): 일정·응급 호출 → 시술 전 준비 → 시술 중 기록 → 시술 후 관찰 → 지표
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

  const cvOrders = () => S.where('orders', (o) => o.cat === 'CV' && !F.isOff(o));
  const cur = () => { const p = A.pat(); if (!p) return null; const l = cvOrders().filter((o) => o.patientId === p.id).sort((a, b) => b.at - a.at); return l.find((o) => o.status !== '시술완료') || l[0] || null; };
  const cvOf = (o) => (o.cv = o.cv || {});
  const doorAt = (o) => { const e = H.enc(o.encId); return e && e.type === 'ER' ? e.at : null; };
  const d2b = (o) => { const d = doorAt(o); const b = o.cv && o.cv.times && o.cv.times.balloon; return d && b ? Math.round((b - d) / MIN) : null; };
  const VESSELS = [['LM', '좌주간지'], ['LAD', '좌전하행지'], ['LCX', '좌회선지'], ['RCA', '우관상동맥']];
  const STEN = [0, 30, 50, 70, 80, 90, 99, 100];

  // 관상동맥 조영 그림 (교육용 모식도)
  function angio(f = {}, stented) {
    const V = { LM: [[200, 70], [182, 83], [165, 95]], LAD: [[165, 95], [152, 150], [140, 240]], LCX: [[165, 95], [230, 120], [285, 170]], RCA: [[215, 55], [285, 95], [320, 150], [300, 230]] };
    const path = (ps) => 'M' + ps.map((q) => q.join(' ')).join(' L');
    let out = '';
    Object.entries(V).forEach(([k, pts]) => {
      const pct = f[k] || 0; const st = stented && stented.includes(k); const mid = Math.floor(pts.length / 2);
      if (pct >= 100 && !st) { out += `<path d="${path(pts.slice(0, mid + 1))}" stroke="#e8e8e8" stroke-width="7" fill="none" stroke-linecap="round"/><path d="${path(pts.slice(mid))}" stroke="#555" stroke-width="2" fill="none" stroke-dasharray="3 5"/>`; return; }
      out += `<path d="${path(pts)}" stroke="#e8e8e8" stroke-width="7" fill="none" stroke-linecap="round"/>`;
      if (pct >= 50 && !st) { const [x, y] = pts[mid]; const r = pct >= 90 ? 5.5 : pct >= 70 ? 4.5 : 3; out += `<circle cx="${x - 3}" cy="${y}" r="${r}" fill="#1a1a1a"/><circle cx="${x + 3}" cy="${y}" r="${r}" fill="#1a1a1a"/>`; }
      if (st) out += `<path d="${path(pts.slice(Math.max(0, mid - 1), mid + 1))}" stroke="#7fd8ff" stroke-width="2.5" fill="none" stroke-dasharray="3 3"/>`;
    });
    return `<svg viewBox="0 0 400 300" style="width:100%;max-width:26rem;background:#080808;border-radius:6px" role="img" aria-label="관상동맥 조영 모식도">
      <ellipse cx="200" cy="170" rx="140" ry="110" fill="#1a1a1a"/>
      <path d="M200 40 L200 70" stroke="#e8e8e8" stroke-width="9"/>${out}
      <text x="128" y="250" fill="#8fe6d8" font-size="12" font-family="monospace">좌전하행지 ${f.LAD || 0}%</text><text x="240" y="190" fill="#8fe6d8" font-size="12" font-family="monospace">좌회선지 ${f.LCX || 0}%</text>
      <text x="290" y="250" fill="#8fe6d8" font-size="12" font-family="monospace">우관상 ${f.RCA || 0}%</text><text x="120" y="88" fill="#8fe6d8" font-size="12" font-family="monospace">좌주간지 ${f.LM || 0}%</text>
      <text x="10" y="18" fill="#8fe6d8" font-size="11" font-family="monospace">SSV 심혈관조영 · 교육용 모식도${stented ? ' · 스텐트 후' : ''}</text></svg>`;
  }

  function list() {
    const all = cvOrders().filter((o) => o.status !== '시술완료' || (o.cv && o.cv.times && o.cv.times.end > Date.now() - 12 * 3600000)).sort((a, b) => b.stat - a.stat || a.at - b.at);
    return { title: '심혈관 시술 환자', rows: all.map((o) => { const p = H.pat(o.patientId); return { pid: p.id, encId: o.encId, loc: o.stat ? '응급' : ((o.cv || {}).time || '미정'), name: p.name, marks: `${o.stat ? UI.chip('응급', 'stat') : ''}${F.chip(o)}`, sub: `${H.sexAge(p)} · ${esc(o.name)}` }; }), empty: '심혈관 시술 처방이 없습니다 (처방 → 심혈관 시술)' };
  }

  function tabSched(o, p, e) {
    const cv = cvOf(o); const door = doorAt(o);
    if (o.stat && door) {
      const el = Math.round((Date.now() - door) / MIN);
      return `<div class="gap-m"><div class="panel" style="border-color:var(--t-stat)"><div class="panel-h" style="background:var(--t-stat-soft)"><h3 style="color:var(--t-stat)">${H.icon('siren')} ST분절 상승 심근경색 — 응급 중재술</h3></div><div class="panel-b gap-m">
        <div class="grid3"><div class="box"><div class="small muted">응급실 도착 (문)</div><div class="score-big">${T.hm(door)}</div></div><div class="box"><div class="small muted">지금까지</div><div class="score-big" style="color:${el > 60 ? 'var(--t-stat)' : 'var(--fg)'}">${el}분</div></div><div class="box"><div class="small muted">목표: 풍선 확장까지</div><div class="score-big">90분</div><div class="small">${door + 90 * MIN > Date.now() ? `남은 시간 ${Math.round((door + 90 * MIN - Date.now()) / MIN)}분` : '목표 시간 지남'}</div></div></div>
        ${UI.note('막힌 심장 혈관을 빨리 열수록 심장 근육이 덜 죽습니다. 응급실 도착부터 풍선 확장까지 90분 안이 목표 (Door-to-balloon). 심혈관팀은 호출 후 30분 안에 도착해야 합니다.', 'danger')}
        ${cv.teamAt ? UI.note(`심혈관팀 호출 ${T.hm(cv.teamAt)} — 시술실 준비 중`, 'ok') : ''}
        <div class="btn-row">${cv.teamAt ? '' : UI.btn('심혈관 응급팀 호출 (시술의·간호사·방사선사)', 'cv.team', { kind: 'danger', size: 'lg', icon: 'siren' })}${o.status === '전송' ? UI.btn('시술 확정 → 시술실로', 'cv.confirmStat', { kind: 'pri', size: 'lg', disabled: !cv.teamAt }) : UI.chip(o.status, 'prog')}</div></div></div></div>`;
    }
    if (o.status !== '전송') return `${UI.note('시술 일정이 확정되었습니다.', 'ok')}<dl class="kv" style="margin-top:.6rem"><dt>날짜·시각</dt><dd>${esc(cv.date || '')} ${esc(cv.time || '')}</dd><dt>시술실</dt><dd>${esc(cv.room || '')}</dd><dt>시술의</dt><dd>${esc(cv.doctor || '')}</dd><dt>접근 부위</dt><dd>${esc(cv.access || '')}</dd></dl>`;
    return `<form data-submit="cv.sched" class="gap-m">${UI.note(`정규 시술 신청 — ${esc(o.note || '')}`, 'info')}
      <div class="form-grid">${UI.fld('날짜', pick('date', [{ v: T.d(Date.now()), l: '오늘' }, { v: T.d(Date.now() + 86400000), l: '내일' }], T.d(Date.now())))}${UI.input('time', '시각', '14:00')}${UI.fld('시술실', pick('room', ['심혈관조영실 1', '심혈관조영실 2'], '심혈관조영실 1'))}${UI.input('doctor', '시술의', H.M.doctor(e.doctorId).name)}
      ${UI.fld('혈관 접근 부위', pick('access', ['오른쪽 요골동맥 (손목)', '오른쪽 대퇴동맥 (사타구니)'], '오른쪽 요골동맥 (손목)'), 'wide')}</div>
      <div class="btn-row end">${UI.btn('시술 확정 → 병동에 준비 알림', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
  }

  function tabPrep(o, p) {
    const cv = cvOf(o); const it = H.M.item(o.code);
    if (o.status === '전송') return UI.empty('시술 일정을 먼저 확정하세요');
    if (cv.prep) return UI.note(`시술 전 준비 완료 — ${esc(cv.prep.by)} ${T.hm(cv.prep.at)} · 접근 부위 ${esc(cv.access || '')}${cv.prep.allen ? ` · 앨런 검사 ${esc(cv.prep.allen)}` : ''}`, 'ok');
    const contrastAllergy = (p.allergies || []).some((a) => a.cls === 'contrast');
    const cr = F.lastLab(p.id, 'Cr'); const radial = (cv.access || '오른쪽 요골동맥').includes('요골');
    return `<form data-submit="cv.prep" class="gap-m">
      ${contrastAllergy ? UI.note('<b>조영제 알레르기 환자</b> — 시술 전 스테로이드·항히스타민 전처치를 의사에게 확인하고, 시술실에 응급 약물(에피네프린)을 준비합니다.', 'danger') : ''}
      <div class="row box"><span><b>최근 크레아티닌</b> ${cr ? `${cr.v} ${cr.v > 1.5 ? UI.chip('신기능 저하 — 조영제 신병증 주의, 수액', 'stat') : UI.chip('정상', 'done')}` : '<span style="color:var(--t-stat)">결과 없음</span>'}</span><span><b>조영제</b> ${it.contrast ? '사용' : '안 씀'}</span><span><b>접근</b> ${esc(cv.access || '-')}</span></div>
      ${checks('c', ['시술·조영제·진정 동의서 확인', o.stat ? '금식 — 응급이라 해당 없음 (구토 대비 흡인기 준비)' : '4~6시간 금식 확인', contrastAllergy ? '조영제 알레르기 전처치 투여 확인' : '조영제 알레르기 없음 확인', '항혈소판제 부하 (아스피린 300mg 씹어 먹기 + 티카그렐러 180mg) 투여 확인', '헤파린 준비 (몸무게당 용량)', '정맥로 확보 (시술 반대쪽 팔)', '시술 부위 제모·소독 준비', '틀니·장신구 제거, 소변 보기', '12유도 심전도·활력징후 측정'])}
      ${radial ? `<div class="q-block"><div class="q">앨런 검사 (손목 요골동맥으로 할 때) — 요골·척골 동맥을 함께 누르고 주먹을 쥐었다 편 뒤 척골 쪽만 풀었을 때</div>${pick('allen', ['정상 — 손바닥 색이 10초 안에 돌아옴', '비정상 — 색이 늦게 돌아옴 (대퇴동맥으로 바꿈)'], '')}</div>` : `<div class="q-block"><div class="q">양쪽 발등·뒤정강 동맥 맥박 확인 후 피부에 표시 (시술 뒤 비교용)</div>${pick('allen', ['양쪽 잘 만져짐 — 표시함', '약하게 만져짐 — 표시함'], '')}</div>`}
      <div class="btn-row end">${UI.btn('시술 전 준비 완료', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
  }

  function tabIntra(o, p) {
    const cv = cvOf(o);
    if (!['시술전준비', '시술중'].includes(o.status)) return o.status === '시술후관찰' || o.status === '시술완료' ? UI.note('시술이 끝났습니다. 시술 후 관찰 탭으로 가세요.', 'ok') : UI.empty('시술 전 준비를 먼저 하세요');
    if (o.status === '시술전준비') return `<form data-submit="cv.start" class="gap-m">${UI.sec('타임아웃 — 시술팀이 함께 소리 내어 확인')}
      ${checks('c', ['환자 이름·생년월일 확인', '시술명·접근 부위 확인', '알레르기 (특히 조영제) 확인', '항응고제·항혈소판제 투여 상태 확인', '제세동기·응급 약물 준비', '방사선 보호구 착용 (납 가운·갑상선 보호대)'])}
      <div class="btn-row end">${UI.btn('타임아웃 완료 → 천자 시작', '', { type: 'submit', kind: 'danger', size: 'lg' })}</div></form>`;
    const t = cv.times || {}; const f = cv.find || {}; const ev = cv.events || [];
    const ACT = cv.act || []; const lastAct = ACT[ACT.length - 1];
    return `<div class="gap-m">
      <div class="row">${UI.chip(`천자 ${T.hm(t.puncture)}`, 'plain')}${t.balloon ? UI.chip(`풍선 확장 ${T.hm(t.balloon)}`, 'done') : ''}${d2b(o) != null ? UI.chip(`문에서 풍선까지 ${d2b(o)}분 ${d2b(o) <= 90 ? '— 목표 달성' : '— 목표 초과'}`, d2b(o) <= 90 ? 'done' : 'stat') : ''}</div>
      <div class="grid2"><div class="gap-m">${angio(f, cv.stented)}
        <div class="code-btns">${['조영제 첫 주입', '막힌 혈관 확인', '유도철선 통과', '풍선 확장 (재관류)', '스텐트 삽입', '최종 조영 — 혈류 회복 확인'].map((x) => UI.btn(x, 'cv.ev', { kind: x.includes('풍선') ? 'danger' : x.includes('스텐트') ? 'warn' : '', data: { t: x } })).join('')}</div>
        <div class="timeline">${ev.slice().reverse().map((x) => `<div class="ti"><span class="t">${T.hm(x.t)}</span> ${esc(x.text)}</div>`).join('')}</div></div>
      <div class="gap-m">
        <form data-submit="cv.find" class="panel"><div class="panel-h"><h3>조영 소견 (협착 %)</h3></div><div class="panel-b gap-m">
          <div class="form-grid">${VESSELS.map(([k, l]) => UI.select(k, l, STEN.map((v) => ({ v, l: `${v}%${v === 100 ? ' (완전 막힘)' : ''}` })), f[k] ?? 0)).join('')}</div>
          ${UI.input('stent', '스텐트 (위치·크기)', cv.stent || '', { cls: 'wide' })}
          <div class="form-grid">${UI.input('contrast', '조영제 사용량 (mL)', cv.contrastMl ?? '', { type: 'number' })}${UI.input('fluoro', '투시 시간 (분)', cv.fluoro ?? '', { type: 'number' })}${UI.input('heparin', '헤파린 총량 (단위)', cv.heparin ?? '', { type: 'number' })}${UI.select('comp', '합병증', ['없음', '서맥', '저혈압', '조영제 반응', '심실세동 (제세동함)', '혈관 박리'], cv.comp || '없음')}</div>
          <div class="btn-row end">${UI.btn('판독 불러오기 (사례)', 'cv.fill', { icon: 'refresh' })}${UI.btn('소견 저장', '', { type: 'submit', kind: 'pri' })}</div></div></form>
        <form data-submit="cv.act" class="panel"><div class="panel-h"><h3>활성화 응고 시간 (ACT)·활력징후</h3></div><div class="panel-b gap-m">
          <div class="form-grid">${UI.input('act', 'ACT (목표 250~300초)', '', { type: 'number' })}${UI.input('sbp', '수축기 혈압', '', { type: 'number' })}${UI.input('hr', '맥박', '', { type: 'number' })}${UI.select('rhythm', '심장 리듬', ['정상 동리듬', '동성 빈맥', '서맥', '심실 조기수축', '심실세동'], '정상 동리듬')}</div>
          <div class="btn-row end">${UI.btn('기록', '', { type: 'submit', kind: 'pri' })}</div>
          ${ACT.length ? UI.table([{ h: '시각' }, { h: 'ACT' }, { h: '혈압·맥박' }, { h: '리듬' }], ACT.slice().reverse().map((a) => [`<span class="num">${T.hm(a.t)}</span>`, a.act ? (a.act < 250 ? `<span class="hl-l">${a.act}</span>` : a.act) : '-', `${a.sbp || '-'}/${a.hr || '-'}`, esc(a.rhythm)])) : ''}
          ${lastAct && lastAct.act && lastAct.act < 250 ? UI.note('ACT 250초 미만 — 의사에게 헤파린 추가 여부 확인', 'warn') : ''}</div></form></div></div>
      <div class="btn-row end">${UI.btn('시술 종료 → 지혈·회복으로', 'cv.end', { kind: 'pri', size: 'lg', icon: 'check' })}</div></div>`;
  }

  function tabPost(o, p) {
    const cv = cvOf(o);
    if (!['시술후관찰', '시술완료'].includes(o.status)) return UI.empty('시술이 끝나면 관찰을 기록합니다');
    const radial = (cv.access || '').includes('요골'); const recs = (cv.post && cv.post.recs) || [];
    return `<div class="grid2" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)">
      <form data-submit="cv.post" class="panel"><div class="panel-h"><h3>시술 후 관찰 — ${radial ? '손목 (요골동맥)' : '사타구니 (대퇴동맥)'}</h3></div><div class="panel-b gap-m">
        ${UI.note(radial ? '압박 밴드: 2시간 뒤부터 15분마다 공기 2~3mL씩 빼며 출혈 확인, 4~6시간 뒤 제거. 손 저림·차가움·색 변화를 봅니다.' : '대퇴: 다리를 펴고 4~6시간 침상 안정 (머리 30도 이하), 모래주머니 압박. 15분마다 4번 → 30분마다 4번 → 1시간마다 관찰.', 'info')}
        <div class="q-block"><div class="q">천자 부위</div>${pick('site', ['출혈 없음', '조금 스며 나옴', '혈종 (부풀어 오름)', '활동성 출혈'], '')}</div>
        <div class="q-block"><div class="q">${radial ? '손가락' : '발'} 끝 맥박·색·온도·감각</div>${pick('distal', ['맥박 좋음·따뜻·분홍·감각 정상', '맥박 약함 또는 차가움', '맥박 없음·창백·저림'], '')}</div>
        <div class="form-grid">${UI.input('sbp', '수축기 혈압', '', { type: 'number' })}${UI.input('hr', '맥박', '', { type: 'number' })}${radial ? UI.input('band', '밴드에 남은 공기 (mL)', '', { type: 'number' }) : ''}${UI.select('chest', '가슴 통증', ['없음', '있음 — 심전도 바로 찍음'], '없음')}</div>
        <div class="btn-row end">${UI.btn('관찰 기록', '', { type: 'submit', kind: 'pri' })}</div>
        ${UI.table([{ h: '시각' }, { h: '천자 부위' }, { h: '말단' }, { h: '혈압·맥박' }], recs.slice().reverse().map((r) => [`<span class="num">${T.hm(r.t)}</span>`, r.site.includes('혈종') || r.site.includes('활동성') ? `<b style="color:var(--t-stat)">${esc(r.site)}</b>` : esc(r.site), esc(r.distal), `${r.sbp || '-'}/${r.hr || '-'}`]), { empty: '<p class="muted small">기록 없음</p>' })}</div></form>
      <form data-submit="cv.done" class="panel"><div class="panel-h"><h3>교육·인계</h3></div><div class="panel-b gap-m">
        ${o.status === '시술완료' ? UI.note('시술 완료 — 병동(또는 중환자실)에 인계했습니다.', 'ok') : `${checks('edu', ['이중 항혈소판제(아스피린+티카그렐러)를 마음대로 끊지 않기 — 스텐트가 막힐 수 있음', '시술한 팔·다리로 1주간 무거운 것 들지 않기', '천자 부위 출혈·부종·통증 생기면 바로 알리기', '조영제 배출을 위해 물 충분히 (신기능 정상일 때)', '가슴 통증 다시 생기면 즉시 119·응급실', '금연·저염식·약 복용·심장 재활 안내'])}
          ${UI.fld('보낼 곳', pick('dest', [{ v: 'ward', l: '원래 병동' }, { v: 'ICU', l: '중환자실 (심근경색 집중 관찰)' }], o.stat ? 'ICU' : 'ward'))}
          <div class="btn-row end">${UI.btn('시술 완료 → 인계', '', { type: 'submit', kind: 'pri', size: 'lg', disabled: recs.length < 1 })}</div>${recs.length < 1 ? '<p class="small muted" style="margin:0">관찰 기록이 1번 이상 있어야 합니다.</p>' : ''}`}</div></form></div>`;
  }

  function tabStat() {
    const list = cvOrders().filter((o) => o.cv && o.cv.times && o.cv.times.end).sort((a, b) => b.at - a.at);
    const d2bs = list.map(d2b).filter((x) => x != null);
    return `<div class="gap-m"><div class="grid3"><div class="box"><div class="small muted">완료 시술</div><div class="score-big">${list.length}건</div></div><div class="box"><div class="small muted">문에서 풍선까지 평균</div><div class="score-big">${d2bs.length ? Math.round(d2bs.reduce((a, b) => a + b, 0) / d2bs.length) + '분' : '-'}</div></div><div class="box"><div class="small muted">90분 안 달성률</div><div class="score-big">${d2bs.length ? Math.round((d2bs.filter((x) => x <= 90).length / d2bs.length) * 100) + '%' : '-'}</div></div></div>
      ${UI.table([{ h: '날짜' }, { h: '환자' }, { h: '시술' }, { h: '주요 소견' }, { h: '스텐트' }, { h: '문→풍선' }, { h: '합병증' }], list.map((o) => { const f = o.cv.find || {}; const p = H.pat(o.patientId); return [`<span class="num small">${T.md(o.at)}</span>`, esc(p.name), esc(o.name), VESSELS.filter(([k]) => (f[k] || 0) >= 70).map(([k, l]) => `${l} ${f[k]}%`).join(', ') || '의미 있는 협착 없음', esc(o.cv.stent || '-'), d2b(o) != null ? `${d2b(o)}분` : '정규', esc(o.cv.comp || '없음')]; }), { empty: UI.empty('완료된 시술이 없습니다') })}
      ${UI.note('심혈관센터 질 지표: 응급 심근경색의 "문에서 풍선까지 90분 안" 비율은 심평원 급성 심근경색 적정성 평가에 들어갑니다.', 'info')}</div>`;
  }

  H.reg({
    id: 'cath', title: '심혈관센터', actor: '심혈관센터 간호사', layout: 'patient', channels: () => ['cath'],
    list,
    render() {
      const o = cur(); const tab = ms('tab', 'sched');
      const tabs = [{ id: 'sched', label: '일정·응급 호출', icon: 'siren' }, { id: 'prep', label: '시술 전 준비', icon: 'clip' }, { id: 'intra', label: '시술 중 기록', icon: 'heart' }, { id: 'post', label: '시술 후 관찰', icon: 'eye' }, { id: 'stat', label: '기록·지표', icon: 'list' }];
      if (tab === 'stat' || !o) return `<div class="panel">${UI.tabs('cv.tab', tabs, o ? tab : 'stat')}<div class="panel-b">${o ? tabStat() : `${UI.empty('왼쪽에서 시술 환자를 고르세요', '관상동맥 조영술·중재술(스텐트)·심박조율기 시술을 합니다.')}${tabStat()}`}</div></div>`;
      const p = H.pat(o.patientId); const e = H.enc(o.encId);
      const body = { sched: tabSched, prep: tabPrep, intra: tabIntra, post: tabPost }[tab](o, p, e);
      return `<div class="panel"><div class="panel-h"><h3>${esc(o.name)}</h3>${o.stat ? UI.chip('응급', 'stat') : ''}${F.chip(o)}</div>
        <div class="panel-b" style="padding-bottom:0"><div class="row" style="margin-bottom:.6rem">${F.steps(o).map((s, i) => `${i ? '<span class="muted">→</span>' : ''}${UI.chip(s === '전송' ? '신청' : s, o.hist.some((h) => h.s === s) ? 'done' : 'plain')}`).join(' ')}</div></div>
        ${UI.tabs('cv.tab', tabs, tab)}<div class="panel-b">${body}</div></div>`;
    },
    side() { const p = A.pat(); return p && cur() ? H.view.sideVitals(p.id) + H.view.sideCritical(p.id) : ''; },
    onPick() { const o = cur(); if (o) set('tab', { 전송: 'sched', 시술확정: 'prep', 시술전준비: 'intra', 시술중: 'intra', 시술후관찰: 'post', 시술완료: 'post' }[o.status] || 'sched'); },
    acts: {
      'cv.tab': (el) => { set('tab', el.dataset.v); A.render(); },
      'cv.team': () => { const o = cur(); cvOf(o).teamAt = Date.now(); S.save(); H.log('심혈관 응급팀 호출', H.pat(o.patientId).name, o.patientId); UI.toast('심혈관 응급팀 호출 — 30분 안에 도착', 'warn'); A.render(); },
      'cv.confirmStat': () => { const o = cur(); const cv = cvOf(o); Object.assign(cv, { date: T.d(Date.now()), time: T.hm(Date.now()), room: '심혈관조영실 1', doctor: '오세린', access: '오른쪽 요골동맥 (손목)' }); F.advance(o, '시술확정'); H.notify('ward:ER', `응급 중재술: ${H.pat(o.patientId).name} — 시술실로 바로 이동 준비`, { patientId: o.patientId, level: 'stat' }); set('tab', 'prep'); A.render(); },
      'cv.sched': (f, d) => { const o = cur(); Object.assign(cvOf(o), { date: d.date, time: d.time, room: d.room, doctor: d.doctor, access: d.access }); F.advance(o, '시술확정'); if (o.ward) H.notify('ward:' + o.ward, `심혈관 시술 확정: ${H.pat(o.patientId).name} ${d.date} ${d.time} — 금식·정맥로·동의서 준비`, { patientId: o.patientId }); UI.toast('시술 확정 — 병동에 알렸습니다', 'ok'); set('tab', 'prep'); A.render(); },
      'cv.prep': (f, d) => {
        const o = cur(); const cv = cvOf(o);
        if ((d.c || []).length < 7) return UI.toast('시술 전 확인 항목을 확인하세요 (7개 이상)', 'warn'); if (!d.allen) return UI.toast('앨런 검사(또는 말단 맥박)를 기록하세요', 'warn');
        if (d.allen.startsWith('비정상')) cv.access = '오른쪽 대퇴동맥 (사타구니)';
        cv.prep = { checks: d.c, allen: d.allen, by: H.who(), at: Date.now() }; F.advance(o, '시술전준비');
        UI.toast(d.allen.startsWith('비정상') ? '앨런 검사 비정상 — 대퇴동맥으로 바꿨습니다' : '시술 전 준비 완료', d.allen.startsWith('비정상') ? 'warn' : 'ok'); set('tab', 'intra'); A.render();
      },
      'cv.start': (f, d) => { if ((d.c || []).length < 6) return UI.toast('타임아웃 항목을 모두 함께 확인하세요', 'err'); const o = cur(); const cv = cvOf(o); cv.timeout = { at: Date.now(), by: H.who() }; cv.times = { puncture: Date.now() }; cv.events = [{ t: Date.now(), text: '천자 — 동맥 유도관 삽입' }]; F.advance(o, '시술중'); A.render(); },
      'cv.ev': (el) => { const o = cur(); const cv = cvOf(o); const t = el.dataset.t; cv.events.push({ t: Date.now(), text: t }); if (t.includes('풍선') && !cv.times.balloon) { cv.times.balloon = Date.now(); const v = d2b(o); if (v != null) UI.toast(`재관류! 문에서 풍선까지 ${v}분 ${v <= 90 ? '— 목표 달성' : '— 목표 초과, 지연 원인 분석'}`, v <= 90 ? 'ok' : 'warn'); } if (t.includes('스텐트')) { const f = cv.find || {}; cv.stented = Object.keys(f).filter((k) => f[k] >= 70); } S.save(); A.render(); },
      'cv.fill': (el) => { const p = A.pat(); const sc = (p.scenario && p.scenario.cag) || { LM: 0, LAD: 30, LCX: 0, RCA: 20 }; const form = el.closest('form'); VESSELS.forEach(([k]) => { form.querySelector(`[name="${k}"]`).value = String(sc[k] || 0); }); form.querySelector('[name=stent]').value = sc.stent || ''; form.querySelector('[name=contrast]').value = 120; form.querySelector('[name=fluoro]').value = 14; form.querySelector('[name=heparin]').value = 7000; },
      'cv.find': (f, d) => { const o = cur(); const cv = cvOf(o); cv.find = {}; VESSELS.forEach(([k]) => { cv.find[k] = Number(d[k]) || 0; }); Object.assign(cv, { stent: d.stent, contrastMl: H.num(d.contrast), fluoro: H.num(d.fluoro), heparin: H.num(d.heparin), comp: d.comp }); if (cv.events.some((x) => x.text.includes('스텐트'))) cv.stented = VESSELS.map(([k]) => k).filter((k) => cv.find[k] >= 70); S.save(); UI.toast('조영 소견 저장', 'ok'); A.render(); },
      'cv.act': (f, d) => { const o = cur(); const cv = cvOf(o); (cv.act = cv.act || []).push({ t: Date.now(), act: H.num(d.act), sbp: H.num(d.sbp), hr: H.num(d.hr), rhythm: d.rhythm }); S.save(); if (d.rhythm === '심실세동') UI.toast('심실세동! 즉시 제세동 — 시술 중 사건으로 기록하세요', 'err'); A.render(); },
      'cv.end': () => { const o = cur(); const cv = cvOf(o); if (!cv.find) return UI.toast('조영 소견을 먼저 저장하세요', 'warn'); cv.times.end = Date.now(); cv.events.push({ t: Date.now(), text: '시술 종료 — 유도관 제거, 압박 지혈' }); cv.post = { recs: [] }; F.advance(o, '시술후관찰'); set('tab', 'post'); A.render(); },
      'cv.post': (f, d) => {
        if (!d.site || !d.distal) return UI.toast('천자 부위와 말단 상태를 고르세요', 'warn');
        const o = cur(); const cv = cvOf(o); const p = H.pat(o.patientId);
        cv.post.recs.push({ t: Date.now(), site: d.site, distal: d.distal, sbp: H.num(d.sbp), hr: H.num(d.hr), band: H.num(d.band), chest: d.chest, by: H.who() });
        if (d.sbp) S.add('vitals', { id: H.uid('vs'), patientId: p.id, encId: o.encId, at: Date.now(), by: H.who(), sbp: H.num(d.sbp), hr: H.num(d.hr) }, true);
        S.save();
        const bad = d.site.includes('혈종') || d.site.includes('활동성') || d.distal.includes('없음') || d.chest.startsWith('있음');
        if (bad) H.notify('doctor', `시술 후 이상: ${p.name} — ${d.site}, ${d.distal}${d.chest.startsWith('있음') ? ', 가슴 통증' : ''}`, { patientId: p.id, level: 'stat' });
        UI.toast(bad ? '이상 소견 — 천자 부위를 손으로 강하게 누르고 의사에게 알렸습니다' : '관찰 기록', bad ? 'err' : 'ok'); A.render();
      },
      'cv.done': (f, d) => {
        if ((d.edu || []).length < 4) return UI.toast('교육 항목을 확인하세요 (4개 이상)', 'warn');
        const o = cur(); const p = H.pat(o.patientId); const e = H.enc(o.encId); const cv = cvOf(o);
        F.advance(o, '시술완료');
        const fd = cv.find || {}; const sum = VESSELS.filter(([k]) => (fd[k] || 0) >= 70).map(([k, l]) => `${l} ${fd[k]}%`).join(', ') || '의미 있는 협착 없음';
        if (e.type === 'ER') { S.add('admreq', { id: H.uid('ar'), patientId: p.id, fromEnc: e.id, from: '응급실 (심혈관 시술 후)', dept: '순환기내과', doctorId: 'dr2', ward: d.dest === 'ICU' ? 'ICU' : '7A', why: `급성 심근경색 중재술 후 — ${cv.stent || ''}`, status: '대기', at: Date.now() }); H.notify('reg', `입원 수속 필요: ${p.name} (심혈관 시술 후 ${d.dest === 'ICU' ? '중환자실' : '병동'})`, { patientId: p.id, level: 'stat' }); }
        else if (d.dest === 'ICU') H.transfer(e, 'ICU', '내과계');
        S.add('handoffs', { id: H.uid('ho'), patientId: p.id, ward: e.type === 'ER' ? 'ER' : e.ward, at: Date.now(), fromShift: T.shiftOf(), by: `${H.who()} · 심혈관센터`, src: '심혈관센터',
          S: `${p.name} ${o.name} 마침. 소견: ${sum}. ${cv.stent ? '스텐트: ' + cv.stent : ''}`, B: `접근 ${cv.access || ''}, 조영제 ${cv.contrastMl || '-'}mL, 헤파린 ${cv.heparin || '-'}단위.`, A: `천자 부위 ${(cv.post.recs.slice(-1)[0] || {}).site || ''}, 합병증 ${cv.comp || '없음'}.${d2b(o) != null ? ` 문에서 풍선까지 ${d2b(o)}분.` : ''}`,
          R: `${(cv.access || '').includes('요골') ? '압박 밴드 공기 15분마다 2~3mL 빼기, 4~6시간 뒤 제거' : '4~6시간 침상 안정, 다리 펴기'}. 천자 부위·말단 맥박 관찰, 심전도·심근효소 추적, 이중 항혈소판제 투여.`, status: '인계', ackBy: null });
        H.notify('ward:' + (e.type === 'ER' ? 'ER' : e.ward), `심혈관 시술 후 도착: ${p.name} — 인계를 인수하세요`, { patientId: p.id, level: 'stat' });
        H.log('심혈관 시술 완료', `${p.name} ${o.name}`, p.id); UI.toast('시술 완료 — 인계했습니다', 'ok'); set('tab', 'stat'); A.render();
      },
    },
  });
  H.angioSvg = angio;
})();
