/* ============================================================================
 * 艾泽拉斯英雄志 · 魔兽英雄数据（js/heroes-data-wow.js）
 * ----------------------------------------------------------------------------
 * GitHub Pages 展示页（wow.html）的唯一数据源，与主站 js/heroes-data.js
 * 同一契约（window.WOW_CLASS_INFO / WOW_RARITY_INFO / WOW_HEROES），
 * 供 js/card-art.js 直接消费；仅由 wow.html 引入，与国风主站互不影响。
 *
 * 资产路由：
 *   - 24 位英雄均已接入全幅卡；旧版油画肖像保留作加载失败时的降级资源。
 *   - 希尔瓦娜斯带 fullArt / fullArtHeight，走全幅烫金浮雕管线（v7 基准卡，
 *     金线禁区用 card-art.js 内置的希瓦定稿默认区）。
 *   - 另 23 位接入 ImageGen 全幅原画、语义深度图、独立金线禁区及希瓦同款装饰。
 * ============================================================================ */
(function (global) {
  'use strict';

  /* 职业信息：color 为魔兽世界官方职业色 */
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

  /* 稀有度：魔兽官方物品品质配色 */
  var WOW_RARITY_INFO = {
    legendary: { zh: '传说', color: '#FF8000' },
    epic:      { zh: '史诗', color: '#A335EE' },
    rare:      { zh: '稀有', color: '#0070DD' }
  };

  /* 英雄名录（24 名）：联盟 9 → 部落 8 → 中立 7 */
  var WOW_HEROES = [

    /* ======================== 联盟 ALLIANCE（9） ======================== */

    {
      id: 'jaina-proudmoore',
      fullArt: 'assets/portraits/wow-runtime/jaina-proudmoore-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/jaina-proudmoore-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/jaina-proudmoore-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0.20, // keep the face below the shared title's backing (ends at y=226)
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, skipZones: [
        { x: 335, y: 269, rx: 95, ry: 94 },
        { x: 527, y: 460, rx: 69, ry: 60 },
        { x: 7, y: 563, rx: 110, ry: 350 },
        { x: 661, y: 700, rx: 144, ry: 375 },
        { x: 332, y: 1060, rx: 550, ry: 120 }
      ] },
      name:  { zh: '吉安娜·普罗德摩尔', en: 'Jaina Proudmoore' },
      title: { zh: '海军统帅', en: 'Lord Admiral of Kul Tiras' },
      faction: 'alliance',
      class: 'mage',
      race:  { zh: '人类', en: 'Human' },
      rarity: 'legendary',
      sigil: 'tide',
      quote: '塞拉摩，永远不会被遗忘。',
      lore: '库尔提拉斯海军统帅之女，师从大法师安东尼达斯。曾竭力在联盟与部落间斡旋和平，塞拉摩毁于聚焦之虹后性情大变。后回归故国，继承海军统帅之位，率领库尔提拉斯重返联盟。',
      stats: { might: 4, magic: 10, resolve: 8 }
    },

    {
      id: 'varian-wrynn',
      fullArtNonMetalZones: [ // sunset and warm clouds, excluding the armored torso
        { x: 332, y: 150, rx: 440, ry: 160 },
        { x: 146, y: 380, rx: 115, ry: 170 },
        { x: 544, y: 366, rx: 100, ry: 170 }
      ],
      fullArt: 'assets/portraits/wow-runtime/varian-wrynn-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/varian-wrynn-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/varian-wrynn-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, skipZones: [
        { x: 350, y: 303, rx: 76, ry: 93 },
        { x: 60, y: 490, rx: 87, ry: 245 },
        { x: 606, y: 502, rx: 91, ry: 235 },
        { x: 30, y: 750, rx: 98, ry: 155 },
        { x: 636, y: 780, rx: 95, ry: 145 },
        { x: 332, y: 998, rx: 440, ry: 112 }
      ] },
      name:  { zh: '瓦里安·乌瑞恩', en: 'Varian Wrynn' },
      title: { zh: '暴风城国王', en: 'King of Stormwind' },
      faction: 'alliance',
      class: 'warrior',
      race:  { zh: '人类', en: 'Human' },
      rarity: 'legendary',
      sigil: 'lion',
      quote: '为了联盟！',
      lore: '暴风城国王，幼年目睹父亲遇刺、王国倾覆。曾被掳失忆，以角斗士「洛戈什」之名杀出重围，重登王位。破碎海滩一役为掩护联盟撤退，独挡古尔丹军团，壮烈战死。',
      stats: { might: 9, magic: 2, resolve: 9 }
    },

    {
      id: 'anduin-wrynn',
      fullArtNonMetalZones: [ { x: 332, y: 190, rx: 240, ry: 158 } ],
      fullArt: 'assets/portraits/wow-runtime/anduin-wrynn-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/anduin-wrynn-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/anduin-wrynn-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 331, y: 344, rx: 63, ry: 69 },
        { x: 332, y: 196, rx: 182, ry: 110 },
        { x: 32, y: 456, rx: 75, ry: 345 },
        { x: 631, y: 463, rx: 79, ry: 350 },
        { x: 151, y: 575, rx: 57, ry: 154 },
        { x: 541, y: 584, rx: 62, ry: 155 },
        { x: 332, y: 998, rx: 440, ry: 114 }
      ] },
      name:  { zh: '安度因·乌瑞恩', en: 'Anduin Wrynn' },
      title: { zh: '至高王', en: 'High King of the Alliance' },
      faction: 'alliance',
      class: 'priest',
      race:  { zh: '人类', en: 'Human' },
      rarity: 'legendary',
      sigil: 'light',
      quote: '圣光不灭，希望长存。',
      lore: '瓦里安之子，自幼向往和平，师从维伦研习圣光。破碎海滩痛失父亲后继位暴风城国王，继任联盟至高王。以怀柔对抗刀剑，亲历第四次大战的烽火，始终信念不泯。',
      stats: { might: 3, magic: 9, resolve: 8 }
    },

    {
      id: 'uther-lightbringer',
      fullArtNonMetalZones: [ // warm dawn clouds
        { x: 332, y: 225, rx: 330, ry: 185 },
        { x: 90, y: 650, rx: 110, ry: 170 },
        { x: 600, y: 720, rx: 115, ry: 210 }
      ],
      fullArt: 'assets/portraits/wow-runtime/uther-lightbringer-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/uther-lightbringer-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/uther-lightbringer-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, skipZones: [
        { x: 331, y: 326, rx: 65, ry: 77 },
        { x: 88, y: 548, rx: 102, ry: 178 },
        { x: 602, y: 459, rx: 115, ry: 252 },
        { x: 46, y: 799, rx: 118, ry: 137 },
        { x: 618, y: 798, rx: 116, ry: 146 },
        { x: 332, y: 998, rx: 440, ry: 110 }
      ] },
      name:  { zh: '乌瑟尔·光明使者', en: 'Uther the Lightbringer' },
      title: { zh: '光明使者', en: 'The Lightbringer' },
      faction: 'alliance',
      class: 'paladin',
      race:  { zh: '人类', en: 'Human' },
      rarity: 'legendary',
      sigil: 'hammer',
      quote: '圣光与我们同在。',
      lore: '白银之手骑士团缔造者，阿尔萨斯的导师。安多哈尔一役，为守护泰瑞纳斯国王的骨灰瓮，死在自己最骄傲的学生剑下。其陵墓立于西瘟疫之地，圣光信仰的象征永存。',
      stats: { might: 8, magic: 6, resolve: 10 }
    },

    {
      id: 'tyrande-whisperwind',
      fullArt: 'assets/portraits/wow-runtime/tyrande-whisperwind-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/tyrande-whisperwind-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/tyrande-whisperwind-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0.12,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 331, y: 291, rx: 85, ry: 91 },
        { x: 40, y: 529, rx: 86, ry: 280 },
        { x: 637, y: 531, rx: 88, ry: 285 },
        { x: 96, y: 832, rx: 150, ry: 119 },
        { x: 584, y: 842, rx: 155, ry: 126 },
        { x: 332, y: 1000, rx: 440, ry: 120 }
      ] },
      name:  { zh: '泰兰德·语风', en: 'Tyrande Whisperwind' },
      title: { zh: '月之女祭司', en: 'High Priestess of Elune' },
      faction: 'alliance',
      class: 'priest',
      race:  { zh: '暗夜精灵', en: 'Night Elf' },
      rarity: 'legendary',
      sigil: 'moon',
      quote: '愿艾露恩指引你。',
      lore: '艾露恩高阶女祭司，暗夜精灵的领袖，与玛法里奥相守万年。海加尔山之战率哨兵抵抗燃烧军团；泰达希尔焚毁后化身「月夜战神」，誓为族人的血债追讨到底。',
      stats: { might: 6, magic: 9, resolve: 8 }
    },

    {
      id: 'malfurion-stormrage',
      fullArt: 'assets/portraits/wow-runtime/malfurion-stormrage-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/malfurion-stormrage-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/malfurion-stormrage-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 331, y: 379, rx: 90, ry: 86 },
        { x: 38, y: 437, rx: 93, ry: 310 },
        { x: 621, y: 464, rx: 105, ry: 342 },
        { x: 128, y: 265, rx: 93, ry: 113 },
        { x: 203, y: 390, rx: 61, ry: 52 },
        { x: 107, y: 823, rx: 142, ry: 147 },
        { x: 590, y: 830, rx: 115, ry: 144 },
        { x: 332, y: 1000, rx: 440, ry: 110 }
      ] },
      name:  { zh: '玛法里奥·怒风', en: 'Malfurion Stormrage' },
      title: { zh: '大德鲁伊', en: 'The Archdruid' },
      faction: 'alliance',
      class: 'druid',
      race:  { zh: '暗夜精灵', en: 'Night Elf' },
      rarity: 'legendary',
      sigil: 'leaf',
      quote: '我响应荒野的召唤。',
      lore: '史上第一位德鲁伊，师从半神塞纳留斯。上古之战率族人抵抗燃烧军团，后长眠翡翠梦境守护自然平衡。泰兰德的爱人，伊利丹的兄长，卡利姆多万物的守护者。',
      stats: { might: 5, magic: 10, resolve: 9 }
    },

    {
      id: 'alleria-windrunner',
      fullArt: 'assets/portraits/wow-runtime/alleria-windrunner-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/alleria-windrunner-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/alleria-windrunner-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 332, y: 331, rx: 64, ry: 72 },
        { x: 138, y: 423, rx: 78, ry: 161 },
        { x: 552, y: 388, rx: 79, ry: 206 },
        { x: 443, y: 465, rx: 54, ry: 85 },
        { x: 32, y: 738, rx: 114, ry: 152 },
        { x: 620, y: 766, rx: 121, ry: 162 },
        { x: 332, y: 1000, rx: 440, ry: 116 }
      ] },
      name:  { zh: '奥蕾莉亚·风行者', en: 'Alleria Windrunner' },
      title: { zh: '游侠将军', en: 'Ranger-General of Silvermoon' },
      faction: 'alliance',
      class: 'hunter',
      race:  { zh: '高等精灵', en: 'High Elf' },
      rarity: 'epic',
      sigil: 'bow',
      quote: '虚空无法吞噬我。',
      lore: '风行者三姐妹之长，奎尔萨拉斯游侠将军。第二次大战后远征德拉诺，失踪三十年，于阿古斯吸纳虚空之力归来，成为首位虚空精灵，为联盟而战。',
      stats: { might: 7, magic: 6, resolve: 9 }
    },

    {
      id: 'turalyon',
      fullArtNonMetalZones: [ // emissive crystal, space vista and reflected light on the deck
        { x: 332, y: 145, rx: 440, ry: 178 },
        { x: 110, y: 438, rx: 110, ry: 310 },
        { x: 564, y: 492, rx: 150, ry: 285 },
        { x: 332, y: 945, rx: 470, ry: 175 }
      ],
      fullArt: 'assets/portraits/wow-runtime/turalyon-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/turalyon-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/turalyon-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 301, y: 334, rx: 69, ry: 74 },
        { x: 198, y: 255, rx: 132, ry: 175 },
        { x: 537, y: 513, rx: 143, ry: 210 },
        { x: 56, y: 676, rx: 118, ry: 246 },
        { x: 626, y: 788, rx: 93, ry: 164 },
        { x: 332, y: 1000, rx: 440, ry: 116 }
      ] },
      name:  { zh: '图拉扬', en: 'Turalyon' },
      title: { zh: '洛萨之子', en: 'Son of Lothar' },
      faction: 'alliance',
      class: 'paladin',
      race:  { zh: '人类', en: 'Human' },
      rarity: 'epic',
      sigil: 'sun',
      quote: '为了洛丹伦！',
      lore: '洛萨的副官，白银之手首批圣骑士。第二次大战率联盟远征军穿越黑暗之门，与奥蕾莉亚一同失踪三十年。归来后统领圣光军团，以千年征战之躯再卫艾泽拉斯。',
      stats: { might: 8, magic: 6, resolve: 9 }
    },

    {
      id: 'khadgar',
      fullArt: 'assets/portraits/wow-runtime/khadgar-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/khadgar-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/khadgar-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 333, y: 304, rx: 63, ry: 77 },
        { x: 99, y: 457, rx: 65, ry: 195 },
        { x: 605, y: 425, rx: 79, ry: 241 },
        { x: 30, y: 751, rx: 119, ry: 123 },
        { x: 602, y: 748, rx: 103, ry: 145 },
        { x: 332, y: 1000, rx: 440, ry: 118 }
      ] },
      name:  { zh: '卡德加', en: 'Khadgar' },
      title: { zh: '守护者之徒', en: 'Apprentice of the Guardian' },
      faction: 'alliance',
      class: 'mage',
      race:  { zh: '人类', en: 'Human' },
      rarity: 'epic',
      sigil: 'book',
      quote: '知识，就是最锋利的武器。',
      lore: '麦迪文的学徒，卡拉赞之变中手刃恩师，背负守护者遗产前行。黑暗之门两度开启，他都站在最前线；破碎群岛之战统率肯瑞托，成为艾泽拉斯最可信赖的法师。',
      stats: { might: 3, magic: 10, resolve: 8 }
    },

    /* ======================== 部落 HORDE（8） ======================== */

    {
      id: 'thrall',
      fullArt: 'assets/portraits/wow-runtime/thrall-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/thrall-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/thrall-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, skipZones: [
        { x: 320, y: 243, rx: 64, ry: 80 },
        { x: 75, y: 405, rx: 73, ry: 245 },
        { x: 605, y: 654, rx: 85, ry: 225 },
        { x: 332, y: 110, rx: 360, ry: 155 },
        { x: 332, y: 998, rx: 430, ry: 102 }
      ] },
      name:  { zh: '萨尔', en: 'Thrall' },
      title: { zh: '世界萨满', en: 'The World Shaman' },
      faction: 'horde',
      class: 'shaman',
      race:  { zh: '兽人', en: 'Orc' },
      rarity: 'legendary',
      sigil: 'storm',
      quote: '风暴、大地和火焰，听从我的召唤！',
      lore: '杜隆坦之子，幼年为奴，得名「萨尔」。逃脱后寻回霜狼血脉，统一部落，率族人西渡卡利姆多建立奥格瑞玛。大灾变时放下大酋长之位，以世界萨满之名抚平大地之伤。',
      stats: { might: 8, magic: 9, resolve: 9 }
    },

    {
      id: 'sylvanas-windrunner',
      name:  { zh: '希尔瓦娜斯·风行者', en: 'Sylvanas Windrunner' },
      title: { zh: '女妖之王', en: 'The Banshee Queen' },
      faction: 'horde',
      class: 'hunter',
      race:  { zh: '被遗忘者', en: 'Forsaken' },
      rarity: 'legendary',
      sigil: 'bow',
      quote: '我们是被遗忘者。',
      lore: '奎尔萨拉斯游侠将军，银月城保卫战中被阿尔萨斯复活为女妖。挣脱巫妖王桎梏后率亡灵自立「被遗忘者」，历任部落大酋长，一生在仇恨与自由之间燃烧。',
      stats: { might: 8, magic: 7, resolve: 7 },
      /* v7 量产基准卡：全幅烫金浮雕管线（金线禁区用 card-art.js 内置希瓦定稿默认区） */
      fullArt: 'assets/portraits/wow-runtime/sylvanas-windrunner-full.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/sylvanas-windrunner-aiheight.webp'
    },

    {
      id: 'cairne-bloodhoof',
      fullArtNonMetalZones: [ // wooden totem, fur, leather, prairie and sunset; applied gold ridges remain metallic
        { x: 332, y: 512, rx: 850, ry: 1200 }
      ],
      fullArt: 'assets/portraits/wow-runtime/cairne-bloodhoof-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/cairne-bloodhoof-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/cairne-bloodhoof-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 1200, skipZones: [
        { x: 333, y: 410, rx: 96, ry: 92 },
        { x: 89, y: 659, rx: 102, ry: 136 },
        { x: 572, y: 661, rx: 77, ry: 142 },
        { x: 40, y: 838, rx: 115, ry: 170 },
        { x: 622, y: 845, rx: 101, ry: 157 },
        { x: 332, y: 1000, rx: 440, ry: 108 }
      ] },
      name:  { zh: '凯恩·血蹄', en: 'Cairne Bloodhoof' },
      title: { zh: '牛头人酋长', en: 'High Chieftain of the Tauren' },
      faction: 'horde',
      class: 'warrior',
      race:  { zh: '牛头人', en: 'Tauren' },
      rarity: 'epic',
      sigil: 'totem',
      quote: '大地母亲保佑着你。',
      lore: '血蹄部族至高酋长，带领牛头人摆脱半人马劫掠，与萨尔结盟，定居莫高雷。为人厚重如山，后与加尔鲁什决斗，遭毒刃暗算含恨而殁，为族人世代敬仰。',
      stats: { might: 9, magic: 3, resolve: 9 }
    },

    {
      id: 'baine-bloodhoof',
      fullArtNonMetalZones: [ // fur and leather, sunrise, sandstone and grass
        { x: 332, y: 200, rx: 520, ry: 290 },
        { x: 341, y: 582, rx: 190, ry: 255 },
        { x: 62, y: 636, rx: 140, ry: 270 },
        { x: 610, y: 666, rx: 145, ry: 340 },
        { x: 332, y: 971, rx: 460, ry: 133 }
      ],
      fullArt: 'assets/portraits/wow-runtime/baine-bloodhoof-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/baine-bloodhoof-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/baine-bloodhoof-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 333, y: 371, rx: 97, ry: 101 },
        { x: 75, y: 505, rx: 93, ry: 153 },
        { x: 577, y: 689, rx: 114, ry: 180 },
        { x: 36, y: 819, rx: 112, ry: 131 },
        { x: 622, y: 840, rx: 92, ry: 122 },
        { x: 332, y: 1000, rx: 440, ry: 105 }
      ] },
      name:  { zh: '贝恩·血蹄', en: 'Baine Bloodhoof' },
      title: { zh: '至高酋长', en: 'High Chieftain' },
      faction: 'horde',
      class: 'warrior',
      race:  { zh: '牛头人', en: 'Tauren' },
      rarity: 'rare',
      sigil: 'hammer',
      quote: '父亲的精神与我同在。',
      lore: '凯恩之子，父亲遇刺后平定恐怖图腾叛乱，继任牛头人至高酋长。继承父亲的宽厚与坚韧，在部落的风暴中坚守良知，多次为和平奔走于雷霆崖与奥格瑞玛之间。',
      stats: { might: 8, magic: 3, resolve: 8 }
    },

    {
      id: 'voljin',
      fullArt: 'assets/portraits/wow-runtime/voljin-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/voljin-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/voljin-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 312, y: 373, rx: 86, ry: 113 },
        { x: 558, y: 480, rx: 107, ry: 190 },
        { x: 592, y: 659, rx: 123, ry: 148 },
        { x: 90, y: 695, rx: 126, ry: 99 },
        { x: 638, y: 918, rx: 84, ry: 117 },
        { x: 332, y: 1000, rx: 440, ry: 106 }
      ] },
      name:  { zh: '沃金', en: "Vol'jin" },
      title: { zh: '暗影猎手', en: 'Shadow Hunter' },
      faction: 'horde',
      class: 'rogue',
      race:  { zh: '暗矛巨魔', en: 'Darkspear Troll' },
      rarity: 'epic',
      sigil: 'serpent',
      quote: '部落，是我的家人。',
      lore: '森金之子，暗矛部族暗影猎手，萨尔最信任的谋士。潘达利亚遇刺幸存，举起义旗推翻加尔鲁什，成为部落首位巨魔大酋长。破碎海滩重伤不治，以英灵之姿继续指引族人。',
      stats: { might: 6, magic: 8, resolve: 9 }
    },

    {
      id: 'rexxar',
      fullArt: 'assets/portraits/wow-runtime/rexxar-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/rexxar-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/rexxar-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 323, y: 354, rx: 83, ry: 86 },
        { x: 46, y: 412, rx: 92, ry: 278 },
        { x: 620, y: 362, rx: 80, ry: 248 },
        { x: 558, y: 644, rx: 98, ry: 119 },
        { x: 41, y: 765, rx: 104, ry: 152 },
        { x: 332, y: 1000, rx: 440, ry: 110 }
      ] },
      name:  { zh: '雷克萨', en: 'Rexxar' },
      title: { zh: '兽王', en: 'The Beastmaster' },
      faction: 'horde',
      class: 'hunter',
      race:  { zh: '莫克纳萨', en: "Mok'Nathal" },
      rarity: 'rare',
      sigil: 'wolf',
      quote: '我与野兽同行，便从不孤独。',
      lore: '莫克纳萨混血兽人，与巨熊米莎为伴。厌倦文明纷争而独游荒野，却在部落危难时挺身而出：铲除塞拉摩之患，挫败戴林·普罗德摩尔，被萨尔封为「部落的勇士」。',
      stats: { might: 9, magic: 3, resolve: 7 }
    },

    {
      id: 'grommash-hellscream',
      fullArt: 'assets/portraits/wow-runtime/grommash-hellscream-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/grommash-hellscream-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/grommash-hellscream-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 321, y: 335, rx: 77, ry: 87 },
        { x: 81, y: 487, rx: 94, ry: 271 },
        { x: 621, y: 361, rx: 81, ry: 248 },
        { x: 554, y: 778, rx: 112, ry: 137 },
        { x: 55, y: 832, rx: 114, ry: 100 },
        { x: 332, y: 1000, rx: 440, ry: 110 }
      ] },
      name:  { zh: '格罗玛什·地狱咆哮', en: 'Grommash Hellscream' },
      title: { zh: '战歌酋长', en: 'Chieftain of the Warsong' },
      faction: 'horde',
      class: 'warrior',
      race:  { zh: '兽人', en: 'Orc' },
      rarity: 'legendary',
      sigil: 'axe',
      quote: '兽人永不为奴！',
      lore: '战歌氏族酋长，第一个饮下玛诺洛斯之血的兽人。灰谷之战与萨尔重逢，最终以自我牺牲手刃玛诺洛斯，斩断兽人血脉中的恶魔诅咒，为全族赎回自由。',
      stats: { might: 9, magic: 2, resolve: 8 }
    },

    {
      id: 'garrosh-hellscream',
      fullArt: 'assets/portraits/wow-runtime/garrosh-hellscream-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/garrosh-hellscream-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/garrosh-hellscream-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 322, y: 309, rx: 71, ry: 79 },
        { x: 61, y: 377, rx: 113, ry: 315 },
        { x: 593, y: 517, rx: 104, ry: 130 },
        { x: 43, y: 791, rx: 119, ry: 172 },
        { x: 633, y: 838, rx: 96, ry: 121 },
        { x: 332, y: 1000, rx: 440, ry: 106 }
      ] },
      name:  { zh: '加尔鲁什·地狱咆哮', en: 'Garrosh Hellscream' },
      title: { zh: '部落大酋长', en: 'Warchief of the Horde' },
      faction: 'horde',
      class: 'warrior',
      race:  { zh: '兽人', en: 'Orc' },
      rarity: 'epic',
      sigil: 'felflame',
      quote: '部落的力量，无可阻挡！',
      lore: '格罗玛什之子，自纳格兰走出父亲阴影，继任部落大酋长。铁血手腕荡平联盟数城，却日渐被傲慢与煞能吞噬。潘达利亚败亡后逃往平行时空，最终死于与萨尔的决斗。',
      stats: { might: 9, magic: 2, resolve: 5 }
    },

    /* ======================== 中立 NEUTRAL（7） ======================== */

    {
      id: 'illidan-stormrage',
      fullArt: 'assets/portraits/wow-runtime/illidan-stormrage-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/illidan-stormrage-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/illidan-stormrage-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, skipZones: [
        { x: 332, y: 255, rx: 116, ry: 107 },
        { x: 140, y: 435, rx: 105, ry: 210 },
        { x: 525, y: 448, rx: 100, ry: 208 },
        { x: 30, y: 438, rx: 56, ry: 320 },
        { x: 633, y: 438, rx: 56, ry: 320 },
        { x: 332, y: 170, rx: 115, ry: 55 },
        { x: 332, y: 997, rx: 430, ry: 110 }
      ] },
      name:  { zh: '伊利丹·怒风', en: 'Illidan Stormrage' },
      title: { zh: '背叛者', en: 'The Betrayer' },
      faction: 'neutral',
      class: 'demonhunter',
      race:  { zh: '暗夜精灵', en: 'Night Elf' },
      rarity: 'legendary',
      sigil: 'felflame',
      quote: '你们这是自寻死路！',
      lore: '玛法里奥的孪生弟弟，为对抗燃烧军团不惜汲取邪能，被族人囚禁万年。后占据外域自立为王，兵败黑暗神殿。军团再临时复生，最终以身为牢，永世看守萨格拉斯。',
      stats: { might: 8, magic: 10, resolve: 7 }
    },

    {
      id: 'arthas-menethil',
      fullArt: 'assets/portraits/wow-runtime/arthas-menethil-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/arthas-menethil-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/arthas-menethil-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 330, y: 238, rx: 68, ry: 72 },
        { x: 65, y: 440, rx: 105, ry: 260 },
        { x: 575, y: 343, rx: 100, ry: 270 },
        { x: 332, y: 997, rx: 425, ry: 108 },
        { x: 90, y: 855, rx: 140, ry: 105 },
        { x: 590, y: 855, rx: 130, ry: 105 }
      ] },
      name:  { zh: '阿尔萨斯·米奈希尔', en: 'Arthas Menethil' },
      title: { zh: '巫妖王', en: 'The Lich King' },
      faction: 'neutral',
      class: 'deathknight',
      race:  { zh: '人类', en: 'Human' },
      rarity: 'legendary',
      sigil: 'frost',
      quote: '霜之哀伤，饿了。',
      lore: '洛丹伦王子，白银之手圣骑士。为拯救子民追寻霜之哀伤，却沦为耐奥祖的傀儡，弑父灭国，加冕为巫妖王。冰冠堡垒之巅，在提里奥与勇士们的围攻下迎来终结。',
      stats: { might: 8, magic: 8, resolve: 6 }
    },

    {
      id: 'medivh',
      fullArt: 'assets/portraits/wow-runtime/medivh-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/medivh-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/medivh-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 330, y: 347, rx: 80, ry: 87 },
        { x: 64, y: 454, rx: 77, ry: 186 },
        { x: 578, y: 466, rx: 97, ry: 204 },
        { x: 101, y: 655, rx: 110, ry: 121 },
        { x: 600, y: 634, rx: 67, ry: 68 },
        { x: 332, y: 1000, rx: 440, ry: 115 }
      ] },
      name:  { zh: '麦迪文', en: 'Medivh' },
      title: { zh: '最后的守护者', en: 'The Last Guardian' },
      faction: 'neutral',
      class: 'mage',
      race:  { zh: '人类', en: 'Human' },
      rarity: 'legendary',
      sigil: 'eye',
      quote: '战鼓，将再次擂响。',
      lore: '提瑞斯法最后的守护者，萨格拉斯之魂自幼寄居其体内。受腐化开启黑暗之门，引来兽人大军；死于卡德加之手后，以先知之魂归来，指引联盟与部落共赴海加尔山。',
      stats: { might: 4, magic: 10, resolve: 7 }
    },

    {
      id: 'guldan',
      fullArt: 'assets/portraits/wow-runtime/guldan-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/guldan-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/guldan-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 326, y: 409, rx: 82, ry: 101 },
        { x: 63, y: 585, rx: 110, ry: 182 },
        { x: 618, y: 556, rx: 111, ry: 230 },
        { x: 30, y: 822, rx: 107, ry: 184 },
        { x: 638, y: 842, rx: 110, ry: 157 },
        { x: 332, y: 1000, rx: 440, ry: 105 }
      ] },
      name:  { zh: '古尔丹', en: "Gul'dan" },
      title: { zh: '第一位术士', en: 'The First Warlock' },
      faction: 'neutral',
      class: 'warlock',
      race:  { zh: '兽人', en: 'Orc' },
      rarity: 'legendary',
      sigil: 'skull',
      quote: '喝吧，这是你们的命运。',
      lore: '影月氏族叛萨满，耐奥祖的逆徒，第一位兽人术士。以恶魔之血奴役兽人诸族，缔造部落入侵艾泽拉斯；为寻萨格拉斯之眼葬身萨格拉斯之墓，徒留颅骨为邪能圣物。',
      stats: { might: 3, magic: 10, resolve: 5 }
    },

    {
      id: 'kaelthas-sunstrider',
      fullArtNonMetalZones: [ // solar glow, clouds and sunlit stone; central gold armor stays metallic
        { x: 332, y: 120, rx: 440, ry: 225 },
        { x: 55, y: 535, rx: 125, ry: 330 },
        { x: 600, y: 540, rx: 145, ry: 350 },
        { x: 332, y: 1024, rx: 450, ry: 120 }
      ],
      fullArt: 'assets/portraits/wow-runtime/kaelthas-sunstrider-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/kaelthas-sunstrider-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/kaelthas-sunstrider-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 345, y: 284, rx: 76, ry: 87 },
        { x: 250, y: 234, rx: 28, ry: 27 },
        { x: 464, y: 296, rx: 28, ry: 28 },
        { x: 179, y: 368, rx: 25, ry: 26 },
        { x: 142, y: 384, rx: 64, ry: 74 },
        { x: 57, y: 588, rx: 103, ry: 241 },
        { x: 609, y: 574, rx: 84, ry: 287 },
        { x: 332, y: 1000, rx: 440, ry: 103 }
      ] },
      name:  { zh: '凯尔萨斯·逐日者', en: "Kael'thas Sunstrider" },
      title: { zh: '血精灵王子', en: 'Prince of the Blood Elves' },
      faction: 'neutral',
      class: 'mage',
      race:  { zh: '血精灵', en: 'Blood Elf' },
      rarity: 'legendary',
      sigil: 'phoenix',
      quote: '为了奎尔萨拉斯！',
      lore: '逐日者王朝最后的王子。奎尔萨拉斯沦陷后率族人改称血精灵，为解魔瘾先后依附伊利丹与基尔加丹，最终在魔导师平台以邪能水晶重生，殒落于族人之手。',
      stats: { might: 4, magic: 10, resolve: 6 }
    },

    {
      id: 'kelthuzad',
      fullArt: 'assets/portraits/wow-runtime/kelthuzad-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/kelthuzad-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/kelthuzad-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 326, y: 310, rx: 64, ry: 97 },
        { x: 75, y: 487, rx: 96, ry: 342 },
        { x: 628, y: 541, rx: 82, ry: 329 },
        { x: 82, y: 823, rx: 143, ry: 119 },
        { x: 571, y: 829, rx: 134, ry: 123 },
        { x: 332, y: 1000, rx: 440, ry: 118 }
      ] },
      name:  { zh: '克尔苏加德', en: "Kel'Thuzad" },
      title: { zh: '大巫妖', en: 'The Archlich' },
      faction: 'neutral',
      class: 'warlock',
      race:  { zh: '巫妖', en: 'Lich' },
      rarity: 'epic',
      sigil: 'rune',
      quote: '死亡之寒，将吞噬一切。',
      lore: '前肯瑞托大法师，响应巫妖王低语创立诅咒教派，死后被复活为巫妖。镇守浮空城纳克萨玛斯，两度败亡两度归来，是天灾军团最忠诚的高阶统帅。',
      stats: { might: 3, magic: 9, resolve: 6 }
    },

    {
      id: 'maiev-shadowsong',
      fullArt: 'assets/portraits/wow-runtime/maiev-shadowsong-imagegen-v1-full.webp',
      fullArtThumb: 'assets/portraits/wow-runtime/maiev-shadowsong-imagegen-v1-thumb.webp',
      fullArtHeight: 'assets/portraits/wow-runtime/maiev-shadowsong-imagegen-v1-aiheight.webp',
      fullArtCropBottom: 0.16,
      fullArtHeightSmoothing: 2,
      goldLineParams: { moonRing: false, minComp: 900, skipZones: [
        { x: 328, y: 339, rx: 78, ry: 119 },
        { x: 15, y: 522, rx: 105, ry: 365 },
        { x: 661, y: 498, rx: 83, ry: 333 },
        { x: 579, y: 596, rx: 58, ry: 161 },
        { x: 628, y: 937, rx: 138, ry: 139 },
        { x: 332, y: 1010, rx: 440, ry: 98 }
      ] },
      name:  { zh: '玛维·影歌', en: 'Maiev Shadowsong' },
      title: { zh: '守望者', en: 'The Warden' },
      faction: 'neutral',
      class: 'rogue',
      race:  { zh: '暗夜精灵', en: 'Night Elf' },
      rarity: 'epic',
      sigil: 'shadow',
      quote: '正义，由我亲手执行。',
      lore: '艾露恩姐妹会高阶女祭司，伊利丹的典狱长。伊利丹脱困后率守望者万里追猎至外域，亲历黑暗神殿决战。宿敌陨落后，她以毕生执念换来空虚，仍独行于卡多雷边缘。',
      stats: { might: 8, magic: 4, resolve: 10 }
    }
  ];

  /* 深冻结 */
  function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    Object.keys(obj).forEach(function (key) { deepFreeze(obj[key]); });
    return Object.freeze(obj);
  }

  deepFreeze(WOW_CLASS_INFO);
  deepFreeze(WOW_RARITY_INFO);
  deepFreeze(WOW_HEROES);

  /* 契约自检：仅 console.warn，绝不 throw */
  (function selfCheck() {
    var LEGAL_SIGILS = ('lion wolf frost moon leaf skull felflame hammer tide eye ' +
                        'phoenix rune bow shadow sun axe light serpent storm book totem').split(' ');
    var LEGAL_FACTIONS = ['alliance', 'horde', 'neutral'];
    var LEGAL_RARITIES = ['legendary', 'epic', 'rare'];

    var warn = function (msg) {
      if (global.console && typeof global.console.warn === 'function') {
        global.console.warn('[heroes-data-wow] 数据契约警告：' + msg);
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

  global.WOW_CLASS_INFO = WOW_CLASS_INFO;
  global.WOW_RARITY_INFO = WOW_RARITY_INFO;
  global.WOW_HEROES = WOW_HEROES;

})(typeof window !== 'undefined' ? window : globalThis);
