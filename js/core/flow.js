// 처방 흐름: 처방이 만들어져 각 부서를 거쳐 결과가 돌아오기까지
(function () {
  const H = window.H;
  const S = H.store;

  // 처방 종류별 단계 (마지막 단계 = 완료)
  const STEPS = {
    MED: ['전송', '감사완료', '조제완료', '불출'],
    INJ: ['전송', '감사완료', '조제완료', '불출'],
    LAB: ['전송', '채혈완료', '검사접수', '결과입력', '결과보고'],
    RAD: ['전송', '검사접수', '촬영완료', '판독완료'],
    PATH: ['전송', '검체확인', '병리접수', '육안검사', '슬라이드제작', '판독완료'],
    PROC: ['전송', '시행완료'],
    NUR: ['전송', '시행중'],
    DIET: ['전송', '적용'],
    BLOOD: ['전송', '교차시험완료', '출고'],
    CONSULT: ['전송', '회신완료'],
    OP: ['전송', '수술확정', '입실', '수술중', '회복실', '병동이송'],
    CV: ['전송', '시술확정', '시술전준비', '시술중', '시술후관찰', '시술완료'],
    EN: ['전송', '예약확정', '전처치', '시술중', '회복', '검사완료'],
  };
  const OFF = ['처방중단', '반려', '취소'];

  // 부서 알림 통로
  const CH = { MED: 'pharmacy', INJ: 'pharmacy', LAB: 'phlebo', RAD: 'rad', PATH: 'path', BLOOD: 'lab', CONSULT: 'doctor', OP: 'or', CV: 'cath', EN: 'endo' };

  const F = (H.flow = {
    STEPS, OFF,
    steps(o) { return o.outside ? ['전송', '처방전발행'] : (o.code === 'L1026' ? ['전송', '결과보고'] : STEPS[o.cat]); },
    isOff(o) { return OFF.includes(o.status); },
    isDone(o) { const s = F.steps(o); return F.isOff(o) || o.status === s[s.length - 1]; },
    stepIndex(o) { return F.steps(o).indexOf(o.status); },
    tone(o) {
      if (F.isOff(o)) return 'off';
      if (F.isDone(o)) return 'done';
      if (o.status === '전송') return o.stat ? 'stat' : 'sent';
      return 'prog';
    },
    chip(o) { return H.ui.chip(o.status, F.tone(o)); },
    wardOf(enc) { return enc ? (enc.type === 'ER' ? 'ER' : enc.ward || null) : null; },

    // 처방 만들기 + 전송
    create(enc, rows, opt = {}) {
      const p = H.pat(enc.patientId);
      const now = Date.now();
      const made = rows.map((r) => {
        const it = H.M.item(r.code);
        const o = {
          id: H.uid('or'), encId: enc.id, patientId: enc.patientId, encType: enc.type,
          cat: it.cat, code: it.code, name: it.name,
          dose: r.dose != null ? r.dose : it.dose, unit: r.unit || it.unit, route: r.route || it.route,
          freq: r.freq || it.freq || (it.cat === 'NUR' ? it.freq : 'ONCE'), days: Number(r.days) || 1,
          prn: !!r.prn, stat: !!r.stat,
          outside: !!r.outside, otype: r.otype || opt.otype || (enc.type === 'OPD' ? '외래' : enc.type === 'ER' ? '응급' : '정규'),
          note: r.note || '', verbal: !!opt.verbal,
          status: '전송', at: now, by: H.who(), doctorId: enc.doctorId,
          nurseAck: enc.type === 'OPD', hist: [{ s: '전송', at: now, by: H.who() }],
          ward: F.wardOf(enc),
        };
        if (o.prn) o.freq = 'PRN';
        if (o.stat && !['MED', 'INJ'].includes(o.cat)) o.freq = 'STAT';
        if (o.outside) { o.status = '처방전발행'; o.hist.push({ s: '처방전발행', at: now, by: H.who() }); }
        if (it.cat === 'MED' || it.cat === 'INJ') {
          const n = H.M.FREQ[o.freq] ? H.M.FREQ[o.freq].n : 1;
          o.qty = Math.max(1, (n || 1) * o.days);
        }
        if (it.cat === 'DIET' && enc) { H.store.db.encounters.find((e) => e.id === enc.id).diet = it.name; }
        S.add('orders', o, true);
        return o;
      });
      S.save();
      // 알림
      const ward = F.wardOf(enc);
      const byCh = {};
      made.forEach((o) => { if (o.outside) return; const ch = CH[o.cat]; if (ch && o.cat !== 'CONSULT') (byCh[ch] = byCh[ch] || []).push(o); });
      Object.entries(byCh).forEach(([ch, list]) => {
        const st = list.some((o) => o.stat);
        H.notify(ch, `${p.name} 새 처방 ${list.length}건${st ? ' (응급)' : ''}`, { patientId: p.id, level: st ? 'stat' : '' });
      });
      if (ward && enc.type !== 'OPD') H.notify('ward:' + ward, `${p.name} 새 처방 ${made.length}건 — 처방 확인 필요${opt.verbal ? ' (구두처방)' : ''}`, { patientId: p.id, level: made.some((o) => o.stat) ? 'stat' : '' });
      H.log('처방 전송', `${p.name} · ${made.map((o) => o.name).join(', ')}`, p.id);
      return made;
    },

    // 다음 단계로
    advance(o, status, extra = {}) {
      const now = Date.now();
      Object.assign(o, extra);
      o.status = status;
      o.hist = o.hist || [];
      o.hist.push({ s: status, at: now, by: H.who() });
      S.save();
      const p = H.pat(o.patientId);
      H.log(`${o.name} → ${status}`, p ? p.name : '', o.patientId);
      return o;
    },
    cancel(o, reason, status = '처방중단') {
      F.advance(o, status, { offReason: reason });
      const p = H.pat(o.patientId);
      const ch = CH[o.cat];
      if (ch && ch !== 'doctor') H.notify(ch, `${p.name} ${o.name} ${status}`, { patientId: p.id });
      if (o.ward) H.notify('ward:' + o.ward, `${p.name} ${o.name} ${status}${reason ? ' — ' + reason : ''}`, { patientId: p.id });
    },

    // 이 환자의 처방들
    ofEnc(encId) { return S.where('orders', (o) => o.encId === encId).sort((a, b) => b.at - a.at); },
    ofPat(pid) { return S.where('orders', (o) => o.patientId === pid).sort((a, b) => b.at - a.at); },
    activeMeds(pid) { return S.where('orders', (o) => o.patientId === pid && (o.cat === 'MED' || o.cat === 'INJ') && !F.isOff(o) && !o.outside && !o.done); },

    // 처방 안전 점검(DUR 흉내): 알레르기·중복·최대 용량·고위험 약
    dur(p, rows) {
      const out = [];
      const allergy = (p.allergies || []).map((a) => a.cls);
      const ex = rows.map((r) => r.id).filter(Boolean);
      const active = F.activeMeds(p.id).filter((o) => !ex.includes(o.id));
      rows.forEach((r) => {
        const it = H.M.item(r.code);
        if (!it || !(it.cat === 'MED' || it.cat === 'INJ')) return;
        const tags = (it.cls || '').split(' ');
        allergy.forEach((a) => {
          if (tags.includes(a)) out.push({ level: 'red', code: it.code, text: `[알레르기] ${p.name} 님은 ${H.M.ALLERGY_NAME[a] || a} 알레르기가 있습니다 → ${it.name}` });
          if (a === 'penicillin' && tags.includes('cephalosporin')) out.push({ level: 'amber', code: it.code, text: `[교차반응 주의] 페니실린 알레르기 환자에게 세팔로스포린 계열 → ${it.name} (드물게 교차 과민반응)` });
        });
        const dup = active.find((o) => H.M.item(o.code) && H.M.item(o.code).ing === it.ing);
        if (dup) out.push({ level: 'amber', code: it.code, text: `[중복 처방] 같은 성분 약이 이미 있습니다: ${dup.name}` });
        const n = H.M.FREQ[r.freq || it.freq] ? H.M.FREQ[r.freq || it.freq].n : 1;
        const daily = (H.num(r.dose) || it.dose) * (n || 1);
        if (it.maxDay && daily > it.maxDay) out.push({ level: 'red', code: it.code, text: `[최대 용량 초과] ${it.name} 하루 ${daily}${it.unit} > 최대 ${it.maxDay}${it.unit}` });
        if (it.highAlert) out.push({ level: 'amber', code: it.code, text: `[고위험 약물] ${it.name} — 투약 시 간호사 2명 이중 확인 필요` });
        if (it.narcotic) out.push({ level: 'amber', code: it.code, text: `[${it.narcotic}] ${it.name} — 마약류 관리 대상 (처방·불출·사용 기록 필요)` });
      });
      rows.forEach((r) => {
        const it = H.M.item(r.code);
        if (it && it.contrast && (p.allergies || []).some((a) => a.cls === 'contrast')) out.push({ level: 'red', code: it.code, text: `[조영제 알레르기] ${it.name} — 조영제 과민반응 이력, 전처치 또는 다른 검사 고려` });
        if (it && it.contrast) {
          const cr = F.lastLab(p.id, 'Cr');
          if (cr && cr.v > 1.5) out.push({ level: 'amber', code: it.code, text: `[신기능 주의] 최근 크레아티닌 ${cr.v} — 조영제 신병증 위험` });
        }
      });
      return out;
    },

    // 최근 검사값 하나
    lastLab(pid, analyte) {
      const list = S.where('orders', (o) => o.patientId === pid && o.cat === 'LAB' && o.result && o.status === '결과보고')
        .sort((a, b) => (b.result.at || 0) - (a.result.at || 0));
      for (const o of list) {
        const r = (o.result.items || []).find((x) => x.c === analyte);
        if (r && r.v !== '' && r.v != null) return { v: H.num(r.v) != null ? H.num(r.v) : r.v, flag: r.flag, at: o.result.at };
      }
      return null;
    },

    // 검사값 판정: H(높음) L(낮음) C(위험값)
    judge(item, v) {
      if (item.text) return { flag: v && v !== item.normal ? 'A' : '' };
      const n = H.num(v);
      if (n == null) return { flag: '' };
      if (item.chi != null && n >= item.chi) return { flag: 'C', dir: 'H' };
      if (item.clo != null && n <= item.clo) return { flag: 'C', dir: 'L' };
      if (item.hi != null && n > item.hi) return { flag: 'H' };
      if (item.lo != null && n < item.lo) return { flag: 'L' };
      return { flag: '' };
    },
    flagHtml(flag, dir) {
      if (flag === 'C') return `<span class="hl-c">위험${dir === 'L' ? '↓' : '↑'}</span>`;
      if (flag === 'H') return '<span class="hl-h">높음↑</span>';
      if (flag === 'L') return '<span class="hl-l">낮음↓</span>';
      if (flag === 'A') return '<span class="hl-h">이상</span>';
      return '';
    },
  });

  H.M.ALLERGY_NAME = { penicillin: '페니실린', cephalosporin: '세팔로스포린', nsaid: '소염진통제(NSAID)', contrast: '조영제', opioid: '마약성 진통제', sulfa: '설파제' };

  // 알림 보내기
  H.notify = (to, text, o = {}) => {
    S.add('notifs', { id: H.uid('nt'), to, text, patientId: o.patientId || null, level: o.level || '', read: false, at: Date.now() }, true);
    S.save();
  };
  // 활동 기록(교수자 점검용)
  H.log = (action, detail = '', patientId = null) => {
    const u = S.session().user || {};
    S.add('audit', { id: H.uid('au'), at: Date.now(), user: u.name || '-', sid: u.sid || '', dept: (H.app && H.app.curDeptName && H.app.curDeptName()) || '-', action, detail, patientId }, true);
    S.save();
  };
})();
