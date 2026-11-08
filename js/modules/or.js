// 수술실·회복실: 수술 신청 → 일정 확정 → 입실(마취 전 확인) → 타임아웃 → 수술 중 기록·계수·응급 처방 → 회복실 → 병동 이송
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const F = H.flow;
  const T = H.t;

  const ms = (k, d) => A.ms(k, d);
  const set = (k, v) => A.set(k, v);
  const ops = () => S.where('orders', (o) => o.cat === 'OP' && !F.isOff(o));
  const curOp = () => { const p = A.pat(); if (!p) return null; const list = ops().filter((o) => o.patientId === p.id).sort((a, b) => b.at - a.at); return list.find((o) => o.status !== '병동이송') || list[0] || null; };
  const opOf = (o) => (o.op = o.op || {});
  const ROOMS = ['1번방', '2번방', '3번방', '4번방', '5번방 (응급)', '혈관조영실'];

  const SIGNIN = ['환자 이름·생년월일·등록번호 확인', '수술 부위·좌우 표시 확인', '수술·마취 동의서 확인', '마취기·약품 점검 완료', '산소포화도 측정기 부착·작동', '알레르기 확인', '기도 확보 어려움·흡인 위험 평가', '출혈 500mL 이상 위험 시 혈액 준비 확인'];
  const TIMEOUT = ['수술팀 모두 이름·역할 소개', '환자·수술명·부위·좌우를 소리 내어 다시 확인', '예방적 항생제를 절개 전 60분 안에 투여', '예상되는 중요 상황 공유 (집도의·마취과·간호사)', '필요한 영상 화면에 띄움', '기구 멸균 확인 (멸균 표시기)'];
  const SIGNOUT = ['수술명 기록 확인', '거즈·바늘·기구 개수 일치 확인', '검체 라벨 (환자 이름 포함) 확인', '장비 문제 보고', '회복실에서 주의할 점 공유'];
  const PREOP = ['금식 확인 (수술 전 8시간)', '수술·마취 동의서 서명 확인', '수술 부위 표시 (집도의)', '의치·장신구·콘택트렌즈·매니큐어 제거', '혈액형·교차시험 결과 확인', '수술 전 검사 결과 확인 (혈액·흉부 X선·심전도)', '수술복으로 갈아입고 배뇨함', '정맥 주사로 확보', '수술 전 투약 확인'];
  H.PREOP = PREOP;

  const checks = (name, list, done) => `<div class="gap-s">${list.map((t) => UI.check(name, t, done && done.includes(t), { multi: true, value: t })).join('')}</div>`;
  const stepChip = (o) => F.chip(o);

  function list() {
    const all = ops().filter((o) => o.status !== '병동이송' || (o.op && o.op.times && o.op.times.out > Date.now() - 12 * 3600000)).sort((a, b) => (a.op && a.op.room || 'z').localeCompare(b.op && b.op.room || 'z'));
    return { title: '수술 환자', rows: all.map((o) => { const p = H.pat(o.patientId); return { pid: p.id, encId: o.encId, loc: (o.op && o.op.room) || '미정', name: p.name, marks: stepChip(o), sub: `${H.sexAge(p)} · ${esc(o.name)}` }; }), empty: '수술 신청이 없습니다. 입원 진료 처방에서 "수술"을 처방하세요.' };
  }

  function board() {
    const all = ops().sort((a, b) => b.at - a.at).slice(0, 30);
    return `<div class="panel"><div class="panel-h"><h3>수술 현황판</h3></div><div class="panel-b gap-m">
      ${UI.note('수술 진행: <b>신청(전송)</b> → <b>수술확정</b> (수술실이 일정·방 배정) → 병동 수술 전 준비 → <b>입실</b> (마취 전 확인) → <b>수술중</b> (타임아웃 후 절개) → <b>회복실</b> → <b>병동이송</b>', 'info')}
      ${UI.table([{ h: '수술방' }, { h: '예정' }, { h: '환자' }, { h: '수술' }, { h: '집도의·마취' }, { h: '병동 준비' }, { h: '상태' }, { h: '' }], all.map((o) => { const p = H.pat(o.patientId); const op = o.op || {}; return [
        esc(op.room || '-'), `<span class="num small">${esc(op.date || '-')} ${esc(op.start || '')}</span>`, `<b>${esc(p.name)}</b> <span class="small muted">${H.sexAge(p)}</span>`, esc(o.name),
        `<span class="small">${esc(op.surgeon || '-')} · ${esc(op.anes || H.M.item(o.code).anes)}</span>`, op.preop ? UI.chip('완료', 'done') : o.status === '수술확정' ? UI.chip('대기', 'prog') : '-', stepChip(o),
        UI.btn('열기', 'shell.pick', { size: 'sm', kind: 'pri', data: { pid: p.id, enc: o.encId } })]; }), { empty: UI.empty('수술이 없습니다') })}
    </div></div>`;
  }

  function tabSched(o, p, e) {
    const op = opOf(o); const it = H.M.item(o.code);
    if (o.status !== '전송') return `<div class="gap-m">${UI.note(`수술 일정이 확정되었습니다. 병동은 "수술 전 준비"를 하고, 수술실은 시간에 맞춰 환자를 부릅니다.`, 'ok')}
      <dl class="kv"><dt>수술</dt><dd><b>${esc(o.name)}</b></dd><dt>날짜·시각</dt><dd>${esc(op.date)} ${esc(op.start)}</dd><dt>수술방·순서</dt><dd>${esc(op.room)} · ${esc(op.seq)}번째</dd><dt>집도의</dt><dd>${esc(op.surgeon)}</dd><dt>마취</dt><dd>${esc(op.anesth)} · ${esc(op.anes)}</dd><dt>예상 시간</dt><dd>${it.min}분</dd><dt>병동 수술 전 준비</dt><dd>${op.preop ? `${UI.chip('완료', 'done')} ${esc(op.preop.by)} ${T.hm(op.preop.at)}` : UI.chip('아직 — 병동 간호에서 준비해야 함', 'prog')}</dd></dl></div>`;
    return `<form data-submit="or.sched" class="gap-m">
      ${UI.note(`수술 신청을 받았습니다. 메모: ${esc(o.note || '-')}`, 'info')}
      <div class="form-grid">
        ${UI.fld('수술 날짜', UI.pick('date', [{ v: T.d(Date.now()), l: '오늘' }, { v: T.d(Date.now() + 86400000), l: '내일' }], T.d(Date.now())))}
        ${UI.input('start', '시작 예정 시각', T.hm(Date.now() + 3600000))}
        ${UI.fld('수술방', UI.pick('room', ROOMS, o.code === 'O9007' ? '혈관조영실' : '2번방'))}
        ${UI.select('seq', '그 방에서 몇 번째', ['1', '2', '3', '4'], '1')}
        ${UI.input('surgeon', '집도의', H.M.doctor(e.doctorId).name)}
        ${UI.input('anesth', '마취과 의사', '윤태경')}
        ${UI.fld('마취 방법', UI.pick('anes', ['전신마취', '척추마취', '경막외마취', '국소마취'], op.anes || it.anes))}
        ${UI.select('blood', '혈액 준비', ['필요 없음', '교차시험 후 대기 (2단위)', '혈액형만 확인'], '혈액형만 확인')}
      </div>
      <div class="btn-row end">${UI.btn('수술 확정 → 병동·의사에게 알림', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'check' })}</div></form>`;
  }

  function tabSignin(o, p) {
    const op = opOf(o);
    if (o.status === '전송') return UI.empty('수술 일정을 먼저 확정하세요');
    if (op.signin) return UI.note(`입실·마취 전 확인 완료 — ${esc(op.signin.by)} ${T.hm(op.signin.at)}`, 'ok');
    return `<form data-submit="or.signin" class="gap-m">
      ${op.preop ? UI.note(`병동 수술 전 준비 완료 (${esc(op.preop.by)}): ${op.preop.checks.map(esc).join(', ')}`, 'ok') : UI.note('병동에서 "수술 전 준비"가 아직 안 되었습니다. 원래는 병동에 연락해 준비를 마친 뒤 입실시킵니다.', 'danger')}
      ${(p.allergies || []).length ? UI.note(`알레르기: ${(p.allergies || []).map((a) => esc(a.name)).join(', ')}`, 'danger') : ''}
      ${UI.sec('세계보건기구(WHO) 수술 안전 점검표 ① 마취 전 (Sign in)')}
      ${checks('c', SIGNIN)}
      ${UI.input('inTime', '수술실 입실 시각', T.hm(Date.now()))}
      <div class="btn-row end">${UI.btn('입실 확인', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'check' })}</div></form>`;
  }

  function counts(op) {
    const c = op.counts || {};
    const row = (k, l) => { const x = c[k] || {}; const ok = x.end !== undefined && x.end !== '' && Number(x.start || 0) + Number(x.add || 0) === Number(x.end); return `<tr><td>${l}</td><td><input name="${k}_start" value="${esc(x.start ?? '')}" type="number" style="width:5rem"></td><td><input name="${k}_add" value="${esc(x.add ?? '')}" type="number" style="width:5rem"></td><td><input name="${k}_end" value="${esc(x.end ?? '')}" type="number" style="width:5rem"></td><td>${x.end === undefined || x.end === '' ? '<span class="muted small">종료 전</span>' : ok ? UI.chip('일치', 'done') : UI.chip('불일치!', 'stat')}</td></tr>`; };
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>품목</th><th>시작 개수</th><th>추가</th><th>종료 개수</th><th>확인</th></tr></thead><tbody>${row('gauze', '거즈')}${row('needle', '바늘')}${row('inst', '기구')}</tbody></table></div>`;
  }
  function tabIntra(o, p, e) {
    const op = opOf(o);
    if (!['입실', '수술중'].includes(o.status)) return o.status === '전송' || o.status === '수술확정' ? UI.empty('입실 확인을 먼저 하세요') : UI.note('수술이 끝났습니다. 회복실 탭으로 가세요.', 'ok');
    const t = op.times || {};
    const emerg = S.where('orders', (x) => x.encId === o.encId && x.orFlag).sort((a, b) => b.at - a.at);
    if (o.status === '입실') return `<form data-submit="or.timeout" class="gap-m">
      ${UI.sec('② 절개 전 타임아웃 (Time out) — 수술팀 모두 하던 일을 멈추고 함께 확인')}
      ${checks('c', TIMEOUT)}
      <div class="form-grid">${UI.input('anes', '마취 시작 시각', T.hm(Date.now()))}${UI.fld('수술 체위', UI.pick('position', ['바로 누운 자세', '옆으로 누운 자세', '엎드린 자세', '쇄석위 (다리 올림)'], '바로 누운 자세'))}
        ${UI.select('pad', '전기소작기 패드 부착 부위', ['오른쪽 허벅지', '왼쪽 허벅지', '엉덩이'], '오른쪽 허벅지')}${UI.select('prep', '피부 소독', ['클로르헥시딘 알코올', '포비돈 아이오딘'], '클로르헥시딘 알코올')}</div>
      <div class="btn-row end">${UI.btn('타임아웃 완료 → 절개 시작', '', { type: 'submit', kind: 'danger', size: 'lg', icon: 'check' })}</div></form>`;
    const rec = op.anesRec || [];
    return `<div class="gap-m">
      <div class="row">${UI.chip(`마취 시작 ${t.anes || '-'}`, 'plain')}${UI.chip(`절개 ${t.incision ? T.hm(t.incision) : '-'}`, 'stat')}${UI.chip(`체위 ${op.position || '-'}`, 'plain')}${UI.chip(`소작기 패드 ${op.pad || '-'}`, 'plain')}</div>
      <div class="grid2">
        <div class="panel"><div class="panel-h"><h3>마취 기록 (5분마다)</h3></div><div class="panel-b gap-m">
          <form data-submit="or.anes" class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(7rem,1fr))">${UI.input('sbp', '수축기', '', { type: 'number' })}${UI.input('dbp', '이완기', '', { type: 'number' })}${UI.input('hr', '맥박', '', { type: 'number' })}${UI.input('spo2', '산소포화도', '', { type: 'number' })}${UI.input('etco2', '호기말 CO₂', '', { type: 'number' })}
            ${UI.select('drug', '투여 약 (선택)', ['', '프로포폴 100mg (마취 유도)', '로쿠로늄 50mg (근이완)', '펜타닐 100mcg', '세보플루란 2% (흡입 마취)', '세파졸린 2g (예방적 항생제)', '에페드린 10mg (저혈압)', '온단세트론 4mg (구토 예방)'], '', { cls: 'wide' })}
            <div class="btn-row wide">${UI.btn('측정값 불러오기', 'or.anesFill', { size: 'sm', icon: 'refresh' })}${UI.btn('기록', '', { type: 'submit', kind: 'pri', size: 'sm' })}</div></form>
          ${UI.table([{ h: '시각' }, { h: '혈압' }, { h: '맥박' }, { h: '산소' }, { h: 'CO₂' }, { h: '약' }], rec.slice().reverse().map((r) => [`<span class="num">${T.hm(r.t)}</span>`, `${r.sbp}/${r.dbp}`, r.hr, r.spo2, r.etco2, `<span class="small">${esc(r.drug || '')}</span>`]), { empty: '<p class="muted small">기록 없음</p>', maxH: '16rem' })}
        </div></div>
        <div class="panel"><div class="panel-h"><h3>수술 간호 기록 · 계수</h3></div><div class="panel-b"><form data-submit="or.count" class="gap-m">
          ${UI.note('거즈·바늘·기구는 시작할 때, 체강을 닫기 전, 피부 봉합 전에 소독 간호사와 순환 간호사가 함께 소리 내어 셉니다. 개수가 다르면 찾을 때까지 닫지 않고, 못 찾으면 X선 촬영을 합니다.', 'info')}
          ${counts(op)}
          <div class="form-grid">${UI.input('ebl', '출혈량 (mL)', op.ebl ?? '', { type: 'number' })}${UI.input('urine', '소변량 (mL)', op.urine ?? '', { type: 'number' })}${UI.input('fluid', '수액 (mL)', op.fluid ?? '', { type: 'number' })}</div>
          <div class="btn-row end">${UI.btn('저장', '', { type: 'submit', kind: 'pri' })}</div></form></div></div>
      </div>
      <div class="panel" style="border-color:var(--t-stat)"><div class="panel-h" style="background:var(--t-stat-soft)"><h3>수술 중 응급 처방·결과</h3><span class="grow"></span>${UI.btn('동결절편 의뢰 (병리과)', 'or.frozen', { size: 'sm', kind: 'warn', icon: 'micro' })}${UI.btn('수혈 요청 (혈액은행)', 'or.blood', { size: 'sm', kind: 'danger', icon: 'drop' })}${UI.btn('결과 새로 보기', 'or.refresh', { size: 'sm', icon: 'refresh' })}</div><div class="panel-b">
        ${UI.note('수술 중 응급 처방은 병리과(동결절편: 20~30분 안에 결과)와 혈액은행으로 바로 전달됩니다. 직군을 바꿔 그 부서 일을 처리하면 결과가 이곳으로 돌아옵니다.', 'info')}
        <div style="margin-top:.6rem">${UI.table([{ h: '시각' }, { h: '처방' }, { h: '상태' }, { h: '결과' }], emerg.map((x) => [`<span class="num small">${T.hm(x.at)}</span>`, `<b>${esc(x.name)}</b>`, F.chip(x), x.result ? `<b>${esc(x.result.dx || '')}</b>` : x.bagNo ? `혈액번호 ${esc(x.bagNo)}` : '<span class="muted">기다리는 중</span>']), { empty: '<p class="muted small">응급 처방 없음</p>' })}</div></div></div>
      <form data-submit="or.signout" class="panel"><div class="panel-h"><h3>③ 수술실 퇴실 전 확인 (Sign out)</h3></div><div class="panel-b gap-m">${checks('c', SIGNOUT)}
        ${UI.input('close', '봉합 끝난 시각', T.hm(Date.now()))}
        <div class="btn-row end">${UI.btn('수술 종료 → 회복실로', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'send' })}</div></div></form>
    </div>`;
  }

  const ALD = [
    ['act', '활동', [[0, '못 움직임'], [1, '두 팔다리 움직임'], [2, '네 팔다리 움직임']]],
    ['resp', '호흡', [[0, '숨 안 쉼'], [1, '얕은 호흡·호흡곤란'], [2, '깊은 호흡·기침 가능']]],
    ['circ', '순환 (수술 전 혈압 대비)', [[0, '±50% 넘게 차이'], [1, '±20~50%'], [2, '±20% 안']]],
    ['cons', '의식', [[0, '반응 없음'], [1, '부르면 깸'], [2, '완전히 깸']]],
    ['spo2', '산소포화도', [[0, '산소 줘도 90% 미만'], [1, '산소 필요 (90% 이상)'], [2, '실내 공기로 92% 이상']]],
  ];
  function tabPacu(o, p) {
    const op = opOf(o);
    if (o.status !== '회복실') return o.status === '병동이송' ? UI.note(`회복실 퇴실 완료 → ${esc((op.pacu || {}).dest || '병동')} (${(op.times || {}).out ? T.hm(op.times.out) : ''})`, 'ok') : UI.empty('수술이 끝나면 회복실 기록을 씁니다');
    const recs = (op.pacu && op.pacu.recs) || [];
    const last = recs[recs.length - 1];
    return `<div class="grid2" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)">
      <form data-submit="or.pacu" class="panel" id="ald-form"><div class="panel-h"><h3>회복실 관찰 — 알드레테 점수 (15분마다)</h3></div><div class="panel-b gap-m">
        ${ALD.map(([k, q, opts]) => `<div class="q-block"><div class="q">${esc(q)}</div>${UI.pick(k, opts.map(([v, l]) => ({ v, l: `${l} (${v})` })), '', { on: 'or.ald' })}</div>`).join('')}
        <div class="form-grid">${UI.input('sbp', '혈압 (수축기)', '', { type: 'number' })}${UI.input('hr', '맥박', '', { type: 'number' })}${UI.input('pain', '통증 (0~10)', '', { type: 'number' })}${UI.select('nausea', '오심·구토', ['없음', '메스꺼움', '구토'], '없음')}${UI.select('wound', '수술 부위', ['출혈 없음', '드레싱에 약간 묻음', '출혈 많음'], '출혈 없음')}</div>
        <div class="row between box"><div><span class="muted small">알드레테 점수</span> <span class="score-big" id="ald-score">-</span> <span id="ald-msg" class="small"></span></div>${UI.btn('기록', '', { type: 'submit', kind: 'pri' })}</div></div></form>
      <div class="gap-m"><div class="panel"><div class="panel-h"><h3>관찰 기록</h3></div><div class="panel-b">${UI.table([{ h: '시각' }, { h: '점수' }, { h: '혈압·맥박' }, { h: '통증' }], recs.slice().reverse().map((r) => [`<span class="num">${T.hm(r.t)}</span>`, UI.chip(String(r.total), r.total >= 9 ? 'done' : 'prog'), `${r.sbp}/${r.hr}`, r.pain]), { empty: '<p class="muted small">아직 없음</p>' })}</div></div>
        <form data-submit="or.out" class="panel"><div class="panel-h"><h3>회복실 퇴실</h3></div><div class="panel-b gap-m">
          ${UI.note('알드레테 점수 9점 이상이고 통증·구토가 조절되면 퇴실합니다. 병동 간호사에게 SBAR로 인계합니다.', 'info')}
          ${UI.fld('어디로', UI.pick('dest', [{ v: 'ward', l: '원래 병동' }, { v: 'ICU', l: '중환자실' }], 'ward'))}
          <div class="btn-row end">${UI.btn('퇴실 + 병동 인계', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'send', disabled: !last || last.total < 9 })}</div>
          ${!last || last.total < 9 ? '<p class="small muted" style="margin:0">알드레테 9점 이상 기록이 있어야 퇴실할 수 있습니다.</p>' : ''}</div></form></div></div>`;
  }

  function tabNote(o, p, e) {
    const op = opOf(o);
    if (op.note) return `<div class="box" style="background:var(--surface)"><dl class="kv"><dt>수술 전 진단</dt><dd>${esc(op.note.pre)}</dd><dt>수술 후 진단</dt><dd>${esc(op.note.post)}</dd><dt>수술명</dt><dd>${esc(o.name)}</dd><dt>수술 소견</dt><dd class="pre">${esc(op.note.find)}</dd><dt>출혈량</dt><dd>${esc(op.ebl ?? '-')}mL</dd><dt>합병증</dt><dd>${esc(op.note.comp)}</dd><dt>작성</dt><dd>${esc(op.note.by)}</dd></dl></div>`;
    const dx = (e.dx.find((d) => d.main) || e.dx[0] || { name: '' }).name;
    return `<form data-submit="or.note" class="gap-m">${UI.note('수술 기록은 집도의가 씁니다 (의사 역할). 저장하면 진료기록에도 남습니다.', 'info')}
      <div class="form-grid">${UI.input('pre', '수술 전 진단', dx, { cls: 'wide' })}${UI.input('post', '수술 후 진단', dx, { cls: 'wide' })}
      ${UI.textarea('find', '수술 소견·과정', o.code === 'O9001' ? '담낭벽이 붓고 두꺼워져 있으며 주위 유착이 있음. 담낭관과 담낭동맥을 클립으로 묶고 자른 뒤 담낭을 간에서 떼어 냄. 담석 3개 확인. 출혈 조절 확인 후 배액관 없이 마침.' : '', { h: '6rem' })}
      ${UI.select('comp', '합병증', ['없음', '출혈', '장기 손상', '마취 관련'], '없음')}</div>
      <div class="btn-row end">${UI.btn('수술 기록 저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
  }

  H.reg({
    id: 'or', title: '수술실·회복실', actor: '수술실 간호사', layout: 'patient',
    channels: () => ['or'],
    list,
    render() {
      const o = curOp();
      if (!o || ms('board', false)) return board();
      const p = H.pat(o.patientId); const e = H.enc(o.encId);
      const tab = ms('tab', 'sched');
      const tabs = [{ id: 'sched', label: '수술 일정', icon: 'clock' }, { id: 'signin', label: '입실·마취 전 확인', icon: 'clip' }, { id: 'intra', label: '수술 중 기록', icon: 'steth' }, { id: 'pacu', label: '회복실', icon: 'bed' }, { id: 'note', label: '수술 기록', icon: 'doc' }];
      const body = { sched: tabSched, signin: tabSignin, intra: tabIntra, pacu: tabPacu, note: tabNote }[tab](o, p, e);
      return `<div class="panel"><div class="panel-h"><h3>${esc(o.name)}</h3>${F.chip(o)}<span class="grow"></span>${UI.btn('수술 현황판', 'or.board', { size: 'sm', icon: 'list' })}</div>
        <div class="panel-b" style="padding-bottom:0"><div class="row" style="margin-bottom:.6rem">${F.steps(o).map((s, i) => `${i ? '<span class="muted">→</span>' : ''}${UI.chip(s === '전송' ? '신청' : s, o.hist.some((h) => h.s === s) ? 'done' : 'plain')}`).join(' ')}</div></div>
        ${UI.tabs('or.tab', tabs, tab)}<div class="panel-b">${body}</div></div>`;
    },
    side() { const p = A.pat(); return p && curOp() && !ms('board', false) ? H.view.sideVitals(p.id) : ''; },
    onPick() { set('board', false); const o = curOp(); if (o) set('tab', { 전송: 'sched', 수술확정: 'signin', 입실: 'intra', 수술중: 'intra', 회복실: 'pacu', 병동이송: 'note' }[o.status] || 'sched'); },
    acts: {
      'or.tab': (el) => { set('tab', el.dataset.v); A.render(); },
      'or.board': () => { set('board', true); A.render(); },
      'or.refresh': () => A.render(),
      'or.sched': (f, d) => {
        const o = curOp(); const p = H.pat(o.patientId); const op = opOf(o);
        Object.assign(op, { date: d.date, start: d.start, room: d.room, seq: d.seq, surgeon: d.surgeon, anesth: d.anesth, anes: d.anes, blood: d.blood });
        F.advance(o, '수술확정');
        if (o.ward) H.notify('ward:' + o.ward, `수술 확정: ${p.name} ${o.name} — ${d.date === T.d(Date.now()) ? '오늘' : '내일'} ${d.start} ${d.room}. 수술 전 준비를 해 주세요`, { patientId: p.id });
        H.notify('doctor', `수술 확정: ${p.name} ${o.name} ${d.date} ${d.start} ${d.room}`, { patientId: p.id });
        UI.toast('수술 확정 — 병동에 수술 전 준비를 알렸습니다', 'ok'); set('tab', 'signin'); A.render();
      },
      'or.signin': (f, d) => {
        if ((d.c || []).length < SIGNIN.length) return UI.toast('마취 전 확인 항목을 모두 확인해야 합니다', 'err');
        const o = curOp(); const op = opOf(o);
        op.signin = { checks: d.c, by: H.who(), at: Date.now() }; op.times = Object.assign(op.times || {}, { in: Date.now() });
        F.advance(o, '입실'); UI.toast('입실 — 이제 타임아웃을 하세요', 'ok'); set('tab', 'intra'); A.render();
      },
      'or.timeout': (f, d) => {
        if ((d.c || []).length < TIMEOUT.length) return UI.toast('타임아웃은 모든 항목을 함께 확인해야 절개할 수 있습니다', 'err');
        const o = curOp(); const op = opOf(o);
        Object.assign(op, { timeout: { checks: d.c, at: Date.now(), by: H.who() }, position: d.position, pad: d.pad, prep: d.prep });
        op.times = Object.assign(op.times || {}, { anes: d.anes, incision: Date.now() });
        op.counts = op.counts || { gauze: { start: 20 }, needle: { start: 6 }, inst: { start: 42 } };
        F.advance(o, '수술중'); H.log('타임아웃·절개', o.name, o.patientId); UI.toast('절개 시작', 'ok'); A.render();
      },
      'or.anesFill': (el) => { const f = el.closest('form'); const s = (n, v) => { const i = f.querySelector(`[name="${n}"]`); if (i && !i.value) i.value = v; }; s('sbp', 100 + Math.round(Math.random() * 20)); s('dbp', 58 + Math.round(Math.random() * 10)); s('hr', 64 + Math.round(Math.random() * 12)); s('spo2', 99); s('etco2', 34 + Math.round(Math.random() * 4)); },
      'or.anes': (f, d) => { const o = curOp(); const op = opOf(o); (op.anesRec = op.anesRec || []).push({ t: Date.now(), sbp: d.sbp, dbp: d.dbp, hr: d.hr, spo2: d.spo2, etco2: d.etco2, drug: d.drug, by: H.who() }); S.save(); A.render(); },
      'or.count': (f, d) => {
        const o = curOp(); const op = opOf(o);
        op.counts = {}; ['gauze', 'needle', 'inst'].forEach((k) => { op.counts[k] = { start: d[k + '_start'], add: d[k + '_add'], end: d[k + '_end'] }; });
        op.ebl = d.ebl; op.urine = d.urine; op.fluid = d.fluid; S.save(); UI.toast('수술 간호 기록 저장', 'ok'); A.render();
      },
      'or.frozen': () => { const o = curOp(); const e = H.enc(o.encId); const [x] = F.create(e, [{ code: 'P4007', stat: true, note: `수술 중 동결절편 — ${o.op.room} 으로 결과 회신` }]); x.orFlag = true; S.save(); UI.toast('동결절편을 병리과로 보냈습니다', 'ok'); A.render(); },
      'or.blood': () => { const o = curOp(); const e = H.enc(o.encId); const [x] = F.create(e, [{ code: 'B8001', stat: true, note: `수술 중 출혈 — ${o.op.room}` }]); x.orFlag = true; S.save(); UI.toast('혈액은행에 수혈을 요청했습니다', 'ok'); A.render(); },
      'or.signout': (f, d) => {
        const o = curOp(); const op = opOf(o); const c = op.counts || {};
        const bad = ['gauze', 'needle', 'inst'].filter((k) => !c[k] || c[k].end === undefined || c[k].end === '' || Number(c[k].start || 0) + Number(c[k].add || 0) !== Number(c[k].end));
        if (bad.length) return UI.toast('거즈·바늘·기구 종료 개수가 맞아야 퇴실할 수 있습니다 (수술 간호 기록에서 저장)', 'err');
        if ((d.c || []).length < SIGNOUT.length) return UI.toast('퇴실 전 확인 항목을 모두 확인하세요', 'err');
        op.signout = { checks: d.c, at: Date.now(), by: H.who() }; op.times.close = d.close; op.times.pacuIn = Date.now(); op.pacu = { recs: [] };
        F.advance(o, '회복실'); UI.toast('수술 종료 — 회복실로 이동', 'ok'); set('tab', 'pacu'); A.render();
      },
      'or.ald': (el) => {
        const d = H.formData(el.closest('form')); const vals = ALD.map(([k]) => d[k]);
        const s = vals.reduce((a, v) => a + (H.num(v) || 0), 0); const done = vals.every((v) => v !== '');
        document.getElementById('ald-score').textContent = String(s);
        document.getElementById('ald-msg').innerHTML = done ? (s >= 9 ? UI.chip('퇴실 가능', 'done') : UI.chip('계속 관찰', 'prog')) : '모든 문항을 고르세요';
      },
      'or.pacu': (f, d) => {
        const vals = ALD.map(([k]) => d[k]); if (vals.some((v) => v === '')) return UI.toast('알드레테 다섯 문항을 모두 고르세요', 'warn');
        const o = curOp(); const op = opOf(o); const total = vals.reduce((a, v) => a + Number(v), 0);
        op.pacu.recs.push({ t: Date.now(), total, parts: vals, sbp: d.sbp, hr: d.hr, pain: d.pain, nausea: d.nausea, wound: d.wound, by: H.who() });
        if (d.sbp && d.hr) S.add('vitals', { id: H.uid('vs'), patientId: o.patientId, encId: o.encId, at: Date.now(), by: H.who(), sbp: H.num(d.sbp), hr: H.num(d.hr), pain: H.num(d.pain) }, true);
        S.save(); UI.toast(`알드레테 ${total}점 기록`, total >= 9 ? 'ok' : 'warn'); A.render();
      },
      'or.out': (f, d) => {
        const o = curOp(); const op = opOf(o); const p = H.pat(o.patientId); const e = H.enc(o.encId);
        const last = op.pacu.recs[op.pacu.recs.length - 1];
        if (d.dest === 'ICU') H.transfer(e, 'ICU', '외과계');
        op.pacu.dest = d.dest === 'ICU' ? '중환자실' : `${e.ward} 병동`; op.times.out = Date.now(); op.done = true;
        F.advance(o, '병동이송');
        S.add('handoffs', { id: H.uid('ho'), patientId: p.id, ward: e.ward, at: Date.now(), fromShift: T.shiftOf(), by: `${H.who()} · 회복실`, src: '회복실',
          S: `${p.name} (${H.sexAge(p)}) ${o.name} 마치고 회복실에서 올라갑니다. 알드레테 ${last.total}점, 혈압 ${last.sbp}, 맥박 ${last.hr}, 통증 ${last.pain}점.`,
          B: `${op.anes}. 수술 시간 ${op.times.incision ? Math.round((Date.now() - op.times.incision) / 60000) : '-'}분, 출혈 ${op.ebl || '-'}mL, 수액 ${op.fluid || '-'}mL, 소변 ${op.urine || '-'}mL. 알레르기 ${(p.allergies || []).map((a) => a.name).join(', ') || '없음'}.`,
          A: `의식 명료, 수술 부위 ${last.wound}, 오심 ${last.nausea}. 거즈·기구 계수 일치.`,
          R: '병동 도착 후 바로 활력징후 측정, 이후 15분마다 4번·30분마다 2번. 통증 조절, 심호흡·조기 보행 교육, 첫 배뇨 확인.', status: '인계', ackBy: null });
        H.notify('ward:' + e.ward, `수술 후 도착: ${p.name} (${o.name}) — 회복실 인계를 인수하세요`, { patientId: p.id, level: 'stat' });
        H.log('회복실 퇴실', `${p.name} → ${op.pacu.dest}`, p.id); UI.toast(`${op.pacu.dest}(으)로 이송 — 병동에 인계했습니다`, 'ok'); set('tab', 'note'); A.render();
      },
      'or.note': (f, d) => {
        const o = curOp(); const op = opOf(o);
        op.note = { pre: d.pre, post: d.post, find: d.find, comp: d.comp, by: `${H.who()} (집도의 대신)` };
        S.add('notes', { id: H.uid('no'), encId: o.encId, patientId: o.patientId, type: '수술기록', at: Date.now(), by: H.who(), signed: true, content: { assess: `수술 전: ${d.pre}\n수술 후: ${d.post}`, plan: d.find, result: `합병증: ${d.comp}, 출혈 ${op.ebl || '-'}mL` } });
        UI.toast('수술 기록 저장', 'ok'); A.render();
      },
    },
  });
})();
