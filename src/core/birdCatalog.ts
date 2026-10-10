import type { BirdDefinition } from './types';

export const SCORE_BY_LENGTH: Readonly<Record<number, number>> = {
  2: 10,
  3: 30,
  4: 70,
};

export const IOC_15_2_SOURCE = 'IOC World Bird List v15.2 multilingual master list';

interface CatalogEntry {
  assetKey: string;
  name: string;
  scientificName: string;
  family: string;
  aliases?: readonly string[];
}

const entries: readonly CatalogEntry[] = [
  { assetKey: 'xique', name: '喜鹊', scientificName: 'Pica serica', family: 'Corvidae' },
  { assetKey: 'huixique', name: '灰喜鹊', scientificName: 'Cyanopica cyanus', family: 'Corvidae' },
  { assetKey: 'bailu', name: '白鹭', scientificName: 'Egretta garzetta', family: 'Ardeidae', aliases: ['小白鹭'] },
  { assetKey: 'dabailu', name: '大白鹭', scientificName: 'Ardea alba', family: 'Ardeidae' },
  { assetKey: 'canglu', name: '苍鹭', scientificName: 'Ardea cinerea', family: 'Ardeidae' },
  { assetKey: 'yelu', name: '夜鹭', scientificName: 'Nycticorax nycticorax', family: 'Ardeidae' },
  { assetKey: 'chilu', name: '池鹭', scientificName: 'Ardeola bacchus', family: 'Ardeidae' },
  { assetKey: 'hongsun', name: '红隼', scientificName: 'Falco tinnunculus', family: 'Falconidae' },
  { assetKey: 'baitoubei', name: '白头鹎', scientificName: 'Pycnonotus sinensis', family: 'Pycnonotidae' },
  { assetKey: 'heishuiji', name: '黑水鸡', scientificName: 'Gallinula chloropus', family: 'Rallidae' },
  { assetKey: 'zhujingbanjiu', name: '珠颈斑鸠', scientificName: 'Spilopelia chinensis', family: 'Columbidae' },
  { assetKey: 'shanbanjiu', name: '山斑鸠', scientificName: 'Streptopelia orientalis', family: 'Columbidae' },
  { assetKey: 'hongfujinji', name: '红腹锦鸡', scientificName: 'Chrysolophus pictus', family: 'Phasianidae' },
  { assetKey: 'daisheng', name: '戴胜', scientificName: 'Upupa epops', family: 'Upupidae' },
  { assetKey: 'shumaque', name: '树麻雀', scientificName: 'Passer montanus', family: 'Passeridae', aliases: ['麻雀'] },
  { assetKey: 'jiayan', name: '家燕', scientificName: 'Hirundo rustica', family: 'Hirundinidae' },
  { assetKey: 'jinyaoyan', name: '金腰燕', scientificName: 'Cecropis daurica', family: 'Hirundinidae' },
  { assetKey: 'baiyaoyuyan', name: '白腰雨燕', scientificName: 'Apus pacificus', family: 'Apodidae' },
  { assetKey: 'baijiling', name: '白鹡鸰', scientificName: 'Motacilla alba', family: 'Motacillidae' },
  { assetKey: 'huangjiling', name: '黄鹡鸰', scientificName: 'Motacilla tschutschensis', family: 'Motacillidae' },
  { assetKey: 'huijiling', name: '灰鹡鸰', scientificName: 'Motacilla cinerea', family: 'Motacillidae' },
  { assetKey: 'shuliu', name: '树鹨', scientificName: 'Anthus hodgsoni', family: 'Motacillidae' },
  { assetKey: 'shuiliu', name: '水鹨', scientificName: 'Anthus spinoletta', family: 'Motacillidae' },
  { assetKey: 'yunque', name: '云雀', scientificName: 'Alauda arvensis', family: 'Alaudidae' },
  { assetKey: 'xiaoyunque', name: '小云雀', scientificName: 'Alauda gulgula', family: 'Alaudidae' },
  { assetKey: 'wudong', name: '乌鸫', scientificName: 'Turdus mandarinus', family: 'Turdidae' },
  { assetKey: 'huiliangniao', name: '灰椋鸟', scientificName: 'Spodiopsar cineraceus', family: 'Sturnidae' },
  { assetKey: 'bage', name: '八哥', scientificName: 'Acridotheres cristatellus', family: 'Sturnidae' },
  { assetKey: 'liaoge', name: '鹩哥', scientificName: 'Gracula religiosa', family: 'Sturnidae' },
  { assetKey: 'siguangliangniao', name: '丝光椋鸟', scientificName: 'Spodiopsar sericeus', family: 'Sturnidae' },
  { assetKey: 'beiliangniao', name: '北椋鸟', scientificName: 'Agropsar sturninus', family: 'Sturnidae' },
  { assetKey: 'zichiliangniao', name: '紫翅椋鸟', scientificName: 'Sturnus vulgaris', family: 'Sturnidae' },
  { assetKey: 'dashanque', name: '大山雀', scientificName: 'Parus cinereus', family: 'Paridae' },
  { assetKey: 'huangfushanque', name: '黄腹山雀', scientificName: 'Periparus venustulus', family: 'Paridae' },
  { assetKey: 'zhaozeshanque', name: '沼泽山雀', scientificName: 'Poecile palustris', family: 'Paridae' },
  { assetKey: 'hetoushanque', name: '褐头山雀', scientificName: 'Poecile montanus', family: 'Paridae' },
  { assetKey: 'shanmaque', name: '山麻雀', scientificName: 'Passer cinnamomeus', family: 'Passeridae' },
  { assetKey: 'heidingmaque', name: '黑顶麻雀', scientificName: 'Passer ammodendri', family: 'Passeridae' },
  { assetKey: 'yanque', name: '燕雀', scientificName: 'Fringilla montifringilla', family: 'Fringillidae' },
  { assetKey: 'huangque', name: '黄雀', scientificName: 'Spinus spinus', family: 'Fringillidae' },
  { assetKey: 'jinchique', name: '金翅雀', scientificName: 'Chloris sinica', family: 'Fringillidae' },
  { assetKey: 'hongjiaozuique', name: '红交嘴雀', scientificName: 'Loxia curvirostra', family: 'Fringillidae' },
  { assetKey: 'yansun', name: '燕隼', scientificName: 'Falco subbuteo', family: 'Falconidae' },
  { assetKey: 'yousun', name: '游隼', scientificName: 'Falco peregrinus', family: 'Falconidae' },
  { assetKey: 'liesun', name: '猎隼', scientificName: 'Falco cherrug', family: 'Falconidae' },
  { assetKey: 'putongcuiniao', name: '普通翠鸟', scientificName: 'Alcedo atthis', family: 'Alcedinidae' },
  { assetKey: 'baixiongfeicui', name: '白胸翡翠', scientificName: 'Halcyon smyrnensis', family: 'Alcedinidae' },
  { assetKey: 'lanfeicui', name: '蓝翡翠', scientificName: 'Halcyon pileata', family: 'Alcedinidae' },
  { assetKey: 'sanbaoniao', name: '三宝鸟', scientificName: 'Eurystomus orientalis', family: 'Coraciidae' },
  { assetKey: 'putongyeying', name: '普通夜鹰', scientificName: 'Caprimulgus jotaka', family: 'Caprimulgidae' },
  { assetKey: 'baixian', name: '白鹇', scientificName: 'Lophura nycthemera', family: 'Phasianidae' },
  { assetKey: 'shaoji', name: '勺鸡', scientificName: 'Pucrasia macrolopha', family: 'Phasianidae' },
  { assetKey: 'anchun', name: '鹌鹑', scientificName: 'Coturnix japonica', family: 'Phasianidae' },
  { assetKey: 'lutouya', name: '绿头鸭', scientificName: 'Anas platyrhynchos', family: 'Anatidae' },
  { assetKey: 'banzuiya', name: '斑嘴鸭', scientificName: 'Anas zonorhyncha', family: 'Anatidae' },
  { assetKey: 'chimaya', name: '赤麻鸭', scientificName: 'Tadorna ferruginea', family: 'Anatidae' },
  { assetKey: 'yuanyang', name: '鸳鸯', scientificName: 'Aix galericulata', family: 'Anatidae' },
  { assetKey: 'fengtouqianya', name: '凤头潜鸭', scientificName: 'Aythya fuligula', family: 'Anatidae' },
  { assetKey: 'datiane', name: '大天鹅', scientificName: 'Cygnus cygnus', family: 'Anatidae' },
  { assetKey: 'xiaotiane', name: '小天鹅', scientificName: 'Cygnus columbianus', family: 'Anatidae' },
  { assetKey: 'hongyan', name: '鸿雁', scientificName: 'Anser cygnoides', family: 'Anatidae' },
  { assetKey: 'douyan', name: '豆雁', scientificName: 'Anser fabalis', family: 'Anatidae' },
  { assetKey: 'dandinghe', name: '丹顶鹤', scientificName: 'Grus japonensis', family: 'Gruidae' },
  { assetKey: 'baizhenhe', name: '白枕鹤', scientificName: 'Antigone vipio', family: 'Gruidae' },
  { assetKey: 'huihe', name: '灰鹤', scientificName: 'Grus grus', family: 'Gruidae' },
  { assetKey: 'baihe', name: '白鹤', scientificName: 'Leucogeranus leucogeranus', family: 'Gruidae' },
  { assetKey: 'suoyuhe', name: '蓑羽鹤', scientificName: 'Grus virgo', family: 'Gruidae' },
  { assetKey: 'dongfangbaiguan', name: '东方白鹳', scientificName: 'Ciconia boyciana', family: 'Ciconiidae' },
  { assetKey: 'heiguan', name: '黑鹳', scientificName: 'Ciconia nigra', family: 'Ciconiidae' },
  { assetKey: 'fengtoumaiji', name: '凤头麦鸡', scientificName: 'Vanellus vanellus', family: 'Charadriidae' },
  { assetKey: 'jinkuangheng', name: '金眶鸻', scientificName: 'Thinornis dubius', family: 'Charadriidae' },
  { assetKey: 'huanjingheng', name: '环颈鸻', scientificName: 'Anarhynchus alexandrinus', family: 'Charadriidae' },
  { assetKey: 'heiweichengyu', name: '黑尾塍鹬', scientificName: 'Limosa limosa', family: 'Scolopacidae' },
  { assetKey: 'fanzuiyu', name: '反嘴鹬', scientificName: 'Recurvirostra avosetta', family: 'Recurvirostridae' },
  { assetKey: 'hongzuiou', name: '红嘴鸥', scientificName: 'Chroicocephalus ridibundus', family: 'Laridae' },
  { assetKey: 'heiweiou', name: '黑尾鸥', scientificName: 'Larus crassirostris', family: 'Laridae' },
  { assetKey: 'putongyanou', name: '普通燕鸥', scientificName: 'Sterna hirundo', family: 'Laridae' },
  { assetKey: 'putongluci', name: '普通鸬鹚', scientificName: 'Phalacrocorax carbo', family: 'Phalacrocoracidae' },
  { assetKey: 'juanyutihu', name: '卷羽鹈鹕', scientificName: 'Pelecanus crispus', family: 'Pelecanidae' },
  { assetKey: 'bantouxiuliu', name: '斑头鸺鹠', scientificName: 'Glaucidium cuculoides', family: 'Strigidae' },
  { assetKey: 'hongjiaoxiao', name: '红角鸮', scientificName: 'Otus sunia', family: 'Strigidae' },
  { assetKey: 'changerxiao', name: '长耳鸮', scientificName: 'Asio otus', family: 'Strigidae' },
  { assetKey: 'duanerxiao', name: '短耳鸮', scientificName: 'Asio flammeus', family: 'Strigidae' },
  { assetKey: 'dadujuan', name: '大杜鹃', scientificName: 'Cuculus canorus', family: 'Cuculidae' },
  { assetKey: 'sishengdujuan', name: '四声杜鹃', scientificName: 'Cuculus micropterus', family: 'Cuculidae' },
  { assetKey: 'zaojuan', name: '噪鹃', scientificName: 'Eudynamys scolopaceus', family: 'Cuculidae' },
  { assetKey: 'putongyangji', name: '普通秧鸡', scientificName: 'Rallus indicus', family: 'Rallidae' },
  { assetKey: 'zongbeibolao', name: '棕背伯劳', scientificName: 'Lanius schach', family: 'Laniidae' },
  { assetKey: 'hongweibolao', name: '红尾伯劳', scientificName: 'Lanius cristatus', family: 'Laniidae' },
  { assetKey: 'beihongweiqu', name: '北红尾鸲', scientificName: 'Phoenicurus auroreus', family: 'Muscicapidae' },
  { assetKey: 'quequ', name: '鹊鸲', scientificName: 'Copsychus saularis', family: 'Muscicapidae' },
  { assetKey: 'ouyaqu', name: '欧亚鸲', scientificName: 'Erithacus rubecula', family: 'Muscicapidae' },
  { assetKey: 'honghougequ', name: '红喉歌鸲', scientificName: 'Calliope calliope', family: 'Muscicapidae' },
  { assetKey: 'huamei', name: '画眉', scientificName: 'Garrulax canorus', family: 'Leiothrichidae' },
  { assetKey: 'wenxuque', name: '文须雀', scientificName: 'Panurus biarmicus', family: 'Panuridae' },
  { assetKey: 'zhendanyanque', name: '震旦鸦雀', scientificName: 'Paradoxornis heudei', family: 'Paradoxornithidae' },
  { assetKey: 'zongtouyanque', name: '棕头鸦雀', scientificName: 'Suthora webbiana', family: 'Paradoxornithidae' },
  { assetKey: 'huiwenweng', name: '灰纹鹟', scientificName: 'Muscicapa griseisticta', family: 'Muscicapidae' },
  { assetKey: 'wuweng', name: '乌鹟', scientificName: 'Muscicapa sibirica', family: 'Muscicapidae' },
  { assetKey: 'langequ', name: '蓝歌鸲', scientificName: 'Larvivora cyane', family: 'Muscicapidae' },
] as const;

function toBird(entry: CatalogEntry): BirdDefinition {
  const characters = Array.from(entry.name);
  const score = SCORE_BY_LENGTH[characters.length];
  if (score === undefined) throw new Error(`Unsupported bird-name length: ${entry.name}`);
  return {
    id: `bird:${entry.assetKey}`,
    name: entry.name,
    characters,
    characterCount: characters.length,
    score,
    assetKey: entry.assetKey,
    scientificName: entry.scientificName,
    family: entry.family,
    source: IOC_15_2_SOURCE,
    ...(entry.aliases ? { aliases: [...entry.aliases] } : {}),
  };
}

/** Canonical V2 species catalog. Biological species occur exactly once. */
export const BIRD_CATALOG: readonly BirdDefinition[] = entries.map(toBird);

const legacyLittleEgret: BirdDefinition = {
  ...toBird({
    assetKey: 'xiaobailu',
    name: '小白鹭',
    scientificName: 'Egretta garzetta',
    family: 'Ardeidae',
  }),
  legacyOnly: true,
  canonicalBirdId: 'bird:bailu',
};

const LEGACY_BIRD_IDS = [
  'bird:xique',
  'bird:huixique',
  'bird:bailu',
  'bird:dabailu',
  'bird:xiaobailu',
  'bird:canglu',
  'bird:yelu',
  'bird:chilu',
  'bird:hongsun',
  'bird:baitoubei',
  'bird:heishuiji',
  'bird:zhujingbanjiu',
  'bird:shanbanjiu',
  'bird:hongfujinji',
  'bird:daisheng',
  'bird:shumaque',
] as const;

/** Frozen Levels 1–3 recognition catalog, including the historical 小白鹭 entry. */
export const LEGACY_GAMEPLAY_BIRD_CATALOG: readonly BirdDefinition[] = LEGACY_BIRD_IDS.map((id) => {
  const bird = id === legacyLittleEgret.id
    ? legacyLittleEgret
    : BIRD_CATALOG.find((candidate) => candidate.id === id);
  if (!bird) throw new Error(`Missing legacy bird: ${id}`);
  return bird;
});
