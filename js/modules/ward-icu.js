// 병동 간호 확장: 중환자실(ICU) + 응급실 분류(KTAS)
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const K = H.wardKit;
  H.wardExt = H.wardExt || {};

  const RASS = [[4, '+4 공격적'], [3, '+3 매우 초조'], [2, '+2 초조'], [1, '+1 불안'], [0, '0 명료·차분'], [-1, '-1 졸림'], [-2, '-2 가벼운 진정'], [-3, '-3 중등도 진정'], [-4, '-4 깊은 진정'], [-5, '-5 깨울 수 없음']];
  const DRIPS = [
    { n: '노르에피네프린', mix: '4mg / 250mL', conc: 16, u: 'mcg/kg/min', tip: '평균동맥압 65 이상 목표. 중심정맥관으로 주입' },
    { n: '도파민', mix: '400mg / 250mL', conc: 1600, u: 'mcg/kg/min', tip: '2~20 mcg/kg/min' },
    { n: '도부타민', mix: '250mg / 250mL', conc: 1000, u: 'mcg/kg/min', tip: '심장 수축력 증가' },
    { n: '니카르디핀', mix: '20mg / 200mL', conc: 0.1, u: 'mg/hr', tip: '5mg/hr 시작, 15분마다 2.5씩 (최대 15)' },
    { n: '미다졸람', mix: '50mg / 50mL', conc: 1, u: 'mg/hr', tip: '진정 — RASS 목표 확인' },
    { n: '펜타닐', mix: '500mcg / 50mL', conc: 10, u: 'mcg/hr', tip: '진통 — 마약류 이중 확인' },
    { n: '인슐린 (속효성)', mix: '50단위 / 50mL', conc: 1, u: 'unit/hr', tip: '1시간마다 혈당 측정' },
    { n: '헤파린', mix: '25,000단위 / 250mL', conc: 100, u: 'unit/hr', tip: '6시간마다 aPTT' },
  ];
  const rateOf = (d, dose, wt) => (d.u.includes('/kg/min') ? (dose * wt * 60) / d.conc : dose / d.conc);
  const ibw = (p) => p.sex === 'M' ? 50 + 0.91 * (p.height - 152.4) : 45.5 + 0.91 * (p.height - 152.4);

  // ── 중환자 흐름표 ──
  function flow(p) {
    const recs = H.recs(p.id, 'icu').slice(0, 12);
    const wt = p.weight;
    const row = (l, f) => `<tr><td class="nowrap"><b>${l}</b></td>${recs.map((r) => `<td class="num" style="text-align:center">${f(r)}</td>`).join('')}</tr>`;
    const uo = (r) => { const v = H.num(r.urine); if (v == null) return '-'; const low = v < 0.5 * wt; return low ? `<span class="hl-c">${v}</span>` : v; };
    return `<div class="gap-m">
      ${UI.note('중환자실은 1시간마다 활력징후·중심정맥압·소변량·진정 점수·점적 약물을 기록합니다. 소변량이 시간당 0.5mL/kg 미만이면 빨갛게 표시됩니다 (콩팥 기능 저하 신호).', 'info')}
      <div class="panel"><div class="panel-h"><h3>시간별 흐름표 (최근 12시간 · 왼쪽이 최신)</h3><span class="grow"></span><span class="small muted">몸무게 ${wt}kg → 최소 소변 ${Math.round(0.5 * wt)}mL/시간</span></div><div class="panel-b">
        ${recs.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>항목</th>${recs.map((r) => `<th style="text-align:center">${T.hm(r.at)}</th>`).join('')}</tr></thead><tbody>
          ${row('혈압', (r) => `${r.sbp}/${r.dbp}`)}${row('평균동맥압', (r) => r.map < 65 ? `<span class="hl-c">${r.map}</span>` : r.map)}${row('맥박', (r) => r.hr)}${row('호흡', (r) => r.rr)}${row('체온', (r) => r.bt >= 38 ? `<span class="hl-h">${r.bt}</span>` : r.bt)}
          ${row('산소포화도', (r) => r.spo2)}${row('중심정맥압', (r) => r.cvp ?? '-')}${row('소변 (mL)', uo)}${row('진정 (RASS)', (r) => r.rass)}${row('의식 (GCS)', (r) => esc(r.gcs || '-'))}${row('점적 약물', (r) => `<span class="small">${esc(r.drip || '')}</span>`)}
        </tbody></table></div>` : UI.empty('기록이 없습니다')}</div></div>
      <form data-submit="icu.flow" class="panel"><div class="panel-h"><h3>이번 시간 기록 — ${T.hm(Date.now())}</h3></div><div class="panel-b gap-m">
        <div class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr))">
          ${UI.input('sbp', '수축기 혈압', '', { type: 'number' })}${UI.input('dbp', '이완기 혈압', '', { type: 'number' })}${UI.input('hr', '맥박', '', { type: 'number' })}${UI.input('rr', '호흡', '', { type: 'number' })}
          ${UI.input('bt', '체온', '', { type: 'number', step: '0.1' })}${UI.input('spo2', '산소포화도', '', { type: 'number' })}${UI.input('cvp', '중심정맥압 (cmH₂O)', '', { type: 'number' })}${UI.input('urine', '시간당 소변 (mL)', '', { type: 'number' })}
          ${UI.select('rass', '진정 점수 (RASS)', RASS.map(([v, l]) => ({ v, l })), '-2')}${UI.input('gcs', '의식 (GCS)', '')}${UI.select('pupil', '동공', ['양쪽 3mm 빛 반사 있음', '양쪽 2mm 반사 있음', '오른쪽 확대·반사 느림', '왼쪽 확대·반사 느림', '양쪽 확대 반사 없음'], '양쪽 3mm 빛 반사 있음')}${UI.input('drip', '점적 약물·속도', (H.recs(p.id, 'icu')[0] || {}).drip || '')}
        </div>
        <div class="btn-row end">${UI.btn('감시 장치에서 불러오기', 'icu.fill', { icon: 'refresh' })}${UI.btn('이번 시간 기록', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'check' })}</div></div></form>
    </div>`;
  }

  // ── 인공호흡기 ──
  function vent(p) {
    const v = H.recs(p.id, 'vent')[0] || {};
    const w = ibw(p);
    const vtkg = v.vt ? (v.vt / w).toFixed(1) : '-';
    const abga = ['pH', 'pCO2', 'pO2', 'HCO3', 'SaO2'].map((k) => [k, H.flow.lastLab(p.id, k)]);
    return `<div class="grid2">
      <form data-submit="icu.vent" class="panel"><div class="panel-h"><h3>인공호흡기 설정·관찰</h3></div><div class="panel-b gap-m">
        <div class="form-grid">
          ${UI.select('mode', '환기 방식', ['보조 조절 환기 (AC/VC)', '압력 조절 환기 (PC)', '압력 보조 환기 (PS)', '동기화 간헐적 강제 환기 (SIMV)', '자발 호흡 시험 (T자관)'], v.mode || '보조 조절 환기 (AC/VC)')}
          ${UI.input('fio2', '흡입 산소 농도 (%)', v.fio2 ?? 40, { type: 'number' })}${UI.input('peep', '호기말 양압 PEEP (cmH₂O)', v.peep ?? 5, { type: 'number' })}
          ${UI.input('vt', '일회 호흡량 (mL)', v.vt ?? '', { type: 'number' })}${UI.input('rr', '설정 호흡수 (회/분)', v.rr ?? '', { type: 'number' })}${UI.input('pip', '최고 기도압 (cmH₂O)', v.pip ?? '', { type: 'number' })}
          ${UI.input('ett', '기관내관 크기·고정 위치', v.ett || '7.5mm, 입술 기준 22cm', { cls: 'wide' })}${UI.input('cuff', '커프 압력 (20~30 cmH₂O)', v.cuff ?? 25, { type: 'number' })}
          ${UI.select('suction', '흡인 — 가래', ['안 함', '적음·흰색', '중간·누런색', '많음·누런색', '피 섞임'], '중간·누런색')}
        </div>
        ${UI.sec('인공호흡기 관련 폐렴 예방 묶음 (VAP 번들)')}
        <div class="gap-s">${['침상 머리 30~45도 올림', '매일 진정 줄이고 깨워 보기 (이탈 평가)', '구강 간호 (클로르헥시딘)', '위궤양 예방 약 투여', '정맥 혈전 예방'].map((t) => UI.check('bundle', t, (v.bundle || []).includes(t), { multi: true, value: t })).join('')}</div>
        <div class="btn-row end">${UI.btn('기록', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></div></form>
      <div class="gap-m"><div class="panel"><div class="panel-h"><h3>폐 보호 환기 확인</h3></div><div class="panel-b"><dl class="kv">
        <dt>이상 체중</dt><dd class="num">${w.toFixed(1)}kg (키 ${p.height}cm)</dd><dt>일회 호흡량</dt><dd class="num">${v.vt || '-'}mL = <b>${vtkg} mL/kg</b> ${vtkg !== '-' && Number(vtkg) > 8 ? UI.chip('8 초과 — 줄이기 고려', 'stat') : vtkg !== '-' ? UI.chip('6~8 적정', 'done') : ''}</dd>
        <dt>커프 압력</dt><dd>${v.cuff ? (v.cuff < 20 || v.cuff > 30 ? UI.chip(v.cuff + ' — 범위 벗어남', 'stat') : UI.chip(v.cuff + ' 적정', 'done')) : '-'}</dd><dt>마지막 기록</dt><dd>${v.at ? `${T.mdhm(v.at)} ${esc(v.by)}` : '-'}</dd></dl></div></div>
        <div class="panel"><div class="panel-h"><h3>최근 동맥혈가스</h3></div><div class="panel-b"><dl class="kv">${abga.map(([k, r]) => `<dt>${k}</dt><dd class="num">${r ? `${esc(r.v)} ${H.flow.flagHtml(r.flag)}` : '-'}</dd>`).join('')}</dl>
          <p class="small muted" style="margin:.5rem 0 0">산소포화도가 떨어지거나 설정을 바꾼 뒤 30분이 지나면 동맥혈가스를 다시 봅니다 (처방 필요).</p></div></div></div></div>`;
  }

  // ── 점적 약물 ──
  function drip(p) {
    const sel = Number(K.ms('drip', 0)); const d = DRIPS[sel];
    const hist = H.recs(p.id, 'drip');
    return `<div class="grid2">
      <form data-submit="icu.drip" class="panel" id="drip-form"><div class="panel-h"><h3>점적 약물 속도 계산</h3></div><div class="panel-b gap-m">
        ${UI.seg('icu.dripSel', DRIPS.map((x, i) => ({ v: i, l: x.n })), sel)}
        ${UI.note(`<b>${esc(d.n)}</b> ${esc(d.mix)} → 1mL에 <b>${d.conc}${esc(d.u.split('/')[0])}</b>. ${esc(d.tip)}`, 'info')}
        <div class="form-grid">${UI.input('dose', `처방 용량 (${d.u})`, '', { type: 'number', step: '0.01' })}${d.u.includes('/kg/') ? UI.input('wt', '몸무게 (kg)', p.weight, { type: 'number', step: '0.1' }) : ''}
          ${UI.fld('주입 속도', '<span class="score-big" id="drip-rate">-</span> <span class="muted">mL/시간</span>')}</div>
        ${UI.input('reason', '바꾼 이유 (예: 평균동맥압 60 → 올림)', '', { cls: 'wide' })}
        <div class="btn-row end">${UI.btn('계산', 'icu.calc', { icon: 'refresh' })}${UI.btn('속도 변경 기록 (2인 확인)', '', { type: 'submit', kind: 'pri', icon: 'check' })}</div>
        <p class="small muted" style="margin:0">공식: mcg/kg/분 → 용량 × 몸무게 × 60 ÷ 농도 / mg·단위/시간 → 용량 ÷ 농도</p></div></form>
      <div class="panel"><div class="panel-h"><h3>용량 조절 기록</h3></div><div class="panel-b">${UI.table([{ h: '시각' }, { h: '약' }, { h: '용량' }, { h: '속도' }, { h: '이유' }], hist.map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, esc(r.drug), `${esc(r.dose)} ${esc(r.unit)}`, `<b class="num">${esc(r.rate)}</b> mL/h`, `<span class="small">${esc(r.reason || '')}</span>`]), { empty: UI.empty('기록이 없습니다') })}</div></div></div>`;
  }

  // ── 라인 관리 + 섬망 ──
  function bundle(p) {
    const l = H.recs(p.id, 'line')[0] || {};
    const cam = H.recs(p.id, 'cam');
    return `<div class="grid2">
      <form data-submit="icu.line" class="panel"><div class="panel-h"><h3>관(라인) 관리 — 감염 예방</h3></div><div class="panel-b gap-m">
        <div class="form-grid">${UI.input('cvc', '중심정맥관 (위치·삽입일)', l.cvc || '', { cls: 'wide' })}${UI.input('aline', '동맥관', l.aline || '', { cls: 'wide' })}${UI.input('foley', '유치도뇨관', l.foley || '', { cls: 'wide' })}</div>
        ${UI.sec('매일 확인 (중심정맥관 감염·요로감염 예방 묶음)')}
        <div class="gap-s">${['중심정맥관 계속 필요한지 평가', '드레싱 깨끗·건조 (투명 드레싱 7일마다 교환)', '관 만지기 전후 손 위생·연결부 소독', '도뇨관 필요성 평가 (필요 없으면 제거 건의)', '소변 주머니는 방광보다 낮게', '삽입 부위 발적·열감 없음'].map((t) => UI.check('checks', t, false, { multi: true, value: t })).join('')}</div>
        <div class="btn-row end">${UI.btn('관 관리 기록', '', { type: 'submit', kind: 'pri' })}</div></div></form>
      <form data-submit="icu.cam" class="panel"><div class="panel-h"><h3>섬망 사정 (CAM-ICU)</h3></div><div class="panel-b gap-m">
        ${UI.fld('① 진정 점수 (RASS) — -4나 -5이면 사정할 수 없음', UI.pick('rass', RASS.map(([v, l]) => ({ v, l })), ''))}
        <div class="q-block"><div class="q">② 의식 상태가 평소와 갑자기 달라졌거나 하루 중 오르내림</div>${UI.pick('f1', [{ v: 1, l: '예' }, { v: 0, l: '아니오' }], '')}</div>
        <div class="q-block"><div class="q">③ 주의력 결핍 — "ㅅ" 소리 날 때마다 손 꽉 쥐기 10번 중 3번 이상 틀림</div>${UI.pick('f2', [{ v: 1, l: '예' }, { v: 0, l: '아니오' }], '')}</div>
        <div class="q-block"><div class="q">④ 생각이 엉킴 — 간단한 질문 4개 중 2개 이상 틀림</div>${UI.pick('f4', [{ v: 1, l: '예' }, { v: 0, l: '아니오' }], '')}</div>
        <div class="btn-row end">${UI.btn('섬망 판정·저장', '', { type: 'submit', kind: 'pri' })}</div>
        ${cam.length ? UI.table([{ h: '시각' }, { h: 'RASS' }, { h: '결과' }], cam.slice(0, 5).map((c) => [`<span class="num small">${T.mdhm(c.at)}</span>`, c.rass, UI.chip(c.result, c.result.includes('양성') ? 'stat' : c.result.includes('불가') ? 'plain' : 'done')])) : ''}</div></form></div>`;
  }

  H.wardExt.ICU = {
    tabs: [{ id: 'icuflow', label: '중환자 흐름표', icon: 'heart' }, { id: 'vent', label: '인공호흡기', icon: 'refresh' }, { id: 'drip', label: '점적 약물', icon: 'drop' }, { id: 'bundle', label: '관 관리·섬망', icon: 'clip' }],
    render: { icuflow: flow, vent, drip, bundle },
  };

  // ── 응급실 분류 (KTAS) ──
  function suggest(v, cc) {
    if (!v) return 3;
    if (v.avpu === 'U' || (v.sbp && v.sbp < 80) || (v.spo2 && v.spo2 < 85)) return 1;
    if ((v.sbp && v.sbp < 90) || (v.spo2 && v.spo2 < 92) || v.avpu === 'P' || /가슴|흉통|마비|편마비|어눌|의식/.test(cc || '')) return 2;
    if ((v.pain && v.pain >= 8) || (v.bt && v.bt >= 39) || (v.hr && v.hr > 120)) return 3;
    if (v.pain && v.pain >= 4) return 4;
    return 5;
  }
  function triage(p, e) {
    const v = H.lastVs(p.id); const sug = suggest(v, e.cc);
    const encs = K.unitEncs();
    return `<div class="gap-m">
      <div class="panel"><div class="panel-h"><h3>응급실 현황 — 재실 시간</h3></div><div class="panel-b">${UI.table([{ h: '구역' }, { h: '환자' }, { h: '중증도' }, { h: '재실' }, { h: '진행 중 처방' }, { h: '퇴실 결정' }], encs.map((x) => { const pp = H.pat(x.patientId); const mins = Math.round((Date.now() - x.at) / 60000); const pend = S.where('orders', (o) => o.encId === x.id && !H.flow.isDone(o)).length; return [
        `${esc(x.room)} ${esc(x.bed)}`, `<b>${esc(pp.name)}</b>`, UI.chip('KTAS ' + x.ktas, 'ktas' + x.ktas), mins > 360 ? UI.chip(`${Math.floor(mins / 60)}시간 ${mins % 60}분 (6시간 넘음)`, 'stat') : `<span class="num">${Math.floor(mins / 60)}:${H.pad(mins % 60)}</span>`, pend ? `${pend}건` : '-', esc(x.dispo || '미정')]; }))}</div></div>
      <form data-submit="er.triage" class="panel"><div class="panel-h"><h3>중증도 분류·재분류 — ${esc(p.name)}</h3>${UI.chip('현재 KTAS ' + e.ktas, 'ktas' + e.ktas)}</div><div class="panel-b gap-m">
        ${UI.note('한국형 응급환자 분류 도구(KTAS): 주호소, 활력징후, 의식, 통증, 손상 기전으로 1~5단계를 정합니다. 상태가 바뀌면 다시 분류합니다. 1·2단계는 바로 의사에게 알리고 소생실로 옮깁니다.', 'info')}
        <dl class="kv"><dt>주호소</dt><dd>${esc(e.cc || '-')}</dd><dt>내원</dt><dd>${esc(e.arrival || '-')} · ${T.hm(e.at)}</dd><dt>최근 활력징후</dt><dd>${v ? `${v.sbp}/${v.dbp}, 맥박 ${v.hr}, 호흡 ${v.rr}, 체온 ${v.bt}, 산소포화도 ${v.spo2}%, 통증 ${v.pain}` : '없음 — 먼저 측정하세요'}</dd></dl>
        <div class="form-grid">${UI.select('cat', '주호소 분류', ['심혈관 (흉통·두근거림)', '신경 (마비·의식 변화·두통)', '호흡 (숨참·기침)', '소화기 (복통·구토)', '외상 (넘어짐·교통사고)', '감염 (발열)', '기타'], '기타')}
          ${UI.select('mech', '손상 기전 (외상일 때)', ['해당 없음', '넘어짐', '교통사고', '끼임·부딪힘', '추락 (2m 이상)'], '해당 없음')}</div>
        ${UI.fld(`분류 단계 — 활력징후로 계산한 추천: ${sug}단계`, UI.pick('ktas', (H.KTAS || []).map((k) => ({ v: k.v, l: k.l })), sug))}
        ${UI.input('memo', '분류 메모', '', { cls: 'wide' })}
        <div class="btn-row end">${UI.btn('분류 저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></div></form></div>`;
  }
  H.wardExt.ER = { tabs: [{ id: 'triage', label: '분류 (KTAS)', icon: 'siren' }], render: { triage } };

  Object.assign(H.mods.ward.acts, {
    'icu.fill': (el) => {
      const p = A.pat(); const last = H.recs(p.id, 'icu')[0] || {}; const f = el.closest('form');
      const j = (v, r, d = 0) => (v == null || v === '' ? '' : (Number(v) + (Math.random() * 2 - 1) * r).toFixed(d));
      const s = (n, v) => { const i = f.querySelector(`[name="${n}"]`); if (i && !i.value) i.value = v; };
      s('sbp', j(last.sbp || 110, 5)); s('dbp', j(last.dbp || 60, 4)); s('hr', j(last.hr || 90, 4)); s('rr', j(last.rr || 18, 1)); s('bt', j(last.bt || 37, 0.2, 1)); s('spo2', Math.min(100, Math.round(j(last.spo2 || 96, 1)))); s('cvp', j(last.cvp || 8, 1)); s('urine', Math.round(j(last.urine || 40, 10))); s('gcs', last.gcs || '');
    },
    'icu.flow': (f, d) => {
      const p = A.pat(); const e = K.curEnc();
      if (!d.sbp || !d.hr) return UI.toast('혈압과 맥박은 꼭 넣어 주세요', 'warn');
      const sbp = Number(d.sbp), dbp = Number(d.dbp || 0); const map = Math.round((sbp + 2 * dbp) / 3);
      H.addRec('icu', p.id, { sbp, dbp, map, hr: H.num(d.hr), rr: H.num(d.rr), bt: H.num(d.bt), spo2: H.num(d.spo2), cvp: H.num(d.cvp), urine: H.num(d.urine), rass: d.rass, gcs: d.gcs, pupil: d.pupil, drip: d.drip });
      S.add('vitals', { id: H.uid('vs'), patientId: p.id, encId: e.id, at: Date.now(), by: H.who(), sbp, dbp, hr: H.num(d.hr), rr: H.num(d.rr), bt: H.num(d.bt), spo2: H.num(d.spo2), avpu: Number(d.rass) <= -3 ? 'P' : 'A', o2: true }, true);
      if (d.urine) S.add('io', { id: H.uid('io'), patientId: p.id, at: Date.now(), kind: 'out', type: '소변', amount: Number(d.urine), by: H.who() }, true);
      S.save();
      const warn = [];
      if (map < 65) warn.push(`평균동맥압 ${map}`); if (H.num(d.urine) != null && H.num(d.urine) < 0.5 * p.weight) warn.push(`소변 ${d.urine}mL`);
      if (d.pupil && d.pupil.includes('확대')) warn.push('동공 변화');
      UI.toast(warn.length ? `주의: ${warn.join(', ')} — 의사에게 알리세요` : '이번 시간 기록 저장', warn.length ? 'err' : 'ok');
      A.render();
    },
    'icu.vent': (f, d) => { const p = A.pat(); H.addRec('vent', p.id, { mode: d.mode, fio2: H.num(d.fio2), peep: H.num(d.peep), vt: H.num(d.vt), rr: H.num(d.rr), pip: H.num(d.pip), ett: d.ett, cuff: H.num(d.cuff), suction: d.suction, bundle: d.bundle || [] }); H.log('인공호흡기 기록', d.mode, p.id); UI.toast('인공호흡기 기록 저장', 'ok'); A.render(); },
    'icu.dripSel': (el) => { K.set('drip', Number(el.dataset.v)); A.render(); },
    'icu.calc': () => {
      const f = document.getElementById('drip-form'); const d = DRIPS[Number(K.ms('drip', 0))];
      const dose = H.num(f.querySelector('[name=dose]').value); const wt = f.querySelector('[name=wt]') ? H.num(f.querySelector('[name=wt]').value) : 0;
      document.getElementById('drip-rate').textContent = dose == null ? '-' : rateOf(d, dose, wt).toFixed(1);
    },
    'icu.drip': async (f, dd) => {
      const p = A.pat(); const d = DRIPS[Number(K.ms('drip', 0))];
      const dose = H.num(dd.dose); if (dose == null) return UI.toast('용량을 넣어 주세요', 'warn');
      const rate = rateOf(d, dose, H.num(dd.wt) || p.weight).toFixed(1);
      if (!(await UI.confirm({ title: '2인 확인', text: `${d.n} ${dose} ${d.u}\n→ 주입 속도 ${rate} mL/시간\n\n다른 간호사와 계산·펌프 설정을 함께 확인했습니까?`, ok: '2명이 확인함' }))) return;
      H.addRec('drip', p.id, { drug: d.n, dose, unit: d.u, rate, reason: dd.reason }); H.log('점적 약물 조절', `${d.n} ${dose}${d.u} → ${rate}mL/h`, p.id); UI.toast(`${d.n} ${rate} mL/시간 기록`, 'ok'); A.render();
    },
    'icu.line': (f, d) => { const p = A.pat(); H.addRec('line', p.id, { cvc: d.cvc, aline: d.aline, foley: d.foley, checks: d.checks || [] }); UI.toast('관 관리 기록', 'ok'); A.render(); },
    'icu.cam': (f, d) => {
      const p = A.pat(); if (d.rass === '') return UI.toast('진정 점수(RASS)를 먼저 고르세요', 'warn');
      const r = Number(d.rass); let result;
      if (r <= -4) result = '사정 불가 (깊은 진정·혼수)';
      else { if (d.f1 === '' || d.f2 === '') return UI.toast('②와 ③을 골라 주세요', 'warn'); const f3 = r !== 0; result = d.f1 === '1' && d.f2 === '1' && (f3 || d.f4 === '1') ? '섬망 양성' : '섬망 음성'; }
      H.addRec('cam', p.id, { rass: r, result });
      S.add('assess', { id: H.uid('as'), patientId: p.id, kind: 'CAM-ICU 섬망', score: null, level: result, at: Date.now(), by: H.who(), answers: d });
      UI.toast(`CAM-ICU: ${result}`, result.includes('양성') ? 'warn' : 'ok'); A.render();
    },
    'er.triage': (f, d) => {
      const p = A.pat(); const e = K.curEnc(); const before = e.ktas;
      e.ktas = Number(d.ktas); e.triage = { cat: d.cat, mech: d.mech, memo: d.memo, at: Date.now(), by: H.who() };
      S.save(); S.add('acts', { id: H.uid('ac'), patientId: p.id, kind: '중증도 분류', text: `KTAS ${before} → ${e.ktas} (${d.cat})${d.memo ? ' ' + d.memo : ''}`, at: Date.now(), by: H.who() });
      if (e.ktas <= 2) H.notify('doctor', `KTAS ${e.ktas}: ${p.name} — 바로 진료 필요`, { patientId: p.id, level: 'stat' });
      UI.toast(`중증도 ${e.ktas}단계로 분류`, e.ktas <= 2 ? 'warn' : 'ok'); A.render();
    },
  });
})();
