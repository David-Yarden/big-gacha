/**
 * Write sink used by the seed scripts.
 *
 * By default writes go straight to MongoDB (the classic `npm run seed:*` behaviour).
 * During a sync the engine switches the sink to "recording": the seeders then produce
 * a list of operations instead of touching the database, so the engine can validate
 * and diff everything before applying it.
 */

let recorder = null;

function startRecording() {
  recorder = [];
}

function stopRecording() {
  const ops = recorder || [];
  recorder = null;
  return ops;
}

/** Operations recorded so far by the current sync ([] outside a sync). */
function recorded() {
  return recorder || [];
}

function isRecording() {
  return recorder !== null;
}

/** Insert or update a document — fields in `data` are $set, other fields are kept. */
async function upsert(Model, filter, data) {
  if (recorder) {
    recorder.push({ op: "upsert", model: Model.modelName, filter, set: data });
    return null;
  }
  return Model.findOneAndUpdate(filter, data, { upsert: true, new: true, setDefaultsOnInsert: true });
}

/** Update with explicit operators ({ $set, $unset }). */
async function update(Model, filter, ops) {
  if (recorder) {
    recorder.push({ op: "update", model: Model.modelName, filter, set: ops.$set || {}, unset: ops.$unset || {} });
    return null;
  }
  return Model.findOneAndUpdate(filter, ops, { upsert: true, new: true });
}

async function deleteMany(Model, filter) {
  if (recorder) {
    recorder.push({ op: "delete", model: Model.modelName, filter });
    return { deletedCount: 0 };
  }
  return Model.deleteMany(filter);
}

module.exports = { startRecording, stopRecording, isRecording, recorded, upsert, update, deleteMany };
