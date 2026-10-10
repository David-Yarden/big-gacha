const mongoose = require("mongoose");

// Official translations of a document's texts (i18n.fr…), filled by the sync
// (src/sync/i18n.js). Added to every schema, before the models are compiled.
mongoose.plugin((schema) => {
  if (!schema.path("i18n") && schema.path("game")) schema.add({ i18n: mongoose.Schema.Types.Mixed });
});

module.exports = {
  Character: require("./Character"),
  Weapon: require("./Weapon"),
  Artifact: require("./Artifact"),
  Material: require("./Material"),
  Talent: require("./Talent"),
  Constellation: require("./Constellation"),
  // HSR
  LightCone: require("./LightCone"),
  Relic: require("./Relic"),
  Trace: require("./Trace"),
  Eidolon: require("./Eidolon"),
  // WuWa
  Forte: require("./Forte"),
  ResonanceChain: require("./ResonanceChain"),
  Echo: require("./Echo"),
  EchoSet: require("./EchoSet"),
  // ZZZ
  AgentKit: require("./AgentKit"),
  Bangboo: require("./Bangboo"),
  Reference: require("./Reference"),
  Banner: require("./Banner"),
  Plan: require("./Plan"),
  // Sync
  SyncState: require("./SyncState"),
  Changelog: require("./Changelog"),
  // Kit enhancements
  ...require("./Enhancement"),
};
