// 원무 실무 화면: 외래 등록, 입원 등록, 외래 수납, 입원 정산, 제증명 (상용 HIS 화면 배치)
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const T = H.t;
  const F = H.flow;
  const E = () => H.erp;
  const DAY = 86400000;
  const ms = (k, d) => A.ms(k, d); const set = (k, v) => A.set(k, v);
  const INS = ['건강보험', '의료급여 1종', '의료급여 2종', '산재보험', '자동차보험', '일반 (보험 없음)'];
  const DOCS = () => H.M.DOCTORS.filter((d) => !['마취통증의학과'].includes(d.dept));
  const patList = (title, filterFn) => {
    const q = (ms('q', '') || '').trim();
    const pats = S.all('patients').filter((p) => (!q || p.name.includes(q) || p.mrn.includes(q)) && (!filterFn || filterFn(p)));
    return { title, filter: `<div class="search fld">${H.icon('search')}<input class="inp" id="w-q" data-inp="w.q" value="${esc(q)}" placeholder="이름 또는 등록번호" aria-label="환자 찾기"></div>`,
      rows: pats.map((p) => { const e = H.activeEnc(p.id); return { pid: p.id, encId: e ? e.id : '', loc: p.mrn.slice(-5), name: p.name, sub: `${H.sexAge(p)} · ${esc(p.ins)}${e ? ` · ${e.type === 'OPD' ? '외래' : e.type === 'ER' ? '응급' : e.ward}` : ''}` }; }) };
  };
  const commonActs = {
    'w.q': (el) => { set('q', el.value); A.refreshList(); },
    'w.inf': (el) => { const p = A.pat(); const i = E().info(p); const c = el.dataset.c; i.infect = i.infect.includes(c) ? i.infect.filter((x) => x !== c) : [...i.infect, c]; S.save(); A.render(); },
    'w.verify': () => { const p = A.pat(); p.eligAt = Date.now(); S.save(); UI.toast(`수진자 자격 검증: ${p.name} — ${p.ins} 자격 유지 (가상 공단 조회)`, 'ok'); A.render(); },
    'w.idcheck': () => { const p = A.pat(); E().info(p).idAt = Date.now(); S.save(); UI.toast('본인 확인 완료 (신분증 대조) — 건강보험 본인확인 의무화', 'ok'); A.render(); },
    'w.consent': () => { const p = A.pat(); E().info(p).consent = true; S.save(); UI.toast('개인정보 수집·이용 동의 저장', 'ok'); A.render(); },
    'w.emr': () => { const p = A.pat(); const n = S.where('notes', (x) => x.patientId === p.id).sort((a, b) => b.at - a.at); UI.modal({ title: `EMR 조회 — ${p.name}`, size: 'wide', body: n.map((x) => `<div class="box"><b>${esc(x.type)}</b> <span class="small muted">${esc(x.by)} · ${T.dhm(x.at)}</span><div class="small pre">${esc(Object.values(x.content).join('\n'))}</div></div>`).join('') || UI.empty('기록이 없습니다') }); },
    'w.proxy': () => UI.modal({ title: '대리처방 확인서', size: 'narrow', body: `<form data-submit="w.proxyGo" class="gap-m">${UI.input('who', '대리인 이름', '')}${UI.select('rel', '관계', ['배우자', '직계 존속', '직계 비속', '형제자매', '노인의료복지시설 종사자'], '배우자')}${UI.check('doc', '대리인 신분증·가족관계 증명 확인', false)}<div class="btn-row end">${UI.btn('저장', '', { type: 'submit', kind: 'pri' })}</div></form>` }),
    'w.proxyGo': (f, d) => { if (!d.doc || !d.who) return UI.toast('대리인과 증명 서류를 확인하세요', 'warn'); E().info(A.pat()).proxy = d; S.save(); UI.close(); UI.toast('대리처방 확인서 저장', 'ok'); },
  };
  const insFields = (p) => { const i = E().info(p); return E().fields([
    { l: '보험유형', n: 'ins', v: p.ins, opts: INS, t: 'key' }, { l: '보험자기호', n: 'e_insCode', v: i.insCode, t: 'warn' }, { l: '보험자명칭', n: 'e_insOrg', v: i.insOrg }, { l: '보험증번호', n: 'e_insNo', v: i.insNo },
    { l: '피보험자성명', n: 'e_holder', v: i.holder }, { l: '피보주민번호', n: 'e_holderRrn', v: i.holderRrn }, { l: '피보험자관계', n: 'e_rel', v: i.rel, opts: ['본인', '배우자', '자녀', '부모', '형제자매', '기타'] },
    { l: '자격 검증', html: `${UI.btn('수진자 자격 검증', 'w.verify', { size: 'sm', icon: 'check' })}<span class="small muted">${p.eligAt ? T.mdhm(p.eligAt) : '안 함'}</span>` },
  ], { cols: '14rem' }); };
  const discFields = (pre = '') => E().fields([
    { l: '할인코드', n: pre + 'discCode', v: '', opts: ['없음', '직원 본인 (비급여 50%)', '직원 가족 (비급여 30%)', '협력기관 (비급여 10%)', '사회사업 감면'] }, { l: '접수구분', n: pre + 'recvType', v: '일반접수', opts: ['일반접수', '예약접수', '당일의뢰', '응급경유'] },
    { l: '직원번호', n: pre + 'empNo', v: '' }, { l: '직원성명', n: pre + 'empName', v: '' }, { l: '근무부서', n: pre + 'empDept', v: '' }, { l: '관계', n: pre + 'empRel', v: '', opts: ['', '본인', '배우자', '자녀', '부모'] },
  ], { cols: '14rem' });
  const saveIns = (p, d) => { const i = E().info(p); if (d.ins) p.ins = d.ins; ['insCode', 'insOrg', 'insNo', 'holder', 'holderRrn', 'rel'].forEach((k) => { if (d['e_' + k] != null) i[k] = d['e_' + k]; }); };

  // ───────── 외래 등록 ─────────
  H.reg({
    id: 'opdreg', title: '외래 등록', actor: '원무과 (외래 접수)', layout: 'patient', channels: () => ['reg'],
    list: () => patList('환자 찾기'),
    render() {
      const p = A.pat();
      if (!p) return `<div class="panel"><div class="panel-b">${UI.empty('왼쪽에서 환자를 고르세요 (구환)', '처음 온 환자(신환)는 "원무 접수 → 신규 환자 등록"에서 등록합니다.')}${UI.btn('신환 등록 화면으로', 'map.go', { kind: 'pri', data: { v: 'reg' } })}</div></div>`;
      const i = E().info(p); const fresh = ms('fresh', null);
      const docId = ms('doc', 'dr1'); const doc = H.M.doctor(docId);
      const hist = S.where('encounters', (e) => e.patientId === p.id).sort((a, b) => b.at - a.at);
      const visit = hist.some((e) => e.type === 'OPD' && e.dept === doc.dept) ? '재진' : '초진';
      const lastEr = hist.find((e) => e.type === 'ER');
      const consult = (visit === '초진' ? H.fee.BASE.new : H.fee.BASE.re).price;
      const r = H.fee.rateInfo(p, { type: 'OPD' });
      const cself = String(p.ins).startsWith('건강') && !p.special ? consult : r.flatOpd != null ? Math.min(consult, r.flatOpd) : Math.floor((consult * r.opd) / 10) * 10;
      return `<form data-submit="or2.save" class="erp">
        ${E().bar([{ l: '구환', act: 'or2.noop', kind: 'pri' }, { l: '신환', act: 'map.go', data: { v: 'reg' } }, '|', E().infect(p, 'w.inf'), '|', { l: '본인확인', act: 'w.idcheck' }, { l: '대리처방 확인서', act: 'w.proxy' }, { l: '정보동의', act: 'w.consent' }, { l: 'EMR 조회', act: 'w.emr' }])}
        ${i.idAt ? '' : UI.note('본인 확인 안 됨 — 건강보험 진료 시 신분증으로 본인 확인이 필요합니다 (2024년 5월부터 의무).', 'warn')}
        ${E().patFields(p)}
        <div class="erp-cols3">
          <div class="gap-s"><div class="erp-sec">외래 보험 이력</div>${insFields(p)}<div class="erp-sec">할인 이력</div>${discFields()}
            <div class="box small">※ 전화예약·인터넷예약·재진예약 환자의 수납은 외래 수납에서 처리합니다.</div></div>
          <div class="gap-s">
            ${E().bar([{ l: '급여 의뢰서', act: 'or2.refdoc' }, { l: '수가 계산', act: 'or2.calc', kind: 'warn' }, { l: '저장 (접수)', act: '', kind: 'pri' }])}
            <div class="erp-bar">${[['독감 예방접종 (직원)', 'dr1', '예방접종'], ['일반내과 + 주', 'dr1', '재진'], ['순환기내과', 'dr2', '재진'], ['외과', 'dr3', '초진'], ['Chart Copy (지난 진료 복사)', '', '']].map(([l, d, v]) => `<button type="button" class="btn sm" data-act="or2.quick" data-doc="${d}" data-v="${v}">${esc(l)}</button>`).join('')}</div>
            ${E().fields([
              { l: '진료일자', txt: T.d(Date.now()), t: 'key' }, { l: '진료과·의사', n: 'doc', v: docId, opts: DOCS().map((d) => ({ v: d.id, l: `${d.dept} ${d.name}` })), t: 'key' },
              { l: '진료시간', txt: T.hm(Date.now()), t: 'key' }, { l: '진료형태', txt: '외래' },
              { l: '주부유형', n: 'main', v: '주', opts: ['주 (주 진료과)', '부 (같은 날 두 번째 과)'] }, { l: '선택·일반', txt: '일반 (선택진료 2018년 폐지)' },
              { l: '보험유형', txt: p.ins, t: 'key' }, { l: '보험기호', txt: i.insCode || '-' },
              { l: '유형보조', n: 'sub', v: p.special ? p.special.code : '', opts: ['', 'V193 암', 'V191 뇌혈관', 'V192 심장', 'V001 투석', 'V800 희귀', '차상위 1종', '차상위 2종'], t: 'key' }, { l: '진찰료', n: 'fee', v: 'Y', opts: [{ v: 'Y', l: 'YES (받음)' }, { v: 'N', l: 'NO (같은 날 재방문·검사만)' }], t: 'calc' },
              { l: '보조사유', n: 'subWhy', v: '', opts: ['', '중증 등록', '희귀 지원', '임신부', '6세 미만', '65세 이상'] }, { l: '초·재진', n: 'visit', v: fresh && fresh.visit || visit, opts: ['초진', '재진', '예방접종'], t: 'calc' },
              { l: '분업예외', n: 'divEx', v: '00', opts: ['00 해당 없음', '01 원내 조제', '02 응급 환자', '05 장애인'] }, { l: '검사구분', n: 'testType', v: '일반', opts: ['일반', '검사만', '검진'] },
              { l: '직원할인', n: 'empDisc', v: '', opts: ['', '직원 본인', '직원 가족'], t: 'calc' }, { l: '가예약일', n: 'tempAppt', v: '', type: 'date' },
              { l: '오신 이유', n: 'cc', v: '', w: 2, t: 'req' },
            ])}
            <div class="erp-sec">응급실 내원 사항</div>${E().fields([{ l: '퇴실일자', txt: lastEr && lastEr.endAt ? T.d(lastEr.endAt) : '-' }, { l: '퇴실시간', txt: lastEr && lastEr.endAt ? T.hm(lastEr.endAt) : '-' }, { l: '진료과', txt: lastEr ? lastEr.dept : '-' }])}
            <div class="erp-sec">의뢰 환자 내원 사항</div>${E().fields([{ l: '의뢰병원', n: 'refHosp', v: '' }, { l: '의뢰의사', n: 'refDoc', v: '' }, { l: '요양기호', n: 'refCode', v: '' }, { l: '의뢰서', n: 'refPaper', v: '', opts: ['', '서류 접수함', '전자 의뢰서'] }, { l: '정보공개', n: 'refInfo', v: '', opts: ['', '정보 공개 미동의'] }, { l: '기타', n: 'refEtc', v: '', opts: ['', '요양병원 입원 + 산정특례', '가정간호'] }])}
          </div>
          ${E().money([{ k: '총 진료비', v: consult, cls: 'bold' }, { k: '급여액', v: consult }, { k: '본인부담액', v: cself }, { k: '보험자부담액', v: consult - cself }, { k: '장애기금', v: 0 }, { k: '대불액', v: 0, cls: 'b' }, { k: '보험100', v: 0 }, { k: '비급여액', v: 0 }, { k: '선택진료액', v: 0 }, { k: '본인부담총액', v: cself, cls: 'bold' }, { k: '할인액', v: 0, cls: 'y' }, { k: '감액', v: 0, cls: 'y' }, { k: '기수납액', v: 0, cls: 'y' }, { k: '미수액', v: 0 }, { k: '카드결제액', v: 0 }, { k: '통장입금액', v: 0 }, { k: '현금수납액', v: 0, cls: 'dark' }, { k: '절사액', v: 0 }])}
        </div>
        <div class="erp-sec">외래 내원 이력</div>
        ${E().grid([{ h: '진료일자' }, { h: '시간' }, { h: '입원' }, { h: '진료과' }, { h: '의사' }, { h: '선택' }, { h: '주/부' }, { h: '초/재' }, { h: '유형' }, { h: '보조' }, { h: '보험자기호' }, { h: '진찰료' }, { h: '할인' }, { h: '예외' }, { h: '형태' }, { h: '상태' }, { h: '접수' }, { h: '검사' }, { h: '퇴원일' }],
          hist.map((e) => [T.d(e.at), T.hm(e.at), e.type === 'IPD' ? 'Y' : '', esc(e.dept), esc(H.M.doctor(e.doctorId).name), '일반', (e.reg || {}).main || '주', esc(e.visit || (e.type === 'OPD' ? '초진' : '-')), esc(p.ins), esc(p.special ? p.special.code : ''), esc(i.insCode || ''), (e.reg || {}).fee || 'Y', (e.reg || {}).empDisc || '', (e.reg || {}).divEx ? e.reg.divEx.slice(0, 2) : '00', { OPD: '외래', ER: '응급', IPD: '입원' }[e.type], esc(e.status), (e.reg || {}).recvType || '일반', (e.reg || {}).testType || '일반', e.endAt ? T.d(e.endAt) : '']), { h: '14rem', empty: '내원 이력이 없습니다' })}
      </form>`;
    },
    acts: Object.assign({}, commonActs, {
      'or2.noop': () => {},
      'or2.quick': (el) => { if (!el.dataset.doc) { const p = A.pat(); const last = S.where('encounters', (e) => e.patientId === p.id && e.type === 'OPD').sort((a, b) => b.at - a.at)[0]; if (!last) return UI.toast('복사할 지난 외래 진료가 없습니다', 'warn'); set('doc', last.doctorId); set('fresh', { visit: '재진' }); UI.toast('지난 진료 정보를 불러왔습니다', 'ok'); A.render(); return; } set('doc', el.dataset.doc); set('fresh', { visit: el.dataset.v }); A.render(); },
      'or2.calc': () => UI.toast('수가 계산 — 오른쪽 금액 칸에 진찰료가 계산되었습니다 (상급종합 외래 진찰료는 건강보험도 전액 본인부담)', ''),
      'or2.refdoc': () => UI.toast('급여 의뢰서: 1단계(의원·병원) 진료의뢰서가 있어야 상급종합병원 진료에 건강보험이 적용됩니다 (응급·분만·치과·재활·가정의학과 등 예외)', 'warn'),
      'or2.save': (f, d) => {
        const p = A.pat(); E().savePat(p, d); saveIns(p, d);
        if (H.activeEnc(p.id)) return UI.toast('이미 진행 중인 진료가 있습니다 (부 진료는 같은 날 두 번째 과로 접수)', 'warn');
        const doc = H.M.doctor(d.doc);
        const qno = S.where('encounters', (e) => e.type === 'OPD' && e.doctorId === doc.id && e.at >= T.startOfDay()).length + 1;
        S.add('encounters', { id: H.uid('en'), patientId: p.id, type: 'OPD', dept: doc.dept, doctorId: doc.id, status: '대기', at: Date.now(), qno, visit: d.visit, cc: d.cc || '외래 진료', dx: [], reg: { main: d.main.slice(0, 1), fee: d.fee, subWhy: d.subWhy, divEx: d.divEx, testType: d.testType, empDisc: d.empDisc, tempAppt: d.tempAppt, recvType: d.recvType, discCode: d.discCode, ref: d.refHosp ? { hosp: d.refHosp, doc: d.refDoc, code: d.refCode, paper: d.refPaper } : null } });
        if (d.refHosp && !d.refPaper) UI.toast('의뢰서가 없으면 상급종합병원 진료비에 건강보험이 안 될 수 있습니다', 'warn');
        H.notify('doctor', `외래 접수: ${p.name} (${doc.dept} 대기 ${qno}번)`, { patientId: p.id }); H.notify('opd', `외래 접수: ${p.name} — 진료 전 준비`, { patientId: p.id });
        H.log('외래 등록', `${p.name} ${doc.dept} ${d.visit}`, p.id); set('fresh', null); UI.toast(`${p.name} 외래 등록 — ${doc.dept} 대기 ${qno}번`, 'ok'); A.render();
      },
      'map.go': (el) => A.go(el.dataset.v),
    }),
  });

  // ───────── 입원 등록 ─────────
  H.reg({
    id: 'admreg', title: '입원 등록', actor: '원무과 (입퇴원)', layout: 'patient', channels: () => ['reg'],
    list: () => patList('환자 찾기'),
    render() {
      const p = A.pat();
      const reqs = S.where('admreq', (r) => r.status === '대기');
      if (!p) return `<div class="panel"><div class="panel-b gap-m">${UI.empty('왼쪽에서 환자를 고르거나 입원 예약을 조회하세요')}${E().grid([{ h: '결정 시각' }, { h: '환자' }, { h: '어디서' }, { h: '진료과' }, { h: '희망 병동' }], reqs.map((r) => ({ cells: [T.mdhm(r.at), esc(H.pat(r.patientId).name), esc(r.from), esc(r.dept), esc(r.ward || '')], act: 'ar.req', data: { id: r.id } })), { empty: '입원 결정 환자가 없습니다' })}</div></div>`;
      const i = E().info(p); const req = reqs.find((r) => r.patientId === p.id);
      const ward = ms('ward', req ? req.ward || '7A' : '7A'); const beds = H.freeBeds(ward);
      const todays = S.where('encounters', (e) => e.patientId === p.id && e.at >= T.startOfDay() - DAY);
      const opdPaid = S.where('bills', (b) => b.patientId === p.id && b.at >= T.startOfDay() && b.kind === '외래 수납').reduce((s, b) => s + b.paid, 0);
      const docId = req ? req.doctorId : ms('doc', 'dr1');
      const mother = p.bornAt ? S.all('patients').find((m) => p.name.startsWith(m.name)) : null;
      return `<form data-submit="ar.save" class="erp">
        ${E().bar([{ l: '구환', act: 'or2.noop', kind: 'pri' }, '|', { l: '개인정보동의', act: 'w.consent' }, { l: '입원약정서', act: 'ar.contract' }, { l: '보증인 입력', act: 'ar.guar' }, { l: '안내장', act: 'ar.guide' }, { l: '본인확인', act: 'w.idcheck' }, { l: '재원환자 관리', act: 'map.go', data: { v: 'ipdpay' } }])}
        <div class="row"><label class="chk"><input type="checkbox" name="nurseCare">간호·간병 통합서비스 (포괄간호) 입원</label><label class="chk"><input type="checkbox" name="periodRoom">기간 상급병실</label><label class="chk"><input type="checkbox" name="hideRoom">병실 비공개</label>${E().infect(p, 'w.inf')}</div>
        ${E().patFields(p)}
        ${E().fields([{ l: '산모번호', txt: mother ? mother.mrn : '-' }, { l: '산모성명', txt: mother ? mother.name : '-' }, { l: '출산일자', txt: p.bornAt ? T.d(p.bornAt) : '-' }, { l: '입원환자 메모', n: 'admMemo', v: (i.admMemo || ''), w: 2 }])}
        <div class="erp-sec">당일 외래 내원 이력</div>
        ${E().grid([{ h: '입원' }, { h: '진료일자' }, { h: '시간' }, { h: '진료과' }, { h: '진료의사' }, { h: '주/부' }, { h: '초/재' }, { h: '유형' }, { h: '형태' }, { h: '상태' }], todays.map((e) => [e.type === 'IPD' ? 'Y' : '', T.d(e.at), T.hm(e.at), esc(e.dept), esc(H.M.doctor(e.doctorId).name), '주', esc(e.visit || ''), esc(p.ins), { OPD: '외래', ER: '응급', IPD: '입원' }[e.type], esc(e.status)]), { h: '8rem', empty: '당일 내원 이력 없음' })}
        ${E().bar([{ l: '상병 조회', act: 'ar.dx' }, { l: '입원 예약 조회', act: 'ar.reqs' }, { l: '입원 등록', act: '', kind: 'pri' }, { l: '강제 승인 취소', act: 'or2.noop', disabled: true }])}
        ${req ? UI.note(`입원 결정: ${esc(req.from)} → ${esc(req.dept)} ${esc(H.M.doctor(req.doctorId).name)} (${esc(req.why || '')})`, 'info') : ''}
        <input type="hidden" name="req" value="${req ? req.id : ''}">
        <div class="erp-cols3">
          <div class="gap-s"><div class="erp-sec">보험 내역</div>${insFields(p)}<div class="erp-sec">할인 내역</div>${discFields()}</div>
          <div class="gap-s"><div class="erp-sec">입원 등록 내역</div>${E().fields([
            { l: '입원일자', txt: T.d(Date.now()), t: 'key' }, { l: '입원경로', n: 'route', v: req && req.from.includes('응급') ? '응급실' : '외래', opts: ['외래', '응급실', '다른 병원 전원', '분만'] },
            { l: '입원시간', txt: T.hm(Date.now()), t: 'key' }, { l: '도착경로', n: 'arrive', v: '기타', opts: ['기타', '걸어서', '휠체어', '침대차', '구급차'] },
            { l: '진료과·Staff', n: 'doc', v: docId, opts: DOCS().map((d) => ({ v: d.id, l: `${d.dept} ${d.name}` })), t: 'key' }, { l: '병동', html: UI.seg('ar.ward', ['7A', '8B', 'ICU', 'LD'].map((w) => ({ v: w, l: w })), ward) },
            { l: '병실·침상', n: 'bed', v: '', opts: beds.map((b) => ({ v: `${b.room}-${b.bed}`, l: `${b.room}호 ${b.bed}번` })), t: 'key' }, { l: '병실등급', n: 'grade', v: '다인실 (4인실, 보험 적용)', opts: ['다인실 (4인실, 보험 적용)', '2인실 (상급병실료 차액)', '1인실 (상급병실료 차액)', '격리실 (보험 적용)'], t: 'calc' },
            { l: '주/부', n: 'main', v: '주', opts: ['주', '부'] }, { l: '병실형태', n: 'roomForm', v: '일반', opts: ['일반', '격리', '음압 격리', '간호·간병 통합'] },
            { l: '보험유형', txt: p.ins, t: 'key' }, { l: '보험기호', txt: i.insCode || '-' },
            { l: '유형보조', txt: p.special ? `${p.special.code} 산정특례` : '-' }, { l: '보조사유', n: 'subWhy', v: '', opts: ['', '중증 등록', '희귀 지원', '임신부', '신생아'] },
            { l: '계산방법', n: 'calcType', v: '개별수가 (행위별)', opts: ['개별수가 (행위별)', '포괄수가 (7개 질병군 DRG)', '신포괄 수가'], t: 'calc' }, { l: 'DRG 대상', n: 'drg', v: '', opts: ['', '충수절제술', '제왕절개 분만', '자궁·자궁부속기 수술', '탈장 수술', '항문 수술', '편도 수술', '수정체 수술'] },
            { l: '직원할인', n: 'empDisc', v: '', opts: ['', '직원 본인', '직원 가족'] }, { l: '분업예외', n: 'divEx', v: '00', opts: ['00 해당 없음'] },
            { l: '진찰료', n: 'fee', v: '미계산', opts: ['미계산', '입원 첫날 산정'] }, { l: '구간유형', n: 'zone', v: '', opts: ['', '감면 구간', '상한제 구간'] },
            { l: '입원확정', n: 'confirm', v: 'Y', opts: [{ v: 'Y', l: 'Yes' }, { v: 'N', l: 'No (예약만)' }], t: 'key' }, { l: '본원출생', n: 'born', v: p.bornAt ? 'Y' : 'N', opts: [{ v: 'Y', l: 'Yes' }, { v: 'N', l: 'No' }] },
          ], { cols: '14rem' })}
            <div class="erp-sec">의뢰 환자 내원 사항</div>${E().fields([{ l: '의뢰병원', n: 'refHosp', v: '' }, { l: '의뢰의사', n: 'refDoc', v: '' }, { l: '정보제공', n: 'refInfo', v: '동의', opts: ['동의', '미동의'] }])}</div>
          <div class="gap-s"><div class="erp-sec">외래 전환금</div>${E().fields([{ l: '입금구분', txt: '외래금' }, { l: '당일 외래 낸 돈', txt: H.won(opdPaid) }, { l: '전환할 카드', n: 'convCard', v: 0, type: 'number' }, { l: '전환할 현금', n: 'convCash', v: 0, type: 'number' }], { cols: '100%' })}
            <div class="erp-sec">보증금 (입원 예치금)</div>${E().fields([{ l: '적용일자', txt: T.d(Date.now()) }, { l: '입금구분', txt: '보증금' }, { l: '계산방법', txt: '개별수가' }, { l: '카드결제액', n: 'depCard', v: 0, type: 'number', t: 'key' }, { l: '현금입금액', n: 'depCash', v: 0, type: 'number', t: 'key' }], { cols: '100%' })}
            <div class="box small">보증금·외래 전환금은 퇴원 정산 때 "기납입액"으로 빠집니다. 의료급여·산재는 보통 보증금이 없습니다.</div></div>
        </div></form>`;
    },
    acts: Object.assign({}, commonActs, {
      'or2.noop': () => {}, 'map.go': (el) => A.go(el.dataset.v),
      'ar.req': (el) => { const r = S.get('admreq', el.dataset.id); A.st.pid = r.patientId; A.st.encId = r.fromEnc; set('ward', r.ward || '7A'); A.render(); },
      'ar.reqs': () => { const reqs = S.where('admreq', (r) => r.status === '대기'); UI.modal({ title: '입원 예약 조회', size: 'wide', body: E().grid([{ h: '결정' }, { h: '환자' }, { h: '어디서' }, { h: '진료과·의사' }, { h: '희망 병동' }, { h: '사유' }], reqs.map((r) => ({ cells: [T.mdhm(r.at), esc(H.pat(r.patientId).name), esc(r.from), `${esc(r.dept)} ${esc(H.M.doctor(r.doctorId).name)}`, esc(r.ward || ''), esc(r.why || '')], act: 'ar.reqPick', data: { id: r.id } })), { empty: '입원 결정 환자가 없습니다' }) }); },
      'ar.reqPick': (el) => { const r = S.get('admreq', el.dataset.id); UI.close(); A.st.pid = r.patientId; A.st.encId = r.fromEnc; set('ward', r.ward || '7A'); A.render(); },
      'ar.ward': (el) => { set('ward', el.dataset.v); A.render(); },
      'ar.dx': () => { const p = A.pat(); const e = S.where('encounters', (x) => x.patientId === p.id).sort((a, b) => b.at - a.at)[0]; UI.modal({ title: '상병 조회', size: 'narrow', body: (e && e.dx || []).map((x) => `<div>${x.main ? '주) ' : '부) '}<span class="mono">${esc(x.code)}</span> ${esc(x.name)}</div>`).join('') || '상병이 없습니다' }); },
      'ar.contract': () => UI.modal({ title: '입원 약정서', body: `<div class="paper"><h2>입 원 약 정 서</h2><p style="font-size:.85rem">본인은 SSV 병원에 입원함에 있어 병원의 제반 규칙을 준수하며, 진료비는 퇴원 시 또는 병원이 정한 날짜에 납부할 것을 약정합니다. 개인정보 수집·이용과 진료기록 열람 범위에 동의합니다.</p><table><tr><th>환자</th><td>${esc(A.pat().name)}</td><th>약정일</th><td>${T.d(Date.now())}</td></tr><tr><th>연대보증인</th><td colspan="3">${esc((E().info(A.pat()).guar || {}).name || '(보증인 입력 필요)')}</td></tr></table><p style="font-size:.72rem;color:#555">※ 교육용 가상 서식</p></div>`, foot: UI.btn('서명 받음', 'ar.contractOk', { kind: 'pri' }) }),
      'ar.contractOk': () => { E().info(A.pat()).contract = Date.now(); S.save(); UI.close(); UI.toast('입원 약정서 서명 저장', 'ok'); },
      'ar.guar': () => UI.modal({ title: '보증인 입력', size: 'narrow', body: `<form data-submit="ar.guarGo" class="gap-m">${UI.input('name', '보증인 성명', '')}${UI.select('rel', '관계', ['배우자', '자녀', '부모', '형제자매', '기타'], '자녀')}${UI.input('tel', '연락처', '')}<div class="btn-row end">${UI.btn('저장', '', { type: 'submit', kind: 'pri' })}</div></form>` }),
      'ar.guarGo': (f, d) => { E().info(A.pat()).guar = d; S.save(); UI.close(); UI.toast('보증인 저장', 'ok'); },
      'ar.guide': () => UI.modal({ title: '입원 생활 안내장', body: `<ul style="line-height:1.9"><li>회진 시간: 오전 8시·오후 5시</li><li>식사: 7시 30분·12시·5시 30분</li><li>면회: 정해진 시간, 보호자 1인 상주 (간호·간병 통합 병동은 상주 불가)</li><li>귀중품은 원무과 보관</li><li>퇴원 수납: 퇴원 결정 후 퇴원 심사 → 원무과 수납</li></ul>` }),
      'ar.save': (f, d) => {
        const p = A.pat(); E().savePat(p, d); saveIns(p, d);
        if (d.confirm === 'N') return UI.toast('입원확정 No — 입원 예약만 저장했습니다', 'ok');
        if (!d.bed) return UI.toast('빈 병상이 없습니다. 병동을 바꾸세요', 'warn');
        if (!E().info(p).contract) UI.toast('입원 약정서 서명을 받지 않았습니다', 'warn');
        const [room, bed] = d.bed.split('-'); const ward = ms('ward', '7A'); const doc = H.M.doctor(d.doc);
        const req = d.req ? S.get('admreq', d.req) : null; const src = req && req.fromEnc ? H.enc(req.fromEnc) : null;
        const e = S.add('encounters', { id: H.uid('en'), patientId: p.id, type: 'IPD', dept: doc.dept, doctorId: doc.id, status: '입원중', at: Date.now(), ward, room, bed, roomType: d.grade, dx: src ? (src.dx || []).slice() : [], cc: src ? src.cc : '', diet: '', fromEnc: src ? src.id : null,
          adm: { route: d.route, arrive: d.arrive, main: d.main, roomForm: d.roomForm, calcType: d.calcType, drg: d.drg, nurseCare: !!d.nurseCare, empDisc: d.empDisc, zone: d.zone, ref: d.refHosp } });
        if (src) { src.status = '입원'; src.endAt = Date.now(); }
        if (req) { req.status = '완료'; req.toEnc = e.id; }
        const no = () => `R${T.d(Date.now()).replace(/-/g, '').slice(2)}-${String(S.all('bills').length + 1).padStart(5, '0')}`;
        const dep = (Number(d.depCard) || 0) + (Number(d.depCash) || 0);
        if (dep) S.add('bills', { id: H.uid('bl'), no: no(), encId: e.id, patientId: p.id, kind: '보증금', at: Date.now(), total: 0, ins: 0, self: 0, non: 0, paid: dep, method: d.depCard > 0 ? '신용카드' : '현금', pay: { card: Number(d.depCard) || 0, cash: Number(d.depCash) || 0 }, by: H.who(), payer: '-' }, true);
        const conv = (Number(d.convCard) || 0) + (Number(d.convCash) || 0);
        if (conv) S.add('bills', { id: H.uid('bl'), no: no(), encId: e.id, patientId: p.id, kind: '외래 전환금', at: Date.now(), total: 0, ins: 0, self: 0, non: 0, paid: conv, method: '전환', by: H.who(), payer: '-' }, true);
        E().info(p).admMemo = d.admMemo; S.save();
        H.notify('ward:' + ward, `새 입원: ${p.name} (${room}-${bed}${d.nurseCare ? ', 간호·간병 통합' : ''}) — 처방 확인·초기 간호사정`, { patientId: p.id });
        H.notify('doctor', `입원 완료: ${p.name} ${ward} ${room}-${bed} — 입원 처방`, { patientId: p.id });
        H.log('입원 등록', `${p.name} → ${ward} ${room}-${bed} (보증금 ${dep})`, p.id); A.st.encId = e.id; UI.toast(`${p.name} 입원 등록 — ${ward} ${room}호 ${bed}번${dep ? ` · 보증금 ${H.won(dep)}` : ''}`, 'ok'); A.render();
      },
    }),
  });

  // ───────── 수납 공통 (외래 수납·입원 정산) ─────────
  function payPanel(c, st) {
    const v = E().payCalc(c, st);
    const card = Number(st.p_card) || 0, bank = Number(st.p_bank) || 0; const cash = Math.max(0, v.due - card - bank);
    return { v, card, bank, cash, html: E().money([
      { k: '총 진료비', v: c.total, cls: 'bold' }, { k: '급여액', v: c.pay }, { k: '본인부담액', v: c.self }, { k: '보험자부담액', v: c.ins }, { k: '장애기금', v: 0 }, { k: '대불액', v: 0, cls: 'b' }, { k: '보험100 (전액본인)', v: 0 }, { k: '비급여액', v: c.non }, { k: '선택진료액', v: 0 },
      { k: '본인부담총액', v: c.totalSelf, cls: 'bold' }, { k: '할인액', cls: 'y', input: { n: 'p_disc', v: st.p_disc || 0, on: 'pay.re' } }, { k: '수혈 청구액', cls: 'y', input: { n: 'p_blood', v: st.p_blood || 0, on: 'pay.re' } }, { k: '감액', cls: 'y', input: { n: 'p_red', v: st.p_red || 0, on: 'pay.re' } },
      { k: '산전지원 (국민행복카드)', cls: 'y', input: { n: 'p_sanjeon', v: st.p_sanjeon || 0, on: 'pay.re' } }, { k: '기납입액', v: c.prepaid, cls: 'y' }, { k: '미수액', cls: 'p', input: { n: 'p_misu', v: st.p_misu || 0, on: 'pay.re' } }, 'hr',
      { k: '카드결제액', input: { n: 'p_card', v: card, on: 'pay.re' } }, { k: '통장입금액', input: { n: 'p_bank', v: bank, on: 'pay.re' } }, { k: '현금수납액', v: cash, cls: 'dark' }, { k: '절사액 (10원 미만)', v: v.cut },
      { k: '수납액', v: v.due, cls: 'red' },
      ...(c.prepaid > c.totalSelf ? [{ k: '환불할 금액 (보증금 차액)', v: c.prepaid - c.totalSelf, cls: 'p' }] : []),
    ]) };
  }
  function payState() { return ms('pay_' + A.st.encId, {}) || {}; }
  const payActs = {
    'pay.re': (el) => { const st = payState(); st[el.name] = el.value; set('pay_' + A.st.encId, st); clearTimeout(window.__payT); window.__payT = setTimeout(() => { const y = window.scrollY; A.render(); window.scrollTo(0, y); const i = document.querySelector(`[name="${el.name}"]`); if (i) { i.focus(); const n = i.value.length; try { i.setSelectionRange(n, n); } catch (x) { /* number */ } } }, 700); },
    'pay.cashRcpt': (el) => { const st = payState(); st.rcpt = el.value; set('pay_' + A.st.encId, st); },
  };
  function doPay(kind, final) {
    const e = A.enc(); const p = H.pat(e.patientId); const c = H.fee.calc(e); const st = payState();
    const { v, card, bank, cash } = payPanel(c, st);
    if (card + bank > v.due) return UI.toast('카드·통장 금액이 수납액보다 많습니다', 'err');
    const no = `R${T.d(Date.now()).replace(/-/g, '').slice(2)}-${String(S.all('bills').length + 1).padStart(5, '0')}`;
    const b = S.add('bills', { id: H.uid('bl'), no, encId: e.id, patientId: p.id, kind, at: Date.now(), total: c.total, ins: c.ins, self: c.self, non: c.non, paid: v.due - Math.max(0, c.prepaid - c.totalSelf), refund: Math.max(0, c.prepaid - c.totalSelf), method: [card ? '신용카드' : '', bank ? '계좌이체' : '', cash ? '현금' : ''].filter(Boolean).join('+') || '없음 (0원)', by: H.who(), payer: c.r.payer, label: c.r.label, groups: c.groups,
      pay: { card, bank, cash, disc: v.disc, red: v.red, misu: v.misu, blood: v.blood, sanjeon: v.sanjeon, cut: v.cut, rcpt: st.rcpt || '', rcptNo: st.rcptNo || '' } });
    if (final) {
      e.billed = Date.now(); if (e.fromEnc) { const s0 = H.enc(e.fromEnc); if (s0) s0.billed = Date.now(); }
      if (e.type === 'IPD') { e.status = '퇴원'; e.endAt = e.endAt || Date.now(); H.notify('ward:' + e.ward, `퇴원 수납 완료: ${p.name} — 퇴원 가능`, { patientId: p.id }); H.notify('mrd', `퇴원: ${p.name}`, { patientId: p.id }); }
      H.notify('review', `수납 완료: ${p.name} (${kind}) — 청구 대상`, { patientId: p.id });
    }
    if (v.misu) H.notify('billing', `미수 발생: ${p.name} ${H.won(v.misu)} — 미수 알림톡 대상`, { patientId: p.id });
    set('pay_' + e.id, {}); S.save(); H.log(kind, `${p.name} ${H.won(v.due)} (카드 ${card}/통장 ${bank}/현금 ${cash}, 미수 ${v.misu})`, p.id);
    UI.toast(`${kind} 완료 — ${b.refund ? `보증금 차액 ${H.won(b.refund)} 환불 (보증금 낸 카드 취소 또는 계좌 입금)` : H.won(v.due)}${v.misu ? ` · 미수 ${H.won(v.misu)}` : ''}`, 'ok'); A.render();
    UI.modal({ title: '진료비 계산서·영수증', size: 'wide', body: H.fee.receipt(H.fee.calc(e), b) });
  }
  function procTabs(e, c, tab) {
    const ords = S.where('orders', (o) => o.encId === e.id || o.encId === e.fromEnc).sort((a, b) => a.at - b.at);
    const lines = c.lines.map(E().lineDetail);
    const bills = S.where('bills', (b) => b.encId === e.id);
    const body = {
      act: () => E().grid([{ h: '수익구분' }, { h: '급여 재료대', n: 1 }, { h: '급여 행위료', n: 1 }, { h: '병원가산액', n: 1 }, { h: '보험100', n: 1 }, { h: '비급여', n: 1 }, { h: '선택진료', n: 1 }, { h: '합계', n: 1 }],
        [...new Set(lines.map((l) => l.group))].map((g) => { const ls = lines.filter((l) => l.group === g); const s = (fn) => ls.reduce((a, l) => a + fn(l), 0); return [esc(g), E().won(s((l) => l.pay === '급여' ? l.mat : 0)), E().won(s((l) => l.pay === '급여' ? l.act : 0)), E().won(s((l) => l.pay === '급여' ? l.add : 0)), '0', E().won(s((l) => l.pay === '비급여' ? l.amount : 0)), '0', E().won(s((l) => l.amount))]; })),
      rx: () => E().grid([{ h: '급비구분' }, { h: '수납여부' }, { h: '처방구분' }, { h: 'No' }, { h: '처방코드' }, { h: '처방 명칭' }, { h: '실시일자' }, { h: '단가', n: 1 }, { h: '1회량' }, { h: '횟수' }, { h: '일수' }, { h: '금액', n: 1 }],
        lines.map((l, i) => [l.pay, e.billed ? 'Y' : 'N', esc(l.group), i + 1, `<span class="mono">${esc(l.edi)}</span>`, esc(l.name), l.at ? T.d(l.at) : T.d(e.at), E().won(l.price), '1', String(l.qty), '1', E().won(l.amount)])),
      doc: () => E().grid([{ h: '처방일시' }, { h: '구분' }, { h: '처방 명칭' }, { h: '용량·방법' }, { h: '상태' }, { h: '처방의' }, { h: '수가 반영' }],
        ords.map((o) => [T.mdhm(o.at), esc(H.M.CAT[o.cat].short), esc(o.name), esc(H.view.doseText(o)), esc(o.status), esc(o.by), c.lines.some((l) => l.orderId === o.id) ? 'Y' : (F.isOff(o) ? '취소' : o.outside ? '원외' : '미시행')])),
      blood: () => E().grid([{ h: '혈액제제' }, { h: '혈액번호' }, { h: '출고' }, { h: '청구' }], ords.filter((o) => o.cat === 'BLOOD').map((o) => [esc(o.name), esc(o.bagNo || '-'), esc(o.status), '헌혈증 있으면 수혈 청구액으로 공제']), { empty: '수혈 내역 없음' }),
      bills: () => E().grid([{ h: '수납일시' }, { h: '영수증번호' }, { h: '구분' }, { h: '카드', n: 1 }, { h: '통장', n: 1 }, { h: '현금', n: 1 }, { h: '할인', n: 1 }, { h: '감액', n: 1 }, { h: '미수', n: 1 }, { h: '합계', n: 1 }, { h: '' }],
        bills.map((b) => { const q = b.pay || {}; return [T.mdhm(b.at), `<span class="mono">${esc(b.no)}</span>`, esc(b.kind), E().won(q.card || 0), E().won(q.bank || 0), E().won(q.cash != null ? q.cash : b.paid), E().won(q.disc || 0), E().won(q.red || 0), E().won(q.misu || 0), E().won(b.paid), UI.btn('재발행', 'bl.receipt', { size: 'sm', data: { id: b.id } })]; }), { empty: '수납 내역 없음' }),
    };
    return body[tab] ? body[tab]() : body.act();
  }
  const PTABS = [['act', '행위별 수익'], ['rx', '수납 처방'], ['doc', '의사 처방'], ['blood', '수혈 청구'], ['bills', '입금·영수증 (할인·감액·카드·미수)']];

  // ───────── 외래 수납 ─────────
  H.reg({
    id: 'opdpay', title: '외래 수납', actor: '원무과 (외래 수납)', layout: 'patient', channels: () => ['billing'],
    list() { const encs = S.where('encounters', (e) => (e.type === 'OPD' || e.type === 'ER') && (e.at >= T.startOfDay() - DAY || !e.billed) && !['입원'].includes(e.status)).sort((a, b) => (!!a.billed) - (!!b.billed) || b.at - a.at); return { title: '외래·응급 수납', rows: encs.map((e) => { const p = H.pat(e.patientId); return { pid: p.id, encId: e.id, loc: e.type === 'ER' ? '응급' : `${e.dept.slice(0, 2)} ${e.qno || ''}`, name: p.name, marks: e.billed ? UI.chip('수납', 'done') : ['진료완료', '귀가', '전원'].includes(e.status) ? UI.chip('수납 대기', 'stat') : UI.chip(e.status, 'plain'), sub: `${H.sexAge(p)} · ${esc(p.ins)} · ${esc(e.dept)}` }; }) }; },
    render() {
      const e = A.enc(); if (!e || (e.type !== 'OPD' && e.type !== 'ER')) return `<div class="panel"><div class="panel-b">${UI.empty('왼쪽에서 외래·응급 환자를 고르세요')}</div></div>`;
      const p = H.pat(e.patientId); const c = H.fee.calc(e); const st = payState(); const pp = payPanel(c, st); const tab = ms('tab', 'act');
      const visits = S.where('encounters', (x) => x.patientId === p.id && x.at >= T.startOfDay() - 7 * DAY).sort((a, b) => b.at - a.at);
      const rxNo = S.where('encounters', (x) => x.type === 'OPD' && x.billed && x.billed >= T.startOfDay()).length;
      const sp = p.special ? p.special.code : '';
      return `<form class="erp" data-submit="op2.pay">
        ${E().bar([`<b>투약번호</b> <span class="num">${e.billed ? rxNo : 0} / ${rxNo}</span>`, '|', `<b style="color:var(--t-stat)">연구액 0</b>`, `<label class="chk"><input type="checkbox" ${e.reg && e.reg.recvType === '당일의뢰' ? 'checked' : ''}>당일의뢰</label>`, '|', { l: '유형변경', act: 'op2.type' }, { l: 'HOLD/급비', act: 'op2.hold' }, { l: '보훈적용', act: 'op2.bohun' }, { l: '수가계산', act: 'op2.calc' }, { l: '수납', act: 'op2.payBtn', kind: 'pri', disabled: !!e.billed }, { l: '내원분리', act: 'op2.split' }, { l: '강제승인', act: 'op2.force' }, { l: '치매', act: 'op2.dementia' }])}
        ${E().patFields(p)}
        <div class="row">${E().infect(p, 'w.inf')}${UI.btn('본인확인', 'w.idcheck', { size: 'sm' })}${UI.btn('미수 알림톡', 'op2.misuSms', { size: 'sm' })}${UI.btn('제증명', 'map.go', { size: 'sm', data: { v: 'certdoc' } })}${UI.btn('대리처방 확인서', 'w.proxy', { size: 'sm' })}${UI.btn('EMR 조회', 'w.emr', { size: 'sm' })}</div>
        ${E().grid([{ h: 'No' }, { h: 'H' }, { h: '재계산' }, { h: '진료일자' }, { h: '요일' }, { h: '시간' }, { h: '진료과' }, { h: '진료의사' }, { h: '주/부' }, { h: '초/재' }, { h: '진료' }, { h: '유형' }, { h: '보조' }, { h: '보조사유' }, { h: '보험기호' }, { h: '진찰료' }, { h: '할인' }, { h: '예외' }, { h: '예약' }, { h: '상태' }],
          visits.map((x, i) => ({ cells: [i + 1, x.reg && x.reg.hold ? 'H' : '', '', T.d(x.at), ['일', '월', '화', '수', '목', '금', '토'][new Date(x.at).getDay()], T.hm(x.at), esc(x.dept), esc(H.M.doctor(x.doctorId).name), (x.reg || {}).main || '주', esc(x.visit || ''), { OPD: '외래', ER: '응급', IPD: '입원' }[x.type], esc(p.ins), esc(sp), esc((x.reg || {}).subWhy || ''), esc(E().info(p).insCode || ''), (x.reg || {}).fee || 'Y', (x.reg || {}).empDisc || '', ((x.reg || {}).divEx || '00').slice(0, 2), x.appt ? 'Y' : '', x.billed ? '수납' : esc(x.status)], on: x.id === e.id, act: 'shell.pick', data: { pid: p.id, enc: x.id } })), { h: '9rem' })}
        <div class="row"><b>특례상병:</b>${['암 중증', '희귀난치', '만성질환', '화상'].map((t, i) => `<label class="chk"><input type="checkbox" ${(i === 0 && sp === 'V193') || (i === 1 && sp === 'V800') || (i === 2 && sp === 'V001') ? 'checked' : ''} disabled>${t}</label>`).join('')}<b>자격정보:</b>${['중증등록', '희귀지원', '희귀등록', '차상위'].map((t, i) => `<label class="chk"><input type="checkbox" ${i === 0 && sp ? 'checked' : ''} disabled>${t}</label>`).join('')}</div>
        <div class="erp-cols"><div class="gap-s">${E().tabs('op2.tab', PTABS, tab)}${procTabs(e, c, tab)}
          ${c.pending.length ? UI.note(`시행 안 된 처방 ${c.pending.length}건은 이번 수납에서 빠집니다: ${c.pending.map((o) => esc(o.name)).join(', ')}`, 'warn') : ''}${c.r.notes.length ? UI.note(c.r.notes.map(esc).join(' · '), 'info') : ''}</div>
          <div class="gap-s">${pp.html}
            <div class="erp-f" style="grid-template-columns:1fr"><div class="c"><div class="l">현금영수증</div><div class="v"><select name="rcpt" data-chg="pay.cashRcpt" aria-label="현금영수증"><option value="">발급 안 함</option><option ${st.rcpt === '개인소득용' ? 'selected' : ''}>개인소득용</option><option ${st.rcpt === '지출증빙용' ? 'selected' : ''}>지출증빙용</option><option ${st.rcpt === '발급거부' ? 'selected' : ''}>발급거부 (국세청 자진발급)</option></select></div></div></div>
            ${UI.btn(e.billed ? '수납 완료됨' : `수납 ${H.won(pp.v.due)}`, '', { type: 'submit', kind: 'danger', size: 'lg', block: true, disabled: !!e.billed })}</div></div></form>`;
    },
    acts: Object.assign({}, commonActs, payActs, {
      'map.go': (el) => A.go(el.dataset.v),
      'op2.tab': (el) => { set('tab', el.dataset.v); A.render(); },
      'op2.pay': () => { const e = A.enc(); if (e.billed) return; if (!['진료완료', '귀가', '전원'].includes(e.status)) { UI.confirm({ title: '진료 중 수납', text: '아직 진료가 끝나지 않았습니다. 지금까지 처방만 수납할까요? (선수납)', ok: '수납' }).then((ok) => ok && doPay(e.type === 'ER' ? '응급실 수납' : '외래 수납', true)); return; } doPay(e.type === 'ER' ? '응급실 수납' : '외래 수납', true); },
      'op2.payBtn': () => document.querySelector('form[data-submit="op2.pay"]').requestSubmit(),
      'op2.calc': () => { A.render(); UI.toast('수가 계산 완료', 'ok'); },
      'op2.type': () => A.go('billing'),
      'op2.hold': () => { const e = A.enc(); e.reg = e.reg || {}; e.reg.hold = !e.reg.hold; S.save(); UI.toast(e.reg.hold ? 'HOLD — 수납 보류 (급비·보험 확인 중)' : 'HOLD 해제', 'warn'); A.render(); },
      'op2.bohun': () => UI.toast('보훈 대상자 확인 — 국가유공자 본인은 보훈병원 위탁 진료 시 감면 (교육용 안내)', ''),
      'op2.split': () => UI.toast('내원 분리: 같은 날 두 과 진료를 따로 수납하도록 나눕니다 (주/부 진료)', ''),
      'op2.force': () => UI.toast('강제 승인: 자격 조회가 안 될 때 책임자 승인으로 진행 — 사유 기록 필수', 'warn'),
      'op2.dementia': () => UI.toast('치매 산정특례(V800 계열) 확인 — 중증 치매는 본인부담 10%', ''),
      'op2.misuSms': () => { const p = A.pat(); const m = S.where('bills', (b) => b.patientId === p.id && b.pay && b.pay.misu).reduce((s, b) => s + b.pay.misu, 0); H.addRec('sms', p.id, { to: `${p.name} ${p.phone || ''}`, text: `[SSV병원] 미수금 ${H.won(m)}이 있습니다. 다음 내원 시 납부 부탁드립니다.` }); UI.toast(m ? `미수 알림톡 발송 (${H.won(m)})` : '미수금이 없습니다', m ? 'ok' : ''); },
    }),
  });

  // ───────── 입원 정산 ─────────
  const drgGroup = (e) => { const d = H.fee.daysOf(e); if (!(e.adm && e.adm.drg) && !S.where('orders', (o) => o.encId === e.id && ['O9003', 'O9005'].includes(o.code)).length) return ''; return d > 30 ? '상단열외' : d <= 1 ? '하단열외' : '정상군'; };
  H.reg({
    id: 'ipdpay', title: '입원 정산 (퇴원 수납)', actor: '원무과 (입퇴원)', layout: 'patient', channels: () => ['billing'],
    list() {
      const f = ms('f', '퇴원예정');
      const encs = S.where('encounters', (e) => e.type === 'IPD' && (f === '퇴원예정' ? e.status === '입원중' && e.dc : f === '재원' ? e.status === '입원중' : f === '가퇴원' ? e.status === '입원중' && e.dc && !e.dc.review : e.status === '퇴원'));
      return { title: '입원 정산', filter: UI.seg('ip2.f', ['퇴원예정', '재원', '가퇴원', '정퇴원'], f), rows: encs.map((e) => { const p = H.pat(e.patientId); return { pid: p.id, encId: e.id, loc: `${e.ward} ${e.room}`, name: p.name, marks: e.billed ? UI.chip('정산', 'done') : e.dc ? UI.chip(e.dc.review ? '심사 완료' : '심사 중', e.dc.review ? 'stat' : 'prog') : '', sub: `${H.sexAge(p)} · ${esc(p.ins)} · ${H.fee.daysOf(e)}일` }; }), empty: '해당 환자가 없습니다' };
    },
    render() {
      const e = A.enc(); if (!e || e.type !== 'IPD') return `<div class="panel"><div class="panel-b">${UI.empty('왼쪽에서 입원 환자를 고르세요', '퇴원예정 = 의사 퇴원 결정 / 가퇴원 = 퇴원 심사 전 / 정퇴원 = 수납 끝난 퇴원')}</div></div>`;
      const p = H.pat(e.patientId); const c = H.fee.calc(e); const st = payState(); const pp = payPanel(c, st); const tab = ms('tab', 'act'); const g = drgGroup(e);
      const hist = [{ from: e.at, to: e.endAt, ward: (e.moves && e.moves[0] ? e.moves[0].from.split(' ')[0] : e.ward), room: e.room }, ...(e.moves || []).map((m) => ({ from: m.at, ward: m.to.split(' ')[0], room: m.to.split(' ')[1] }))];
      const sanjeon = p.obs ? 1000000 - S.where('bills', (b) => b.patientId === p.id && b.pay && b.pay.sanjeon).reduce((s, b) => s + b.pay.sanjeon, 0) : 0;
      const final = !!(e.dc && e.dc.review) && !e.billed;
      return `<form class="erp" data-submit="ip2.pay">
        ${E().bar([`<b>정산기간</b> <span class="num">${T.d(e.at)} ~ ${T.d(e.endAt || Date.now())}</span>`, '|', { l: '퇴원계산서', act: 'bl.preview' }, { l: '처방 강제 조회', act: 'op2.tab', data: { v: 'doc' } }, { l: '수진자 자격 조회', act: 'w.verify' }, { l: '영수증 재발행', act: 'op2.tab', data: { v: 'bills' } }, { l: '제증명', act: 'map.go', data: { v: 'certdoc' } }, { l: final ? '퇴원 수납' : '중간 정산', act: 'ip2.payBtn', kind: 'pri', disabled: !!e.billed }])}
        ${E().fields([{ l: '등록번호', txt: p.mrn, t: 'key' }, { l: '주민번호', txt: E().info(p).rrn }, { l: '휴대[환자]', txt: p.phone || '-' }, { l: '이메일', txt: E().info(p).email || '-', t: 'req' }, { l: '환자성명', txt: p.name, t: 'key' }, { l: '생년월일', txt: p.birth }, { l: '기타[자택]', txt: E().info(p).home || '-' }, { l: '참고사항', txt: E().info(p).admMemo || '-', t: 'warn' }, { l: '차량번호', txt: E().info(p).car || '-' }])}
        ${E().grid([{ h: '적용일자' }, { h: '종료일자' }, { h: '보험' }, { h: '보조' }, { h: '보조사유' }, { h: '보험자기호' }, { h: '진료과' }, { h: 'Staff' }, { h: '선택' }, { h: '병동' }, { h: '병실' }, { h: '등급' }, { h: '형태' }, { h: 'DRG대상' }, { h: '포괄' }, { h: '할인코드' }],
          hist.map((h) => [T.d(h.from), h.to ? T.d(h.to) : '', esc(p.ins), esc(p.special ? p.special.code : ''), '', esc(E().info(p).insCode || ''), esc(e.dept), esc(H.M.doctor(e.doctorId).name), '일반', esc(h.ward), esc(h.room), esc((e.roomType || '다인실').slice(0, 3)), esc((e.adm || {}).roomForm || '일반'), g ? 'Y' : '', (e.adm || {}).nurseCare ? '간호간병' : '', (e.adm || {}).empDisc || '']), { h: '7rem' })}
        <div class="row">${['하단열외', '정상군', '비용열외', '상단열외', '90일이상'].map((t) => `<label class="chk ${g === t || (t === '90일이상' && H.fee.daysOf(e) >= 90) ? 'on' : ''}"><input type="checkbox" disabled ${g === t || (t === '90일이상' && H.fee.daysOf(e) >= 90) ? 'checked' : ''}>${t}</label>`).join('')}
          <b>산전지원비 잔액 ▶</b><span class="num" style="color:var(--t-stat)">${H.won(sanjeon)}</span><b>상병코드 ▶</b><span class="mono">${esc(((e.dx || []).find((x) => x.main) || {}).code || '-')}</span></div>
        ${!e.dc ? UI.note('재원 중 — 퇴원 결정 전이라 중간 정산만 할 수 있습니다. 오래 입원하면 2주마다 중간 정산을 권합니다.', 'info') : !e.dc.review ? UI.note('가퇴원 상태 — 보험 심사(퇴원 심사)가 끝나야 퇴원 수납을 할 수 있습니다.', 'warn') : ''}
        <div class="erp-cols"><div class="gap-s">${E().tabs('op2.tab', [...PTABS, ['mid', '입원 중간 미수']], tab)}${tab === 'mid' ? E().grid([{ h: '수납일' }, { h: '구분' }, { h: '미수액', n: 1 }], S.where('bills', (b) => b.encId === e.id && b.pay && b.pay.misu).map((b) => [T.d(b.at), esc(b.kind), E().won(b.pay.misu)]), { empty: '중간 미수 없음' }) : procTabs(e, c, tab)}
          ${c.pending.length ? UI.note(`시행 안 된 처방 ${c.pending.length}건`, 'warn') : ''}${c.r.notes.length ? UI.note(c.r.notes.map(esc).join(' · '), 'info') : ''}
          <div class="box small">본인부담상한제: 1년 동안 낸 본인부담금이 소득 분위별 상한(예: 87만~808만 원)을 넘으면 넘은 금액을 공단이 돌려줍니다 — "상한제 대불금" 칸 (실습에서는 0원).</div></div>
          <div class="gap-s">${pp.html.replace('<div class="r "><div class="k">장애기금</div>', '<div class="r "><div class="k">지정진료액</div><div class="x">0</div></div><div class="r "><div class="k">상한제 대불금</div><div class="x">0</div></div><div class="r "><div class="k">장애기금</div>')}
            <div class="erp-f" style="grid-template-columns:1fr"><div class="c"><div class="l">현금영수증</div><div class="v"><select name="rcpt" data-chg="pay.cashRcpt" aria-label="현금영수증"><option value="">발급 안 함</option><option ${st.rcpt === '개인소득용' ? 'selected' : ''}>개인소득용</option><option ${st.rcpt === '지출증빙용' ? 'selected' : ''}>지출증빙용</option></select></div></div></div>
            ${UI.btn(e.billed ? '정산 완료됨' : `${final ? '퇴원 수납' : '중간 정산'} ${H.won(pp.v.due)}`, '', { type: 'submit', kind: 'danger', size: 'lg', block: true, disabled: !!e.billed })}</div></div></form>`;
    },
    acts: Object.assign({}, commonActs, payActs, {
      'map.go': (el) => A.go(el.dataset.v),
      'ip2.f': (el) => { set('f', el.dataset.v); A.render(); },
      'op2.tab': (el) => { set('tab', el.dataset.v); A.render(); },
      'bl.preview': () => { const c = H.fee.calc(A.enc()); UI.modal({ title: '퇴원 계산서 (미리보기)', size: 'wide', body: `${H.fee.receipt(c, null)}<div style="margin-top:1rem">${H.fee.detail(c)}</div>` }); },
      'bl.receipt': (el) => { const b = S.get('bills', el.dataset.id); UI.modal({ title: '영수증 재발행', size: 'wide', body: H.fee.receipt(H.fee.calc(H.enc(b.encId)), b) }); },
      'ip2.payBtn': () => document.querySelector('form[data-submit="ip2.pay"]').requestSubmit(),
      'ip2.pay': () => { const e = A.enc(); if (e.billed) return; const final = !!(e.dc && e.dc.review); doPay(final ? '퇴원 수납' : '중간 정산', final); },
    }),
  });
  // 외래 수납에서도 영수증 재발행 동작
  H.mods.opdpay.acts['bl.receipt'] = H.mods.ipdpay.acts['bl.receipt'];

  // ───────── 제증명 ─────────
  const CERT = [['01', '진단서', 20000, '공통'], ['02', '소견서 (기관 제출용)', 10000, '공통'], ['03', '입·퇴원 확인서', 3000, '공통'], ['04', '입원 확인서', 3000, '공통'], ['06', '병무용 진단서', 20000, '공통'], ['07', '상해 진단서 (3주 미만)', 100000, '공통'],
    ['08', '출생 증명서', 3000, '공통'], ['10', '향후 치료비 추정서', 50000, '공통'], ['11', '후유장해 진단서', 100000, '공통'], ['13', '영문 사망 진단서', 20000, '공통'], ['14', '영문 출생 증명서', 20000, '공통'], ['15', '영문 진단서', 20000, '공통'],
    ['17', '기타 진단서', 20000, '공통'], ['18', '국민연금 장애 진단서', 15000, '공통'], ['19', '공무원연금 장애 진단서', 15000, '공통'], ['20', '사산(사태) 증명서', 10000, '공통'], ['22', '진료(일) 확인서', 3000, '공통'],
    ['24', '산정특례 등록 신청서 (암) [보험]', 0, '공단'], ['25', '산정특례 등록 신청서 (중증화상) [보험]', 0, '공단'], ['30', '산재 요양급여 신청 소견서', 0, '산재'], ['31', '진료비 납입 확인서', 0, '공통']];
  H.reg({
    id: 'certdoc', title: '제증명 (진단서 발급)', actor: '의사·원무과', layout: 'patient', channels: () => ['billing'],
    list: () => patList('환자 찾기'),
    render() {
      const p = A.pat(); if (!p) return `<div class="panel"><div class="panel-b">${UI.empty('왼쪽에서 환자를 고르세요', '의사가 작성 → 원무과에서 수수료 받고 발급합니다.')}</div></div>`;
      const encs = S.where('encounters', (e) => e.patientId === p.id).sort((a, b) => b.at - a.at); const e = encs.find((x) => x.id === A.st.encId) || encs[0] || {};
      const code = ms('code', '01'); const ct = CERT.find((c) => c[0] === code); const d = H.M.doctor(e.doctorId);
      const issued = S.where('certs', (c) => c.patientId === p.id).sort((a, b) => b.at - a.at); const draft = ms('draft_' + p.id + code, null);
      const copies = Number(ms('copies', 1)) || 1;
      return `<form class="erp" data-submit="ce.save">
        ${E().bar([`<b>검색</b> 등록번호 <span class="mono">${esc(p.mrn)}</span>`, `<label class="chk"><input type="checkbox" name="sanjae" ${p.ins.startsWith('산재') ? 'checked' : ''}>산재</label>`, '|', { l: '제증명 선택', act: 'ce.list', kind: 'pri' }, '|', `진단서 비고 문구 <select name="note"><option>NO</option><option>YES</option></select>`, `발행 매수 <input name="copies" type="number" value="${copies}" min="1" style="width:4rem" data-chg="ce.copies">`, { l: '재발행', act: 'ce.reissue', disabled: !issued.length }])}
        ${E().bar([{ l: '임시 저장', act: 'ce.temp' }, { l: '환자 상병', act: 'ce.dx' }, { l: '검사 결과', act: 'ce.lab' }, { l: 'EMR 기록 조회', act: 'w.emr' }, { l: '불러오기', act: 'ce.load' }, '|', `의사 사번 <span class="mono">${esc((e.doctorId || '').toUpperCase())}</span>`, `진료일자 <span class="mono">${e.at ? T.d(e.at) : '-'}</span>`, { l: '응급실 진료 내역', act: 'ce.er' }, '|', { l: '의뢰/회송 신청서 작성', act: 'map.go', data: { v: 'referral' } }])}
        <div class="erp-cols" style="grid-template-columns:16rem minmax(0,1fr)">
          <div class="gap-s"><div class="erp-sec">발급 이력</div>${E().grid([{ h: '진료부서' }, { h: '의사' }, { h: '발생일자' }, { h: '제증명' }], issued.map((c) => ({ cells: [esc((H.enc(c.encId) || {}).dept || ''), esc(H.M.doctor((H.enc(c.encId) || {}).doctorId).name), T.d(c.at), esc(c.name)], act: 'ce.view', data: { id: c.id } })), { h: '24rem', empty: '발급 이력 없음' })}
            ${E().fields([{ l: '진료 건', n: 'enc', v: e.id || '', opts: encs.map((x) => ({ v: x.id, l: `${T.d(x.at)} ${x.dept} ${{ OPD: '외래', ER: '응급', IPD: '입원' }[x.type]}` })) }], { cols: '100%' })}</div>
          <div class="paper" style="max-width:none">
            <h2>${esc(ct[1].replace(/ \(.*\)| \[.*\]/g, ''))}</h2>
            <table><tr><th style="width:16%">원본대조필</th><td></td><th style="width:16%">발급번호</th><td class="mono">(발급 시 부여)</td></tr>
              <tr><th>환자 성명</th><td>${esc(p.name)}</td><th>주민등록번호</th><td class="mono">${esc(E().info(p).rrn)}</td></tr>
              <tr><th>주소</th><td colspan="3">${esc(p.address || '')} (전화 ${esc(p.phone || '')})</td></tr>
              <tr><th>병명</th><td><textarea name="dxText" style="width:100%;min-height:3.2rem" aria-label="병명">${esc(draft ? draft.dxText : (e.dx || []).map((x) => `${x.main ? '(최종) ' : '(임상적 추정) '}${x.name}`).join('\n'))}</textarea></td><th>국제질병분류번호</th><td class="mono">${(e.dx || []).map((x) => esc(x.code)).join('<br>')}</td></tr>
              <tr><th>발병 연월일</th><td><input name="onset" type="date" value="${esc(draft ? draft.onset : T.d((e.at || Date.now()) - 3 * DAY))}"></td><th>진단 연월일</th><td><input name="diag" type="date" value="${esc(draft ? draft.diag : T.d(e.at || Date.now()))}"></td></tr>
              <tr><th>치료 내용 및<br>향후 치료 소견</th><td colspan="3"><textarea name="opinion" style="width:100%;min-height:6rem" aria-label="소견">${esc(draft ? draft.opinion : `상기 환자는 위 병명으로 ${e.type === 'IPD' ? `${T.d(e.at)}부터 입원` : '외래'} 치료 중이며, 향후 약 2주간의 안정 가료를 요할 것으로 사료됨.`)}</textarea></td></tr>
              <tr><th>입원·외래</th><td colspan="3">${e.type === 'IPD' ? `입원 ${T.d(e.at)} ~ ${e.endAt ? T.d(e.endAt) : '재원 중'}` : `외래 ${e.at ? T.d(e.at) : ''}`}</td></tr>
              <tr><th>용도</th><td><select name="use"><option>보험사 제출</option><option>회사 제출</option><option>학교 제출</option><option>관공서 제출</option><option>본인 보관</option></select></td><th>비고</th><td><input name="remark" value="${esc(draft ? draft.remark : '')}"></td></tr></table>
            <p style="font-size:.85rem;margin-top:.8rem">「의료법」 제17조에 따라 위와 같이 진단합니다. ${T.d(Date.now())}<br>의료기관: SSV 병원 · 의사 ${esc(d.name)} (${esc(d.dept)}) <span class="stamp">인</span></p>
            <p style="font-size:.72rem;color:#555;margin:0">※ 교육용 가상 서식 · 수수료 ${ct[2] ? H.won(ct[2]) + ' × ' + copies + '매' : '무료'} (보건복지부 제증명수수료 상한 고시 이내)</p></div>
        </div>
        <div class="btn-row end">${UI.btn('수정 저장', 'ce.temp')}${UI.btn(`발급 (${H.won(ct[2] * copies)})`, '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'print' })}</div></form>`;
    },
    acts: Object.assign({}, commonActs, {
      'map.go': (el) => A.go(el.dataset.v),
      'ce.copies': (el) => { set('copies', el.value); A.render(); },
      'ce.list': () => {
        const p = A.pat(); const q = ms('cq', '');
        UI.modal({ title: '제증명 리스트', body: `<div class="row"><span>진단서 명:</span><input class="inp" style="max-width:16rem" data-inp="ce.q" value="${esc(q)}" aria-label="제증명 검색">${UI.btn('검색 초기화', 'ce.qReset', { size: 'sm' })}${UI.btn('산재 서류', 'ce.qSanjae', { size: 'sm' })}</div>
          <div id="ce-list" style="margin-top:.6rem">${certList(p, q)}</div>` });
      },
      'ce.q': (el) => { set('cq', el.value); document.getElementById('ce-list').innerHTML = certList(A.pat(), el.value); },
      'ce.qReset': () => { set('cq', ''); document.getElementById('ce-list').innerHTML = certList(A.pat(), ''); },
      'ce.qSanjae': () => { set('cq', '산재'); document.getElementById('ce-list').innerHTML = certList(A.pat(), '산재'); },
      'ce.pick': (el) => { set('code', el.dataset.code); UI.close(); A.render(); },
      'ce.temp': () => { const f = document.querySelector('form[data-submit="ce.save"]'); const d = H.formData(f); set('draft_' + A.pat().id + ms('code', '01'), d); UI.toast('임시 저장 — 나중에 이어서 쓸 수 있습니다', 'ok'); },
      'ce.load': () => { const p = A.pat(); const last = S.where('certs', (c) => c.patientId === p.id && c.code === ms('code', '01')).sort((a, b) => b.at - a.at)[0]; if (!last) return UI.toast('불러올 이전 서류가 없습니다', 'warn'); set('draft_' + p.id + ms('code', '01'), last.content); A.render(); UI.toast('이전 서류 내용을 불러왔습니다', 'ok'); },
      'ce.dx': () => { const e = A.enc() || {}; UI.modal({ title: '환자 상병', size: 'narrow', body: (e.dx || []).map((x) => `<div>${x.main ? '주) ' : '부) '}<span class="mono">${esc(x.code)}</span> ${esc(x.name)}</div>`).join('') || '상병 없음' }); },
      'ce.lab': () => { const p = A.pat(); UI.modal({ title: '검사 결과', size: 'wide', body: H.view.labCumulative(p.id) }); },
      'ce.er': () => { const p = A.pat(); const er = S.where('encounters', (x) => x.patientId === p.id && x.type === 'ER'); UI.modal({ title: '응급실 진료 내역', size: 'narrow', body: er.map((x) => `<div>${T.dhm(x.at)} KTAS ${x.ktas} — ${esc(x.cc || '')} (${esc(x.status)})</div>`).join('') || '응급실 내원 없음' }); },
      'ce.view': (el) => { const c = S.get('certs', el.dataset.id); UI.modal({ title: c.name, size: 'wide', body: H.certPaper ? H.certPaper(c) : '' }); },
      'ce.reissue': () => { const p = A.pat(); const c = S.where('certs', (x) => x.patientId === p.id).sort((a, b) => b.at - a.at)[0]; UI.modal({ title: `재발행 — ${c.name}`, size: 'wide', body: H.certPaper(c) }); UI.toast('재발행 — 같은 발급번호로 다시 출력 (수수료 다시 받음)', ''); },
      'ce.save': (f, d) => {
        const p = A.pat(); const code = ms('code', '01'); const ct = CERT.find((c) => c[0] === code); const e = H.enc(d.enc) || A.enc();
        if (!e) return UI.toast('진료 건을 고르세요', 'warn');
        if (d.sanjae && !code.startsWith('3')) UI.toast('산재 환자 — 산재 서류(요양급여 신청 소견서)도 필요한지 확인하세요', 'warn');
        const copies = Math.max(1, Number(d.copies) || 1);
        const type = { '01': 'diag', '02': 'opinion', '03': 'admit', '04': 'admit', '08': 'birth', '31': 'pay' }[code] || 'diag';
        const c = S.add('certs', { id: H.uid('ce'), no: `C${String(S.all('certs').length + 1).padStart(6, '0')}`, encId: e.id, patientId: p.id, type, code, name: ct[1], price: ct[2], qty: copies, content: { onset: d.onset, diagDate: d.diag, opinion: d.opinion, use: d.use, dxText: d.dxText, diag: d.diag, remark: d.remark }, at: Date.now(), by: H.who() });
        if (ct[2] > 0 && e.billed) S.add('bills', { id: H.uid('bl'), no: `R-C${c.no}`, encId: e.id, patientId: p.id, kind: '제증명', at: Date.now(), total: ct[2] * copies, ins: 0, self: 0, non: ct[2] * copies, paid: ct[2] * copies, method: '신용카드', by: H.who(), payer: '-', label: '비급여' });
        set('draft_' + p.id + code, null); H.log('제증명 발급', `${ct[1]} ${copies}매`, p.id);
        UI.toast(`${ct[1]} ${copies}매 발급${ct[2] ? ` — 수수료 ${H.won(ct[2] * copies)}` : ''}`, 'ok'); A.render();
        UI.modal({ title: ct[1], size: 'wide', body: H.certPaper(c) });
      },
    }),
  });
  function certList(p, q) {
    return E().grid([{ h: '코드' }, { h: '제증명명' }, { h: '작성횟수', n: 1 }, { h: '대상자유형' }, { h: '수수료', n: 1 }], CERT.filter((c) => !q || c[1].includes(q) || (q === '산재' && c[3] === '산재')).map((c) => ({ cells: [c[0], esc(c[1]), String(S.where('certs', (x) => x.patientId === p.id && x.code === c[0]).length), c[3], c[2] ? H.won(c[2]) : '무료'], act: 'ce.pick', data: { code: c[0] } })), { h: '26rem' });
  }
})();
