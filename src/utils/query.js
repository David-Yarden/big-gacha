/**
 * Query helpers shared by the generic list/detail routes.
 */

/** Escape a user string so it can be embedded literally in a RegExp. */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const FILTERABLE_INSTANCES = new Set(["String", "Number", "Boolean"]);

/**
 * Field names a client may filter / sort / select on for a given model.
 * Derived from the schema: top-level scalar fields and arrays of scalars.
 * Mixed / nested objects are excluded so no one can query into raw blobs.
 */
function filterableFields(Model) {
  if (Model.__filterableFields) return Model.__filterableFields;
  const fields = new Set();
  Model.schema.eachPath((path, schemaType) => {
    if (path.includes(".")) return;
    if (path === "__v") return;
    const inst = schemaType.instance;
    if (FILTERABLE_INSTANCES.has(inst)) fields.add(path);
    if (inst === "Array" && schemaType.caster && FILTERABLE_INSTANCES.has(schemaType.caster.instance)) {
      fields.add(path);
    }
  });
  Model.__filterableFields = fields;
  return fields;
}

/** Fields a client may ask for with ?fields= (any top-level path). */
function selectableFields(Model) {
  if (Model.__selectableFields) return Model.__selectableFields;
  const fields = new Set();
  Model.schema.eachPath((path) => {
    const top = path.split(".")[0];
    if (top !== "__v") fields.add(top);
  });
  fields.add("_id");
  Model.__selectableFields = fields;
  return fields;
}

/** Keep only whitelisted comma-separated tokens (optionally "-" prefixed). */
function cleanFieldList(raw, allowed, { allowDesc = false } = {}) {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((token) => {
      const name = allowDesc && token.startsWith("-") ? token.slice(1) : token;
      return name && allowed.has(name);
    });
}

module.exports = { escapeRegex, filterableFields, selectableFields, cleanFieldList };
