// 영상의학과 — 실별 (접수, 조영제실, 일반촬영, CT, MRI, 투시·혈관조영, 유방·골밀도, 초음파, 핵의학, 판독, PACS)
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const F = H.flow;
  const ms = (k, d) => A.ms(k, d); const set = (k, v) => A.set(k, v);
  const pick = (name, opts, v, o) => UI.pick(name, opts.map((x) => (typeof x === 'object' ? x : { v: x, l: x })), v, o);
  const checks = (name, list, on = []) => `<div class="gap-s">${list.map((t) => UI.check(name, t, on.includes(t), { multi: true, value: t })).join('')}</div>`;
  const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);

  const it = (o) => H.M.item(o.code) || {};
  const whereOf = (o) => { const e = H.enc(o.encId); return !e ? '-' : e.type === 'OPD' ? '외래' : e.type === 'ER' ? `응급 ${e.room}` : `${e.ward} ${e.room}-${e.bed}`; };
  const pLine = (o) => { const p = H.pat(o.patientId); return `<b>${esc(p.name)}</b> <span class="muted small">${H.sexAge(p)} · ${esc(p.mrn)} · ${esc(whereOf(o))}</span>${o.stat ? ' ' + UI.chip('응급', 'stat') : ''}`; };
  const rad = (st, mods) => S.where('orders', (o) => o.cat === 'RAD' && o.status === st && (!mods || mods.includes(it(o).mod))).sort((a, b) => b.stat - a.stat || a.at - b.at);
  const fertile = (p) => p.sex === 'F' && H.age(p.birth) >= 12 && H.age(p.birth) <= 55;

  // 신장 기능 (eGFR, CKD-EPI 2021 식)
  function egfr(p) {
    const cr = F.lastLab(p.id, 'Cr'); const s = cr ? H.num(cr.v) : null; if (s == null) return null;
    const fem = p.sex === 'F'; const k = fem ? 0.7 : 0.9; const a = fem ? -0.241 : -0.302; const age = H.age(p.birth);
    return { cr: s, v: Math.round(142 * Math.pow(Math.min(s / k, 1), a) * Math.pow(Math.max(s / k, 1), -1.2) * Math.pow(0.9938, age) * (fem ? 1.012 : 1)) };
  }
  const onMetformin = (p) => S.where('orders', (o) => o.patientId === p.id && ['MED', 'INJ'].includes(o.cat) && /메트포르민|metformin/i.test(o.name) && !F.isOff(o)).length > 0;
  const cAllergy = (p) => (p.allergies || []).some((a) => a.cls === 'contrast');
  function renalBox(p, gad) {
    const g = egfr(p); const met = onMetformin(p);
    const lim = gad ? 30 : 45; // 요오드 조영제 45, 가돌리늄 30 미만이면 주의
    return `<div class="box"><dl class="kv"><dt>크레아티닌</dt><dd>${g ? `${g.cr} mg/dL` : '<span style="color:var(--t-stat)">결과 없음 — 검사 필요</span>'}</dd><dt>추정 사구체여과율 (eGFR)</dt><dd>${g ? `<b>${g.v}</b> mL/분/1.73㎡ ${g.v < lim ? UI.chip(gad ? '가돌리늄 주의 (30 미만)' : '조영제 신독성 위험 (45 미만)', 'stat') : UI.chip('사용 가능', 'done')}` : '-'}</dd><dt>메트포르민 (당뇨약)</dt><dd>${met ? UI.chip('복용 중 — 검사 후 48시간 중단, 신장 기능 확인 후 다시 시작', 'prog') : '복용 안 함'}</dd><dt>조영제 알레르기</dt><dd>${cAllergy(p) ? UI.chip('있음! — 전처치(스테로이드·항히스타민) 또는 검사 변경을 의사와 상의', 'stat') : '없음'}</dd></dl></div>`;
  }

  // ── 접수 ──
  const ROOMS = { X선: ['일반촬영 1실', '일반촬영 2실', '이동식 촬영'], CT: ['CT 1실', 'CT 2실 (응급)'], MRI: ['MRI 1실 (3.0T)', 'MRI 2실 (1.5T)'], 초음파: ['초음파 1실', '초음파 2실'], 유방촬영: ['유방촬영실'], 골밀도: ['골밀도실'], 투시: ['투시촬영실'], 혈관조영: ['혈관조영실 (인터벤션)'], 핵의학: ['핵의학 감마카메라실', 'PET-CT실'] };
  const PREP = { CT: '조영제 검사는 4~6시간 금식, 정맥 주사 경로(18~20게이지) 확보', MRI: '금속·체내 기기 안전 문진 필수, 검사 시간 20~40분', 초음파: '복부는 8시간 금식, 골반은 소변을 참아 방광을 채움', 투시: '위장 조영은 8시간 금식', 혈관조영: '금식, 동의서, 응고검사, 천자 부위 털 제거', 핵의학: 'PET는 6시간 금식·혈당 200 이하, 주사 후 대기 시간 있음', 골밀도: '검사 전 칼슘약 24시간 중단, 최근 바륨·조영 검사 확인', 유방촬영: '겨드랑이 데오드란트·파우더 바르지 않기' };
  function tabRecv() {
    const list = rad('전송');
    return `${UI.note('영상 접수: 검사 종류에 따라 촬영실과 시간을 정하고, 검사 전 준비(금식·신장 기능·안전 문진)를 병동·외래에 알립니다.', 'info')}
      <div style="margin-top:.8rem">${UI.table([{ h: '처방' }, { h: '환자' }, { h: '검사' }, { h: '실' }, { h: '주의' }, { h: '' }], list.map((o) => { const p = H.pat(o.patientId); const i = it(o); const w = [];
        if (i.contrast) { w.push(UI.chip('조영제', 'prog')); if (cAllergy(p)) w.push(UI.chip('조영제 알레르기!', 'stat')); const g = egfr(p); if (g && g.v < 45) w.push(UI.chip(`eGFR ${g.v}`, 'stat')); }
        if (i.mod === 'MRI') w.push(UI.chip('MRI 안전 문진', 'sent')); if (i.nm) w.push(UI.chip(`방사성의약품 ${i.nm.drug}`, 'purple')); if (fertile(p)) w.push(UI.chip('가임기', 'plain'));
        return [`<span class="num small">${T.mdhm(o.at)}</span>`, pLine(o), `<b>${esc(o.name)}</b>`, esc(i.mod), w.join(' ') || '-', UI.btn('접수', 'r8.recv', { size: 'sm', kind: 'pri', data: { id: o.id } })]; }), { empty: UI.empty('접수할 영상 검사가 없습니다') })}</div>`;
  }

  // ── 조영제실 ──
  function tabContrast() {
    const prep = S.where('orders', (o) => o.cat === 'RAD' && it(o).contrast && o.status === '검사접수' && !o.cm);
    const obs = S.where('orders', (o) => o.cat === 'RAD' && o.cm && o.shotAt && !o.cmObs);
    return `<div class="gap-m">${UI.note('조영제실: 조영제 검사 전 ① 알레르기·신장 기능(eGFR)·당뇨약(메트포르민) 확인 ② 정맥 주사 경로 확보(굵은 바늘, 팔꿈치 안쪽) ③ 동의서. 검사 뒤 <b>30분 관찰</b>(두드러기·호흡곤란·혈압 저하)하고 물을 많이 마시게 합니다. 주사 부위가 붓고 아프면 혈관 밖 누출을 의심합니다.', 'info')}
      ${UI.sec(`검사 전 준비 ${prep.length}건`)}${prep.map((o) => { const p = H.pat(o.patientId); return `<form data-submit="r8.cm" class="box" style="background:var(--surface)"><input type="hidden" name="id" value="${o.id}"><div class="row between">${pLine(o)}<b>${esc(o.name)}</b></div>${renalBox(p, false)}
        <div class="form-grid" style="margin-top:.5rem">${UI.select('agent', '조영제', ['이오헥솔 350 (요오드 비이온성)', '이오프로마이드 370', '이오딕사놀 320 (등삼투압 — 신장 기능 낮을 때)'], (egfr(p) || { v: 90 }).v < 45 ? '이오딕사놀 320 (등삼투압 — 신장 기능 낮을 때)' : '이오헥솔 350 (요오드 비이온성)')}${UI.input('dose', '양 (mL, 보통 체중×1~1.5)', String(Math.round((p.weight || 60) * 1.2)), { type: 'number' })}${UI.select('iv', '정맥 주사 경로', ['18게이지 오른팔 팔꿈치 안쪽', '20게이지 왼팔 팔꿈치 안쪽', '기존 중심정맥관 (고압 주입 가능 확인)'], '18게이지 오른팔 팔꿈치 안쪽')}</div>
        ${checks('c', ['조영제 알레르기 문진 (이전 검사 때 두드러기·호흡곤란)', '신장 기능 확인 (eGFR)', '조영제 사용 동의서', '금식 4~6시간 확인', '주사 경로 생리식염수로 막힘 없음 확인'])}
        <div class="btn-row end">${UI.btn('준비 완료 → 촬영실로', '', { type: 'submit', kind: 'pri' })}</div></form>`; }).join('') || '<p class="muted small">준비할 조영제 검사가 없습니다</p>'}
      ${UI.sec(`검사 후 관찰 ${obs.length}건`)}${obs.map((o) => `<form data-submit="r8.obs" class="box" style="background:var(--surface)"><input type="hidden" name="id" value="${o.id}"><div class="row between">${pLine(o)}<span class="small">${esc(o.cm.agent)} ${esc(o.cm.dose)} mL · 촬영 ${T.hm(o.shotAt)}</span></div>
        <div class="q-block"><div class="q">이상반응 (30분 관찰)</div>${pick('react', ['없음', '경미 (두드러기·가려움·구역)', '중등도 (구토 반복·얼굴 부종·쌕쌕거림)', '중증 (아나필락시스 — 혈압 저하·호흡곤란)'], '없음')}</div>
        <div class="q-block"><div class="q">주사 부위</div>${pick('site', ['이상 없음', '혈관 밖 누출 (부종·통증) — 팔 올리고 냉찜질, 의사 보고'], '이상 없음')}</div>
        ${checks('c', ['물 많이 마시도록 안내 (조영제 배출)', '늦은 반응(1주일 안 발진) 안내', '정맥 주사 경로 제거 또는 병동 인계'])}
        <div class="btn-row end">${UI.btn('관찰 기록', '', { type: 'submit', kind: 'pri' })}</div></form>`).join('') || '<p class="muted small">관찰할 환자가 없습니다</p>'}</div>`;
  }

  // ── 촬영실 공통 ──
  const blockMsg = (o) => { const i = it(o); if (i.contrast && !o.cm && i.mod !== '혈관조영') return '조영제실 준비 먼저'; if (i.nm && !(o.nm && o.nm.injAt)) return '방사성의약품 주사 먼저'; if (i.nm && o.nm && Date.now() < o.nm.readyAt && !o.nm.skip) return `대기 중 (${T.hm(o.nm.readyAt)}부터)`; return ''; };
  function roomTab(mods, help, extra = '') {
    const list = rad('검사접수', mods);
    return `<div class="gap-m">${UI.note(help, 'info')}${extra}
      ${UI.table([{ h: '접수' }, { h: '환자' }, { h: '검사' }, { h: '실·시각' }, { h: '준비' }, { h: '' }], list.map((o) => { const b = blockMsg(o); return [`<span class="num small">${T.hm(o.hist[o.hist.length - 1].at)}</span>`, pLine(o), `<b>${esc(o.name)}</b>`, esc(o.room || '-'), b ? UI.chip(b, 'prog') : UI.chip('준비됨', 'done'), b ? UI.btn('촬영', 'r8.shoot', { size: 'sm', data: { id: o.id }, disabled: true }) : UI.btn('촬영하기', 'r8.shoot', { size: 'sm', kind: 'pri', icon: 'image', data: { id: o.id } })]; }), { empty: UI.empty('촬영 대기가 없습니다') })}
      ${todayDone(mods)}</div>`;
  }
  function todayDone(mods) {
    const l = S.where('orders', (o) => o.cat === 'RAD' && o.shotAt && o.shotAt >= T.startOfDay() && mods.includes(it(o).mod)).sort((a, b) => b.shotAt - a.shotAt);
    if (!l.length) return '';
    return `${UI.sec('오늘 촬영')}${UI.table([{ h: '시각' }, { h: '환자' }, { h: '검사' }, { h: '촬영 기록' }, { h: '' }], l.map((o) => [`<span class="num small">${T.hm(o.shotAt)}</span>`, esc(H.pat(o.patientId).name), esc(o.name), `<span class="small">${esc(techText(o))}</span>`, UI.btn('영상', 'pacs.open', { size: 'sm', icon: 'image', data: { id: o.id } })]))}`;
  }
  function techText(o) {
    const t = o.tech || {}; const i = it(o);
    if (i.mod === 'CT') return `${t.phase || ''} · CTDIvol ${t.ctdi || '-'} mGy · DLP ${t.dlp || '-'} mGy·cm`;
    if (i.mod === 'MRI') return `시퀀스 ${arr(t.seq).join(', ')}`;
    if (i.mod === '골밀도') return `요추 T ${t.tL} · 대퇴골 T ${t.tF} → ${bmdJudge(Math.min(H.num(t.tL), H.num(t.tF)))}`;
    if (i.mod === '핵의학') return `${o.nm.drug} ${o.nm.dose} mCi · 주사 ${T.hm(o.nm.injAt)}`;
    if (i.mod === '투시') return `투시 시간 ${t.ftime || '-'}분 · ${t.agent || ''}`;
    if (i.mod === '혈관조영') return `천자 ${t.site || '-'} · 투시 ${t.ftime || '-'}분`;
    if (i.mod === '유방촬영') return `${arr(t.views).join(', ')}`;
    if (i.mod === '초음파') return `${t.prep || ''}`;
    return `${arr(t.views).join(', ')}${t.kvp ? ` · ${t.kvp} kVp ${t.mas} mAs` : ''}`;
  }
  const bmdJudge = (t) => (t == null ? '-' : t >= -1 ? '정상' : t > -2.5 ? '골감소증' : '골다공증');
  const DRL = { ctbrain: 60, ctchest: 10, ctabd: 15 }; // 진단참고수준 (CTDIvol, mGy) — 교육용 근사치

  function shootForm(o) {
    const p = H.pat(o.patientId); const i = it(o);
    const base = `${UI.check('c', '환자 이름·생년월일 두 가지로 확인', false, { multi: true, value: 'id' })}${fertile(p) ? UI.check('c', '가임기 여성 — 임신 가능성 없음 확인 (마지막 월경일)', false, { multi: true, value: 'preg' }) : ''}`;
    let f = '';
    if (i.mod === 'X선') f = `${UI.fld('촬영 방향', checks('views', i.kind === 'cxr' ? (i.portable ? ['AP (앞→뒤, 누운 자세)'] : ['PA (뒤→앞, 선 자세)', '측면 (Lateral)']) : i.kind === 'bone' ? ['AP (정면)', '측면 (Lateral)', '사위 (Oblique)'] : ['AP 누운 자세', '선 자세 (공기·액체선)'], i.portable ? ['AP (앞→뒤, 누운 자세)'] : i.kind === 'cxr' ? ['PA (뒤→앞, 선 자세)'] : i.kind === 'bone' ? ['AP (정면)', '측면 (Lateral)', '사위 (Oblique)'] : ['AP 누운 자세']))}
      <div class="form-grid">${UI.input('kvp', '관전압 (kVp)', i.kind === 'cxr' ? '120' : '75', { type: 'number' })}${UI.input('mas', '관전류량 (mAs)', i.kind === 'cxr' ? '3.2' : '20', { type: 'number', step: 'any' })}</div>
      ${checks('c', ['금속·장신구 제거', '숨 들이마시고 멈춤 안내 (흉부)', '생식선 납 보호대 (촬영 부위 밖)', '좌우 표시(마커) 놓음'])}${i.portable ? UI.note('이동식 촬영: 주변 사람은 2m 이상 떨어지거나 납 가운 착용. 촬영 판을 등 뒤에 넣을 때 관·줄이 빠지지 않게.', 'warn') : ''}`;
    else if (i.mod === 'CT') { const ref = DRL[i.kind] || 15; const ctdi = (ref * (0.6 + Math.random() * 0.3)).toFixed(1); f = `${UI.fld('조영 단계', checks('phase', i.contrast ? ['비조영', '동맥기 (주입 후 약 30초)', '문맥기 (약 70초)', '지연기 (3~5분)'] : ['비조영'], i.contrast ? ['비조영', '문맥기 (약 70초)'] : ['비조영']))}
      <div class="form-grid">${UI.input('ctdi', `선량 CTDIvol (mGy, 참고수준 ${ref})`, ctdi, { type: 'number', step: 'any' })}${UI.input('dlp', '선량길이곱 DLP (mGy·cm)', String(Math.round(ctdi * (i.kind === 'ctbrain' ? 16 : 38))), { type: 'number' })}${i.contrast ? UI.input('rate', '자동 주입기 속도 (mL/초)', '3', { type: 'number', step: 'any' }) : ''}</div>
      ${checks('c', ['금속·장신구 제거', '숨 참기 연습', i.contrast ? '조영제 주입 시 몸이 뜨거워질 수 있다고 미리 안내' : '움직이지 않도록 안내', '주입기 연결관 공기 제거'].filter(Boolean))}`; }
    else if (i.mod === 'MRI') f = `${UI.note('MRI는 아주 강한 자석입니다. 금속이 끌려가거나 체내 기기가 고장·발열할 수 있어, 들어가기 전 안전 문진을 반드시 합니다. 하나라도 "있음"이면 영상의학과 의사가 MRI 가능 여부(조건부 MRI 가능 기기인지)를 확인해야 합니다.', 'warn')}
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>안전 문진</th><th>있음</th></tr></thead><tbody>${['심장 박동기·제세동기', '인공 와우 (청각 보조)', '뇌동맥류 클립', '눈·몸 속 금속 파편', '인슐린 펌프·약물 주입기', '인공 관절·나사 (수술 시기)', '문신·영구 화장·피부 패치', '임신 가능성', '좁은 곳 공포증 (폐소공포)'].map((t) => `<tr><td>${esc(t)}</td><td>${UI.check('mri', '있음', false, { multi: true, value: t })}</td></tr>`).join('')}</tbody></table></div>
      ${UI.check('mriOk', '"있음" 항목은 영상의학과 의사 확인 받음 (없으면 그냥 체크)', false)}${UI.fld('시퀀스', checks('seq', i.kind === 'mriknee' ? ['T1 강조', 'T2 강조 (지방 억제)', '양성자 밀도 (PD)'] : ['T1 강조', 'T2 강조', 'FLAIR', '확산강조영상 (DWI)', '자기공명 혈관조영 (MRA)'], i.kind === 'mriknee' ? ['T1 강조', 'T2 강조 (지방 억제)', '양성자 밀도 (PD)'] : ['T2 강조', 'FLAIR', '확산강조영상 (DWI)']))}
      ${checks('c', ['옷을 검사복으로 갈아입음 (금속 단추·속옷 철사)', '휴대폰·카드·시계·보청기 보관', '귀마개 (소음 큼)', '비상 호출 벨 쥐어 줌'])}`;
    else if (i.mod === '투시') f = `<div class="form-grid">${UI.select('agent', '조영제 (먹는 것)', ['황산바륨 현탁액 (진한)', '수용성 조영제 (천공 의심 시)'], '황산바륨 현탁액 (진한)')}${UI.input('ftime', '투시 시간 (분)', '3.5', { type: 'number', step: 'any' })}</div>
      ${checks('c', ['8시간 금식 확인', '발포제(가스 알약) 먹고 트림 참기 안내', '검사대 기울임·돌아눕기 안내', '검사 후 물 많이 마시기·하얀 변·변비 시 완하제 안내'])}`;
    else if (i.mod === '혈관조영') f = `<div class="form-grid">${UI.select('site', '천자 부위', ['오른쪽 대퇴동맥 (사타구니)', '오른쪽 요골동맥 (손목)'], '오른쪽 대퇴동맥 (사타구니)')}${UI.input('ftime', '투시 시간 (분)', '12', { type: 'number', step: 'any' })}${UI.input('cmv', '조영제 양 (mL)', '120', { type: 'number' })}</div>
      ${renalBox(p, false)}${checks('c', ['동의서·금식·응고검사 확인', '천자 부위 소독·털 제거', '천자 부위 아래 맥박 표시 (검사 후 비교)', '시술팀 납 가운·갑상선 보호대'])}`;
    else if (i.mod === '유방촬영') f = `${UI.fld('촬영 방향 (양쪽 4장 기본)', checks('views', ['오른쪽 위→아래 (CC)', '왼쪽 위→아래 (CC)', '오른쪽 비스듬히 (MLO)', '왼쪽 비스듬히 (MLO)', '추가 확대·압박 촬영'], ['오른쪽 위→아래 (CC)', '왼쪽 위→아래 (CC)', '오른쪽 비스듬히 (MLO)', '왼쪽 비스듬히 (MLO)']))}
      ${checks('c', ['데오드란트·파우더 닦음 (석회화로 오인)', '압박하면 아플 수 있다고 안내 (선명한 영상·선량 감소)', '이전 영상과 비교 요청'])}`;
    else if (i.mod === '골밀도') f = `${UI.note('골밀도 판정 (T-점수, 젊은 성인 평균과 비교): -1 이상 정상 · -1~-2.5 골감소증 · -2.5 이하 골다공증. 폐경 전 여성·50세 미만 남성은 Z-점수(같은 나이 비교)를 봅니다.', 'info')}
      <div class="form-grid">${UI.input('tL', '요추 (L1~L4) T-점수', (-1 - Math.random() * 2).toFixed(1), { type: 'number', step: 'any' })}${UI.input('tF', '대퇴골 목 T-점수', (-0.8 - Math.random() * 1.8).toFixed(1), { type: 'number', step: 'any' })}${UI.input('z', 'Z-점수', '-0.6', { type: 'number', step: 'any' })}</div>
      ${checks('c', ['금속(허리띠·지퍼) 제거', '24시간 안 칼슘약·최근 바륨 검사 없음', '다리 받침대로 허리 펴기'])}`;
    else if (i.mod === '초음파') f = `${UI.fld('검사 전 준비', pick('prep', i.kind === 'usabd' ? ['8시간 금식 확인', '금식 안 됨 — 쓸개 관찰 제한 기록'] : ['준비 필요 없음', '방광 채움 (골반 초음파)'], i.kind === 'usabd' ? '8시간 금식 확인' : '준비 필요 없음'))}${checks('c', ['검사 부위 옷 걷기·가림막', '젤이 차가울 수 있다고 안내', '검사 후 젤 닦아 드림'])}`;
    else if (i.mod === '핵의학') f = `${UI.note(`방사성의약품 ${esc(o.nm.drug)} ${o.nm.dose} mCi — ${T.hm(o.nm.injAt)} 주사. 촬영 후 소변을 자주 보고 물을 많이 마시게 하며, 24시간은 임신부·어린아이와 가까이 오래 있지 않도록 안내합니다.`, 'info')}${checks('c', ['주사 후 대기 시간 지남', '촬영 직전 소변 보기 (방광 방사능 줄이기)', '금속 제거'])}`;
    return `<form data-submit="r8.shootGo" class="gap-m"><input type="hidden" name="id" value="${o.id}"><p style="margin:0">${pLine(o)} · <b>${esc(o.name)}</b></p><div class="gap-s">${base}</div>${f}
      <div class="btn-row end">${UI.btn('촬영 완료 → PACS 전송', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'send' })}</div></form>`;
  }

  // ── 핵의학 ──
  function tabNM() {
    const list = rad('검사접수', ['핵의학']);
    const waste = S.where('recs', (r) => r.kind === 'nmlog' && r.at >= T.startOfDay());
    return `<div class="gap-m">${UI.note('핵의학: 방사성 동위원소를 붙인 약(방사성의약품)을 주사하고, 몸에 퍼진 뒤 감마카메라·PET로 찍습니다. ① 용량 측정기(dose calibrator)로 양 확인 ② 주사·시각 기록 ③ 정해진 대기 ④ 촬영. 주사기·솜은 방사성 폐기물로 따로 모아 붕괴될 때까지 보관합니다. 직원은 선량계(배지)를 차고 차폐 주사기를 씁니다.', 'info')}
      ${list.map((o) => { const p = H.pat(o.patientId); const nm = Object.assign({}, it(o).nm, o.nm || {}); const inj = o.nm && o.nm.injAt; const left = inj ? Math.max(0, Math.round((o.nm.readyAt - Date.now()) / 60000)) : null; const glu = F.lastLab(p.id, 'Glu');
        return `<div class="box" style="background:var(--surface)"><div class="row between">${pLine(o)}<b>${esc(o.name)}</b></div>
          ${!inj ? `<form data-submit="r8.nmInj" class="gap-s" style="margin-top:.5rem"><input type="hidden" name="id" value="${o.id}"><div class="form-grid">${UI.input('drug', '방사성의약품', nm.drug)}${UI.input('dose', `측정 용량 (mCi, 처방 ${nm.dose})`, String(nm.dose), { type: 'number', step: 'any' })}${UI.select('site', '주사 부위', ['왼팔 정맥', '오른팔 정맥'], '왼팔 정맥')}${nm.fast ? UI.input('bst', '주사 전 혈당 (mg/dL, 200 이하)', glu ? String(glu.v) : '110', { type: 'number' }) : ''}</div>
            ${checks('c', ['환자 두 가지 확인', '용량 측정기로 양 확인', nm.fast ? '6시간 금식 확인 (PET)' : '임신·수유 여부 확인', '차폐 주사기 사용', '주사 후 주사기·솜 방사성 폐기물통'])}
            <div class="btn-row end">${UI.btn('주사 기록', '', { type: 'submit', kind: 'pri' })}</div></form>`
            : `<p class="small" style="margin:.4rem 0">${esc(o.nm.drug)} <b>${o.nm.dose} mCi</b> · ${T.hm(o.nm.injAt)} 주사 · 대기 ${nm.wait}분 → ${left > 0 && !o.nm.skip ? `<b>${left}분 남음</b>` : '<b>촬영 가능</b>'}${nm.fast ? ` · 혈당 ${esc(o.nm.bst)}` : ''}</p>${nm.wait >= 60 ? `<p class="small muted" style="margin:0">${o.code === 'R3016' ? '대기 동안 물 1리터 이상 마시게 하기 (뼈에 붙지 않은 약 배출)' : 'PET 대기실에서 조용히 누워 쉬기 (말하거나 움직이면 근육에 약이 모임)'}</p>` : ''}
              <div class="btn-row end">${left > 0 && !o.nm.skip ? UI.btn('실습: 대기 시간 건너뛰기', 'r8.nmSkip', { size: 'sm', data: { id: o.id } }) : UI.btn('촬영하기', 'r8.shoot', { kind: 'pri', icon: 'image', data: { id: o.id } })}</div>`}</div>`; }).join('') || UI.empty('핵의학 검사 대기가 없습니다')}
      ${UI.sec('오늘 방사성의약품 사용 기록')}${UI.table([{ h: '시각' }, { h: '환자' }, { h: '약' }, { h: '용량' }, { h: '폐기' }], waste.map((r) => [`<span class="num small">${T.hm(r.at)}</span>`, esc(H.pat(r.patientId).name), esc(r.drug), `${r.dose} mCi`, '방사성 폐기물 보관 (붕괴 후 일반 폐기)']), { empty: '<p class="muted small">기록이 없습니다</p>' })}${todayDone(['핵의학'])}</div>`;
  }

  // ── 판독 · PACS ──
  function tabRead() {
    const list = rad('촬영완료'); const sel = ms('sel', ''); const o = list.find((x) => x.id === sel) || list[0];
    if (!o) return UI.empty('판독할 영상이 없습니다', '촬영이 끝난 영상이 여기에 모입니다.');
    const p = H.pat(o.patientId); const i = it(o); const e = H.enc(o.encId) || {};
    return `<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,1.1fr)">
      <div class="gap-s">${UI.sec(`판독 대기 ${list.length}건`)}${list.map((x) => `<button class="prow ${x.id === o.id ? 'on' : ''}" style="border:1px solid var(--line);border-radius:6px" data-act="rd.sel" data-id="${x.id}"><span class="loc">${esc(it(x).mod)}</span><span class="nm">${esc(H.pat(x.patientId).name)}</span><span class="mk">${x.stat ? UI.chip('응급', 'stat') : ''}</span><span class="sub">${esc(x.name)}</span></button>`).join('')}
        ${UI.btn('PACS로 영상 크게 보기', 'pacs.open', { kind: 'pri', icon: 'image', block: true, data: { id: o.id } })}
        <div class="box"><h4>임상 정보</h4><dl class="kv"><dt>환자</dt><dd>${esc(p.name)} ${H.sexAge(p)}</dd><dt>진단</dt><dd>${esc((e.dx || []).map((d) => d.name).join(', ') || e.cc || '-')}</dd><dt>촬영 기록</dt><dd>${esc(techText(o))}</dd></dl></div></div>
      <form data-submit="rd.read" class="gap-m"><input type="hidden" name="id" value="${o.id}"><div style="background:#000;border-radius:6px;max-width:22rem">${H.sim.radImage(i.kind, H.sim.radReport(p, o).lesion, 0)}</div>
        ${UI.textarea('findings', '판독 소견', '', { h: '7rem', ph: '영상에서 보이는 것을 부위별로 씁니다' })}${UI.textarea('impression', '결론', '', { h: '3rem' })}
        <div class="btn-row end">${UI.btn('판독 예시 불러오기', 'r8.fill', { icon: 'refresh', data: { id: o.id } })}${UI.btn('판독 완료 → 보고', '', { type: 'submit', kind: 'pri', icon: 'send' })}</div></form></div>`;
  }
  function tabPacs() {
    const list = S.where('orders', (o) => o.cat === 'RAD' && o.shotAt).sort((a, b) => b.shotAt - a.shotAt);
    return UI.table([{ h: '촬영' }, { h: '환자' }, { h: '실' }, { h: '검사' }, { h: '상태' }, { h: '결론' }, { h: '' }], list.map((o) => [`<span class="num small">${T.mdhm(o.shotAt)}</span>`, pLine(o), esc(it(o).mod), esc(o.name), F.chip(o), o.result ? esc(o.result.impression) : '<span class="muted">판독 전</span>', UI.btn('보기', 'pacs.open', { size: 'sm', icon: 'image', data: { id: o.id } })]), { empty: UI.empty('저장된 영상이 없습니다') });
  }

  const old = H.mods.radiology;
  const n = (mods) => rad('검사접수', mods).length || '';
  H.reg({
    id: 'radiology', title: '영상의학과', actor: '방사선사·영상의학과 의사', layout: 'full', channels: () => ['rad'],
    render() {
      const tab = ms('tab', 'recv');
      const tabs = [{ id: 'recv', label: '접수', icon: 'clip', cnt: rad('전송').length || '' }, { id: 'cm', label: '조영제실', cnt: S.where('orders', (o) => o.cat === 'RAD' && it(o).contrast && ((o.status === '검사접수' && !o.cm) || (o.cm && o.shotAt && !o.cmObs))).length || '' },
        { id: 'xr', label: '일반촬영', cnt: n(['X선']) }, { id: 'ct', label: 'CT', cnt: n(['CT']) }, { id: 'mri', label: 'MRI', cnt: n(['MRI']) }, { id: 'fl', label: '투시·혈관조영', cnt: n(['투시', '혈관조영']) },
        { id: 'mb', label: '유방·골밀도', cnt: n(['유방촬영', '골밀도']) }, { id: 'us', label: '초음파', cnt: n(['초음파']) }, { id: 'nm', label: '핵의학', cnt: n(['핵의학']) },
        { id: 'read', label: '판독', icon: 'edit', cnt: rad('촬영완료').length || '' }, { id: 'pacs', label: 'PACS', icon: 'eye' }];
      const BODY = { recv: tabRecv, cm: tabContrast,
        xr: () => roomTab(['X선'], '일반촬영실: 방향(PA·AP·측면)을 정하고, 촬영 부위 밖 생식선은 납으로 가립니다. 흉부는 숨을 크게 들이마시고 멈춘 상태에서 찍습니다. 방사선 3원칙: 시간은 짧게, 거리는 멀게, 차폐(납).'),
        ct: () => roomTab(['CT'], 'CT실: 조영제 검사는 조영제실 준비가 끝나야 찍을 수 있습니다. 조영 단계(동맥기·문맥기·지연기)를 정하고, 장비가 알려 주는 선량(CTDIvol·DLP)을 기록해 참고수준과 비교합니다.'),
        mri: () => roomTab(['MRI'], 'MRI실: 들어가기 전 안전 문진(심장 박동기·인공 와우·뇌동맥류 클립·금속 파편 등). 산소통·휠체어 같은 쇠붙이는 절대 검사실에 들이지 않습니다. 가돌리늄 조영제는 eGFR 30 미만이면 주의합니다.'),
        fl: () => roomTab(['투시', '혈관조영'], '투시촬영: 바륨을 먹으며 실시간 X선으로 봅니다 (검사 후 변비 주의). 혈관조영: 사타구니·손목 동맥에 관을 넣어 조영제를 주입합니다. 끝나면 천자 부위 압박 지혈, 침상 안정, 발·손 끝 맥박·색깔 확인을 병동에 인계합니다.'),
        mb: () => roomTab(['유방촬영', '골밀도'], '유방촬영: 양쪽을 위→아래(CC)와 비스듬히(MLO) 2방향씩 압박해서 찍습니다. 골밀도: 이중에너지 X선으로 허리뼈·대퇴골 목을 재서 T-점수로 판정합니다.'),
        us: () => roomTab(['초음파'], '초음파: 방사선이 없어 임신부도 안전합니다. 복부는 8시간 금식(쓸개가 줄어들지 않게), 골반은 방광을 채워야 잘 보입니다.'),
        nm: tabNM, read: tabRead, pacs: tabPacs }; const body = (BODY[tab] || Object.values(BODY)[0])();
      return `<div class="panel">${UI.tabs('rd.tab', tabs, tab)}<div class="panel-b">${body}</div></div>`;
    },
    acts: Object.assign({}, old ? old.acts : {}, {
      'r8.recv': (el) => {
        const o = S.get('orders', el.dataset.id); const i = it(o); const p = H.pat(o.patientId); const rooms = i.portable ? ['이동식 촬영'] : ROOMS[i.mod] || ['촬영실'];
        UI.modal({ title: `영상 접수 — ${o.name}`, size: 'wide', body: `<form data-submit="r8.recvGo" class="gap-m"><input type="hidden" name="id" value="${o.id}"><p style="margin:0">${pLine(o)}</p>
          ${UI.fld('촬영실', pick('room', rooms, rooms[o.stat && rooms[1] ? 1 : i.nm && i.nm.fast ? 1 : 0]))}${UI.input('time', '검사 예정 시각', T.hm(Date.now() + (o.stat ? 5 : 30) * 60000))}
          ${PREP[i.mod] ? UI.note(`검사 전 준비: ${PREP[i.mod]}`, 'info') : ''}${i.contrast ? renalBox(p, false) : ''}${i.mod === 'MRI' ? UI.note('MRI 안전 문진은 촬영실에서 다시 합니다. 체내 기기가 있으면 기기 카드(모델명)를 가져오게 하세요.', 'warn') : ''}
          <div class="btn-row end">${UI.btn('접수 + 병동·외래에 준비 안내', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` });
      },
      'r8.recvGo': (f, d) => {
        const o = S.get('orders', d.id); const i = it(o); const p = H.pat(o.patientId);
        F.advance(o, '검사접수', { room: `${d.room} ${d.time}` });
        if (o.ward) H.notify('ward:' + o.ward, `영상 검사 예정: ${p.name} ${o.name} — ${d.room} ${d.time}${PREP[i.mod] ? ` · 준비: ${PREP[i.mod]}` : ''}`, { patientId: p.id });
        const tabFor = { X선: 'xr', CT: 'ct', MRI: 'mri', 투시: 'fl', 혈관조영: 'fl', 유방촬영: 'mb', 골밀도: 'mb', 초음파: 'us', 핵의학: 'nm' }[i.mod];
        UI.close(); UI.toast(`접수 — ${i.contrast ? '조영제실' : i.mod} 대기열로 갔습니다`, 'ok'); A.render(); void tabFor;
      },
      'r8.cm': (f, d) => {
        const o = S.get('orders', d.id); const p = H.pat(o.patientId); const g = egfr(p);
        if (arr(d.c).length < 5) return UI.toast('검사 전 확인 다섯 가지를 모두 하세요', 'warn');
        if (cAllergy(p)) UI.toast('조영제 알레르기 환자 — 전처치 여부를 의사에게 꼭 확인하세요', 'warn');
        if (g && g.v < 30) return UI.toast(`eGFR ${g.v} — 요오드 조영제 사용 전 주치의·영상의학과 의사와 상의 (수액 전처치 또는 비조영 검사)`, 'err');
        o.cm = { agent: d.agent, dose: d.dose, iv: d.iv, at: Date.now(), by: H.who() }; S.save();
        if (onMetformin(p) && o.ward) H.notify('ward:' + o.ward, `${p.name}: 조영제 검사 — 메트포르민 48시간 중단, 신장 기능 확인 후 재개 (주치의 확인)`, { patientId: p.id });
        UI.toast('조영제 준비 완료 — CT실에서 촬영할 수 있습니다', 'ok'); A.render();
      },
      'r8.obs': (f, d) => {
        const o = S.get('orders', d.id); const p = H.pat(o.patientId); o.cmObs = { react: d.react, site: d.site, at: Date.now(), by: H.who() }; S.save();
        H.addRec('contrastObs', p.id, { order: o.name, react: d.react, site: d.site });
        if (d.react !== '없음' || d.site !== '이상 없음') { H.notify('doctor', `조영제 이상반응: ${p.name} ${o.name} — ${d.react} / ${d.site}`, { patientId: p.id, level: /중증|중등도/.test(d.react) ? 'stat' : '' }); if (o.ward) H.notify('ward:' + o.ward, `조영제 이상반응: ${p.name} — ${d.react}`, { patientId: p.id, level: 'stat' }); }
        if (/중증/.test(d.react)) UI.modal({ title: '아나필락시스 응급 처치', icon: 'alert', size: 'narrow', body: `${UI.note('① 도움 요청 (신속대응팀) ② 에피네프린 0.5mg 허벅지 근육 주사 (의사 지시) ③ 산소·다리 올리기 ④ 수액 빠르게 ⑤ 활력징후 5분마다', 'danger')}<p class="small muted">조영제 알레르기를 의무기록 알레르기 목록에 꼭 등록합니다.</p>` });
        else UI.toast(d.react === '없음' ? '관찰 기록 — 이상반응 없음' : '이상반응 보고 — 의사에게 알렸습니다', d.react === '없음' ? 'ok' : 'warn');
        A.render();
      },
      'r8.shoot': (el) => { const o = S.get('orders', el.dataset.id); const b = blockMsg(o); if (b) return UI.toast(b, 'warn'); UI.modal({ title: `촬영 — ${o.name}`, icon: 'image', size: 'wide', body: shootForm(o) }); },
      'r8.shootGo': (f, d) => {
        const o = S.get('orders', d.id); const p = H.pat(o.patientId); const i = it(o); const c = arr(d.c);
        if (!c.includes('id')) return UI.toast('환자 확인은 꼭 해야 합니다', 'err');
        if (fertile(p) && !c.includes('preg') && i.mod !== '초음파') return UI.toast('가임기 여성은 임신 여부를 확인해야 합니다', 'err');
        if (i.mod === 'MRI') { if (arr(d.mri).length && !d.mriOk) return UI.toast(`MRI 안전 문진 "있음": ${arr(d.mri).join(', ')} — 영상의학과 의사 확인 없이 들어갈 수 없습니다`, 'err'); if (!d.mriOk) return UI.toast('안전 문진 확인 칸을 체크하세요', 'warn'); }
        if (i.mod === 'CT' && H.num(d.ctdi) > (DRL[i.kind] || 15)) UI.toast(`CTDIvol ${d.ctdi} mGy — 참고수준(${DRL[i.kind] || 15})보다 높습니다. 촬영 조건을 확인하세요`, 'warn');
        const tech = { views: arr(d.views), kvp: d.kvp, mas: d.mas, phase: arr(d.phase).join(' + '), ctdi: d.ctdi, dlp: d.dlp, seq: arr(d.seq), mriQ: arr(d.mri), agent: d.agent, ftime: d.ftime, site: d.site, tL: d.tL, tF: d.tF, z: d.z, prep: d.prep, by: H.who() };
        F.advance(o, '촬영완료', { shotAt: Date.now(), tech });
        if (i.mod === '혈관조영' && o.ward) H.notify('ward:' + o.ward, `혈관조영 끝: ${p.name} — ${d.site} 천자. 압박 지혈·침상 안정, 15분마다 천자 부위 출혈·발끝 맥박 확인`, { patientId: p.id, level: 'stat' });
        UI.close(); UI.toast(`촬영 완료 — PACS 전송${i.contrast && i.mod === 'CT' ? ' · 조영제실에서 30분 관찰' : ''}`, 'ok'); A.render();
      },
      'r8.nmInj': (f, d) => {
        const o = S.get('orders', d.id); const nm = it(o).nm; const p = H.pat(o.patientId);
        if (arr(d.c).length < 5) return UI.toast('주사 전 확인 다섯 가지를 모두 하세요', 'warn');
        if (nm.fast && H.num(d.bst) > 200) return UI.toast(`혈당 ${d.bst} — 200을 넘으면 PET 영상이 부정확합니다. 주치의와 상의해 혈당을 조절한 뒤 다시 예약`, 'err');
        if (Math.abs(H.num(d.dose) - nm.dose) / nm.dose > 0.1) return UI.toast(`측정 용량이 처방(${nm.dose} mCi)과 10% 넘게 다릅니다 — 다시 측정하세요`, 'err');
        o.nm = { drug: d.drug, dose: d.dose, site: d.site, bst: d.bst, injAt: Date.now(), readyAt: Date.now() + nm.wait * 60000, by: H.who() }; S.save();
        H.addRec('nmlog', p.id, { drug: d.drug, dose: d.dose });
        UI.toast(`주사 기록 — ${nm.wait}분 대기 후 촬영`, 'ok'); A.render();
      },
      'r8.nmSkip': (el) => { const o = S.get('orders', el.dataset.id); o.nm.skip = true; S.save(); A.render(); },
      'r8.fill': (el) => {
        const o = S.get('orders', el.dataset.id); const r = H.sim.radReport(H.pat(o.patientId), o); const f = el.closest('form');
        let fd = r.findings, im = r.impression;
        if (it(o).mod === '골밀도' && o.tech) { const t = Math.min(H.num(o.tech.tL), H.num(o.tech.tF)); fd = `요추(L1~L4) T-점수 ${o.tech.tL}, 대퇴골 목 T-점수 ${o.tech.tF}, Z-점수 ${o.tech.z}.`; im = `${bmdJudge(t)} (가장 낮은 T-점수 ${t})${t <= -2.5 ? ' — 골다공증 치료 및 낙상 예방 권고' : ''}`; }
        f.querySelector('[name=findings]').value = fd; f.querySelector('[name=impression]').value = im;
      },
    }),
  });
})();
