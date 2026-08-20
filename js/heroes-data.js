/* ============================================================================
 * 艾泽拉斯英雄志 · 英雄数据编撰（js/heroes-data.js）
 * ----------------------------------------------------------------------------
 * 本文件是整个站点的【唯一数据源】，由「数据编撰官」维护。
 * 以普通 <script> 标签最先引入（js/heroes-data.js → js/card-art.js → js/app.js），
 * 不使用 module，直接挂到 window 全局。
 *
 * 【数据契约】（三个 agent 并行协作的接口，改动前必须三方对齐）：
 *
 *   window.WOW_CLASS_INFO = {
 *     classKey: { zh: '中文职业名', en: 'English Class Name', color: '#RRGGBB' }
 *     // classKey ∈ warrior | paladin | mage | priest | druid | shaman |
 *     //              hunter | rogue | warlock | deathknight | demonhunter
 *     // color 采用魔兽世界官方职业色
 *   }
 *
 *   window.WOW_RARITY_INFO = {
 *     legendary: { zh: '传说', color: '#FF8000' },
 *     epic:      { zh: '史诗', color: '#A335EE' },
 *     rare:      { zh: '稀有', color: '#0070DD' }
 *   }
 *
 *   window.WOW_HEROES = [ 24 个英雄对象 ]，单个英雄字段：
 *     {
 *       id:      'jaina-proudmoore',          // 英文小写连字符，全站唯一
 *       name:    { zh: '吉安娜·普罗德摩尔', en: 'Jaina Proudmoore' },
 *       title:   { zh: '海军统帅',         en: 'Lord Admiral of Kul Tiras' },
 *       faction: 'alliance',                  // alliance | horde | neutral
 *       class:   'mage',                      // 见上方 classKey 白名单
 *       race:    { zh: '人类', en: 'Human' },
 *       rarity:  'legendary',                 // legendary | epic | rare
 *       sigil:   'tide',                      // 纹章键，见下方 SIGIL 白名单
 *       quote:   '……',                        // 中文台词，≤30 字
 *       lore:    '……',                        // 中文生平速写，60–100 字
 *       stats:   { might: 4, magic: 10, resolve: 8 },  // 各 1–10 整数
 *       fullArt: 'assets/portraits/full/xxx.png'       // 【可选】全幅场景插画路径；
 *                                                      // 填写且加载成功时，该英雄卡面走
 *                                                      // paintFaceFull 全幅管线（relief），
 *                                                      // 未填 / 加载失败自动回退常规
 *                                                      // 肖像窗 / sigil 路径（降级链不断）
 *       fullArtHeight: 'assets/portraits/full/xxx.png' // 【可选·伴生】AI 灰度高度图
 *                                                      // 路径，与 fullArt 搭配融合增强
 *                                                      // 画芯立体感；缺失自动略过
 *     }
 *
 *   sigil 合法键（20 个）：
 *     lion wolf frost moon leaf skull felflame hammer tide eye
 *     phoenix rune bow shadow sun axe light serpent storm book totem
 *
 * 【防御性说明】
 *   - 全部数据经 Object.freeze 深冻结，防止运行期被意外改写。
 *   - 文件尾部内置「自检器」：仅在数据违反契约时 console.warn 提示，
 *     绝不 throw，保证即使数据有瑕疵页面也能优雅降级、不白屏。
 * ============================================================================ */
(function (global) {
  'use strict';

  /* --------------------------------------------------------------------------
   * 一、职业信息 WOW_CLASS_INFO
   *    color 为魔兽世界官方职业色，用于卡面描边、标签与光效基调。
   * ------------------------------------------------------------------------ */
  var WOW_CLASS_INFO = {
    warrior:     { zh: '战士',     en: 'Warrior',      color: '#C79C6E' },
    paladin:     { zh: '圣骑士',   en: 'Paladin',      color: '#F58CBA' },
    mage:        { zh: '法师',     en: 'Mage',         color: '#69CCF0' },
    priest:      { zh: '牧师',     en: 'Priest',       color: '#F5F0E6' },
    druid:       { zh: '德鲁伊',   en: 'Druid',        color: '#FF7D0A' },
    shaman:      { zh: '萨满',     en: 'Shaman',       color: '#0070DE' },
    hunter:      { zh: '猎人',     en: 'Hunter',       color: '#ABD473' },
    rogue:       { zh: '潜行者',   en: 'Rogue',        color: '#FFF569' },
    warlock:     { zh: '术士',     en: 'Warlock',      color: '#9482C9' },
    deathknight: { zh: '死亡骑士', en: 'Death Knight', color: '#C41F3B' },
    demonhunter: { zh: '恶魔猎手', en: 'Demon Hunter', color: '#A330C9' }
  };

  /* --------------------------------------------------------------------------
   * 二、稀有度信息 WOW_RARITY_INFO
   *    采用魔兽官方物品品质配色：传说橙 / 史诗紫 / 稀有蓝。
   * ------------------------------------------------------------------------ */
  var WOW_RARITY_INFO = {
    legendary: { zh: '传说', color: '#FF8000' },
    epic:      { zh: '史诗', color: '#A335EE' },
    rare:      { zh: '稀有', color: '#0070DD' }
  };

  /* --------------------------------------------------------------------------
   * 三、英雄名录 WOW_HEROES（24 名）
   *    排序即展示顺序：帝王 6 → 将相 6 → 文人 5 → 奇士 6 → 李白（国风样板卡殿后）。
   *    23 位中国历史人物（国风扩展字段同 libai 样板）；quote 均为真实可查的诗文语录。
   * ------------------------------------------------------------------------ */
  var WOW_HEROES = [

    /* ======================== 帝王 EMPEROR（6） ======================== */

    {
      id: 'qinshihuang',
      name:  { zh: '秦始皇', en: 'Qin Shi Huang' },
      title: { zh: '千古一帝', en: 'The First Emperor' },
      faction: 'neutral',
      class: 'paladin',
      race:  { zh: '秦 · 帝王', en: 'Qin Emperor' },
      rarity: 'legendary',
      sigil: 'sun',
      theme: 'guofeng',
      dynasty: '秦',
      category: '帝',
      seal: '始皇帝',
      group: 'emperor',
      stops: [
        { place: '邯郸', x: 66, y: 8,  text: '前259年生于赵国邯郸，父异人质赵，母赵姬。幼历患难，九岁归秦，前246年十三岁即秦王位。' },
        { place: '咸阳', x: 30, y: 24, text: '前238年冠剑亲政，平嫪毐之乱，黜吕不韦；任用李斯、尉缭、王翦，运筹于咸阳宫阙，日夜谋灭诸侯。' },
        { place: '中原', x: 62, y: 42, text: '前230至前221年，十年间次第扫灭韩、赵、魏、楚、燕、齐，天下归一，定皇帝之号，分天下为三十六郡。' },
        { place: '泰山', x: 28, y: 60, text: '前219年东巡登泰山封禅，祭告天地受命；又遣方士徐福率童男女数千入海，求蓬莱仙药。' },
        { place: '琅琊', x: 64, y: 78, text: '前219年登琅琊台，大乐之，留三月；立石颂德：「六合之内，皇帝之土……人迹所至，无不臣者」。' },
        { place: '沙丘', x: 32, y: 92, text: '前210年第五次巡游，病崩于沙丘平台，年五十。赵高、李斯秘不发丧，矫诏立胡亥，赐死扶苏。' }
      ],
      quote: '六合之内，皇帝之土。',
      lore: '名嬴政，前259年生于邯郸，十三岁即秦王位。前238年亲政，前221年扫灭六国，建中国首个大一统王朝，自定尊号皇帝。废分封、行郡县，书同文、车同轨，筑长城、修驰道；晚年求仙，前210年崩于沙丘。',
      stats: { might: 9, magic: 4, resolve: 9 },
      fullArt: 'assets/portraits/full/qinshihuang-falang-full.png',
      fullArtHeight: 'assets/portraits/full/qinshihuang-falang-aiheight.png',
      goldLineParams: { decoInnerFrame: false }
    },

    {
      id: 'hanwudi',
      name:  { zh: '汉武帝', en: 'Emperor Wu of Han' },
      title: { zh: '雄才武帝', en: 'The Martial Emperor' },
      faction: 'neutral',
      class: 'paladin',
      race:  { zh: '汉 · 帝王', en: 'Han Emperor' },
      rarity: 'legendary',
      sigil: 'lion',
      theme: 'guofeng',
      dynasty: '漢',
      category: '帝',
      seal: '漢武',
      group: 'emperor',
      stops: [
        { place: '长安', x: 66, y: 8,  text: '前156年生于长安，前141年十六岁即帝位；建元新政，罢黜百家、表彰六经，始立太学。' },
        { place: '汾阴', x: 30, y: 24, text: '前113年东幸汾阴祠后土，泛楼船济汾河，秋风起兮作《秋风辞》：「欢乐极兮哀情多，少壮几时兮奈老何」。' },
        { place: '泰山', x: 62, y: 42, text: '前110年率十八万骑北巡朔方，登泰山封禅；是岁威震西域，破楼兰、车师，匈奴远遁。' },
        { place: '瓠子', x: 28, y: 60, text: '前109年亲临黄河瓠子决口，沉白马玉璧祭河，令群臣自将军以下皆负薪塞决，作《瓠子之歌》二章。' },
        { place: '甘泉', x: 64, y: 78, text: '晚年信用方士、海上求仙，巫蛊之祸起，太子刘据冤死；前89年下轮台诏罪己，罢黜方士，息兵养民。' },
        { place: '五柞宫', x: 32, y: 92, text: '后元二年（前87）崩于盩厔五柞宫，年七十，在位五十四年；葬茂陵，霍光受遗诏辅幼主昭帝。' }
      ],
      quote: '天马徕兮从西极，经万里兮归有德。',
      lore: '刘彻，前156年生，十六岁登基，在位五十四年。罢黜百家、独尊儒术，行推恩令以弱诸侯；北击匈奴、遣使通西域，开丝绸之路；南平百越，东定朝鲜。晚年下轮台诏罪己，前87年崩，葬茂陵。',
      stats: { might: 9, magic: 5, resolve: 8 },
      fullArt: 'assets/portraits/full/hanwudi-falang-full.png',
      fullArtHeight: 'assets/portraits/full/hanwudi-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 273, y: 253, r: 163 },
        decoInnerFrame: false
      }
    },

    {
      id: 'tangtaizong',
      name:  { zh: '唐太宗', en: 'Emperor Taizong of Tang' },
      title: { zh: '天可汗', en: 'The Heavenly Khan' },
      faction: 'neutral',
      class: 'paladin',
      race:  { zh: '唐 · 帝王', en: 'Tang Emperor' },
      rarity: 'legendary',
      sigil: 'phoenix',
      theme: 'guofeng',
      dynasty: '唐',
      category: '帝',
      seal: '天可汗',
      group: 'emperor',
      stops: [
        { place: '武功', x: 66, y: 8,  text: '隋开皇十八年（598）生于武功别馆；大业十一年（615）雁门献计救驾，十六岁崭露锋芒。' },
        { place: '晋阳', x: 30, y: 24, text: '大业十三年（617）劝父李渊起兵晋阳，西取关中；此后统兵四方，破薛举、刘武周、宋金刚。' },
        { place: '洛阳', x: 62, y: 42, text: '武德四年（621）虎牢关一战擒窦建德、迫降王世充，两河大定，功拜天策上将，开文学馆。' },
        { place: '长安', x: 28, y: 60, text: '武德九年（626）玄武门定难，旋登帝位；贞观年间从谏如流——魏徵卒，叹曰「以人为镜，可以明得失」。' },
        { place: '翠微宫', x: 64, y: 84, text: '贞观二十三年（649）崩于终南山翠微宫含风殿，年五十二；葬昭陵，四夷君长入朝者皆尊为「天可汗」。' }
      ],
      quote: '水能载舟，亦能覆舟。',
      lore: '李世民，598年生于武功。少年随父晋阳起兵，扫平群雄；626年玄武门之变后即位，改元贞观。虚怀纳谏、任人唯贤，轻徭薄赋、慎用刑罚，海内升平，四夷君长尊为「天可汗」。649年崩，葬昭陵。',
      stats: { might: 9, magic: 7, resolve: 10 },
      fullArt: 'assets/portraits/full/tangtaizong-falang-full.png',
      fullArtHeight: 'assets/portraits/full/tangtaizong-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 332, y: 220, r: 150 },
        decoInnerFrame: false
      }
    },

    {
      id: 'wuzetian',
      name:  { zh: '武则天', en: 'Wu Zetian' },
      title: { zh: '一代女皇', en: 'The Only Empress' },
      faction: 'neutral',
      class: 'paladin',
      race:  { zh: '周 · 帝王', en: 'Zhou Empress' },
      rarity: 'legendary',
      sigil: 'moon',
      theme: 'guofeng',
      dynasty: '周',
      category: '帝',
      seal: '女皇',
      group: 'emperor',
      stops: [
        { place: '文水', x: 66, y: 8,  text: '武德七年（624）生，祖籍并州文水；父武士彟从李渊起兵，官工部尚书，母杨氏出隋朝宗室。' },
        { place: '长安', x: 30, y: 24, text: '贞观十一年（637）十四岁入宫，为太宗才人，赐号武媚；太宗崩，依例入感业寺为尼。' },
        { place: '洛阳', x: 62, y: 42, text: '永徽六年（655）立为皇后，与高宗并称「二圣」；光宅元年（684）临朝称制，改东都洛阳为神都。' },
        { place: '明堂', x: 28, y: 60, text: '天授元年（690）革唐命，国号周，自名曌，登则天门楼即皇帝位；建明堂、铸天枢，开殿试武举。' },
        { place: '上阳宫', x: 64, y: 84, text: '神龙元年（705）张柬之等政变，传位中宗，徙居上阳宫；是年崩，年八十二，遗制祔葬乾陵，立无字碑。' }
      ],
      quote: '花须连夜发，莫待晓风吹。',
      lore: '武曌，624年生，并州文水人。十四岁入宫为太宗才人，高宗时立为皇后，并称「二圣」。690年革唐命建周称帝，为中国史上唯一女皇；创殿试、武举，知人善任。705年神龙政变退位，是年崩，遗制立无字碑。',
      stats: { might: 6, magic: 7, resolve: 10 },
      fullArt: 'assets/portraits/full/wuzetian-falang-full.png',
      fullArtHeight: 'assets/portraits/full/wuzetian-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 476, y: 450, r: 120 },
        decoInnerFrame: false
      }
    },

    {
      id: 'chengjisihan',
      name:  { zh: '成吉思汗', en: 'Genghis Khan' },
      title: { zh: '一代天骄', en: 'The Great Khan' },
      faction: 'neutral',
      class: 'paladin',
      race:  { zh: '元 · 帝王', en: 'Mongol Emperor' },
      rarity: 'legendary',
      sigil: 'storm',
      theme: 'guofeng',
      dynasty: '元',
      category: '帝',
      seal: '一代天驕',
      group: 'emperor',
      stops: [
        { place: '斡难河', x: 66, y: 8,  text: '1162年生于斡难河畔，父也速该为塔塔儿人所毒，部众离散，随母诃额仑采野果、钓河鱼度日。' },
        { place: '不儿罕山', x: 30, y: 24, text: '少年遭泰赤乌部追捕，锁枷示众，避入不儿罕山；历磨难得脱，迎娶孛儿帖，渐收旧部，雄姿初展。' },
        { place: '斡难河源', x: 62, y: 42, text: '1206年春诸部大会于斡难河源，建大蒙古国，上尊号「成吉思汗」；立千户制，颁《大札撒》。' },
        { place: '撒马尔罕', x: 28, y: 60, text: '1219年亲征花剌子模，次年克其新都撒马尔罕，兵锋西及里海、南抵印度河，欧亚震动。' },
        { place: '六盘山', x: 64, y: 84, text: '1227年围攻西夏，崩于六盘山清水行营，年六十六；临终定假道于宋、联宋灭金之策。' }
      ],
      quote: '一代天骄，成吉思汗，只识弯弓射大雕。',
      lore: '铁木真，1162年生于斡难河畔。幼年丧父，部众离散，历尽艰辛统一蒙古诸部；1206年即大汗位，号成吉思汗，颁《大札撒》。西征花剌子模，灭西辽、败西夏；1227年崩于六盘山，子孙建成横跨欧亚的大帝国。',
      stats: { might: 10, magic: 3, resolve: 9 },
      fullArt: 'assets/portraits/full/chengjisihan-falang-full.png',
      fullArtHeight: 'assets/portraits/full/chengjisihan-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 335, y: 222, r: 180 },
        decoInnerFrame: false
      }
    },

    {
      id: 'kangxi',
      name:  { zh: '康熙', en: 'Kangxi Emperor' },
      title: { zh: '仁皇帝', en: 'The Benevolent Emperor' },
      faction: 'neutral',
      class: 'paladin',
      race:  { zh: '清 · 帝王', en: 'Qing Emperor' },
      rarity: 'legendary',
      sigil: 'book',
      theme: 'guofeng',
      dynasty: '清',
      category: '帝',
      seal: '聖祖',
      group: 'emperor',
      stops: [
        { place: '紫禁城', x: 66, y: 8,  text: '顺治十一年（1654）生于紫禁城景仁宫；八岁即位，康熙八年（1669）以布库少年智擒鳌拜。' },
        { place: '江南', x: 30, y: 24, text: '康熙二十三年（1684）首次南巡，阅黄淮河工，谒明孝陵行三跪九叩礼；一生六次南巡，察吏安民。' },
        { place: '多伦', x: 62, y: 42, text: '康熙三十年（1691）亲赴多伦诺尔会盟，喀尔喀三部来归——「众志成城」，长城自此为腹地。' },
        { place: '克鲁伦河', x: 28, y: 60, text: '康熙三十五年（1696）亲征噶尔丹，中路大军直抵克鲁伦河；昭莫多一战，准部溃散。' },
        { place: '热河', x: 64, y: 78, text: '康熙四十二年（1703）始建热河避暑山庄，岁巡木兰秋狝，行围习武，抚绥蒙古诸部。' },
        { place: '畅春园', x: 32, y: 92, text: '康熙六十一年（1722）崩于畅春园清溪书屋，年六十九，在位六十一年；庙号圣祖，葬景陵。' }
      ],
      quote: '民为邦本，本固邦宁。',
      lore: '爱新觉罗·玄烨，1654年生，八岁即位，十四岁亲政。智擒鳌拜，平三藩、收台湾，败沙俄于雅克萨、订《尼布楚条约》，三征噶尔丹；崇儒重学，敕编《康熙字典》。在位六十一年，1722年崩，庙号圣祖。',
      stats: { might: 7, magic: 8, resolve: 10 },
      fullArt: 'assets/portraits/full/kangxi-falang-full.png',
      fullArtHeight: 'assets/portraits/full/kangxi-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 188, y: 640, r: 90 },
        decoInnerFrame: false
      }
    },

    /* ======================== 将相 GENERAL（6） ======================== */

    {
      id: 'zhugeliang',
      name:  { zh: '诸葛亮', en: 'Zhu Geliang' },
      title: { zh: '卧龙', en: 'The Crouching Dragon' },
      faction: 'neutral',
      class: 'mage',
      race:  { zh: '蜀 · 丞相', en: 'Shu Chancellor' },
      rarity: 'legendary',
      sigil: 'rune',
      theme: 'guofeng',
      dynasty: '蜀',
      category: '相',
      seal: '臥龍',
      group: 'general',
      stops: [
        { place: '琅琊', x: 66, y: 8,  text: '光和四年（181）生于琅琊阳都；早孤，随叔父玄避乱荆州，隐于隆中，自比管仲、乐毅。' },
        { place: '隆中', x: 30, y: 24, text: '建安十二年（207），屯兵新野的刘备三顾草庐，问以天下；亮陈《隆中对》，定三分之策——「非惟天时，抑亦人谋也」。' },
        { place: '赤壁', x: 62, y: 42, text: '建安十三年（208）出使柴桑，说孙权联刘抗曹；赤壁火攻大破曹军，曹操败走华容，三分之势遂成。' },
        { place: '成都', x: 28, y: 60, text: '章武三年（223）白帝受托孤，辅佐后主，开府治蜀；南征七擒孟获，奖农桑、修法度，吏不容奸。' },
        { place: '五丈原', x: 64, y: 84, text: '建兴十二年（234）驻军五丈原，与司马懿相持百日，秋八月积劳成疾卒于军中，年五十四。' }
      ],
      quote: '鞠躬尽瘁，死而后已。',
      lore: '字孔明，琅琊阳都人，181年生。隐居隆中，207年刘备三顾茅庐，纵论三分。佐备取荆益、建蜀汉，拜丞相；受托孤辅后主，南平孟获，五次北伐。234年秋星落五丈原，年五十四，谥忠武侯，葬定军山。',
      stats: { might: 5, magic: 10, resolve: 9 },
      fullArt: 'assets/portraits/full/zhugeliang-falang-full.png',
      fullArtHeight: 'assets/portraits/full/zhugeliang-falang-aiheight.png',
      goldLineParams: { decoInnerFrame: false }
    },

    {
      id: 'yuefei',
      name:  { zh: '岳飞', en: 'Yue Fei' },
      title: { zh: '精忠报国', en: 'Loyalty to the Nation' },
      faction: 'neutral',
      class: 'warrior',
      race:  { zh: '宋 · 名将', en: 'Song General' },
      rarity: 'legendary',
      sigil: 'axe',
      theme: 'guofeng',
      dynasty: '宋',
      category: '將',
      seal: '岳武穆',
      group: 'general',
      stops: [
        { place: '汤阴', x: 66, y: 8,  text: '崇宁二年（1103）生于相州汤阴农家；母姚氏刺「尽忠报国」四字于背，习骑射，能挽弓三百斤。' },
        { place: '建康', x: 30, y: 24, text: '建炎四年（1130）清水亭设伏大捷，收复建康；此后转战江淮，「岳家军」旗号始震天下。' },
        { place: '郾城', x: 62, y: 42, text: '绍兴十年（1140）郾城、颍昌连捷，步卒麻扎刀破铁浮屠、拐子马——金人叹「撼山易，撼岳家军难」。' },
        { place: '朱仙镇', x: 28, y: 60, text: '七月兵抵朱仙镇，距汴京仅四十五里；一日连奉十二道金牌班师，飞愤惋泣下：「十年之功，废于一旦」。' },
        { place: '风波亭', x: 64, y: 84, text: '绍兴十一年腊月廿九（1142年1月），以「莫须有」三字狱遇害于临安风波亭，年三十九。' }
      ],
      quote: '待从头，收拾旧山河，朝天阙。',
      lore: '字鹏举，相州汤阴人，1103年生，母刺「尽忠报国」于背。建岳家军，号令严明，冻死不拆屋、饿死不掳掠；绍兴十年北伐，郾城、颍昌大捷，直抵朱仙镇。1142年以「莫须有」遇害风波亭，年三十九，谥武穆。',
      stats: { might: 10, magic: 4, resolve: 10 },
      fullArt: 'assets/portraits/full/yuefei-falang-full.png',
      fullArtHeight: 'assets/portraits/full/yuefei-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 331, y: 217, r: 204 },
        decoInnerFrame: false
      }
    },

    {
      id: 'hanxin',
      name:  { zh: '韩信', en: 'Han Xin' },
      title: { zh: '兵仙', en: 'The Immortal of War' },
      faction: 'neutral',
      class: 'warrior',
      race:  { zh: '汉 · 名将', en: 'Han General' },
      rarity: 'legendary',
      sigil: 'bow',
      theme: 'guofeng',
      dynasty: '漢',
      category: '將',
      seal: '兵仙',
      group: 'general',
      stops: [
        { place: '淮阴', x: 66, y: 8,  text: '少时家贫淮阴，钓于城下，漂母饭之数十日；屠中少年令其出胯下，信俯身受之，一市皆笑。' },
        { place: '汉中', x: 30, y: 24, text: '前206年亡楚归汉，萧何月下追信；刘邦择日斋戒设坛场，拜为大将军，献「汉中对策」。' },
        { place: '井陉', x: 62, y: 42, text: '前204年率新兵数万东出井陉，背水列阵，拔帜易帜，大破赵军二十万，斩陈馀、擒赵歇。' },
        { place: '垓下', x: 28, y: 60, text: '前202年会诸侯兵于垓下，十面埋伏；夜闻四面楚歌，项羽突围，自刎乌江，楚汉之争遂定。' },
        { place: '长乐宫', x: 64, y: 84, text: '前201年贬淮阴侯，居常怏怏；前196年吕后使萧何绐之，斩于长乐宫钟室——「飞鸟尽，良弓藏」。' }
      ],
      quote: '韩信将兵，多多益善。',
      lore: '淮阴人，早年落魄，受胯下之辱。亡楚归汉，萧何力荐，拜大将；明修栈道、暗度陈仓，破魏、下赵、降燕、定齐，垓下十面埋伏灭项羽，为汉初三杰。前196年以谋反罪被诛于长乐宫，夷三族。',
      stats: { might: 10, magic: 7, resolve: 6 },
      fullArt: 'assets/portraits/full/hanxin-falang-full.png',
      fullArtHeight: 'assets/portraits/full/hanxin-falang-aiheight.png',
      goldLineParams: { decoInnerFrame: false }
    },

    {
      id: 'huamulan',
      name:  { zh: '花木兰', en: 'Hua Mulan' },
      title: { zh: '巾帼英雄', en: 'The Heroine' },
      faction: 'neutral',
      class: 'warrior',
      race:  { zh: '魏 · 巾帼', en: 'Northern Wei Heroine' },
      rarity: 'legendary',
      sigil: 'leaf',
      theme: 'guofeng',
      dynasty: '魏',
      category: '將',
      seal: '木蘭',
      group: 'general',
      stops: [
        { place: '故乡', x: 66, y: 8,  text: '北朝乱世，可汗大点兵，军书十二卷、卷卷有爷名；「阿爷无大儿，木兰无长兄」，愿为市鞍马。' },
        { place: '黄河', x: 30, y: 24, text: '东市买骏马，西市买鞍鞯；旦辞爷娘去，暮宿黄河边，不闻爷娘唤女声，但闻黄河流水鸣溅溅。' },
        { place: '燕山', x: 62, y: 42, text: '旦辞黄河去，暮至黑山头，但闻燕山胡骑鸣啾啾；万里赴戎机，关山度若飞，将军百战死，壮士十年归。' },
        { place: '明堂', x: 28, y: 60, text: '归来见天子，天子坐明堂；策勋十二转，赏赐百千强——木兰不用尚书郎，愿驰千里足，送儿还故乡。' },
        { place: '故乡', x: 64, y: 84, text: '脱我战时袍，著我旧时裳；当窗理云鬓，对镜帖花黄——「同行十二年，不知木兰是女郎」。' }
      ],
      quote: '朔气传金柝，寒光照铁衣。',
      lore: '北朝民歌《木兰诗》中的巾帼英雄。可汗大点兵，父老弟幼，木兰市鞍马、代父从军，女扮男装转战十二载；凯旋归朝，辞尚书郎不受，「愿驰千里足，送儿还故乡」。其事真伪无考，其志千古共仰。',
      stats: { might: 8, magic: 3, resolve: 9 },
      fullArt: 'assets/portraits/full/huamulan-falang-full.png',
      fullArtHeight: 'assets/portraits/full/huamulan-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 232, y: 180, r: 185 },
        decoInnerFrame: false
      }
    },

    {
      id: 'qijiguang',
      name:  { zh: '戚继光', en: 'Qi Jiguang' },
      title: { zh: '抗倭名将', en: 'The Anti-Wokou General' },
      faction: 'neutral',
      class: 'warrior',
      race:  { zh: '明 · 名将', en: 'Ming General' },
      rarity: 'legendary',
      sigil: 'tide',
      theme: 'guofeng',
      dynasty: '明',
      category: '將',
      seal: '戚少保',
      group: 'general',
      stops: [
        { place: '登州', x: 66, y: 8,  text: '嘉靖七年（1528）生于登州将门，世袭登州卫指挥佥事；少年袭职，折节读书，请缨备倭。' },
        { place: '义乌', x: 30, y: 24, text: '嘉靖三十八年（1559）赴义乌募矿工农民三千，严加训练，号「戚家军」；创鸳鸯阵，长短相卫。' },
        { place: '台州', x: 62, y: 42, text: '嘉靖四十年（1561）倭寇大举犯浙，转战台州九战九捷，浙东悉平——「封侯非我意，但愿海波平」。' },
        { place: '蓟州', x: 28, y: 60, text: '隆庆二年（1568）调镇蓟门，总理练兵；修空心敌台千余座，车步骑营协同，守边十六载，敌不敢犯。' },
        { place: '蓬莱', x: 64, y: 84, text: '万历十五年（1588）罢官归乡，病逝于蓬莱，年六十一；所遗《纪效新书》《练兵实纪》为后世兵家圭臬。' }
      ],
      quote: '封侯非我意，但愿海波平。',
      lore: '字元敬，登州人，1528年生，世袭登州卫指挥佥事。嘉靖间倭患猖獗，募义乌兵练戚家军，创鸳鸯阵，台州九战九捷，荡平东南；后镇蓟门十六载，修长城敌台。著《纪效新书》《练兵实纪》，1588年卒。',
      stats: { might: 9, magic: 5, resolve: 9 },
      fullArt: 'assets/portraits/full/qijiguang-falang-full.png',
      fullArtHeight: 'assets/portraits/full/qijiguang-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 45, y: 145, r: 90 },
        decoInnerFrame: false
      }
    },

    {
      id: 'wentianxiang',
      name:  { zh: '文天祥', en: 'Wen Tianxiang' },
      title: { zh: '丹心照汗青', en: 'A Loyal Heart Through Ages' },
      faction: 'neutral',
      class: 'paladin',
      race:  { zh: '宋 · 忠臣', en: 'Song Loyalist' },
      rarity: 'legendary',
      sigil: 'light',
      theme: 'guofeng',
      dynasty: '宋',
      category: '臣',
      seal: '正氣',
      group: 'general',
      stops: [
        { place: '庐陵', x: 66, y: 8,  text: '端平三年（1236）生于吉州庐陵；宝祐四年（1256）殿试第一，理宗亲擢状元，年方二十一。' },
        { place: '临安', x: 30, y: 24, text: '德祐元年（1275）元兵南下，诏天下勤王；天祥尽以家资为军费，举义兵万人卫临安。' },
        { place: '五坡岭', x: 62, y: 42, text: '祥兴元年（1278）兵败五坡岭被俘，吞冰片不死；过零丁洋，书「人生自古谁无死，留取丹心照汗青」。' },
        { place: '大都', x: 28, y: 60, text: '囚大都兵马司土室三年，作《正气歌》——「天地有正气，杂然赋流形」；忽必烈亲劝，终不屈。' },
        { place: '柴市', x: 64, y: 84, text: '至元十九年十二月初九（1283年1月），就义于柴市，南向再拜，年四十七；衣带赞曰「孔曰成仁，孟曰取义」。' }
      ],
      quote: '人生自古谁无死，留取丹心照汗青。',
      lore: '字宋瑞，吉州庐陵人，1236年生，宝祐四年状元。元兵南下，毁家纾难，起兵勤王；兵败被俘，囚大都三年，拒忽必烈亲劝，1283年就义柴市，衣带留赞「孔曰成仁，孟曰取义」，年四十七。',
      stats: { might: 6, magic: 7, resolve: 10 },
      fullArt: 'assets/portraits/full/wentianxiang-falang-full.png',
      fullArtHeight: 'assets/portraits/full/wentianxiang-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 319, y: 188, r: 206 },
        decoInnerFrame: false
      }
    },

    /* ======================== 文人 LITERATI（5） ======================== */

    {
      id: 'dufu',
      name:  { zh: '杜甫', en: 'Du Fu' },
      title: { zh: '诗圣', en: 'The Sage of Poetry' },
      faction: 'neutral',
      class: 'priest',
      race:  { zh: '唐 · 诗人', en: 'Tang Poet' },
      rarity: 'legendary',
      sigil: 'book',
      theme: 'guofeng',
      dynasty: '唐',
      category: '詩',
      seal: '詩聖',
      group: 'literati',
      stops: [
        { place: '巩县', x: 66, y: 8,  text: '先天元年（712）生于河南巩县；七岁咏凤凰，九岁书大字，自谓「读书破万卷，下笔如有神」。' },
        { place: '泰山', x: 30, y: 24, text: '开元二十四年（736）漫游齐赵，望泰岳而作《望岳》——「会当凌绝顶，一览众山小」，气象自是不凡。' },
        { place: '长安', x: 62, y: 42, text: '天宝年间困守长安十载，「朝扣富儿门，暮随肥马尘」；安史乱起陷贼，冒死西窜行在，拜左拾遗。' },
        { place: '成都', x: 28, y: 60, text: '乾元二年（759）弃官携家入蜀，筑草堂于浣花溪畔；茅屋为秋风所破，犹愿「大庇天下寒士俱欢颜」。' },
        { place: '湘江', x: 64, y: 84, text: '大历五年（770）漂泊荆湘，贫病交迫，卒于潭州至岳阳舟中，年五十九；遗稿千四百余篇，光焰万丈。' }
      ],
      quote: '会当凌绝顶，一览众山小。',
      lore: '字子美，712年生于巩县。壮游齐赵吴越，困守长安十年；安史乱中颠沛，授左拾遗，旋弃官入蜀，筑草堂于浣花溪。晚岁漂泊荆湘，770年卒于湘江舟中。其诗沉郁顿挫，忧民伤时，世称「诗史」，尊为「诗圣」。',
      stats: { might: 3, magic: 10, resolve: 9 },
      fullArt: 'assets/portraits/full/dufu-falang-full.png',
      fullArtHeight: 'assets/portraits/full/dufu-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 332, y: 285, r: 205 },
        decoInnerFrame: false
      }
    },

    {
      id: 'sushi',
      name:  { zh: '苏轼', en: 'Su Shi' },
      title: { zh: '东坡居士', en: 'Master Dongpo' },
      faction: 'neutral',
      class: 'mage',
      race:  { zh: '宋 · 文豪', en: 'Song Poet' },
      rarity: 'legendary',
      sigil: 'moon',
      theme: 'guofeng',
      dynasty: '宋',
      category: '詞',
      seal: '東坡',
      group: 'literati',
      stops: [
        { place: '眉山', x: 66, y: 8,  text: '景祐三年（1037）生于眉州眉山，父洵、弟辙并称「三苏」；少年读《范滂传》，奋厉有当世志。' },
        { place: '汴京', x: 30, y: 24, text: '嘉祐二年（1057）进士及第，欧阳修读其文，惊曰「老夫当避路，放他出一头地也」，名动京师。' },
        { place: '黄州', x: 62, y: 42, text: '元丰三年（1080）乌台诗案后贬黄州团练副使；躬耕东坡，作前后《赤壁赋》《寒食帖》，词开豪放。' },
        { place: '杭州', x: 28, y: 60, text: '元祐四年（1089）出知杭州，浚西湖、筑长堤，民怀其德号「苏堤」——「欲把西湖比西子，淡妆浓抹总相宜」。' },
        { place: '儋州', x: 64, y: 78, text: '绍圣四年（1097）远谪儋州，食芋饮水，与黎人杂居；著书讲学，海南始有进士，文教大开。' },
        { place: '常州', x: 32, y: 92, text: '建中靖国元年（1101）遇赦北归，七月卒于常州，年六十六——「问汝平生功业，黄州惠州儋州」。' }
      ],
      quote: '大江东去，浪淘尽，千古风流人物。',
      lore: '字子瞻，号东坡居士，眉州眉山人，1037年生。嘉祐二年进士，名动京师。乌台诗案后贬黄州，作赤壁二赋、《寒食帖》；历知杭颍扬定，筑苏堤。晚年远谪惠州、儋州，1101年卒于常州。诗词文书画，一代之冠。',
      stats: { might: 4, magic: 10, resolve: 8 },
      fullArt: 'assets/portraits/full/sushi-falang-full.png',
      fullArtHeight: 'assets/portraits/full/sushi-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 320, y: 165, r: 201 },
        decoInnerFrame: false
      }
    },

    {
      id: 'liqingzhao',
      name:  { zh: '李清照', en: 'Li Qingzhao' },
      title: { zh: '千古第一才女', en: 'The Foremost Poetess' },
      faction: 'neutral',
      class: 'mage',
      race:  { zh: '宋 · 词人', en: 'Song Poetess' },
      rarity: 'legendary',
      sigil: 'frost',
      theme: 'guofeng',
      dynasty: '宋',
      category: '詞',
      seal: '易安',
      group: 'literati',
      stops: [
        { place: '章丘', x: 66, y: 8,  text: '元丰七年（1084）生于济南章丘，父格非以文章受知于苏轼；少女作《如梦令》，「绿肥红瘦」语惊汴京。' },
        { place: '青州', x: 30, y: 24, text: '大观元年（1107）随赵明诚屏居青州归来堂，赌书泼茶，竭俸禄收金石书画，同辑《金石录》。' },
        { place: '建康', x: 62, y: 42, text: '建炎三年（1129）携十五车文物南渡；赵明诚赴任途中病殁建康，清照自此孤身——「物是人非事事休」。' },
        { place: '金华', x: 28, y: 60, text: '绍兴四年（1134）避乱金华，藏物辗转散失殆尽；作《打马图经》，撰《金石录后序》以记聚散。' },
        { place: '临安', x: 64, y: 84, text: '晚年卜居临安，境况凄凉——「寻寻觅觅，冷冷清清，凄凄惨惨戚戚」；约绍兴二十五年（1155）卒。' }
      ],
      quote: '生当作人杰，死亦为鬼雄。',
      lore: '号易安居士，济南章丘人，1084年生。嫁赵明诚，夫妇共赏金石，唱和忘忧。靖康之变仓皇南渡，明诚病殁，文物散佚，孤身漂泊浙中。词前期明丽，后期凄怆，自成「易安体」，为婉约词宗；约1155年卒。',
      stats: { might: 2, magic: 10, resolve: 8 },
      fullArt: 'assets/portraits/full/liqingzhao-falang-full.png',
      fullArtHeight: 'assets/portraits/full/liqingzhao-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 210, y: 245, r: 115 },
        decoInnerFrame: false
      }
    },

    {
      id: 'wangxizhi',
      name:  { zh: '王羲之', en: 'Wang Xizhi' },
      title: { zh: '书圣', en: 'The Sage of Calligraphy' },
      faction: 'neutral',
      class: 'mage',
      race:  { zh: '晋 · 书法家', en: 'Jin Calligrapher' },
      rarity: 'legendary',
      sigil: 'rune',
      theme: 'guofeng',
      dynasty: '晉',
      category: '書',
      seal: '書聖',
      group: 'literati',
      stops: [
        { place: '临沂', x: 66, y: 8,  text: '太安二年（303）生于琅琊临沂王氏，幼讷于言；年十三谒周顗，顗奇之，重味牛心炙先啖羲之。' },
        { place: '建康', x: 30, y: 30, text: '永嘉之乱随宗族南渡建康，师卫夫人学书；郗鉴选婿，诸郎咸饰，唯羲之坦腹东床食饼，遂中选。' },
        { place: '会稽', x: 62, y: 58, text: '永和九年（353）上巳日，与谢安、孙绰等四十一人修禊兰亭，曲水流觞，乘醉书《兰亭集序》三百二十四字。' },
        { place: '剡县', x: 32, y: 88, text: '永和十一年（355）誓墓辞官，隐居剡县金庭，与许询、支遁游山水、弋钓为娱；升平五年（361）卒。' }
      ],
      quote: '后之视今，亦犹今之视昔。',
      lore: '字逸少，琅琊临沂人，303年生，世称王右军。幼师卫夫人，博采秦汉篆隶，变朴质为妍美，备精诸体。永和九年兰亭雅集，乘兴作《兰亭集序》，被推为天下第一行书。晚年弃官归隐剡县，361年卒。',
      stats: { might: 3, magic: 10, resolve: 7 },
      fullArt: 'assets/portraits/full/wangxizhi-falang-full.png',
      fullArtHeight: 'assets/portraits/full/wangxizhi-falang-aiheight.png',
      goldLineParams: { decoInnerFrame: false }
    },

    {
      id: 'caoxueqin',
      name:  { zh: '曹雪芹', en: 'Cao Xueqin' },
      title: { zh: '红楼一梦', en: 'A Dream of Red Mansions' },
      faction: 'neutral',
      class: 'mage',
      race:  { zh: '清 · 小说家', en: 'Qing Novelist' },
      rarity: 'legendary',
      sigil: 'eye',
      theme: 'guofeng',
      dynasty: '清',
      category: '文',
      seal: '雪芹',
      group: 'literati',
      stops: [
        { place: '江宁', x: 66, y: 8,  text: '约康熙五十四年（1715）生于江宁织造府；曾祖至父辈三代四任织造，接驾四次，「烈火烹油，鲜花着锦」。' },
        { place: '蒜市口', x: 30, y: 30, text: '雍正六年（1728）曹頫获罪抄家，举家迁回北京，居崇文门外蒜市口；亲友离散，生计日蹙。' },
        { place: '西山', x: 62, y: 58, text: '乾隆间移居西山脚下，「举家食粥酒常赊」；于悼红轩中披阅十载、增删五次，字字看来皆是血。' },
        { place: '北京', x: 32, y: 88, text: '乾隆二十七年（1762）幼子夭亡，感伤成疾；除夕（1763年2月）泪尽而逝，《石头记》八十回后遂成绝响。' }
      ],
      quote: '满纸荒唐言，一把辛酸泪。',
      lore: '名霑，字梦阮，约1715年生。祖上三代任江宁织造，少年锦衣玉食；雍正六年家被抄，迁北京，晚居西郊，举家食粥。悼红轩中披阅十载、增删五次，著《红楼梦》未成，约1763年除夕泪尽而逝。',
      stats: { might: 2, magic: 10, resolve: 7 },
      fullArt: 'assets/portraits/full/caoxueqin-falang-full.png',
      fullArtHeight: 'assets/portraits/full/caoxueqin-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 310, y: 290, r: 130 },
        decoInnerFrame: false
      }
    },

    /* ======================== 奇士 SAVANT（6） ======================== */

    {
      id: 'zhangqian',
      name:  { zh: '张骞', en: 'Zhang Qian' },
      title: { zh: '凿空西域', en: 'The Pathfinder of the West' },
      faction: 'neutral',
      class: 'hunter',
      race:  { zh: '汉 · 使者', en: 'Han Envoy' },
      rarity: 'legendary',
      sigil: 'sun',
      theme: 'guofeng',
      dynasty: '漢',
      category: '使',
      seal: '博望侯',
      group: 'savant',
      stops: [
        { place: '长安', x: 66, y: 8,  text: '建元二年（前139）以郎应募，率堂邑父等百余人自长安西出，欲使大月氏，共击匈奴。' },
        { place: '匈奴', x: 30, y: 24, text: '道出河西为匈奴所获，留十余年，「予妻，有子，然骞持汉节不失」；伺机西走，不忘汉命。' },
        { place: '大宛', x: 62, y: 42, text: '越葱岭抵大宛，见汗血宝马；经康居至大月氏，留岁余不得要领，复南游大夏，见邛竹杖、蜀布。' },
        { place: '乌孙', x: 28, y: 60, text: '元狩四年（前119）率三百人、牛羊万数再使乌孙，分遣副使通大宛、安息、身毒诸国。' },
        { place: '长安', x: 64, y: 84, text: '元鼎三年（前114）卒于长安，葬汉中城固；司马迁赞曰「张骞凿空」，此后使者相望于道，商旅不绝。' }
      ],
      quote: '然张骞凿空，其后使往者皆称博望侯。',
      lore: '汉中城固人。前139年应募使大月氏，途中为匈奴所拘十三年，持汉节不失；得脱后越葱岭，历大宛、康居、大月氏。前119年再使乌孙，副使遍及西域诸国，丝路大开，封博望侯，前114年卒。',
      stats: { might: 7, magic: 4, resolve: 10 },
      fullArt: 'assets/portraits/full/zhangqian-falang-full.png',
      fullArtHeight: 'assets/portraits/full/zhangqian-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 180, y: 900, r: 100 },
        decoInnerFrame: false
      }
    },

    {
      id: 'xuanzang',
      name:  { zh: '玄奘', en: 'Xuanzang' },
      title: { zh: '三藏法师', en: 'The Tripitaka Master' },
      faction: 'neutral',
      class: 'priest',
      race:  { zh: '唐 · 高僧', en: 'Tang Monk' },
      rarity: 'legendary',
      sigil: 'totem',
      theme: 'guofeng',
      dynasty: '唐',
      category: '僧',
      seal: '三藏',
      group: 'savant',
      stops: [
        { place: '缑氏', x: 66, y: 8,  text: '隋仁寿二年（602）生于洛州缑氏；年十三出家洛阳净土寺，历游讲肆，究大小乘经论。' },
        { place: '长安', x: 30, y: 24, text: '贞观三年（629）冒禁私往天竺，昼伏夜行出玉门关，独穿八百里莫贺延碛——「宁可就西而死，岂归东而生」。' },
        { place: '高昌', x: 62, y: 42, text: '高昌王麴文泰迎为国师，坚留不得，结为兄弟；赠往返资粮、扈从数十人，致书西域二十四国。' },
        { place: '那烂陀', x: 28, y: 60, text: '贞观五年（631）抵摩揭陀那烂陀寺，师事戒贤，听《瑜伽师地论》三遍，游学五载，学业大成。' },
        { place: '曲女城', x: 64, y: 78, text: '贞观十五年（641）戒日王于曲女城设无遮大会，玄奘立「真唯识量」，悬示十八日，无一人敢驳。' },
        { place: '长安', x: 32, y: 92, text: '贞观十九年（645）携梵本经论六百五十七部归长安；译经十九年，成一千三百余卷，麟德元年（664）圆寂。' }
      ],
      quote: '宁可就西而死，岂归东而生！',
      lore: '俗姓陈，洛州缑氏人，602年生，十三岁出家。贞观三年冒禁西行，越流沙、翻葱岭，历十七年、五万里，求学那烂陀寺，曲女城设会辩经。645年携经六百五十七部归长安，译经千三百余卷，664年圆寂。',
      stats: { might: 3, magic: 9, resolve: 10 },
      fullArt: 'assets/portraits/full/xuanzang-falang-full.png',
      fullArtHeight: 'assets/portraits/full/xuanzang-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 135, y: 500, r: 150 },
        decoInnerFrame: false
      }
    },

    {
      id: 'zhenghe',
      name:  { zh: '郑和', en: 'Zheng He' },
      title: { zh: '七下西洋', en: 'The Great Navigator' },
      faction: 'neutral',
      class: 'hunter',
      race:  { zh: '明 · 航海家', en: 'Ming Navigator' },
      rarity: 'legendary',
      sigil: 'tide',
      theme: 'guofeng',
      dynasty: '明',
      category: '航',
      seal: '三保',
      group: 'savant',
      stops: [
        { place: '昆阳', x: 66, y: 8,  text: '洪武四年（1371）生于云南昆阳，回族，祖父均曾朝觐麦加；明师平滇，入宫为监，事燕王朱棣。' },
        { place: '刘家港', x: 30, y: 24, text: '永乐三年（1405）奉敕首航，宝船六十二艘、将士二万七千八百人自太仓刘家港启碇，云帆蔽日。' },
        { place: '古里', x: 62, y: 42, text: '抵印度古里，宣诏赐印，立碑庭中：「去中国十万余里，民物熙皞，大同风俗」；后以此为西洋都会。' },
        { place: '忽鲁谟斯', x: 28, y: 60, text: '永乐十一年（1413）第四次远航抵波斯湾忽鲁谟斯，分艟入红海——「观夫海洋，洪涛接天，巨浪如山」。' },
        { place: '麻林', x: 64, y: 78, text: '宝船分队远至东非麻林（今肯尼亚马林迪），献「麒麟」（长颈鹿），满朝称瑞，万国梯航来朝。' },
        { place: '归途', x: 32, y: 92, text: '宣德八年（1433）第七次远航归途病逝（传于古里）；宣德六年长乐立《天妃灵应之记》碑，备纪七次航程。' }
      ],
      quote: '观夫海洋，洪涛接天，巨浪如山。',
      lore: '本姓马，云南昆阳人，1371年生。靖难有功，赐姓郑，世称三保太监。1405年起七下西洋，统宝船巨舰、士卒二万七千，历三十余国，远抵忽鲁谟斯与东非海岸，宣德柔远，1433年卒于第七次远航归途。',
      stats: { might: 8, magic: 5, resolve: 9 },
      fullArt: 'assets/portraits/full/zhenghe-falang-full.png',
      fullArtHeight: 'assets/portraits/full/zhenghe-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 256, y: 243, r: 186 },
        decoInnerFrame: false
      }
    },

    {
      id: 'xuxiake',
      name:  { zh: '徐霞客', en: 'Xu Xiake' },
      title: { zh: '游圣', en: 'The Sage of Travel' },
      faction: 'neutral',
      class: 'hunter',
      race:  { zh: '明 · 旅行家', en: 'Ming Traveler' },
      rarity: 'legendary',
      sigil: 'leaf',
      theme: 'guofeng',
      dynasty: '明',
      category: '游',
      seal: '霞客',
      group: 'savant',
      stops: [
        { place: '江阴', x: 66, y: 8,  text: '万历十四年（1587）生于南直隶江阴，少负奇气，博览古今图籍——「大丈夫当朝碧海而暮苍梧」。' },
        { place: '天台山', x: 30, y: 24, text: '万历四十一年（1613）二十六岁游天台山，《徐霞客游记》自此开篇：「云散日朗，人意山光，俱有喜态」。' },
        { place: '黄山', x: 62, y: 42, text: '万历四十四年、四十六年两游黄山，登莲花、天都二峰，叹「薄海内外无如徽之黄山」，观止矣。' },
        { place: '湘江', x: 28, y: 60, text: '崇祯十年（1637）西南万里遐征，舟泊湘江遇盗，行囊俱焚；人劝东返，霞客奋然西行，志不少移。' },
        { place: '鸡足山', x: 64, y: 78, text: '崇祯十三年（1640）足疾俱废，丽江土知府木增以滑竿护送东归，百五十日方抵黄冈，归纂《鸡足山志》。' },
        { place: '江阴', x: 32, y: 92, text: '崇祯十四年（1641）卒于江阴，年五十六；遗稿六十余万言，钱谦益推为「千古奇书」。' }
      ],
      quote: '大丈夫当朝碧海而暮苍梧。',
      lore: '名弘祖，号霞客，江阴人，1587年生。不应科举，二十二岁出游，三十余载足遍十九省；探幽崖邃壑，考江源、辨岩溶，订正前人地理之误。所著《徐霞客游记》六十余万言，被推「千古奇书」；1641年卒。',
      stats: { might: 6, magic: 7, resolve: 9 },
      fullArt: 'assets/portraits/full/xuxiake-falang-full.png',
      fullArtHeight: 'assets/portraits/full/xuxiake-falang-aiheight.png',
      goldLineParams: { decoInnerFrame: false }
    },

    {
      id: 'huatuo',
      name:  { zh: '华佗', en: 'Hua Tuo' },
      title: { zh: '神医', en: 'The Divine Physician' },
      faction: 'neutral',
      class: 'priest',
      race:  { zh: '汉 · 医家', en: 'Han Physician' },
      rarity: 'legendary',
      sigil: 'leaf',
      theme: 'guofeng',
      dynasty: '漢',
      category: '醫',
      seal: '神醫',
      group: 'savant',
      stops: [
        { place: '谯县', x: 66, y: 8,  text: '东汉末生于沛国谯县；兼通数经，沛相陈珪举孝廉、太尉黄琬辟，皆不就，专精方药以济世。' },
        { place: '广陵', x: 30, y: 30, text: '行医徐、扬间，授徒吴普、樊阿；创五禽之戏——「人体欲得劳动，但不当使极尔」，吴普行之，年九十余。' },
        { place: '许昌', x: 62, y: 58, text: '曹操苦头风，佗针膈俞穴，随手而瘥；召为侍医常侍左右，佗性恶、恃能，告归许都不肯复返。' },
        { place: '许都狱中', x: 32, y: 88, text: '建安十三年（208）下狱拷问致死；临刑出《青囊经》一卷与狱吏，吏畏法不受，佗索火烧之。' }
      ],
      quote: '人体欲得劳动，但不当使极尔。',
      lore: '字元化，沛国谯人。通晓养性之术，精方药针灸；创麻沸散，剖腹断肠、湔洗缝腹，为世界全身麻醉之先；又作五禽戏教人强身。曹操患头风召为侍医，托故归乡屡召不赴，208年下狱死，《青囊经》遂不传。',
      stats: { might: 3, magic: 10, resolve: 7 },
      fullArt: 'assets/portraits/full/huatuo-falang-full.png',
      fullArtHeight: 'assets/portraits/full/huatuo-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 110, y: 665, r: 70 },
        decoInnerFrame: false
      }
    },

    {
      id: 'zuchongzhi',
      name:  { zh: '祖冲之', en: 'Zu Chongzhi' },
      title: { zh: '算圣', en: 'The Sage of Mathematics' },
      faction: 'neutral',
      class: 'mage',
      race:  { zh: '宋 · 算学家', en: 'Liu Song Mathematician' },
      rarity: 'legendary',
      sigil: 'moon',
      theme: 'guofeng',
      dynasty: '宋',
      category: '算',
      seal: '沖之',
      group: 'savant',
      stops: [
        { place: '建康', x: 66, y: 8,  text: '元嘉六年（429）生于建康；祖昌任大匠卿，父朔之学识渊博，冲之少稽古有机思，宋孝武使直华林学省。' },
        { place: '娄县', x: 30, y: 30, text: '出为南徐州从事、娄县令，公务之暇专精历算——「亲量圭尺，躬察仪漏，目尽毫厘，心穷筹策」。' },
        { place: '乐游苑', x: 62, y: 58, text: '大明六年（462）上《大明历》，首开岁差入历，驳者四起；又与索驭驎对试指南车于乐游苑，百刻不差。' },
        { place: '建康', x: 32, y: 88, text: '永元二年（500）卒，年七十二；圆周率算于3.1415926与3.1415927之间，密率355/113，领先世界约千年。' }
      ],
      quote: '亲量圭尺，躬察仪漏。',
      lore: '字文远，范阳遒人，429年生于建康。专功数术，搜拣古今；算圆周率于3.1415926与3.1415927之间，约率密率领先世界千年；造《大明历》，又制指南车、水碓磨、千里船。500年卒，年七十二。',
      stats: { might: 2, magic: 10, resolve: 8 },
      fullArt: 'assets/portraits/full/zuchongzhi-falang-full.png',
      fullArtHeight: 'assets/portraits/full/zuchongzhi-falang-aiheight.png',
      goldLineParams: {
        moonHint: { x: 188, y: 707, r: 70 },
        decoInnerFrame: false
      }
    },
    /* 国风样板卡（小红书国风vibecoding方向）：工笔重彩绢本管线验证卡。
       goldLineParams 为逐卡金线配置（skipZones 弱线禁区 + moonHint 引导式
       月环，见 WORKFLOW §5.6），renderFace 全幅分支透传给 paintGoldLines。 */
    {
      id: 'libai',
      name:  { zh: '李白', en: 'Li Bai' },
      title: { zh: '诗仙', en: 'The Immortal Poet' },
      faction: 'neutral',
      class: 'mage',
      race:  { zh: '唐 · 诗人', en: 'Tang Poet' },
      rarity: 'legendary',
      sigil: 'moon',
      theme: 'guofeng',          // 国风装饰层（回纹框/匾额/题款/印章）
      dynasty: '唐',              // 朝代印（左下角，小篆白文）
      category: '詩',             // 类别印（右下角，繁体：崇羲篆体简体覆盖不全）
      seal: '詩仙',               // 称号镂空朱文大印（题款列末，繁体小篆）
      group: 'literati',          // 门类（图鉴筛选）：emperor/general/literati/savant
      stops: [                    // 生平行旅图站点（x/y 为长卷百分比）
        { place: '碎叶', x: 68, y: 8,  text: '武周长安元年（701），李白生于西域碎叶城。五岁随父迁回蜀中，幼读百家，好剑术，喜任侠。' },
        { place: '蜀中', x: 30, y: 24, text: '少年隐居匡山读书，遍观诸子，习剑学道。二十五岁仗剑去国，辞亲远游，出三峡、下江陵——「峨眉山月半轮秋，影入平羌江水流」。' },
        { place: '长安', x: 62, y: 42, text: '天宝元年（742），四十二岁奉诏入京，供奉翰林。金銮殿上草答蕃书，御手调羹，力士脱靴；长安市上斗酒诗百篇，天子呼来不上船。' },
        { place: '漫游', x: 28, y: 60, text: '天宝三载赐金放还，自此漫游梁宋、齐鲁、吴越。与杜甫相遇于洛阳，中国文学史上最伟大的重逢——「醉眠秋共被，携手日同行」。' },
        { place: '夜郎', x: 64, y: 78, text: '安史乱起，入永王李璘幕府。永王败，李白获罪流放夜郎，行至白帝城遇赦东还——「朝辞白帝彩云间，千里江陵一日还」。' },
        { place: '当涂', x: 34, y: 92, text: '上元二年（761），暮年投奔族叔当涂县令李阳冰。宝应元年（762）病逝，年六十二。传说醉后入水捉月而逝——仙人终归天上去了。' }
      ],
      quote: '举杯邀明月，对影成三人。',
      lore: '唐代浪漫主义诗人，字太白，号青莲居士。斗酒诗百篇，长安市上酒家眠；一生好入名山游，诗成笑傲凌沧洲。其诗雄奇飘逸、想象力绝尘，兼有剑侠之气与谪仙之姿，被后世尊为「诗仙」，与杜甫并称「李杜」。',
      stats: { might: 6, magic: 9, resolve: 8 },
      fullArt: 'assets/portraits/full/libai-falang-full.png',           // 掐丝珐琅 3040×4560（风格定稿）
      fullArtHeight: 'assets/portraits/full/libai-falang-aiheight.png',  // AI 灰度高度图（深浮雕提示词版）
      goldLineParams: {
        moonHint: { x: 326, y: 197, r: 171 },   // 满月（逻辑坐标，QC 验收贴缘）
        decoInnerFrame: false,                  // 国风外框自带 46 细线，关闭塔罗式内框双线
        skipZones: [
          { x: 405, y: 330, rx: 80,  ry: 100 },  // 头部：幞头/面容/头巾飘带
          { x: 75,  y: 220, rx: 95,  ry: 210 },  // 酒肆楼阁（含左侧灯笼）
          { x: 185, y: 360, rx: 40,  ry: 60 },   // 右侧红灯笼
          { x: 75,  y: 620, rx: 95,  ry: 140 },  // 牡丹花树
          { x: 150, y: 730, rx: 125, ry: 100 },  // 石桌 + 酒坛（酒字）+ 果盘
          { x: 555, y: 420, rx: 115, ry: 120 },  // 远景城墙 + 佛塔
          { x: 332, y: 960, rx: 340, ry: 90 }    // 底部石栏杆 + 水面月影
        ]
      }
    }
  ];

  /* --------------------------------------------------------------------------
   * 四、深冻结工具
   *    递归冻结数据，防止运行期被 card-art / app 或其他脚本意外改写。
   * ------------------------------------------------------------------------ */
  function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    Object.keys(obj).forEach(function (key) { deepFreeze(obj[key]); });
    return Object.freeze(obj);
  }

  deepFreeze(WOW_CLASS_INFO);
  deepFreeze(WOW_RARITY_INFO);
  deepFreeze(WOW_HEROES);

  /* --------------------------------------------------------------------------
   * 五、契约自检器（防御性编程）
   *    仅 console.warn，绝不 throw：即使数据将来维护出错，
   *    下游（card-art / app）也能拿到结构完整的数据优雅降级。
   * ------------------------------------------------------------------------ */
  (function selfCheck() {
    var LEGAL_SIGILS = ('lion wolf frost moon leaf skull felflame hammer tide eye ' +
                        'phoenix rune bow shadow sun axe light serpent storm book totem').split(' ');
    var LEGAL_FACTIONS = ['alliance', 'horde', 'neutral'];
    var LEGAL_RARITIES = ['legendary', 'epic', 'rare'];

    var warn = function (msg) {
      if (global.console && typeof global.console.warn === 'function') {
        global.console.warn('[heroes-data] 数据契约警告：' + msg);
      }
    };

    if (!Array.isArray(WOW_HEROES) || WOW_HEROES.length !== 24) {
      warn('英雄数量应为 24，当前为 ' + (WOW_HEROES ? WOW_HEROES.length : 0));
    }

    var seenIds = {};
    WOW_HEROES.forEach(function (hero, i) {
      var tag = (hero && hero.id) ? hero.id : ('#' + i);
      if (!hero || typeof hero !== 'object') { warn('第 ' + i + ' 位英雄不是对象'); return; }
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(hero.id || '')) warn(tag + '：id 应为英文小写连字符');
      if (seenIds[hero.id]) warn(tag + '：id 重复');
      seenIds[hero.id] = true;
      if (LEGAL_FACTIONS.indexOf(hero.faction) < 0) warn(tag + '：faction 非法 → ' + hero.faction);
      if (!WOW_CLASS_INFO[hero.class]) warn(tag + '：class 非法 → ' + hero.class);
      if (LEGAL_RARITIES.indexOf(hero.rarity) < 0) warn(tag + '：rarity 非法 → ' + hero.rarity);
      if (LEGAL_SIGILS.indexOf(hero.sigil) < 0) warn(tag + '：sigil 非法 → ' + hero.sigil);
      ['name', 'title', 'race'].forEach(function (field) {
        if (!hero[field] || !hero[field].zh || !hero[field].en) {
          warn(tag + '：' + field + ' 缺少 zh/en');
        }
      });
      if (!hero.quote || hero.quote.length > 30) warn(tag + '：quote 缺失或超过 30 字');
      if (!hero.lore || hero.lore.length < 60 || hero.lore.length > 100) {
        warn(tag + '：lore 长度应为 60–100 字，当前 ' + (hero.lore || '').length + ' 字');
      }
      ['might', 'magic', 'resolve'].forEach(function (s) {
        var v = hero.stats && hero.stats[s];
        if (typeof v !== 'number' || v < 1 || v > 10 || v % 1 !== 0) {
          warn(tag + '：stats.' + s + ' 应为 1–10 整数');
        }
      });
    });
  })();

  /* --------------------------------------------------------------------------
   * 六、导出到全局（契约三件套）
   * ------------------------------------------------------------------------ */
  global.WOW_CLASS_INFO = WOW_CLASS_INFO;
  global.WOW_RARITY_INFO = WOW_RARITY_INFO;
  global.WOW_HEROES = WOW_HEROES;

})(typeof window !== 'undefined' ? window : globalThis);
