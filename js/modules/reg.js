// 원무 접수: 환자 등록, 외래 접수, 응급 접수, 입원 수속
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;

  const KTAS = [
    { v: 1, l: '1 소생 — 즉시', d: '심정지, 의식 없음, 무호흡' },
    { v: 2, l: '2 긴급 — 10분 안', d: '흉통(심근경색 의심), 뇌졸중 증상, 심한 호흡곤란' },
    { v: 3, l: '3 응급 — 30분 안', d: '중등도 호흡곤란, 복통·발열 동반' },
    { v: 4, l: '4 준응급 — 1시간 안', d: '염좌, 가벼운 열상, 요로감염 증상' },
    { v: 5, l: '5 비응급 — 2시간 안', d: '감기 증상, 약 처방 요청' },
  ];
  H.KTAS = KTAS;

  const bedTaken = (ward, room, bed) => S.all('encounters').find((e) => e.ward === ward && e.room === room && String(e.bed) === String(bed) && ['입원중', '대기', '진료중'].includes(e.status));
  H.bedTaken = bedTaken;
  const freeBeds = (wardId) => {
    const w = H.M.ward(wardId); const out = [];
    w.rooms.forEach((r) => { for (let b = 1; b <= w.beds; b++) if (!bedTaken(wardId, r, b)) out.push({ room: r, bed: String(b) }); });
    return out;
  };
  H.freeBeds = freeBeds;

  const encLabel = (e) => e.type === 'OPD' ? `외래 ${e.dept} (${e.status})` : e.type === 'ER' ? `응급실 ${e.room}-${e.bed} (${e.status})` : `${e.ward} ${e.room}-${e.bed} (${e.status})`;

  H.reg({
    id: 'reg', title: '원무 접수', actor: '원무과 직원', layout: 'patient',
    channels: () => ['reg'],
    list() {
      const q = (A.ms('q', '') || '').trim();
      const pats = S.all('patients').filter((p) => !q || p.name.includes(q) || p.mrn.includes(q));
      return {
        title: '환자 찾기',
        filter: `<div class="search fld">${H.icon('search')}<input class="inp" id="reg-q" data-inp="reg.q" value="${esc(q)}" placeholder="이름 또는 등록번호" aria-label="환자 찾기"></div>`,
        rows: pats.map((p) => { const e = H.activeEnc(p.id); return { pid: p.id, encId: e ? e.id : '', loc: p.mrn.slice(-5), name: p.name, sub: `${H.sexAge(p)} · ${e ? encLabel(e) : '진행 중인 진료 없음'}` }; }),
        empty: '찾는 환자가 없습니다. "신규 환자 등록"에서 등록하세요.',
      };
    },
    render() {
      const tab = A.ms('tab', 'new');
      const reqs = S.where('admreq', (r) => r.status === '대기');
      const tabs = UI.tabs('reg.tab', [
        { id: 'new', label: '신규 환자 등록', icon: 'plus' }, { id: 'opd', label: '외래 접수', icon: 'steth' },
        { id: 'er', label: '응급 접수', icon: 'siren' }, { id: 'adm', label: '입원 수속', icon: 'bed', cnt: reqs.length || '' },
        { id: 'today', label: '오늘 접수 현황', icon: 'list' },
      ], tab);
      return `<div class="panel">${tabs}<div class="panel-b">${this['t_' + tab]()}</div></div>`;
    },
    t_new() {
      return `<form data-submit="reg.newPat" class="gap-m">
        ${UI.note('처음 온 환자를 등록하면 등록번호(환자 고유 번호)가 만들어집니다. 등록번호는 평생 바뀌지 않습니다.', 'info')}
        <div class="form-grid">
          ${UI.input('name', '이름', '', { req: true })}
          ${UI.fld('성별', UI.pick('sex', [{ v: 'M', l: '남자' }, { v: 'F', l: '여자' }], 'F'))}
          ${UI.input('birth', '생년월일', '1980-01-01', { type: 'date', req: true })}
          ${UI.select('blood', '혈액형', ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', '모름'], '모름')}
          ${UI.input('height', '키 (cm)', '', { type: 'number' })}${UI.input('weight', '몸무게 (kg)', '', { type: 'number', step: '0.1' })}
          ${UI.input('phone', '전화번호', '', { ph: '010-0000-0000' })}
          ${UI.select('ins', '보험 자격', ['건강보험', '의료급여 1종', '의료급여 2종', '산재보험', '자동차보험', '일반 (보험 없음)'], '건강보험')}
          ${UI.input('address', '주소', '', { cls: 'wide' })}
          ${UI.select('acls', '알레르기 종류', [{ v: '', l: '없음' }, { v: 'penicillin', l: '페니실린' }, { v: 'cephalosporin', l: '세팔로스포린' }, { v: 'nsaid', l: '소염진통제 (NSAID)' }, { v: 'contrast', l: '조영제' }, { v: 'opioid', l: '마약성 진통제' }, { v: 'sulfa', l: '설파제' }], '')}
          ${UI.input('areact', '알레르기 반응 (예: 두드러기)', '')}
          ${UI.input('guardian', '보호자 (관계·이름·전화)', '', { cls: 'wide' })}
          ${UI.textarea('hx', '과거 병력', '', { ph: '예: 고혈압 5년, 약 복용 중' })}
        </div>
        <div class="btn-row end">${UI.btn('환자 등록', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'check' })}</div>
      </form>`;
    },
    needPat() { return UI.empty('왼쪽 "환자 찾기"에서 환자를 먼저 고르세요', '처음 온 환자면 "신규 환자 등록"을 먼저 하세요.'); },
    t_opd() {
      const p = A.pat(); if (!p) return this.needPat();
      const e = H.activeEnc(p.id);
      return `<form data-submit="reg.opd" class="gap-m">
        ${e ? UI.note(`이 환자는 이미 진행 중인 진료가 있습니다: ${esc(encLabel(e))}`, 'warn') : ''}
        <div class="form-grid">
          ${UI.select('doc', '진료과 · 담당 의사', H.M.DOCTORS.filter((d) => d.dept !== '응급의학과').map((d) => ({ v: d.id, l: `${d.dept} — ${d.name} 교수` })), 'dr1', { cls: 'wide' })}
          ${UI.fld('초진 · 재진', UI.pick('visit', ['초진', '재진'], '초진'))}
          ${UI.fld('보험 자격 확인', `<div class="row">${UI.chip(p.ins, 'sent')}<span class="small muted">국민건강보험공단 자격 조회 완료 (가상)</span></div>`)}
          ${UI.textarea('cc', '오신 이유 (주호소)', '', { ph: '예: 기침 1주, 열' })}
        </div>
        <div class="btn-row end">${UI.btn('외래 접수', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'check' })}</div>
      </form>`;
    },
    t_er() {
      const p = A.pat();
      return `<form data-submit="reg.er" class="gap-m">
        ${p ? '' : UI.note('신원을 모르는 환자는 이름 칸에 "신원미상"으로 접수할 수 있습니다. 환자를 먼저 고르면 그 환자로 접수합니다.', 'info')}
        <div class="form-grid">
          ${p ? UI.fld('환자', `<b>${esc(p.name)}</b> <span class="muted">${H.sexAge(p)} · ${esc(p.mrn)}</span>`) : `${UI.input('unk', '이름', '신원미상')}${UI.fld('성별', UI.pick('sex', [{ v: 'M', l: '남자' }, { v: 'F', l: '여자' }], 'M'))}`}
          ${UI.fld('오신 방법', UI.pick('arrival', ['걸어서', '119 구급차', '사설 구급차', '다른 병원에서 전원'], '걸어서'), 'wide')}
          ${UI.fld('중증도 분류 (KTAS) — 분류 간호사가 정함', `<div class="gap-s">${UI.pick('ktas', KTAS.map((k) => ({ v: k.v, l: k.l })), 3)}<div class="small muted">${KTAS.map((k) => `<b>${k.v}</b> ${esc(k.d)}`).join(' · ')}</div></div>`, 'wide')}
          ${UI.select('zone', '응급실 구역', ['소생실', 'A구역', 'B구역', '관찰실'], 'A구역')}
          ${UI.textarea('cc', '주호소', '', { ph: '예: 30분 전부터 가슴 통증' })}
        </div>
        <div class="btn-row end">${UI.btn('응급 접수', '', { type: 'submit', kind: 'danger', size: 'lg', icon: 'siren' })}</div>
      </form>`;
    },
    t_adm() {
      const reqs = S.where('admreq', (r) => r.status === '대기').sort((a, b) => a.at - b.at);
      const p = A.pat();
      const w = A.ms('ward', '7A');
      const beds = freeBeds(w);
      return `<div class="gap-m">
        ${UI.sec('입원 결정된 환자 (의사가 입원 결정함)')}
        ${UI.table([{ h: '결정 시각' }, { h: '환자' }, { h: '어디서' }, { h: '진료과·의사' }, { h: '희망 병동' }, { h: '' }], reqs.map((r) => { const pp = H.pat(r.patientId); return [`<span class="num small">${H.t.mdhm(r.at)}</span>`, `<b>${esc(pp.name)}</b> ${H.sexAge(pp)}`, esc(r.from), `${esc(r.dept)} ${esc(H.M.doctor(r.doctorId).name)}`, esc(r.ward || '-'), UI.btn('이 환자 수속', 'reg.pickReq', { size: 'sm', kind: 'pri', data: { id: r.id } })]; }), { empty: UI.empty('입원 결정된 환자가 없습니다', '외래나 응급실에서 의사가 "입원 결정"을 하면 여기에 나타납니다.') })}
        ${UI.sec('입원 수속')}
        ${!p ? this.needPat() : `<form data-submit="reg.admit" class="gap-m">
          <input type="hidden" name="req" value="${esc(A.ms('req', ''))}">
          <div class="form-grid">
            ${UI.fld('환자', `<b>${esc(p.name)}</b> <span class="muted">${H.sexAge(p)} · ${esc(p.mrn)} · ${esc(p.ins)}</span>`, 'wide')}
            ${UI.select('doc', '진료과 · 주치의', H.M.DOCTORS.map((d) => ({ v: d.id, l: `${d.dept} — ${d.name}` })), A.ms('reqDoc', 'dr1'))}
            ${UI.fld('병동', UI.seg('reg.ward', [{ v: '7A', l: '7A 내과병동' }, { v: '8B', l: '8B 외과병동' }, { v: 'ICU', l: '중환자실' }, { v: 'LD', l: '분만실' }], w))}
            ${UI.select('bed', `빈 병상 (${beds.length}개)`, beds.map((b) => ({ v: `${b.room}-${b.bed}`, l: `${b.room}호 ${b.bed}번 침상` })), beds[0] ? `${beds[0].room}-${beds[0].bed}` : '')}
            ${UI.select('room', '병실 종류', ['다인실 (4인실, 보험 적용)', '2인실 (상급병실료 차액)', '1인실 (상급병실료 차액)'], '다인실 (4인실, 보험 적용)')}
            ${UI.textarea('memo', '입원 안내 메모', '입원 생활 안내문 전달, 보호자 1인 상주 가능, 입원 약정서 서명 받음')}
          </div>
          <div class="btn-row end">${UI.btn('입원 수속 완료', '', { type: 'submit', kind: 'pri', size: 'lg', icon: 'bed' })}</div>
        </form>`}
      </div>`;
    },
    t_today() {
      const day = H.t.startOfDay();
      const list = S.where('encounters', (e) => e.at >= day || ['입원중', '대기', '진료중'].includes(e.status)).sort((a, b) => b.at - a.at);
      return UI.table([{ h: '접수 시각' }, { h: '구분' }, { h: '환자' }, { h: '진료과·의사' }, { h: '위치' }, { h: '상태' }], list.map((e) => { const p = H.pat(e.patientId); return [
        `<span class="num small">${H.t.mdhm(e.at)}</span>`, UI.chip({ OPD: '외래', IPD: '입원', ER: '응급' }[e.type], e.type === 'ER' ? 'stat' : e.type === 'IPD' ? 'purple' : 'sent'),
        `<b>${esc(p.name)}</b> <span class="muted small">${H.sexAge(p)}</span>`, `${esc(e.dept)} ${esc(H.M.doctor(e.doctorId).name)}`,
        e.type === 'OPD' ? `대기 ${e.qno || '-'}번` : `${esc(e.ward)} ${esc(e.room)}-${esc(e.bed)}`, UI.chip(e.status, ['진료완료', '퇴원', '귀가', '입원'].includes(e.status) ? 'done' : 'prog')]; }));
    },
    acts: {
      'reg.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'reg.q': (el) => { A.set('q', el.value); A.refreshList(); },
      'reg.ward': (el) => { A.set('ward', el.dataset.v); A.render(); },
      'reg.newPat': (f, d) => {
        if (!d.name || !d.birth) return UI.toast('이름과 생년월일은 꼭 넣어 주세요', 'warn');
        const p = S.add('patients', { id: H.uid('pt'), mrn: S.nextMrn(), name: d.name, sex: d.sex || 'F', birth: d.birth, blood: d.blood, height: H.num(d.height) || 160, weight: H.num(d.weight) || 60, phone: d.phone, address: d.address, ins: d.ins, guardian: d.guardian, hx: d.hx || '없음', allergies: d.acls ? [{ cls: d.acls, name: H.M.ALLERGY_NAME[d.acls], reaction: d.areact || '' }] : [], flags: {}, scenario: {} });
        H.log('신규 환자 등록', `${p.name} (${p.mrn})`, p.id);
        UI.toast(`${p.name} 님 등록 완료 — 등록번호 ${p.mrn}`, 'ok');
        A.st.pid = p.id; A.st.encId = null; A.set('tab', 'opd'); A.render();
      },
      'reg.opd': (f, d) => {
        const p = A.pat(); if (!p) return;
        const doc = H.M.DOCTORS.find((x) => x.id === d.doc);
        const qno = S.where('encounters', (e) => e.type === 'OPD' && e.doctorId === doc.id && e.at >= H.t.startOfDay()).length + 1;
        const e = S.add('encounters', { id: H.uid('en'), patientId: p.id, type: 'OPD', dept: doc.dept, doctorId: doc.id, status: '대기', at: Date.now(), qno, visit: d.visit, cc: d.cc, dx: [] });
        H.notify('doctor', `외래 접수: ${p.name} (${doc.dept} 대기 ${qno}번)`, { patientId: p.id });
        H.log('외래 접수', `${p.name} → ${doc.dept} ${doc.name}`, p.id);
        UI.toast(`${p.name} 님 ${doc.dept} 외래 접수 — 대기 ${qno}번`, 'ok');
        A.st.encId = e.id; A.set('tab', 'today'); A.render();
      },
      'reg.er': (f, d) => {
        let p = A.pat();
        if (!p) p = S.add('patients', { id: H.uid('pt'), mrn: S.nextMrn(), name: d.unk || '신원미상', sex: d.sex || 'M', birth: '1970-01-01', blood: '모름', height: 170, weight: 65, ins: '일반 (보험 없음)', hx: '알 수 없음', allergies: [], flags: {}, scenario: {} });
        const zone = d.zone || 'A구역';
        const used = S.where('encounters', (e) => e.type === 'ER' && e.room === zone && ['대기', '진료중'].includes(e.status)).map((e) => String(e.bed));
        let bed = 1; while (used.includes(String(bed))) bed++;
        const e = S.add('encounters', { id: H.uid('en'), patientId: p.id, type: 'ER', dept: '응급의학과', doctorId: 'dr5', status: '대기', at: Date.now(), ward: 'ER', room: zone, bed: String(bed), ktas: Number(d.ktas) || 3, arrival: d.arrival, cc: d.cc, dx: [] });
        H.notify('ward:ER', `응급 접수: ${p.name} KTAS ${e.ktas} — ${d.cc || ''}`, { patientId: p.id, level: e.ktas <= 2 ? 'stat' : '' });
        H.notify('doctor', `응급실 새 환자: ${p.name} KTAS ${e.ktas}`, { patientId: p.id, level: e.ktas <= 2 ? 'stat' : '' });
        H.log('응급 접수', `${p.name} KTAS ${e.ktas}`, p.id);
        UI.toast(`${p.name} 응급 접수 완료 (${zone} ${bed}번)`, 'ok');
        A.st.pid = p.id; A.st.encId = e.id; A.set('tab', 'today'); A.render();
      },
      'reg.pickReq': (el) => {
        const r = S.get('admreq', el.dataset.id);
        A.st.pid = r.patientId; A.st.encId = r.fromEnc;
        A.set('req', r.id); A.set('reqDoc', r.doctorId); if (r.ward) A.set('ward', r.ward);
        A.render();
      },
      'reg.admit': (f, d) => {
        const p = A.pat(); if (!p) return;
        if (!d.bed) return UI.toast('빈 병상이 없습니다. 다른 병동을 고르세요', 'warn');
        const [room, bed] = d.bed.split('-');
        const ward = A.ms('ward', '7A');
        const doc = H.M.DOCTORS.find((x) => x.id === d.doc);
        const req = d.req ? S.get('admreq', d.req) : null;
        const src = req && req.fromEnc ? H.enc(req.fromEnc) : null;
        const e = S.add('encounters', { id: H.uid('en'), patientId: p.id, type: 'IPD', dept: doc.dept, doctorId: doc.id, status: '입원중', at: Date.now(), ward, room, bed, roomType: d.room, dx: src ? (src.dx || []).slice() : [], cc: src ? src.cc : '', diet: '', fromEnc: src ? src.id : null });
        if (src) { src.status = '입원'; src.endAt = Date.now(); }
        if (req) { req.status = '완료'; req.doneAt = Date.now(); req.toEnc = e.id; }
        S.save();
        H.notify('ward:' + ward, `새 입원: ${p.name} (${room}-${bed}) — 병실 안내·처방 확인·입원 초기 간호사정 필요`, { patientId: p.id });
        H.notify('doctor', `입원 완료: ${p.name} ${ward} ${room}-${bed} — 입원 처방을 내 주세요`, { patientId: p.id });
        H.log('입원 수속', `${p.name} → ${ward} ${room}-${bed}`, p.id);
        UI.toast(`${p.name} 님 ${ward} ${room}호 ${bed}번 침상 입원 수속 완료`, 'ok');
        A.set('req', ''); A.st.encId = e.id; A.set('tab', 'today'); A.render();
      },
    },
  });
})();
