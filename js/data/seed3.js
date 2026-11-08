// 3단계 실습 자료: 퇴원 환자(수납 완료·청구 전), 자동차보험 응급 환자 (모두 가상 인물)
(function () {
  const H = window.H;
  const HR = 3600000, DAY = 86400000, MIN = 60000;

  function phase3(db) {
    const now = Date.now();
    const uid = (p) => H.uid(p);
    const P = (o) => { db.seq.mrn += 7; o.id = uid('pt'); o.mrn = String(db.seq.mrn).padStart(8, '0'); o.allergies = o.allergies || []; o.flags = o.flags || {}; o.scenario = o.scenario || {}; db.patients.push(o); return o; };
    const E = (o) => { o.id = uid('en'); db.encounters.push(o); return o; };
    const O = (p, e, code, o = {}) => {
      const it = H.M.item(code); const at = o.at || e.at + HR;
      const ord = { id: uid('or'), encId: e.id, patientId: p.id, encType: e.type, cat: it.cat, code, name: it.name, dose: it.dose, unit: it.unit, route: it.route, freq: o.freq || it.freq || 'ONCE', days: o.days || 1, prn: false, stat: false, outside: false, otype: '정규', note: o.note || '', at,
        by: `${H.M.doctor(e.doctorId).name} (의사)`, doctorId: e.doctorId, nurseAck: true, ward: e.type === 'ER' ? 'ER' : e.ward, qty: o.qty || 1, hist: [{ s: '전송', at, by: '의사' }] };
      const steps = H.flow.steps(ord); ord.status = steps[steps.length - 1]; ord.hist.push({ s: ord.status, at: at + HR, by: '담당 부서' });
      if (it.cat === 'MED' || it.cat === 'INJ') ord.arrivedAt = at + HR;
      if (it.cat === 'LAB') ord.result = { at: at + 2 * HR, by: '진단검사의학과', verified: true, items: it.items.map((x) => { const v = String(o.vals && o.vals[x.c] != null ? o.vals[x.c] : H.sim.labValue(p, x)); const j = H.flow.judge(x, v); return { c: x.c, n: x.n, u: x.u, v, flag: j.flag, dir: j.dir, ref: x.text ? x.normal : `${x.lo ?? ''}~${x.hi ?? ''}` }; }) };
      if (it.cat === 'RAD') { ord.shotAt = at + HR; ord.result = { at: at + 2 * HR, by: '영상의학과 전문의 정다온', findings: o.f || '특이 소견 없음', impression: o.i || '특이 소견 없음' }; }
      ord.nurseSeen = true; ord.drSeen = true;
      if (o.extra) Object.assign(ord, o.extra);
      db.orders.push(ord); return ord;
    };
    const note = (p, e, type, at, content) => db.notes.push({ id: uid('no'), encId: e.id, patientId: p.id, type, at, by: `${H.M.doctor(e.doctorId).name} (의사)`, signed: true, content });
    const bill = (e, at, method) => {
      const S = H.store; const c = H.fee.calc(e);
      const no = `R${H.t.d(at).replace(/-/g, '').slice(2)}-${String(db.bills.length + 1).padStart(5, '0')}`;
      db.bills.push({ id: uid('bl'), no, encId: e.id, patientId: e.patientId, kind: e.type === 'IPD' ? '퇴원 수납' : '응급실 수납', at, total: c.total, ins: c.ins, self: c.self, non: c.non, paid: c.due, method, by: '원무과 직원', payer: c.r.payer, label: c.r.label, groups: c.groups });
      e.billed = at;
      return S;
    };

    // 1) 노영수 — 충수절제술 퇴원 (퇴원요약 미비, 프로칼시토닌 삭감 대상, 포괄수가 DRG)
    const a = P({ name: '노영수', sex: 'M', birth: '1967-03-15', blood: 'A+', height: 174, weight: 72, ins: '건강보험', phone: '010-7712-33xx', address: '서울시 가상구 들판길 9', hx: '없음', scenario: { labs: { WBC: 14.2, CRP: 6.8, PCT: 0.3 } } });
    const ea = E({ patientId: a.id, type: 'IPD', dept: '외과', doctorId: 'dr3', status: '퇴원', at: now - 6 * DAY, endAt: now - 2 * DAY, ward: '8B', room: '802', bed: '1', diet: '일반식', cc: '오른쪽 아랫배 통증', dx: [{ code: 'K35.8', name: '급성 충수염', main: true }],
      dc: { at: now - 2 * DAY - 6 * HR, by: '문태호 (의사)', date: H.t.d(now - 2 * DAY), form: '집으로', fu: '1주 뒤 외과 외래', ward: { at: now - 2 * DAY - 4 * HR, by: '병동 간호사' }, review: { at: now - 2 * DAY - 2 * HR, by: '보험심사 간호사' } } });
    O(a, ea, 'L1001', { at: ea.at + HR }); O(a, ea, 'L1007', { at: ea.at + HR }); O(a, ea, 'L1008', { at: ea.at + HR });
    O(a, ea, 'R3007', { at: ea.at + 2 * HR, f: '충수가 12mm로 부어 있고 주위 지방 침윤', i: '급성 충수염' });
    O(a, ea, 'O9003', { at: ea.at + 4 * HR, extra: { op: { anes: '전신마취', room: '2번방', date: H.t.d(ea.at), surgeon: '문태호', preop: { checks: ['수술·마취 동의서 서명 확인'], by: '병동 간호사', at: ea.at + 5 * HR }, done: true } } });
    O(a, ea, 'J0201', { at: ea.at + HR, qty: 4, freq: 'QD', days: 4 }); O(a, ea, 'J0217', { at: ea.at + HR, qty: 3, freq: 'CONT' }); O(a, ea, 'J0207', { at: ea.at + 8 * HR, qty: 2, freq: 'PRN' });
    note(a, ea, '입원기록', ea.at + 2 * HR, { cc: '오른쪽 아랫배 통증 하루', hpi: '어제 저녁부터 배꼽 주위 통증이 오른쪽 아랫배로 옮겨 감', pe: '맥버니 압통·반발통', assess: '#1 급성 충수염', plan: '복강경 충수절제술' });
    note(a, ea, '수술기록', ea.at + 9 * HR, { assess: '수술 전·후: 급성 충수염', plan: '복강경으로 부은 충수를 절제함. 천공 없음.', result: '합병증 없음, 출혈 20mL' });
    note(a, ea, '경과기록', ea.at + DAY + 3 * HR, { S: '통증 줄었음', O: '체온 37.2, 상처 깨끗', A: '수술 후 1일, 호전', P: '죽 시작' });
    db.nnotes.push({ id: uid('nn'), patientId: a.id, encId: ea.id, at: ea.at + DAY, by: '병동 간호사', format: '서술', text: '수술 후 첫 보행 함. 통증 3점.' });
    bill(ea, now - 2 * DAY - HR, '신용카드');

    // 2) 백은비 — 제왕절개 퇴원 (제왕절개 5%, 알부민 삭감 대상, 기록 완비)
    const b = P({ name: '백은비', sex: 'F', birth: '1992-08-08', blood: 'B+', height: 165, weight: 66, ins: '건강보험', phone: '010-4498-21xx', address: '서울시 가상구 아침길 30', hx: '첫 임신, 역아(거꾸로 선 아기)', obs: { g: 1, p: 1, ga: '38주 5일', gbs: '음성', hbsag: '음성' }, scenario: { labs: { Alb: 3.4, Hb: 10.6 } } });
    const eb = E({ patientId: b.id, type: 'IPD', dept: '산부인과', doctorId: 'dr8', status: '퇴원', at: now - 5 * DAY, endAt: now - DAY, ward: 'LD', room: '산후회복', bed: '3', diet: '일반식', cc: '역아 — 예정 제왕절개', dx: [{ code: 'O82', name: '제왕절개에 의한 단일 분만', main: true }],
      dc: { at: now - DAY - 6 * HR, by: '서윤아 (의사)', date: H.t.d(now - DAY), form: '집으로', fu: '1주 뒤 산부인과 외래', ward: { at: now - DAY - 5 * HR, by: '병동 간호사' }, review: { at: now - DAY - 3 * HR, by: '보험심사 간호사' } } });
    db.recs.push({ id: uid('rc'), kind: 'birth', patientId: b.id, at: eb.at + 3 * HR, by: '분만실 간호사', method: '제왕절개', sex: 'F', weight: 3050, apgar1: 8, apgar5: 9, mother: b.name, ga: '38주 5일', ebl: 600 });
    O(b, eb, 'O9005', { at: eb.at + HR, extra: { op: { anes: '척추마취', room: '4번방', date: H.t.d(eb.at), surgeon: '서윤아', preop: { checks: ['수술·마취 동의서 서명 확인'], by: '병동 간호사', at: eb.at }, done: true } } });
    O(b, eb, 'J0233', { at: eb.at + 2 * HR }); O(b, eb, 'L1001', { at: eb.at + DAY, vals: { Hb: 10.6 } }); O(b, eb, 'L1004', { at: eb.at + DAY, vals: { Alb: 3.4 } });
    O(b, eb, 'J0218', { at: eb.at + DAY + 4 * HR, qty: 2, note: '수술 후 부종' }); O(b, eb, 'J0217', { at: eb.at + HR, qty: 2, freq: 'CONT' });
    note(b, eb, '입원기록', eb.at + HR, { cc: '역아', hpi: '임신 38주 5일, 역아로 예정 제왕절개', assess: '#1 역아 #2 임신 38주', plan: '척추마취 제왕절개' });
    note(b, eb, '수술기록', eb.at + 4 * HR, { assess: '역아', plan: '하부 자궁 횡절개로 여아 분만 (3,050g)', result: '출혈 600mL, 합병증 없음' });
    note(b, eb, '경과기록', eb.at + DAY + 2 * HR, { S: '상처 통증 4점', O: '자궁 단단함, 오로 중간', A: '수술 후 1일 호전', P: '보행·모유 수유 교육' });
    note(b, eb, '경과기록', eb.at + 2 * DAY + 2 * HR, { S: '불편감 적음', O: '활력징후 안정', A: '호전', P: '퇴원 준비' });
    note(b, eb, '퇴원요약', eb.at + 3 * DAY, { course: '역아로 제왕절개 후 회복 순조', result: '상처 깨끗, 수유 중', meds: '진통제 5일분', fu: '1주 뒤 외래' });
    db.nnotes.push({ id: uid('nn'), patientId: b.id, encId: eb.id, at: eb.at + DAY, by: '병동 간호사', format: '서술', text: '자궁저부 배꼽 높이에서 단단함, 오로 중간.' });
    bill(eb, now - DAY - HR, '신용카드');

    // 3) 주현태 — 교통사고 응급실 귀가 (자동차보험 → 계약처 청구·미수)
    const c = P({ name: '주현태', sex: 'M', birth: '1981-11-02', blood: 'O+', height: 176, weight: 80, ins: '자동차보험', payerInfo: { no: '26-1104-55xx', name: '가상손해보험' }, phone: '010-9901-12xx', address: '경기도 가상시 큰길 4', hx: '없음', scenario: {} });
    const ec = E({ patientId: c.id, type: 'ER', dept: '응급의학과', doctorId: 'dr5', status: '귀가', at: now - 3 * DAY, endAt: now - 3 * DAY + 3 * HR, ward: 'ER', room: 'B구역', bed: '2', ktas: 4, arrival: '걸어서', cc: '교통사고 후 오른쪽 발목 통증', dx: [{ code: 'S93.4', name: '발목의 염좌 및 긴장', main: true }], dispo: '귀가' });
    O(c, ec, 'R3004', { at: ec.at + 20 * MIN, f: '골절 없음, 연부조직 부종', i: '골절 없음' }); O(c, ec, 'J0206', { at: ec.at + 30 * MIN }); O(c, ec, 'C7008', { at: ec.at + HR });
    bill(ec, now - 3 * DAY + 3 * HR, '지불보증');

    db.notifs.push({ id: uid('nt'), to: 'mrd', text: '퇴원 분석 대상: 노영수, 백은비', patientId: a.id, level: '', read: false, at: now - HR });
    db.notifs.push({ id: uid('nt'), to: 'review', text: '청구 대상 명세서 2건 (노영수, 백은비)', patientId: a.id, level: '', read: false, at: now - HR });
  }

  H.seed.phase3 = phase3;
})();
