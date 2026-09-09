import * as yaml from 'js-yaml'

/**
 * The schema we read pnpm-workspace.yaml with.
 *
 * Yaml resolves an unquoted `typescript: 5.9` to a number, and a number cannot be
 * turned back into the text it was written as: `String(5.10)` is `5.1`. That is
 * not only the wrong version to show, it is also the string the upgrade would
 * look for in the line, so it would rewrite the `5.1` of `5.10` and leave the
 * trailing `0` behind.
 *
 * The failsafe schema resolves every scalar as a string, so `5.10` stays `5.10`
 * and we never have to guess. Its one rough edge is that it does not know any of
 * the standard tags, so an explicit `!!bool true` anywhere in the file would
 * throw and cost us the whole file. Adding null and bool back keeps those
 * readable while leaving numbers alone - the implicit resolvers stay off, so a
 * bare `true` is still the string "true", which is exactly what we want for a
 * value that is meant to be a version.
 *
 * `merge` is deliberately not in the list, so a `<<: *base` in a catalog stays a
 * literal `<<` key instead of merging the anchor's entries in. Nothing throws and
 * `<<` is not a name we would look up, so the merged in dependencies simply get
 * no decoration. Closing that gap is not a matter of adding one more type to the
 * array: `Schema.extend([type])` only adds to `explicit`, which is exactly why a
 * bare `true` stays a string above. Resolving `<<` needs
 * `extend({ implicit: [...] })`, and turning implicit resolution back on is the
 * thing this schema exists to avoid. Anchors in a pnpm catalog are rare enough
 * that the gap is the better trade.
 */
// js-yaml exports its built in types, but @types/js-yaml does not declare them.
const builtinTypes = (yaml as unknown as { types: Record<string, yaml.Type> }).types

export const WORKSPACE_YAML_SCHEMA = yaml.FAILSAFE_SCHEMA.extend([
  builtinTypes.null,
  builtinTypes.bool,
])
