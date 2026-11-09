// 추가 실습 자료(9차): 지난 진료 이력 — 외래·응급·입원 30가지 사례, 가상 환자 약 70명 (모두 가상 인물)
// 모든 처방은 마지막 단계까지 끝나 있고, 결과·기록·수납(영수증)·예약까지 서로 연결됩니다.
// 영어 화면용 문구는 [한글, 영어]로 적어 H.I18N_PAIRS에 넣습니다.
(function () {
  const H = window.H;
  const HR = 3600000, DAY = 86400000, MIN = 60000;
  const PAIRS = (H.I18N_PAIRS = H.I18N_PAIRS || []);
  const T2 = (pair) => { if (Array.isArray(pair)) { if (pair[0] !== pair[1]) PAIRS.push(pair); return pair[0]; } return pair; };
  const tc = (nameOrCode) => { if (/^[A-Z]\d{4}$/.test(nameOrCode)) return nameOrCode; const it = H.M.ALL.find((x) => x.name === nameOrCode); if (!it) { console.error('seed9: 처방 항목 없음', nameOrCode); return null; } return it.code; };

  // 사례: t 구분, dr 의사, ward 병동, dx 진단 코드, cc 주호소, hx 과거력, ord 처방(이름 또는 번호), opdRx 원외 약, labs 결과값, rad 영상 소견, path 병리, soap, los 재원일수, n 환자 수, age 나이 범위, sex
  const CASES = [
    { t: 'OPD', dr: 'dr2', dx: ['I10', 'E78.5'], cc: ['혈압약 처방·정기 검사', 'Antihypertensive refill & routine labs'], hx: ['고혈압 8년, 고지혈증', 'Hypertension 8 yr, dyslipidemia'], ord: ['L1002', 'L1003', 'L1018', 'C7001'], opdRx: ['로사르탄정 100mg', '아토르바스타틴정 10mg'], labs: { LDL: 142, TC: 225 }, n: 3, age: [52, 78], chronic: true,
      soap: [['집에서 잰 혈압 135/85 정도, 두통 없음', 'Home BP about 135/85, no headache'], ['혈압 138/86, 맥박 72, 심전도 정상 동리듬', 'BP 138/86, HR 72, ECG normal sinus rhythm'], ['고혈압·고지혈증 — 조절 양호, LDL 조금 높음', 'HTN & dyslipidemia — fair control, LDL slightly high'], ['같은 약 3개월, 저염식·운동 교육, 3개월 뒤 재진', 'Same meds 3 months, low-salt diet & exercise, f/u 3 months']] },
    { t: 'OPD', dr: 'dr1', dx: ['E11.9'], cc: ['당뇨 정기 진료', 'Diabetes follow-up'], hx: ['2형 당뇨 6년, 메트포르민 복용', 'Type 2 DM 6 yr on metformin'], ord: ['L1005', 'L1006', 'L1003', '소변 미세알부민 (UACR)'], opdRx: ['메트포르민정 1000mg', '다파글리플로진정 10mg'], labs: { Glu: 156, A1c: 7.4, UACR: 42 }, n: 3, age: [45, 75], chronic: true,
      soap: [['식후 혈당 200 넘을 때 있음, 저혈당 없음', 'Postprandial glucose sometimes >200, no hypoglycemia'], ['체중 74kg, 발 감각 정상', 'Weight 74 kg, foot sensation normal'], ['2형 당뇨 — 당화혈색소 7.4%, 미세알부민뇨', 'Type 2 DM — HbA1c 7.4%, microalbuminuria'], ['SGLT2 억제제 추가, 3개월 뒤 재검', 'Add SGLT2 inhibitor, recheck in 3 months']] },
    { t: 'OPD', dr: 'dr13', dx: ['K21.9'], cc: ['가슴 쓰림·신물 올라옴 2개월', 'Heartburn & acid regurgitation 2 months'], hx: ['야식 습관, 음주 주 2회', 'Late-night eating, alcohol twice a week'], ord: ['E8101', '위 내시경 조직검사', 'L1001'], opdRx: ['에소메프라졸정 40mg', '모사프리드정 5mg'], n: 2, age: [35, 65],
      en: [['식도 하부 미란 (LA 분류 A), 위 전정부 발적 — 조직검사 1개', 'Distal esophageal erosion (LA grade A), antral erythema — 1 biopsy'], ['역류성 식도염 A등급, 표재성 위염', 'Reflux esophagitis grade A, superficial gastritis']], path: { dx: '만성 표재성 위염, 헬리코박터 음성' },
      soap: [['식후 가슴 쓰림, 누우면 심해짐', 'Heartburn after meals, worse lying down'], ['복부 압통 없음', 'No abdominal tenderness'], ['위식도 역류병', 'GERD'], ['양성자펌프억제제 8주, 야식·음주 줄이기', 'PPI 8 weeks, avoid late meals & alcohol']] },
    { t: 'OPD', dr: 'dr7', dx: ['M17.1'], cc: ['양쪽 무릎 통증 — 계단 내려갈 때', 'Both knee pain — going downstairs'], hx: ['무릎 관절염 3년', 'Knee osteoarthritis 3 yr'], ord: ['무릎 X선 (2방향)', '관절 천자·주사', '트리암시놀론 주사 (관절강) 40mg'], opdRx: ['셀레콕시브캡슐 200mg'], n: 3, age: [58, 80],
      rad: [['양쪽 무릎 안쪽 관절 간격 좁아짐, 골극 형성', 'Medial joint space narrowing both knees, osteophytes'], ['양쪽 무릎 골관절염 (켈그렌-로렌스 3등급)', 'Bilateral knee OA (Kellgren-Lawrence grade 3)']],
      soap: [['오래 걸으면 무릎이 붓고 아픔, 통증 6점', 'Knee swelling & pain after long walks, pain 6/10'], ['오른쪽 무릎 관절액 고임, 굽힘 120도', 'Right knee effusion, flexion 120°'], ['양쪽 무릎 골관절염', 'Bilateral knee osteoarthritis'], ['관절강 스테로이드 주사, 진통소염제 4주, 대퇴사두근 운동', 'Intra-articular steroid, NSAID 4 weeks, quadriceps exercise']] },
    { t: 'OPD', dr: 'dr1', dx: ['E03.9'], cc: ['피곤함·추위 탐', 'Fatigue & cold intolerance'], hx: ['갑상선 기능 저하증 2년', 'Hypothyroidism 2 yr'], ord: ['L1017', '유리 갑상선호르몬 (Free T4)'], opdRx: ['레보티록신정 100mcg'], labs: { TSH: 6.8, FT4: 0.88 }, n: 2, age: [30, 70], chronic: true,
      soap: [['요즘 더 피곤하고 체중 2kg 늘었음', 'More tired lately, gained 2 kg'], ['갑상선 커지지 않음, 맥박 62', 'No goiter, HR 62'], ['갑상선 기능 저하증 — 약 용량 부족', 'Hypothyroidism — under-replaced'], ['레보티록신 증량, 6주 뒤 TSH 재검', 'Increase levothyroxine, recheck TSH in 6 weeks']] },
    { t: 'OPD', dr: 'dr1', dx: ['J45.9'], cc: ['밤에 쌕쌕거림·기침', 'Nocturnal wheezing & cough'], hx: ['천식 (어릴 때), 알레르기 비염', 'Childhood asthma, allergic rhinitis'], ord: ['C7009', '호기 산화질소 측정 (FeNO)', 'R3001'], opdRx: ['부데소니드·포르모테롤 흡입제 160mcg', '몬테루카스트정 10mg'], n: 2, age: [20, 55],
      soap: [['일주일에 3번 밤에 깸, 운동하면 숨참', 'Wakes 3 nights/week, dyspnea on exercise'], ['호기 끝 쌕쌕거림, 산소포화도 97%', 'End-expiratory wheeze, SpO2 97%'], ['천식 — 조절 안 됨', 'Asthma — uncontrolled'], ['흡입 스테로이드·지속형 기관지 확장제, 흡입기 사용법 교육', 'ICS/LABA inhaler, inhaler technique education']] },
    { t: 'OPD', dr: 'dr4', dx: ['R51'], cc: ['한 달째 계속되는 두통', 'Headache for a month'], hx: ['특이 과거력 없음', 'No significant history'], ord: ['R3008'], opdRx: ['아세트아미노펜정 500mg'], n: 2, age: [25, 60],
      rad: [['뇌 실질에 확산 제한 병변 없음, 뇌실 크기 정상', 'No diffusion restriction, normal ventricles'], ['뇌 MRI 정상', 'Normal brain MRI']],
      soap: [['오후에 머리 조이는 듯한 통증, 구역 없음', 'Afternoon band-like headache, no nausea'], ['신경학적 검사 정상', 'Normal neurologic exam'], ['긴장형 두통', 'Tension-type headache'], ['진통제 필요시, 수면·자세 교정, 두통 일지', 'Analgesic PRN, sleep & posture, headache diary']] },
    { t: 'OPD', dr: 'dr9', dx: ['M51.2'], cc: ['허리 통증·왼쪽 다리 저림', 'Low back pain with left leg numbness'], hx: ['사무직, 2주 전 무거운 물건 듦', 'Office worker, lifted heavy object 2 weeks ago'], ord: ['요추 MRI'], opdRx: ['프레가발린캡슐 75mg', '에페리손정 50mg'], n: 2, age: [35, 65],
      rad: [['요추 4-5번 추간판이 왼쪽 뒤로 돌출, 왼쪽 L5 신경근 압박', 'L4-5 left posterolateral disc protrusion compressing left L5 root'], ['요추 4-5번 추간판 탈출증', 'L4-5 herniated disc']],
      soap: [['앉아 있으면 다리 저림 심해짐', 'Leg numbness worse when sitting'], ['하지 직거상 검사 왼쪽 45도 양성', 'Left straight-leg raise positive at 45°'], ['요추 추간판 탈출증 (L4-5)', 'Lumbar disc herniation (L4-5)'], ['약물·운동 치료 6주, 호전 없으면 신경 차단술', 'Meds & exercise 6 weeks, nerve block if no improvement']] },
    { t: 'OPD', dr: 'dr1', dx: ['Z00.0'], cc: ['종합 건강 검진', 'Comprehensive health check-up'], hx: ['특이 과거력 없음', 'No significant history'], ord: ['L1001', 'L1004', 'L1018', 'L1005', '갑상선 초음파', 'R3009', '저선량 흉부 CT (폐암 검진)', 'E8101'], n: 3, age: [40, 65],
      en: [['식도·위·십이지장 정상', 'Normal esophagus, stomach, duodenum'], ['정상 위내시경', 'Normal EGD']],
      soap: [['증상 없음, 흡연 20갑년', 'Asymptomatic, 20 pack-years'], ['검사 결과 대부분 정상', 'Most results normal'], ['건강 검진 — 특이 소견 없음', 'Health check — no significant findings'], ['1년 뒤 재검진, 금연 상담', 'Repeat in 1 year, smoking cessation counseling']] },
    { t: 'OPD', dr: 'dr10', dx: ['J06.9'], cc: ['열·콧물 2일 (소아)', 'Fever & rhinorrhea 2 days (child)'], hx: ['예방접종 모두 맞음', 'Vaccinations up to date'], ord: ['신속 인플루엔자 항원'], opdRx: ['아세트아미노펜시럽 5mL'], n: 3, age: [3, 9],
      soap: [['열 38.5℃, 콧물·기침, 잘 먹음', 'Fever 38.5°C, runny nose, cough, eating well'], ['인두 발적, 폐음 깨끗', 'Pharyngeal injection, clear lungs'], ['급성 상기도 감염 (인플루엔자 음성)', 'Acute URI (influenza negative)'], ['해열제 필요시, 수분 섭취, 3일 지나도 열 나면 재진', 'Antipyretic PRN, fluids, return if fever >3 days']] },
    { t: 'OPD', dr: 'dr8', dx: ['O24.4'], cc: ['임신 28주 정기 검진', 'Routine prenatal visit at 28 weeks'], hx: ['첫 임신, 임신성 당뇨 선별 양성', 'First pregnancy, positive GDM screen'], ord: ['산과 초음파 (태아)', 'L1005', 'L1001'], labs: { Glu: 148 }, n: 2, age: [28, 38], sex: 'F',
      rad: [['태아 1명, 머리 위치, 추정 체중 1,250g, 양수 정상', 'Single fetus, cephalic, EFW 1,250 g, normal fluid'], ['임신 28주에 맞는 정상 태아 성장', 'Normal fetal growth for 28 weeks']],
      soap: [['태동 잘 느낌, 부종 없음', 'Good fetal movement, no edema'], ['혈압 118/72, 자궁저부 높이 28cm', 'BP 118/72, fundal height 28 cm'], ['임신성 당뇨', 'Gestational diabetes'], ['영양 상담·혈당 자가 측정, 2주 뒤 재진', 'Nutrition counseling & SMBG, f/u 2 weeks']] },
    { t: 'OPD', dr: 'dr11', dx: ['N18.3', 'I10'], cc: ['콩팥 기능 정기 검사', 'Routine kidney function check'], hx: ['만성 콩팥병 3기, 고혈압', 'CKD stage 3, hypertension'], ord: ['L1003', 'L1002', '소변 단백/크레아티닌 비 (UPCR)', 'L1025'], opdRx: ['칼시트리올캡슐 0.25mcg', '올메사르탄정 20mg'], labs: { Cr: 1.7, BUN: 32, UPCR: 0.6, K: 5.0 }, n: 2, age: [55, 80], chronic: true,
      soap: [['소변 거품 조금, 부종 없음', 'Slightly foamy urine, no edema'], ['혈압 132/80', 'BP 132/80'], ['만성 콩팥병 3기 — 단백뇨', 'CKD stage 3 — proteinuria'], ['ARB 유지, 저염·저단백식 교육, 3개월 뒤 재검', 'Continue ARB, low-salt/low-protein diet, recheck 3 months']] },
    { t: 'OPD', dr: 'dr6', dx: ['N63'], cc: ['왼쪽 유방 멍울', 'Lump in left breast'], hx: ['어머니 유방암', 'Mother had breast cancer'], ord: ['R3010', 'R3011', '초음파 유도 유방 중심부 바늘생검', '유방 중심부 바늘생검 조직검사'], n: 2, age: [38, 60], sex: 'F',
      rad: [['왼쪽 유방 2시 방향 1.2cm 경계 좋은 타원형 저에코 결절', '1.2 cm well-circumscribed oval hypoechoic nodule, left breast 2 o’clock'], ['BI-RADS 4A — 조직검사 권고', 'BI-RADS 4A — biopsy recommended']], path: { dx: '섬유선종 (양성)' },
      soap: [['한 달 전 샤워하다 멍울 만져짐, 통증 없음', 'Felt a painless lump in the shower a month ago'], ['왼쪽 유방 2시 1cm 움직이는 멍울', 'Mobile 1 cm mass at left 2 o’clock'], ['유방 덩이 — 조직검사 결과 섬유선종', 'Breast mass — biopsy shows fibroadenoma'], ['6개월 뒤 초음파 추적', 'Follow-up ultrasound in 6 months']] },
    { t: 'OPD', dr: 'dr14', dx: ['Z51.1', 'C50.9'], cc: ['항암 주사 (외래 주사실)', 'Chemotherapy infusion (outpatient)'], hx: ['유방암 2기, 수술 후 보조 항암 3차', 'Breast cancer stage II, adjuvant chemo cycle 3'], ord: ['L1001', 'L1004', 'J0237', 'J0234', 'J0235'], labs: { WBC: 4.2, PLT: 210 }, n: 2, age: [40, 65], sex: 'F', special: true,
      soap: [['메스꺼움 2일, 입안 헐음 조금', 'Nausea 2 days, mild mouth sores'], ['백혈구 4,200, 혈소판 21만 — 항암 가능', 'WBC 4,200, PLT 210K — OK for chemo'], ['유방암 보조 항암 3차', 'Breast cancer adjuvant chemo cycle 3'], ['AC 항암 시행, 구토 예방약, 3주 뒤 4차', 'Give AC chemo with antiemetics, cycle 4 in 3 weeks']] },
    { t: 'OPD', dr: 'dr2', dx: ['I48.9'], cc: ['가슴 두근거림', 'Palpitations'], hx: ['고혈압', 'Hypertension'], ord: ['C7001', 'C7011', 'C7010'], opdRx: ['아픽사반정 5mg', '비소프롤롤정 2.5mg'], n: 2, age: [60, 82], chronic: true,
      soap: [['가끔 심장이 불규칙하게 빨리 뜀', 'Occasional irregular rapid heartbeat'], ['불규칙한 맥박 96, 심전도 심방세동', 'Irregular pulse 96, ECG atrial fibrillation'], ['심방세동 (CHA2DS2-VASc 3점)', 'Atrial fibrillation (CHA2DS2-VASc 3)'], ['항응고제·베타차단제 시작, 출혈 주의 교육', 'Start anticoagulant & beta-blocker, bleeding precautions']] },
    { t: 'ER', dr: 'dr5', dx: ['A09', 'E86'], ktas: 4, cc: ['설사·구토 하루', 'Diarrhea & vomiting for a day'], hx: ['어제 회 먹음', 'Ate raw fish yesterday'], ord: ['L1001', 'L1002', 'L1003', '하트만 용액 500mL', '메토클로프라미드 주사 5mg'], labs: { Na: 133, K: 3.3, BUN: 28 }, n: 3, age: [20, 70],
      soap: [['물설사 8번, 구토 3번', 'Watery diarrhea x8, vomiting x3'], ['입 마름, 맥박 108', 'Dry mucosa, HR 108'], ['감염성 위장염·탈수', 'Infectious gastroenteritis with dehydration'], ['수액·구토 억제제 후 호전 — 귀가, 수분 섭취 교육', 'Improved after IV fluids & antiemetic — discharge, hydration education']] },
    { t: 'ER', dr: 'dr5', dx: ['N20.0'], ktas: 3, cc: ['오른쪽 옆구리 극심한 통증', 'Severe right flank pain'], hx: ['요로결석 과거력', 'Prior kidney stone'], ord: ['요로결석 CT (조영제 없이)', 'L1019', '케토롤락 주사 15mg', 'L1003'], n: 2, age: [30, 60],
      rad: [['오른쪽 요관 하부 5mm 결석, 가벼운 수신증', '5 mm right distal ureteral stone, mild hydronephrosis'], ['오른쪽 요관 결석 (5mm)', 'Right ureteral stone (5 mm)']],
      soap: [['갑자기 시작된 옆구리 통증, 구역', 'Sudden flank pain with nausea'], ['오른쪽 늑골척추각 압통', 'Right CVA tenderness'], ['오른쪽 요관 결석', 'Right ureteral stone'], ['진통 후 귀가, 물 많이 마시기, 비뇨의학과 외래', 'Discharge after analgesia, increase fluids, urology clinic']] },
    { t: 'ER', dr: 'dr5', dx: ['S93.4'], ktas: 4, cc: ['발목 삠', 'Twisted ankle'], hx: ['없음', 'None'], ord: ['R3004', 'C7008', 'D0101'], n: 2, age: [15, 50],
      rad: [['골절 없음, 바깥 복사뼈 주위 연부조직 부종', 'No fracture, lateral malleolar soft-tissue swelling'], ['골절 없음', 'No fracture']],
      soap: [['계단에서 발목 안쪽으로 접질림', 'Inversion injury on stairs'], ['바깥 복사뼈 부종·압통', 'Lateral malleolus swelling & tenderness'], ['발목 염좌', 'Ankle sprain'], ['부목 고정, 냉찜질·거상, 정형외과 외래', 'Splint, ice & elevation, orthopedic clinic']] },
    { t: 'ER', dr: 'dr5', dx: ['T78.2'], ktas: 2, cc: ['새우 먹고 두드러기·숨참', 'Hives & dyspnea after eating shrimp'], hx: ['갑각류 알레르기 의심', 'Suspected shellfish allergy'], ord: ['J0243', '클로르페니라민 주사 4mg', '메틸프레드니솔론 주사 125mg', 'L1001'], n: 2, age: [18, 50], allergy: true,
      soap: [['식사 20분 뒤 온몸 두드러기, 목 조이는 느낌', 'Generalized hives 20 min after meal, throat tightness'], ['혈압 92/58, 쌕쌕거림', 'BP 92/58, wheezing'], ['아나필락시스 (갑각류)', 'Anaphylaxis (shellfish)'], ['에피네프린 근주 후 호전, 6시간 관찰 뒤 귀가, 자가주사기 교육', 'Improved after IM epinephrine, discharge after 6 h observation, auto-injector education']] },
    { t: 'IPD', dr: 'dr1', ward: '7A', dx: ['J18.9'], los: 6, cc: ['열·기침·누런 가래', 'Fever, cough, purulent sputum'], hx: ['고혈압', 'Hypertension'], ord: ['L1001', 'L1007', 'L1020', 'L1022', 'R3001', '세프트리악손 주사 2g', '아지트로마이신 주사 500mg', 'N5001', 'F6001'], labs: { WBC: 14.8, CRP: 9.2 }, n: 2, age: [60, 85], diet: '일반식',
      rad: [['오른쪽 아래 폐야 경화', 'Right lower lobe consolidation'], ['오른쪽 하엽 폐렴', 'Right lower lobe pneumonia']],
      soap: [['기침 줄고 열 내림', 'Less cough, afebrile'], ['체온 36.9, 오른쪽 아래 수포음 감소', 'T 36.9, decreased right basal crackles'], ['지역사회 획득 폐렴 — 호전', 'Community-acquired pneumonia — improving'], ['경구 항생제로 바꾸고 퇴원 준비', 'Switch to oral antibiotics, plan discharge']] },
    { t: 'IPD', dr: 'dr3', ward: '8B', dx: ['K81.0'], los: 4, cc: ['오른쪽 윗배 통증·열', 'RUQ pain & fever'], hx: ['담석', 'Gallstones'], ord: ['L1001', 'L1004', 'R3007', 'O9001', 'J0225', '담낭 절제조직 검사', 'F6006'], labs: { WBC: 13.2, TBil: 1.4 }, n: 2, age: [40, 75], diet: '금식 (NPO)', op: '전신마취',
      rad: [['담낭벽 두꺼워짐, 담낭 결석 여러 개, 주위 지방 침윤', 'Thickened GB wall, multiple stones, pericholecystic fat stranding'], ['급성 결석성 담낭염', 'Acute calculous cholecystitis']], path: { dx: '급성 및 만성 담낭염, 담석증' },
      soap: [['통증 2점, 가스 나옴', 'Pain 2/10, passing flatus'], ['상처 깨끗, 체온 정상', 'Wound clean, afebrile'], ['복강경 담낭절제술 후 2일 — 호전', 'POD 2 lap cholecystectomy — improving'], ['일반식 진행, 내일 퇴원', 'Advance diet, discharge tomorrow']] },
    { t: 'IPD', dr: 'dr3', ward: '8B', dx: ['K35.8'], los: 3, cc: ['오른쪽 아랫배 통증', 'RLQ pain'], hx: ['없음', 'None'], ord: ['L1001', 'L1007', 'R3007', 'O9003', 'J0201', '충수 절제조직 검사'], labs: { WBC: 15.1, CRP: 5.4 }, n: 2, age: [15, 45], diet: '일반식', op: '전신마취',
      rad: [['충수 직경 11mm, 주위 지방 침윤', 'Appendix 11 mm with periappendiceal stranding'], ['급성 충수염', 'Acute appendicitis']], path: { dx: '급성 화농성 충수염' },
      soap: [['통증 줄었음, 걷기 가능', 'Less pain, ambulating'], ['상처 깨끗', 'Wound clean'], ['복강경 충수절제술 후 — 호전', 'Post lap appendectomy — improving'], ['퇴원, 1주 뒤 외래 실밥 제거', 'Discharge, suture removal in 1 week']] },
    { t: 'IPD', dr: 'dr4', ward: '7A', dx: ['I63.9', 'I10'], los: 8, cc: ['오른쪽 팔다리 힘 빠짐·말 어눌함', 'Right-sided weakness & slurred speech'], hx: ['고혈압·흡연', 'Hypertension, smoker'], ord: ['R3005', 'R3008', '뇌혈관 MRA', 'L1018', 'D0103', 'D0109', '삼킴 재활 치료', 'N5014'], labs: { LDL: 168 }, n: 2, age: [60, 85], diet: '연하곤란식 (갈은 음식)',
      rad: [['왼쪽 중대뇌동맥 영역 급성 경색 (확산 제한)', 'Acute infarct in left MCA territory (diffusion restriction)'], ['왼쪽 중대뇌동맥 급성 뇌경색', 'Acute left MCA infarction']],
      soap: [['오른손 힘 조금 돌아옴, 삼킴 연습 중', 'Some right-hand strength returning, swallowing therapy'], ['오른쪽 근력 4/5, NIHSS 3점', 'Right motor 4/5, NIHSS 3'], ['급성 뇌경색 — 호전 중', 'Acute ischemic stroke — improving'], ['항혈소판제·스타틴 유지, 재활의학과 전원 검토', 'Continue antiplatelet & statin, consider rehab transfer']] },
    { t: 'IPD', dr: 'dr7', ward: '8B', dx: ['S72.0'], los: 10, cc: ['넘어진 뒤 왼쪽 엉덩이 통증·못 걸음', 'Left hip pain & unable to walk after fall'], hx: ['골다공증', 'Osteoporosis'], ord: ['고관절 X선 (2방향)', 'O9006', 'J0210', 'J0233', 'L1001', 'N5009'], labs: { Hb: 10.8 }, n: 2, age: [70, 90], diet: '일반식', op: '척추마취',
      rad: [['왼쪽 대퇴골 경부 전위 골절', 'Displaced left femoral neck fracture'], ['왼쪽 대퇴골 경부 골절', 'Left femoral neck fracture']],
      soap: [['보행기로 10m 걸음, 통증 3점', 'Walked 10 m with walker, pain 3/10'], ['상처 깨끗, 다리 길이 같음', 'Wound clean, equal leg length'], ['인공 고관절 치환술 후 — 재활 중', 'Post hip arthroplasty — rehabilitating'], ['혈전 예방 주사 유지, 낙상 예방 교육, 퇴원 계획', 'Continue DVT prophylaxis, fall prevention, discharge plan']] },
    { t: 'IPD', dr: 'dr2', ward: '7A', dx: ['I50.0'], los: 6, cc: ['숨참·다리 부종', 'Dyspnea & leg edema'], hx: ['심근경색 과거력, 고혈압', 'Prior MI, hypertension'], ord: ['L1013', 'R3001', 'C7010', 'J0205', 'L1002', 'N5013', 'N5015'], labs: { BNP: 1250, Na: 134 }, n: 2, age: [65, 88], diet: '저염식 (소금 6g 이하)',
      rad: [['심장 비대, 양쪽 흉수, 폐 울혈', 'Cardiomegaly, bilateral effusions, pulmonary congestion'], ['울혈성 심부전 소견', 'Findings of congestive heart failure']],
      soap: [['누워서 잘 수 있음, 체중 3kg 줄었음', 'Can lie flat, lost 3 kg'], ['부종 줄었음, 수포음 감소', 'Edema decreased, fewer crackles'], ['급성 악화 심부전 — 호전', 'Acute decompensated HF — improving'], ['경구 이뇨제로 바꾸고 퇴원 교육 (체중·염분)', 'Switch to oral diuretic, discharge education (weight, salt)']] },
    { t: 'IPD', dr: 'dr11', ward: '7A', dx: ['N10'], los: 5, cc: ['고열·옆구리 통증', 'High fever & flank pain'], hx: ['방광염 자주 걸림', 'Recurrent cystitis'], ord: ['L1019', 'L1021', 'L1020', 'J0201', 'L1001', 'L1007'], labs: { WBC: 16.2, CRP: 12.5 }, n: 2, age: [25, 70], sex: 'F', diet: '일반식',
      soap: [['열 내리고 옆구리 통증 줄었음', 'Afebrile, less flank pain'], ['늑골척추각 압통 약해짐', 'Mild CVA tenderness'], ['급성 신우신염 — 호전 (대장균, 세프트리악손 감수성)', 'Acute pyelonephritis — improving (E. coli, ceftriaxone-sensitive)'], ['경구 항생제로 바꿔 퇴원', 'Switch to oral antibiotics and discharge']] },
    { t: 'IPD', dr: 'dr3', ward: '8B', dx: ['C16.9'], los: 8, cc: ['위암 수술 입원', 'Admission for gastric cancer surgery'], hx: ['건강 검진 위내시경에서 위암 발견', 'Gastric cancer found on screening EGD'], ord: ['R3007', 'L1001', 'L1004', '복강경 위 부분절제술', 'P4005', 'J0225', 'F6003'], n: 2, age: [50, 75], diet: '미음 (유동식)', op: '전신마취', special: true,
      rad: [['위 전정부 벽 두꺼워짐, 림프절 커지지 않음, 원격 전이 없음', 'Antral wall thickening, no enlarged nodes, no distant metastasis'], ['조기 위암 의심 (전이 없음)', 'Suspected early gastric cancer (no metastasis)']], path: { dx: '위 선암 (중등도 분화), 점막하층 침범, 림프절 0/24 — pT1bN0' },
      soap: [['미음 잘 먹음, 통증 3점', 'Tolerating liquid diet, pain 3/10'], ['배액관 장액성 50mL', 'Drain serous 50 mL'], ['복강경 위 부분절제술 후 5일 — 순조', 'POD 5 lap distal gastrectomy — uneventful'], ['죽으로 진행, 덤핑 증후군 교육, 퇴원 준비', 'Advance to soft diet, dumping syndrome education, prepare discharge']] },
    { t: 'IPD', dr: 'dr7', ward: '8B', dx: ['M17.1'], los: 7, cc: ['무릎 인공관절 수술 입원', 'Admission for total knee arthroplasty'], hx: ['오른쪽 무릎 골관절염 10년, 주사 치료 효과 없음', 'Right knee OA 10 yr, failed injections'], ord: ['무릎 X선 (2방향)', '인공 슬관절 치환술', 'J0233', 'J0210', 'L1001', '물리 치료 (온열·전기)'], n: 2, age: [62, 82], diet: '일반식', op: '척추마취',
      soap: [['무릎 굽힘 90도, 보행기로 걸음', 'Knee flexion 90°, walking with walker'], ['상처 깨끗, 부종 경도', 'Wound clean, mild swelling'], ['인공 슬관절 치환술 후 — 재활 순조', 'Post TKA — rehab on track'], ['외래 재활 연계, 2주 뒤 실밥 제거', 'Outpatient rehab, suture removal in 2 weeks']] },
    { t: 'IPD', dr: 'dr1', ward: '7A', dx: ['J44.1'], los: 5, cc: ['숨참 악화·가래', 'Worsening dyspnea & sputum'], hx: ['COPD, 흡연 40갑년', 'COPD, 40 pack-years'], ord: ['L1015', 'R3001', '메틸프레드니솔론 주사 40mg', '살부타몰 흡입액 2.5mg', 'N5007', 'L1001'], labs: { pH: 7.33, pCO2: 52 }, n: 2, age: [62, 85], sex: 'M', diet: '일반식',
      soap: [['숨참 줄고 가래 맑아짐', 'Less dyspnea, clearer sputum'], ['산소 2L로 산소포화도 93%', 'SpO2 93% on 2 L O2'], ['COPD 급성 악화 — 호전', 'AECOPD — improving'], ['스테로이드 감량, 흡입기 교육, 금연 상담', 'Taper steroid, inhaler education, smoking cessation']] },
    { t: 'IPD', dr: 'dr13', ward: '7A', dx: ['K92.2', 'K25.9'], los: 5, cc: ['검은 변·어지러움', 'Black stools & dizziness'], hx: ['진통제 장기 복용', 'Long-term NSAID use'], ord: ['L1001', 'E8104', 'B8001', '에소메프라졸 주사 40mg', 'L1009', 'F6006'], labs: { Hb: 7.6 }, n: 2, age: [55, 85], diet: '금식 (NPO)',
      en: [['위 각부 1.5cm 궤양, 노출 혈관 — 클립 지혈', '1.5 cm gastric angle ulcer with visible vessel — clipped'], ['출혈성 위궤양 (Forrest IIa), 내시경 지혈 성공', 'Bleeding gastric ulcer (Forrest IIa), successful hemostasis']],
      soap: [['어지러움 없어짐, 검은 변 멈춤', 'No more dizziness, melena stopped'], ['혈색소 9.4 (수혈 2단위 후)', 'Hb 9.4 after 2 units'], ['출혈성 위궤양 — 지혈 후 안정', 'Bleeding gastric ulcer — stable after hemostasis'], ['미음 시작, 진통소염제 중단, 헬리코박터 검사', 'Start liquids, stop NSAIDs, test H. pylori']] },
  ];

  const SUR = '김이박최정강조윤장임한오서신권황안송류전홍고문손배백허유남심노하곽성차주우구민진지엄채원천방공현함변염양여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용';
  const GIV = { M: ['민준', '도현', '지호', '예준', '시우', '주원', '건우', '현우', '우진', '선우', '정우', '승현', '준혁', '은찬', '상철', '영호', '성수', '정호', '광수', '종훈', '병철', '재훈', '동욱', '기현', '진우', '형준', '석진', '태호', '용수', '만복'],
    F: ['서연', '하은', '수아', '지민', '서현', '하린', '채원', '지유', '윤서', '다은', '소율', '가윤', '예린', '수빈', '나연', '영숙', '정자', '순자', '영자', '옥순', '말순', '경자', '춘자', '정희', '미경', '혜진', '은정', '미영', '수진', '경희'] };
  const ADDR = [['서울시 가상구 푸른길 12', 'Virtual-gu, Seoul (12 Pureun-gil)'], ['서울시 가상구 강변로 45', 'Virtual-gu, Seoul (45 Gangbyeon-ro)'], ['경기도 가상시 큰길 8', 'Virtual-si, Gyeonggi (8 Keun-gil)'], ['경기도 가상시 시장로 33', 'Virtual-si, Gyeonggi (33 Sijang-ro)'], ['인천시 가상구 바닷길 20', 'Virtual-gu, Incheon (20 Badat-gil)'], ['서울시 가상구 학교길 7', 'Virtual-gu, Seoul (7 Hakgyo-gil)']];
  const INS = ['건강보험', '건강보험', '건강보험', '건강보험', '건강보험', '건강보험', '건강보험', '의료급여 1종', '의료급여 2종', '건강보험'];
  const BLOODS = ['A+', 'B+', 'O+', 'AB+', 'A+', 'O+', 'B+', 'A-'];
  const NN = [
    [['통증 2점, 편안해 보임. 침상 난간 올림, 호출벨 손 닿는 곳에 둠.', 'Pain 2/10, appears comfortable. Side rails up, call bell within reach.'], ['밤사이 잘 잠. 활력징후 안정.', 'Slept well overnight. Vital signs stable.'], ['보호자에게 낙상 예방 교육함. 이해했다고 말함.', 'Fall-prevention education given to family; verbalized understanding.']],
    [['퇴원 교육 (약 복용·외래 일정) 시행, 질문 없음.', 'Discharge teaching (meds, follow-up) done; no questions.'], ['식사 절반 정도 먹음, 구역 없음.', 'Ate about half of meal, no nausea.'], ['정맥 주사 부위 발적·부종 없음.', 'IV site without redness or swelling.']],
  ];
  const DOCS = H.M.DOCTORS;
  const ko = (x) => (Array.isArray(x) ? x[0] : x);
  // 영어 화면용 문구 등록 — 파일을 불러올 때 바로 (이미 9차 자료가 저장된 브라우저에서도 번역되도록)
  const DEPT_EN = { 내과: 'Internal Medicine', 순환기내과: 'Cardiology', 외과: 'General Surgery', 신경과: 'Neurology', 응급의학과: 'Emergency Medicine', 유방외과: 'Breast Surgery', 정형외과: 'Orthopedics', 산부인과: 'Obstetrics & Gynecology', 신경외과: 'Neurosurgery', 소아청소년과: 'Pediatrics', 신장내과: 'Nephrology', 마취통증의학과: 'Anesthesiology', 소화기내과: 'Gastroenterology', 혈액종양내과: 'Hematology-Oncology' };
  CASES.forEach((cs) => { [cs.cc, cs.hx, ...(cs.soap || []), ...(cs.rad || []), ...(cs.en || [])].forEach(T2); });
  ADDR.forEach(T2); NN.forEach((g) => g.forEach(T2));
  Object.entries(DEPT_EN).forEach(([d, e]) => T2([`#주 뒤 ${d} 외래`, `${e} clinic in # wk`]));
  const PATHDX = [['만성 표재성 위염, 헬리코박터 음성', 'Chronic superficial gastritis, H. pylori negative'], ['섬유선종 (양성)', 'Fibroadenoma (benign)'], ['급성 및 만성 담낭염, 담석증', 'Acute and chronic cholecystitis with cholelithiasis'], ['급성 화농성 충수염', 'Acute suppurative appendicitis'],
    ['위 선암 (중등도 분화), 점막하층 침범, 림프절 0/24 — pT1bN0', 'Gastric adenocarcinoma (moderately differentiated), submucosal invasion, nodes 0/24 — pT1bN0']];
  PATHDX.forEach(T2);
  [['특이 소견 없음', 'No significant findings'], ['정상 흉부 X선', 'Normal chest X-ray'], ['정상 범위', 'Within normal limits'], ['정상', 'Normal'], ['시행함 — 특이 합병증 없음', 'Done — no complications'], ['시행 완료', 'Completed'], ['보고서', 'Report'],
    ['정맥', 'IV'], ['근육', 'IM'], ['피하', 'SC'], ['혀 밑', 'SL'], ['흡입', 'Inhaled'], ['바르는 약', 'Topical'], ['사람', 'User'], ['부서', 'Department'], ['한 일', 'Action'], ['화면 열기', 'Open screen'], ['의료기관', 'Institution'],
    ['퇴원약 처방', 'Discharge medications prescribed'], ['호전', 'Improved'], ['합병증 없음', 'No complications'], ['외래 수납', 'Outpatient payment'], ['응급실 수납', 'ER payment'], ['퇴원 수납', 'Discharge payment'], ['지난 퇴원 환자 기록이 늘었습니다 — 퇴원분석·진료분석 실습 대상', 'More past discharge records — practice targets for discharge & coding analysis'],
    ['@ (환자 딸) · #xx', "@ (patient's daughter) · #xx"], ['@ (환자 아내) · #xx', "@ (patient's wife) · #xx"], ['갑각류 (새우·게)', 'Shellfish (shrimp, crab)'], ['두드러기·호흡곤란', 'Hives, dyspnea'], ['외래 간호사', 'Outpatient nurse'], ['주사실 간호사', 'Injection room nurse'], ['병리과 전문의 민서경', 'Pathologist 민서경']].forEach(T2);

  function phase9(db) {
    const now = Date.now(); const T = H.t; const uid = (p) => H.uid(p);
    let seed = 2026; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const used = new Set([...db.patients.map((p) => p.name), ...DOCS.map((d) => d.name), ...(db.staff || []).map((s) => s.name)]);
    const newName = (sex) => { for (let k = 0; k < 500; k++) { const gl = GIV[sex] || GIV.F; const g = gl[Math.floor(rnd() * gl.length)]; const n = SUR[Math.floor(rnd() * SUR.length)] + g; if (!used.has(n)) { used.add(n); return n; } } return '가상' + used.size; };
    const kcd = (c) => (H.M.KCD.find((k) => k.code === c) || { name: c }).name;
    const doc = (id) => DOCS.find((d) => d.id === id);
    const day0 = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const occupied = new Set(db.encounters.filter((e) => e.status === '입원중').map((e) => `${e.ward}|${e.room}|${e.bed}`));
    const bedFor = (wid) => { const w = H.M.ward(wid); for (const r of w.rooms) for (let b = 1; b <= w.beds; b++) { const k = `${wid}|${r}|${b}`; if (!occupied.has(k)) { occupied.add(k); return { room: r, bed: String(b) }; } } return { room: w.rooms[0], bed: '1' }; };

    const P = (o) => { db.seq.mrn += 7; o.id = uid('pt'); o.mrn = String(db.seq.mrn).padStart(8, '0'); o.allergies = o.allergies || []; o.flags = o.flags || {}; o.scenario = o.scenario || {}; db.patients.push(o); return o; };
    const E = (o) => { o.id = uid('en'); db.encounters.push(o); return o; };
    const O = (p, e, code, o = {}) => {
      const it = H.M.item(code); if (!it) return null; const at = o.at; const doctor = doc(e.doctorId);
      const ord = { id: uid('or'), encId: e.id, patientId: p.id, encType: e.type, cat: it.cat, code, name: it.name, dose: it.dose, unit: it.unit, route: it.route, freq: it.freq || 'ONCE', days: o.days || 1, prn: it.freq === 'PRN', stat: e.type === 'ER', outside: !!o.outside, otype: e.type === 'ER' ? '응급' : e.type === 'OPD' ? '외래' : '정규', note: '', at,
        by: `${doctor.name} (의사)`, doctorId: e.doctorId, nurseAck: true, ward: e.type === 'ER' ? 'ER' : e.ward || null, qty: o.qty || 1, hist: [{ s: '전송', at, by: '의사' }] };
      const steps = H.flow.steps(ord); const fin = o.status || steps[steps.length - 1];
      let t = at; steps.slice(1, steps.indexOf(fin) + 1).forEach((s) => { t += 20 * MIN; ord.hist.push({ s, at: t, by: '담당 부서' }); }); ord.status = fin;
      if (['MED', 'INJ', 'BLOOD'].includes(it.cat) && ['불출', '출고'].includes(fin)) ord.arrivedAt = t;
      if (it.cat === 'LAB' && fin === '결과보고') { ord.specimenAt = at + 10 * MIN; ord.result = { at: t, by: '진단검사의학과', verified: true, items: it.items.map((x) => { const v = String(H.sim.labValue(p, x)); const j = H.flow.judge(x, v); return { c: x.c, n: x.n, u: x.u, v, flag: j.flag, dir: j.dir, ref: x.text ? x.normal : `${x.lo ?? ''}~${x.hi ?? ''}` }; }) }; }
      if (it.cat === 'RAD' && fin === '판독완료') { const r = o.rad ? { findings: ko(o.rad[0]), impression: ko(o.rad[1]) } : H.sim.radReport(p, ord); ord.shotAt = at + 40 * MIN; ord.result = { at: t, by: '영상의학과 전문의 정다온', findings: r.findings, impression: r.impression }; }
      if (it.cat === 'PATH') ord.pathNo = `S${String(new Date(at).getFullYear()).slice(2)}-${String(db.orders.filter((x) => x.pathNo).length + 101).padStart(5, '0')}`;
      if (it.cat === 'PATH' && fin === '판독완료') ord.result =Object.assign({ at: t, by: '병리과 전문의 민서경' }, H.sim.pathReport(p), o.path || {});
      if (it.cat === 'PROC' && fin === '시행완료') ord.result = { at: t, by: it.room ? '기능검사실' : '담당 간호사', findings: '시행함 — 특이 합병증 없음', impression: it.room ? '정상 범위' : '시행 완료', room: it.room ? ({ ecg: '심전도실', echo: '심초음파실', pft: '폐기능검사실', neuro: '신경생리검사실' })[it.room] : undefined };
      if (it.cat === 'EN') { ord.en = { date: T.d(at), time: '10:00', room: '내시경실 1', sed: true }; ord.result = { at: t, by: `${doc('dr13').name} (의사)`, findings: o.en ? ko(o.en[0]) : '특이 소견 없음', impression: o.en ? ko(o.en[1]) : '정상' }; }
      if (it.cat === 'CV') ord.cv = { date: T.d(at), time: '14:00', room: '심혈관조영실 1', doctor: doc('dr2').name, access: '오른쪽 요골동맥' };
      if (it.cat === 'OP') ord.op = { anes: o.anes || it.anes, room: '3번방', date: T.d(at), surgeon: doctor.name, preop: { checks: ['수술·마취 동의서 서명 확인', '금식 확인', '수술 부위 표시'], by: '병동 간호사', at: at - HR }, done: true };
      ord.nurseSeen = true; ord.drSeen = true;
      if (o.done && (it.cat === 'MED' || it.cat === 'INJ')) ord.done = true; // 지난 진료의 약 — 지금 쓰는 약(중복 점검·투약 목록)에서 빠짐
      db.orders.push(ord);
      // 외래·응급 주사는 주사실·응급실에서 이미 맞은 것으로 투약 기록
      if (it.cat === 'INJ' && e.type !== 'IPD' && ord.arrivedAt) db.mar.push({ id: uid('ma'), orderId: ord.id, patientId: p.id, slot: ord.arrivedAt, status: '투약', at: ord.arrivedAt + 10 * MIN, by: e.type === 'ER' ? '응급실 간호사' : '주사실 간호사', checks: ['환자', '약', '용량', '경로', '시간'], double: !!it.highAlert });
      return ord;
    };
    const vit = (p, e, at, o = {}) => db.vitals.push(Object.assign({ id: uid('vs'), patientId: p.id, encId: e.id, at, by: e.type === 'OPD' ? '외래 간호사' : e.type === 'ER' ? '응급실 간호사' : '병동 간호사', sbp: ri(108, 142), dbp: ri(64, 88), hr: ri(64, 96), rr: ri(14, 20), bt: +(36.2 + rnd() * 0.9).toFixed(1), spo2: ri(95, 99), pain: ri(0, 3) }, o));
    const note = (p, e, type, at, content) => db.notes.push({ id: uid('no'), encId: e.id, patientId: p.id, type, at, by: `${doc(e.doctorId).name} (의사)`, signed: true, content });
    const bill = (e, at) => {
      const c = H.fee.calc(e); const no = `R${T.d(at).replace(/-/g, '').slice(2)}-${String(db.bills.length + 1).padStart(5, '0')}`;
      db.bills.push({ id: uid('bl'), no, encId: e.id, patientId: e.patientId, kind: e.type === 'IPD' ? '퇴원 수납' : e.type === 'ER' ? '응급실 수납' : '외래 수납', at, total: c.total, ins: c.ins, self: c.self, non: c.non, paid: c.due, method: pick(['신용카드', '신용카드', '현금', '계좌이체']), by: '원무과 직원', payer: c.r.payer, label: c.r.label, groups: c.groups });
      e.billed = at;
    };
    const apptTaken = new Set(db.appts.map((a) => `${a.doctorId}|${a.date}|${a.time}`));
    const appt = (p, cs, from) => { for (let k = 0; k < 30; k++) { const d = T.d(day0(from) + ri(14, 90) * DAY); const tm = `${String(ri(9, 16)).padStart(2, '0')}:${pick(['00', '30'])}`; const key = `${cs.dr}|${d}|${tm}`; if (new Date(d).getDay() % 6 === 0 || apptTaken.has(key)) continue; apptTaken.add(key);
      db.appts.push({ id: uid('ap'), pid: p.id, dept: doc(cs.dr).dept, doctorId: cs.dr, date: d, time: tm, status: '예약', at: from + 30 * MIN, by: '외래 간호사', kind: '진료', visit: '재진' }); return; } };

    CASES.forEach((cs) => {
      const codes = cs.ord.map(tc).filter(Boolean); const rx = (cs.opdRx || []).map(tc).filter(Boolean);
      const dx = cs.dx.map((c, i) => ({ code: c, name: kcd(c), main: i === 0 }));
      const sx = (s) => s.map((x) => x[0]);
      for (let k = 0; k < cs.n; k++) {
        const sex = cs.sex || (rnd() < 0.5 ? 'M' : 'F'); const age = ri(cs.age[0], cs.age[1]); const yr = new Date(now).getFullYear() - age;
        const name = newName(sex); const addr = pick(ADDR); T2(addr);
        const p = P({ name, sex, birth: `${yr}-${String(ri(1, 12)).padStart(2, '0')}-${String(ri(1, 28)).padStart(2, '0')}`, blood: pick(BLOODS), height: age < 12 ? ri(95, 140) : sex === 'M' ? ri(163, 182) : ri(150, 168), weight: age < 12 ? ri(14, 35) : sex === 'M' ? ri(58, 86) : ri(46, 70),
          ins: pick(INS), phone: `010-${ri(2000, 9899)}-${ri(10, 99)}xx`, address: addr[0], hx: cs.hx[0], scenario: { labs: Object.assign({}, cs.labs || {}) } });
        if (cs.special) p.special = { code: 'V193', name: '암 산정특례', at: now - 200 * DAY };
        if (cs.allergy) p.allergies = [{ name: '갑각류 (새우·게)', cls: 'food', reaction: '두드러기·호흡곤란' }];
        // 외래 만성 질환은 지난 방문(재진) 1번 더
        const visits = cs.t === 'OPD' && cs.chronic ? [ri(95, 150), ri(3, 40)] : [cs.t === 'IPD' ? ri(12, 120) : ri(2, 80)];
        // 입원 사례 가운데 일부는 지금 입원 중
        const current = cs.t === 'IPD' && k === 0 && ['7A', '8B'].includes(cs.ward) && CASES.indexOf(cs) % 3 === 0;
        visits.forEach((ago, vi) => {
          const at = current ? now - ri(2, 3) * DAY - ri(1, 6) * HR : day0(now - ago * DAY) + ri(9, 15) * HR + ri(0, 50) * MIN;
          const doctor = doc(cs.dr); const last = vi === visits.length - 1;
          if (cs.t === 'OPD') {
            const e = E({ patientId: p.id, type: 'OPD', dept: doctor.dept, doctorId: cs.dr, status: '진료완료', at, endAt: at + 40 * MIN, qno: ri(1, 30), visit: vi === 0 ? '초진' : '재진', cc: cs.cc[0], dx });
            vit(p, e, at - 10 * MIN);
            (last ? codes : codes.filter((c) => H.M.item(c).cat === 'LAB')).forEach((c, i) => { const it = H.M.item(c); O(p, e, c, { at: at + 15 * MIN + i * MIN, rad: it.cat === 'RAD' ? cs.rad : null, path: cs.path, en: cs.en, done: true }); });
            rx.forEach((c) => O(p, e, c, { at: at + 30 * MIN, outside: true, days: 30, qty: 30, done: true }));
            const sp = sx(cs.soap);
            note(p, e, vi === 0 ? '초진기록' : '재진기록', at + 35 * MIN, vi === 0 ? { cc: cs.cc[0], hpi: sp[0], pe: sp[1], assess: sp[2], plan: sp[3] } : { S: sp[0], O: sp[1], A: sp[2], P: sp[3] });
            bill(e, at + 2 * HR);
            if (last && cs.chronic) appt(p, cs, at);
          } else if (cs.t === 'ER') {
            const zone = pick(['A구역', 'B구역']);
            const e = E({ patientId: p.id, type: 'ER', dept: '응급의학과', doctorId: cs.dr, status: '귀가', at, endAt: at + (cs.ktas <= 2 ? 7 : 3) * HR, ward: 'ER', room: zone, bed: String(ri(1, 6)), ktas: cs.ktas, arrival: cs.ktas <= 2 ? '119 구급차' : '걸어서', cc: cs.cc[0], dx, dispo: '귀가' });
            vit(p, e, at + 5 * MIN, cs.ktas <= 2 ? { sbp: 92, dbp: 58, hr: 118, spo2: 93 } : { pain: ri(5, 8), hr: ri(90, 110) }); vit(p, e, at + 2 * HR);
            codes.forEach((c, i) => { const it = H.M.item(c); O(p, e, c, { at: at + 10 * MIN + i * MIN, rad: it.cat === 'RAD' ? cs.rad : null, done: true }); });
            const sp = sx(cs.soap); note(p, e, '경과기록', at + HR, { S: sp[0], O: sp[1], A: sp[2], P: sp[3] });
            bill(e, e.endAt + 20 * MIN);
          } else {
            const bed = current ? bedFor(cs.ward) : { room: pick(H.M.ward(cs.ward).rooms), bed: String(ri(1, 4)) };
            const endAt = current ? null : at + cs.los * DAY - ri(2, 6) * HR;
            const e = E({ patientId: p.id, type: 'IPD', dept: doctor.dept, doctorId: cs.dr, status: current ? '입원중' : '퇴원', at, ward: cs.ward, room: bed.room, bed: bed.bed, diet: cs.diet || '일반식', cc: cs.cc[0], dx });
            if (!current) { e.endAt = endAt; e.dc = { at: endAt - 6 * HR, by: `${doctor.name} (의사)`, date: T.d(endAt), form: '집으로', fu: `2주 뒤 ${doctor.dept} 외래`, ward: { at: endAt - 4 * HR, by: '병동 간호사' }, review: { at: endAt - 2 * HR, by: '보험심사 간호사' } }; }
            const span = (current ? now : endAt) - at;
            codes.forEach((c, i) => { const it = H.M.item(c); const oAt = at + (it.cat === 'OP' ? DAY : HR + i * 10 * MIN);
              const drug = it.cat === 'MED' || it.cat === 'INJ'; const days = drug ? Math.max(1, Math.min(cs.los - 1, 5)) : 1;
              const ord = O(p, e, c, { at: oAt, rad: it.cat === 'RAD' ? cs.rad : null, path: cs.path, en: cs.en, anes: cs.op, done: !current, days, qty: drug ? days * Math.max(1, (H.M.FREQ[it.freq] || {}).n || 1) : 1 });
              if (ord && drug) { const n = Math.min(4, ord.qty); for (let m = 0; m < n; m++) { const slot = ord.arrivedAt + (m + 1) * Math.floor(span / (n + 1)); db.mar.push({ id: uid('ma'), orderId: ord.id, patientId: p.id, slot, status: '투약', at: slot + 8 * MIN, by: '병동 간호사', checks: ['환자', '약', '용량', '경로', '시간'], double: !!it.highAlert }); } }
            });
            const nd = Math.max(2, Math.round(span / DAY));
            for (let d = 0; d < nd; d++) { vit(p, e, at + d * DAY + 2 * HR); if (d % 2 === 0) vit(p, e, at + d * DAY + 14 * HR); }
            for (let d = 0; d < Math.min(nd, 3); d++) { db.io.push({ id: uid('io'), patientId: p.id, at: at + d * DAY + 7 * HR, kind: 'in', type: '먹은 물·음식', amount: ri(800, 1500), by: '병동 간호사' }); db.io.push({ id: uid('io'), patientId: p.id, at: at + d * DAY + 7 * HR + 10 * MIN, kind: 'out', type: '소변', amount: ri(900, 1600), by: '병동 간호사' }); }
            db.assess.push({ id: uid('as'), patientId: p.id, kind: 'morse', score: age >= 70 ? 55 : 25, level: age >= 70 ? '고위험' : '저위험', at: at + 2 * HR, by: '병동 간호사', answers: {} });
            db.assess.push({ id: uid('as'), patientId: p.id, kind: 'braden', score: age >= 75 ? 14 : 19, level: age >= 75 ? '중등도 위험' : '위험 없음', at: at + 2 * HR, by: '병동 간호사', answers: {} });
            NN.forEach((grp, gi) => { const tx = grp[ri(0, grp.length - 1)]; T2(tx); db.nnotes.push({ id: uid('nn'), patientId: p.id, encId: e.id, at: at + (gi + 1) * Math.floor(span / 3), by: '병동 간호사', format: '서술', text: tx[0] }); });
            const sp = sx(cs.soap);
            note(p, e, '입원기록', at + 2 * HR, { cc: cs.cc[0], hpi: cs.hx[0], pe: sp[1], assess: dx.map((d, i) => `#${i + 1} ${d.name}`).join(' '), plan: sp[3] });
            if (cs.op) note(p, e, '수술기록', at + DAY + 3 * HR, { assess: dx[0].name, plan: cs.ord.map(tc).filter((c) => c && H.M.item(c).cat === 'OP').map((c) => H.M.item(c).name).join(', '), result: '합병증 없음' });
            note(p, e, '경과기록', at + Math.floor(span * 0.6), { S: sp[0], O: sp[1], A: sp[2], P: sp[3] });
            if (!current) { note(p, e, '퇴원요약', endAt - 5 * HR, { course: sp[2], result: '호전', meds: '퇴원약 처방', fu: e.dc.fu }); bill(e, endAt - HR); }
          }
        });
      }
    });
    db.notifs.push({ id: uid('nt'), to: 'mrd', text: '지난 퇴원 환자 기록이 늘었습니다 — 퇴원분석·진료분석 실습 대상', patientId: null, level: '', read: false, at: now - 30 * MIN });
  }

  H.seed.phase9 = phase9;
})();
