# Bird Catalog V2 provenance

## Scope

The canonical catalog contains 100 biological species selected for a future 90-tile content pool. Every approved gameplay name has two to four Chinese characters. The selection favors species occurring in China and spreads entries across 36 taxonomic families and multiple habitats; shared Chinese characters are a lexical property only and are not treated as evidence of biological relatedness.

The machine-readable artwork-planning export is [`bird-catalog.json`](./bird-catalog.json). It contains stable IDs and asset keys, approved Chinese names, character arrays and counts, scientific names, families, source labels, and research aliases.

## Primary references

- Taxonomy, scientific names, family placement, and approved Simplified Chinese names: [IOC World Bird List v15.2 multilingual master list](https://www.worldbirdnames.org/new/ioc-lists/master-list-2/).
- Independent source cross-check: [eBird/Clements v2025 common-name spreadsheet](https://support.ebird.org/en/support/solutions/articles/48000804865). eBird describes its Simplified Chinese list as covering species known from China.
- Clements version and citation context: [Clements Checklist v2025 downloads](https://www.birds.cornell.edu/clementschecklist/introduction/updateindex/october-2025/2025-citation-checklist-downloads/).
- The 小白鹭/白鹭 legacy-name decision was checked against Chinese government records that use [小白鹭 for *Egretta garzetta*](https://www.mee.gov.cn/ywgz/hjyxpj/jsxmhjyxpj/xmslqk/201605/W020160522154509145898.pdf) and [白鹭 for the same species](https://www.mee.gov.cn/ywdt/gs/wqgs_1/201811/W020181102549876441869.pdf).

The catalog was matched row-by-row against IOC v15.2. A scientific-name join against the eBird/Clements v2025 Chinese list found all 100 species; 99 approved names were exact matches. The sole expected presentation difference was the preserved legacy gameplay name 树麻雀, which eBird/Clements renders as “麻雀 (树麻雀)”.

## Inclusion and verification rules

1. Each canonical entry represents one unique scientific species; scientific names, IDs, asset keys, and approved gameplay names are unique.
2. Names must be present in the inspected multilingual taxonomy source. Generic bird groups, invented names, and synonyms are excluded as standalone canonical entries.
3. Stable IDs use `bird:<assetKey>`. They do not derive from scientific names, so later taxonomic genus changes do not break artwork or saved references.
4. Aliases are research metadata only. They are not accepted as additional composition words and do not create extra sampling entries.
5. Canonical sampling uses only `BIRD_CATALOG`. Levels 1–2 retain the frozen `LEGACY_GAMEPLAY_BIRD_CATALOG`. Playable Level 3 recognizes only the canonical species sampled for its validated seed; its solver and strategy evaluator use that same active catalog.

## Legacy compatibility

- `bird:bailu` remains the canonical *Egretta garzetta* entry, with 小白鹭 recorded as an alias.
- `bird:xiaobailu` and asset key `xiaobailu` remain in the frozen 16-entry gameplay catalog only. The legacy record points to `bird:bailu` and is excluded from canonical species counts, graph analysis, and V2 sampling.
- `bird:shumaque` retains its accepted gameplay name 树麻雀 and asset key. 麻雀 is stored only as research alias metadata.
- No score, bird ID, or accepted Level 1–2 legacy composition name was changed. The earlier 59-tile Level 3 fixtures remain as historical solver regression data; playable Level 3 now uses the 90-tile Piachan board and canonical sampled species.

## Known uncertainties

- Taxonomies change over time. IOC v15.2 is the milestone standard; future checklist updates may change genera, family placement, or preferred Chinese display forms. Such changes require a reviewed data migration and must not rewrite stable IDs.
- IOC and Clements can place a species in different genera during transitions. The catalog intentionally follows IOC v15.2 when the two differ.
- “Occurs in China” is broad and does not mean common throughout China. This milestone does not encode range, abundance, conservation status, or regional subspecies.
- Alias metadata is deliberately incomplete; only aliases needed to explain preserved legacy names are included.
