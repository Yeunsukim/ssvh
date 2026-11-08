// 예약센터 — 전화예약센터(콜센터), 통합예약센터(환자별 모든 예약·일정표·피드백)
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const DAY = 86400000, MIN = 60000;
  const ms = (k, d) => A.ms(k, d); const set = (k, v) => A.set(k, v);
  const pick = (name, opts, v, o) => UI.pick(name, opts.map((x) => (typeof x === 'object' ? x : { v: x, l: x })), v, o);
  const recs = (kind, fn) => S.where('recs', (r) => r.kind === kind && (!fn || fn(r))).sort((a, b) => b.at - a.at);
  const bars = (rows) => { const mx = Math.max(1, ...rows.map((r) => r[1])); return `<div class="gap-s">${rows.map(([l, n]) => `<div class="row" style="flex-wrap:nowrap;gap:.6rem"><span style="width:9rem;flex:none" class="small">${esc(l)}</span><span style="flex:1;background:var(--surface-3);border-radius:4px;height:1.4rem;position:relative"><span style="position:absolute;inset:0 auto 0 0;width:${(n / mx) * 100}%;background:var(--accent);border-radius:4px"></span></span><b class="num" style="width:3.5rem;text-align:right">${n}</b></div>`).join('')}</div>`; };

  // ── 공통: 의사 진료 일정·빈 시간 ──
  const SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
  const CAP = 2; // 한 시간대 정원
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const docs = () => H.M.DOCTORS.filter((d) => !['응급의학과', '마취통증의학과'].includes(d.dept));
  const dow = (date) => new Date(date + 'T00:00').getDay();
  const off = (docId, date) => recs('dayoff', (r) => r.docId === docId && r.date === date).length > 0;
  function sess(doc, date) { const d = dow(date); if (d === 0 || d === 6 || off(doc.id, date)) return { am: false, pm: false }; const h = doc.id.charCodeAt(doc.id.length - 1); return { am: (h + d) % 3 !== 0, pm: (h + d) % 2 === 0 }; }
  const open = (doc, date, time) => { const s = sess(doc, date); return time < '12:00' ? s.am : s.pm; };
  const booked = (docId, date, time) => S.where('appts', (a) => a.doctorId === docId && a.date === date && a.time === time && ['예약', '도착'].includes(a.status)).length;
  const free = (doc, date) => SLOTS.filter((t) => open(doc, date, t) && booked(doc.id, date, t) < CAP && (date > T.d(Date.now()) || t > T.hm(Date.now())));
  const days = (n, from) => { const out = []; let t = from || Date.now(); while (out.length < n) { t += DAY; const ds = T.d(t); if (![0, 6].includes(dow(ds))) out.push(ds); } return out; };
  const nextFree = (doc) => { for (const ds of days(15)) { const f = free(doc, ds); if (f.length) return { date: ds, time: f[0] }; } return null; };
  const sms = (a, kind) => { const p = H.pat(a.pid); H.addRec('sms', a.pid, { to: `${p.name} ${p.phone || ''}`, text: `[SSV병원] ${p.name}님 ${kind}: ${a.date}(${DOW[dow(a.date)]}) ${a.time} ${a.dept} ${H.M.doctor(a.doctorId).name} 교수${a.item ? ' · ' + a.item : ''}. ${a.memo ? a.memo + '. ' : ''}변경 1588-0000 (가상)` }); };
  const book = (o) => { const a = S.add('appts', Object.assign({ id: H.uid('ap'), status: '예약', at: Date.now(), by: H.who(), kind: '진료' }, o)); sms(a, '예약 확인'); H.log('예약', `${H.pat(a.pid).name} ${a.date} ${a.time} ${a.dept}`, a.pid); return a; };
  const SYMPTOM = [[/가슴|두근|흉통|심장|혈압/, '순환기내과'], [/배|소화|속쓰|변|구토|간/, '소화기내과'], [/두통|어지|저림|경련|마비|기억/, '신경과'], [/무릎|허리|어깨|관절|골절|발목/, '정형외과'], [/유방|멍울|가슴 혹/, '유방외과'], [/임신|생리|산부|자궁/, '산부인과'], [/아이|아기|소아/, '소아청소년과'], [/신장|투석|붓|소변/, '신장내과'], [/빈혈|혈액|암|항암/, '혈액종양내과'], [/머리 수술|뇌종양|척추/, '신경외과']];
  const suggest = (txt) => { for (const [re, d] of SYMPTOM) if (re.test(txt || '')) return d; return '내과'; };

  // ═════════ 전화예약센터 ═════════
  const IVR = ['진료 예약', '예약 변경·취소', '검사 예약 문의', '진료과·의사 안내', '기타 문의'];
  const CALLERS = () => { const ps = S.all('patients').filter((p) => p.phone); const p = ps[Math.floor(Math.random() * ps.length)]; return Math.random() < 0.3 ? { phone: `010-${Math.floor(1000 + Math.random() * 8999)}-${Math.floor(10 + Math.random() * 89)}xx`, pid: null } : { phone: p.phone, pid: p.id }; };
  function callScreen(c) {
    const p = c.pid ? H.pat(c.pid) : null; const id = c.idOk;
    const fut = p ? S.where('appts', (a) => a.pid === p.id && a.status === '예약' && a.date >= T.d(Date.now())).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)) : [];
    const type = ms('ctype', c.ivr);
    let work = '';
    if (!id) work = `<form data-submit="cc.id" class="gap-m"><input type="hidden" name="id" value="${c.id}">${UI.note('개인정보 보호: 예약 내용을 말하기 전에 본인(또는 보호자)인지 <b>이름과 생년월일</b>로 확인합니다.', 'warn')}
      ${p ? `<div class="gap-s">${UI.check('c', `이름 확인: ${esc(p.name)}`, false, { multi: true, value: 'name' })}${UI.check('c', `생년월일 확인: ${esc(p.birth)}`, false, { multi: true, value: 'birth' })}</div>` : `<p class="small" style="margin:0">미등록 번호입니다. 처음 오시는 분이면 진료 예약에서 <b>가등록</b>을 합니다.</p>${UI.check('c', '처음 오시는 분 (신환) 확인', false, { multi: true, value: 'new' })}`}
      ${UI.select('rel', '전화하신 분', ['본인', '보호자 (가족)', '기타 (대리인 — 위임 확인 필요)'], '본인')}<div class="btn-row end">${UI.btn('확인 완료', '', { type: 'submit', kind: 'pri' })}</div></form>`;
    else if (type === '진료 예약') { const dept = ms('cdept', p ? (H.activeEnc(p.id) || {}).dept || '내과' : '내과'); const dlist = docs().filter((d) => d.dept === dept); const doc = H.M.doctor(ms('cdoc', (dlist[0] || docs()[0]).id)); const dd = ms('cdate', (nextFree(doc) || {}).date || days(1)[0]); const fr = free(doc, dd);
      work = `<form data-submit="cc.book" class="gap-m"><input type="hidden" name="id" value="${c.id}">
        ${!p ? `<div class="box gap-s"><b>신환 가등록</b><div class="form-grid">${UI.input('name', '이름', '')}${UI.input('birth', '생년월일', '', { type: 'date' })}${UI.select('sex', '성별', [{ v: 'F', l: '여' }, { v: 'M', l: '남' }], 'F')}${UI.input('phone', '전화번호', c.phone)}</div>${UI.note('상급종합병원은 <b>진료의뢰서</b>(동네 병·의원 발급)가 있어야 건강보험이 적용됩니다. 응급·분만·치과·가정의학과·재활의학과·혈우병은 예외. 첫 방문 때 신분증과 의뢰서를 가져오시라고 안내합니다.', 'info')}</div>` : ''}
        <div class="form-grid">${UI.input('sym', '증상 (진료과 추천)', ms('csym', ''))}<div class="fld"><span class="lbl">&nbsp;</span>${UI.btn('증상으로 진료과 추천', 'cc.sug')}</div></div>
        ${UI.fld('진료과', pick('dept', [...new Set(docs().map((d) => d.dept))], dept, { on: 'cc.dept' }))}${UI.fld('의사', pick('doc', dlist.map((d) => ({ v: d.id, l: `${d.name} 교수` })), doc.id, { on: 'cc.doc' }))}
        ${UI.fld('날짜 (진료 있는 날)', pick('date', days(10).map((ds) => { const s = sess(doc, ds); return { v: ds, l: `${ds.slice(5)}(${DOW[dow(ds)]})${s.am || s.pm ? '' : ' 휴진'}` }; }), dd, { on: 'cc.date' }))}
        ${UI.fld('시각 (빈 시간)', fr.length ? pick('time', fr, fr[0]) : '<p class="small" style="color:var(--t-stat);margin:0">이날은 빈 시간이 없습니다 — 다른 날을 고르세요</p>')}
        ${UI.fld('초진·재진', pick('visit', ['초진', '재진'], p ? '재진' : '초진'))}${UI.input('memo', '메모 (검사 전 금식 등)', '')}
        <div class="btn-row end">${UI.btn('예약 + 확인 문자', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>`; }
    else if (type === '예약 변경·취소') work = `<div class="gap-m">${fut.length ? UI.table([{ h: '날짜' }, { h: '시각' }, { h: '진료과·의사' }, { h: '' }], fut.map((a) => [`<span class="num">${esc(a.date)}</span>`, `<span class="num">${esc(a.time)}</span>`, `${esc(a.dept)} ${esc(H.M.doctor(a.doctorId).name)}${a.kind === '검사' ? ` · ${esc(a.item)}` : ''}`, `<div class="row" style="flex-wrap:nowrap;gap:.3rem">${UI.btn('다음 빈 시간으로 변경', 'cc.move', { size: 'sm', kind: 'pri', data: { id: a.id, call: c.id } })}${UI.btn('취소', 'cc.cancel', { size: 'sm', kind: 'warn', data: { id: a.id, call: c.id } })}</div>`])) : UI.empty('남은 예약이 없습니다')}<div class="btn-row end">${UI.btn('통화 종료', 'cc.end', { kind: 'pri', data: { id: c.id } })}</div></div>`;
    else work = `<form data-submit="cc.endf" class="gap-m"><input type="hidden" name="id" value="${c.id}">${type === '검사 예약 문의' ? UI.note('검사 예약은 처방이 있어야 잡을 수 있습니다. 통합예약센터에서 처방된 검사를 확인해 날짜를 잡고, 금식·약 중단 안내를 문자로 보냅니다.', 'info') : type === '진료과·의사 안내' ? UI.note('증상을 듣고 진료과를 안내합니다. 의학적 판단(진단·약 용량)은 말하지 않고 "진료 때 의사에게 여쭤보세요"라고 안내합니다. 응급 증상(가슴 통증·마비·심한 출혈)이면 119·응급실을 안내합니다.', 'warn') : ''}
      ${UI.textarea('memo', '상담 내용', '', { h: '4rem' })}${UI.check('req', '통합예약센터에 처리 요청 남기기 (검사 일정 조정 등)', type === '검사 예약 문의')}<div class="btn-row end">${UI.btn('통화 종료 + 상담 기록', '', { type: 'submit', kind: 'pri' })}</div></form>`;
    return `<div class="gap-m"><div class="box" style="border-color:var(--accent)"><div class="row between"><div>${H.icon('bell')} <b class="num">${esc(c.phone)}</b> · ARS 선택: <b>${esc(c.ivr)}</b></div><span class="small muted">대기 ${Math.max(0, Math.round(((c.pickAt || Date.now()) - c.at) / 1000))}초</span></div>
      ${p ? `<p style="margin:.4rem 0 0">발신 번호 조회(CTI): <b>${esc(p.name)}</b> ${H.sexAge(p)} · ${esc(p.mrn)} · 예약 ${fut.length}건${p.crm && p.crm.memo ? ` · <span style="color:var(--t-prog)">참고: ${esc(p.crm.memo)}</span>` : ''}</p>` : '<p style="margin:.4rem 0 0">발신 번호 조회(CTI): <b>등록되지 않은 번호</b></p>'}</div>
      ${id ? UI.fld('상담 유형', pick('ctype', IVR, type, { on: 'cc.type' })) : ''}${work}</div>`;
  }
  H.reg({
    id: 'callctr', title: '전화예약센터', actor: '예약 상담원', layout: 'full', channels: () => ['appt'],
    render() {
      const tab = ms('tab', 'in'); let body;
      const q = recs('callq', (r) => r.status === '대기').sort((a, b) => a.at - b.at); const cur = recs('callq', (r) => r.status === '통화중')[0];
      if (tab === 'in') body = `<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)"><div class="gap-s">${UI.sec(`대기 중인 전화 ${q.length}통`)}${q.map((c) => `<div class="box" style="background:var(--surface)"><div class="row between"><b class="num">${esc(c.phone)}</b><span class="small" style="color:${Date.now() - c.at > 3 * MIN ? 'var(--t-stat)' : 'var(--fg-3)'}">${Math.round((Date.now() - c.at) / MIN)}분 대기</span></div><div class="small muted">ARS: ${esc(c.ivr)}</div>${cur ? '' : UI.btn('전화 받기', 'cc.pick', { kind: 'pri', block: true, data: { id: c.id } })}</div>`).join('') || '<p class="muted small">대기 전화 없음</p>'}
        ${UI.btn('실습: 새 전화가 걸려오게 하기', 'cc.ring', { block: true, icon: 'plus' })}</div>
        <div class="box" style="background:var(--surface)">${cur ? callScreen(cur) : UI.empty('통화 중이 아닙니다', '왼쪽에서 "전화 받기"를 누르세요. 오래 기다린 전화부터 받습니다.')}</div></div>`;
      else if (tab === 'out') { const did = ms('odoc', docs()[0].id); const odate = ms('odate', days(1)[0]); const hit = S.where('appts', (a) => a.doctorId === did && a.date === odate && a.status === '예약');
        const noshow = S.where('appts', (a) => a.status === '부도' && !a.recall);
        body = `<div class="gap-m">${UI.note('아웃바운드(병원이 거는 전화): ① 의사 휴진(학회·수술)으로 예약을 옮겨야 할 때 ② 예약 부도(노쇼) 환자에게 다시 예약을 안내할 때 전화합니다.', 'info')}
          <form data-submit="cc.off" class="box gap-s"><b>의사 휴진 등록</b><div class="form-grid">${UI.select('doc', '의사', docs().map((d) => ({ v: d.id, l: `${d.dept} ${d.name}` })), did)}${UI.select('date', '휴진 날짜', days(10), odate)}${UI.input('why', '사유', '학회 참석')}</div><div class="btn-row end">${UI.btn('예약 환자 보기', 'cc.offSee')}${UI.btn('휴진 등록', '', { type: 'submit', kind: 'warn' })}</div></form>
          ${UI.sec(`${H.M.doctor(did).name} 교수 ${odate} 예약 환자 ${hit.length}명`)}${UI.table([{ h: '시각' }, { h: '환자' }, { h: '전화' }, { h: '' }], hit.map((a) => { const p = H.pat(a.pid); return [`<span class="num">${esc(a.time)}</span>`, esc(p.name), `<span class="num">${esc(p.phone || '')}</span>`, UI.btn('전화 → 다음 진료일로 변경', 'cc.move', { size: 'sm', kind: 'pri', data: { id: a.id } })]; }), { empty: '<p class="muted small">이날 예약이 없습니다</p>' })}
          ${UI.sec(`부도(노쇼) 재안내 ${noshow.length}명`)}${UI.table([{ h: '놓친 예약' }, { h: '환자' }, { h: '' }], noshow.map((a) => [`${esc(a.date)} ${esc(a.time)} ${esc(a.dept)}`, esc(H.pat(a.pid).name), `<div class="row" style="flex-wrap:nowrap;gap:.3rem">${UI.btn('통화 → 재예약', 'cc.rebook', { size: 'sm', kind: 'pri', data: { id: a.id } })}${UI.btn('연락 안 됨', 'cc.noans', { size: 'sm', data: { id: a.id } })}</div>`]), { empty: '<p class="muted small">재안내할 환자가 없습니다</p>' })}</div>`; }
      else if (tab === 'log') { const l = recs('call'); body = UI.table([{ h: '시각' }, { h: '전화번호' }, { h: '환자' }, { h: '유형' }, { h: '결과' }, { h: '통화' }], l.map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, `<span class="num">${esc(r.phone)}</span>`, esc(r.patientId ? H.pat(r.patientId).name : '-'), esc(r.type), `<span class="small">${esc(r.result)}</span>`, `${r.dur}초`]), { empty: UI.empty('통화 기록이 없습니다') }); }
      else { const today = recs('callq', (r) => r.at >= T.startOfDay()); const done = today.filter((r) => r.status === '완료'); const gone = today.filter((r) => r.status === '포기'); const calls = recs('call', (r) => r.at >= T.startOfDay());
        const waitAvg = done.length ? Math.round(done.reduce((s, r) => s + ((r.pickAt || r.at) - r.at), 0) / done.length / 1000) : 0;
        body = `<div class="gap-m"><div class="row">${UI.chip(`오늘 걸려온 전화 ${today.length}통`, 'plain')} ${UI.chip(`응대 ${done.length}통`, 'done')} ${UI.chip(`포기 ${gone.length}통`, 'stat')} ${UI.chip(`응대율 ${today.length ? Math.round((done.length / Math.max(1, done.length + gone.length)) * 100) : '-'}%`, 'sent')} ${UI.chip(`평균 대기 ${waitAvg}초`, 'prog')}</div>
          <div class="box"><h4>상담 유형별</h4>${bars(IVR.map((t) => [t, calls.filter((r) => r.type === t).length]))}</div>${UI.note('콜센터 목표(예): 응대율 90% 이상, 20초 안 응답 80% 이상, 포기율 5% 미만.', 'info')}</div>`; }
      return `<div class="panel">${UI.tabs('cc.tab', [{ id: 'in', label: '걸려온 전화', cnt: q.length || '' }, { id: 'out', label: '거는 전화 (휴진·부도)' }, { id: 'log', label: '상담 기록' }, { id: 'stat', label: '통계' }], tab)}<div class="panel-b">${body}</div></div>`;
    },
    acts: {
      'cc.tab': (el) => { set('tab', el.dataset.v); A.render(); },
      'cc.ring': () => { const c = CALLERS(); H.addRec('callq', c.pid, { phone: c.phone, pid: c.pid, ivr: IVR[Math.floor(Math.random() * IVR.length)], status: '대기' }); UI.toast('전화가 걸려왔습니다', 'info'); A.render(); },
      'cc.pick': (el) => { const c = S.get('recs', el.dataset.id); c.status = '통화중'; c.pickAt = Date.now(); c.idOk = false; S.save(); ['ctype', 'cdept', 'cdoc', 'cdate', 'csym'].forEach((k) => set(k, undefined)); A.render(); },
      'cc.id': (f, d) => { const c = S.get('recs', d.id); const ck = Array.isArray(d.c) ? d.c : d.c ? [d.c] : []; if (c.pid ? ck.length < 2 : !ck.length) return UI.toast(c.pid ? '이름과 생년월일을 모두 확인하세요' : '신환인지 확인하세요', 'warn'); if (d.rel.startsWith('기타')) UI.toast('대리인은 환자 동의(위임) 확인 후 예약 내용을 안내합니다', 'warn'); c.idOk = true; c.rel = d.rel; S.save(); A.render(); },
      'cc.type': (el) => { set('ctype', el.dataset.pickv); A.render(); },
      'cc.dept': (el) => { set('cdept', el.dataset.pickv); set('cdoc', undefined); set('cdate', undefined); A.render(); },
      'cc.doc': (el) => { set('cdoc', el.dataset.pickv); set('cdate', undefined); A.render(); },
      'cc.date': (el) => { set('cdate', el.dataset.pickv); A.render(); },
      'cc.sug': (el) => { const v = el.closest('form').querySelector('[name=sym]').value; const dpt = suggest(v); set('csym', v); set('cdept', dpt); set('cdoc', undefined); set('cdate', undefined); UI.toast(`"${v}" → ${dpt} 추천`, 'info'); A.render(); },
      'cc.book': (f, d) => {
        const c = S.get('recs', d.id); if (!d.time) return UI.toast('빈 시간을 고르세요', 'warn');
        let pid = c.pid;
        if (!pid) { if (!d.name || !d.birth) return UI.toast('신환 이름과 생년월일을 넣으세요', 'warn'); const p = S.add('patients', { id: H.uid('pt'), mrn: S.nextMrn(), name: d.name, birth: d.birth, sex: d.sex, phone: d.phone, blood: '-', height: 0, weight: 0, ins: '건강보험 (확인 전)', allergies: [], flags: {}, scenario: {}, temp: true, hx: `전화 가등록 — ${d.sym || ''}` }); pid = p.id; c.pid = pid; c.patientId = pid; }
        const doc = H.M.doctor(d.doc); const a = book({ pid, dept: doc.dept, doctorId: doc.id, date: d.date, time: d.time, visit: d.visit, memo: d.memo, via: '전화' });
        endCall(c, '진료 예약', `${a.date} ${a.time} ${a.dept} ${doc.name}${!c.pid ? '' : ''}`); UI.toast(`예약 완료 ${a.date} ${a.time} — 확인 문자를 보냈습니다`, 'ok'); A.render();
      },
      'cc.move': (el) => { const a = S.get('appts', el.dataset.id); const doc = H.M.doctor(a.doctorId); const nf = (() => { for (const ds of days(15, new Date(a.date + 'T12:00').getTime())) { const f = free(doc, ds); if (f.length) return { date: ds, time: f[0] }; } return null; })(); if (!nf) return UI.toast('15일 안에 빈 시간이 없습니다', 'warn'); a.status = '변경'; S.save(); const b = book({ pid: a.pid, dept: a.dept, doctorId: a.doctorId, date: nf.date, time: nf.time, visit: a.visit, memo: a.memo, via: '전화 변경', kind: a.kind, item: a.item }); sms(b, '예약 변경'); UI.toast(`${nf.date} ${nf.time}로 변경 — 문자 발송`, 'ok'); A.render(); },
      'cc.cancel': (el) => { const a = S.get('appts', el.dataset.id); a.status = '취소'; a.cancelAt = Date.now(); S.save(); sms(a, '예약 취소'); UI.toast('예약 취소 — 문자 발송', 'ok'); A.render(); },
      'cc.end': (el) => { endCall(S.get('recs', el.dataset.id), '예약 변경·취소', '변경·취소 처리'); A.render(); },
      'cc.endf': (f, d) => { const c = S.get('recs', d.id); if (d.req) H.addRec('resvreq', c.pid, { phone: c.phone, text: d.memo || ms('ctype', c.ivr), status: '요청', from: '전화예약센터' }); endCall(c, ms('ctype', c.ivr), d.memo || '-'); A.render(); },
      'cc.offSee': (el) => { const f = el.closest('form'); set('odoc', f.querySelector('[name=doc]').value); set('odate', f.querySelector('[name=date]').value); A.render(); },
      'cc.off': (f, d) => { H.addRec('dayoff', null, { docId: d.doc, date: d.date, why: d.why }); set('odoc', d.doc); set('odate', d.date); H.notify('appt', `휴진 등록: ${H.M.doctor(d.doc).name} ${d.date} (${d.why}) — 예약 환자에게 전화해 변경하세요`, {}); UI.toast('휴진 등록 — 이날 새 예약은 막힙니다', 'warn'); A.render(); },
      'cc.rebook': (el) => { const a = S.get('appts', el.dataset.id); a.recall = '재예약'; S.save(); H.mods.callctr.acts['cc.move'](el); },
      'cc.noans': (el) => { const a = S.get('appts', el.dataset.id); a.recall = '연락 안 됨'; S.save(); H.addRec('sms', a.pid, { to: H.pat(a.pid).name, text: `[SSV병원] ${H.pat(a.pid).name}님, ${a.date} 예약에 오지 않으셔서 연락드렸습니다. 다시 예약하시려면 1588-0000 (가상)` }); UI.toast('연락 안 됨 — 안내 문자를 보냈습니다', 'ok'); A.render(); },
    },
  });
  function endCall(c, type, result) { c.status = '완료'; c.endAt = Date.now(); S.save(); H.addRec('call', c.pid || null, { phone: c.phone, type, result, dur: Math.max(30, Math.round((c.endAt - (c.pickAt || c.at)) / 1000)) }); set('ctype', undefined); UI.toast('통화 종료 — 상담 기록 저장', 'ok'); }

  // ═════════ 통합예약센터 ═════════
  function allOf(pid) {
    const out = [];
    S.where('appts', (a) => a.pid === pid).forEach((a) => out.push({ date: a.date, time: a.time, kind: a.kind || '진료', what: a.kind === '검사' ? a.item : `${a.dept} ${H.M.doctor(a.doctorId).name}`, status: a.status, where: a.kind === '검사' ? a.dept : '외래', memo: a.memo, appt: a }));
    S.where('orders', (o) => o.patientId === pid && !H.flow.isOff(o)).forEach((o) => {
      if (o.en && o.en.date) out.push({ date: o.en.date, time: o.en.time, kind: '검사', what: o.name, status: o.status, where: o.en.room, memo: o.en.sed ? '수면 내시경 — 8시간 금식, 보호자 동반' : '' });
      else if (o.cv && o.cv.date) out.push({ date: o.cv.date, time: o.cv.time, kind: '시술', what: o.name, status: o.status, where: o.cv.room, memo: '금식, 항응고제 확인' });
      else if (o.cat === 'RAD' && ['전송', '검사접수'].includes(o.status)) out.push({ date: o.room ? T.d(o.at) : '', time: o.room ? (o.room.match(/\d\d:\d\d/) || [''])[0] : '', kind: '검사', what: o.name, status: o.room ? '예약됨' : '일정 미정', where: o.room || '영상의학과', memo: (H.M.item(o.code) || {}).contrast ? '조영제 — 금식 4~6시간' : '', order: o });
      else if (o.cat === 'PROC' && (H.M.item(o.code) || {}).room && o.status === '전송') out.push({ date: o.resv ? o.resv.date : '', time: o.resv ? o.resv.time : '', kind: '검사', what: o.name, status: o.resv ? '예약됨' : '일정 미정', where: '기능검사실', memo: '', order: o });
    });
    S.where('admreq', (r) => r.patientId === pid && r.status === '대기').forEach((r) => out.push({ date: '', time: '', kind: '입원', what: `${r.dept} 입원 (${r.ward || '병동 미정'})`, status: '입원 대기', where: '원무 입퇴원', memo: r.why || '' }));
    return out.sort((a, b) => (a.date || '9') .localeCompare(b.date || '9') || (a.time || '').localeCompare(b.time || ''));
  }
  function conflicts(list) {
    const w = []; const by = {}; list.filter((x) => x.date && !['취소', '변경', '부도'].includes(x.status)).forEach((x) => { (by[x.date] = by[x.date] || []).push(x); });
    Object.entries(by).forEach(([d, xs]) => {
      const fast = xs.filter((x) => /금식/.test(x.memo || '')); const clinic = xs.filter((x) => x.kind === '진료');
      if (fast.length && clinic.some((c) => fast.some((f) => c.time && f.time && c.time < f.time))) w.push(`${d}: 진료가 금식 검사보다 먼저입니다 — 검사를 먼저 하고 결과를 본 뒤 진료하도록 순서를 바꾸면 한 번에 끝납니다 (원스톱)`);
      const ts = xs.filter((x) => x.time).map((x) => x.time); if (new Set(ts).size < ts.length) w.push(`${d}: 같은 시각에 예약이 겹칩니다`);
      if (xs.length >= 2) w.push(`${d}: 하루에 ${xs.length}건 — 이동 순서와 금식 시간을 함께 안내하세요`);
    });
    return w;
  }
  H.reg({
    id: 'resv', title: '통합예약센터', actor: '통합예약 담당', layout: 'full', channels: () => ['appt'],
    render() {
      const tab = ms('tab', 'pat'); let body;
      if (tab === 'pat') { const pid = ms('pid', (S.all('patients').find((p) => p.name === '배성호') || S.all('patients')[0]).id); const p = H.pat(pid); const list = allOf(pid); const cf = conflicts(list);
        body = `<div class="gap-m"><form class="row" data-submit="rv.pick">${UI.select('pid', '환자 조회', S.all('patients').map((x) => ({ v: x.id, l: `${x.name} (${x.mrn})` })), pid)}${UI.btn('조회', '', { type: 'submit', kind: 'pri' })}</form>
          <div class="row between"><div><b style="font-size:1.15rem">${esc(p.name)}</b> <span class="muted">${H.sexAge(p)} · ${esc(p.phone || '')}</span></div>${UI.btn('이 환자 진료 예약 잡기', 'rv.go', { kind: 'pri', data: { pid } })}</div>
          ${cf.map((x) => UI.note(x, 'warn')).join('')}
          ${UI.table([{ h: '날짜' }, { h: '시각' }, { h: '종류' }, { h: '내용' }, { h: '장소' }, { h: '상태' }, { h: '안내' }, { h: '' }], list.map((x) => [`<span class="num">${esc(x.date || '-')}</span>${x.date ? ` <span class="small muted">${DOW[dow(x.date)]}</span>` : ''}`, `<span class="num">${esc(x.time || '-')}</span>`, UI.chip(x.kind, x.kind === '진료' ? 'sent' : x.kind === '입원' ? 'purple' : 'prog'), esc(x.what), `<span class="small">${esc(x.where || '')}</span>`, UI.chip(x.status, ['취소', '변경', '부도'].includes(x.status) ? 'off' : x.status === '일정 미정' ? 'stat' : 'plain'), `<span class="small">${esc(x.memo || '')}</span>`,
            x.order && x.status === '일정 미정' ? UI.btn('검사 일정 잡기', 'rv.exam', { size: 'sm', kind: 'pri', data: { id: x.order.id } }) : x.appt && x.appt.status === '예약' ? UI.btn('변경', 'cc.move', { size: 'sm', data: { id: x.appt.id } }) : '']), { empty: UI.empty('예약이 없습니다') })}
          <div class="btn-row end">${UI.btn('전체 일정 안내 문자 보내기', 'rv.smsAll', { data: { pid } })}</div></div>`; }
      else if (tab === 'grid') { const dept = ms('gdept', '내과'); const ds = days(5); const dl = docs().filter((d) => d.dept === dept);
        body = `<div class="gap-m">${UI.note('주간 일정표: 칸 하나 = 30분, 정원 2명. 숫자는 예약 수/정원입니다. 빈 칸을 누르면 바로 예약을 잡습니다. 회색은 진료가 없는 시간(수술·회진·휴진)입니다.', 'info')}
          ${UI.seg('rv.dept', [...new Set(docs().map((d) => d.dept))], dept)}
          ${dl.map((doc) => `<div class="box"><h4>${esc(doc.name)} 교수</h4><div class="tbl-wrap"><table class="tbl"><thead><tr><th>시각</th>${ds.map((d) => `<th>${d.slice(5)} (${DOW[dow(d)]})${off(doc.id, d) ? ' 휴진' : ''}</th>`).join('')}</tr></thead><tbody>${SLOTS.map((t) => `<tr><td class="num">${t}</td>${ds.map((d) => { if (!open(doc, d, t)) return '<td style="background:var(--surface-3)"></td>'; const n = booked(doc.id, d, t); return `<td>${n >= CAP ? `<span class="chip stat">${n}/${CAP} 마감</span>` : `<button class="btn sm ${n ? '' : 'pri'}" data-act="rv.slot" data-doc="${doc.id}" data-date="${d}" data-time="${t}">${n}/${CAP} 예약</button>`}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></div>`).join('')}</div>`; }
      else { const today = T.d(Date.now());
        S.where('appts', (a) => a.status === '예약' && a.date < today).forEach((a) => { a.status = '부도'; }); S.save();
        const ns = S.where('appts', (a) => a.status === '부도').sort((a, b) => b.date.localeCompare(a.date)); const req = recs('resvreq', (r) => r.status === '요청');
        const depts = [...new Set(S.all('appts').map((a) => a.dept))];
        const rep = depts.map((d) => { const l = S.where('appts', (a) => a.dept === d); const n = l.filter((a) => a.status === '부도').length; const lead = l.filter((a) => a.at).map((a) => (new Date(a.date + 'T09:00') - a.at) / DAY).filter((x) => x >= 0); return [d, l.length, n, l.length ? Math.round((n / l.length) * 100) : 0, lead.length ? (lead.reduce((s, x) => s + x, 0) / lead.length).toFixed(1) : '-']; });
        body = `<div class="gap-m">${UI.note('피드백: ① 예약 부도(노쇼) 환자에게 연락해 다시 잡고 이유를 기록 ② 전화·홈페이지로 들어온 변경 요청 처리 ③ 진료과에 예약 현황(부도율·예약 대기 일수)을 알려 진료 일정을 조정하게 합니다.', 'info')}
          ${UI.sec(`부도(노쇼) ${ns.length}건`)}${UI.table([{ h: '예약일' }, { h: '환자' }, { h: '진료과' }, { h: '연락 결과' }, { h: '' }], ns.map((a) => [`${esc(a.date)} ${esc(a.time)}`, esc(H.pat(a.pid).name), esc(a.dept), a.recall ? UI.chip(a.recall, a.recall === '재예약' ? 'done' : 'plain') : UI.chip('연락 전', 'stat'), a.recall ? '' : `<form data-submit="rv.ns" class="row" style="flex-wrap:nowrap;gap:.3rem"><input type="hidden" name="id" value="${a.id}"><select name="why" aria-label="부도 이유">${['잊어버림', '증상 좋아짐', '다른 병원 진료', '교통·일정 문제', '연락 안 됨'].map((x) => `<option>${x}</option>`).join('')}</select>${UI.btn('기록 + 재예약', '', { type: 'submit', size: 'sm', kind: 'pri' })}</form>`]), { empty: '<p class="muted small">부도가 없습니다</p>' })}
          ${UI.sec(`처리 요청 ${req.length}건`)}${UI.table([{ h: '요청 시각' }, { h: '환자·전화' }, { h: '경로' }, { h: '내용' }, { h: '' }], req.map((r) => [`<span class="num small">${T.mdhm(r.at)}</span>`, `${esc(r.patientId ? H.pat(r.patientId).name : '-')} <span class="small num">${esc(r.phone || '')}</span>`, esc(r.from), `<span class="small">${esc(r.text)}</span>`, UI.btn('처리 완료 (회신 문자)', 'rv.req', { size: 'sm', kind: 'pri', data: { id: r.id } })]), { empty: '<p class="muted small">요청이 없습니다</p>' })}
          ${UI.sec('진료과 예약 현황 보고')}${UI.table([{ h: '진료과' }, { h: '예약' }, { h: '부도' }, { h: '부도율' }, { h: '평균 예약 대기 (일)' }, { h: '' }], rep.map(([d, n, ns2, r, lead]) => [esc(d), n, ns2, r >= 10 ? UI.chip(`${r}%`, 'stat') : `${r}%`, lead, UI.btn('진료과에 보내기', 'rv.fb', { size: 'sm', data: { d, n, ns: ns2, r, lead } })]))}</div>`; }
      return `<div class="panel">${UI.tabs('rv.tab', [{ id: 'pat', label: '환자별 통합 조회' }, { id: 'grid', label: '주간 일정표 · 예약' }, { id: 'fb', label: '피드백 (부도·요청·보고)', cnt: (recs('resvreq', (r) => r.status === '요청').length + S.where('appts', (a) => (a.status === '부도' || (a.status === '예약' && a.date < T.d(Date.now()))) && !a.recall).length) || '' }], tab)}<div class="panel-b">${body}</div></div>`;
    },
    acts: {
      'rv.tab': (el) => { set('tab', el.dataset.v); A.render(); }, 'rv.dept': (el) => { set('gdept', el.dataset.v); A.render(); },
      'rv.pick': (f, d) => { set('pid', d.pid); A.render(); },
      'rv.go': (el) => { const p = H.pat(el.dataset.pid); set('gdept', (H.activeEnc(p.id) || {}).dept || '내과'); set('bookPid', p.id); set('tab', 'grid'); A.render(); },
      'rv.slot': (el) => { const doc = H.M.doctor(el.dataset.doc); const pid = ms('bookPid', ms('pid', '')); UI.modal({ title: `예약 — ${doc.dept} ${doc.name} ${el.dataset.date} ${el.dataset.time}`, size: 'narrow', body: `<form data-submit="rv.slotGo" class="gap-m"><input type="hidden" name="doc" value="${doc.id}"><input type="hidden" name="date" value="${el.dataset.date}"><input type="hidden" name="time" value="${el.dataset.time}">${UI.select('pid', '환자', S.all('patients').map((x) => ({ v: x.id, l: `${x.name} (${x.mrn})` })), pid)}${UI.fld('초진·재진', pick('visit', ['초진', '재진'], '재진'))}${UI.input('memo', '메모', '')}<div class="btn-row end">${UI.btn('예약 + 문자', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` }); },
      'rv.slotGo': (f, d) => { const doc = H.M.doctor(d.doc); if (booked(doc.id, d.date, d.time) >= CAP) return UI.toast('이미 마감되었습니다', 'err'); const dup = S.where('appts', (a) => a.pid === d.pid && a.date === d.date && a.dept === doc.dept && a.status === '예약'); if (dup.length) return UI.toast('같은 날 같은 진료과 예약이 이미 있습니다', 'warn'); book({ pid: d.pid, dept: doc.dept, doctorId: doc.id, date: d.date, time: d.time, visit: d.visit, memo: d.memo, via: '통합예약' }); UI.close(); UI.toast('예약 완료 — 확인 문자 발송', 'ok'); A.render(); },
      'rv.exam': (el) => { const o = S.get('orders', el.dataset.id); const it = H.M.item(o.code); const ds = days(7); UI.modal({ title: `검사 일정 — ${o.name}`, size: 'narrow', body: `<form data-submit="rv.examGo" class="gap-m"><input type="hidden" name="id" value="${o.id}">${UI.select('date', '날짜', ds, ds[0])}${UI.fld('시각', pick('time', ['08:00', '08:30', '09:00', '10:00', '11:00', '14:00', '15:00'], '08:30'))}${UI.note(it.contrast ? '조영제 검사: 4~6시간 금식, 당뇨약(메트포르민) 확인, 신장 기능 검사 결과 확인' : it.nm ? `핵의학: ${it.nm.fast ? '6시간 금식, ' : ''}주사 후 ${it.nm.wait}분 대기 — 시간 여유 있게` : '같은 날 진료가 있으면 검사를 먼저 잡습니다 (원스톱)', 'info')}<div class="btn-row end">${UI.btn('검사 예약 + 안내 문자', '', { type: 'submit', kind: 'pri', size: 'lg' })}</div></form>` }); },
      'rv.examGo': (f, d) => { const o = S.get('orders', d.id); const it = H.M.item(o.code); o.resv = { date: d.date, time: d.time }; if (o.cat === 'RAD' && !o.room) o.room = `${d.date.slice(5)} ${d.time}`; S.save(); const a = book({ pid: o.patientId, dept: o.cat === 'RAD' ? '영상의학과' : '기능검사실', doctorId: o.doctorId, date: d.date, time: d.time, kind: '검사', item: o.name, memo: it.contrast ? '4~6시간 금식' : it.nm && it.nm.fast ? '6시간 금식' : '', via: '통합예약', orderId: o.id }); void a; UI.close(); UI.toast('검사 예약 — 안내 문자를 보냈습니다', 'ok'); A.render(); },
      'rv.smsAll': (el) => { const p = H.pat(el.dataset.pid); const l = allOf(p.id).filter((x) => x.date >= T.d(Date.now()) && !['취소', '변경', '부도'].includes(x.status)); if (!l.length) return UI.toast('남은 일정이 없습니다', 'warn'); H.addRec('sms', p.id, { to: `${p.name} ${p.phone || ''}`, text: `[SSV병원] ${p.name}님 일정 안내: ${l.map((x) => `${x.date.slice(5)} ${x.time || ''} ${x.what}${x.memo ? `(${x.memo})` : ''}`).join(' / ')}` }); UI.toast('통합 일정 문자를 보냈습니다 (가상)', 'ok'); },
      'rv.ns': (f, d) => { const a = S.get('appts', d.id); a.recall = d.why === '연락 안 됨' ? '연락 안 됨' : '재예약'; a.nsWhy = d.why; S.save(); if (a.recall === '재예약') { const doc = H.M.doctor(a.doctorId); const nf = nextFree(doc); if (nf) book({ pid: a.pid, dept: a.dept, doctorId: a.doctorId, date: nf.date, time: nf.time, visit: a.visit, memo: a.memo, via: '부도 재예약' }); UI.toast(nf ? `재예약 ${nf.date} ${nf.time}` : '빈 시간이 없습니다', nf ? 'ok' : 'warn'); } else UI.toast('기록했습니다', 'ok'); A.render(); },
      'rv.req': (el) => { const r = S.get('recs', el.dataset.id); r.status = '완료'; S.save(); if (r.patientId) H.addRec('sms', r.patientId, { to: H.pat(r.patientId).name, text: '[SSV병원] 요청하신 예약 처리를 마쳤습니다. 자세한 일정은 문자로 다시 보내 드립니다.' }); UI.toast('요청 처리 완료', 'ok'); A.render(); },
      'rv.fb': (el) => { const x = el.dataset; H.notify('doctor', `[통합예약센터] ${x.d} 예약 현황: 예약 ${x.n}건, 부도 ${x.ns}건 (${x.r}%), 평균 예약 대기 ${x.lead}일 — 진료 일정 조정 검토 바랍니다`, {}); UI.toast(`${x.d}에 보고했습니다`, 'ok'); },
      'cc.move': (el) => H.mods.callctr.acts['cc.move'](el),
    },
  });
})();
