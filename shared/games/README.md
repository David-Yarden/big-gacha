# Kit enhancements

One YAML file per mechanic in `shared/games/<game>/enhancements/`.
Adding a new mechanic (a Genshin "Witch's Revelation", an HSR "Novaflare", …) = adding a file:
no code to write. Files are loaded at server start, after each sync, and with
`POST /api/enhancements/reload`. A file with an error is rejected as a whole (the previous
version stays in place) and the error is shown in `GET /api/enhancements/status`.

```yaml
id: witchs-revelation          # unique per game, used in URLs and filters
name: "Witch's Revelation"     # displayed name
version: "6.7"                 # game version that introduced it
kind: addition                 # addition = extra text shown under the base kit
                               # rework   = replaces parts of the kit ("original" ↔ "enhanced")
color: sky                     # violet | amber | sky | emerald | rose | orange
condition: "…"                 # optional — how it is unlocked / activated
description: "…"               # optional
verified: false                # optional — false shows a "not verified" warning
characters: [Kafka, …]         # optional — characters affected even without entries
entries:
  - character: Yae Miko        # must exist in the database for that game
    target: constellation.c1   # see targets below
    text: "…"                  # addition: the extra effect
    sources: [https://…]       # optional
  - character: Kafka
    target: eidolon.e1
    original: { name: "…", description: "…" }   # rework: text before
    enhanced: { name: "…", description: "…" }   # rework: text after
```

## Targets

| Game | Targets |
|---|---|
| genshin | `talent.combat1` `talent.combat2` `talent.combat3` `talent.combatsp` `talent.passive1`…`passive4` `talent.extra` (an additional talent) · `constellation.c1`…`c6` `constellation.all` |
| hsr | `trace.basicAtk` `trace.skill` `trace.ultimate` `trace.talent` `trace.technique` `trace.extra` · `eidolon.e1`…`e6` `eidolon.all` |
| wuwa | `forte.basicAtk` `forte.resonanceSkill` `forte.resonanceLiberation` `forte.forteCircuit` `forte.introSkill` `forte.extra` · `chain.s1`…`s6` `chain.all` |
