# V6.1 provincial evidence and puzzle audit

Reviewed 2026-10-12. This manifest stores individual factual name/occurrence matches and citations, not copies of third-party checklists, PDFs, observations, or media. “本游戏已收录” is the curated playable subset, never a claim about total provincial biodiversity. Source rights are not a blanket content-reuse license; artwork, source tables, and bulk records are not redistributed.

## Sources and review scope

| Region | Source | Scope and limitation | Checked candidates | Accepted | Unresolved/rejected |
| --- | --- | --- | ---: | ---: | ---: |
| 辽宁 | [辽宁省林业和草原局 2021 list](https://lyt.ln.gov.cn/lyt/xxgk/zcwj/slyhcyjbgswj/985B2EAF0E9948D1B1F911F3E7322A72/index.shtml) | Provincial natural occurrence of protected land wildlife, not a complete bird list | 24 | 22 | 2 |
| 广东 | [2022 Zhuhai Qi'ao peer-reviewed survey](https://www.jeesci.com/EN/10.16258/j.cnki.1674-5906.2022.02.007) | Local reserve in Guangdong, not a province-wide checklist | 24 | 22 | 2 |
| 四川 | [2020 provincial checklist](https://html.rhhz.net/scdwzz/html/61796.htm) | Provincial 757-species revision; 2020 taxonomic treatment | 26 | 24 | 2 |
| 云南 | [2023 Wenshan checklist appendix](https://www.ere.ac.cn/attached/file/20230313/20230313104840_979.pdf) | Wenshan City within Yunnan, not a province-wide checklist | 22 | 19 | 3 |

“Checked candidates” means the accepted rows plus explicitly queued conflicts, not a screening of all 100 canonical catalog species against every source. Beijing's original ten records remain in the V6.0 manifest; the V6.1 manifest adds individual source IDs and row numbers for each new acceptance. All playable IDs still resolve to the unchanged canonical catalog.

The [Guangdong official appendix](https://www.gdqy.gov.cn/attachment/0/89/89094/1577364.pdf) and [government-hosted copy](https://www.lianzhou.gov.cn/qylzlyj/attachment/0/109/109177/1674173.pdf) could not be fetched in this environment (HTTP 412/timeout). The published local survey above supplies independently inspectable rows, but broader Guangdong coverage remains a follow-up. The [Yunnan KIZ bird database](https://datacenter.kiz.ac.cn/Database/BirdIndex) uses older names; the [2021 Yunnan protection appendix](https://lcj.yn.gov.cn/uploadfile/s37/2022/1012/20221012060529475.pdf) lacks Latin names. Neither was silently substituted for the exact-match Wenshan rows. The [2025 Yunnan forestry page](https://lcj.yn.gov.cn/html/2025/zdlyxxgkqt_0922/75325.html) has image-only lists, which were not treated as reviewed entries.

Conflicts remain in `data/regional-review-v6.1.json`: Liaoning/四川 鸿雁 `Anser cygnoid` versus canonical `Anser cygnoides`; Liaoning 白枕鹤 `Grus vipio` versus `Antigone vipio`; 广东/云南 珠颈斑鸠 `Streptopelia chinensis` versus `Spilopelia chinensis`; 广东 大山雀 `Parus major` versus `Parus cinereus`; 四川 棕头鸦雀 `Sinosuthora webbiana` versus `Suthora webbiana`; 云南 鸳鸯 source spelling `Aix galriculata` versus `Aix galericulata`; 云南 喜鹊 `Pica pica` versus `Pica serica`. These entries do not enter gameplay. This is an explicit no-synonym editorial policy, not a conclusion that every source taxon is biologically distinct.

## Certified puzzle inventory

All eight new puzzles use the existing 22/33-tile tutorial geometry, exact approved word occurrences, ten-slot tray, puzzle-scoped quotas, and full engine-replayed winning traces. The 11 initially exposed tiles are a property of that geometry. “Early formable” is measured after the first two certificate takes; it is one for every new puzzle. This does not imply arbitrary player choices are safe.

| Region/stage | Exact puzzle ID | Board hash | Unique words | Repeated words | Witness max tray | Fixed non-oracle baseline |
| --- | --- | --- | ---: | --- | ---: | --- |
| 辽宁 1 | `regional:e826323ba9705d05d14ee165171cd61dfc90f62e848670af271bd8b139c8779d` | `a75e5e39454fdb41aa87728bcb164b97d13184242d8634e930f572d657c3ab11` | 10 | 勺鸡 ×2 | 2 | WIN, 33 actions |
| 辽宁 2 | `regional:9f5bcac7cba29e81ef7893a25ceb0efa66286152fe66f68ac6c3dc9a2d86b57e` | `c0cf186e9061e1fc151449bec1fe9b02051266c23260f83bae46f7f14b361118` | 13 | none | 3 | WIN, 46 actions |
| 广东 1 | `regional:a59fe0d46b7bb49909ba2b10b6e22b2235c338633988da9f10255fd39fbb55a3` | `e25f7fc7bcd2e69cb7647df0a97162e72257445908172e3ddd1873700eab4812` | 9 | 苍鹭 ×2, 池鹭 ×2 | 2 | WIN, 33 actions |
| 广东 2 | `regional:1cd093f65d3dacd844379aaebec60aee91f1902761c96a01a653bfae5d8fb2b1` | `91fdee6caf5a2629afb9598076c3a123450510f9116ab7df5a10c228407f5a91` | 10 | none | 4 | LOSS, 16 actions |
| 四川 1 | `regional:97bee33cd38e04b6f6e926350e2803f1a4dd259d601c1b9b11718adf366df671` | `a089126b56a30eaf5a83f551d9cbbfca11546516615328a3b7a4ec0fc9084223` | 11 | none | 2 | WIN, 33 actions |
| 四川 2 | `regional:8ec853ac1f6f30d1c2d4a71e8cd0c48717d6106c0ecc0cda275f2c640a76a286` | `2624e65cf29e2c549e499ca9bb4af616349c8ba611d752ee80c540e86f21860b` | 11 | none | 4 | WIN, 44 actions |
| 云南 1 | `regional:4f8773d4c5864d00562f62ba544df86e1b406f4253048e78ae948350750fc703` | `32b8294a5bf12e34c6bdbf58e8f597e723b80cd815a69b5a756ee6a83161bf9c` | 8 | 噪鹃 ×2, 池鹭 ×2, 苍鹭 ×2 | 2 | WIN, 33 actions |
| 云南 2 | `regional:544f0ce3a9f8cb5591c324dcc0e86867ad9cf49da441b2b37290f354da9bf290` | `b7b25a637506e106c091164c24177b378b68531a0aeafffdc0ddb72010c87859` | 10 | none | 4 | LOSS, 16 actions |

The baseline is **not** a human difficulty rating or solver certificate: it greedily composes the first available word by stable ID, otherwise takes the first exposed tile by stable ID, for at most 100 actions. 广东 2 and 云南 2 lose under this baseline and need human playtest before being called approachable; both nonetheless have engine-replayed winning certificates. The other six wins do not prove no-loss play.

Beijing's original puzzle IDs and board hashes are pinned in `tests/regional-v6.test.ts`; they and the original words/solutions remain unchanged. The V5 production bank (105) and experimental bank (15), global 103-composition registry, V5.3.1 ruleset, and browser-local storage keys are not modified. Version 1 regional progress loads existing completion/discovery records unchanged and adds new province keys independently.
