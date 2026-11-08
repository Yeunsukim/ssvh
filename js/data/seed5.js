// 추가 실습 자료: 심혈관센터·내시경실·주사실 (모두 가상 인물)
(function () {
  const H = window.H;
  const HR = 3600000, DAY = 86400000, MIN = 60000;

  function phase5(db) {
    const now = Date.now(); const T = H.t;
    const uid = (p) => H.uid(p);
    const P = (o) => { db.seq.mrn += 7; o.id = uid('pt'); o.mrn = String(db.seq.mrn).padStart(8, '0'); o.allergies = o.allergies || []; o.flags = o.flags || {}; o.scenario = o.scenario || {}; db.patients.push(o); return o; };
    const E = (o) => { o.id = uid('en'); db.encounters.push(o); return o; };
    const find = (n) => db.patients.find((p) => p.name === n);
    const encOf = (p) => db.encounters.find((e) => e.patientId === p.id && ['입원중', '대기', '진료중'].includes(e.status));
    const O = (p, e, code, o = {}) => {
      const it = H.M.item(code); const at = o.at || now - 30 * MIN; const st = o.status || '전송';
      const ord = { id: uid('or'), encId: e.id, patientId: p.id, encType: e.type, cat: it.cat, code, name: it.name, dose: o.dose != null ? o.dose : it.dose, unit: it.unit, route: it.route, freq: o.freq || it.freq || 'ONCE', days: 1, prn: false, stat: !!o.stat, outside: false, otype: e.type === 'ER' ? '응급' : '추가', note: o.note || '', status: st, at,
        by: `${H.M.doctor(e.doctorId).name} (의사)`, doctorId: e.doctorId, nurseAck: true, ward: e.type === 'ER' ? 'ER' : e.ward || null, qty: 1, hist: [{ s: '전송', at, by: '의사' }] };
      if (st !== '전송') ord.hist.push({ s: st, at: at + 20 * MIN, by: '담당 부서' });
      if (st === '불출') ord.arrivedAt = at + 20 * MIN;
      if (it.cat === 'LAB' && st === '결과보고') { ord.result = { at: at + HR, by: '진단검사의학과', verified: true, items: it.items.map((x) => { const v = String(o.vals && o.vals[x.c] != null ? o.vals[x.c] : H.sim.labValue(p, x)); const j = H.flow.judge(x, v); return { c: x.c, n: x.n, u: x.u, v, flag: j.flag, dir: j.dir, ref: `${x.lo ?? ''}~${x.hi ?? ''}` }; }) }; ord.nurseSeen = true; ord.drSeen = true; }
      if (o.extra) Object.assign(ord, o.extra);
      db.orders.push(ord); return ord;
    };

    // ── 심혈관센터 ──
    const js = find('정순자');
    if (js) {
      const e = encOf(js);
      if (e) {
        O(js, e, 'V8002', { stat: true, at: now - 15 * MIN, note: '급성 전벽 ST분절 상승 심근경색 — 응급 중재술 (문에서 풍선까지 90분 목표). 조영제 알레르기 있음' });
        js.scenario.cag = { LM: 0, LAD: 100, LCX: 30, RCA: 20, culprit: 'LAD', stent: '좌전하행지 근위부 3.0×28mm 약물방출 스텐트' };
      }
    }
    const g = P({ name: '고민석', sex: 'M', birth: '1965-01-28', blood: 'O+', height: 171, weight: 76, ins: '건강보험', phone: '010-4471-23xx', address: '서울시 가상구 동쪽길 6', guardian: '아내 오미선 010-2231-88xx', hx: '고혈압·고지혈증, 계단 오를 때 가슴 조임 3개월 (운동부하검사 양성)',
      scenario: { labs: { Cr: 0.9 }, cag: { LM: 0, LAD: 80, LCX: 20, RCA: 40, culprit: 'LAD', stent: '좌전하행지 중간부 3.0×18mm 약물방출 스텐트' } } });
    const ge = E({ patientId: g.id, type: 'IPD', dept: '순환기내과', doctorId: 'dr2', status: '입원중', at: now - DAY, ward: '7A', room: '702', bed: '1', diet: '저염식 (소금 6g 이하)', cc: '운동할 때 가슴 조임 — 예정 관상동맥 조영술', dx: [{ code: 'I20.9', name: '협심증, 상세불명', main: true }, { code: 'I10', name: '본태성(원발성) 고혈압' }] });
    O(g, ge, 'V8001', { at: ge.at + HR, status: '시술확정', note: '정규 조영술, 협착 있으면 중재술 진행', extra: { cv: { date: T.d(now), time: '14:00', room: '심혈관조영실 1', doctor: '오세린', access: '오른쪽 요골동맥' } } });
    O(g, ge, 'L1003', { at: ge.at + HR, status: '결과보고', vals: { Cr: 0.9 } });
    O(g, ge, 'D0103', { at: ge.at + HR, status: '불출', freq: 'QD' }); O(g, ge, 'D0105', { at: ge.at + HR, status: '불출', freq: 'QD' });
    db.vitals.push({ id: uid('vs'), patientId: g.id, encId: ge.id, at: now - 2 * HR, by: '병동 간호사', sbp: 138, dbp: 84, hr: 72, rr: 16, bt: 36.5, spo2: 98, pain: 0 });

    // ── 내시경실 ──
    const c = P({ name: '조길호', sex: 'M', birth: '1954-06-11', blood: 'A+', height: 167, weight: 63, ins: '건강보험', phone: '010-3312-90xx', address: '서울시 가상구 시장길 14', guardian: '딸 조은비 010-7720-11xx', hx: '관절염으로 소염진통제 오래 복용, 어제부터 검은 변·어지러움',
      scenario: { labs: { Hb: 8.4, Hct: 25.1, BUN: 38 }, endo: { E8104: { find: '십이지장 구부 앞벽 1.2cm 궤양, 바닥에 노출 혈관 (출혈 위험 높음)', impr: '출혈성 십이지장 궤양 — 에피네프린 주입 + 클립 지혈', lesion: 'bleed' } } } });
    const ce = E({ patientId: c.id, type: 'IPD', dept: '소화기내과', doctorId: 'dr13', status: '입원중', at: now - 5 * HR, ward: '7A', room: '706', bed: '1', diet: '금식 (NPO)', cc: '검은 변, 어지러움', dx: [{ code: 'K92.2', name: '위장관 출혈', main: true }] });
    O(c, ce, 'E8104', { stat: true, at: now - 50 * MIN, note: '혈색소 8.4 — 6시간 안 응급 내시경' });
    O(c, ce, 'L1001', { at: ce.at + 20 * MIN, status: '결과보고', vals: { Hb: 8.4, Hct: 25.1 } }); O(c, ce, 'J0204', { at: ce.at + 20 * MIN, status: '불출', freq: 'BID' });
    db.vitals.push({ id: uid('vs'), patientId: c.id, encId: ce.id, at: now - HR, by: '병동 간호사', sbp: 102, dbp: 62, hr: 108, rr: 18, bt: 36.6, spo2: 97, pain: 2 });
    const n = P({ name: '나현숙', sex: 'F', birth: '1968-03-30', blood: 'B+', height: 158, weight: 55, ins: '건강보험', phone: '010-9912-55xx', address: '서울시 가상구 새마을로 3', hx: '명치 통증 2개월, 아스피린 복용 중 (심혈관 예방)',
      scenario: { endo: { E8101: { find: '위 각부 작은굽이에 1.5cm 궤양, 깨끗한 흰 바닥. 헬리코박터 검사(CLO) 양성', impr: '위궤양 (활동기) — 조직검사 2조각, 헬리코박터 제균 치료 필요', lesion: 'ulcer', biopsy: true } }, path: { gross: '위 생검 2조각 (각 0.3cm)', micro: '만성 활동성 위염, 궤양 가장자리, 헬리코박터균 관찰. 이형성·악성 없음', dx: '위, 생검: 만성 활동성 위염과 궤양, 헬리코박터 양성, 악성 소견 없음' } } });
    const ne = E({ patientId: n.id, type: 'OPD', dept: '소화기내과', doctorId: 'dr13', status: '진료완료', at: now - 2 * HR, qno: 1, visit: '재진', cc: '명치 통증 — 위내시경', dx: [{ code: 'K25.9', name: '위궤양', main: true }] });
    O(n, ne, 'E8101', { at: now - 90 * MIN, status: '예약확정', note: '수면 내시경, 조직검사 가능', extra: { en: { date: T.d(now), time: '11:30', room: '내시경실 2', sed: true } } });
    const pj = find('박정호');
    if (pj) {
      const pe = E({ patientId: pj.id, type: 'OPD', dept: '검진센터', doctorId: 'dr13', status: '진료완료', at: now - 3 * HR, qno: 3, visit: '초진', cc: '종합검진 내시경', dx: [{ code: 'Z00.0', name: '일반 건강 검진', main: true }] });
      pj.scenario.endo = { E8101: { find: '식도·위·십이지장 정상 점막', impr: '정상 위내시경', lesion: null }, E8102: { find: '구불결장 0.8cm 줄기 있는 용종 1개 — 올가미로 절제', impr: '대장 용종 — 절제 후 조직검사', lesion: 'polyp', biopsy: true } };
      pj.scenario.path = { gross: '용종 1개 (0.8cm)', micro: '관상 선종, 저등급 이형성, 절제 경계 깨끗함', dx: '구불결장 용종: 관상 선종 (저등급), 완전 절제' };
      O(pj, pe, 'E8101', { at: now - 2 * HR, status: '예약확정', extra: { en: { date: T.d(now), time: '10:00', room: '내시경실 1', sed: true } } });
      O(pj, pe, 'E8102', { at: now - 2 * HR, status: '예약확정', extra: { en: { date: T.d(now), time: '10:20', room: '내시경실 1', sed: true } } });
    }

    // ── 주사실 (외래·항암) ──
    const m = P({ name: '문경자', sex: 'F', birth: '1963-10-02', blood: 'A+', height: 158, weight: 56, ins: '건강보험', special: { code: 'V193', name: '암 산정특례 (본인부담 5%)' }, phone: '010-6643-12xx', address: '서울시 가상구 우물길 21', guardian: '남편 김대성 010-2234-71xx', hx: '왼쪽 유방암 2기, 수술 후 보조 항암 (AC 요법 4회 중 3회째). 왼팔 쪽은 림프절 절제 — 왼팔 주사·혈압 금지',
      flags: { isolation: '' }, scenario: { labs: { WBC: 4.2, Hb: 11.3, PLT: 210 } }, chemo: { regimen: 'AC (독소루비신 + 사이클로포스파마이드)', cycle: 3, of: 4, lastAt: now - 21 * DAY, noLeftArm: true } });
    const me = E({ patientId: m.id, type: 'OPD', dept: '혈액종양내과', doctorId: 'dr14', status: '진료완료', at: now - 3 * HR, qno: 2, visit: '재진', cc: '항암 3차 — 주사실', dx: [{ code: 'C50.9', name: '유방의 악성 신생물', main: true }, { code: 'Z51.1', name: '항암 화학요법' }] });
    const bsa = Math.sqrt((158 * 56) / 3600);
    O(m, me, 'L1001', { at: now - 3 * HR, status: '결과보고', vals: { WBC: 4.2, Hb: 11.3, PLT: 210 } });
    O(m, me, 'J0237', { at: now - 2 * HR, status: '불출', note: '항암제 30분 전' });
    O(m, me, 'J0234', { at: now - 2 * HR, dose: Math.round(60 * bsa), note: `체표면적 ${bsa.toFixed(2)}m² × 60mg/m² — 혈관 자극성 강함(일혈 주의), 생리식염수에 섞어 천천히 정맥 주사` });
    O(m, me, 'J0235', { at: now - 2 * HR, dose: Math.round(600 * bsa), note: `체표면적 ${bsa.toFixed(2)}m² × 600mg/m² — 생리식염수 250mL에 섞어 30분 이상` });
    const k = P({ name: '한미정', sex: 'F', birth: '1982-07-17', blood: 'O+', height: 162, weight: 52, ins: '건강보험', phone: '010-2201-89xx', address: '서울시 가상구 해바라기길 8', hx: '월경 과다, 철결핍 빈혈 (혈색소 8.9)', scenario: { labs: { Hb: 8.9 } } });
    const ke = E({ patientId: k.id, type: 'OPD', dept: '내과', doctorId: 'dr1', status: '진료완료', at: now - 80 * MIN, qno: 4, visit: '재진', cc: '철분 주사', dx: [{ code: 'D50.9', name: '철결핍 빈혈', main: true }] });
    O(k, ke, 'J0238', { at: now - 70 * MIN, status: '불출', note: '생리식염수 100mL에 섞어 15분 이상 정맥 주입' });
    O(k, ke, 'J0239', { at: now - 70 * MIN, status: '불출' });

    const nt = (to, text, pid, level) => db.notifs.push({ id: uid('nt'), to, text, patientId: pid, level: level || '', read: false, at: now - 10 * MIN });
    if (js) nt('cath', '응급! 정순자 ST분절 상승 심근경색 — 응급 중재술 팀 호출 (문에서 풍선까지 90분)', js.id, 'stat');
    nt('cath', '오늘 14:00 고민석 관상동맥 조영술 — 시술 전 준비', g.id);
    nt('endo', '응급 내시경: 조길호 위장관 출혈 (혈색소 8.4)', c.id, 'stat');
    nt('inj', '항암 주사 대기: 문경자 AC 3차 — 약제부 조제 확인', m.id);
    nt('pharmacy', '항암제 처방 (문경자) — 2인 확인 조제 후 외래 주사실로 불출', m.id);
  }

  H.seed.phase5 = phase5;
})();
