// 4단계 실습 자료: 가정간호·재활·방사선종양·장기이식·검진·중앙공급·재고·진료협력·예약·질향상·간호행정 (모두 가상)
(function () {
  const H = window.H;
  const HR = 3600000, DAY = 86400000, MIN = 60000;

  function phase4(db) {
    const now = Date.now(); const T = H.t;
    const uid = (p) => H.uid(p);
    const P = (o) => { db.seq.mrn += 7; o.id = uid('pt'); o.mrn = String(db.seq.mrn).padStart(8, '0'); o.allergies = o.allergies || []; o.flags = o.flags || {}; o.scenario = o.scenario || {}; db.patients.push(o); return o; };
    const E = (o) => { o.id = uid('en'); db.encounters.push(o); return o; };
    const R = (kind, p, at, data, by) => db.recs.push(Object.assign({ id: uid('rc'), kind, patientId: p ? p.id : null, at, by: by || '담당 간호사' }, data));
    const find = (n) => db.patients.find((p) => p.name === n);
    const encOf = (p) => db.encounters.find((e) => e.patientId === p.id && ['입원중', '대기', '진료중'].includes(e.status));
    const O = (p, e, code, o = {}) => {
      const it = H.M.item(code); const at = o.at || now - 40 * MIN;
      db.orders.push({ id: uid('or'), encId: e.id, patientId: p.id, encType: e.type, cat: it.cat, code, name: it.name, freq: 'ONCE', days: 1, prn: false, stat: !!o.stat, outside: false, otype: '추가', note: o.note || '', status: '전송', at, by: `${H.M.doctor(e.doctorId).name} (의사)`, doctorId: e.doctorId, nurseAck: true, ward: e.type === 'ER' ? 'ER' : e.ward, hist: [{ s: '전송', at, by: '의사' }] });
    };

    // ── 가정간호 ──
    const h1 = P({ name: '박복례', sex: 'F', birth: '1942-02-17', blood: 'A+', height: 148, weight: 41, ins: '건강보험', phone: '010-2211-90xx', address: '서울시 가상구 골목길 23-4 (2층)', guardian: '며느리 김선영 010-5512-33xx', hx: '뇌경색 후유증으로 누워 지냄 (3년), 천골부 욕창 3단계, 유치도뇨관·콧줄 영양',
      home: { dr: '한지훈', since: '2025-06', next: T.d(now), orders: ['욕창 드레싱 주 2회', '유치도뇨관 4주마다 교체', '비위관 4주마다 교체', '보호자 체위 변경·영양 교육'], seq: 1 } });
    const h2 = P({ name: '정만수', sex: 'M', birth: '1949-07-30', blood: 'O+', height: 166, weight: 59, ins: '의료급여 1종', phone: '010-8833-12xx', address: '서울시 가상구 언덕로 7 (주택)', guardian: '아내 송말자 010-4421-77xx', hx: '만성폐쇄성폐질환 — 집에서 산소 2L, 2형 당뇨 (인슐린)',
      home: { dr: '한지훈', since: '2026-01', next: T.d(now), orders: ['재택 산소 관리 교육', '혈당·인슐린 자가 주사 점검', '호흡 재활 교육'], seq: 2 } });
    R('hcvisit', h1, now - 4 * DAY, { vs: '120/70-82-18-36.8', wound: '천골부 욕창 3단계 4×3cm, 깊이 1cm, 삼출물 중간', care: ['욕창 드레싱 (폼 드레싱)', '체위 변경 교육'], memo: '드레싱 깨끗함, 크기 변화 없음' }, '가정간호사');

    // ── 재활 ──
    const r1 = P({ name: '하동민', sex: 'M', birth: '1958-04-02', blood: 'B+', height: 169, weight: 70, ins: '건강보험', phone: '010-6634-21xx', address: '서울시 가상구 바람길 2', guardian: '아들 하준혁 010-2201-56xx', hx: '2주 전 왼쪽 뇌경색 → 오른쪽 편마비, 말 어눌함', rehab: true });
    const re1 = E({ patientId: r1.id, type: 'IPD', dept: '재활의학과', doctorId: 'dr1', status: '입원중', at: now - 14 * DAY, ward: '7A', room: '704', bed: '1', diet: '연식', cc: '뇌경색 후 재활', dx: [{ code: 'I63.9', name: '뇌경색증, 상세불명', main: true }] });
    db.vitals.push({ id: uid('vs'), patientId: r1.id, encId: re1.id, at: now - 3 * HR, by: '병동 간호사', sbp: 134, dbp: 82, hr: 76, rr: 16, bt: 36.6, spo2: 97, pain: 2 });
    db.assess.push({ id: uid('as'), patientId: r1.id, kind: 'morse', score: 65, level: '고위험', at: now - DAY, by: '병동 간호사', answers: {} });
    R('rehab', r1, now - 3 * DAY, { type: '평가', mmt: { ra: 2, la: 5, rl: 3, ll: 5 }, berg: 22, mbi: 38, memo: '오른쪽 팔 근력 2, 다리 3. 앉은 균형 가능, 선 균형 불안' }, '물리치료사');

    // ── 방사선종양 ──
    const t1 = P({ name: '안정희', sex: 'F', birth: '1968-09-14', blood: 'A+', height: 160, weight: 58, ins: '건강보험', special: { code: 'V193', name: '암 산정특례 (본인부담 5%)' }, phone: '010-3378-44xx', address: '서울시 가상구 강가길 15', hx: '왼쪽 유방암 — 6주 전 유방 부분절제술', rt: { site: '왼쪽 유방 전체 + 종양 자리 추가', total: 50, fx: 25, dose: 2, start: T.d(now - 17 * DAY), done: 12 } });
    for (let i = 1; i <= 12; i++) R('rt', t1, now - (17 - Math.floor(i * 1.4)) * DAY, { fx: i, dose: 2, cum: i * 2, skin: i < 8 ? 0 : 1, fatigue: i < 10 ? '없음' : '약간' }, '방사선사');

    // ── 장기이식 ──
    const dj = find('최정민'); if (dj) dj.tx = { organ: '신장', since: '2023-05', abo: 'AB+', hla: 'A2 A24 B7 B61 DR4 DR15', pra: 12, status: '대기 중' };
    const t2 = P({ name: '윤상철', sex: 'M', birth: '1971-12-08', blood: 'A+', height: 172, weight: 64, ins: '건강보험', phone: '010-7710-03xx', address: '경기도 가상시 호수로 8', hx: 'B형간염에 의한 간경변, 복수', tx: { organ: '간', since: '2025-11', abo: 'A+', meld: 24, status: '대기 중' } });
    const bd = P({ name: '이도현', sex: 'M', birth: '1992-03-21', blood: 'A+', height: 178, weight: 74, ins: '자동차보험', phone: '-', address: '서울시 가상구', guardian: '어머니 박정숙 010-3321-88xx', hx: '이틀 전 오토바이 사고 — 중증 외상성 뇌손상, 인공호흡기', donor: { step: 0 }, flags: {} });
    const bde = E({ patientId: bd.id, type: 'IPD', dept: '신경외과', doctorId: 'dr9', status: '입원중', at: now - 2 * DAY, ward: 'ICU', room: '외과계', bed: '2', diet: '금식 (NPO)', cc: '교통사고 후 의식 없음', dx: [{ code: 'S06.2', name: '광범위 뇌손상', main: true }] });
    db.vitals.push({ id: uid('vs'), patientId: bd.id, encId: bde.id, at: now - HR, by: '중환자실 간호사', sbp: 102, dbp: 60, hr: 118, rr: 14, bt: 35.9, spo2: 97, pain: 0, avpu: 'U', gcs: 3, o2: true });

    // ── 감염관리 ──
    const hs = find('한상우'); if (hs) { hs.flags.isolation = '접촉 격리 (MRSA)'; hs.scenario.labs = Object.assign(hs.scenario.labs || {}, { SCx: '메티실린 내성 황색포도알균 (MRSA)', SGram: '그람 양성 알균' }); }
    R('ic', null, now - 6 * HR, { type: '손위생', ward: 'ICU', moments: ['환자 접촉 전', '무균 처치 전', '체액 노출 후', '환자 접촉 후', '환자 주변 접촉 후'], done: [1, 1, 1, 1, 0], obs: '간호사 A' }, '감염관리 간호사');

    // ── 기능검사 처방 대기 ──
    const js = find('정순자'); if (js) { const e = encOf(js); if (e) O(js, e, 'C7001', { stat: true, note: '흉통 — 10분 안에' }); }
    const yd = find('윤대한'); if (yd) { const e = encOf(yd); if (e) O(yd, e, 'C7010', { note: '심부전 — 박출률 확인' }); }
    const jh = find('최준호'); if (jh) { const e = encOf(jh); if (e) O(jh, e, 'C7001', { stat: true, note: '뇌졸중 — 심방세동 확인' }); }

    // ── 종합검진 ──
    [['김민준', 'M', '1981-05-11', { ht: 175, wt: 83, sbp: 142, dbp: 92, glu: 118, tc: 238, ast: 52, alt: 68, hb: 15.1 }, '기본 + 위내시경 + 복부초음파'],
     ['이서연', 'F', '1988-12-30', { ht: 162, wt: 54, sbp: 112, dbp: 70, glu: 88, tc: 172, ast: 21, alt: 18, hb: 13.2 }, '기본 + 자궁경부 세포검사'],
     ['박정호', 'M', '1965-08-19', { ht: 168, wt: 72, sbp: 136, dbp: 84, glu: 156, tc: 205, ast: 30, alt: 28, hb: 14.0 }, '기본 + 위내시경 + 대장내시경']].forEach(([name, sex, birth, v, pkg], i) => {
      P({ name, sex, birth, blood: 'O+', height: v.ht, weight: v.wt, ins: '건강보험', phone: '010-0000-00xx', address: '서울시 가상구', hx: '검진 수검자', chk: { date: T.d(now), pkg, seq: i + 1, values: v, status: '예약' } });
    });

    // ── 중앙공급실 기구 세트 ──
    [['복강경 기본 세트', 'SET-LAP-01', '사용 후 회수', '수술실 2번방'], ['복강경 기본 세트', 'SET-LAP-02', '멸균 완료', '중앙공급실 보관'], ['복강경 기본 세트', 'SET-LAP-03', '세척', '중앙공급실'],
     ['개복 수술 세트', 'SET-OPN-01', '멸균 완료', '중앙공급실 보관'], ['제왕절개 세트', 'SET-CS-01', '포장', '중앙공급실'], ['드레싱 세트', 'SET-DRS-01', '멸균 완료', '7A 병동'], ['드레싱 세트', 'SET-DRS-02', '사용 후 회수', '8B 병동'], ['봉합 세트', 'SET-SUT-01', '멸균 완료', '응급실'], ['기관절개 세트', 'SET-TRC-01', '멸균 완료', '중환자실']]
      .forEach(([name, no, st, loc]) => db.items.push({ id: uid('it'), kind: 'set', name, no, status: st, loc, method: st === '멸균 완료' ? '고압증기 134℃' : '', expire: st === '멸균 완료' ? now + 25 * DAY : null, at: now - 5 * HR }));

    // ── 물품 재고 ──
    [['생리식염수 1L', '수액', '봉', 120, 200, 1500], ['하트만 용액 1L', '수액', '봉', 260, 150, 1700], ['주사기 5mL', '소모품', '개', 1800, 1000, 60], ['정맥 카테터 22G', '소모품', '개', 140, 300, 900],
     ['멸균 거즈 10×10', '소모품', '팩', 900, 500, 120], ['수술 장갑 7호', '소모품', '켤레', 220, 300, 650], ['N95 마스크', '감염 보호구', '개', 80, 200, 1300], ['일회용 가운', '감염 보호구', '벌', 340, 200, 900],
     ['유치도뇨관 세트 16Fr', '소모품', '세트', 45, 40, 5200], ['비위관 16Fr', '소모품', '개', 30, 30, 1800], ['폼 드레싱 10×10', '상처 관리', '장', 18, 50, 7800], ['혈당 측정 스트립', '검사 소모품', '통', 60, 40, 9000],
     ['손 소독제 500mL', '감염 보호구', '병', 150, 100, 4200], ['심전도 전극', '소모품', '팩', 75, 50, 3500]]
      .forEach(([name, cat, unit, qty, safe, price]) => db.items.push({ id: uid('it'), kind: 'stock', name, cat, unit, qty, safe, price, expire: name.includes('식염수') ? now + 40 * DAY : now + 400 * DAY, lot: `L${Math.floor(Math.random() * 90000) + 10000}` }));
    db.items.push({ id: uid('it'), kind: 'req', ward: '7A', item: '폼 드레싱 10×10', qty: 10, status: '청구', at: now - 2 * HR, by: '7A 병동 간호사' });
    db.items.push({ id: uid('it'), kind: 'req', ward: 'ICU', item: 'N95 마스크', qty: 40, status: '청구', at: now - HR, by: '중환자실 간호사' });

    // ── 진료협력 ──
    db.refs.push({ id: uid('rf'), dir: 'in', from: '가상내과의원 (김가상 원장)', dept: '순환기내과', pname: '송태수', page: 66, psex: 'M', reason: '운동할 때 가슴 답답함 2주, 심전도 ST 변화 — 관상동맥 질환 평가 부탁드립니다', urgency: '1주 안', status: '접수 대기', at: now - 5 * HR });
    db.refs.push({ id: uid('rf'), dir: 'in', from: '가상정형외과의원', dept: '정형외과', pname: '진말순', page: 72, psex: 'F', reason: '양쪽 무릎 관절염 진행, 인공관절 수술 상담 의뢰', urgency: '일반', status: '접수 대기', at: now - DAY });
    db.refs.push({ id: uid('rf'), dir: 'in', from: '가상요양병원', dept: '호흡기내과', pname: '구봉례', page: 88, psex: 'F', reason: '폐렴 악화, 산소포화도 88% — 응급 전원 요청', urgency: '응급 전원', status: '접수 대기', at: now - 40 * MIN });
    const ny = find('노영수'); if (ny) db.refs.push({ id: uid('rf'), dir: 'out', to: '가상외과의원 (집 근처)', dept: '외과', pid: ny.id, pname: ny.name, reason: '복강경 충수절제술 후 상처 관리·실밥 제거', status: '회송서 작성 대기', at: now - DAY });

    // ── 예약 ──
    const ls = find('임소망'); if (ls) db.appts.push({ id: uid('ap'), pid: ls.id, dept: '내과', doctorId: 'dr1', date: T.d(now), time: '14:00', status: '예약', memo: '건강검진 결과 상담 (혈당 높음)', at: now - 3 * DAY, by: '콜센터' });
    const sh = find('서하늘'); if (sh) db.appts.push({ id: uid('ap'), pid: sh.id, dept: '유방외과', doctorId: 'dr6', date: T.d(now + 7 * DAY), time: '10:30', status: '예약', memo: '조직검사 결과 설명', at: now - HR, by: '외래 간호사' });

    // ── 질 향상·환자안전 ──
    db.qi.push({ id: uid('qi'), kind: 'event', type: '낙상', grade: '근접 오류 (위해 없음)', ward: '7A', pname: '홍길순', what: '화장실 가다 미끄러질 뻔했으나 보호자가 잡아 줌', cause: ['젖은 바닥', '야간 조명 어두움'], action: '야간 조명 켜 두기, 미끄럼 방지 매트', at: now - 2 * DAY, by: '7A 간호사', status: '검토 완료' });
    db.qi.push({ id: uid('qi'), kind: 'event', type: '투약 오류', grade: '위해 없음', ward: '8B', pname: '(익명)', what: '진통제 투약 시간 1시간 늦음', cause: ['업무 과다', '알림 누락'], action: '투약 알림 확인 절차 교육', at: now - 5 * DAY, by: '8B 간호사', status: '검토 중' });

    // ── 간호 직원 ──
    ['김은하', '박서윤', '이하늘', '최지우', '정다은', '한소율', '오예린', '윤채원'].forEach((n, i) => db.staff.push({ id: uid('sf'), name: n, ward: i < 4 ? '7A' : '8B', career: [12, 7, 4, 1, 9, 5, 2, 1][i], role: i === 0 || i === 4 ? '책임 간호사' : '일반 간호사', edu: { 감염관리: i % 3 !== 0, '심폐소생술 (BLS)': i !== 3, 환자안전: true, 개인정보보호: i % 2 === 0 }, health: { 'B형간염 항체': i !== 6, 인플루엔자: i % 4 !== 1, '결핵 검진': true }, sched: {} }));
  }

  H.seed.phase4 = phase4;
})();
