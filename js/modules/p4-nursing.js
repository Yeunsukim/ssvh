// 4단계 간호 직군: 가정간호, 재활, 방사선종양, 장기이식 코디네이터, 영양집중지원(NST)
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const DAY = 86400000;
  const pick = (name, opts, v, on) => UI.pick(name, opts.map((o) => (typeof o === 'object' ? o : { v: o, l: o })), v, on ? { on } : {});
  const checks = (name, list, on = []) => `<div class="gap-s">${list.map((t) => UI.check(name, t, on.includes(t), { multi: true, value: t })).join('')}</div>`;
  const tabsOf = (act, list, def) => { const tab = A.ms('tab', def); return { tab, html: UI.tabs(act, list, tab) }; };
  const needPat = (msg) => `<div class="panel"><div class="panel-b">${UI.empty('왼쪽에서 환자를 고르세요', msg)}</div></div>`;

  // ───────── 가정간호 ─────────
  H.reg({
    id: 'homecare', title: '가정간호', actor: '가정전문간호사', layout: 'patient', channels: () => ['home'],
    list() { return { title: '오늘 방문 대상', rows: S.where('patients', (p) => p.home).sort((a, b) => a.home.seq - b.home.seq).map((p) => { const v = H.recs(p.id, 'hcvisit')[0]; const today = v && v.at >= T.startOfDay(); return { pid: p.id, encId: '', loc: `방문 ${p.home.seq}`, name: p.name, marks: UI.chip(today ? '방문 완료' : '방문 예정', today ? 'done' : 'sent'), sub: `${H.sexAge(p)} · ${esc(p.address)}` }; }) }; },
    render() {
      const p = A.pat(); if (!p || !p.home) return needPat('가정간호는 퇴원 후 집에서 치료가 필요한 환자를 간호사가 찾아가 돌봅니다 (의사의 가정간호 의뢰서 필요).');
      const { tab, html } = tabsOf('hc.tab', [{ id: 'prep', label: '방문 준비', icon: 'clip' }, { id: 'visit', label: '방문 기록', icon: 'home' }, { id: 'hist', label: '방문 기록 목록', icon: 'list' }], 'prep');
      const last = H.recs(p.id, 'hcvisit')[0];
      let body;
      if (tab === 'prep') body = `<div class="grid2"><div class="box"><h4>의사 가정간호 지시 (${esc(p.home.dr)} 교수)</h4><ul style="margin:0;padding-left:1.2rem">${p.home.orders.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></div>
          <div class="box"><h4>지난 방문 (${last ? T.md(last.at) : '-'})</h4>${last ? `<p class="small" style="margin:0">${esc(last.wound || '')}<br>${esc(last.memo || '')}</p>` : '<p class="muted">없음</p>'}</div></div>
        <div class="box" style="margin-top:.8rem"><h4>방문 전 준비</h4>${checks('prep', ['보호자에게 방문 시간 전화 확인', '드레싱 물품·멸균 세트 챙김', '교체할 도뇨관·비위관 (크기 확인)', '혈압계·혈당계·체온계', '손 소독제·보호구', '방문 경로·주차·안전 확인 (혼자 방문 시 위치 공유)'])}</div>
        <div class="row box" style="margin-top:.8rem"><span><b>주소</b> ${esc(p.address)}</span><span><b>보호자</b> ${esc(p.guardian || '-')}</span><span><b>보험</b> ${esc(p.ins)}</span><span class="small muted">가정간호 기본방문료 + 처치료 (건강보험 본인부담 20%, 교통비는 별도)</span></div>`;
      else if (tab === 'visit') body = `<form data-submit="hc.visit" class="gap-m">
        <div class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr))">${UI.input('arrive', '도착 시각', T.hm(Date.now()))}${UI.input('sbp', '수축기 혈압', '', { type: 'number' })}${UI.input('dbp', '이완기 혈압', '', { type: 'number' })}${UI.input('hr', '맥박', '', { type: 'number' })}${UI.input('bt', '체온', '', { type: 'number', step: '0.1' })}${UI.input('spo2', '산소포화도', '', { type: 'number' })}${UI.input('bst', '혈당', '', { type: 'number' })}</div>
        ${UI.sec('상처·욕창 사정')}
        <div class="form-grid">${UI.input('site', '부위', '천골부')}${UI.fld('단계', pick('stage', ['1단계', '2단계', '3단계', '4단계', '판정 불가'], '3단계'))}${UI.input('size', '크기 (가로×세로×깊이 cm)', '4×3×1')}${UI.select('exu', '삼출물', ['없음', '적음', '중간', '많음·냄새'], '중간')}${UI.select('tissue', '바닥 조직', ['빨간 육아조직', '노란 부육조직', '검은 괴사조직'], '빨간 육아조직')}</div>
        ${UI.sec('오늘 한 처치')}
        ${checks('care', ['욕창 드레싱', '유치도뇨관 교체', '비위관 교체', '기관절개관 관리·흡인', '채혈 (검사 의뢰)', '투약 관리 (약 정리)', '인슐린 주사 점검', '재택 산소 점검', '체위 변경·영양 교육 (보호자)'])}
        <div class="form-grid">${UI.textarea('memo', '관찰·상담 내용', '', { h: '4rem' })}${UI.input('next', '다음 방문', T.d(Date.now() + 3 * DAY), { type: 'date' })}</div>
        ${UI.check('report', '의사에게 보고 필요 (상태 악화)', false)}
        <div class="btn-row end">${UI.btn('방문 기록 저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
      else body = UI.table([{ h: '방문일' }, { h: '활력징후' }, { h: '상처' }, { h: '처치' }, { h: '간호사' }], H.recs(p.id, 'hcvisit').map((v) => [`<span class="num small">${T.mdhm(v.at)}</span>`, esc(v.vs || ''), `<span class="small">${esc(v.wound || '')}</span>`, `<span class="small">${(v.care || []).map(esc).join(', ')}</span>`, `<span class="small">${esc(v.by)}</span>`]), { empty: UI.empty('방문 기록이 없습니다') });
      return `<div class="panel">${html}<div class="panel-b">${body}</div></div>`;
    },
    acts: {
      'hc.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'hc.visit': (f, d) => {
        const p = A.pat(); if (!d.sbp) return UI.toast('혈압을 넣어 주세요', 'warn');
        H.addRec('hcvisit', p.id, { vs: `${d.sbp}/${d.dbp}-${d.hr}-${d.bt}℃-${d.spo2}%${d.bst ? ' 혈당 ' + d.bst : ''}`, wound: `${d.site} 욕창 ${d.stage} ${d.size}cm, 삼출물 ${d.exu}, ${d.tissue}`, care: d.care || [], memo: d.memo, next: d.next });
        S.add('vitals', { id: H.uid('vs'), patientId: p.id, at: Date.now(), by: H.who(), sbp: H.num(d.sbp), dbp: H.num(d.dbp), hr: H.num(d.hr), bt: H.num(d.bt), spo2: H.num(d.spo2), bst: H.num(d.bst) }, true);
        p.home.next = d.next; S.save();
        if (d.report || d.tissue.includes('괴사') || d.exu.includes('냄새')) H.notify('doctor', `가정간호 보고: ${p.name} — ${d.stage} 욕창 ${d.tissue}, 삼출물 ${d.exu}`, { patientId: p.id, level: 'stat' });
        H.log('가정간호 방문', p.name, p.id); UI.toast('방문 기록 저장', 'ok'); A.set('tab', 'hist'); A.render();
      },
    },
  });

  // ───────── 재활 ─────────
  const rehabPats = () => S.where('patients', (p) => p.rehab || S.where('orders', (o) => o.patientId === p.id && o.cat === 'CONSULT' && o.name.includes('재활')).length);
  H.reg({
    id: 'rehab', title: '재활치료', actor: '재활 간호사·치료사', layout: 'patient', channels: () => ['rehab'],
    list() { return { title: '재활 환자', rows: rehabPats().map((p) => { const e = H.activeEnc(p.id); const ev = H.recs(p.id, 'rehab').find((r) => r.type === '평가'); return { pid: p.id, encId: e ? e.id : '', loc: e ? `${e.ward || '외래'} ${e.room || ''}` : '외래', name: p.name, marks: ev ? UI.chip(`MBI ${ev.mbi}`, 'plain') : '', sub: `${H.sexAge(p)} · ${esc(p.hx || '')}` }; }), empty: '재활 의뢰 환자가 없습니다 (입원 진료에서 재활의학과 협진 의뢰)' }; },
    render() {
      const p = A.pat(); if (!p || !rehabPats().includes(p)) return needPat('뇌졸중·골절·수술 후 환자가 다시 걷고 일상생활을 할 수 있도록 기능을 평가하고 훈련합니다.');
      const { tab, html } = tabsOf('rh.tab', [{ id: 'eval', label: '기능 평가', icon: 'clip' }, { id: 'tx', label: '치료 기록', icon: 'heart' }, { id: 'trend', label: '경과', icon: 'list' }], 'eval');
      const mm = [0, 1, 2, 3, 4, 5].map((v) => ({ v, l: String(v) }));
      let body;
      if (tab === 'eval') body = `<form data-submit="rh.eval" class="gap-m">${UI.note('도수근력검사(MMT): 0 움직임 없음 · 1 근육 수축만 · 2 중력 없이 움직임 · 3 중력 이기고 움직임 · 4 약한 저항 이김 · 5 정상', 'info')}
        <div class="grid2">${[['ra', '오른팔'], ['la', '왼팔'], ['rl', '오른다리'], ['ll', '왼다리']].map(([k, l]) => `<div class="q-block"><div class="q">${l} 근력</div>${pick(k, mm, '')}</div>`).join('')}</div>
        <div class="form-grid">${UI.input('berg', '균형 점수 (Berg, 0~56 — 45 미만 낙상 위험)', '', { type: 'number' })}${UI.input('mbi', '일상생활 (수정바델, 0~100)', '', { type: 'number' })}${UI.select('swallow', '삼킴', ['정상', '묽은 것 사레', '점도 조절 필요', '입으로 못 먹음 (콧줄)'], '점도 조절 필요')}${UI.select('speech', '말하기', ['정상', '발음 어눌함', '말 이해 어려움', '말 못 함'], '발음 어눌함')}</div>
        ${UI.textarea('memo', '평가 소견', '')}<div class="btn-row end">${UI.btn('평가 저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
      else if (tab === 'tx') body = `<form data-submit="rh.tx" class="gap-m">${UI.fld('치료 종류', pick('type', ['운동치료 (물리)', '작업치료', '언어치료', '삼킴 치료'], '운동치료 (물리)'))}
        ${checks('items', ['관절가동범위 운동', '근력 강화', '앉기·서기 균형 훈련', '보행 훈련 (평행봉·보행기)', '계단 훈련', '옷 입기·식사 동작 훈련', '삼킴 훈련', '발음·언어 훈련', '보호자 이동 보조 교육'])}
        <div class="form-grid">${UI.input('min', '시간 (분)', '30', { type: 'number' })}${UI.select('resp', '반응', ['잘 따라 함', '피로 호소', '통증 호소', '어지러움 — 중단'], '잘 따라 함')}${UI.input('memo', '메모', '', { cls: 'wide' })}</div>
        <div class="btn-row end">${UI.btn('치료 기록', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
      else { const ev = H.recs(p.id, 'rehab').filter((r) => r.type === '평가').reverse(); body = `${UI.table([{ h: '평가일' }, { h: '근력 오른팔·왼팔·오른다리·왼다리' }, { h: '균형' }, { h: '일상생활' }, { h: '소견' }], ev.map((r) => [`<span class="num small">${T.md(r.at)}</span>`, `<span class="num">${r.mmt.ra}·${r.mmt.la}·${r.mmt.rl}·${r.mmt.ll}</span>`, `<span class="num">${r.berg}</span> ${r.berg < 45 ? UI.chip('낙상 위험', 'prog') : ''}`, `<span class="num">${r.mbi}</span>`, `<span class="small">${esc(r.memo || '')}</span>`]))}
        <div style="margin-top:.8rem">${UI.table([{ h: '치료일' }, { h: '종류' }, { h: '내용' }, { h: '시간' }, { h: '반응' }], H.recs(p.id, 'rehab').filter((r) => r.type !== '평가').map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, esc(r.type), `<span class="small">${(r.items || []).map(esc).join(', ')}</span>`, `${r.min}분`, esc(r.resp)]), { empty: '<p class="muted small">치료 기록 없음</p>' })}</div>`; }
      return `<div class="panel">${html}<div class="panel-b">${body}</div></div>`;
    },
    acts: {
      'rh.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'rh.eval': (f, d) => { const p = A.pat(); if (['ra', 'la', 'rl', 'll'].some((k) => d[k] === '')) return UI.toast('네 팔다리 근력을 모두 고르세요', 'warn'); H.addRec('rehab', p.id, { type: '평가', mmt: { ra: Number(d.ra), la: Number(d.la), rl: Number(d.rl), ll: Number(d.ll) }, berg: H.num(d.berg), mbi: H.num(d.mbi), swallow: d.swallow, speech: d.speech, memo: d.memo }); if (H.num(d.berg) < 45) UI.toast('균형 점수 45 미만 — 병동에 낙상 고위험을 알리세요', 'warn'); else UI.toast('평가 저장', 'ok'); A.render(); },
      'rh.tx': (f, d) => { const p = A.pat(); H.addRec('rehab', p.id, { type: d.type, items: d.items || [], min: H.num(d.min), resp: d.resp, memo: d.memo }); if (d.resp.includes('중단')) H.notify('doctor', `재활 중 어지러움: ${p.name} — 치료 중단`, { patientId: p.id }); UI.toast('치료 기록', 'ok'); A.render(); },
    },
  });

  // ───────── 방사선종양 ─────────
  H.reg({
    id: 'radonc', title: '방사선종양학과', actor: '방사선종양 간호사', layout: 'patient', channels: () => ['rt'],
    list() { return { title: '방사선 치료 환자', rows: S.where('patients', (p) => p.rt).map((p) => ({ pid: p.id, encId: '', loc: `${p.rt.done}/${p.rt.fx}`, name: p.name, marks: UI.chip(`${p.rt.done * p.rt.dose}Gy`, 'purple'), sub: `${H.sexAge(p)} · ${esc(p.rt.site)}` })) }; },
    render() {
      const p = A.pat(); if (!p || !p.rt) return needPat('암 환자에게 정해진 선량의 방사선을 여러 번 나누어 쪼입니다. 간호사는 부작용(피부염·피로)을 관찰하고 교육합니다.');
      const { tab, html } = tabsOf('rt.tab', [{ id: 'plan', label: '치료 계획', icon: 'list' }, { id: 'today', label: '오늘 치료', icon: 'check' }, { id: 'side', label: '부작용 관찰·교육', icon: 'alert' }], 'plan');
      const rt = p.rt; const pct = Math.round((rt.done / rt.fx) * 100);
      let body;
      if (tab === 'plan') body = `<dl class="kv"><dt>치료 부위</dt><dd>${esc(rt.site)}</dd><dt>총 선량</dt><dd>${rt.total}Gy (그레이) / ${rt.fx}회 = 1회 ${rt.dose}Gy</dd><dt>시작일</dt><dd>${esc(rt.start)} · 월~금 매일</dd><dt>진행</dt><dd><b class="num">${rt.done}회 (${rt.done * rt.dose}Gy)</b> / ${rt.fx}회</dd></dl>
        <div style="margin-top:.8rem;background:var(--surface-3);border-radius:6px;height:1.4rem"><div style="width:${pct}%;height:100%;background:var(--accent);border-radius:6px"></div></div>
        ${UI.table([{ h: '회차' }, { h: '날짜' }, { h: '누적 선량' }, { h: '피부' }, { h: '피로' }], H.recs(p.id, 'rt').slice(0, 10).map((r) => [`<span class="num">${r.fx}</span>`, `<span class="num small">${T.md(r.at)}</span>`, `${r.cum}Gy`, `${r.skin}등급`, esc(r.fatigue || '-')]))}`;
      else if (tab === 'today') body = rt.done >= rt.fx ? UI.note('치료를 모두 마쳤습니다. 치료 종료 교육과 추적 외래를 안내하세요.', 'ok') : `<form data-submit="rt.give" class="gap-m">${UI.note(`오늘 <b>${rt.done + 1}회차</b> — ${rt.dose}Gy (누적 ${(rt.done + 1) * rt.dose}Gy 예정)`, 'info')}
        ${checks('c', ['환자 확인 (이름·생년월일·얼굴 사진 대조)', '치료 부위 피부 표시(문신·선) 확인', '고정 기구·자세 재현', '임신 가능성 없음 (가임기 여성)', '치료 중 혼자 있게 됨을 설명 — 카메라로 보고 있음'])}
        <div class="btn-row end">${UI.btn('치료 시행 기록', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
      else body = `<form data-submit="rt.side" class="gap-m">
        <div class="q-block"><div class="q">방사선 피부염 (RTOG 등급)</div>${pick('skin', [{ v: 0, l: '0 변화 없음' }, { v: 1, l: '1 약간 붉음·건조 벗겨짐' }, { v: 2, l: '2 선명한 붉음·부분 진물' }, { v: 3, l: '3 넓게 진물' }, { v: 4, l: '4 궤양·출혈' }], '')}</div>
        <div class="form-grid">${UI.select('fatigue', '피로', ['없음', '약간', '중간 (일상 일부 제한)', '심함'], '약간')}${UI.select('appetite', '식욕', ['정상', '줄어듦', '거의 못 먹음'], '정상')}${UI.input('wbc', '백혈구 (선택)', '', { type: 'number', step: '0.1' })}</div>
        ${UI.sec('피부 관리 교육')}${checks('edu', ['순한 비누로 물로만 씻고 문지르지 않기', '치료 부위 표시 지우지 않기', '면 소재 헐렁한 옷', '햇빛·뜨거운 찜질 피하기', '처방받은 보습제만, 치료 직전에는 바르지 않기', '충분한 영양·휴식'])}
        <div class="btn-row end">${UI.btn('저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
      return `<div class="panel">${html}<div class="panel-b">${body}</div></div>`;
    },
    acts: {
      'rt.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'rt.give': (f, d) => { if ((d.c || []).length < 3) return UI.toast('환자 확인·피부 표시·자세는 꼭 확인하세요', 'err'); const p = A.pat(); p.rt.done += 1; H.addRec('rt', p.id, { fx: p.rt.done, dose: p.rt.dose, cum: p.rt.done * p.rt.dose, skin: (H.recs(p.id, 'rt')[0] || {}).skin || 0 }); S.save(); H.log('방사선 치료', `${p.name} ${p.rt.done}회`, p.id); UI.toast(`${p.rt.done}회차 시행 (누적 ${p.rt.done * p.rt.dose}Gy)`, 'ok'); A.render(); },
      'rt.side': (f, d) => { if (d.skin === '') return UI.toast('피부 등급을 고르세요', 'warn'); const p = A.pat(); const last = H.recs(p.id, 'rt')[0]; if (last) { last.skin = Number(d.skin); last.fatigue = d.fatigue; } H.addRec('rtside', p.id, { skin: Number(d.skin), fatigue: d.fatigue, appetite: d.appetite, wbc: H.num(d.wbc), edu: d.edu || [] }); if (Number(d.skin) >= 3) H.notify('doctor', `방사선 피부염 ${d.skin}등급: ${p.name} — 치료 중단 여부 판단 필요`, { patientId: p.id, level: 'stat' }); UI.toast(Number(d.skin) >= 3 ? '3등급 이상 — 의사에게 알렸습니다' : '부작용 관찰 저장', Number(d.skin) >= 3 ? 'warn' : 'ok'); A.render(); },
    },
  });

  // ───────── 장기이식 코디네이터 ─────────
  const DSTEPS = [
    ['뇌사 추정자 신고', ['중환자실에서 GCS 3·자발 호흡 없음 확인', '한국장기조직기증원(가상)에 신고', '의학적 적합성 1차 확인 (감염·암 병력)']],
    ['기증 상담·가족 면담', ['조용한 상담실에서 가족 면담', '뇌사와 기증 절차 설명', '가족의 결정을 존중함 (강요 금지)']],
    ['가족 동의', ['가족 대표 동의서 서명', '기증 장기 범위 확인', '동의 철회 가능함을 설명']],
    ['1차 뇌사 조사', ['깊은 혼수·동공 고정', '뇌간 반사 모두 없음 (각막·구역·안구두부 반사 등)', '무호흡 검사']],
    ['2차 뇌사 조사 + 뇌파', ['1차 후 6시간 이상 지나 다시 조사', '뇌파 검사 — 평탄 뇌파 30분 이상']],
    ['뇌사판정위원회', ['전문의 2명 이상 포함 위원회 소집', '만장일치 뇌사 판정', '판정 시각 기록 (법적 사망 시각)']],
    ['장기 배분', ['장기이식관리센터(KONOS, 가상) 배분 요청', '혈액형·조직적합성·응급도로 수혜자 선정', '수혜자 병원·코디네이터 연락']],
    ['장기 적출 수술', ['기증자 혈역학 유지 (혈압·소변량·체온)', '수술실 일정 확정', '적출 후 장기 포장·운송']],
    ['기증자 예우·유가족 지원', ['수술 후 시신 단정히 수습', '유가족 예우·장례 지원 안내', '기증자 정보 비공개 원칙 설명']],
  ];
  const aboOk = (d, r) => { const D = d.replace(/[+-]/, ''), Rr = r.replace(/[+-]/, ''); return D === 'O' || D === Rr || Rr === 'AB'; };
  H.reg({
    id: 'transplant', title: '장기이식센터', actor: '장기이식 코디네이터', layout: 'full', channels: () => ['tx'],
    render() {
      const { tab, html } = tabsOf('tx.tab', [{ id: 'wait', label: '이식 대기자', icon: 'list' }, { id: 'donor', label: '뇌사 장기기증', icon: 'heart' }, { id: 'post', label: '이식 후 관리', icon: 'check' }], 'donor');
      const waits = S.where('patients', (p) => p.tx);
      let body;
      if (tab === 'wait') body = `${UI.note('이식 대기자는 국가 장기이식관리센터에 등록되고, 혈액형·대기 기간·응급도(간은 MELD 점수, 신장은 대기 기간·조직적합성)로 순서가 정해집니다.', 'info')}
        ${UI.table([{ h: '대기자' }, { h: '장기' }, { h: '혈액형' }, { h: '등록' }, { h: '점수' }, { h: '상태' }, { h: '' }], waits.map((p) => [`<b>${esc(p.name)}</b> <span class="small muted">${H.sexAge(p)}</span>`, esc(p.tx.organ), esc(p.tx.abo), esc(p.tx.since), p.tx.meld ? `MELD ${p.tx.meld}` : p.tx.pra != null ? `항체 반응 ${p.tx.pra}%` : '-', UI.chip(p.tx.status, p.tx.status === '대기 중' ? 'sent' : 'done'), UI.btn('검사 갱신', 'tx.update', { size: 'sm', data: { id: p.id } })]))}`;
      else if (tab === 'donor') {
        const donors = S.where('patients', (p) => p.donor);
        body = donors.map((p) => { const st = p.donor.step; const e = H.activeEnc(p.id) || {};
          return `<div class="panel"><div class="panel-h"><b>${esc(p.name)}</b> <span class="small muted">${H.sexAge(p)} · 혈액형 ${esc(p.blood)} · ${esc(e.ward || '')} ${esc(e.room || '')}</span><span class="grow"></span>${UI.chip(st >= DSTEPS.length ? '기증 완료' : `${st + 1}단계 진행 중`, st >= DSTEPS.length ? 'done' : 'prog')}</div><div class="panel-b gap-m">
            <div class="shift-bar" style="grid-template-columns:repeat(auto-fill,minmax(7.5rem,1fr))">${DSTEPS.map(([t], i) => `<div class="step ${i < st ? 'done' : i === st ? 'now' : ''}"><span class="n">${i + 1}단계</span><b>${esc(t)}</b></div>`).join('')}</div>
            ${st < DSTEPS.length ? `<form data-submit="tx.step" class="box gap-s"><input type="hidden" name="id" value="${p.id}"><h4>${st + 1}. ${esc(DSTEPS[st][0])}</h4>${checks('c', DSTEPS[st][1])}
              ${st === 6 ? `<div>${UI.sec('혈액형이 맞는 우리 병원 대기자')}${UI.table([{ h: '대기자' }, { h: '장기' }, { h: '혈액형' }, { h: '적합' }], waits.map((w) => [esc(w.name), esc(w.tx.organ), esc(w.tx.abo), aboOk(p.blood, w.tx.abo) ? UI.chip('혈액형 맞음', 'done') : UI.chip('안 맞음', 'off')]))}</div>` : ''}
              <div class="btn-row end">${UI.btn('이 단계 완료', '', { type: 'submit', kind: 'pri' })}</div></form>` : UI.note('기증 절차가 모두 끝났습니다. 기증자의 숭고한 뜻을 기립니다.', 'ok')}
            ${UI.note('뇌사 기증자 관리: 수축기 혈압 100 이상, 소변량 시간당 1~3mL/kg (요붕증 주의), 체온 36℃ 이상, 산소포화도 95% 이상 유지', 'warn')}</div></div>`; }).join('') || UI.empty('뇌사 추정자가 없습니다');
      } else body = `${UI.note('이식 후: 거부반응을 막는 면역억제제를 평생 먹고, 혈중 농도를 맞추며, 감염을 예방합니다.', 'info')}
        ${UI.table([{ h: '환자' }, { h: '장기' }, { h: '상태' }, { h: '' }], waits.filter((p) => p.tx.status !== '대기 중').map((p) => [esc(p.name), esc(p.tx.organ), UI.chip(p.tx.status, 'done'), UI.btn('관리 기록', 'tx.post', { size: 'sm', kind: 'pri', data: { id: p.id } })]), { empty: UI.empty('이식 배정·이식 후 환자가 없습니다', '뇌사 장기기증 7단계(장기 배분)를 마치면 혈액형이 맞는 대기자가 배정됩니다.') })}`;
      return `<div class="panel">${html}<div class="panel-b gap-m">${body}</div></div>`;
    },
    acts: {
      'tx.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'tx.update': (el) => { const p = H.pat(el.dataset.id); p.tx.checked = Date.now(); S.save(); UI.toast(`${p.name} 대기자 검사 갱신 기록`, 'ok'); },
      'tx.step': (f, d) => {
        const p = H.pat(d.id); const st = p.donor.step;
        if ((d.c || []).length < DSTEPS[st][1].length) return UI.toast('이 단계의 확인 항목을 모두 확인하세요', 'warn');
        if (st === 6) { S.where('patients', (w) => w.tx && w.tx.status === '대기 중' && aboOk(p.blood, w.tx.abo)).forEach((w) => { w.tx.status = `이식 배정 (기증자 ${p.blood})`; }); }
        p.donor.step += 1; p.donor[`s${st}`] = { at: Date.now(), by: H.who() }; S.save();
        H.log('장기기증 단계', `${p.name} ${DSTEPS[st][0]}`, p.id); UI.toast(`${DSTEPS[st][0]} 완료`, 'ok'); A.render();
      },
      'tx.post': (el) => { const p = H.pat(el.dataset.id); UI.modal({ title: `이식 후 관리 — ${p.name}`, body: `<form data-submit="tx.postGo" class="gap-m"><input type="hidden" name="id" value="${p.id}">${UI.input('fk', '타크로리무스 혈중 농도 (목표 5~10 ng/mL)', '', { type: 'number', step: '0.1' })}${checks('c', ['거부반응 증상 없음 (열·이식 부위 통증·소변량 감소)', '감염 증상 없음', '면역억제제 정해진 시간 복용 교육', '자몽 주스 피하기 (약 농도 변화)', '마스크·손 위생'])}<div class="btn-row end">${UI.btn('저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` }); },
      'tx.postGo': (f, d) => { const p = H.pat(d.id); const v = H.num(d.fk); H.addRec('txpost', p.id, { fk: v, checks: d.c || [] }); UI.close(); UI.toast(v != null && (v < 5 || v > 10) ? `농도 ${v} — 목표 범위 밖, 의사에게 보고` : '이식 후 관리 기록', v != null && (v < 5 || v > 10) ? 'warn' : 'ok'); },
    },
  });

  // ───────── 영양집중지원 (NST) ─────────
  function nstRisk() {
    return S.where('encounters', (e) => e.type === 'IPD' && e.status === '입원중').map((e) => {
      const p = H.pat(e.patientId); const why = [];
      const n = H.lastAssess(p.id, 'nutri'); if (n && n.score >= 1) why.push('영양 선별 위험');
      const alb = H.flow.lastLab(p.id, 'Alb'); if (alb && alb.v < 3.0) why.push(`알부민 ${alb.v}`);
      if (/금식|NPO/.test(e.diet || '') && Date.now() - e.at > 3 * DAY) why.push('3일 넘게 금식');
      if (/경관|위관/.test(e.diet || '')) why.push('경관 영양');
      if (e.ward === 'ICU') why.push('중환자');
      return { e, p, why };
    }).filter((x) => x.why.length);
  }
  H.reg({
    id: 'nst', title: '영양집중지원팀 (NST)', actor: '영양 전담 간호사', layout: 'full', channels: () => ['nst'],
    render() {
      const { tab, html } = tabsOf('nst.tab', [{ id: 'risk', label: '영양 위험 환자', icon: 'alert' }, { id: 'diet', label: '식이 처방·배식 집계', icon: 'list' }, { id: 'log', label: '상담 기록', icon: 'doc' }], 'risk');
      let body;
      if (tab === 'risk') body = `${UI.note('영양집중지원팀(의사·간호사·약사·영양사): 영양 위험 환자를 찾아 필요 열량과 단백질을 계산하고, 입·콧줄·정맥 중 알맞은 영양 방법을 권고합니다.', 'info')}
        ${UI.table([{ h: '환자' }, { h: '위치' }, { h: '위험 이유' }, { h: '식이' }, { h: 'NST' }, { h: '' }], nstRisk().map(({ e, p, why }) => { const last = H.recs(p.id, 'nst')[0]; return [`<b>${esc(p.name)}</b> <span class="small muted">${H.sexAge(p)} · ${p.weight}kg</span>`, `${esc(e.ward)} ${esc(e.room)}`, why.map((w) => UI.chip(w, 'prog')).join(' '), esc(e.diet || '-'), last ? `<span class="small">${esc(last.route)} ${last.kcal}kcal</span>` : '-', UI.btn('NST 평가', 'nst.eval', { size: 'sm', kind: 'pri', data: { id: p.id } })]; }), { empty: UI.empty('영양 위험 환자가 없습니다') })}`;
      else if (tab === 'diet') { const by = {}; S.where('encounters', (e) => e.type === 'IPD' && e.status === '입원중').forEach((e) => { const k = `${e.ward}|${e.diet || '미지정'}`; by[k] = (by[k] || 0) + 1; });
        body = `${UI.note('영양팀 배식 집계: 병동별로 어떤 식이가 몇 개 필요한지 끼니마다 집계합니다. 금식 환자는 빼고, 치료식(당뇨식·저염식)은 따로 조리합니다.', 'info')}${UI.table([{ h: '병동' }, { h: '식이' }, { h: '인원', cls: 'num' }], Object.entries(by).sort().map(([k, n]) => { const [w, dname] = k.split('|'); return [esc(w), esc(dname), `<span class="num">${n}명</span>`]; }))}`; }
      else body = UI.table([{ h: '일시' }, { h: '환자' }, { h: '필요 열량' }, { h: '단백질' }, { h: '방법' }, { h: '권고' }], S.where('recs', (r) => r.kind === 'nst').sort((a, b) => b.at - a.at).map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, esc(H.pat(r.patientId).name), `${r.kcal}kcal`, `${r.prot}g`, esc(r.route), `<span class="small">${esc(r.memo || '')}</span>`]), { empty: UI.empty('기록이 없습니다') });
      return `<div class="panel">${html}<div class="panel-b gap-m">${body}</div></div>`;
    },
    acts: {
      'nst.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'nst.eval': (el) => {
        const p = H.pat(el.dataset.id); const bmi = (p.weight / (p.height / 100) ** 2).toFixed(1);
        UI.modal({ title: `영양 평가 — ${p.name}`, body: `<form data-submit="nst.save" class="gap-m"><input type="hidden" name="id" value="${p.id}">
          <dl class="kv"><dt>키·체중</dt><dd>${p.height}cm · ${p.weight}kg</dd><dt>체질량지수</dt><dd>${bmi} ${bmi < 18.5 ? UI.chip('저체중', 'stat') : ''}</dd><dt>필요 열량 (25~30kcal/kg)</dt><dd class="num">${Math.round(p.weight * 25)} ~ ${Math.round(p.weight * 30)} kcal/일</dd><dt>필요 단백질 (1.2~1.5g/kg)</dt><dd class="num">${Math.round(p.weight * 1.2)} ~ ${Math.round(p.weight * 1.5)} g/일</dd></dl>
          <div class="form-grid">${UI.input('kcal', '권고 열량 (kcal)', Math.round(p.weight * 27), { type: 'number' })}${UI.input('prot', '권고 단백질 (g)', Math.round(p.weight * 1.3), { type: 'number' })}</div>
          ${UI.fld('영양 방법', pick('route', ['입으로 + 보충 음료', '경관 영양 (콧줄)', '말초 정맥 영양', '중심 정맥 영양 (TPN)'], '입으로 + 보충 음료'))}
          ${UI.textarea('memo', '권고 내용 (주치의에게)', '', { h: '3rem' })}<div class="btn-row end">${UI.btn('권고 저장·주치의 알림', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` });
      },
      'nst.save': (f, d) => { const p = H.pat(d.id); H.addRec('nst', p.id, { kcal: H.num(d.kcal), prot: H.num(d.prot), route: d.route, memo: d.memo }); H.notify('doctor', `NST 권고: ${p.name} — ${d.route}, ${d.kcal}kcal·단백질 ${d.prot}g`, { patientId: p.id }); H.log('NST 평가', p.name, p.id); UI.close(); UI.toast('NST 권고를 주치의에게 보냈습니다', 'ok'); A.render(); },
    },
  });
})();
