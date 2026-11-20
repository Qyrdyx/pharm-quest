/* 药理闯关 · 处方书写练习的题目数据（俄罗斯通行的拉丁文处方写法）
 * 每条：中文 / 英文药名、拉丁文第一格（latN）和第二格（lat）、剂型、剂量、数量、用法（俄语 sig + 中英文说明）、
 * 用法（S.）现在用英文写：sigS / sigBadEn；俄语的 sig / sigBad 留着，以后做俄语版时把 games/rx.js 里的 RU 改成 true 就换成俄语。
 * sigBad = 一个和题目要求不符的用法（做干扰项）。
 * 剂量只用来练习书写格式，临床用量以讲义和说明书为准。
 * 剂型：tab 片剂 · caps 胶囊 · amp 安瓿注射液 · sol 瓶装溶液（外用）· ung 软膏 */
export const RX = [
  { zh: "阿莫西林", en: "Amoxicillin", latN: "Amoxicillinum", lat: "Amoxicillini", form: "tab", dose: "0,5", g: "0.5 g", n: 20, sig: "По 1 таблетке 3 раза в день", sigZh: "每次 1 片，每日 3 次", sigEn: "1 tablet 3 times a day", sigBad: "По 1 таблетке 2 раза в день", sigS: "Take 1 tablet 3 times a day", sigBadEn: "Take 1 tablet twice a day" },
  { zh: "甲硝唑", en: "Metronidazole", latN: "Metronidazolum", lat: "Metronidazoli", form: "tab", dose: "0,25", g: "0.25 g", n: 20, sig: "По 1 таблетке 3 раза в день после еды", sigZh: "每次 1 片，每日 3 次，饭后", sigEn: "1 tablet 3 times a day after meals", sigBad: "По 2 таблетки 3 раза в день после еды", sigS: "Take 1 tablet 3 times a day after meals", sigBadEn: "Take 2 tablets 3 times a day after meals" },
  { zh: "阿奇霉素", en: "Azithromycin", latN: "Azithromycinum", lat: "Azithromycini", form: "tab", dose: "0,5", g: "0.5 g", n: 3, sig: "По 1 таблетке 1 раз в день", sigZh: "每次 1 片，每日 1 次", sigEn: "1 tablet once a day", sigBad: "По 1 таблетке 3 раза в день", sigS: "Take 1 tablet once a day", sigBadEn: "Take 1 tablet 3 times a day" },
  { zh: "环丙沙星", en: "Ciprofloxacin", latN: "Ciprofloxacinum", lat: "Ciprofloxacini", form: "tab", dose: "0,5", g: "0.5 g", n: 10, sig: "По 1 таблетке 2 раза в день", sigZh: "每次 1 片，每日 2 次", sigEn: "1 tablet twice a day", sigBad: "По 1 таблетке 4 раза в день", sigS: "Take 1 tablet twice a day", sigBadEn: "Take 1 tablet 4 times a day" },
  { zh: "布洛芬", en: "Ibuprofen", latN: "Ibuprofenum", lat: "Ibuprofeni", form: "tab", dose: "0,4", g: "0.4 g", n: 20, sig: "По 1 таблетке 3 раза в день после еды", sigZh: "每次 1 片，每日 3 次，饭后", sigEn: "1 tablet 3 times a day after meals", sigBad: "По 1 таблетке 2 раза в день до еды", sigS: "Take 1 tablet 3 times a day after meals", sigBadEn: "Take 1 tablet twice a day before meals" },
  { zh: "对乙酰氨基酚", en: "Paracetamol", latN: "Paracetamolum", lat: "Paracetamoli", form: "tab", dose: "0,5", g: "0.5 g", n: 10, sig: "По 1 таблетке при боли, не более 4 раз в сутки", sigZh: "疼痛时 1 片，每日不超过 4 次", sigEn: "1 tablet for pain, no more than 4 times a day", sigBad: "По 2 таблетки при боли, не более 8 раз в сутки", sigS: "Take 1 tablet for pain, no more than 4 times a day", sigBadEn: "Take 2 tablets for pain, no more than 8 times a day" },
  { zh: "酮咯酸", en: "Ketorolac", latN: "Ketorolacum", lat: "Ketorolaci", form: "tab", dose: "0,01", g: "0.01 g（10 mg）", n: 10, sig: "По 1 таблетке при сильной боли, не более 4 раз в сутки", sigZh: "剧痛时 1 片，每日不超过 4 次", sigEn: "1 tablet for severe pain, no more than 4 times a day", sigBad: "По 1 таблетке каждый час", sigS: "Take 1 tablet for severe pain, no more than 4 times a day", sigBadEn: "Take 1 tablet every hour" },
  { zh: "双氯芬酸钠", en: "Diclofenac sodium", latN: "Diclofenacum natrium", lat: "Diclofenaci natrii", form: "tab", dose: "0,05", g: "0.05 g（50 mg）", n: 20, sig: "По 1 таблетке 2 раза в день после еды", sigZh: "每次 1 片，每日 2 次，饭后", sigEn: "1 tablet twice a day after meals", sigBad: "По 1 таблетке 4 раза в день натощак", sigS: "Take 1 tablet twice a day after meals", sigBadEn: "Take 1 tablet 4 times a day on an empty stomach" },
  { zh: "尼美舒利", en: "Nimesulide", latN: "Nimesulidum", lat: "Nimesulidi", form: "tab", dose: "0,1", g: "0.1 g", n: 20, sig: "По 1 таблетке 2 раза в день после еды", sigZh: "每次 1 片，每日 2 次，饭后", sigEn: "1 tablet twice a day after meals", sigBad: "По 1 таблетке 3 раза в день до еды", sigS: "Take 1 tablet twice a day after meals", sigBadEn: "Take 1 tablet 3 times a day before meals" },
  { zh: "制霉菌素", en: "Nystatin", latN: "Nystatinum", lat: "Nystatini", form: "tab", dose: "500 000 ЕД", doseEn: "500 000 IU", unit: true, g: "50 万单位", gEn: "500,000 units", n: 20, sig: "По 1 таблетке 4 раза в день", sigZh: "每次 1 片，每日 4 次", sigEn: "1 tablet 4 times a day", sigBad: "По 1 таблетке 1 раз в день", sigS: "Take 1 tablet 4 times a day", sigBadEn: "Take 1 tablet once a day" },
  { zh: "氯雷他定", en: "Loratadine", latN: "Loratadinum", lat: "Loratadini", form: "tab", dose: "0,01", g: "0.01 g（10 mg）", n: 10, sig: "По 1 таблетке 1 раз в день", sigZh: "每次 1 片，每日 1 次", sigEn: "1 tablet once a day", sigBad: "По 1 таблетке 3 раза в день", sigS: "Take 1 tablet once a day", sigBadEn: "Take 1 tablet 3 times a day" },
  { zh: "氯吡拉敏", en: "Chloropyramine", latN: "Chloropyraminum", lat: "Chloropyramini", form: "tab", dose: "0,025", g: "0.025 g（25 mg）", n: 20, sig: "По 1 таблетке 3 раза в день", sigZh: "每次 1 片，每日 3 次", sigEn: "1 tablet 3 times a day", sigBad: "По 1 таблетке 1 раз в неделю", sigS: "Take 1 tablet 3 times a day", sigBadEn: "Take 1 tablet once a week" },
  { zh: "克林霉素", en: "Clindamycin", latN: "Clindamycinum", lat: "Clindamycini", form: "caps", dose: "0,15", g: "0.15 g", n: 16, sig: "По 2 капсулы 4 раза в день", sigZh: "每次 2 粒，每日 4 次", sigEn: "2 capsules 4 times a day", sigBad: "По 1 капсуле 1 раз в день", sigS: "Take 2 capsules 4 times a day", sigBadEn: "Take 1 capsule once a day" },
  { zh: "多西环素", en: "Doxycycline", latN: "Doxycyclinum", lat: "Doxycyclini", form: "caps", dose: "0,1", g: "0.1 g", n: 10, sig: "По 1 капсуле 2 раза в день", sigZh: "每次 1 粒，每日 2 次", sigEn: "1 capsule twice a day", sigBad: "По 2 капсулы 4 раза в день", sigS: "Take 1 capsule twice a day", sigBadEn: "Take 2 capsules 4 times a day" },
  { zh: "氟康唑", en: "Fluconazole", latN: "Fluconazolum", lat: "Fluconazoli", form: "caps", dose: "0,15", g: "0.15 g", n: 1, sig: "1 капсулу однократно", sigZh: "单次服用 1 粒", sigEn: "1 capsule once (single dose)", sigBad: "По 1 капсуле 3 раза в день", sigS: "Take 1 capsule once (single dose)", sigBadEn: "Take 1 capsule 3 times a day" },
  { zh: "利多卡因", en: "Lidocaine", latN: "Lidocaini hydrochloridum", lat: "Lidocaini hydrochloridi", form: "amp", conc: "2%", vol: "2 ml", n: 10, sig: "Для инфильтрационной анестезии", sigZh: "浸润麻醉用", sigEn: "For infiltration anaesthesia", sigBad: "Принимать внутрь по 2 мл 3 раза в день", sigS: "For infiltration anaesthesia", sigBadEn: "Take 2 ml by mouth 3 times a day" },
  { zh: "普鲁卡因", en: "Procaine", latN: "Procainum", lat: "Procaini", form: "amp", conc: "0,5%", vol: "5 ml", n: 10, sig: "Для инфильтрационной анестезии", sigZh: "浸润麻醉用", sigEn: "For infiltration anaesthesia", sigBad: "Закапывать в нос по 2 капли", sigS: "For infiltration anaesthesia", sigBadEn: "Put 2 drops into the nose" },
  { zh: "地塞米松", en: "Dexamethasone", latN: "Dexamethasonum", lat: "Dexamethasoni", form: "amp", conc: "0,4%", vol: "1 ml", n: 10, sig: "Вводить внутримышечно по 1 мл 1 раз в день", sigZh: "肌内注射，每次 1 ml，每日 1 次", sigEn: "1 ml intramuscularly once a day", sigBad: "Вводить внутримышечно по 10 мл 3 раза в день", sigS: "Inject 1 ml intramuscularly once a day", sigBadEn: "Inject 10 ml intramuscularly 3 times a day" },
  { zh: "肾上腺素", en: "Epinephrine", latN: "Epinephrinum", lat: "Epinephrini", form: "amp", conc: "0,1%", vol: "1 ml", n: 5, sig: "При анафилактическом шоке вводить 0,5 мл внутримышечно", sigZh: "过敏性休克时肌内注射 0.5 ml", sigEn: "In anaphylactic shock inject 0.5 ml intramuscularly", sigBad: "Принимать внутрь по 1 ампуле 3 раза в день", sigS: "In anaphylactic shock inject 0.5 ml intramuscularly", sigBadEn: "Take 1 ampoule by mouth 3 times a day" },
  { zh: "氯化钠（生理盐水）", en: "Sodium chloride", latN: "Natrii chloridum", lat: "Natrii chloridi", form: "amp", conc: "0,9%", vol: "10 ml", n: 10, sig: "Для разведения препаратов", sigZh: "稀释药物用", sigEn: "For diluting drugs", sigBad: "Принимать внутрь по 1 столовой ложке", sigS: "For diluting drugs", sigBadEn: "Take 1 tablespoon by mouth" },
  { zh: "氯己定", en: "Chlorhexidine", latN: "Chlorhexidini bigluconas", lat: "Chlorhexidini bigluconatis", form: "sol", conc: "0,05%", vol: "100 ml", sig: "Для полоскания полости рта 2–3 раза в день", sigZh: "漱口，每日 2–3 次", sigEn: "Mouth rinse 2–3 times a day", sigBad: "Принимать внутрь по 1 столовой ложке 3 раза в день", sigS: "Rinse the mouth 2–3 times a day", sigBadEn: "Take 1 tablespoon by mouth 3 times a day" },
  { zh: "过氧化氢", en: "Hydrogen peroxide", latN: "Hydrogenii peroxydum", lat: "Hydrogenii peroxydi", form: "sol", conc: "3%", vol: "40 ml", sig: "Для обработки раны", sigZh: "处理伤口用", sigEn: "For wound cleansing", sigBad: "Принимать внутрь по 1 чайной ложке", sigS: "For wound cleansing", sigBadEn: "Take 1 teaspoon by mouth" },
  { zh: "碘酊（醇溶液）", en: "Iodine (alcoholic solution)", latN: "Iodum spirituosum", lat: "Iodi spirituosae", form: "sol", conc: "5%", vol: "10 ml", sig: "Для обработки краёв раны", sigZh: "涂抹伤口边缘用", sigEn: "For treating wound edges", sigBad: "Для полоскания полости рта 5 раз в день", sigS: "For treating wound edges", sigBadEn: "Rinse the mouth 5 times a day" },
  { zh: "阿昔洛韦", en: "Aciclovir", latN: "Aciclovirum", lat: "Acicloviri", form: "ung", conc: "5%", vol: "5,0", sig: "Наносить на поражённые участки 5 раз в день", sigZh: "涂患处，每日 5 次", sigEn: "Apply to affected areas 5 times a day", sigBad: "Принимать внутрь по 1 чайной ложке", sigS: "Apply to affected areas 5 times a day", sigBadEn: "Take 1 teaspoon by mouth" },
  { zh: "四环素", en: "Tetracycline", latN: "Tetracyclinum", lat: "Tetracyclini", form: "ung", conc: "3%", vol: "15,0", sig: "Наносить на поражённые участки 2 раза в день", sigZh: "涂患处，每日 2 次", sigEn: "Apply to affected areas twice a day", sigBad: "Наносить на поражённые участки 1 раз в месяц", sigS: "Apply to affected areas twice a day", sigBadEn: "Apply to affected areas once a month" },
];

/* 剂型：拉丁缩写、全称、中英文名、怎么装 */
export const RX_FORM = {
  tab: { ab: "Tab.", full: "Tabuletta", zh: "片", en: "tablets", dosed: true, cont: "" },
  caps: { ab: "Caps.", full: "Capsula", zh: "粒胶囊", en: "capsules", dosed: true, cont: "" },
  amp: { ab: "Sol.", full: "Solutio", zh: "支安瓿注射液", en: "ampoules of solution", dosed: true, cont: " in amp." },
  sol: { ab: "Sol.", full: "Solutio", zh: "溶液", en: "solution", dosed: false },
  ung: { ab: "Ung.", full: "Unguentum", zh: "软膏", en: "ointment", dosed: false },
};

/* 常用缩写 */
export const RX_ABBR = [
  ["Rp.:", "Recipe", "取（处方开头）", "Take (opens the prescription)"],
  ["D.", "Da", "给予", "Give"],
  ["t. d.", "tales doses", "这样的剂量", "such doses"],
  ["D. t. d. N. 20", "Da tales doses numero 20", "给予这样的剂量共 20 份（分剂量剂型）", "Give 20 such doses (dosed forms)"],
  ["S.", "Signa", "标明（用法，用患者看得懂的语言写）", "Label (directions, in the patient's language)"],
  ["D. S.", "Da. Signa.", "给予并标明（不分剂量的瓶装溶液、软膏）", "Give and label (bottled solutions, ointments)"],
  ["M. f.", "Misce, fiat", "混合，制成（复方 / 配制处方）", "Mix to make (compounded)"],
  ["Tab.", "Tabuletta", "片剂", "tablet"],
  ["Caps.", "Capsula", "胶囊", "capsule"],
  ["Sol.", "Solutio", "溶液", "solution"],
  ["Ung.", "Unguentum", "软膏", "ointment"],
  ["in amp.", "in ampullis", "装在安瓿里", "in ampoules"],
  ["IU", "international units", "国际单位（俄语处方里写 ЕД）", "international units (ЕД in Russian prescriptions)"],
];
