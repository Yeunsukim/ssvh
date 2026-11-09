// 교수자 화면 (학생은 "내 실습 기록"으로 일부만 봄)
(function () {
  const H = window.H;
  const S = H.store;
  const UI = H.ui;
  const esc = H.esc;
  const A = H.app;
  const F = H.flow;
  const T = H.t;

  const isInst = () => (A.user() || {}).role === 'instructor';

  // 추가 실습 사례
  const EXTRA = [
    { id: 'sepsis', t: '패혈증 (응급실, KTAS 2)', d: '요로감염에서 시작된 패혈성 쇼크. 패혈증 묶음처방 1시간 안 시행, 젖산·혈액배양, 수액 30mL/kg.', make() {
      const p = S.add('patients', { id: H.uid('pt'), mrn: S.nextMrn(), name: '문영자', sex: 'F', birth: '1948-08-18', blood: 'O+', height: 155, weight: 50, ins: '건강보험', hx: '당뇨, 반복되는 요로감염', allergies: [], flags: {}, guardian: '아들 010-0000-11xx', scenario: { labs: { WBC: 22.4, CRP: 24.1, PCT: 18.5, Lac: 4.8, Cr: 1.9, Glu: 289, UWBC: '많음 (4+)', UNit: '양성' } } });
      const e = S.add('encounters', { id: H.uid('en'), patientId: p.id, type: 'ER', dept: '응급의학과', doctorId: 'dr5', status: '대기', at: Date.now(), ward: 'ER', room: '소생실', bed: '2', ktas: 2, arrival: '119 구급차', cc: '이틀 전부터 열, 오늘 의식이 흐려짐', dx: [] });
      S.add('vitals', { id: H.uid('vs'), patientId: p.id, encId: e.id, at: Date.now(), by: '응급실 분류 간호사', sbp: 84, dbp: 46, hr: 128, rr: 26, bt: 39.3, spo2: 92, pain: 3, avpu: 'V' });
      return p; } },
    { id: 'copd', t: '만성폐쇄성폐질환 악화 (응급실, KTAS 3)', d: '숨참 악화, 이산화탄소 저류. 동맥혈가스, 산소는 88~92% 목표, 네뷸라이저.', make() {
      const p = S.add('patients', { id: H.uid('pt'), mrn: S.nextMrn(), name: '강태수', sex: 'M', birth: '1952-03-03', blood: 'A+', height: 165, weight: 58, ins: '건강보험', hx: '만성폐쇄성폐질환 10년, 흡연 50갑년', allergies: [], flags: {}, scenario: { labs: { pH: 7.31, pCO2: 58, pO2: 56, HCO3: 29, SaO2: 88, WBC: 11.2 } } });
      const e = S.add('encounters', { id: H.uid('en'), patientId: p.id, type: 'ER', dept: '응급의학과', doctorId: 'dr5', status: '대기', at: Date.now(), ward: 'ER', room: 'A구역', bed: '5', ktas: 3, arrival: '걸어서', cc: '사흘 전부터 숨참이 심해지고 누런 가래', dx: [] });
      S.add('vitals', { id: H.uid('vs'), patientId: p.id, encId: e.id, at: Date.now(), by: '응급실 분류 간호사', sbp: 146, dbp: 88, hr: 108, rr: 28, bt: 37.6, spo2: 86, pain: 2 });
      return p; } },
    { id: 'dm', t: '당뇨 외래 재진 (내과)', d: '혈당 조절 불량. 당화혈색소·지질 검사, 원외처방전, 당뇨 교육.', make() {
      const p = S.add('patients', { id: H.uid('pt'), mrn: S.nextMrn(), name: '배정숙', sex: 'F', birth: '1966-09-21', blood: 'B+', height: 158, weight: 71, ins: '건강보험', hx: '2형 당뇨 8년 (메트포르민 복용)', allergies: [{ cls: 'sulfa', name: '설파제', reaction: '발진' }], flags: {}, scenario: { labs: { A1c: 8.9, Glu: 186, TC: 228, LDL: 151 } } });
      const n = S.where('encounters', (e) => e.type === 'OPD' && e.doctorId === 'dr1' && e.at >= T.startOfDay()).length + 1;
      S.add('encounters', { id: H.uid('en'), patientId: p.id, type: 'OPD', dept: '내과', doctorId: 'dr1', status: '대기', at: Date.now(), qno: n, visit: '재진', cc: '혈당 수치 확인, 약 처방', dx: [] });
      return p; } },
  ];

  // 상태 변화 사건
  const EVENTS = [
    { id: 'fever', t: '고열', v: { sbp: 118, dbp: 70, hr: 118, rr: 24, bt: 39.4, spo2: 95, pain: 3 }, msg: '체온 39.4℃, 오한 호소' },
    { id: 'hypo', t: '혈압 저하 (쇼크 징후)', v: { sbp: 82, dbp: 48, hr: 126, rr: 26, bt: 37.9, spo2: 93, pain: 4 }, msg: '혈압 82/48, 식은땀, 어지러움' },
    { id: 'hypox', t: '산소포화도 저하', v: { sbp: 142, dbp: 86, hr: 112, rr: 30, bt: 37.4, spo2: 85, pain: 2 }, msg: '숨이 차다고 함, 산소포화도 85%' },
    { id: 'loc', t: '의식 저하', v: { sbp: 168, dbp: 96, hr: 58, rr: 12, bt: 36.8, spo2: 94, pain: 0, avpu: 'P' }, msg: '불러도 반응이 적음, 통증 자극에만 반응' },
    { id: 'glu', t: '저혈당', v: { sbp: 124, dbp: 76, hr: 104, rr: 18, bt: 36.5, spo2: 98, pain: 0, bst: 46 }, msg: '식은땀, 손떨림, 혈당 46mg/dL' },
    { id: 'pain', t: '심한 통증', v: { sbp: 156, dbp: 94, hr: 110, rr: 22, bt: 37.2, spo2: 97, pain: 9 }, msg: '통증 9점 호소, 몸을 웅크림' },
    { id: 'fall', t: '낙상 발생', v: null, msg: '화장실 가다가 넘어짐 (환자 발견)' },
    { id: 'arrest', t: '심정지', v: { sbp: 0, dbp: 0, hr: 0, rr: 0, bt: 36.2, spo2: 0, pain: 0, avpu: 'U' }, msg: '반응 없음, 맥박 촉지 안 됨 — 코드블루!' },
  ];

  // 학생 수행 점검표 (데이터로 자동 판정)
  function checklist(name) {
    const mine = (by) => !name || (by || '').startsWith(name);
    const has = (c, fn) => S.where(c, (x) => mine(x.by) && fn(x)).length;
    const pat = (n) => S.all('patients').find((p) => p.name === n) || {};
    const items = [
      ['처방', '처방을 직접 내고 전송함', S.where('orders', (o) => mine(o.by) && o.by.includes('의사')).length],
      ['처방', '원외처방전을 발행함 (외래)', S.where('orders', (o) => mine(o.by) && o.outside).length],
      ['약제', '처방 감사·조제·불출을 해 봄', S.where('orders', (o) => (o.hist || []).some((h) => h.s === '불출' && mine(h.by))).length],
      ['검사', '채혈 → 결과 입력 → 결과 보고까지 해 봄', S.where('orders', (o) => o.cat === 'LAB' && (o.hist || []).some((h) => h.s === '결과보고' && mine(h.by))).length],
      ['검사', '위험값을 되읽기로 보고함 (윤대한 칼륨 등)', S.where('orders', (o) => o.result && o.result.critCall && mine(o.result.critCall.by)).length],
      ['영상', '영상 촬영·판독 → PACS 조회', S.where('orders', (o) => o.cat === 'RAD' && (o.hist || []).some((h) => h.s === '판독완료' && mine(h.by))).length],
      ['검사', '미생물 배양 → 그람 염색 → 동정 → 항생제 감수성 보고', S.where('orders', (o) => o.micro && o.micro.stage === '최종 보고' && mine(o.micro.by)).length],
      ['검사', '분자진단 PCR (Ct 값) 판독', S.where('orders', (o) => o.mol && o.result && mine(o.result.by)).length],
      ['검사', '위탁검사 발송·결과 수신', S.where('orders', (o) => o.ref && mine(o.ref.by)).length],
      ['검사', '정도관리 판정 (레비-제닝스·웨스트가드 규칙)', has('recs', (r) => r.kind === 'qc')],
      ['영상', '조영제실: 신장 기능(eGFR) 확인·검사 후 이상반응 관찰', S.where('orders', (o) => o.cmObs && mine(o.cmObs.by)).length],
      ['영상', 'MRI 안전 문진 후 촬영', S.where('orders', (o) => o.cat === 'RAD' && (H.M.item(o.code) || {}).mod === 'MRI' && o.tech && mine(o.tech.by)).length],
      ['영상', '핵의학 방사성의약품 용량 측정·주사 기록', S.where('orders', (o) => o.nm && o.nm.injAt && mine(o.nm.by)).length],
      ['기능검사', '폐기능 판정 (FEV1/FVC·GOLD 단계)', S.where('orders', (o) => o.cat === 'PROC' && (H.M.item(o.code) || {}).room === 'pft' && o.result && mine(o.result.by)).length],
      ['기능검사', '운동부하·심초음파·뇌파 등 실별 검사 보고', S.where('orders', (o) => o.cat === 'PROC' && ['ecg', 'echo', 'neuro'].includes((H.M.item(o.code) || {}).room) && o.result && o.result.room && mine(o.result.by)).length],
      ['고객', '고객의 소리(VOC) 접수 → 부서 이관 → 회신 → 종결', S.where('recs', (r) => r.kind === 'voc' && (r.hist || []).some((h) => h.s === '종결' && mine(h.by))).length],
      ['고객', '퇴원 환자 해피콜', has('recs', (r) => r.kind === 'happy')],
      ['고객', '환자경험평가 모의 조사·개선 과제', has('recs', (r) => r.kind === 'pxe' || r.kind === 'pxplan')],
      ['예약', '전화 상담: 본인 확인 후 예약·변경·취소', has('recs', (r) => r.kind === 'call')],
      ['예약', '통합예약: 검사 일정 잡기·부도 재예약', S.where('appts', (a) => mine(a.by) && (a.kind === '검사' || a.via === '부도 재예약' || a.via === '통합예약')).length],
      ['의료정보', '퇴원분석(I) 입력완료', S.where('encounters', (e) => e.mi && e.mi.dc1Done && mine(e.mi.dc1By)).length],
      ['의료정보', '진료분석: 주진단·부진단 코딩 확정', S.where('encounters', (e) => e.coding && e.coding.state === '확정' && mine(e.coding.by)).length],
      ['의료정보', '미비등록 (항목 체크 → 요청)', S.where('encounters', (e) => e.mi && e.mi.defChecked && mine(e.mi.defBy)).length],
      ['진료협력', '회신서 작성·발송', S.where('refs', (r) => r.replySent).length],
      ['진료협력', '진료의뢰·회송서 전송 (동의서 확인)', S.where('refs', (r) => r.dir === 'out' && r.sentAt && mine(r.by)).length + S.where('refs', (r) => r.dir === 'out' && r.ediNo).length],
      ['병리', '병리 검체 접수부터 판독까지', S.where('orders', (o) => o.cat === 'PATH' && (o.hist || []).some((h) => h.s === '판독완료' && mine(h.by))).length],
      ['간호', '이전 근무자 인계를 인수 확인함', S.where('handoffs', (h) => h.ackBy && mine(h.ackBy)).length],
      ['간호', '새 처방을 확인 서명함', S.where('orders', (o) => o.ackBy && mine(o.ackBy)).length],
      ['간호', '강미래 님 입원 초기 간호사정', S.where('assess', (a) => a.patientId === pat('강미래').id && a.kind === 'initial' && mine(a.by)).length],
      ['간호', '낙상·욕창·통증 등 위험 사정', has('assess', (a) => a.kind !== 'initial')],
      ['간호', '투약 5원칙 확인 후 투약 기록', has('mar', (m) => m.status === '투약' && (m.checks || []).length >= 5)],
      ['간호', '고위험 약물 2인 확인 투약', has('mar', (m) => m.double)],
      ['간호', '수혈 전 확인 후 수혈 시작 (조성실)', S.where('orders', (o) => o.transfused && mine(o.transfused.by)).length],
      ['간호', '활력징후 측정·기록', has('vitals', () => true)],
      ['간호', 'Focus-DAR 또는 간호과정 기록', has('nnotes', (n) => n.format !== '서술')],
      ['소통', 'SBAR로 의사에게 노티', has('comms', () => true)],
      ['소통', '구두처방 되읽기 후 서명', S.where('orders', (o) => o.verbal && o.ackBy && mine(o.ackBy)).length],
      ['교육', '환자 교육 기록', has('acts', (a) => a.kind === '환자 교육')],
      ['응급', '심폐소생술 기록지 작성', has('codes', () => true)],
      ['인계', 'SBAR 인계 작성', has('handoffs', () => true)],
      ['수술', '수술 일정 확정', S.where('orders', (o) => o.cat === 'OP' && (o.hist || []).some((h) => h.s === '수술확정' && mine(h.by))).length],
      ['수술', '병동 수술 전 준비 확인표', S.where('orders', (o) => o.op && o.op.preop && mine(o.op.preop.by)).length],
      ['수술', '타임아웃(절개 전 확인) 후 절개', S.where('orders', (o) => o.op && o.op.timeout && mine(o.op.timeout.by)).length],
      ['수술', '거즈·기구 계수 일치 후 퇴실 (Sign out)', S.where('orders', (o) => o.op && o.op.signout && mine(o.op.signout.by)).length],
      ['수술', '회복실 알드레테 점수 기록', S.where('orders', (o) => o.op && o.op.pacu && (o.op.pacu.recs || []).some((r) => mine(r.by))).length],
      ['중환자', '중환자 흐름표 시간 기록', has('recs', (r) => r.kind === 'icu')],
      ['중환자', '인공호흡기·VAP 번들 기록', has('recs', (r) => r.kind === 'vent')],
      ['중환자', '점적 약물 속도 계산 (2인 확인)', has('recs', (r) => r.kind === 'drip')],
      ['중환자', 'CAM-ICU 섬망 사정', has('recs', (r) => r.kind === 'cam')],
      ['응급', '응급실 중증도(KTAS) 분류', has('acts', (a) => a.kind === '중증도 분류')],
      ['분만', '분만 진행표(파토그램) 기록', has('recs', (r) => r.kind === 'labor')],
      ['분만', '태아 심박 감시 판독', has('recs', (r) => r.kind === 'fhr')],
      ['분만', '분만 기록·아프가 점수', has('recs', (r) => r.kind === 'birth')],
      ['분만', '산후 관찰 (자궁저부·오로)', has('recs', (r) => r.kind === 'pp')],
      ['신생아', '신생아 사정·신체 검진', has('recs', (r) => r.kind === 'nb')],
      ['신생아', '수유·황달 기록', has('recs', (r) => r.kind === 'feed' || r.kind === 'bili')],
      ['신생아', '예방접종·선별검사 기록', has('recs', (r) => r.kind === 'nbcare')],
      ['투석', '투석 전 사정 → 투석 중 관찰 → 종료', has('recs', (r) => r.kind === 'hd' && r.done)],
      ['외래', '외래 진료 전 준비·진료 후 안내', S.where('encounters', (e) => (e.pre && mine(e.pre.by)) || (e.guide && mine(e.guide.by))).length],
      ['원무', '외래·응급·퇴원 수납 (영수증 발행)', has('bills', () => true)],
      ['원무', '자격 변경·산정특례 등록', S.where('audit', (a) => mine(a.user) && ['자격 변경', '산정특례'].includes(a.action)).length],
      ['원무', '진단서·제증명 발급', has('certs', () => true)],
      ['퇴원', '의사 퇴원 결정 → 병동 퇴원 교육', S.where('encounters', (e) => e.dc && e.dc.ward && mine(e.dc.ward.by)).length],
      ['심사', '퇴원 심사 (사전 점검)', S.where('encounters', (e) => e.dc && e.dc.review && mine(e.dc.review.by)).length],
      ['심사', 'EDI 청구 송신', has('claims', () => true)],
      ['심사', '삭감 이의신청', S.all('claims').filter((c) => Object.values(c.results || {}).some((r) => (r.items || []).some((i) => i.appeal && mine(i.appeal.by)))).length],
      ['의료정보', '퇴원 분석·미비 등록', has('defs', () => true)],
      ['의료정보', '질병·수술 코딩', S.where('encounters', (e) => e.coding && mine(e.coding.by)).length],
      ['전문 간호', '가정간호 방문 기록', has('recs', (r) => r.kind === 'hcvisit')],
      ['전문 간호', '재활 기능 평가·치료', has('recs', (r) => r.kind === 'rehab')],
      ['전문 간호', '방사선 치료·부작용 관찰', has('recs', (r) => r.kind === 'rt' || r.kind === 'rtside')],
      ['전문 간호', '뇌사 장기기증 절차 진행', S.where('patients', (p) => p.donor && p.donor.step > 0).length],
      ['전문 간호', 'NST 영양 평가', has('recs', (r) => r.kind === 'nst')],
      ['감염', '격리·손위생·감염병 신고', S.where('audit', (a) => mine(a.user) && ['격리 지정', '법정감염병 신고'].includes(a.action)).length + has('recs', (r) => r.kind === 'ic')],
      ['지원', '심전도 등 기능검사 판독', S.where('orders', (o) => o.cat === 'PROC' && o.result && mine(o.result.by)).length],
      ['지원', '중앙공급실 멸균·표시기 판독', S.where('items', (i) => i.kind === 'load' && i.read && mine(i.read.by)).length],
      ['검진', '종합검진 판정·상담', S.where('patients', (p) => p.chk && p.chk.result && mine(p.chk.result.by)).length],
      ['행정', '진료협력 의뢰·회송', S.where('refs', (r) => r.status.includes('완료')).length],
      ['행정', '예약·도착 접수', S.where('appts', (a) => mine(a.by)).length + S.where('appts', (a) => a.status === '도착').length],
      ['행정', '환자안전 사건 보고', S.where('qi', (q) => q.kind === 'event' && mine(q.by)).length],
      ['행정', '물품 청구·발주·검수', S.where('items', (i) => (i.kind === 'po' || i.kind === 'req') && mine(i.by)).length],
      ['심혈관', '응급 심근경색 — 문에서 풍선까지 기록', S.where('orders', (o) => o.cat === 'CV' && o.cv && o.cv.times && o.cv.times.balloon).length],
      ['심혈관', '시술 전 준비 (앨런 검사·조영제 알레르기)', S.where('orders', (o) => o.cv && o.cv.prep && mine(o.cv.prep.by)).length],
      ['심혈관', '시술 후 천자 부위·말단 관찰', S.where('orders', (o) => o.cv && o.cv.post && (o.cv.post.recs || []).some((r) => mine(r.by))).length],
      ['내시경', '전처치 (장정결 점수·진정제 용량)', S.where('orders', (o) => o.en && o.en.prep && mine(o.en.prep.by)).length],
      ['내시경', '조직검사 병리 의뢰·회복 귀가 점수', S.where('orders', (o) => o.cat === 'EN' && o.status === '검사완료').length],
      ['내시경', '내시경 세척·소독 기록', has('recs', (r) => r.kind === 'scope')],
      ['주사실', '외래 주사·관찰', has('recs', (r) => r.kind === 'injobs')],
      ['주사실', '약물 이상반응 대처', has('recs', (r) => r.kind === 'adr')],
      ['주사실', '항암 주사 (체표면적·2인 확인·일혈 감시)', has('recs', (r) => r.kind === 'chemowatch')],
      ['행정', '3교대 근무표 작성 (한 달 자동 짜기·확정)', S.where('audit', (a) => a.action === '근무표 작성' && mine(a.user)).length],
    ];
    return items;
  }

  function tabCheck() {
    const users = [...new Set(S.all('audit').map((a) => a.user))].filter((u) => u && u !== '-');
    const sel = isInst() ? A.ms('who', '') : (A.user() || {}).name;
    const items = checklist(sel);
    const done = items.filter((i) => i[2] > 0).length;
    return `<div class="gap-m">
      ${isInst() ? `<div class="row"><span class="small muted">학생</span>${UI.seg('in.who', [{ v: '', l: '전체' }, ...users.map((u) => ({ v: u, l: u }))], sel)}</div>` : ''}
      <div class="row between box"><div><span class="muted small">수행한 항목</span> <span class="score-big">${done} / ${items.length}</span></div>${UI.note('기록된 데이터로 자동 판정합니다. 같은 브라우저에서 한 학생씩 실습하거나, 학생이 낸 기록을 불러와서 확인하세요.', 'info')}</div>
      ${UI.table([{ h: '영역' }, { h: '수행 항목' }, { h: '횟수', cls: 'num' }, { h: '판정' }], items.map(([g, t, n]) => [UI.chip(g, 'plain'), esc(t), `<span class="num">${n}</span>`, n > 0 ? UI.chip('수행함', 'done') : UI.chip('아직', 'prog')]))}
    </div>`;
  }
  function tabLog() {
    const who = isInst() ? A.ms('logWho', '') : (A.user() || {}).name;
    const list = S.where('audit', (a) => !who || a.user === who).sort((a, b) => b.at - a.at).slice(0, 300);
    const users = [...new Set(S.all('audit').map((a) => a.user))].filter((u) => u && u !== '-');
    return `<div class="gap-m">${isInst() ? `<div class="row"><span class="small muted">학생</span>${UI.seg('in.logWho', [{ v: '', l: '전체' }, ...users.map((u) => ({ v: u, l: u }))], who)}</div>` : ''}
      ${UI.table([{ h: '시각' }, { h: '사람' }, { h: '부서' }, { h: '한 일' }, { h: '내용' }], list.map((a) => [`<span class="num small">${T.mdhm(a.at)}</span>`, `${esc(a.user)}${a.sid ? ` <span class="small muted">${esc(a.sid)}</span>` : ''}`, `<span class="small">${esc(a.dept)}</span>`, `<b>${esc(a.action)}</b>`, `<span class="small">${esc(a.detail)}</span>`]), { empty: UI.empty('활동 기록이 없습니다'), maxH: '40rem' })}</div>`;
  }
  function tabData() {
    return `<div class="grid2">
      <div class="panel"><div class="panel-h"><h3>${isInst() ? '실습 기록 내보내기' : '내 기록 복사하기 (과제 제출용)'}</h3></div><div class="panel-b gap-m">
        ${UI.note('아래 "복사하기"를 누른 뒤, 과제 게시판이나 메일에 붙여 넣어 내세요. 교수자는 "기록 불러오기"로 그대로 열어 볼 수 있습니다.', 'info')}
        ${UI.btn('기록 복사하기', 'in.copy', { kind: 'pri', size: 'lg', icon: 'copy', block: true })}
        <textarea class="inp" id="exp-text" readonly style="min-height:8rem;font-family:var(--mono);font-size:.75rem" aria-label="기록 내용" hidden></textarea>
        <p class="small muted" style="margin:0">현재 저장 용량 ${S.sizeKB()}KB</p></div></div>
      <div class="panel"><div class="panel-h"><h3>기록 불러오기</h3></div><div class="panel-b gap-m">
        ${UI.note('불러오면 지금 이 브라우저의 실습 기록이 <b>모두 바뀝니다.</b> 필요하면 먼저 복사해 두세요.', 'warn')}
        <div class="fld"><label for="imp-file">파일로 불러오기 (.json, .txt)</label><input type="file" id="imp-file" class="inp" accept=".json,.txt,application/json,text/plain" data-chg="in.file"></div>
        ${UI.textarea('imp', '또는 복사한 기록을 여기에 붙여 넣기', '', { h: '6rem' })}
        ${UI.btn('붙여 넣은 기록 불러오기', 'in.import', { size: 'lg', icon: 'upload' })}</div></div>
    </div>`;
  }
  function tabCase() {
    const pts = S.all('patients');
    return `<div class="gap-m">
      <div class="panel"><div class="panel-h"><h3>처음 상태로 되돌리기</h3></div><div class="panel-b row between">${UI.note('모든 처방·기록이 지워지고 가상 환자 12명의 처음 상태로 돌아갑니다. 새 학생이 실습을 시작할 때 쓰세요.', 'warn')}${UI.btn('처음 상태로 되돌리기', 'in.reset', { kind: 'danger', size: 'lg', icon: 'refresh' })}</div></div>
      <div class="panel"><div class="panel-h"><h3>실습 사례 추가</h3></div><div class="panel-b grid3">${EXTRA.map((x) => `<div class="box"><b>${esc(x.t)}</b><p class="small muted" style="margin:.3rem 0 .6rem">${esc(x.d)}</p>${UI.btn('이 사례 추가', 'in.add', { kind: 'pri', block: true, data: { id: x.id } })}</div>`).join('')}</div></div>
      <div class="panel"><div class="panel-h"><h3>지금 있는 환자와 학습 포인트</h3></div><div class="panel-b">${UI.table([{ h: '환자' }, { h: '위치' }, { h: '학습 포인트' }], pts.map((p) => { const e = H.activeEnc(p.id); return [`<b>${esc(p.name)}</b> ${H.sexAge(p)}`, e ? esc(e.type === 'OPD' ? `외래 ${e.dept}` : e.type === 'ER' ? `응급실 KTAS ${e.ktas}` : `${e.ward} ${e.room}-${e.bed}`) : '<span class="muted">진료 없음</span>', esc(POINTS[p.name] || '접수부터 직접 진행')]; }))}</div></div>
    </div>`;
  }
  const POINTS = {
    홍길순: '페니실린 알레르기 + 세팔로스포린 교차반응 경고, 인슐린 슬라이딩 스케일(고위험 2인 확인), 낙상 고위험, 아침 채혈',
    김철수: '금식 환자 투약, 마약성 진통제 투약·통증 재사정, 수술 전 교육 (2단계 수술 연계)',
    윤대한: '칼륨 위험값 6.1 → 위험값 보고·SBAR·고칼륨 응급 처치, 칼륨 보존 이뇨제 처방 감사, I/O·수분 제한, DNR',
    강미래: '새 입원: 처방 확인 서명 → 입원 초기 간호사정 → 채혈 → 항생제 첫 투약 (항생제 전 혈액배양!)',
    조성실: '수혈 전 2인 확인·수혈 부작용 관찰, 욕창·낙상 위험, 암 산정특례 → 원무 수납에서 본인부담 5% 확인',
    이영희: '외래: 고혈압 진단·원외처방전, 지질 검사',
    박민수: '외래: 소염진통제(NSAID) 알레르기 → 이부프로펜 처방 시 경고',
    서하늘: '외래: 유방 촬영·초음파 → PACS → 조직검사 → 병리 판독 (침윤성 유관암)',
    정순자: '응급: 흉통 묶음처방, 트로포닌 위험값, 조영제 알레르기 → 관상동맥 조영술 경고',
    최준호: '응급: 뇌졸중 묶음처방, 마지막 정상 시각, 뇌 CT 판독 후 혈전용해제 (고위험)',
    오가람: '응급: KTAS 4 발목 염좌, 산재보험 → 원무 수납 본인부담 0원·계약처 청구',
    임소망: '등록만 된 환자 — 외래 접수부터 직접 해 보기',
    한상우: '중환자실: 패혈성 쇼크·인공호흡기, 노르에피네프린 용량 계산, VAP 번들, 소변량 감시',
    송미경: '중환자실: 개두술 후 신경학적 사정(GCS·동공), 니카르디핀 혈압 조절',
    윤소라: '분만실: 자연분만 진행표, 정상 태아 심박, 분만 기록 → 아기 자동 입원, 산후 관찰',
    이다은: '분만실: 옥시토신 유도분만(고위험), 후기 감속 → 자궁 내 소생술',
    '김지수 아기': '신생아실: 정상 신생아 사정, 생후 48시간 황달·선천성 대사이상 검사',
    '박미나 아기': '신생아중환자실: 33주 미숙아, 위관 수유·잔류량, 인큐베이터, 무호흡',
    최정민: '인공신장실: 동정맥루 사정, 체중 증가·제거 목표 계산, 투석 중 저혈압 대처',
    김순례: '인공신장실: 투석 도관 감염 관찰, 의료급여, 투석 적절도(Kt/V)',
  };
  Object.assign(POINTS, {
    노영수: '퇴원 완료·수납 완료: 퇴원요약 미비 → 의료정보 미비 관리, 프로칼시토닌 삭감 → 이의신청, 충수절제술 포괄수가(DRG)',
    백은비: '퇴원 완료: 제왕절개 본인부담 5%, 알부민(검사값 3.4) 삭감 → 수용 또는 이의신청',
    주현태: '자동차보험 응급실 귀가: 원무 계약처 청구·미수 관리',
    박복례: '가정간호: 욕창 3단계 드레싱, 도뇨관·비위관 교체, 보호자 교육',
    정만수: '가정간호: 재택 산소·인슐린 자가 주사 점검 (의료급여)',
    하동민: '재활: 뇌경색 편마비 근력(MMT)·균형(Berg)·일상생활(MBI) 평가, 낙상 고위험',
    안정희: '방사선종양: 유방암 50Gy/25회 중 12회, 방사선 피부염 관찰·교육',
    윤상철: '장기이식: 간 이식 대기자 (MELD 24)',
    이도현: '장기이식: 뇌사 추정자 — 기증 상담부터 장기 배분까지 9단계',
    김민준: '종합검진: 비만·고혈압 의심·간기능 이상 → 판정·상담',
    이서연: '종합검진: 정상 판정',
    박정호: '종합검진: 당뇨병 의심 (혈당 156) → 내과 외래 연결 / 내시경실: 수면 위·대장내시경, 용종 절제 → 병리',
    고민석: '심혈관센터: 정규 관상동맥 조영술 — 앨런 검사, 요골 압박 밴드, 이중 항혈소판제 교육',
    조길호: '내시경실: 위장관 출혈 응급 내시경 지혈 (혈색소 8.4), 70세 이상 진정제 감량',
    나현숙: '내시경실: 위궤양 조직검사·헬리코박터, 아스피린 복용 확인',
    문경자: '주사실: 유방암 AC 항암 3차 — 체표면적·용량 확인, 2인 확인, 일혈 감시, 왼팔 금지',
    한미정: '주사실: 철분 정맥 주사 — 방울 속도 계산, 30분 관찰, 이상반응 대처',
  });
  POINTS['정순자'] += ' / 심혈관센터: 응급 중재술 — 문에서 풍선까지 90분, 조영제 알레르기 전처치';
  POINTS['김철수'] += ' / 2단계: 수술 신청됨 → 수술실 일정 확정 → 수술 전 준비 → 타임아웃 → 계수 → 회복실 → 병동 인계';
  function tabEvent() {
    const encs = S.where('encounters', (e) => ['입원중', '대기', '진료중'].includes(e.status) && e.type !== 'OPD');
    const sel = A.ms('evp', encs[0] ? encs[0].patientId : '');
    return `<div class="gap-m">${UI.note('환자 상태 변화를 넣으면 활력징후가 기록되고 담당 병동(또는 응급실)에 알림이 갑니다. 학생이 알아채고 사정 → SBAR 노티 → 처치까지 하는지 보세요.', 'info')}
      <div class="fld"><span class="lbl">환자</span>${UI.seg('in.evp', encs.map((e) => { const p = H.pat(e.patientId); return { v: p.id, l: `${p.name} (${e.type === 'ER' ? '응급실' : e.ward})` }; }), sel)}</div>
      <div class="grid3">${EVENTS.map((ev) => `<button class="job" data-act="in.event" data-id="${ev.id}" style="min-height:5rem"><b>${esc(ev.t)}</b><span>${esc(ev.msg)}</span></button>`).join('')}</div></div>`;
  }

  H.reg({
    id: 'instructor', title: '교수자 화면', actor: '교수자', layout: 'full',
    get title_() { return isInst() ? '교수자 화면' : '내 실습 기록'; },
    channels: () => [],
    onEnter() { this.title = isInst() ? '교수자 화면' : '내 실습 기록'; this.actor = isInst() ? '교수자' : '학생'; },
    render() {
      const tabs = isInst()
        ? [{ id: 'case', label: '실습 사례 관리', icon: 'list' }, { id: 'event', label: '상태 변화 넣기', icon: 'alert' }, { id: 'check', label: '수행 점검표', icon: 'clip' }, { id: 'log', label: '활동 기록', icon: 'clock' }, { id: 'data', label: '기록 내보내기·불러오기', icon: 'copy' }]
        : [{ id: 'check', label: '내 수행 점검표', icon: 'clip' }, { id: 'log', label: '내 활동 기록', icon: 'clock' }, { id: 'data', label: '내 기록 복사하기', icon: 'copy' }];
      let tab = A.ms('tab', tabs[0].id); if (!tabs.some((t) => t.id === tab)) tab = tabs[0].id;
      return `<div class="panel">${UI.tabs('in.tab', tabs, tab)}<div class="panel-b">${{ case: tabCase, event: tabEvent, check: tabCheck, log: tabLog, data: tabData }[tab]()}</div></div>`;
    },
    acts: {
      'in.tab': (el) => { A.set('tab', el.dataset.v); A.render(); },
      'in.who': (el) => { A.set('who', el.dataset.v); A.render(); },
      'in.logWho': (el) => { A.set('logWho', el.dataset.v); A.render(); },
      'in.evp': (el) => { A.set('evp', el.dataset.v); A.render(); },
      'in.reset': async () => {
        if (!(await UI.confirm({ title: '처음 상태로 되돌리기', text: '모든 실습 기록이 지워집니다. 되돌릴 수 없습니다.\n정말 처음 상태로 되돌릴까요?', ok: '되돌리기', danger: true }))) return;
        S.reset(); A.st = { mod: 'instructor', pid: null, encId: null }; A.saveNav(); H.log('실습 초기화'); UI.toast('처음 상태로 되돌렸습니다', 'ok'); A.render();
      },
      'in.add': (el) => { const x = EXTRA.find((y) => y.id === el.dataset.id); const p = x.make(); S.save(); H.notify(x.id === 'dm' ? 'doctor' : 'ward:ER', `새 실습 사례: ${p.name} — ${x.t}`, { patientId: p.id, level: x.id === 'sepsis' ? 'stat' : '' }); H.log('실습 사례 추가', x.t, p.id); UI.toast(`${p.name} 님 사례를 추가했습니다`, 'ok'); A.render(); },
      'in.event': (el) => {
        const ev = EVENTS.find((x) => x.id === el.dataset.id); const pid = A.ms('evp', ''); if (!pid) return UI.toast('환자를 먼저 고르세요', 'warn');
        const p = H.pat(pid); const e = H.activeEnc(pid); const ward = F.wardOf(e);
        if (ev.v) S.add('vitals', Object.assign({ id: H.uid('vs'), patientId: pid, encId: e.id, at: Date.now(), by: '상태 변화 (교수자)' }, ev.v));
        if (ev.id === 'fall') S.add('acts', { id: H.uid('ac'), patientId: pid, kind: '사건 발생', text: ev.msg, at: Date.now(), by: '상태 변화 (교수자)' });
        H.notify('ward:' + ward, `⚠ ${p.name} 상태 변화: ${ev.msg}`, { patientId: pid, level: 'stat' });
        H.log('상태 변화 넣기', `${p.name} — ${ev.t}`, pid);
        UI.toast(`${p.name} — ${ev.t} 상황을 넣었습니다. 학생 화면 알림에 뜹니다`, 'ok');
      },
      'in.copy': async () => {
        const txt = S.exportJSON(); const ta = document.getElementById('exp-text');
        try { await navigator.clipboard.writeText(txt); UI.toast('기록을 복사했습니다. 붙여 넣어 제출하세요', 'ok'); }
        catch (e) { ta.hidden = false; ta.value = txt; ta.focus(); ta.select(); UI.toast('자동 복사가 막혀 있습니다. 아래 칸 글자가 선택되었으니 복사하세요', 'warn'); }
        H.log('기록 내보내기');
      },
      'in.file': (el) => {
        const f = el.files && el.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = async () => { if (!(await UI.confirm({ title: '기록 불러오기', text: `${f.name}\n지금 기록이 모두 바뀝니다. 불러올까요?`, ok: '불러오기', danger: true }))) return; try { S.importJSON(String(r.result)); UI.toast('기록을 불러왔습니다', 'ok'); A.render(); } catch (e) { UI.toast(e.message || '읽을 수 없는 파일입니다', 'err'); } };
        r.readAsText(f);
      },
      'in.import': async () => {
        const txt = (document.getElementById('f-imp') || {}).value || '';
        if (!txt.trim()) return UI.toast('붙여 넣은 기록이 없습니다', 'warn');
        if (!(await UI.confirm({ title: '기록 불러오기', text: '지금 기록이 모두 바뀝니다. 불러올까요?', ok: '불러오기', danger: true }))) return;
        try { S.importJSON(txt.trim()); UI.toast('기록을 불러왔습니다', 'ok'); A.render(); } catch (e) { UI.toast('기록 형식이 맞지 않습니다', 'err'); }
      },
    },
  });
})();
