// 추가 실습 자료: 고객관리실·전화예약센터·통합예약센터 (모두 가상 인물)
(function () {
  const H = window.H;
  const HR = 3600000, DAY = 86400000, MIN = 60000;

  function phase7(db) {
    const now = Date.now(); const T = H.t;
    const uid = (p) => H.uid(p);
    const find = (n) => db.patients.find((p) => p.name === n);
    const R = (kind, pid, o, at, by) => { const r = Object.assign({ id: uid('rc'), kind, patientId: pid || null, at: at || now - HR, by: by || '이전 근무자 (고객관리실)' }, o); db.recs.push(r); return r; };
    const ym = T.d(now).slice(2, 7).replace('-', '');
    let no = 0; const vno = () => `VOC-${ym}-${String(++no).padStart(3, '0')}`;
    const wd = (n) => { let t = now, k = 0; const s = n > 0 ? 1 : -1; while (k < Math.abs(n)) { t += s * DAY; const d = new Date(t).getDay(); if (d && d !== 6) k++; } return T.d(t); };

    // ── 고객의 소리 ──
    const hs = find('한상우'); const kr = find('강미래'); const jh = find('조길호'); const yj = find('윤서진');
    R('voc', hs && hs.id, { no: vno(), ch: '방문 (고객상담실)', type: '불만', area: '간호', name: '조은숙 (환자 아내)', phone: '010-8876-12xx', content: '격리실에 있는데 간호사가 장갑을 끼고 와서 다른 환자 얘기를 하며 웃었습니다. 남편이 병균 취급받는 것 같다며 속상해합니다. 격리가 왜 필요한지 제대로 설명도 못 들었습니다.', urgent: false, status: '부서 이관', dept: '7A 내과 병동', hist: [{ s: '접수', at: now - 2 * DAY, by: '고객관리실', memo: '' }, { s: '부서 이관', at: now - 2 * DAY + HR, by: '고객관리실', memo: '사실 확인·격리 설명 개선 요청' }] }, now - 2 * DAY);
    R('voc', kr && kr.id, { no: vno(), ch: '전화', type: '불만', area: '대기 시간', name: '강미래', phone: '010-8812-03xx', content: '응급실에서 열이 39도인데 4시간 넘게 기다렸고, 왜 늦는지 아무도 알려 주지 않았습니다.', urgent: false, status: '부서 답변', dept: '응급실', reply: { fact: '당일 중증 환자(심정지 2명)가 몰려 경증 환자 대기가 평균 3시간이었고, 대기 중 재평가·안내를 하지 못했습니다.', act: '대기 1시간마다 활력징후 재측정과 예상 대기 시간 안내를 하겠습니다.', by: '응급실 수간호사' }, hist: [{ s: '접수', at: now - 4 * DAY, by: '고객관리실' }, { s: '부서 이관', at: now - 4 * DAY + HR, by: '고객관리실' }, { s: '부서 답변', at: now - DAY, by: '응급실' }] }, now - 4 * DAY);
    R('voc', jh && jh.id, { no: vno(), ch: '고객의 소리 (엽서)', type: '칭찬', area: '친절·태도', name: '조은비 (환자 딸)', phone: '010-7720-11xx', content: '아버지가 피를 토해 무서웠는데 내시경실 간호사 선생님이 손을 잡아 주시고 하나하나 설명해 주셔서 마음이 놓였습니다. 감사합니다.', urgent: false, status: '접수', hist: [{ s: '접수', at: now - 3 * HR, by: '고객관리실' }] }, now - 3 * HR);
    R('voc', null, { no: vno(), ch: '홈페이지', type: '제안', area: '주차', name: '익명', phone: '', content: '외래 주차장이 오전 9시면 꽉 찹니다. 진료 예약 문자에 대중교통·주차 안내를 같이 보내 주면 좋겠습니다.', urgent: false, status: '접수', hist: [{ s: '접수', at: now - 6 * HR, by: '고객관리실' }] }, now - 6 * HR);
    R('voc', null, { no: vno(), ch: '전화', type: '불만', area: '수납·비용', name: '이영희', phone: '010-3345-90xx', content: '퇴원할 때 받은 영수증에 받지 않은 검사가 있는 것 같습니다. 설명해 주세요.', urgent: false, status: '종결', dept: '원무팀', reply: { fact: '외부 위탁 검사(비타민 D)가 포함되어 있었습니다. 처방은 맞았으나 사전 설명이 없었습니다.', act: '위탁 검사는 처방 때 비용을 안내하도록 진료과에 요청했습니다.', by: '원무팀' }, callback: { how: '전화', sat: '만족', text: '' }, hist: [{ s: '접수', at: now - 10 * DAY, by: '고객관리실' }, { s: '부서 이관', at: now - 10 * DAY + HR, by: '고객관리실' }, { s: '부서 답변', at: now - 8 * DAY, by: '원무팀' }, { s: '고객 회신', at: now - 7 * DAY, by: '고객관리실' }, { s: '종결', at: now - 7 * DAY, by: '고객관리실' }] }, now - 10 * DAY);
    R('voc', null, { no: vno(), ch: '방문 (고객상담실)', type: '불만', area: '안전 (낙상·감염 등)', name: '박선희', phone: '010-2234-55xx', content: '화장실 바닥이 젖어 있었는데 미끄럼 주의 표시가 없어 어머니가 넘어질 뻔했습니다.', urgent: true, status: '종결', dept: '시설팀', reply: { fact: '청소 직후 표지판을 세우지 않았습니다.', act: '청소 후 바닥이 마를 때까지 표지판 비치를 의무화했습니다.', by: '시설팀' }, callback: { how: '문자', sat: '만족', text: '' }, hist: [{ s: '접수', at: now - 15 * DAY, by: '고객관리실' }, { s: '종결', at: now - 14 * DAY - 6 * HR, by: '고객관리실' }] }, now - 15 * DAY);
    if (hs) hs.crm = { prefer: '보호자에게', best: '오전', sms: true, mkt: false, memo: '보호자(아내)에게 먼저 연락 — 격리 관련 불만 처리 중' };
    if (kr) kr.crm = { prefer: '문자', best: '저녁', sms: true, mkt: true, memo: '' };
    if (yj) yj.crm = { prefer: '알림톡', best: '오후', sms: true, mkt: true, memo: '대학생 — 수업 시간 피해 오후 연락' };

    // ── 직원의 소리 ──
    R('voe', null, { title: '야간 근무 후 셔틀버스가 없어요', area: '근무 환경·안전', anon: true, content: '현재: 밤 근무 마치고 아침 7시 30분에 퇴근하면 셔틀이 8시부터 있습니다.\n개선: 7시 40분 셔틀 1회 추가.\n기대 효과: 야간 근무자 피로·안전사고 감소.', status: '검토 중' }, now - 5 * DAY, '익명 직원');
    R('voe', null, { title: '퇴원 교육 자료를 큰 글씨로 만들어 주세요', area: '업무 절차·효율', anon: false, content: '어르신 환자가 많은데 퇴원 안내문 글씨가 작아 다시 설명하는 일이 많습니다. 큰 글씨·그림판을 만들면 좋겠습니다.', status: '채택', review: { result: '채택', reason: '간호부 교육위원회에서 다음 달까지 제작' } }, now - 12 * DAY, '7A 간호사 최은정');
    R('voe', null, { title: '전산 처방 화면에 알레르기 표시가 더 크게', area: '전산 (HIS)', anon: false, content: '알레르기가 작은 글씨로만 보여 놓칠 수 있습니다. 빨간 띠로 크게 표시해 주세요.', status: '접수' }, now - DAY, '응급실 간호사 한지원');

    // ── 해피콜 (최근 퇴원 환자 1명은 완료, 나머지는 대기) ──
    const dis = db.encounters.filter((e) => e.type === 'IPD' && e.status === '퇴원');
    if (dis[0]) R('happy', dis[0].patientId, { encId: dis[0].id, result: '통화 성공', health: '좋아짐', med: '잘 먹고 있음', appt: '예약 알고 있음', comment: '수술 상처가 잘 아물었고 간호사들이 친절했다고 함' }, now - DAY);

    // ── 환자경험평가 응답 (가상 14건) ──
    const DOMS = { '간호사 서비스': 4, '의사 서비스': 4, '투약 및 치료 과정': 4, '병원 환경': 2, '환자 권리 보장': 4 };
    const BIAS = { '간호사 서비스': 0.82, '의사 서비스': 0.7, '투약 및 치료 과정': 0.66, '병원 환경': 0.78, '환자 권리 보장': 0.6 };
    let s = 11; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let k = 0; k < 14; k++) { const ans = {}; Object.entries(DOMS).forEach(([d, n]) => { for (let i = 0; i < n; i++) { const r = rnd(); ans[`${d}|${i}`] = r < BIAS[d] ? 100 : r < BIAS[d] + 0.22 ? 66.7 : r < BIAS[d] + 0.3 ? 33.3 : 0; } }); R('pxe', dis[k % Math.max(1, dis.length)] ? dis[k % dis.length].patientId : null, { encId: dis[k % Math.max(1, dis.length)] ? dis[k % dis.length].id : null, ans, overall: 7 + Math.floor(rnd() * 4), recommend: 6 + Math.floor(rnd() * 5) }, now - (k + 3) * DAY, '조사 담당'); }
    R('pxplan', null, { dom: '환자 권리 보장', task: '입원 시 "불만·고충 말하는 방법" 안내문 배부와 구두 설명', owner: '간호부·고객관리실', kpi: '해당 문항 70점 → 85점' }, now - 20 * DAY);

    // ── 전화 대기열 ──
    const bs = find('배성호'); const nh = find('나현숙'); const sy = find('심윤재');
    R('callq', nh && nh.id, { phone: nh ? nh.phone : '010-9912-55xx', pid: nh && nh.id, ivr: '예약 변경·취소', status: '대기' }, now - 4 * MIN, 'ARS');
    R('callq', null, { phone: '010-4120-77xx', pid: null, ivr: '진료 예약', status: '대기' }, now - 2 * MIN, 'ARS');
    R('callq', sy && sy.id, { phone: sy ? sy.phone : '010-2245-77xx', pid: sy && sy.id, ivr: '검사 예약 문의', status: '대기' }, now - MIN, 'ARS');
    R('callq', null, { phone: '010-5531-02xx', pid: null, ivr: '진료과·의사 안내', status: '포기' }, now - 50 * MIN, 'ARS');
    R('call', null, { phone: '010-7781-11xx', type: '진료과·의사 안내', result: '무릎 통증 → 정형외과 안내', dur: 95 }, now - 90 * MIN, '예약 상담원 (오전)');

    // ── 예약: 앞으로 잡힌 것·부도 ──
    const A = (p, o) => p && db.appts.push(Object.assign({ id: uid('ap'), pid: p.id, status: '예약', at: now - 7 * DAY, by: '예약 상담원', kind: '진료', visit: '재진' }, o));
    if (nh) { A(nh, { dept: '소화기내과', doctorId: 'dr13', date: wd(3), time: '10:30', memo: '조직검사 결과 확인' }); }
    if (sy) { A(sy, { dept: '순환기내과', doctorId: 'dr2', date: wd(2), time: '09:30', memo: '운동부하·심근 관류 결과 확인' }); }
    if (bs) { A(bs, { dept: '내과', doctorId: 'dr1', date: wd(5), time: '14:00', memo: '퇴원 후 첫 외래 — 폐기능 결과', visit: '재진' }); }
    if (yj) { A(yj, { dept: '신경과', doctorId: 'dr4', date: wd(4), time: '10:00', memo: '뇌파·MRI 결과 설명' }); }
    const g1 = find('고민석'); if (g1) A(g1, { dept: '순환기내과', doctorId: 'dr2', date: wd(-2), time: '15:00', status: '부도', memo: '스텐트 시술 후 1개월 외래' });
    const lm = find('이영희') || db.patients[3]; if (lm) A(lm, { dept: '내과', doctorId: 'dr1', date: wd(-1), time: '11:00', status: '부도', memo: '혈압약 처방' });
    R('resvreq', nh && nh.id, { phone: nh ? nh.phone : '', text: '골밀도 검사와 외래 진료를 같은 날로 맞춰 달라는 요청', status: '요청', from: '홈페이지' }, now - 5 * HR, '홈페이지');

    db.notifs.push({ id: uid('nt'), to: 'appt', text: '전화 3통이 기다리고 있습니다 — 오래 기다린 전화부터 받으세요', patientId: null, level: '', read: false, at: now - MIN });
    db.notifs.push({ id: uid('nt'), to: 'cs', text: '처리 중인 고객의 소리 4건 — 응급실 답변이 와서 고객에게 회신할 차례입니다', patientId: null, level: '', read: false, at: now - 10 * MIN });
  }
  H.seed.phase7 = phase7;
})();
