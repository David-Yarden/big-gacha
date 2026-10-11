/** One adapter per game whose data can be synchronised automatically. */
module.exports = {
  genshin: require("./genshin"),
  hsr: require("./hsr"),
  wuwa: require("./wuwa"),
  zzz: require("./zzz"),
  endfield: require("./endfield"),
  czn: require("./czn"),
};
