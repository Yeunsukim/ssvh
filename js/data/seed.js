// 실습 시작 상태: 가상 환자와 지금까지의 진료 기록 (모두 교육용 가상 인물)
(function () {
  const H = window.H;
  const HR = 3600000, DAY = 86400000;

  function build() {
    const now = Date.now();
    const db = { version: 1, createdAt: now, seq: { mrn: 12300 }, patients: [], encounters: [], orders: [], notes: [], vitals: [], io: [], mar: [], nnotes: [], assess: [], handoffs: [], comms: [], codes: [], acts: [], notifs: [], audit: [], admreq: [], specimens: [] };
    const uid = (p) => H.uid(p);
    const T = H.t;

    const P = (o) => { db.seq.mrn += 7; o.id = o.id || uid('pt'); o.mrn = String(db.seq.mrn).padStart(8, '0'); o.allergies = o.allergies || []; o.flags = o.flags || {}; o.scenario = o.scenario || {}; db.patients.push(o); return o; };
    const E = (o) => { o.id = o.id || uid('en'); db.encounters.push(o); return o; };

    function labItems(p, it, over) {
      return it.items.map((x) => {
        const v = over && over[x.c] != null ? String(over[x.c]) : H.sim.labValue(p, x);
        const j = H.flow.judge(x, v);
        return { c: x.c, n: x.n, u: x.u, v, flag: j.flag, dir: j.dir, ref: x.text ? x.normal : `${x.lo ?? ''}~${x.hi ?? ''}` };
      });
    }

    // 처방 만들기 (target 단계까지 진행된 상태로)
    function O(p, enc, code, o = {}) {
      const it = H.M.item(code);
      const at = o.at || enc.at + 20 * 60000;
      const ord = {
        id: uid('or'), encId: enc.id, patientId: p.id, encType: enc.type, cat: it.cat, code, name: it.name,
        dose: o.dose != null ? o.dose : it.dose, unit: o.unit || it.unit, route: o.route || it.route, freq: o.freq || it.freq || 'ONCE',
        days: o.days || 1, prn: (o.freq || it.freq) === 'PRN', stat: !!o.stat, outside: false,
        otype: o.otype || (enc.type === 'ER' ? '응급' : enc.type === 'OPD' ? '외래' : '정규'), note: o.note || '',
        status: '전송', at, by: `${H.M.doctor(enc.doctorId).name} (의사)`, doctorId: enc.doctorId, nurseAck: o.ack !== false,
        hist: [], ward: enc.type === 'ER' ? 'ER' : enc.ward || null,
      };
      if (it.cat === 'MED' || it.cat === 'INJ') ord.qty = Math.max(1, (H.M.FREQ[ord.freq] ? H.M.FREQ[ord.freq].n : 1) * ord.days);
      const steps = H.flow.steps(ord);
      const target = o.status || steps[steps.length - 1];
      const idx = steps.indexOf(target);
      steps.slice(0, idx + 1).forEach((s, i) => ord.hist.push({ s, at: at + i * 25 * 60000, by: i === 0 ? ord.by : DEPT_BY[it.cat] || '담당자' }));
      ord.status = target;
      const doneAt = at + idx * 25 * 60000;
      if (it.cat === 'LAB' && idx >= 3) ord.result = { at: doneAt, by: '진단검사의학과', items: labItems(p, it, o.vals), verified: target === '결과보고' };
      if (it.cat === 'LAB' && idx >= 1) ord.specimenAt = at + 25 * 60000;
      if (it.cat === 'RAD' && idx >= 3) { const r = H.sim.radReport(p, ord); ord.result = { at: doneAt, by: '영상의학과 전문의 정다온', findings: o.findings || r.findings, impression: o.impression || r.impression, lesion: r.lesion }; }
      if (it.cat === 'RAD' && idx >= 2) ord.shotAt = at + 50 * 60000;
      if (ord.result) { ord.nurseSeen = true; ord.drSeen = true; }
      if (target === steps[steps.length - 1] && (it.cat === 'MED' || it.cat === 'INJ')) ord.arrivedAt = at + idx * 25 * 60000;
      if (o.extra) Object.assign(ord, o.extra);
      db.orders.push(ord);
      return ord;
    }
    const DEPT_BY = { MED: '약제부', INJ: '약제부', LAB: '진단검사의학과', RAD: '영상의학과', PATH: '병리과', NUR: '병동 간호사', DIET: '영양팀', PROC: '병동 간호사', BLOOD: '혈액은행' };

    // 투약 기록: 지난 시간 칸은 이전 근무자가 투약한 것으로
    function pastMar(p, ord, until) {
      if (ord.freq === 'CONT') { db.mar.push({ id: uid('ma'), orderId: ord.id, patientId: p.id, slot: ord.arrivedAt || ord.at, status: '투약', at: ord.at + HR, by: '이전 근무 간호사', checks: ['환자', '약', '용량', '경로', '시간'] }); return; }
      const f = H.M.FREQ[ord.freq];
      if (!f || !f.times.length) return;
      for (let d = T.startOfDay(ord.at); d <= now; d += DAY) {
        f.times.forEach((h) => {
          const slot = T.at(d, h);
          if (slot > ord.at + HR && slot < (until || now - 90 * 60000)) {
            db.mar.push({ id: uid('ma'), orderId: ord.id, patientId: p.id, slot, status: '투약', at: slot + 6 * 60000, by: '이전 근무 간호사', checks: ['환자', '약', '용량', '경로', '시간'] });
          }
        });
      }
    }
    // 활력징후 4시간마다
    function vitals(p, enc, from, fn) {
      let i = 0;
      for (let d = T.startOfDay(from); d <= now; d += DAY) {
        [2, 6, 10, 14, 18, 22].forEach((h) => {
          const ts = T.at(d, h);
          if (ts > from && ts < now - 70 * 60000) { db.vitals.push(Object.assign({ id: uid('vs'), patientId: p.id, encId: enc.id, at: ts, by: '이전 근무 간호사' }, fn(i++))); }
        });
      }
    }
    const jit = (v, r, d = 0) => Number((v + (Math.random() * 2 - 1) * r).toFixed(d));

    const curShift = T.shiftOf(now);
    const shiftStart = T.shiftRange(curShift, now)[0];
    const prevShift = { D: 'N', E: 'D', N: 'E' }[curShift];

    // ───────── 1. 홍길순: 폐렴 + 당뇨, 페니실린 알레르기, 낙상 고위험 (7A 내과) ─────────
    const p1 = P({ name: '홍길순', sex: 'F', birth: '1953-04-12', blood: 'A+', height: 152, weight: 51, phone: '010-2381-55xx', address: '서울시 가상구 한빛로 12', ins: '건강보험', guardian: '아들 홍민수 010-7781-12xx',
      allergies: [{ cls: 'penicillin', name: '페니실린', reaction: '전신 두드러기 (2019년)' }],
      hx: '2형 당뇨병 15년 (먹는 약 복용), 고혈압 10년, 2021년 오른쪽 백내장 수술',
      scenario: { labs: { WBC: 13.4, CRP: 9.8, Glu: 238, PCT: 1.2, BST: 228 }, rad: { cxr: { f: '우하엽에 경화(consolidation) 소견, 공기기관지조영상 동반. 소량의 우측 흉수.', i: '우하엽 폐렴, 소량 흉수', lesion: { x: 132, y: 265, rx: 48, ry: 38 } } } } });
    const e1 = E({ patientId: p1.id, type: 'IPD', dept: '내과', doctorId: 'dr1', status: '입원중', at: now - 2 * DAY - 5 * HR, ward: '7A', room: '701', bed: '1', diet: '당뇨식 1,800kcal', cc: '3일 전부터 기침, 가래, 열 (38.9℃)', dx: [{ code: 'J18.9', name: '폐렴, 상세불명', main: true }, { code: 'E11.9', name: '2형 당뇨병, 합병증 없음' }, { code: 'I10', name: '본태성(원발성) 고혈압' }] });
    const b1 = e1.at + HR;
    const o1a = O(p1, e1, 'J0201', { at: b1, freq: 'QD', days: 7, dose: 2 });
    const o1b = O(p1, e1, 'J0215', { at: b1, freq: 'CONT', days: 3, note: '시간당 80mL' });
    O(p1, e1, 'D0101', { at: b1, freq: 'PRN', note: '체온 38℃ 이상일 때' });
    O(p1, e1, 'J0209', { at: b1, freq: 'PRN', note: '혈당 200~249: 4단위 / 250~299: 6단위 / 300 이상: 8단위 후 의사에게 알림' });
    O(p1, e1, 'D0107', { at: b1, freq: 'QD', days: 7 });
    O(p1, e1, 'N5001', { at: b1, freq: 'Q4H' }); O(p1, e1, 'N5005', { at: b1, freq: 'QID' }); O(p1, e1, 'N5009', { at: b1, freq: 'CONT' });
    O(p1, e1, 'F6004', { at: b1 });
    O(p1, e1, 'L1001', { at: b1, vals: { WBC: 15.2, Hb: 11.8, PLT: 312 } }); O(p1, e1, 'L1007', { at: b1, vals: { CRP: 12.4 } });
    O(p1, e1, 'L1002', { at: b1 }); O(p1, e1, 'L1003', { at: b1, vals: { BUN: 24, Cr: 1.0 } }); O(p1, e1, 'L1020', { at: b1, vals: { BCx: '3일째 균 자라지 않음 (최종 결과 대기)' } });
    O(p1, e1, 'R3001', { at: b1 });
    // 오늘 아침 추적 검사 (채혈 대기)
    O(p1, e1, 'L1001', { at: T.at(now, 5, 30) < now ? T.at(now, 5, 30) : now - 30 * 60000, status: '전송', ack: true });
    O(p1, e1, 'L1007', { at: T.at(now, 5, 30) < now ? T.at(now, 5, 30) : now - 30 * 60000, status: '전송', ack: true });
    [o1a, o1b].forEach((o) => pastMar(p1, o));
    db.orders.filter((o) => o.patientId === p1.id && o.code === 'D0107').forEach((o) => pastMar(p1, o));
    vitals(p1, e1, e1.at, (i) => { const bt = Math.max(36.8, 38.9 - i * 0.12); return { sbp: jit(132, 8), dbp: jit(78, 6), hr: Math.round(104 - i * 1.4 + jit(0, 4)), rr: jit(22 - i * 0.2, 1), bt: jit(bt, 0.15, 1), spo2: Math.min(98, Math.round(92 + i * 0.4)), pain: Math.max(0, 4 - Math.floor(i / 3)) }; });
    db.mar.push({ id: uid('ma'), orderId: db.orders.find((o) => o.patientId === p1.id && o.code === 'D0101').id, patientId: p1.id, slot: now - DAY + 2 * HR, status: '투약', at: now - DAY + 2 * HR, by: '이전 근무 간호사', prnReason: '체온 38.6℃', checks: ['환자', '약', '용량', '경로', '시간'] });
    db.notes.push({ id: uid('no'), encId: e1.id, patientId: p1.id, type: '입원기록', at: e1.at + 2 * HR, by: '한지훈 (의사)', signed: true, content: { cc: '3일 전부터 기침, 누런 가래, 열', hpi: '73세 여자 환자로 3일 전부터 기침과 가래, 38.9℃ 발열 있어 외래 경유 입원함. 호흡곤란 약간 있음.', pmh: '2형 당뇨 15년, 고혈압 10년. 페니실린 알레르기 (두드러기).', pe: '우하폐야 수포음(crackle) 청진됨. 의식 명료.', assess: '#1 지역사회획득 폐렴 (우하엽)\n#2 2형 당뇨 — 혈당 조절 불량\n#3 고혈압', plan: '세프트리악손 정맥주사 (페니실린 알레르기로 세팔로스포린 선택, 교차반응 관찰)\n혈당 하루 4번 측정 + 인슐린 슬라이딩 스케일\n3일 후 흉부 X선, 혈액검사 추적' } });
    db.notes.push({ id: uid('no'), encId: e1.id, patientId: p1.id, type: '경과기록', at: now - DAY + 3 * HR, by: '한지훈 (의사)', signed: true, content: { S: '기침은 조금 줄었으나 가래 여전함. 밤에 잠을 잘 못 잤다고 함.', O: '체온 37.9℃, 맥박 96회, 산소포화도 95% (실내 공기). 우하폐야 수포음 감소.', A: '폐렴 호전 중. 혈당 220~260으로 높음.', P: '항생제 유지. 내일 아침 혈액검사 추적. 당뇨식 유지, 인슐린 스케일 유지.' } });
    db.assess.push({ id: uid('as'), patientId: p1.id, kind: 'morse', score: 55, level: '고위험', at: e1.at + 3 * HR, by: '이전 근무 간호사', answers: { hx: 25, dx2: 15, aid: 0, iv: 20, gait: 10, mental: 0 } });
    db.assess.push({ id: uid('as'), patientId: p1.id, kind: 'braden', score: 16, level: '경도 위험', at: e1.at + 3 * HR, by: '이전 근무 간호사', answers: {} });
    db.assess.push({ id: uid('as'), patientId: p1.id, kind: 'initial', score: null, level: '완료', at: e1.at + 2 * HR, by: '이전 근무 간호사', answers: { route: '외래 경유', comm: '의사소통 가능, 보청기 없음', habit: '흡연 안 함, 음주 안 함', elim: '배뇨 정상, 변비 경향', sleep: '수면 장애 (기침으로)', mind: '입원으로 걱정 많음', religion: '불교', care: '아들이 보호자' } });
    db.nnotes.push({ id: uid('nn'), patientId: p1.id, encId: e1.id, at: now - 14 * HR, by: '이전 근무 간호사', format: 'DAR', focus: '고체온', D: '체온 38.6℃, 오한 호소, 얼굴 붉음', A: '아세트아미노펜 500mg 먹는 약 투여. 미온수 마사지. 수분 섭취 격려.', R: '1시간 뒤 체온 37.8℃, 오한 사라짐.' });
    db.nnotes.push({ id: uid('nn'), patientId: p1.id, encId: e1.id, at: now - 9 * HR, by: '이전 근무 간호사', format: '서술', text: '밤사이 기침으로 2~3회 깸. 침상 난간 올려져 있고 호출벨 손 닿는 곳에 있음. 화장실 갈 때 간호사 호출하도록 다시 교육함.' });

    // ───────── 2. 김철수: 급성 담낭염, 금식, 수술 예정 (8B 외과) ─────────
    const p2 = P({ name: '김철수', sex: 'M', birth: '1968-09-03', blood: 'O+', height: 171, weight: 78, phone: '010-4412-90xx', address: '경기도 가상시 새봄길 33', ins: '건강보험', guardian: '배우자 이정미 010-5521-33xx',
      hx: '특이 과거력 없음. 하루 반 갑 흡연 20년.',
      scenario: { labs: { WBC: 12.6, AST: 72, ALT: 81, TBil: 1.9 }, rad: { usabd: { f: '담낭벽이 6mm로 두꺼워져 있고, 담낭 경부에 1.5cm 담석이 끼어 있음. 담낭 주위 액체 고임. 초음파 머피 징후 양성.', i: '급성 결석성 담낭염', lesion: { x: 200, y: 200, rx: 85 } } } } });
    const e2 = E({ patientId: p2.id, type: 'IPD', dept: '외과', doctorId: 'dr3', status: '입원중', at: now - DAY - 3 * HR, ward: '8B', room: '805', bed: '2', diet: '금식 (NPO)', cc: '어제 저녁부터 오른쪽 윗배 통증, 구토 2회', dx: [{ code: 'K81.0', name: '급성 담낭염', main: true }, { code: 'K80.2', name: '담낭결석 (담낭염 없음)' }] });
    const b2 = e2.at + HR;
    const o2a = O(p2, e2, 'J0201', { at: b2, dose: 2, days: 5 });
    const o2b = O(p2, e2, 'J0217', { at: b2, freq: 'CONT', days: 3, note: '시간당 100mL' });
    O(p2, e2, 'J0207', { at: b2, freq: 'PRN', note: '통증 점수 7점 이상' });
    O(p2, e2, 'J0204', { at: b2, freq: 'QD', days: 5 });
    O(p2, e2, 'N5001', { at: b2 }); O(p2, e2, 'N5004', { at: b2 }); O(p2, e2, 'F6006', { at: b2 });
    O(p2, e2, 'L1001', { at: b2, vals: { WBC: 14.8 } }); O(p2, e2, 'L1004', { at: b2, vals: { AST: 88, ALT: 95, TBil: 2.1 } }); O(p2, e2, 'L1024', { at: b2 }); O(p2, e2, 'L1009', { at: b2 });
    O(p2, e2, 'R3009', { at: b2 });
    [o2a, o2b].forEach((o) => pastMar(p2, o));
    db.orders.filter((o) => o.patientId === p2.id && o.code === 'J0204').forEach((o) => pastMar(p2, o));
    vitals(p2, e2, e2.at, (i) => ({ sbp: jit(138, 8), dbp: jit(86, 5), hr: jit(92 - i, 4), rr: jit(18, 1), bt: jit(37.9 - i * 0.08, 0.15, 1), spo2: jit(97, 1), pain: Math.max(2, 7 - i) }));
    db.assess.push({ id: uid('as'), patientId: p2.id, kind: 'morse', score: 20, level: '저위험', at: e2.at + 2 * HR, by: '이전 근무 간호사', answers: {} });
    db.assess.push({ id: uid('as'), patientId: p2.id, kind: 'pain', score: 5, level: '중등도 통증', at: now - 6 * HR, by: '이전 근무 간호사', answers: { site: '오른쪽 윗배', type: '쥐어짜는 듯' } });
    db.nnotes.push({ id: uid('nn'), patientId: p2.id, encId: e2.id, at: now - 10 * HR, by: '이전 근무 간호사', format: 'DAR', focus: '급성 통증', D: '오른쪽 윗배 통증 8점, 쥐어짜는 양상', A: '모르핀 2mg 정맥주사 (의사 처방). 무릎 굽힌 편한 자세 도움.', R: '30분 후 통증 4점으로 감소, 호흡수 16회 안정.' });
    db.notes.push({ id: uid('no'), encId: e2.id, patientId: p2.id, type: '입원기록', at: e2.at + 2 * HR, by: '문태호 (의사)', signed: true, content: { cc: '오른쪽 윗배 통증', hpi: '58세 남자, 기름진 식사 후 오른쪽 윗배 통증과 구토로 응급실 경유 입원.', pmh: '없음. 흡연 20갑년.', pe: '오른쪽 윗배 압통, 머피 징후 양성.', assess: '#1 급성 결석성 담낭염', plan: '금식, 수액, 항생제. 복강경 담낭절제술 예정 (2단계 수술 실습).' } });

    // ───────── 3. 윤대한: 심부전 + 만성콩팥병, DNR, 의료급여 (7A) ─────────
    const p3 = P({ name: '윤대한', sex: 'M', birth: '1950-01-20', blood: 'B+', height: 168, weight: 72, phone: '010-3390-12xx', address: '서울시 가상구 늘봄로 7', ins: '의료급여 1종', guardian: '딸 윤하나 010-9912-44xx',
      flags: { dnr: true }, hx: '심부전 (박출률 30%), 만성콩팥병 3기, 2018년 심근경색 (스텐트 시술)',
      scenario: { labs: { K: 6.1, Na: 131, Cr: 2.3, BUN: 48, BNP: 1850 }, rad: { cxr: { f: '심장 비대 (심흉곽비 0.62). 양측 폐문부 혈관 음영 증가, 양측 소량 흉수.', i: '심부전에 의한 폐부종 소견', lesion: { x: 200, y: 290, rx: 120, ry: 40 } } } } });
    const e3 = E({ patientId: p3.id, type: 'IPD', dept: '순환기내과', doctorId: 'dr2', status: '입원중', at: now - 3 * DAY - 2 * HR, ward: '7A', room: '705', bed: '1', diet: '저염식 (소금 6g 이하)', cc: '숨참, 다리 부종 1주', dx: [{ code: 'I50.0', name: '울혈성 심부전', main: true }, { code: 'N18.3', name: '만성 콩팥병 3기' }] });
    const b3 = e3.at + HR;
    const o3a = O(p3, e3, 'J0205', { at: b3, freq: 'BID', days: 5 });
    const o3b = O(p3, e3, 'D0117', { at: b3, freq: 'QD', days: 7 });
    const o3c = O(p3, e3, 'D0103', { at: b3, freq: 'QD', days: 7 });
    O(p3, e3, 'N5004', { at: b3 }); O(p3, e3, 'N5013', { at: b3 }); O(p3, e3, 'N5015', { at: b3 }); O(p3, e3, 'N5007', { at: b3 }); O(p3, e3, 'N5001', { at: b3 });
    O(p3, e3, 'F6005', { at: b3 });
    O(p3, e3, 'L1002', { at: now - DAY, vals: { K: 5.4, Na: 132 } }); O(p3, e3, 'L1003', { at: now - DAY, vals: { Cr: 2.1, BUN: 44 } }); O(p3, e3, 'L1013', { at: b3, vals: { BNP: 1850 } });
    O(p3, e3, 'R3002', { at: b3 });
    O(p3, e3, 'L1002', { at: now - 40 * 60000, status: '전송' }); O(p3, e3, 'L1003', { at: now - 40 * 60000, status: '전송' });
    [o3a, o3b, o3c].forEach((o) => pastMar(p3, o));
    vitals(p3, e3, e3.at, (i) => ({ sbp: jit(148, 8), dbp: jit(86, 5), hr: jit(96, 5), rr: jit(22, 2), bt: jit(36.7, 0.2, 1), spo2: jit(93, 1), pain: 1 }));
    for (let d = T.startOfDay(e3.at) + DAY; d < now; d += 8 * HR) {
      if (d > now - 2 * HR) break;
      db.io.push({ id: uid('io'), patientId: p3.id, at: d, kind: 'in', type: '먹은 물·음식', amount: 300 + Math.round(Math.random() * 150), by: '이전 근무 간호사' });
      db.io.push({ id: uid('io'), patientId: p3.id, at: d, kind: 'in', type: '정맥 수액·주사', amount: 50, by: '이전 근무 간호사' });
      db.io.push({ id: uid('io'), patientId: p3.id, at: d + 10 * 60000, kind: 'out', type: '소변', amount: 450 + Math.round(Math.random() * 250), by: '이전 근무 간호사' });
    }
    db.assess.push({ id: uid('as'), patientId: p3.id, kind: 'morse', score: 45, level: '고위험', at: e3.at + 3 * HR, by: '이전 근무 간호사', answers: {} });
    db.assess.push({ id: uid('as'), patientId: p3.id, kind: 'braden', score: 13, level: '중등도 위험', at: e3.at + 3 * HR, by: '이전 근무 간호사', answers: {} });
    db.comms.push({ id: uid('cm'), patientId: p3.id, at: now - DAY + HR, from: '이전 근무 간호사', to: '오세린 (순환기내과)', S: '윤대한 님 칼륨 5.4 (높음) 보고드립니다.', B: '심부전·만성콩팥병으로 이뇨제와 스피로노락톤 복용 중.', A: '심전도 변화는 없음. 증상 없음.', R: '스피로노락톤 계속 투여할지 확인 부탁드립니다.', urgent: false, status: '처방함', reply: '오늘은 유지, 내일 아침 전해질 다시 확인. 6.0 이상이면 바로 알려 주세요.', replyAt: now - DAY + 2 * HR, replyBy: '오세린 (의사)' });
    db.nnotes.push({ id: uid('nn'), patientId: p3.id, encId: e3.id, at: now - 12 * HR, by: '이전 근무 간호사', format: 'NANDA', dx: '체액 과다', goal: '부종 감소, 체중 증가 없음', iv: ['섭취·배설량 측정', '매일 체중 측정', '수분 제한 교육'], eval: '24시간 섭취 1,050mL / 배설 1,640mL. 다리 부종 2+ → 1+로 감소.' });

    // ───────── 4. 강미래: 급성 신우신염, 방금 입원 (7A) — 초기 간호사정·처방 확인 실습용 ─────────
    const p4 = P({ name: '강미래', sex: 'F', birth: '1997-06-15', blood: 'AB+', height: 162, weight: 53, phone: '010-8812-03xx', address: '서울시 가상구 푸른숲길 101', ins: '건강보험', guardian: '어머니 박선희 010-2234-55xx',
      hx: '특이 과거력 없음',
      scenario: { labs: { WBC: 14.1, CRP: 8.2, UWBC: '많음 (3+)', UNit: '양성', URBC: '약간 (1+)', UPro: '약간 (1+)', UCx: '대장균 (E. coli) 10⁵ 이상 — 세프트리악손 감수성', PCT: 0.9 } } });
    const e4 = E({ patientId: p4.id, type: 'IPD', dept: '내과', doctorId: 'dr1', status: '입원중', at: now - 100 * 60000, ward: '7A', room: '703', bed: '1', diet: '일반식', cc: '이틀 전부터 열, 오른쪽 옆구리 통증, 소변 볼 때 따가움', dx: [{ code: 'N10', name: '급성 신우신염', main: true }] });
    const b4 = now - 50 * 60000;
    ['J0201', 'J0215', 'D0101'].forEach((c) => O(p4, e4, c, { at: b4, status: '전송', ack: false, freq: c === 'D0101' ? 'PRN' : c === 'J0215' ? 'CONT' : 'QD', dose: c === 'J0201' ? 2 : undefined, days: 5, note: c === 'D0101' ? '체온 38℃ 이상' : c === 'J0215' ? '시간당 100mL' : '' }));
    ['L1001', 'L1007', 'L1019', 'L1021', 'L1020', 'L1003'].forEach((c) => O(p4, e4, c, { at: b4, status: '전송', ack: false }));
    O(p4, e4, 'N5001', { at: b4, status: '전송', ack: false }); O(p4, e4, 'F6001', { at: b4, status: '전송', ack: false });
    db.vitals.push({ id: uid('vs'), patientId: p4.id, encId: e4.id, at: e4.at + 10 * 60000, by: '응급실 간호사', sbp: 112, dbp: 70, hr: 108, rr: 20, bt: 38.8, spo2: 98, pain: 6 });

    // ───────── 5. 조성실: 대장암 수술 후 3일, 빈혈 → 수혈 (8B), 산정특례 ─────────
    const p5 = P({ name: '조성실', sex: 'M', birth: '1962-11-30', blood: 'A+', height: 175, weight: 66, phone: '010-6671-28xx', address: '인천시 가상구 바다로 5', ins: '건강보험', special: { code: 'V193', name: '암 산정특례 (본인부담 5%)' }, guardian: '배우자 김말순 010-1234-98xx',
      hx: '구불결장암 진단 (2주 전), 3일 전 복강경 구불결장 절제술',
      scenario: { labs: { Hb: 8.1, Hct: 24.5, WBC: 9.8, Alb: 3.0 } } });
    const e5 = E({ patientId: p5.id, type: 'IPD', dept: '외과', doctorId: 'dr3', status: '입원중', at: now - 5 * DAY, ward: '8B', room: '801', bed: '1', diet: '미음 (유동식)', cc: '대장암 수술 위해 입원', dx: [{ code: 'C18.7', name: '구불결장의 악성 신생물', main: true }, { code: 'D64.9', name: '빈혈, 상세불명' }] });
    const b5 = now - 3 * DAY + 6 * HR;
    const o5a = O(p5, e5, 'J0217', { at: b5, freq: 'CONT', days: 4, note: '시간당 80mL' });
    const o5b = O(p5, e5, 'J0210', { at: b5, freq: 'QD', days: 7 });
    O(p5, e5, 'J0207', { at: b5, freq: 'PRN', note: '통증 7점 이상' });
    O(p5, e5, 'N5011', { at: b5 }); O(p5, e5, 'N5001', { at: b5 }); O(p5, e5, 'N5006', { at: b5 }); O(p5, e5, 'F6003', { at: b5 });
    O(p5, e5, 'L1001', { at: now - 8 * HR, vals: { Hb: 8.1, Hct: 24.5 } }); O(p5, e5, 'L1004', { at: now - 8 * HR, vals: { Alb: 3.0 } });
    O(p5, e5, 'L1023', { at: now - 4 * DAY, vals: { ABO: 'A', Rh: '양성(+)' } });
    O(p5, e5, 'B8001', { at: now - 2 * HR, status: '전송', ack: false, note: '2단위, 1단위씩 3시간에 걸쳐 주입' });
    [o5a, o5b].forEach((o) => pastMar(p5, o));
    vitals(p5, e5, b5, (i) => ({ sbp: jit(112, 6), dbp: jit(68, 5), hr: jit(98, 4), rr: jit(18, 1), bt: jit(37.2, 0.2, 1), spo2: jit(97, 1), pain: Math.max(2, 6 - Math.floor(i / 3)) }));
    db.assess.push({ id: uid('as'), patientId: p5.id, kind: 'morse', score: 45, level: '고위험', at: b5, by: '이전 근무 간호사', answers: {} });
    db.assess.push({ id: uid('as'), patientId: p5.id, kind: 'braden', score: 14, level: '중등도 위험', at: b5, by: '이전 근무 간호사', answers: {} });
    db.nnotes.push({ id: uid('nn'), patientId: p5.id, encId: e5.id, at: now - 7 * HR, by: '이전 근무 간호사', format: '서술', text: '수술 부위 드레싱 깨끗함, 삼출물 없음. 어지러움 호소, 혈색소 8.1로 의사에게 알림 → 농축적혈구 2단위 처방 받음. 수혈 동의서 받음.' });

    // ───────── 외래 환자 (진료 대기) ─────────
    const p6 = P({ name: '이영희', sex: 'F', birth: '1981-03-08', blood: 'O+', height: 160, weight: 68, phone: '010-5123-77xx', address: '서울시 가상구 해오름로 9', ins: '건강보험', hx: '특이 과거력 없음. 어머니 고혈압.', scenario: { labs: { TC: 246, LDL: 168, TG: 182, Glu: 104 } } });
    const p7 = P({ name: '박민수', sex: 'M', birth: '1993-07-22', blood: 'A+', height: 178, weight: 74, phone: '010-9981-42xx', address: '경기도 가상시 별빛로 21', ins: '건강보험', allergies: [{ cls: 'nsaid', name: '소염진통제 (이부프로펜)', reaction: '숨참 (2020년)' }], hx: '없음' });
    const p8 = P({ name: '서하늘', sex: 'F', birth: '1974-12-01', blood: 'B+', height: 158, weight: 55, phone: '010-4471-61xx', address: '서울시 가상구 은하수길 4', ins: '건강보험', hx: '이모 유방암',
      scenario: { rad: { mammo: { f: '왼쪽 유방 위쪽 바깥 부위에 1.8cm 크기의 침상(가시 모양) 경계를 가진 고음영 종괴. 미세석회화 동반.', i: 'BI-RADS 4C (악성 가능성 높음) — 조직검사 권고', lesion: { x: 210, y: 140 } }, usbreast: { f: '왼쪽 유방 2시 방향, 유두에서 4cm 거리에 1.9×1.6cm 크기의 불규칙한 저에코 종괴, 후방 음영 동반.', i: 'BI-RADS 4C — 초음파 유도 조직검사 권고', lesion: { x: 200, y: 170 } } },
        path: { gross: '초음파 유도 중심부 바늘 생검으로 얻은 회백색 원통형 조직 4조각 (각 1.2~1.6cm). 모두 포매함.', micro: '불규칙한 관 구조와 세포 덩어리로 기질을 파고드는 이형성 상피세포. 핵 다형성 중등도, 유사분열 증가.', dx: '왼쪽 유방, 바늘 생검: 침윤성 유관암 (Invasive ductal carcinoma), 조직학적 등급 2', add: '호르몬 수용체·HER2 면역조직화학 염색 진행 예정' } } });
    const p12 = P({ name: '임소망', sex: 'F', birth: '1988-02-02', blood: 'O-', height: 165, weight: 57, phone: '010-3328-11xx', address: '서울시 가상구 소망로 88', ins: '건강보험', hx: '없음' });
    const opdAt = now - 25 * 60000;
    E({ patientId: p6.id, type: 'OPD', dept: '내과', doctorId: 'dr1', status: '대기', at: opdAt, qno: 1, cc: '두통, 집에서 잰 혈압 160/100 (2주간)', dx: [] });
    E({ patientId: p7.id, type: 'OPD', dept: '내과', doctorId: 'dr1', status: '대기', at: opdAt + 6 * 60000, qno: 2, cc: '속쓰림, 신물 올라옴 (3주)', dx: [] });
    E({ patientId: p8.id, type: 'OPD', dept: '유방외과', doctorId: 'dr6', status: '대기', at: opdAt + 9 * 60000, qno: 1, cc: '왼쪽 유방에 만져지는 멍울 (1개월)', dx: [] });
    db.vitals.push({ id: uid('vs'), patientId: p6.id, at: opdAt + 2 * 60000, by: '외래 간호사', sbp: 162, dbp: 102, hr: 84, rr: 16, bt: 36.6, spo2: 98, pain: 3 });

    // ───────── 응급실 환자 ─────────
    const p9 = P({ name: '정순자', sex: 'F', birth: '1945-05-05', blood: 'A-', height: 150, weight: 49, phone: '010-2219-03xx', address: '서울시 가상구 들꽃길 2', ins: '건강보험', guardian: '며느리 최유리 010-4561-78xx',
      allergies: [{ cls: 'contrast', name: '조영제', reaction: '구토, 두드러기 (2022년 CT 검사 때)' }], hx: '고혈압, 고지혈증',
      scenario: { labs: { TnI: 2.35, CKMB: 18.5, Glu: 168, K: 3.9 }, rad: { cxr: { f: '심장 크기 경계선. 폐야 깨끗함.', i: '급성 흉부 이상 없음', lesion: null } } } });
    const e9 = E({ patientId: p9.id, type: 'ER', dept: '응급의학과', doctorId: 'dr5', status: '진료중', at: now - 35 * 60000, ward: 'ER', room: 'A구역', bed: '2', ktas: 2, arrival: '119 구급차', cc: '1시간 전부터 가슴을 쥐어짜는 통증, 왼쪽 팔로 퍼짐, 식은땀', dx: [{ code: 'R07.4', name: '흉통, 상세불명', main: true }] });
    db.vitals.push({ id: uid('vs'), patientId: p9.id, encId: e9.id, at: e9.at + 3 * 60000, by: '응급실 분류 간호사', sbp: 158, dbp: 94, hr: 102, rr: 22, bt: 36.5, spo2: 95, pain: 8 });
    const p10 = P({ name: '최준호', sex: 'M', birth: '1959-02-14', blood: 'O+', height: 170, weight: 70, phone: '010-7712-59xx', address: '경기도 가상시 가람로 77', ins: '건강보험', guardian: '배우자 한경자 010-3349-21xx', hx: '고혈압, 심방세동 (약 끊음)',
      scenario: { labs: { Glu: 132, INR: 1.1 }, rad: { ctbrain: { f: '두개 내 출혈 없음. 왼쪽 중대뇌동맥 영역에 초기 허혈 변화(회백질 경계 소실) 의심.', i: '급성 출혈 없음 — 혈전용해제 금기 소견 없음. 왼쪽 중대뇌동맥 경색 의심', lesion: { x: 255, y: 175, rx: 38, ry: 30, dark: true }, side: '영상의 오른쪽 = 환자의 왼쪽' }, mribrain: { f: '왼쪽 중대뇌동맥 영역(기저핵·방사관)에 확산 제한 병변.', i: '급성 뇌경색 (왼쪽 중대뇌동맥)', lesion: { x: 250, y: 180, rx: 30, ry: 24 } } } } });
    const e10 = E({ patientId: p10.id, type: 'ER', dept: '응급의학과', doctorId: 'dr5', status: '진료중', at: now - 22 * 60000, ward: 'ER', room: '소생실', bed: '1', ktas: 2, arrival: '119 구급차', lkw: now - 75 * 60000, cc: '오른쪽 팔다리 힘 빠짐, 말이 어눌함 (마지막 정상 시각 75분 전)', dx: [{ code: 'I63.9', name: '뇌경색증, 상세불명', main: true }] });
    db.vitals.push({ id: uid('vs'), patientId: p10.id, encId: e10.id, at: e10.at + 2 * 60000, by: '응급실 분류 간호사', sbp: 176, dbp: 98, hr: 112, rr: 18, bt: 36.8, spo2: 96, pain: 0, gcs: 13 });
    const p11 = P({ name: '오가람', sex: 'M', birth: '2001-10-10', blood: 'B+', height: 181, weight: 76, phone: '010-6634-08xx', address: '서울시 가상구 바람길 40', ins: '산재보험', hx: '없음 (공사 현장에서 일하다 다침)',
      scenario: { rad: { bone: { f: '오른쪽 발목 바깥쪽 연부조직 부종. 골절 소견 없음.', i: '골절 없음 — 발목 염좌 의심', lesion: { x: 240, y: 290 } } } } });
    const e11 = E({ patientId: p11.id, type: 'ER', dept: '응급의학과', doctorId: 'dr5', status: '대기', at: now - 15 * 60000, ward: 'ER', room: 'B구역', bed: '4', ktas: 4, arrival: '걸어서', cc: '작업 중 계단에서 오른쪽 발목 접질림, 붓고 아픔', dx: [] });
    db.vitals.push({ id: uid('vs'), patientId: p11.id, encId: e11.id, at: e11.at + 4 * 60000, by: '응급실 분류 간호사', sbp: 124, dbp: 76, hr: 82, rr: 16, bt: 36.6, spo2: 99, pain: 6 });

    // ───────── 이전 근무조 인계 (지금 근무 시작 직전) ─────────
    const hoAt = shiftStart - 15 * 60000;
    const ho = (p, s, b, a, r) => db.handoffs.push({ id: uid('ho'), patientId: p.id, ward: H.activeEncSeed(db, p.id).ward, at: hoAt, fromShift: prevShift, by: '김은하 (이전 근무 간호사)', S: s, B: b, A: a, R: r, status: '인계', ackBy: null });
    H.activeEncSeed = (d, pid) => d.encounters.find((e) => e.patientId === pid);
    ho(p1, '701-1 홍길순 (여/73) 우하엽 폐렴·당뇨로 입원 3일째.', '페니실린 알레르기 (두드러기) — 세프트리악손 투여 중, 교차반응 증상 없음. 당뇨식, 인슐린 슬라이딩 스케일.', '밤사이 최고 체온 37.9℃. 기침으로 수면 부족. 혈당 228 (자기 전, 인슐린 4단위 투여). 낙상 고위험 55점.', '오늘 아침 CBC·CRP 채혈 대기 중 — 확인해 주세요. 화장실 갈 때 꼭 동행.');
    ho(p2, '805-2 김철수 (남/58) 급성 담낭염, 금식 중.', '복강경 담낭절제술 예정 (일정 확인 중). 흡연력 20갑년.', '오른쪽 윗배 통증 4~5점, 모르핀 2mg 1회 투여함 (새벽 3시경). 소변량 충분.', '금식 유지, 수술 전 교육 필요. 통증 재사정.');
    ho(p3, '705-1 윤대한 (남/76) 심부전·만성콩팥병, DNR 동의서 있음.', '이뇨제·스피로노락톤 복용, 하루 수분 1,000mL 제한, 의료급여 1종.', '어제 칼륨 5.4 → 주치의 보고함, 오늘 아침 재검 (채혈 대기). 산소 2L로 포화도 93%. 다리 부종 1+.', '아침 체중 측정, 섭취·배설량 정확히. 칼륨 6.0 이상이면 즉시 주치의 보고!');
    ho(p5, '801-1 조성실 (남/63) 구불결장암 수술 후 3일째.', '암 산정특례. 혈색소 8.1로 농축적혈구 2단위 처방 (수혈 동의서 받음).', '어지러움 호소, 수술 부위 깨끗함. 낙상 고위험 45점. 미음 시작.', '혈액은행 출고되면 수혈 시작 — 처음 15분 이상반응 관찰. 드레싱 하루 1번.');

    // 첫 알림
    const nt = (to, text, pid, level) => db.notifs.push({ id: uid('nt'), to, text, patientId: pid, level: level || '', read: false, at: now - 30 * 60000 });
    nt('ward:7A', '강미래 새 입원 (703-1) — 처방 확인과 입원 초기 간호사정이 필요합니다', p4.id, '');
    nt('ward:8B', '조성실 수혈 처방 (농축적혈구 2단위) — 처방 확인 필요', p5.id, '');
    nt('ward:ER', '정순자 KTAS 2 흉통 — 10분 안에 심전도', p9.id, 'stat');
    nt('ward:ER', '최준호 KTAS 2 뇌졸중 의심 — 뇌졸중 알림 발령', p10.id, 'stat');
    nt('phlebo', '오늘 아침 병동 채혈 대기 (7A)', p1.id, '');
    nt('pharmacy', '강미래 새 입원 처방', p4.id, '');
    nt('lab', '조성실 수혈 처방 — 교차시험 필요', p5.id, '');
    return db;
  }

  H.seed = { build };
})();
