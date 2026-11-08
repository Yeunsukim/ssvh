// 자료 규칙표(스키마) · 처방 흐름 규칙표 · 자료 연결 자동 점검·고침 · DB 테이블 생성문(SQL)
// ※ 새 화면이 새 자료 묶음이나 새 칸(다른 묶음을 가리키는 열쇠)을 만들면 반드시 여기 SCHEMA에 적는다.
//    점검 도구가 이 표대로 모든 자료를 검사하므로, 적지 않으면 연결이 보장되지 않는다.
(function () {
  const H = window.H;
  const S = H.store;

  // ── 자료 규칙표 ──
  // t: 표 이름(한글) · req: 꼭 있어야 하는 칸 · fk: 다른 표를 가리키는 칸 { 칸: '표' | '@doctors' | '@master' | ['표'](목록) } · null: 비어도 되는 열쇠
  // enum: 허용 값 · cols: 칸 설명(DB 생성문에 사용) · kind: recs처럼 종류별로 나뉘는 표
  const ENC_ST = ['대기', '진료중', '진료완료', '입원중', '입원', '퇴원', '귀가', '전원', '취소', '사망', '수납대기'];
  const SCHEMA = {
    patients: { t: '환자', req: ['id', 'mrn', 'name', 'sex', 'birth'], uniq: ['mrn'], enum: { sex: ['M', 'F'] },
      cols: { id: 'PK', mrn: '등록번호(고유)', name: '이름', sex: '성별 M/F', birth: '생년월일 YYYY-MM-DD', blood: '혈액형', height: '키 cm', weight: '몸무게 kg', ins: '보험 종류', phone: '휴대전화', address: '주소', guardian: '보호자', allergies: 'JSON 알레르기 목록', flags: 'JSON 경고(격리·DNR 등)', hx: '과거력', erp: 'JSON 원무 정보', crm: 'JSON 고객관리 정보', refConsent: 'JSON 진료정보 제공 동의', scenario: 'JSON 실습 사례값' } },
    encounters: { t: '진료(내원·입원)', req: ['id', 'patientId', 'type', 'dept', 'doctorId', 'status', 'at'], fk: { patientId: 'patients', doctorId: '@doctors' }, enum: { type: ['OPD', 'IPD', 'ER'], status: ENC_ST },
      cols: { id: 'PK', patientId: 'FK 환자', type: '외래 OPD/입원 IPD/응급 ER', dept: '진료과', doctorId: 'FK 의사', status: '상태', at: '시작 시각', endAt: '종료(퇴원) 시각', ward: '병동', room: '병실', bed: '침상', ktas: '응급 중증도', cc: '주호소', dx: 'JSON 진단 목록(KCD)', diet: '식이', dc: 'JSON 퇴원 정보', coding: 'JSON 코딩(의료정보)', mi: 'JSON 퇴원분석', moves: 'JSON 전동 이력', billed: '수납 완료 여부' } },
    orders: { t: '처방', req: ['id', 'encId', 'patientId', 'cat', 'code', 'name', 'status', 'at'], fk: { encId: 'encounters', patientId: 'patients', doctorId: '@doctors', code: '@master' },
      cols: { id: 'PK', encId: 'FK 진료', patientId: 'FK 환자', encType: '진료 구분', cat: '처방 분류', code: 'FK 처방 항목(마스터)', name: '처방명', dose: '용량', unit: '단위', route: '경로', freq: '횟수', days: '일수', qty: '총량', prn: '필요시', stat: '응급', outside: '원외처방', status: '진행 상태', at: '처방 시각', by: '처방자', doctorId: 'FK 의사', ward: '병동', hist: 'JSON 단계 이력', result: 'JSON 결과', specimenAt: '채혈 시각', shotAt: '촬영 시각', arrivedAt: '병동 도착 시각', op: 'JSON 수술', cv: 'JSON 심혈관 시술', en: 'JSON 내시경', adj: 'JSON 심사 조정' } },
    notes: { t: '의사 기록', req: ['id', 'encId', 'patientId', 'type', 'at'], fk: { encId: 'encounters', patientId: 'patients' }, cols: { id: 'PK', encId: 'FK 진료', patientId: 'FK 환자', type: '기록 종류', at: '작성 시각', by: '작성자', signed: '전자서명', content: 'JSON 내용' } },
    vitals: { t: '활력징후', req: ['id', 'patientId', 'at'], fk: { patientId: 'patients', encId: 'encounters' }, null: ['encId'], cols: { id: 'PK', patientId: 'FK 환자', encId: 'FK 진료', at: '측정 시각', sbp: '수축기', dbp: '이완기', hr: '맥박', rr: '호흡', bt: '체온', spo2: '산소포화도', pain: '통증' } },
    io: { t: '섭취·배설', req: ['id', 'patientId', 'at'], fk: { patientId: 'patients' }, cols: { id: 'PK', patientId: 'FK 환자', at: '시각', kind: '섭취/배설', type: '종류', amount: '양 mL' } },
    mar: { t: '투약 기록(MAR)', req: ['id', 'orderId', 'patientId', 'status', 'at'], fk: { orderId: 'orders', patientId: 'patients' }, cols: { id: 'PK', orderId: 'FK 처방', patientId: 'FK 환자', slot: '투약 시간대', status: '투약/보류/거부', at: '시각', by: '간호사', checks: 'JSON 5원칙 확인' } },
    nnotes: { t: '간호 기록', req: ['id', 'patientId', 'at'], fk: { patientId: 'patients', encId: 'encounters' }, null: ['encId'], cols: { id: 'PK', patientId: 'FK 환자', encId: 'FK 진료', at: '시각', format: '서술/Focus', text: '내용' } },
    assess: { t: '간호 사정(점수)', req: ['id', 'patientId', 'kind', 'at'], fk: { patientId: 'patients' }, cols: { id: 'PK', patientId: 'FK 환자', kind: '도구(Morse·Braden 등)', score: '점수', level: '등급', answers: 'JSON 문항' } },
    handoffs: { t: '인수인계', req: ['id', 'patientId', 'at'], fk: { patientId: 'patients' }, cols: { id: 'PK', patientId: 'FK 환자', ward: '병동', S: '상황', B: '배경', A: '사정', R: '요청', status: '상태' } },
    comms: { t: 'SBAR 보고', req: ['id', 'patientId', 'at'], fk: { patientId: 'patients' }, cols: { id: 'PK', patientId: 'FK 환자', S: '상황', B: '배경', A: '사정', R: '요청', reply: '의사 답변' } },
    codes: { t: '심폐소생술 기록', req: ['id'], fk: { patientId: 'patients' }, null: ['patientId'], cols: { id: 'PK', patientId: 'FK 환자', events: 'JSON 경과' } },
    acts: { t: '간호 활동', req: ['id'], fk: { patientId: 'patients' }, null: ['patientId'], cols: { id: 'PK', patientId: 'FK 환자' } },
    notifs: { t: '알림', req: ['id', 'to', 'text', 'at'], fk: { patientId: 'patients' }, null: ['patientId'], cols: { id: 'PK', to: '받는 부서 통로', text: '내용', patientId: 'FK 환자', level: '응급 여부', read: '읽음' } },
    audit: { t: '활동 기록(감사)', req: ['id', 'at', 'action'], fk: { patientId: 'patients' }, null: ['patientId'], cols: { id: 'PK', at: '시각', user: '사용자', sid: '학번', dept: '부서', action: '행동', detail: '내용', patientId: 'FK 환자' } },
    admreq: { t: '입원 요청', req: ['id', 'patientId'], fk: { patientId: 'patients', fromEnc: 'encounters', doctorId: '@doctors' }, null: ['fromEnc'], cols: { id: 'PK', patientId: 'FK 환자', fromEnc: 'FK 진료(외래·응급)', dept: '진료과', ward: '희망 병동', status: '상태' } },
    specimens: { t: '검체', req: ['id', 'patientId'], fk: { patientId: 'patients', orderIds: ['orders'] }, cols: { id: 'PK', patientId: 'FK 환자', orderIds: 'JSON FK 처방 목록', at: '채혈 시각' } },
    recs: { t: '부서별 업무 기록', req: ['id', 'kind', 'at'], fk: { patientId: 'patients', encId: 'encounters', orderId: 'orders' }, null: ['patientId', 'encId', 'orderId'], kind: true, cols: { id: 'PK', kind: '기록 종류(qc·voc·call·happy 등)', patientId: 'FK 환자', encId: 'FK 진료', orderId: 'FK 처방', at: '시각', by: '기록자', data: 'JSON 나머지 칸' } },
    bills: { t: '수납 영수증', req: ['id', 'encId', 'patientId', 'at'], fk: { encId: 'encounters', patientId: 'patients' }, cols: { id: 'PK', no: '영수증 번호', encId: 'FK 진료', patientId: 'FK 환자', kind: '구분', total: '총액', ins: '공단부담', self: '본인부담', non: '비급여', paid: '받은 돈', method: '결제 수단' } },
    claims: { t: '보험 청구', req: ['id', 'no', 'at'], fk: { encIds: ['encounters'] }, cols: { id: 'PK', no: '청구 번호', encIds: 'JSON FK 진료 목록', amount: '청구액', status: '상태', results: 'JSON 심사 결과', returns: 'JSON 반송 진료' } },
    defs: { t: '미비 기록', req: ['id', 'encId', 'patientId', 'item', 'status'], fk: { encId: 'encounters', patientId: 'patients' }, cols: { id: 'PK', encId: 'FK 진료', patientId: 'FK 환자', item: '빠진 기록', to: '담당자', status: '요청/완료', doneAt: '완료 시각' } },
    certs: { t: '제증명 발급', req: ['id', 'at'], fk: { patientId: 'patients', encId: 'encounters' }, null: ['patientId', 'encId'], cols: { id: 'PK', patientId: 'FK 환자', encId: 'FK 진료', type: '종류', price: '수수료' } },
    items: { t: '물품·재고·멸균', req: ['id', 'kind'], cols: { id: 'PK', kind: '종류', name: '물품명', qty: '수량', lot: '로트', status: '상태' } },
    refs: { t: '진료협력(의뢰·회송·회신)', req: ['id', 'dir', 'pname', 'status', 'at'], fk: { pid: 'patients', doctorId: '@doctors' }, null: ['pid', 'doctorId'], enum: { dir: ['in', 'out'] }, cols: { id: 'PK', dir: '받음 in/보냄 out', pid: 'FK 환자', pname: '환자 이름', from: '의뢰 기관', to: '받는 기관', dept: '진료과', reason: '사유', status: '상태', reply: '회신 내용', docType: '문서 종류', ediNo: '중계 번호', form: 'JSON 서식', forms: 'JSON 요양급여 서식' } },
    appts: { t: '예약', req: ['id', 'pid', 'dept', 'date', 'time', 'status'], fk: { pid: 'patients', doctorId: '@doctors', orderId: 'orders' }, null: ['orderId', 'doctorId'], enum: { status: ['예약', '도착', '취소', '부도', '변경'] }, cols: { id: 'PK', pid: 'FK 환자', dept: '진료과', doctorId: 'FK 의사', date: '날짜', time: '시각', status: '상태', kind: '진료/검사', orderId: 'FK 처방(검사 예약)', via: '예약 경로' } },
    qi: { t: '질향상·환자안전', req: ['id', 'kind'], cols: { id: 'PK', kind: '종류', type: '사건 유형', grade: '위해 정도', what: '내용', status: '상태' } },
    staff: { t: '직원', req: ['id', 'name'], cols: { id: 'PK', name: '이름', ward: '부서', role: '직책' } },
  };

  // ── 처방 흐름 규칙표: 처방 분류 → 단계 → 담당 부서 화면 ──
  const ROUTES = {
    MED: [['전송', '약제부 — 처방 감사', 'pharmacy'], ['감사완료', '약제부 — 조제', 'pharmacy'], ['조제완료', '약제부 — 병동별 집계·불출 / 외래 투약구', 'pharmacy'], ['불출', '병동 투약(MAR) · 외래는 환자 교부', 'ward']],
    INJ: [['전송', '약제부 — 처방 감사', 'pharmacy'], ['감사완료', '약제부 — 조제', 'pharmacy'], ['조제완료', '약제부 — 불출', 'pharmacy'], ['불출', '병동 투약(MAR) · 외래 주사실', 'ward|injection']],
    LAB: [['전송', '채혈실(외래) · 병동 채혈', 'phlebo|ward'], ['채혈완료', '진단검사 — 검체 접수', 'lab'], ['검사접수', '진단검사 — 파트별 검사', 'lab'], ['결과입력', '진단검사 — 검증·보고', 'lab'], ['결과보고', '처방 화면 결과 조회 · 병동 확인', 'ocs-ipd|ward']],
    RAD: [['전송', '영상의학 — 접수', 'radiology'], ['검사접수', '영상의학 — 실별 촬영(조영제실 포함)', 'radiology'], ['촬영완료', '영상의학 — 판독', 'radiology'], ['판독완료', 'PACS 조회 (처방 화면)', 'ocs-ipd']],
    PATH: [['전송', '병리과 — 검체 도착', 'pathology'], ['검체확인', '병리과 — 접수', 'pathology'], ['병리접수', '병리과 — 육안 검사', 'pathology'], ['육안검사', '병리과 — 슬라이드', 'pathology'], ['슬라이드제작', '병리과 — 판독', 'pathology'], ['판독완료', '처방 화면 결과 조회', 'ocs-ipd']],
    PROC: [['전송', '기능검사실(기능검사) · 병동(입원·응급 처치) · 주사실 외래 처치실(외래 처치)', 'func|ward|injection'], ['시행완료', '처방 화면 결과 조회 · 수납', 'ocs-ipd']],
    NUR: [['전송', '병동 — 처방 확인 → 시행', 'ward'], ['시행중', '병동 — 간호 수행 기록', 'ward']],
    DIET: [['전송', '병동 — 처방 확인 → 영양팀 적용', 'ward'], ['적용', '영양팀 배식 집계', 'nst']],
    BLOOD: [['전송', '혈액은행 — 교차시험', 'lab'], ['교차시험완료', '혈액은행 — 출고', 'lab'], ['출고', '병동·수술실 — 2인 확인 후 수혈', 'ward']],
    CONSULT: [['전송', '협진 의사 — 처방 화면 협진 탭에서 회신', 'ocs-ipd'], ['회신완료', '의뢰 의사 확인', 'ocs-ipd']],
    OP: [['전송', '수술실 — 일정·방 배정', 'or'], ['수술확정', '병동 수술 전 준비 → 수술실 입실', 'or'], ['입실', '수술실 — 타임아웃', 'or'], ['수술중', '수술실 — 수술 기록', 'or'], ['회복실', '회복실 — 퇴실 기준', 'or'], ['병동이송', '병동 — 수술 후 간호', 'ward']],
    CV: [['전송', '심혈관센터 — 일정', 'cath'], ['시술확정', '심혈관센터 — 시술 전 준비', 'cath'], ['시술전준비', '심혈관센터 — 시술 중', 'cath'], ['시술중', '심혈관센터 — 시술 후 관찰', 'cath'], ['시술후관찰', '심혈관센터 — 완료', 'cath'], ['시술완료', '병동 — 천자 부위 관찰', 'ward']],
    EN: [['전송', '내시경실 — 예약·교육', 'endo'], ['예약확정', '내시경실 — 전처치', 'endo'], ['전처치', '내시경실 — 검사 중', 'endo'], ['시술중', '내시경실 — 회복', 'endo'], ['회복', '내시경실 — 귀가·완료', 'endo'], ['검사완료', '처방 화면 결과 조회 · 병리(조직검사)', 'ocs-ipd']],
  };
  const AFTER = '끝난 처방(간호처방·식이·협진 제외) → 진료비 계산 → 원무 수납(외래 수납·입원 정산) → 퇴원 심사·코딩 → 청구·EDI → 재청구·이의신청';

  const doctors = () => new Set((H.M.DOCTORS || []).map((d) => d.id));
  const tabOf = (c) => SCHEMA[c] || { t: c, req: ['id'], cols: {} };

  // ── 점검 ──
  function check() {
    const db = S.db; const out = []; const docs = doctors();
    const idx = {}; Object.keys(SCHEMA).forEach((c) => { idx[c] = new Map((db[c] || []).map((r) => [r.id, r])); });
    const add = (lvl, c, r, msg, fix) => out.push({ lvl, c, id: r ? r.id : '', msg, fix: fix || '' });
    Object.entries(SCHEMA).forEach(([c, sc]) => {
      const rows = db[c]; if (!Array.isArray(rows)) { add('오류', c, null, '표가 없습니다', 'arrays'); return; }
      const seen = new Set();
      rows.forEach((r) => {
        if (!r || typeof r !== 'object') { add('오류', c, null, '잘못된 줄(빈 값)', 'dropNull'); return; }
        if (seen.has(r.id)) add('오류', c, r, `같은 번호(id)가 두 번 있습니다: ${r.id}`, 'dupId'); seen.add(r.id);
        (sc.req || []).forEach((k) => { if (r[k] == null || r[k] === '') add('오류', c, r, `꼭 있어야 하는 칸 "${(sc.cols || {})[k] || k}"(${k})이 비었습니다`, c === 'orders' && k === 'patientId' ? 'orderPat' : ''); });
        Object.entries(sc.fk || {}).forEach(([k, to]) => {
          const v = r[k]; if (v == null || v === '') return;
          const okOne = (x) => (to === '@doctors' ? docs.has(x) : to === '@master' ? !!H.M.item(x) : idx[to] && idx[to].has(x));
          if (Array.isArray(to)) { (Array.isArray(v) ? v : []).forEach((x) => { if (!idx[to[0]].has(x)) add('오류', c, r, `${k} 목록의 ${x} → ${tabOf(to[0]).t}에 없음`, ''); }); return; }
          if (!okOne(v)) add((sc.null || []).includes(k) ? '주의' : '오류', c, r, `${k}=${v} → ${to === '@doctors' ? '의사 명단' : to === '@master' ? '처방 항목 마스터' : tabOf(to).t}에 없음 (끊긴 연결)`, (sc.null || []).includes(k) ? 'nullFk' : '');
        });
        Object.entries(sc.enum || {}).forEach(([k, vals]) => { if (r[k] != null && !vals.includes(r[k])) add('주의', c, r, `${k} 값 "${r[k]}"은 정해진 값(${vals.join('·')})이 아닙니다`, ''); });
      });
      (sc.uniq || []).forEach((k) => { const m = {}; rows.forEach((r) => { if (r[k]) (m[r[k]] = m[r[k]] || []).push(r); }); Object.values(m).filter((l) => l.length > 1).forEach((l) => add('오류', c, l[1], `${k} "${l[0][k]}"가 겹칩니다 (${l.length}명)`, '')); });
    });
    // 처방 업무 규칙
    (db.orders || []).forEach((o) => {
      const e = idx.encounters.get(o.encId);
      if (e && e.patientId !== o.patientId) add('오류', 'orders', o, '처방의 환자와 진료의 환자가 다릅니다', 'orderPat');
      if (e && o.encType && o.encType !== e.type) add('주의', 'orders', o, `진료 구분(${o.encType})이 진료(${e.type})와 다릅니다`, 'orderType');
      const st = H.flow.steps(o) || []; if (!st.includes(o.status) && !H.flow.OFF.includes(o.status)) add('오류', 'orders', o, `처방 상태 "${o.status}"는 ${o.cat} 처방 단계(${st.join('→')})에 없습니다`, '');
      if (!Array.isArray(o.hist) || !o.hist.length) add('주의', 'orders', o, '단계 이력(hist)이 없습니다', 'hist');
      else if (o.hist[o.hist.length - 1].s !== o.status) add('주의', 'orders', o, `마지막 이력(${o.hist[o.hist.length - 1].s})과 현재 상태(${o.status})가 다릅니다`, 'hist');
      if (o.cat === 'LAB' && ['결과입력', '결과보고'].includes(o.status) && !(o.result && Array.isArray(o.result.items) && o.result.items.length)) add('오류', 'orders', o, '검사 결과 단계인데 결과값이 없습니다', '');
      if (o.cat === 'RAD' && o.status === '판독완료' && !(o.result && o.result.impression)) add('오류', 'orders', o, '판독완료인데 판독 결론이 없습니다', '');
      if (['MED', 'INJ', 'BLOOD'].includes(o.cat) && ['불출', '출고'].includes(o.status) && !o.arrivedAt) add('주의', 'orders', o, '불출(출고)했는데 도착 시각이 없습니다', 'arrived');
      if (H.M.item(o.code) && !(H.M.item(o.code).price > 0) && !['NUR', 'DIET', 'CONSULT'].includes(o.cat)) add('주의', 'orders', o, `처방 항목 ${o.code}에 수가(가격)가 없어 청구되지 않습니다`, '');
    });
    // 진료 업무 규칙
    const activeIpd = {};
    (db.encounters || []).forEach((e) => {
      if (e.type === 'IPD' && e.status === '퇴원' && !e.endAt) add('주의', 'encounters', e, '퇴원했는데 퇴원 시각(endAt)이 없습니다', 'endAt');
      if (['입원중'].includes(e.status)) { (activeIpd[e.patientId] = activeIpd[e.patientId] || []).push(e); const k = `${e.ward}|${e.room}|${e.bed}`; const dup = (db.encounters || []).filter((x) => x !== e && x.status === '입원중' && `${x.ward}|${x.room}|${x.bed}` === k && e.room); if (dup.length) add('오류', 'encounters', e, `같은 침상(${e.ward} ${e.room}-${e.bed})에 두 환자가 있습니다`, ''); }
      if (['퇴원', '귀가'].includes(e.status)) { const open = (db.orders || []).filter((o) => o.encId === e.id && !H.flow.isDone(o) && !['NUR', 'DIET'].includes(o.cat)); if (open.length) add('주의', 'encounters', e, `퇴원·귀가했는데 끝나지 않은 처방 ${open.length}건 (${open.slice(0, 3).map((o) => o.name).join(', ')})`, ''); }
    });
    Object.entries(activeIpd).forEach(([pid, l]) => { if (l.length > 1) add('오류', 'encounters', l[1], `한 환자(${(idx.patients.get(pid) || {}).name})가 동시에 입원 ${l.length}건`, ''); });
    (db.mar || []).forEach((m) => { const o = idx.orders.get(m.orderId); if (o && o.patientId !== m.patientId) add('오류', 'mar', m, '투약 기록의 환자와 처방의 환자가 다릅니다', 'marPat'); });
    const today = H.t.d(Date.now()); (db.appts || []).forEach((a) => { if (a.status === '예약' && a.date < today) add('주의', 'appts', a, `지난 예약(${a.date})이 "예약" 상태 — 부도 처리 필요`, 'noShow'); });
    // 흐름 규칙 자체 점검
    Object.entries(ROUTES).forEach(([cat, rs]) => { rs.forEach(([st, , mods]) => { mods.split('|').forEach((m) => { if (!H.mods[m]) out.push({ lvl: '오류', c: '규칙표', id: cat, msg: `${cat} ${st} 단계의 담당 화면 "${m}"이 없습니다`, fix: '' }); }); }); const steps = H.flow.STEPS[cat] || []; steps.forEach((s) => { if (!rs.some((r) => r[0] === s)) out.push({ lvl: '오류', c: '규칙표', id: cat, msg: `${cat} 처방의 "${s}" 단계를 맡는 부서가 규칙표에 없습니다`, fix: '' }); }); });
    Object.keys(S.db).forEach((c) => { if (Array.isArray(S.db[c]) && !SCHEMA[c]) out.push({ lvl: '주의', c, id: '', msg: `자료 묶음 "${c}"이 자료 규칙표에 없습니다 — 규칙표에 추가해야 연결이 보장됩니다`, fix: '' }); });
    return out;
  }

  // ── 안전한 자동 고침 (지우지 않고 바로잡기만) ──
  function repair(list) {
    const db = S.db; let n = 0; const fixes = new Set((list || check()).map((x) => x.fix).filter(Boolean));
    if (fixes.has('arrays')) { S.fix(); n++; }
    if (fixes.has('dropNull')) Object.keys(SCHEMA).forEach((c) => { const b = db[c].length; db[c] = db[c].filter((r) => r && typeof r === 'object'); n += b - db[c].length; });
    if (fixes.has('dupId')) Object.keys(SCHEMA).forEach((c) => { const seen = new Set(); db[c].forEach((r) => { if (seen.has(r.id) && ['notifs', 'audit', 'recs'].includes(c)) { r.id = H.uid(c.slice(0, 2)); n++; } seen.add(r.id); }); });
    db.orders.forEach((o) => { const e = S.get('encounters', o.encId);
      if (e && fixes.has('orderPat') && o.patientId !== e.patientId) { o.patientId = e.patientId; n++; }
      if (e && fixes.has('orderType') && o.encType !== e.type) { o.encType = e.type; n++; }
      if (fixes.has('hist') && (!Array.isArray(o.hist) || !o.hist.length || o.hist[o.hist.length - 1].s !== o.status)) { o.hist = Array.isArray(o.hist) ? o.hist : []; o.hist.push({ s: o.status, at: o.at, by: '자료 점검 (이력 보완)' }); n++; }
      if (fixes.has('arrived') && ['불출', '출고'].includes(o.status) && !o.arrivedAt) { o.arrivedAt = (o.hist && o.hist.length ? o.hist[o.hist.length - 1].at : o.at); n++; } });
    if (fixes.has('nullFk')) Object.entries(SCHEMA).forEach(([c, sc]) => (sc.null || []).forEach((k) => { const to = (sc.fk || {})[k]; if (!to || Array.isArray(to)) return; db[c].forEach((r) => { if (r[k] && (to === '@doctors' ? !doctors().has(r[k]) : to === '@master' ? !H.M.item(r[k]) : !S.get(to, r[k]))) { r[k] = null; n++; } }); }));
    if (fixes.has('endAt')) db.encounters.forEach((e) => { if (e.type === 'IPD' && e.status === '퇴원' && !e.endAt) { const last = db.orders.filter((o) => o.encId === e.id).reduce((m, o) => Math.max(m, ...(o.hist || []).map((h) => h.at)), e.at); e.endAt = last; n++; } });
    if (fixes.has('marPat')) db.mar.forEach((m) => { const o = S.get('orders', m.orderId); if (o && o.patientId !== m.patientId) { m.patientId = o.patientId; n++; } });
    if (fixes.has('noShow')) { const t = H.t.d(Date.now()); db.appts.forEach((a) => { if (a.status === '예약' && a.date < t) { a.status = '부도'; n++; } }); }
    S.save(); H.log('자료 점검 자동 고침', `${n}건`); return n;
  }

  // ── DB 테이블 생성문(SQL) ──
  function ddl() {
    const sqlT = (k, desc) => (/(^id$|Id$|^pid$|^code$|^mrn$|^no$|^status$|^type$|^cat$|^dir$|^kind$|^date$|^time$)/.test(k) ? 'VARCHAR(40)' : /^(at|endAt|specimenAt|shotAt|arrivedAt|doneAt)$/.test(k) ? 'BIGINT' : /^(height|weight|qty|days|dose|total|ins|self|non|paid|amount|price|score|sbp|dbp|hr|rr|spo2|pain)$/.test(k) ? 'NUMERIC' : /^JSON/.test(desc) ? 'JSON' : 'TEXT');
    const lines = ['-- SSV 병원 전산 실습 — 자료 규칙표에서 자동으로 만든 테이블 생성문 (PostgreSQL 기준)', '-- 실습 기록(JSON)의 각 묶음이 아래 테이블 한 개와 1:1로 대응합니다.', ''];
    lines.push('CREATE TABLE doctors (id VARCHAR(40) PRIMARY KEY, name TEXT NOT NULL, dept TEXT); -- 의사 명단 (마스터)');
    lines.push('CREATE TABLE master_items (code VARCHAR(40) PRIMARY KEY, cat VARCHAR(20) NOT NULL, name TEXT NOT NULL, price NUMERIC, detail JSON); -- 처방 항목 마스터', '');
    const order = ['patients', 'encounters', 'orders', 'notes', 'vitals', 'io', 'mar', 'nnotes', 'assess', 'handoffs', 'comms', 'codes', 'acts', 'notifs', 'audit', 'admreq', 'specimens', 'recs', 'bills', 'claims', 'defs', 'certs', 'items', 'refs', 'appts', 'qi', 'staff'];
    order.forEach((c) => { const sc = SCHEMA[c]; const cols = Object.entries(sc.cols); const body = cols.map(([k, d]) => { const fk = (sc.fk || {})[k]; let s = `  "${k}" ${k === 'id' ? 'VARCHAR(40) PRIMARY KEY' : sqlT(k, d)}${(sc.req || []).includes(k) && k !== 'id' ? ' NOT NULL' : ''}${(sc.uniq || []).includes(k) ? ' UNIQUE' : ''}`;
      if (fk && !Array.isArray(fk)) s += fk === '@doctors' ? ' REFERENCES doctors(id)' : fk === '@master' ? ' REFERENCES master_items(code)' : ` REFERENCES ${fk}("id")`; return `${s}, -- ${d}`; });
      if (sc.kind) body.push('  -- kind별 나머지 칸은 data(JSON)에 저장');
      body.push('  "extra" JSON -- 규칙표에 없는 추가 칸'); lines.push(`CREATE TABLE ${c} ( -- ${sc.t}`, ...body, ');', ''); });
    lines.push('-- 자주 찾는 열쇠에 색인', 'CREATE INDEX ix_enc_pat ON encounters("patientId");', 'CREATE INDEX ix_ord_enc ON orders("encId");', 'CREATE INDEX ix_ord_pat_status ON orders("patientId", "status");', 'CREATE INDEX ix_mar_ord ON mar("orderId");', 'CREATE INDEX ix_notif_to ON notifs("to", "read");');
    return lines.join('\n');
  }

  H.SCHEMA = SCHEMA; H.ROUTES = ROUTES; H.ROUTE_AFTER = AFTER;
  H.integrity = { check, repair, ddl };
})();
