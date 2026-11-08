// 저장 장치: 모든 실습 데이터를 브라우저 저장 공간(localStorage)에 보관
// 저장소를 바꾸고 싶으면 이 파일만 고치면 됩니다.
(function () {
  const H = window.H;
  const KEY = 'ssvh.v1.db';
  const PREF = 'ssvh.v1.prefs';
  const SESS = 'ssvh.v1.session';
  const VERSION = 1; // 자료 형식 판 — 바꿀 때는 MIGRATE에 옮기는 방법을 꼭 적는다 (기존 실습 기록을 지우지 않음)
  const BAK = 'ssvh.v1.db.bak';
  const MIGRATE = { /* 예: 2: (db) => { db.새칸 = ...; } */ };
  const COLS = [
    'patients', 'encounters', 'orders', 'notes', 'vitals', 'io', 'mar', 'nnotes', 'assess',
    'handoffs', 'comms', 'codes', 'acts', 'notifs', 'audit', 'admreq', 'specimens', 'recs',
    'bills', 'claims', 'defs', 'certs', 'items', 'refs', 'appts', 'qi', 'staff',
  ];

  const mem = {};
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return k in mem ? mem[k] : null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { mem[k] = v; return false; } };

  const S = (H.store = {
    db: null,
    ok: true,
    load() {
      const raw = lsGet(KEY);
      if (raw) { try { this.db = JSON.parse(raw); } catch (e) { this.db = null; } }
      // 저장 자료가 손상되었으면 예비 사본으로 복구
      if (raw && !this.valid(this.db)) { const b = lsGet(BAK); let bd = null; try { bd = JSON.parse(b); } catch (e) { bd = null; } if (this.valid(bd)) { this.db = bd; this.restoredAt = Date.now(); console.warn('저장 자료가 손상되어 예비 사본으로 복구했습니다'); } else this.db = null; }
      // 형식 판이 오래되었으면 기록을 지우지 않고 옮김
      if (this.db && this.db.version < VERSION) { for (let v = this.db.version + 1; v <= VERSION; v++) { if (MIGRATE[v]) MIGRATE[v](this.db); this.db.version = v; } }
      if (!this.db) { this.db = H.seed.build(); this.save(); }
      this.fix();
      // 2단계 환자 덧붙이기 (예전 실습 기록은 그대로 둠)
      if (!this.db.p2 && H.seed.phase2) { H.seed.phase2(this.db); this.db.p2 = true; this.save(); }
      if (!this.db.p3 && H.seed.phase3) { H.seed.phase3(this.db); this.db.p3 = true; this.save(); }
      if (!this.db.p4 && H.seed.phase4) { H.seed.phase4(this.db); this.db.p4 = true; this.save(); }
      if (!this.db.p5 && H.seed.phase5) { H.seed.phase5(this.db); this.db.p5 = true; this.save(); }
      if (!this.db.p6 && H.seed.phase6) { H.seed.phase6(this.db); this.db.p6 = true; this.save(); }
      if (!this.db.p7 && H.seed.phase7) { H.seed.phase7(this.db); this.db.p7 = true; this.save(); }
      if (!this.db.p8 && H.seed.phase8) { H.seed.phase8(this.db); this.db.p8 = true; this.save(); }
    },
    fix() { COLS.forEach((c) => { if (!Array.isArray(this.db[c])) this.db[c] = []; }); if (!this.db.seq) this.db.seq = { mrn: 1000 }; },
    valid(d) { return !!(d && typeof d === 'object' && Array.isArray(d.patients) && Array.isArray(d.orders) && d.version); },
    save() {
      this.db.savedAt = Date.now();
      let txt; try { txt = JSON.stringify(this.db); } catch (e) { this.ok = false; console.error(e); return; }
      this.ok = lsSet(KEY, txt) && lsGet(KEY) === txt; // 저장 후 다시 읽어 확인
      if (!this.ok && !this._warned) { this._warned = true; try { H.ui && H.ui.toast('저장하지 못했습니다 — 저장 공간이 꽉 찼거나 비공개 창입니다. "내 기록 복사하기"로 백업하세요', 'err'); } catch (e) { /* 무시 */ } }
      if (this.ok) this._warned = false;
      if (this.ok && Date.now() - (this.bakAt || 0) > 10 * 60000) this.backup();
      this._lastTxt = txt;
      H.bus && H.bus.emit('saved');
    },
    // 예비 사본(백업)
    backup(force) { const txt = this._lastTxt || JSON.stringify(this.db); if (force || this.valid(this.db)) { if (lsSet(BAK, txt)) this.bakAt = Date.now(); } },
    restore() { let bd = null; try { bd = JSON.parse(lsGet(BAK)); } catch (e) { bd = null; } if (!this.valid(bd)) return false; this.db = bd; this.fix(); this.restoredAt = Date.now(); this.save(); return true; },
    health() { const b = lsGet(BAK); let bt = null; try { bt = b ? JSON.parse(b).savedAt : null; } catch (e) { bt = null; } return { version: this.db && this.db.version, savedAt: this.db && this.db.savedAt, ok: this.ok, bakAt: this.bakAt || bt, bakKB: b ? Math.round((b.length * 2) / 1024) : 0, restored: this.restoredAt }; },
    all(c) { return this.db[c]; },
    get(c, id) { return this.db[c].find((x) => x.id === id); },
    where(c, fn) { return this.db[c].filter(fn); },
    add(c, obj, silent) {
      if (!obj.id || this.db[c].some((x) => x.id === obj.id)) obj.id = H.uid(c.slice(0, 2)); // 번호(id) 겹침 방지
      if (!obj.at) obj.at = Date.now();
      this.db[c].push(obj);
      if (!silent) this.save();
      return obj;
    },
    update(c, id, patch) {
      const o = this.get(c, id);
      if (!o) return null;
      Object.assign(o, typeof patch === 'function' ? patch(o) || {} : patch);
      this.save();
      return o;
    },
    remove(c, id) { this.db[c] = this.db[c].filter((x) => x.id !== id); this.save(); },
    nextMrn() { this.db.seq.mrn += 1; return String(this.db.seq.mrn).padStart(8, '0'); },
    reset() {
      this.backup(true); // 처음 상태로 되돌리기 전 지금 자료를 예비 사본으로
      this.db = H.seed.build(); this.fix();
      ['phase2', 'phase3', 'phase4', 'phase5', 'phase6', 'phase7', 'phase8'].forEach((k, i) => { if (H.seed[k]) { H.seed[k](this.db); this.db['p' + (i + 2)] = true; } });
      this.save();
    },
    exportJSON() { return JSON.stringify(this.db); },
    importJSON(txt) {
      const d = JSON.parse(txt);
      if (!d || d.version !== VERSION || !Array.isArray(d.patients)) throw new Error('SSV 병원 실습 기록 파일이 아닙니다.');
      this.backup(true); this.db = d; this.fix(); this.save();
    },
    sizeKB() { return Math.round((JSON.stringify(this.db).length * 2) / 1024); },

    // 화면 설정(밝기·글씨 크기) — 사람마다 따로
    prefs() { try { return JSON.parse(lsGet(PREF)) || {}; } catch (e) { return {}; } },
    setPref(k, v) { const p = this.prefs(); p[k] = v; lsSet(PREF, JSON.stringify(p)); },
    // 로그인 상태
    session() { try { return JSON.parse(lsGet(SESS)) || {}; } catch (e) { return {}; } },
    setSession(o) { lsSet(SESS, JSON.stringify(o)); },
  });

  // 다른 창(탭)에서 저장하면 이 창 자료도 바로 바꿔, 오래된 자료로 덮어쓰지 않게 함
  try { window.addEventListener('storage', (e) => { if (e.key !== KEY || !e.newValue) return; try { const d = JSON.parse(e.newValue); if (S.valid(d)) { S.db = d; S.fix(); S._lastTxt = e.newValue; H.bus.emit('saved'); if (H.app && H.app.user && H.app.user()) H.app.render(); } } catch (err) { /* 무시 */ } }); } catch (e) { /* 무시 */ }

  // 아주 작은 알림 통로
  const ev = {};
  H.bus = {
    on(n, f) { (ev[n] = ev[n] || []).push(f); },
    emit(n, a) { (ev[n] || []).forEach((f) => { try { f(a); } catch (e) { console.error(e); } }); },
  };

  // 편의 함수
  H.recs = (pid, kind) => S.where('recs', (r) => r.patientId === pid && r.kind === kind).sort((a, b) => b.at - a.at);
  H.addRec = (kind, pid, data) => S.add('recs', Object.assign({ id: H.uid('rc'), kind, patientId: pid, at: Date.now(), by: H.who() }, data));
  // 병동 옮기기 (빈 침상 자동 배정)
  H.transfer = (enc, wardId, room) => {
    const w = H.M.ward(wardId);
    const rooms = room ? [room] : w.rooms;
    for (const r of rooms) for (let b = 1; b <= w.beds; b++) {
      if (!S.all('encounters').some((e) => e !== enc && e.ward === wardId && e.room === r && String(e.bed) === String(b) && ['입원중', '대기', '진료중'].includes(e.status))) {
        (enc.moves = enc.moves || []).push({ at: Date.now(), from: `${enc.ward} ${enc.room}-${enc.bed}`, to: `${wardId} ${r}-${b}` });
        enc.ward = wardId; enc.room = r; enc.bed = String(b);
        S.all('orders').forEach((o) => { if (o.encId === enc.id) o.ward = wardId; });
        S.save(); return true;
      }
    }
    return false;
  };
  H.pat = (id) => S.get('patients', id);
  H.enc = (id) => S.get('encounters', id);
  H.activeEnc = (pid, type) => S.all('encounters')
    .filter((e) => e.patientId === pid && (!type || e.type === type) && !['퇴원', '귀가', '진료완료', '전원', '취소'].includes(e.status))
    .sort((a, b) => b.at - a.at)[0];
})();
