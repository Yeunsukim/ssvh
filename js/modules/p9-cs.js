// 고객관리실 — 고객의 소리(VOC), 직원의 소리(VOE), 고객관계관리(CRM), 환자경험평가
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const DAY = 86400000;
  const ms = (k, d) => A.ms(k, d); const set = (k, v) => A.set(k, v);
  const pick = (name, opts, v) => UI.pick(name, opts.map((x) => (typeof x === 'object' ? x : { v: x, l: x })), v);
  const checks = (name, list, on = []) => `<div class="gap-s">${list.map((t) => UI.check(name, t, on.includes(t), { multi: true, value: t })).join('')}</div>`;
  const recs = (kind, fn) => S.where('recs', (r) => r.kind === kind && (!fn || fn(r))).sort((a, b) => b.at - a.at);
  const patOpts = (empty) => [{ v: '', l: empty || '— 환자 아님 / 모름 —' }].concat(S.all('patients').map((p) => ({ v: p.id, l: `${p.name} (${p.mrn})` })));
  const bars = (rows) => { const mx = Math.max(1, ...rows.map((r) => r[1])); return `<div class="gap-s">${rows.map(([l, n, tone]) => `<div class="row" style="flex-wrap:nowrap;gap:.6rem"><span style="width:9rem;flex:none" class="small">${esc(l)}</span><span style="flex:1;background:var(--surface-3);border-radius:4px;height:1.4rem;position:relative"><span style="position:absolute;inset:0 auto 0 0;width:${(n / mx) * 100}%;background:var(--${tone || 'accent'});border-radius:4px"></span></span><b class="num" style="width:3.5rem;text-align:right">${n}</b></div>`).join('')}</div>`; };
  const selList = (act, list, cur, line) => `<div class="gap-s">${list.map((r) => `<button class="prow ${cur && r.id === cur.id ? 'on' : ''}" style="border:1px solid var(--line);border-radius:6px" data-act="${act}" data-id="${r.id}">${line(r)}</button>`).join('') || '<p class="muted small">없음</p>'}</div>`;

  // ═════════ 고객의 소리 (VOC) ═════════
  const CH = ['전화', '방문 (고객상담실)', '홈페이지', '고객의 소리함 (엽서)', '국민신문고·보건소 이첩'];
  const TYPE = ['불만', '칭찬', '제안', '문의'];
  const AREA = ['친절·태도', '진료·설명', '간호', '대기 시간', '수납·비용', '예약', '시설·환경', '주차', '식사', '안전 (낙상·감염 등)'];
  const DEPTS = [['7A 내과 병동', 'ward:7A'], ['8B 외과 병동', 'ward:8B'], ['응급실', 'ward:ER'], ['외래 간호', 'opd'], ['원무팀', 'billing'], ['약제부', 'pharmacy'], ['진단검사의학과', 'lab'], ['영상의학과', 'rad'], ['예약센터', 'appt'], ['영양팀', 'nst'], ['시설팀', ''], ['진료과 (의사)', 'doctor']];
  const STEP = ['접수', '부서 이관', '부서 답변', '고객 회신', '종결'];
  const due = (r) => r.at + (r.urgent ? DAY : 7 * DAY);
  const late = (r) => r.status !== '종결' && Date.now() > due(r);
  const vocChip = (r) => `${UI.chip(r.type, r.type === '불만' ? 'stat' : r.type === '칭찬' ? 'done' : r.type === '제안' ? 'purple' : 'sent')}${r.urgent ? ' ' + UI.chip('긴급', 'stat') : ''}${late(r) ? ' ' + UI.chip('기한 넘음', 'prog') : ''}`;
  const hist = (r, s, memo) => { r.status = s; (r.hist = r.hist || []).push({ s, at: Date.now(), by: H.who(), memo: memo || '' }); S.save(); };

  function vocDetail(r) {
    const p = r.pid ? H.pat(r.pid) : null; const i = STEP.indexOf(r.status);
    let form = '';
    if (r.status === '접수') form = r.type === '칭찬' ? `<form data-submit="voc.praise" class="gap-m"><input type="hidden" name="id" value="${r.id}">${UI.input('staff', '칭찬 받은 직원 (부서·이름)', r.staff || '')}${UI.select('dept', '소속 부서', DEPTS.map((d) => d[0]), DEPTS[0][0])}${checks('c', ['부서장에게 칭찬 내용 전달', '이달의 친절 직원 후보 추천', '고객에게 감사 회신'])}<div class="btn-row end">${UI.btn('칭찬 전달 → 종결', '', { type: 'submit', kind: 'pri' })}</div></form>`
      : `<form data-submit="voc.send" class="gap-m"><input type="hidden" name="id" value="${r.id}">${UI.select('dept', '담당 부서로 이관', DEPTS.map((d) => d[0]), r.dept || DEPTS[0][0])}${UI.textarea('memo', '이관 메모 (사실 확인 요청 사항)', `${r.area} 관련 고객 의견입니다. 사실 확인과 개선 방안을 ${r.urgent ? '24시간' : '3일'} 안에 회신해 주세요.`, { h: '3rem' })}<div class="btn-row end">${r.type === '문의' ? UI.btn('바로 답변하고 종결', 'voc.quick', { data: { id: r.id } }) : ''}${UI.btn('부서 이관', '', { type: 'submit', kind: 'pri' })}</div></form>`;
    else if (r.status === '부서 이관') form = `<form data-submit="voc.reply" class="gap-m"><input type="hidden" name="id" value="${r.id}">${UI.note(`${esc(r.dept)}의 답변을 기다리는 중입니다. 실습에서는 부서 담당자 역할로 답변을 직접 넣습니다.`, 'info')}${UI.textarea('fact', '사실 확인 결과', '', { h: '3rem', ph: '당시 상황, 관련 직원 면담 내용' })}${UI.textarea('act', '개선 조치', '', { h: '3rem', ph: '재발 방지 대책, 교육, 절차 변경' })}<div class="btn-row end">${UI.btn('답변 예시', 'voc.ex', { data: { id: r.id } })}${UI.btn('부서 답변 등록', '', { type: 'submit', kind: 'pri' })}</div></form>`;
    else if (r.status === '부서 답변') form = `<form data-submit="voc.callback" class="gap-m"><input type="hidden" name="id" value="${r.id}">${UI.fld('회신 방법', pick('how', ['전화', '문자', '서면 (우편)', '이메일'], '전화'))}${UI.textarea('text', '고객에게 회신하는 내용', `${r.name || '고객'}님, 말씀해 주신 ${r.area} 관련 불편을 드려 죄송합니다. 확인 결과 ${r.reply.fact} 앞으로 ${r.reply.act}`, { h: '5rem' })}<div class="q-block"><div class="q">고객 반응</div>${pick('sat', ['만족', '보통', '불만족 (재조사 요청)'], '만족')}</div><div class="btn-row end">${UI.btn('회신 기록', '', { type: 'submit', kind: 'pri' })}</div></form>`;
    else if (r.status === '고객 회신') form = `<div class="gap-m">${r.callback.sat.startsWith('불만족') ? UI.note('고객이 회신에 만족하지 않았습니다 — 부서에 재조사를 요청하거나 상위 관리자 면담을 잡습니다.', 'warn') : ''}<div class="btn-row end">${r.callback.sat.startsWith('불만족') ? UI.btn('재조사 요청 (부서 다시 이관)', 'voc.redo', { data: { id: r.id } }) : ''}${UI.btn('종결', 'voc.close', { kind: 'pri', data: { id: r.id } })}</div></div>`;
    return `<div class="gap-m"><div class="row between"><div><b class="mono">${esc(r.no)}</b> ${vocChip(r)}</div><span class="small muted">처리 기한 ${T.mdhm(due(r))}</span></div>
      <div class="row">${STEP.map((s, k) => `${k ? '<span class="muted">→</span>' : ''}${UI.chip(s, k <= i ? 'done' : 'plain')}`).join(' ')}</div>
      <div class="box"><dl class="kv"><dt>고객</dt><dd>${esc(r.name || '-')} ${p ? `(${esc(p.mrn)})` : ''} · ${esc(r.phone || '')}</dd><dt>경로·분야</dt><dd>${esc(r.ch)} · ${esc(r.area)}</dd><dt>내용</dt><dd style="white-space:pre-wrap">${esc(r.content)}</dd>${r.dept ? `<dt>담당 부서</dt><dd>${esc(r.dept)}</dd>` : ''}${r.reply ? `<dt>부서 답변</dt><dd>${esc(r.reply.fact)}<br><b>개선:</b> ${esc(r.reply.act)}</dd>` : ''}${r.callback ? `<dt>고객 회신</dt><dd>${esc(r.callback.how)} · ${esc(r.callback.sat)}</dd>` : ''}${r.staff ? `<dt>칭찬 직원</dt><dd>${esc(r.staff)}</dd>` : ''}</dl></div>
      ${form}
      <details><summary class="small">처리 이력 ${(r.hist || []).length}건</summary>${UI.table([{ h: '시각' }, { h: '단계' }, { h: '처리자' }, { h: '메모' }], (r.hist || []).map((h) => [`<span class="num small">${T.mdhm(h.at)}</span>`, esc(h.s), `<span class="small">${esc(h.by)}</span>`, `<span class="small">${esc(h.memo)}</span>`]))}</details></div>`;
  }
  function vocNew() {
    return `<form data-submit="voc.new" class="gap-m">${UI.note('고객의 말을 끊지 않고 끝까지 듣고(경청), 공감한 뒤, 사실만 적습니다. 직원 이름을 함부로 말하지 않고, 처리 절차와 회신 날짜를 안내합니다.', 'info')}
      <div class="form-grid">${UI.select('ch', '접수 경로', CH, CH[0])}${UI.select('pid', '환자 (등록된 경우)', patOpts(), '')}${UI.input('name', '고객 이름 (보호자면 관계도)', '')}${UI.input('phone', '연락처', '')}</div>
      ${UI.fld('유형', pick('type', TYPE, '불만'))}${UI.fld('분야', pick('area', AREA, '대기 시간'))}
      ${UI.textarea('content', '내용 (언제·어디서·무엇이·어떻게)', '', { h: '6rem' })}
      ${UI.check('urgent', '긴급 — 환자 안전·법적 문제·언론 제보 가능성 (24시간 안 처리)', false)}
      <div class="btn-row end">${UI.btn('예시 불러오기', 'voc.fill')}${UI.btn('접수', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
  }
  function vocStats() {
    const l = recs('voc'); const done = l.filter((r) => r.status === '종결'); const ontime = done.filter((r) => (r.hist || []).slice(-1)[0].at <= due(r)).length;
    const avg = done.length ? (done.reduce((s, r) => s + ((r.hist || []).slice(-1)[0].at - r.at), 0) / done.length / DAY).toFixed(1) : '-';
    const cnt = (key, vals) => vals.map((v) => [v, l.filter((r) => r[key] === v).length]).filter((x) => x[1]);
    return `<div class="gap-m"><div class="row">${UI.chip(`전체 ${l.length}건`, 'plain')} ${UI.chip(`처리 중 ${l.length - done.length}건`, 'prog')} ${UI.chip(`평균 처리 ${avg}일`, 'sent')} ${UI.chip(`기한 안 처리율 ${done.length ? Math.round((ontime / done.length) * 100) : '-'}%`, 'done')}</div>
      <div class="grid2"><div class="box"><h4>유형별</h4>${bars(cnt('type', TYPE).map(([a, b]) => [a, b, a === '칭찬' ? 't-done' : a === '불만' ? 't-stat' : 'accent']))}</div><div class="box"><h4>분야별</h4>${bars(cnt('area', AREA))}</div></div>
      <div class="box"><h4>부서별 (이관 기준)</h4>${bars(DEPTS.map((d) => [d[0], l.filter((r) => r.dept === d[0]).length]).filter((x) => x[1]))}</div>
      ${UI.note('VOC 통계는 매달 고객만족위원회에 보고하고, 같은 분야 불만이 반복되면 개선 과제(QI)로 등록합니다.', 'info')}</div>`;
  }
  H.reg({
    id: 'cs-voc', title: '고객의 소리 (VOC)', actor: '고객관리실 상담원', layout: 'full', channels: () => ['cs'],
    render() {
      const tab = ms('tab', 'list'); const f = ms('f', 'open');
      const all = recs('voc'); const l = all.filter((r) => f === 'all' || (f === 'open' ? r.status !== '종결' : r.status === '종결'));
      const cur = all.find((r) => r.id === ms('sel', '')) || l[0];
      const body = tab === 'new' ? vocNew() : tab === 'stat' ? vocStats() : `<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,1.6fr)"><div class="gap-s">${UI.seg('voc.f', [{ v: 'open', l: `처리 중 ${all.filter((r) => r.status !== '종결').length}` }, { v: 'done', l: '종결' }, { v: 'all', l: '전체' }], f)}
        ${selList('voc.sel', l, cur, (r) => `<span class="loc">${esc(r.status)}</span><span class="nm">${esc(r.name || '익명')}</span><span class="mk">${vocChip(r)}</span><span class="sub">${esc(r.area)} · ${T.md ? T.md(r.at) : T.mdhm(r.at)} · ${esc(r.content.slice(0, 28))}…</span>`)}</div>
        <div class="box" style="background:var(--surface)">${cur ? vocDetail(cur) : UI.empty('고를 VOC가 없습니다')}</div></div>`;
      return `<div class="panel">${UI.tabs('voc.tab', [{ id: 'list', label: 'VOC 처리', cnt: all.filter((r) => r.status !== '종결').length || '' }, { id: 'new', label: '새 VOC 접수', icon: 'plus' }, { id: 'stat', label: '통계' }], tab)}<div class="panel-b">${body}</div></div>`;
    },
    acts: {
      'voc.tab': (el) => { set('tab', el.dataset.v); A.render(); }, 'voc.f': (el) => { set('f', el.dataset.v); set('sel', ''); A.render(); }, 'voc.sel': (el) => { set('sel', el.dataset.id); A.render(); },
      'voc.fill': (el) => { const f = el.closest('form'); f.querySelector('[name=name]').value = '김보호 (환자 딸)'; f.querySelector('[name=phone]').value = '010-5512-33xx'; f.querySelector('[name=content]').value = '어제 오후 2시 내과 외래 예약이었는데 1시간 40분을 기다렸습니다. 늦어진다는 안내도 없었고, 물어보니 "기다리세요"라고만 해서 기분이 상했습니다.'; },
      'voc.new': (f, d) => {
        if (!d.content) return UI.toast('내용을 써 주세요', 'warn');
        const n = recs('voc').length + 1; const p = d.pid ? H.pat(d.pid) : null;
        const r = H.addRec('voc', d.pid || null, { no: `VOC-${T.d(Date.now()).slice(2, 7).replace('-', '')}-${String(n).padStart(3, '0')}`, ch: d.ch, type: d.type, area: d.area, name: d.name || (p ? p.name : ''), phone: d.phone || (p ? p.phone : ''), content: d.content, urgent: !!d.urgent, status: '접수', hist: [{ s: '접수', at: Date.now(), by: H.who(), memo: d.ch }] });
        if (d.urgent) H.notify('qi', `긴급 VOC 접수: ${r.area} — ${d.content.slice(0, 40)}`, { level: 'stat' });
        set('tab', 'list'); set('f', 'open'); set('sel', r.id); UI.toast(`${r.no} 접수 — 처리 기한 ${d.urgent ? '24시간' : '7일'}`, 'ok'); A.render();
      },
      'voc.send': (f, d) => { const r = S.get('recs', d.id); r.dept = d.dept; hist(r, '부서 이관', d.memo); const ch = (DEPTS.find((x) => x[0] === d.dept) || [])[1]; if (ch) H.notify(ch, `고객의 소리 이관 ${r.no}: ${r.area} — 사실 확인·개선 방안 회신 요청`, { patientId: r.patientId, level: r.urgent ? 'stat' : '' }); UI.toast(`${d.dept}에 이관했습니다`, 'ok'); A.render(); },
      'voc.quick': (el) => { const r = S.get('recs', el.dataset.id); r.callback = { how: '전화', sat: '만족', text: '문의 내용 바로 안내' }; hist(r, '종결', '문의 — 바로 답변'); A.render(); },
      'voc.ex': (el) => { const f = el.closest('form'); f.querySelector('[name=fact]').value = '당일 앞 환자 진료가 길어져 평균 대기 70분이었고, 지연 안내 방송과 대기 시간 표시를 하지 않았습니다.'; f.querySelector('[name=act]').value = '30분 넘게 늦어지면 대기 환자에게 직접 안내하고, 진료실 앞 화면에 예상 대기 시간을 표시하겠습니다. 외래 간호사 응대 교육을 했습니다.'; },
      'voc.reply': (f, d) => { if (!d.fact || !d.act) return UI.toast('사실 확인과 개선 조치를 모두 써 주세요', 'warn'); const r = S.get('recs', d.id); r.reply = { fact: d.fact, act: d.act, by: H.who() }; hist(r, '부서 답변'); UI.toast('부서 답변 등록 — 고객에게 회신하세요', 'ok'); A.render(); },
      'voc.callback': (f, d) => { const r = S.get('recs', d.id); r.callback = { how: d.how, text: d.text, sat: d.sat }; hist(r, '고객 회신', `${d.how} · ${d.sat}`); if (d.how === '문자') H.addRec('sms', r.patientId, { to: `${r.name} ${r.phone}`, text: `[SSV병원 고객관리실] ${d.text}` }); UI.toast('회신 기록', 'ok'); A.render(); },
      'voc.redo': (el) => { const r = S.get('recs', el.dataset.id); r.reply = null; r.callback = null; hist(r, '부서 이관', '고객 불만족 — 재조사'); A.render(); },
      'voc.close': (el) => { const r = S.get('recs', el.dataset.id); hist(r, '종결'); UI.toast('종결 — 통계에 반영됩니다', 'ok'); set('sel', ''); A.render(); },
      'voc.praise': (f, d) => { if (!d.staff) return UI.toast('칭찬 받은 직원을 써 주세요', 'warn'); const r = S.get('recs', d.id); r.staff = d.staff; r.dept = d.dept; const ch = (DEPTS.find((x) => x[0] === d.dept) || [])[1]; if (ch) H.notify(ch, `칭찬 VOC ${r.no}: ${d.staff} — "${r.content.slice(0, 40)}…"`, {}); hist(r, '종결', `칭찬 전달: ${d.staff}`); UI.toast('칭찬을 부서에 전달했습니다', 'ok'); A.render(); },
    },
  });

  // ═════════ 직원의 소리 (VOE) ═════════
  const VAREA = ['업무 절차·효율', '전산 (HIS)', '근무 환경·안전', '복지·처우', '교육·성장', '소통·조직 문화'];
  const VSTEP = ['접수', '검토 중', '채택', '실행 완료'];
  const SURVEY = [['직무 만족', 3.6, 3.4], ['업무량 적정', 2.9, 3.1], ['상사·동료 관계', 3.9, 3.7], ['보상·복지', 3.0, 3.2], ['교육·성장 기회', 3.5, 3.3], ['병원 자부심', 3.8, 3.6], ['안전한 근무 환경', 3.3, 3.4]];
  H.reg({
    id: 'cs-voe', title: '직원의 소리 (VOE)', actor: '고객관리실 담당자', layout: 'full', channels: () => ['cs'],
    render() {
      const tab = ms('tab', 'list'); const all = recs('voe'); const cur = all.find((r) => r.id === ms('sel', '')) || all[0];
      let body;
      if (tab === 'new') body = `<form data-submit="voe.new" class="gap-m">${UI.note('직원의 소리: 직원이 현장에서 느낀 불편·제안을 모아 병원 운영을 개선합니다. 익명을 지켜 주고, 결과를 꼭 공유해야 다음 제안이 나옵니다.', 'info')}${UI.input('title', '제목', '')}${UI.fld('분야', pick('area', VAREA, VAREA[0]))}${UI.textarea('content', '내용 (현재 문제 → 개선 아이디어 → 기대 효과)', '', { h: '6rem' })}${UI.check('anon', '익명으로 제출', true)}<div class="btn-row end">${UI.btn('예시', 'voe.fill')}${UI.btn('제출', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
      else if (tab === 'survey') body = `<div class="gap-m">${UI.note('직원 만족도 조사 (5점 척도, 가상 결과) — 고객 만족은 직원 만족에서 시작합니다. 점수가 낮은 영역은 개선 과제로 정합니다.', 'info')}${UI.table([{ h: '영역' }, { h: '올해' }, { h: '작년' }, { h: '변화' }], SURVEY.map(([a, y, p]) => [esc(a), `<b class="num">${y.toFixed(1)}</b>`, `<span class="num">${p.toFixed(1)}</span>`, y >= p ? UI.chip(`▲ ${(y - p).toFixed(1)}`, 'done') : UI.chip(`▼ ${(p - y).toFixed(1)}`, 'stat')]))}</div>`;
      else body = `<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,1.6fr)">${selList('voe.sel', all, cur, (r) => `<span class="loc">${esc(r.status)}</span><span class="nm">${esc(r.title)}</span><span class="sub">${esc(r.area)} · ${r.anon ? '익명' : esc(r.by)}</span>`)}
        <div class="box" style="background:var(--surface)">${cur ? `<div class="gap-m"><div class="row between"><b>${esc(cur.title)}</b>${UI.chip(cur.status, cur.status === '불채택' ? 'off' : cur.status === '실행 완료' ? 'done' : 'prog')}</div><div class="row">${VSTEP.map((s, k) => `${k ? '<span class="muted">→</span>' : ''}${UI.chip(s, k <= VSTEP.indexOf(cur.status) ? 'done' : 'plain')}`).join(' ')}</div>
          <p style="white-space:pre-wrap;margin:0">${esc(cur.content)}</p>${cur.review ? UI.note(`검토 결과: ${esc(cur.review.result)} — ${esc(cur.review.reason)}`, cur.review.result === '채택' ? 'ok' : 'info') : ''}${cur.done ? UI.note(`실행 결과: ${esc(cur.done)}`, 'ok') : ''}
          ${cur.status === '접수' ? UI.btn('검토 시작 (관련 부서 의견 요청)', 'voe.review', { kind: 'pri', data: { id: cur.id } }) : cur.status === '검토 중' ? `<form data-submit="voe.decide" class="gap-s"><input type="hidden" name="id" value="${cur.id}">${pick('result', ['채택', '보류', '불채택'], '채택')}${UI.input('reason', '검토 의견', '')}${UI.btn('검토 결과 등록', '', { type: 'submit', kind: 'pri' })}</form>` : cur.status === '채택' ? `<form data-submit="voe.done" class="gap-s"><input type="hidden" name="id" value="${cur.id}">${UI.input('text', '실행 결과 (언제부터 무엇이 바뀌었나)', '')}${checks('c', ['제안자에게 결과 알림', '전 직원 게시판 공유', '우수 제안 포상 추천'])}${UI.btn('실행 완료', '', { type: 'submit', kind: 'pri' })}</form>` : ''}</div>` : UI.empty('제안이 없습니다')}</div></div>`;
      return `<div class="panel">${UI.tabs('voe.tab', [{ id: 'list', label: '제안 처리', cnt: all.filter((r) => ['접수', '검토 중'].includes(r.status)).length || '' }, { id: 'new', label: '새 제안', icon: 'plus' }, { id: 'survey', label: '직원 만족도' }], tab)}<div class="panel-b">${body}</div></div>`;
    },
    acts: {
      'voe.tab': (el) => { set('tab', el.dataset.v); A.render(); }, 'voe.sel': (el) => { set('sel', el.dataset.id); A.render(); },
      'voe.fill': (el) => { const f = el.closest('form'); f.querySelector('[name=title]').value = '투약 기록 화면에서 바코드 확인 후 저장 버튼이 너무 멀어요'; f.querySelector('[name=content]').value = '현재: 바코드 확인 뒤 화면을 내려야 저장 버튼이 있어 바쁜 시간에 저장을 빠뜨립니다.\n개선: 확인이 끝나면 저장 버튼을 바로 옆에 크게 표시.\n기대 효과: 투약 기록 누락 감소.'; },
      'voe.new': (f, d) => { if (!d.title || !d.content) return UI.toast('제목과 내용을 써 주세요', 'warn'); const r = H.addRec('voe', null, { title: d.title, area: d.area, content: d.content, anon: !!d.anon, status: '접수' }); set('tab', 'list'); set('sel', r.id); UI.toast('제안 접수 — 2주 안에 검토 결과를 알려 드립니다', 'ok'); A.render(); },
      'voe.review': (el) => { const r = S.get('recs', el.dataset.id); r.status = '검토 중'; S.save(); A.render(); },
      'voe.decide': (f, d) => { const r = S.get('recs', d.id); r.review = { result: d.result, reason: d.reason || '-' }; r.status = d.result === '채택' ? '채택' : d.result === '불채택' ? '불채택' : '검토 중'; S.save(); UI.toast(`검토 결과: ${d.result}`, 'ok'); A.render(); },
      'voe.done': (f, d) => { if (!d.text) return UI.toast('실행 결과를 써 주세요', 'warn'); const r = S.get('recs', d.id); r.done = d.text; r.status = '실행 완료'; S.save(); UI.toast('실행 완료 — 결과를 공유했습니다', 'ok'); A.render(); },
    },
  });

  // ═════════ 고객관계관리 (CRM) ═════════
  const recentDis = () => S.where('encounters', (e) => e.type === 'IPD' && e.status === '퇴원' && (e.endAt || e.at) > Date.now() - 30 * DAY);
  function crm360(p) {
    const c = p.crm || {}; const enc = S.where('encounters', (e) => e.patientId === p.id).sort((a, b) => b.at - a.at);
    const ap = S.where('appts', (a) => a.pid === p.id); const voc = recs('voc', (r) => r.patientId === p.id); const hc = recs('happy', (r) => r.patientId === p.id);
    const grade = enc.length >= 4 ? '단골 고객' : voc.some((r) => r.type === '불만' && r.status !== '종결') ? '관심 고객 (불만 처리 중)' : enc.length ? '일반 고객' : '신규 고객';
    return `<div class="gap-m"><div class="row between"><div><b style="font-size:1.2rem">${esc(p.name)}</b> <span class="muted">${H.sexAge(p)} · ${esc(p.mrn)} · ${esc(p.phone || '')}</span></div>${UI.chip(grade, grade.startsWith('관심') ? 'stat' : grade.startsWith('단골') ? 'done' : 'plain')}</div>
      <form data-submit="crm.save" class="box gap-s"><input type="hidden" name="pid" value="${p.id}"><div class="form-grid">${UI.select('prefer', '선호 연락 방법', ['문자', '전화', '알림톡', '이메일', '보호자에게'], c.prefer || '문자')}${UI.input('best', '연락하기 좋은 시간', c.best || '오후')}</div>
        <div class="row">${UI.check('sms', '진료 안내 문자 수신 동의', c.sms !== false)}${UI.check('mkt', '건강 정보·행사 안내 수신 동의 (선택)', !!c.mkt)}</div>${UI.input('memo', '고객 특이사항 (응대 시 참고)', c.memo || '')}<div class="btn-row end">${UI.btn('고객 정보 저장', '', { type: 'submit', kind: 'pri' })}</div></form>
      <div class="grid2"><div class="box"><h4>방문 이력 ${enc.length}회</h4>${enc.slice(0, 6).map((e) => `<div class="small">${T.mdhm(e.at)} · ${e.type === 'OPD' ? '외래' : e.type === 'ER' ? '응급' : '입원'} ${esc(e.dept)} · ${esc(e.status)}</div>`).join('') || '<p class="muted small">없음</p>'}</div>
        <div class="box"><h4>예약 ${ap.length}건</h4>${ap.slice(0, 6).map((a) => `<div class="small">${esc(a.date)} ${esc(a.time)} · ${esc(a.dept)} · ${esc(a.status)}</div>`).join('') || '<p class="muted small">없음</p>'}</div>
        <div class="box"><h4>고객의 소리 ${voc.length}건</h4>${voc.map((r) => `<div class="small">${esc(r.no)} ${esc(r.type)} · ${esc(r.area)} · ${esc(r.status)}</div>`).join('') || '<p class="muted small">없음</p>'}</div>
        <div class="box"><h4>해피콜 ${hc.length}건</h4>${hc.map((r) => `<div class="small">${T.mdhm(r.at)} · ${esc(r.result)} · ${esc(r.health || '')}</div>`).join('') || '<p class="muted small">없음</p>'}</div></div></div>`;
  }
  const TARGETS = { revisit: '6개월 넘게 안 온 만성질환 환자 (재방문 안내)', checkup: '40세 이상 — 국가 건강검진 안내', dis: '최근 30일 퇴원 환자 — 건강 강좌 안내', all: '마케팅 수신 동의 고객 전체 — 병원 소식' };
  function targetList(k) {
    const ps = S.all('patients');
    if (k === 'revisit') return ps.filter((p) => /고혈압|당뇨|COPD|심부전/.test(p.hx || '') && !S.where('encounters', (e) => e.patientId === p.id && e.at > Date.now() - 180 * DAY).length);
    if (k === 'checkup') return ps.filter((p) => H.age(p.birth) >= 40).slice(0, 15);
    if (k === 'dis') return recentDis().map((e) => H.pat(e.patientId));
    return ps.filter((p) => p.crm && p.crm.mkt);
  }
  H.reg({
    id: 'cs-crm', title: '고객관계관리 (CRM)', actor: '고객관리실 담당자', layout: 'full', channels: () => ['cs'],
    render() {
      const tab = ms('tab', 'happy'); let body;
      if (tab === '360') { const pid = ms('pid', S.all('patients')[0].id); const p = H.pat(pid); body = `<div class="gap-m"><form class="row" data-submit="crm.pick">${UI.select('pid', '고객(환자) 조회', patOpts('— 고르세요 —').slice(1), pid)}${UI.btn('조회', '', { type: 'submit', kind: 'pri' })}</form>${p ? crm360(p) : ''}</div>`; }
      else if (tab === 'camp') { const k = ms('tg', 'revisit'); const tl = targetList(k); const sent = recs('campaign');
        body = `<div class="gap-m">${UI.note('캠페인: 조건으로 대상 고객을 뽑아 안내 문자를 보냅니다. 마케팅(행사·건강 정보) 문자는 <b>수신 동의한 고객</b>에게만 보낼 수 있고(개인정보 보호법), 밤 9시~아침 8시에는 보내지 않습니다.', 'warn')}${UI.seg('crm.tg', Object.entries(TARGETS).map(([v, l]) => ({ v, l: l.split(' — ')[0].split(' (')[0] })), k)}
          <form data-submit="crm.send" class="box gap-s"><input type="hidden" name="tg" value="${k}"><b>${esc(TARGETS[k])}</b><p class="small" style="margin:0">대상 ${tl.length}명: ${tl.slice(0, 12).map((p) => esc(p.name)).join(', ')}${tl.length > 12 ? ' …' : ''}</p>${UI.textarea('text', '문자 내용', { revisit: '[SSV병원] 마지막 진료 후 6개월이 지났습니다. 꾸준한 관리가 중요합니다. 예약: 1588-0000 (가상)', checkup: '[SSV병원] 올해 국가 건강검진 대상이십니다. 검진센터 예약: 1588-0000 (가상)', dis: '[SSV병원] 퇴원 환자를 위한 건강 강좌 (매주 수요일 오후 2시, 본관 3층)에 초대합니다.', all: '[SSV병원] 이달의 건강 소식을 알려 드립니다. 수신 거부: 080-000-0000 (가상)' }[k], { h: '4rem' })}${UI.btn(`${tl.length}명에게 보내기`, '', { type: 'submit', kind: 'pri' })}</form>
          ${UI.table([{ h: '보낸 시각' }, { h: '대상' }, { h: '인원' }, { h: '내용' }], sent.map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, esc(TARGETS[r.tg].split(' — ')[0]), `${r.n}명`, `<span class="small">${esc(r.text)}</span>`]), { empty: '<p class="muted small">보낸 캠페인이 없습니다</p>' })}</div>`; }
      else { const dis = recentDis(); const sel = dis.find((e) => e.id === ms('enc', '')) || dis.find((e) => !recs('happy', (r) => r.encId === e.id).length) || dis[0];
        body = `<div class="gap-m">${UI.note('해피콜: 퇴원 후 2~3일 안에 전화해서 건강 상태·약 복용·외래 예약을 확인하고 불편 사항을 듣습니다. 상태가 나빠졌으면 바로 담당 의료진에게 알리고, 불편 사항은 고객의 소리(VOC)로 등록합니다.', 'info')}
          <div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,1.6fr)"><div class="gap-s">${dis.map((e) => { const p = H.pat(e.patientId); const done = recs('happy', (r) => r.encId === e.id)[0]; return `<button class="prow ${sel && e.id === sel.id ? 'on' : ''}" style="border:1px solid var(--line);border-radius:6px" data-act="crm.enc" data-id="${e.id}"><span class="loc">${done ? '완료' : '대기'}</span><span class="nm">${esc(p.name)}</span><span class="sub">${esc(e.dept)} · 퇴원 ${T.mdhm(e.endAt || e.at)}</span></button>`; }).join('') || '<p class="muted small">최근 퇴원 환자가 없습니다</p>'}</div>
          <div class="box" style="background:var(--surface)">${sel ? happyForm(sel) : UI.empty('환자를 고르세요')}</div></div></div>`; }
      return `<div class="panel">${UI.tabs('crm.tab', [{ id: 'happy', label: '해피콜 (퇴원 후 전화)', cnt: recentDis().filter((e) => !recs('happy', (r) => r.encId === e.id).length).length || '' }, { id: '360', label: '고객 통합 조회' }, { id: 'camp', label: '캠페인 문자' }], tab)}<div class="panel-b">${body}</div></div>`;
    },
    acts: {
      'crm.tab': (el) => { set('tab', el.dataset.v); A.render(); }, 'crm.enc': (el) => { set('enc', el.dataset.id); A.render(); }, 'crm.tg': (el) => { set('tg', el.dataset.v); A.render(); },
      'crm.pick': (f, d) => { set('pid', d.pid); A.render(); },
      'crm.save': (f, d) => { const p = H.pat(d.pid); p.crm = { prefer: d.prefer, best: d.best, sms: !!d.sms, mkt: !!d.mkt, memo: d.memo }; S.save(); UI.toast('고객 정보 저장', 'ok'); A.render(); },
      'crm.send': (f, d) => { const tl = targetList(d.tg).filter((p) => d.tg !== 'all' || (p.crm && p.crm.mkt)); const h = new Date().getHours(); if (h >= 21 || h < 8) return UI.toast('밤 9시~아침 8시에는 광고성 문자를 보낼 수 없습니다', 'err'); if (!tl.length) return UI.toast('대상이 없습니다', 'warn'); H.addRec('campaign', null, { tg: d.tg, n: tl.length, text: d.text }); tl.forEach((p) => H.addRec('sms', p.id, { to: `${p.name} ${p.phone || ''}`, text: d.text })); UI.toast(`${tl.length}명에게 문자를 보냈습니다 (가상)`, 'ok'); A.render(); },
      'crm.happy': (f, d) => {
        const e = H.enc(d.encId); const p = H.pat(e.patientId);
        const r = H.addRec('happy', p.id, { encId: e.id, result: d.result, health: d.health, med: d.med, appt: d.appt, comment: d.comment });
        if (d.health === '나빠짐') { H.notify('doctor', `해피콜: ${p.name} (퇴원 후) 상태가 나빠졌다고 함 — ${d.comment || ''}`, { patientId: p.id, level: 'stat' }); }
        if (d.toVoc && d.comment) { const n = recs('voc').length + 1; H.addRec('voc', p.id, { no: `VOC-${T.d(Date.now()).slice(2, 7).replace('-', '')}-${String(n).padStart(3, '0')}`, ch: '전화', type: '불만', area: d.vocArea || '친절·태도', name: p.name, phone: p.phone, content: `[해피콜] ${d.comment}`, urgent: false, status: '접수', hist: [{ s: '접수', at: Date.now(), by: H.who(), memo: '해피콜에서 등록' }] }); }
        UI.toast(d.result !== '통화 성공' ? '부재 — 내일 다시 전화 (최대 3번)' : d.health === '나빠짐' ? '담당 의료진에게 알렸습니다' : '해피콜 기록', d.health === '나빠짐' ? 'warn' : 'ok'); set('enc', ''); A.render();
      },
    },
  });
  function happyForm(e) {
    const p = H.pat(e.patientId); const prev = recs('happy', (r) => r.encId === e.id);
    return `<form data-submit="crm.happy" class="gap-m"><input type="hidden" name="encId" value="${e.id}"><div><b>${esc(p.name)}</b> <span class="muted small">${H.sexAge(p)} · ${esc(p.phone || '')} · ${esc(e.dept)} 퇴원</span></div>
      ${prev.length ? UI.note(`이전 통화 ${prev.length}번: ${prev.map((r) => `${T.mdhm(r.at)} ${r.result}`).join(', ')}`, 'info') : ''}
      <div class="box small">"안녕하세요, SSV병원 고객관리실입니다. ${esc(p.name)}님 퇴원하시고 지내시기 어떠신지 여쭤보려고 전화드렸습니다."</div>
      <div class="q-block"><div class="q">통화 결과</div>${pick('result', ['통화 성공', '부재 (받지 않음)', '번호 오류'], '통화 성공')}</div>
      <div class="q-block"><div class="q">퇴원 후 상태</div>${pick('health', ['좋아짐', '비슷함', '나빠짐'], '좋아짐')}</div>
      <div class="q-block"><div class="q">약 복용</div>${pick('med', ['잘 먹고 있음', '방법을 잘 모름 (약사 상담 연결)', '안 먹음'], '잘 먹고 있음')}</div>
      <div class="q-block"><div class="q">외래 예약</div>${pick('appt', ['예약 알고 있음', '모름 → 예약 안내함', '예약 없음 → 예약 도와드림'], '예약 알고 있음')}</div>
      ${UI.textarea('comment', '하신 말씀 (칭찬·불편 사항)', '', { h: '3rem' })}<div class="row">${UI.check('toVoc', '불편 사항을 고객의 소리(VOC)로 등록', false)}${UI.select('vocArea', '분야', AREA, '친절·태도')}</div>
      <div class="btn-row end">${UI.btn('해피콜 기록', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`;
  }

  // ═════════ 환자경험평가 ═════════
  const ANS4 = [['전혀 아니다', 0], ['가끔 그렇다', 33.3], ['대부분 그렇다', 66.7], ['항상 그렇다', 100]];
  const PXQ = [
    ['간호사 서비스', ['간호사는 나를 존중하고 예의를 갖추어 대했다', '간호사는 내 이야기를 주의 깊게 들었다', '간호사는 병원 생활(검사·식사·주의사항)을 잘 설명했다', '도움이 필요할 때 간호사가 도와주려고 노력했다']],
    ['의사 서비스', ['의사는 나를 존중하고 예의를 갖추어 대했다', '의사는 내 이야기를 주의 깊게 들었다', '의사를 만나 이야기할 기회가 있었다', '회진 시간 등 의사를 만나는 시간을 알려 주었다']],
    ['투약 및 치료 과정', ['새 약의 목적과 부작용을 이해하기 쉽게 설명했다', '검사·치료 전에 이유와 방법을 설명했다', '통증을 줄이려고 노력했다', '수술·시술 전에 과정과 위험을 설명했다']],
    ['병원 환경', ['병실이 깨끗했다', '병원 환경이 안전했다 (낙상·감염 등)']],
    ['환자 권리 보장', ['신체 노출 등 수치심을 느끼지 않게 배려했다', '치료 결정에 내 의견이 반영되었다', '불만을 말하는 방법을 안내받았다', '성별·나이·경제력과 상관없이 공평하게 대했다']],
  ];
  const NAT = { '간호사 서비스': 88.2, '의사 서비스': 81.5, '투약 및 치료 과정': 82.9, '병원 환경': 85.6, '환자 권리 보장': 79.4, '전반적 평가': 84.1 };
  function pxScores() {
    const l = recs('pxe'); const out = {};
    PXQ.forEach(([dom, qs]) => { const v = []; l.forEach((r) => qs.forEach((q, i) => { const x = r.ans[`${dom}|${i}`]; if (x != null) v.push(x); })); out[dom] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
    const ov = l.map((r) => r.overall * 10); out['전반적 평가'] = ov.length ? ov.reduce((a, b) => a + b, 0) / ov.length : null;
    return { out, n: l.length };
  }
  H.reg({
    id: 'cs-pxe', title: '환자경험평가', actor: '고객관리실 담당자 (QI)', layout: 'full', channels: () => ['cs'],
    render() {
      const tab = ms('tab', 'result'); let body;
      if (tab === 'survey') { const dis = recentDis(); const eid = ms('enc', (dis[0] || {}).id); const e = H.enc(eid);
        body = `<div class="gap-m">${UI.note('환자경험평가(건강보험심사평가원): 입원 2일 넘게 있다가 퇴원한 성인 환자에게 퇴원 2~56일 사이에 전화로 묻습니다. 여기서는 병원 자체 모의 조사를 합니다. 점수: 전혀 0 · 가끔 33.3 · 대부분 66.7 · 항상 100.', 'info')}
          <form data-submit="px.save" class="gap-m">${UI.select('encId', '조사 대상 (최근 퇴원)', dis.map((x) => ({ v: x.id, l: `${H.pat(x.patientId).name} — ${x.dept}` })), eid)}
          ${PXQ.map(([dom, qs]) => `<div class="box"><h4>${esc(dom)}</h4>${qs.map((q, i) => `<div class="q-block"><div class="q">${esc(q)}</div>${pick(`${dom}|${i}`, ANS4.map(([l, v]) => ({ v, l })), 100)}</div>`).join('')}</div>`).join('')}
          <div class="box"><h4>전반적 평가</h4><div class="q-block"><div class="q">이 병원 입원 경험을 0~10점으로 매긴다면?</div>${pick('overall', [...Array(11).keys()].map((n) => ({ v: n, l: String(n) })), 9)}</div><div class="q-block"><div class="q">가족·친구에게 이 병원을 추천하겠습니까? (0~10)</div>${pick('recommend', [...Array(11).keys()].map((n) => ({ v: n, l: String(n) })), 9)}</div></div>
          <div class="btn-row end">${UI.btn('조사 저장', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>${e ? '' : ''}</div>`; }
      else if (tab === 'plan') { const l = recs('pxplan');
        body = `<div class="gap-m"><form data-submit="px.plan" class="box gap-s"><div class="form-grid">${UI.select('dom', '개선 영역', Object.keys(NAT), lowest())}${UI.input('owner', '담당 부서', '간호부')}</div>${UI.input('task', '개선 활동', '')}${UI.input('kpi', '목표 지표', '')}${UI.btn('개선 과제 등록', '', { type: 'submit', kind: 'pri' })}</form>
          ${UI.table([{ h: '등록' }, { h: '영역' }, { h: '활동' }, { h: '담당' }, { h: '목표' }, { h: '상태' }], l.map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, esc(r.dom), esc(r.task), esc(r.owner), esc(r.kpi), r.done ? UI.chip('완료', 'done') : UI.btn('완료', 'px.done', { size: 'sm', data: { id: r.id } })]), { empty: '<p class="muted small">개선 과제가 없습니다</p>' })}</div>`; }
      else { const { out, n } = pxScores(); const W = 520;
        body = `<div class="gap-m">${UI.note(`응답 ${n}건 기준 (가상). 영역별 점수를 전국 평균(가상)과 비교하고, 낮은 영역을 개선 과제로 정합니다.`, 'info')}
          <svg viewBox="0 0 ${W} ${Object.keys(NAT).length * 40 + 20}" class="chart" role="img" aria-label="영역별 환자경험 점수">${Object.keys(NAT).map((d, i) => { const v = out[d]; const y = 10 + i * 40; return `<text x="0" y="${y + 14}" font-size="12" fill="var(--fg-2)">${esc(d)}</text><rect x="130" y="${y}" width="${((v || 0) / 100) * 330}" height="18" rx="3" fill="${v != null && v < NAT[d] ? 'var(--t-prog)' : 'var(--accent)'}"/><line x1="${130 + (NAT[d] / 100) * 330}" x2="${130 + (NAT[d] / 100) * 330}" y1="${y - 3}" y2="${y + 21}" stroke="var(--fg)" stroke-width="2"/><text x="${W - 4}" y="${y + 14}" font-size="12" text-anchor="end" fill="var(--fg)">${v != null ? v.toFixed(1) : '-'}</text>`; }).join('')}</svg>
          <p class="small muted" style="margin:0">막대 = 우리 병원, 세로선 = 전국 평균. 주황 막대는 전국 평균보다 낮은 영역입니다.</p>
          ${UI.table([{ h: '영역' }, { h: '우리 병원' }, { h: '전국 평균' }, { h: '차이' }], Object.keys(NAT).map((d) => [esc(d), `<b class="num">${out[d] != null ? out[d].toFixed(1) : '-'}</b>`, `<span class="num">${NAT[d]}</span>`, out[d] == null ? '-' : out[d] >= NAT[d] ? UI.chip(`+${(out[d] - NAT[d]).toFixed(1)}`, 'done') : UI.chip((out[d] - NAT[d]).toFixed(1), 'stat')]))}</div>`; }
      return `<div class="panel">${UI.tabs('px.tab', [{ id: 'result', label: '평가 결과' }, { id: 'survey', label: '모의 조사 (전화 설문)' }, { id: 'plan', label: '개선 활동' }], tab)}<div class="panel-b">${body}</div></div>`;
    },
    acts: {
      'px.tab': (el) => { set('tab', el.dataset.v); A.render(); },
      'px.save': (f, d) => { if (!d.encId) return UI.toast('조사 대상을 고르세요', 'warn'); const ans = {}; PXQ.forEach(([dom, qs]) => qs.forEach((q, i) => { ans[`${dom}|${i}`] = H.num(d[`${dom}|${i}`]); })); const e = H.enc(d.encId); H.addRec('pxe', e.patientId, { encId: e.id, ans, overall: H.num(d.overall), recommend: H.num(d.recommend) }); set('tab', 'result'); UI.toast('조사 저장 — 결과에 반영됩니다', 'ok'); A.render(); },
      'px.plan': (f, d) => { if (!d.task) return UI.toast('개선 활동을 써 주세요', 'warn'); H.addRec('pxplan', null, { dom: d.dom, task: d.task, owner: d.owner, kpi: d.kpi }); UI.toast('개선 과제 등록', 'ok'); A.render(); },
      'px.done': (el) => { const r = S.get('recs', el.dataset.id); r.done = Date.now(); S.save(); A.render(); },
    },
  });
  function lowest() { const { out } = pxScores(); let lo = '환자 권리 보장', gap = 99; Object.keys(NAT).forEach((d) => { if (out[d] != null && out[d] - NAT[d] < gap) { gap = out[d] - NAT[d]; lo = d; } }); return lo; }
})();
