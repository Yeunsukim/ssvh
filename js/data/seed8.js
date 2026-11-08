// 추가 실습 자료: 의료정보팀·진료협력센터 (모두 가상)
(function () {
  const H = window.H;
  const HR = 3600000, DAY = 86400000;

  function phase8(db) {
    const now = Date.now(); const T = H.t; const uid = (p) => H.uid(p);
    const find = (n) => db.patients.find((p) => p.name === n);
    // ── 진료협력 월별 통계 (지난 59개월, 가상) ──
    const DEPTS = ['정형외과', '소화기내과', '순환기내과', '내과', '신경과', '비뇨의학과', '소아청소년과', '산부인과', '유방외과', '신장내과', '혈액종양내과'];
    let s = 23; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const d0 = new Date(); d0.setDate(1);
    for (let i = 59; i >= 0; i--) {
      const x = new Date(d0.getFullYear(), d0.getMonth() - i, 1); const ym = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
      const trend = 1 + (59 - i) * 0.012; const season = 1 + 0.12 * Math.sin((x.getMonth() / 12) * Math.PI * 2);
      const part = i === 0 ? Math.max(0.05, (new Date().getDate() - 1) / 30) : 1; const req = Math.round(1900 * trend * season * (0.9 + rnd() * 0.2) * part); const reply = Math.round(req * (0.38 + rnd() * 0.12)); const back = Math.round(260 * trend * (0.8 + rnd() * 0.4) * part);
      const depts = {}; let left = req; DEPTS.forEach((d, k) => { const v = k === DEPTS.length - 1 ? left : Math.round(req * [0.095, 0.08, 0.06, 0.07, 0.05, 0.045, 0.06, 0.04, 0.03, 0.025, 0.02][k] * (0.85 + rnd() * 0.3)); depts[d] = Math.max(0, Math.min(v, left)); left -= depts[d]; }); depts['기타'] = Math.max(0, left);
      db.recs.push({ id: uid('rc'), kind: 'refmon', patientId: null, at: x.getTime(), by: '통계', ym, req, reply, back, reqOpd: Math.round(req * 0.765), reqIpd: req - Math.round(req * 0.765), inOpd: Math.round(reply * 0.712), inIpd: reply - Math.round(reply * 0.712), backOpd: Math.round(back * 0.69), backIpd: back - Math.round(back * 0.69), first: Math.round(req * 0.49), fresh: Math.round(req * 0.25), re: req - Math.round(req * 0.49) - Math.round(req * 0.25), depts });
    }
    // ── 의뢰 받아 진료를 마친 환자 → 회신서 작성 대상 ──
    const sy = find('심윤재'); if (sy) { sy.refConsent = { status: '동의', at: now - 2 * HR, by: '외래 접수' }; db.refs.push({ id: uid('rf'), dir: 'in', from: '가상내과의원 (김가상 원장)', dept: '순환기내과', pid: sy.id, pname: sy.name, page: H.age(sy.birth), psex: sy.sex, reason: '빨리 걸을 때 가슴 조임 2개월, 고혈압 조절 중 — 협심증 평가 부탁드립니다', urgency: '1주 안', status: '예약 완료', appt: `${T.d(now)} 순환기내과 오세린`, at: now - 3 * DAY }); }
    const yj = find('윤서진'); if (yj) db.refs.push({ id: uid('rf'), dir: 'in', from: '가상가정의학과의원', dept: '신경과', pid: yj.id, pname: yj.name, page: H.age(yj.birth), psex: yj.sex, reason: '처음 생긴 전신 경련 1회 — 뇌파·MRI 평가 의뢰', urgency: '일반', status: '예약 완료', appt: `${T.d(now)} 신경과 배수아`, at: now - 20 * DAY });
    const bs = find('배성호'); if (bs) db.refs.push({ id: uid('rf'), dir: 'out', pid: bs.id, pname: bs.name, dept: '내과', reason: 'COPD 급성 악화 치료 후 안정 — 흡입제 유지·금연 관리 부탁드립니다', status: '회송서 작성 대기', at: now - 2 * HR });
    // ── 의료정보: 퇴원 환자 하나는 퇴원분석(I)까지 끝낸 상태 ──
    const dis = db.encounters.filter((e) => e.type === 'IPD' && e.status === '퇴원');
    if (dis[0]) dis[0].mi = { dc1Done: true, dc1By: '이전 근무자 (의무기록사)', dc1At: now - DAY, dc1: { route: '외래', visit: '직접 내원', result: '경쾌', form: '퇴원지시 후 퇴원', dest: '자택', ds: ['수술'] } };
    db.notifs.push({ id: uid('nt'), to: 'mrd', text: `퇴원 환자 ${dis.length}명 — 퇴원분석(I) → 진료분석(코딩) → 미비등록 순서로 처리하세요`, patientId: null, level: '', read: false, at: now - 5 * 60000 });
    db.notifs.push({ id: uid('nt'), to: 'ref', text: '회신서 작성 대상 2명 (심윤재·윤서진) — 의뢰 기관에 회신하세요. 배성호 회송서 작성 대기', patientId: null, level: '', read: false, at: now - 5 * 60000 });
  }
  H.seed.phase8 = phase8;
})();
