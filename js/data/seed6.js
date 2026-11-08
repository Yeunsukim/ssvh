// 추가 실습 자료: 진단검사 파트별·영상 실별·기능검사 실별 (모두 가상 인물)
(function () {
  const H = window.H;
  const HR = 3600000, DAY = 86400000, MIN = 60000;

  function phase6(db) {
    const now = Date.now(); const T = H.t;
    const uid = (p) => H.uid(p);
    const P = (o) => { db.seq.mrn += 7; o.id = uid('pt'); o.mrn = String(db.seq.mrn).padStart(8, '0'); o.allergies = o.allergies || []; o.flags = o.flags || {}; o.scenario = o.scenario || {}; db.patients.push(o); return o; };
    const E = (o) => { o.id = uid('en'); db.encounters.push(o); return o; };
    const find = (n) => db.patients.find((p) => p.name === n);
    const encOf = (p) => db.encounters.find((e) => e.patientId === p.id && ['입원중', '대기', '진료중', '진료완료'].includes(e.status));
    const O = (p, e, code, o = {}) => {
      const it = H.M.item(code); const at = o.at || now - 40 * MIN; const st = o.status || '전송';
      const ord = { id: uid('or'), encId: e.id, patientId: p.id, encType: e.type, cat: it.cat, code, name: it.name, dose: it.dose, unit: it.unit, route: it.route, freq: it.freq || 'ONCE', days: 1, prn: false, stat: !!o.stat, outside: false, otype: e.type === 'ER' ? '응급' : '추가', note: o.note || '', status: st, at,
        by: `${H.M.doctor(e.doctorId).name} (의사)`, doctorId: e.doctorId, nurseAck: true, ward: e.type === 'ER' ? 'ER' : e.ward || null, qty: 1, hist: [{ s: '전송', at, by: '의사' }] };
      if (st === '채혈완료' || st === '검사접수') { ord.hist.push({ s: '채혈완료', at: at + 10 * MIN, by: '채혈실' }); ord.specimenAt = at + 10 * MIN; }
      if (st === '검사접수') ord.hist.push({ s: '검사접수', at: at + 20 * MIN, by: o.recvBy || '검사실' });
      if (st === '결과보고') { ord.result = { at: at + HR, by: '진단검사의학과', verified: true, items: it.items.map((x) => { const v = String(o.vals && o.vals[x.c] != null ? o.vals[x.c] : H.sim.labValue(p, x)); const j = H.flow.judge(x, v); return { c: x.c, n: x.n, u: x.u, v, flag: j.flag, dir: j.dir, ref: `${x.lo ?? ''}~${x.hi ?? ''}` }; }) }; ord.hist.push({ s: '결과보고', at: at + HR, by: '진단검사의학과' }); ord.nurseSeen = true; ord.drSeen = true; }
      if (ord.hist[ord.hist.length - 1].s !== st) ord.hist.push({ s: st, at: at + 20 * MIN, by: '담당 부서' });
      if (['불출', '출고'].includes(st) && !ord.arrivedAt) ord.arrivedAt = at + 20 * MIN;
      if (o.extra) Object.assign(ord, o.extra);
      db.orders.push(ord); return ord;
    };
    const room = (o, r) => { o.room = r; return o; };

    // ── 배성호: COPD 급성 악화 (호흡기) — 폐기능·호흡기 PCR·조영 흉부 CT·PET ──
    const b = P({ name: '배성호', sex: 'M', birth: '1952-09-03', blood: 'A+', height: 168, weight: 61, ins: '건강보험', phone: '010-6621-48xx', address: '서울시 가상구 강변로 27', guardian: '아들 배준혁 010-3390-21xx',
      hx: 'COPD (만성 폐쇄성 폐질환) 10년, 흡연 40갑년, 당뇨 (메트포르민 복용). 3일 전부터 숨참·누런 가래, 기침',
      scenario: { labs: { WBC: 12.6, CRP: 6.8, Glu: 148, Cr: 1.3, BUN: 26, FLU: '인플루엔자 A 양성' } } });
    const be = E({ patientId: b.id, type: 'IPD', dept: '내과', doctorId: 'dr1', status: '입원중', at: now - 20 * HR, ward: '7A', room: '708', bed: '2', diet: '당뇨식 (1,800kcal)', cc: '숨참·누런 가래 3일 — COPD 급성 악화', dx: [{ code: 'J44.1', name: '급성 악화를 동반한 만성 폐쇄성 폐질환', main: true }, { code: 'E11.9', name: '합병증 없는 2형 당뇨병' }] });
    O(b, be, 'D0108', { at: be.at + HR, status: '불출' });
    O(b, be, 'L1027', { at: now - 3 * HR, status: '검사접수', note: '인플루엔자 의심 — 비말 격리 여부 결정' });
    O(b, be, 'L1001', { at: now - 2 * HR, status: '검사접수' }); O(b, be, 'L1002', { at: now - 2 * HR, status: '검사접수' }); O(b, be, 'L1003', { at: be.at + HR, status: '결과보고', vals: { Cr: 1.3, BUN: 26 } });
    room(O(b, be, 'R3006', { at: now - 90 * MIN, status: '검사접수', note: '폐 결절 확인 — 조영 증강' }), 'CT 1실 ' + T.hm(now + 30 * MIN));
    O(b, be, 'C7017', { at: now - 60 * MIN, note: '퇴원 전 기관지 확장제 반응 확인 (안정 후 시행)' });
    db.vitals.push({ id: uid('vs'), patientId: b.id, encId: be.id, at: now - HR, by: '병동 간호사', sbp: 134, dbp: 78, hr: 98, rr: 24, bt: 37.6, spo2: 91, pain: 1 });

    // ── 심윤재: 운동 시 가슴 조임 (순환기 외래) — 운동부하 심전도·심근 관류 스캔 ──
    const s = P({ name: '심윤재', sex: 'M', birth: '1971-12-19', blood: 'O+', height: 175, weight: 82, ins: '건강보험', phone: '010-2245-77xx', address: '서울시 가상구 언덕길 9', hx: '고혈압, 협심증 의심 — 빨리 걸으면 가슴 조임 2개월', scenario: { labs: { Glu: 104 } } });
    const se = E({ patientId: s.id, type: 'OPD', dept: '순환기내과', doctorId: 'dr2', status: '진료완료', at: now - 2 * HR, qno: 4, visit: '초진', cc: '운동할 때 가슴 조임', dx: [{ code: 'I20.9', name: '협심증, 상세불명', main: true }] });
    O(s, se, 'C7015', { at: now - 100 * MIN, note: '브루스 방법, 목표 심박 85%' });
    room(O(s, se, 'R3019', { at: now - 100 * MIN, status: '검사접수', note: '운동부하 후 심근 관류 확인' }), '핵의학 감마카메라실 ' + T.hm(now + 40 * MIN));

    // ── 윤서진: 처음 생긴 경련 (신경과 외래) — 뇌파·뇌 MRI ──
    const y = P({ name: '윤서진', sex: 'F', birth: '1999-04-22', blood: 'B+', height: 163, weight: 52, ins: '건강보험', phone: '010-7781-30xx', address: '서울시 가상구 학교길 33', hx: '지난주 처음 경련 1회 (2분, 의식 잃음), 밤샘 공부 뒤', scenario: {} });
    const ye = E({ patientId: y.id, type: 'OPD', dept: '신경과', doctorId: 'dr4', status: '진료완료', at: now - 90 * MIN, qno: 2, visit: '초진', cc: '처음 생긴 경련', dx: [{ code: 'R56.8', name: '기타 및 상세불명의 경련', main: true }] });
    O(y, ye, 'C7012', { at: now - 80 * MIN, note: '수면 박탈 뇌파 — 과호흡·광자극 포함' });
    O(y, ye, 'R3008', { at: now - 80 * MIN, note: '첫 경련 — 구조적 원인 확인' });

    // ── 기존 환자에 붙이는 사례 ──
    const hs = find('한상우'); if (hs) { const e = encOf(hs); if (e) O(hs, e, 'L1022', { at: now - 4 * HR, status: '검사접수', note: '가래 증가 — 균 동정·감수성' }); }
    const hy = find('나현숙'); if (hy) { const e = encOf(hy); if (e) { O(hy, e, 'R3013', { at: now - HR, note: '폐경 후 골다공증 선별' }); O(hy, e, 'L1029', { at: now - HR, status: '검사접수', note: '골밀도 검사와 함께' }); } }
    const gm = find('고민석'); if (gm) { const e = encOf(gm); if (e) O(gm, e, 'L1031', { at: now - 2 * HR, status: '검사접수', note: '혈소판 수치 확인 — 응집 여부' }); }

    // ── 정도관리 지난 20일 기록 ──
    const QC = { '화학분석기 (가상 C-800)': [[95, 3], [280, 8]], '면역분석기 (가상 I-600)': [[0.03, 0.004], [1.2, 0.08]], '혈구분석기 (가상 H-500)': [[7.5, 0.2], [14.8, 0.3]], '응고분석기 (가상 CA-70)': [[12, 0.4], [30, 1.2]] };
    let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    Object.entries(QC).forEach(([an, lv]) => { for (let d = 20; d >= 1; d--) { lv.forEach(([m, sd], i) => { let z = (rnd() + rnd() + rnd() - 1.5) * 1.3; if (an.startsWith('화학') && d === 6 && i === 0) z = 2.3; const v = +(m + z * sd).toFixed(sd < 0.1 ? 3 : 1);
      db.recs.push({ id: uid('rc'), kind: 'qc', patientId: null, at: T.at(now - d * DAY, 7, 10 + i), by: '야간 임상병리사', an, lv: i ? 'L2' : 'L1', v, res: Math.abs(z) > 3 ? '거부' : Math.abs(z) > 2 ? '경고' : '통과', why: Math.abs(z) > 2 ? '1-2s (2표준편차 넘음 — 다른 규칙 확인)' : '', fix: '' }); }); } });

    const nt = (to, text, pid) => db.notifs.push({ id: uid('nt'), to, text, patientId: pid || null, at: now - 10 * MIN, read: false, level: '' });
    nt('lab', '오늘 아침 정도관리를 아직 하지 않았습니다 — 환자 검사 전에 정도관리 탭에서 측정하세요');
    nt('rad', `조영제 검사 준비: ${b.name} 흉부 CT — 당뇨약(메트포르민) 복용, 크레아티닌 1.3`, b.id);
    nt('func', `오늘 기능검사: ${s.name} 운동부하, ${y.name} 뇌파, ${b.name} 기관지 확장제 반응 폐기능`);
  }

  H.seed.phase6 = phase6;
})();
