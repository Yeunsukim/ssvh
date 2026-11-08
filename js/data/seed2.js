// 2단계 실습 환자: 수술 대기, 중환자실, 분만실, 신생아실·NICU, 인공신장실 (모두 가상 인물)
(function () {
  const H = window.H;
  const HR = 3600000, DAY = 86400000, MIN = 60000;

  function phase2(db) {
    const now = Date.now();
    const T = H.t;
    const uid = (p) => H.uid(p);
    const jit = (v, r, d = 0) => Number((v + (Math.random() * 2 - 1) * r).toFixed(d));
    const P = (o) => { db.seq.mrn += 7; o.id = uid('pt'); o.mrn = String(db.seq.mrn).padStart(8, '0'); o.allergies = o.allergies || []; o.flags = o.flags || {}; o.scenario = o.scenario || {}; db.patients.push(o); return o; };
    const E = (o) => { o.id = uid('en'); db.encounters.push(o); return o; };
    const R = (kind, p, at, data, by) => db.recs.push(Object.assign({ id: uid('rc'), kind, patientId: p.id, at, by: by || '이전 근무 간호사' }, data));
    const O = (p, e, code, o = {}) => {
      const it = H.M.item(code); const at = o.at || e.at + 30 * MIN;
      const ord = { id: uid('or'), encId: e.id, patientId: p.id, encType: e.type, cat: it.cat, code, name: it.name, dose: o.dose != null ? o.dose : it.dose, unit: it.unit, route: it.route,
        freq: o.freq || it.freq || 'ONCE', days: o.days || 7, prn: (o.freq || it.freq) === 'PRN', stat: false, outside: false, otype: '정규', note: o.note || '', at,
        by: `${H.M.doctor(e.doctorId).name} (의사)`, doctorId: e.doctorId, nurseAck: true, ward: e.type === 'ER' ? 'ER' : e.ward, qty: 1, hist: [{ s: '전송', at, by: `${H.M.doctor(e.doctorId).name} (의사)` }] };
      const steps = H.flow.steps(ord); const st = o.status || steps[steps.length - 1];
      ord.status = st; if (st !== '전송') ord.hist.push({ s: st, at: at + HR, by: '담당 부서' });
      if (it.cat === 'MED' || it.cat === 'INJ') ord.arrivedAt = at + HR;
      if (it.cat === 'LAB' && st === '결과보고') {
        ord.result = { at: at + 2 * HR, by: '진단검사의학과', verified: true, items: it.items.map((x) => { const v = String(o.vals && o.vals[x.c] != null ? o.vals[x.c] : H.sim.labValue(p, x)); const j = H.flow.judge(x, v); return { c: x.c, n: x.n, u: x.u, v, flag: j.flag, dir: j.dir, ref: x.text ? x.normal : `${x.lo ?? ''}~${x.hi ?? ''}` }; }) };
        ord.nurseSeen = true; ord.drSeen = true;
      }
      if (o.extra) Object.assign(ord, o.extra);
      db.orders.push(ord);
      if (ord.freq === 'CONT' && st === '불출') db.mar.push({ id: uid('ma'), orderId: ord.id, patientId: p.id, slot: ord.arrivedAt, status: '투약', at: ord.arrivedAt + 10 * MIN, by: '이전 근무 간호사', checks: ['환자', '약', '용량', '경로', '시간'], double: true });
      return ord;
    };
    const find = (name) => db.patients.find((p) => p.name === name);
    const encOf = (p) => db.encounters.find((e) => e.patientId === p.id && ['입원중', '대기', '진료중'].includes(e.status));

    // ───── 수술 대기: 김철수 복강경 담낭절제술 신청 ─────
    const kc = find('김철수');
    if (kc) {
      const e = encOf(kc);
      O(kc, e, 'O9001', { at: now - 5 * HR, status: '전송', note: '급성 결석성 담낭염. 전신마취. 오늘 또는 내일 수술 희망', extra: { op: { anes: '전신마취', wish: '오늘' } } });
      O(kc, e, 'L1023', { at: e.at + HR, vals: { ABO: 'O', Rh: '양성(+)' } });
    }
    const js = find('조성실');
    if (js) { const e = encOf(js); O(js, e, 'O9002', { at: now - 4 * DAY, extra: { op: { anes: '전신마취', room: '3번방', date: T.d(now - 3 * DAY), surgeon: '문태호', ebl: 150, done: true } } }); }

    // ───── 중환자실 1: 한상우 패혈성 쇼크 + 인공호흡기 ─────
    const p1 = P({ name: '한상우', sex: 'M', birth: '1955-07-07', blood: 'B+', height: 170, weight: 68, ins: '건강보험', phone: '010-5521-77xx', address: '서울시 가상구 새벽로 3', guardian: '아내 조은숙 010-8876-12xx',
      hx: '고혈압, 만성폐쇄성폐질환. 사흘 전 폐렴으로 응급실 내원 후 패혈성 쇼크로 기관 삽관',
      scenario: { labs: { Lac: 3.2, WBC: 18.5, CRP: 21.3, PCT: 9.6, Cr: 2.0, BUN: 41, pH: 7.32, pCO2: 44, pO2: 78, HCO3: 20, SaO2: 94, PLT: 98 } } });
    const e1 = E({ patientId: p1.id, type: 'IPD', dept: '호흡기내과', doctorId: 'dr1', status: '입원중', at: now - 3 * DAY, ward: 'ICU', room: '내과계', bed: '1', diet: '경관 영양 (콧줄 영양)', cc: '고열, 숨참, 혈압 저하', dx: [{ code: 'R65.1', name: '패혈성 쇼크 (기관 부전 동반)', main: true }, { code: 'J18.9', name: '폐렴, 상세불명' }] });
    O(p1, e1, 'J0226', { at: e1.at + HR, dose: 0.15, note: '평균동맥압 65mmHg 이상 유지되도록 조절' });
    O(p1, e1, 'J0227', { at: e1.at + HR, dose: 3, note: '진정 목표 RASS -1 ~ -2' });
    O(p1, e1, 'J0228', { at: e1.at + HR, dose: 50, note: '통증 조절' });
    O(p1, e1, 'J0202', { at: e1.at + HR, freq: 'Q8H' });
    O(p1, e1, 'J0204', { at: e1.at + HR, freq: 'QD' });
    O(p1, e1, 'J0210', { at: e1.at + HR, freq: 'QD' });
    O(p1, e1, 'N5003', { at: e1.at + HR }); O(p1, e1, 'N5004', { at: e1.at + HR }); O(p1, e1, 'F6007', { at: e1.at + HR });
    O(p1, e1, 'L1015', { at: now - 5 * HR }); O(p1, e1, 'L1014', { at: now - 5 * HR }); O(p1, e1, 'L1001', { at: now - 5 * HR }); O(p1, e1, 'L1020', { at: e1.at, vals: { BCx: '폐렴구균 (Streptococcus pneumoniae) 자람 — 피페라실린 감수성' } });
    for (let h = 10; h >= 1; h--) {
      const at = now - h * HR;
      const sbp = jit(98, 6), dbp = jit(56, 4);
      db.vitals.push({ id: uid('vs'), patientId: p1.id, encId: e1.id, at, by: '이전 근무 간호사', sbp, dbp, hr: jit(104, 5), rr: 18, bt: jit(38.1, 0.3, 1), spo2: jit(95, 1), pain: 2, avpu: 'V', o2: true });
      R('icu', p1, at, { sbp, dbp, map: Math.round((sbp + 2 * dbp) / 3), hr: jit(104, 5), rr: 18, bt: jit(38.1, 0.3, 1), spo2: jit(95, 1), cvp: jit(9, 2), urine: Math.round(jit(32, 8)), rass: -2, gcs: '', drip: '노르에피 0.15' });
    }
    R('vent', p1, now - 6 * HR, { mode: '보조 조절 환기 (AC/VC)', fio2: 50, peep: 8, vt: 450, rr: 18, pip: 26, ett: '7.5mm, 입술 기준 22cm', cuff: 25, bundle: ['침상 머리 30~45도 올림', '구강 간호 (클로르헥시딘)', '위궤양 예방 약 투여', '정맥 혈전 예방'] });
    R('line', p1, now - 8 * HR, { cvc: '오른쪽 속목정맥 중심정맥관 (3일 전 삽입)', foley: '유치도뇨관 (3일 전 삽입)', aline: '왼쪽 노동맥 동맥관 (3일 전 삽입)', checks: ['중심정맥관 드레싱 깨끗함', '도뇨관 유지 필요성 평가함'] });
    R('drip', p1, now - 4 * HR, { drug: '노르에피네프린', dose: 0.15, unit: 'mcg/kg/min', rate: 9.6, reason: '평균동맥압 62 → 0.1에서 0.15로 올림' });
    db.assess.push({ id: uid('as'), patientId: p1.id, kind: 'braden', score: 10, level: '높은 위험', at: now - 9 * HR, by: '이전 근무 간호사', answers: {} });

    // ───── 중환자실 2: 송미경 뇌출혈 개두술 후 ─────
    const p2 = P({ name: '송미경', sex: 'F', birth: '1960-02-11', blood: 'A+', height: 158, weight: 60, ins: '건강보험', phone: '010-2201-34xx', address: '경기도 가상시 꽃길 18', guardian: '딸 이수진 010-6623-90xx', hx: '고혈압 (약 불규칙 복용)', scenario: {} });
    const e2 = E({ patientId: p2.id, type: 'IPD', dept: '신경외과', doctorId: 'dr9', status: '입원중', at: now - 30 * HR, ward: 'ICU', room: '외과계', bed: '1', diet: '금식 (NPO)', cc: '갑자기 심한 두통 후 의식 저하', dx: [{ code: 'I61.9', name: '뇌내출혈, 상세불명', main: true }, { code: 'I10', name: '본태성(원발성) 고혈압' }] });
    O(p2, e2, 'J0220', { at: e2.at + HR, note: '수축기 혈압 140mmHg 미만 유지' });
    O(p2, e2, 'N5014', { at: e2.at + HR }); O(p2, e2, 'F6006', { at: e2.at + HR });
    O(p2, e2, 'O9008', { at: e2.at, extra: { op: { anes: '전신마취', room: '1번방', surgeon: '임재현', ebl: 300, done: true } } });
    for (let h = 8; h >= 1; h--) {
      const at = now - h * HR; const sbp = jit(136, 6), dbp = jit(78, 4);
      db.vitals.push({ id: uid('vs'), patientId: p2.id, encId: e2.id, at, by: '이전 근무 간호사', sbp, dbp, hr: jit(76, 4), rr: jit(16, 1), bt: jit(37.2, 0.2, 1), spo2: jit(97, 1), pain: 3, gcs: 11 });
      R('icu', p2, at, { sbp, dbp, map: Math.round((sbp + 2 * dbp) / 3), hr: jit(76, 4), rr: 16, bt: jit(37.2, 0.2, 1), spo2: 97, cvp: '', urine: Math.round(jit(60, 10)), rass: 0, gcs: 'E3 V3 M5 = 11', pupil: '양쪽 3mm 빛 반사 있음', drip: '니카르디핀 5mg/hr' });
    }

    // ───── 분만실: 윤소라 (진통 중), 이다은 (유도분만) ─────
    const p3 = P({ name: '윤소라', sex: 'F', birth: '1994-05-03', blood: 'O+', height: 163, weight: 68, ins: '건강보험', phone: '010-3390-55xx', address: '서울시 가상구 아침길 11', guardian: '남편 정민호 010-4432-87xx', hx: '2회 임신 1회 출산 (2022년 자연분만). 임신 39주 2일. 임신성 당뇨 없음',
      obs: { g: 2, p: 1, ga: '39주 2일', gbs: '음성', hbsag: '음성' }, scenario: { fhr: 'normal' } });
    const e3 = E({ patientId: p3.id, type: 'IPD', dept: '산부인과', doctorId: 'dr8', status: '입원중', at: now - 4 * HR, ward: 'LD', room: '진통실', bed: '1', diet: '물만 조금씩', cc: '규칙적인 진통 (5분 간격)', dx: [{ code: 'O80', name: '단일 자연분만', main: true }] });
    O(p3, e3, 'J0217', { at: e3.at + 20 * MIN, freq: 'CONT', note: '시간당 100mL' }); O(p3, e3, 'N5001', { at: e3.at + 20 * MIN });
    R('labor', p3, now - 3 * HR, { dil: 4, station: -2, freq: 3, dur: 40, intensity: '중간', membrane: '유지', fhr: 142 });
    R('labor', p3, now - 90 * MIN, { dil: 5, station: -1, freq: 4, dur: 50, intensity: '중간', membrane: '유지', fhr: 138 });
    db.vitals.push({ id: uid('vs'), patientId: p3.id, encId: e3.id, at: now - 90 * MIN, by: '이전 근무 간호사', sbp: 122, dbp: 74, hr: 88, rr: 18, bt: 36.8, spo2: 99, pain: 7 });
    const p4 = P({ name: '이다은', sex: 'F', birth: '1998-10-19', blood: 'A+', height: 160, weight: 70, ins: '건강보험', phone: '010-8810-22xx', address: '서울시 가상구 노을길 5', guardian: '남편 최도윤 010-2219-65xx', hx: '첫 임신. 임신 40주 1일. 예정일 지나 유도분만',
      obs: { g: 1, p: 0, ga: '40주 1일', gbs: '음성', hbsag: '음성' }, scenario: { fhr: 'late' } });
    const e4 = E({ patientId: p4.id, type: 'IPD', dept: '산부인과', doctorId: 'dr8', status: '입원중', at: now - 6 * HR, ward: 'LD', room: '진통실', bed: '2', diet: '물만 조금씩', cc: '예정일 지남 — 유도분만', dx: [{ code: 'O80', name: '단일 자연분만', main: true }] });
    O(p4, e4, 'J0229', { at: e4.at + 30 * MIN, dose: 4, note: '2mU/분으로 시작, 30분마다 2mU씩 올림 (최대 20). 과다 수축이면 중단' });
    R('labor', p4, now - 2 * HR, { dil: 3, station: -2, freq: 5, dur: 70, intensity: '강함', membrane: '파수 — 맑음', fhr: 150 });

    // ───── 신생아실·NICU ─────
    const born1 = now - 46 * HR;
    const b1 = P({ name: '김지수 아기', sex: 'M', birth: T.d(born1), bornAt: born1, blood: 'O+', height: 50, weight: 3.05, birthWeight: 3200, ins: '건강보험', guardian: '엄마 김지수 010-7731-22xx', hx: '재태 기간 39주, 자연분만. 엄마 혈액형 O+',
      scenario: { bili: 11.8 } });
    const eb1 = E({ patientId: b1.id, type: 'IPD', dept: '소아청소년과', doctorId: 'dr10', status: '입원중', at: born1, ward: 'NB', room: '신생아실', bed: '1', diet: '모유 수유 (필요시)', cc: '정상 신생아', dx: [{ code: 'Z38.0', name: '병원에서 출생한 단태아', main: true }] });
    R('birth', b1, born1, { method: '자연분만', sex: 'M', weight: 3200, length: 50, head: 34, apgar1: 8, apgar5: 9, mother: '김지수', ga: '39주' }, '분만실 간호사');
    R('nbcare', b1, born1 + 30 * MIN, { item: '비타민 K 근육주사' }, '분만실 간호사'); R('nbcare', b1, born1 + 30 * MIN, { item: '안연고 (에리스로마이신)' }, '분만실 간호사'); R('nbcare', b1, born1 + 6 * HR, { item: 'B형간염 1차 접종' });
    [[born1 + 3 * HR, '모유 직접', 0], [born1 + 6 * HR, '모유 직접', 0], [born1 + 10 * HR, '분유', 20], [born1 + 20 * HR, '분유', 30], [born1 + 30 * HR, '모유 직접', 0], [born1 + 40 * HR, '분유', 45]].forEach(([at, type, ml]) => R('feed', b1, at, { type, ml, urine: 1, stool: at > born1 + 20 * HR ? 1 : 0, vomit: '없음' }));
    R('nb', b1, born1 + 24 * HR, { weight: 3100, temp: 36.8, hr: 138, rr: 44, note: '제대 깨끗함' });
    R('bili', b1, born1 + 26 * HR, { val: 7.2, hours: 26, photo: false });
    db.vitals.push({ id: uid('vs'), patientId: b1.id, encId: eb1.id, at: now - 4 * HR, by: '이전 근무 간호사', hr: 140, rr: 46, bt: 36.9, spo2: 98 });
    const born2 = now - 3 * DAY;
    const b2 = P({ name: '박미나 아기', sex: 'F', birth: T.d(born2), bornAt: born2, blood: 'A+', height: 43, weight: 1.79, birthWeight: 1850, ins: '건강보험', guardian: '엄마 박미나 010-4120-77xx', hx: '재태 기간 33주 2일 조산, 제왕절개. 출생 직후 호흡곤란으로 비침습 양압 환기 12시간',
      scenario: { bili: 9.4, preterm: true } });
    const eb2 = E({ patientId: b2.id, type: 'IPD', dept: '소아청소년과', doctorId: 'dr10', status: '입원중', at: born2, ward: 'NB', room: 'NICU', bed: '1', diet: '위관 영양 (유축 모유)', cc: '미숙아', dx: [{ code: 'P07.3', name: '기타 미숙아 (임신 33주)', main: true }] });
    R('birth', b2, born2, { method: '제왕절개', sex: 'F', weight: 1850, length: 43, head: 30, apgar1: 6, apgar5: 8, mother: '박미나', ga: '33주 2일' }, '분만실 간호사');
    R('nbcare', b2, born2 + 30 * MIN, { item: '비타민 K 근육주사' }, '분만실 간호사'); R('nbcare', b2, born2 + 30 * MIN, { item: '안연고 (에리스로마이신)' }, '분만실 간호사');
    for (let h = 33; h >= 3; h -= 3) R('feed', b2, now - h * HR, { type: '위관 (유축 모유)', ml: 22, residual: h === 6 ? 4 : 0, urine: 1, stool: h % 9 === 0 ? 1 : 0, vomit: '없음' });
    R('nicu', b2, now - 5 * HR, { incTemp: 33.5, humid: 60, mode: '피부 온도 조절 (36.5℃)', event: '무호흡 15초 1회 — 가벼운 자극으로 회복', kangaroo: false });
    R('bili', b2, now - 20 * HR, { val: 9.4, hours: 52, photo: true });
    db.vitals.push({ id: uid('vs'), patientId: b2.id, encId: eb2.id, at: now - 2 * HR, by: '이전 근무 간호사', hr: 152, rr: 52, bt: 36.6, spo2: 95 });

    // ───── 인공신장실 (외래 혈액투석) ─────
    const d1 = P({ name: '최정민', sex: 'M', birth: '1964-06-12', blood: 'AB+', height: 172, weight: 66.4, ins: '건강보험', special: { code: 'V001', name: '혈액투석 산정특례 (본인부담 10%)' }, phone: '010-6612-40xx', address: '서울시 가상구 강변로 70',
      hx: '당뇨병성 콩팥병으로 2021년부터 혈액투석', hd: { days: '월·수·금', time: '오전', dry: 64.0, access: '왼팔 동정맥루', since: '2021년' }, scenario: {} });
    const d2 = P({ name: '김순례', sex: 'F', birth: '1956-01-25', blood: 'O+', height: 152, weight: 53.1, ins: '의료급여 1종', special: { code: 'V001', name: '혈액투석 산정특례' }, phone: '010-2245-10xx', address: '서울시 가상구 시장길 2',
      hx: '고혈압성 콩팥병, 2025년 투석 시작. 동정맥루 수술 후 성숙 기다리는 중', hd: { days: '화·목·토', time: '오후', dry: 51.0, access: '오른쪽 속목정맥 투석 도관', since: '2025년' }, scenario: {} });
    [[d1, 2, 66.0, 64.1], [d1, 4, 65.8, 64.0], [d2, 2, 52.6, 51.2]].forEach(([p, ago, pre, post]) => R('hd', p, now - ago * DAY, { pre, post, uf: Math.round((pre - post) * 1000), dur: 240, bfr: 250, start: now - ago * DAY, end: now - ago * DAY + 4 * HR, sbpPre: 152, sbpPost: 134, done: true, note: '특이 사항 없음' }, '인공신장실 간호사'));
    R('hdlab', d1, now - 10 * DAY, { bunPre: 72, bunPost: 22, ktv: 1.38, urr: 69, k: 5.3, p: 5.9, hb: 10.4, alb: 3.8 }, '인공신장실 간호사');

    // 알림
    const nt = (to, text, pid, level) => db.notifs.push({ id: uid('nt'), to, text, patientId: pid, level: level || '', read: false, at: now - 20 * MIN });
    if (kc) nt('or', '수술 신청: 김철수 복강경 담낭절제술 — 수술 일정 확정 필요', kc.id);
    nt('ward:ICU', '한상우 노르에피네프린 0.15 진행 중 — 평균동맥압 확인', p1.id, 'stat');
    nt('ward:LD', '이다은 옥시토신 유도분만 중 — 태아 심박 감시 확인', p4.id, 'stat');
    nt('ward:NB', '김지수 아기 생후 48시간 — 선천성 대사이상 검사·황달 측정', b1.id);
    nt('hd', '오늘 투석: 최정민 (오전)', d1.id);
  }

  H.seed.phase2 = phase2;
})();
