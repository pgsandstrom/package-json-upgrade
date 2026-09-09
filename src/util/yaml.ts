import * as yaml from 'js-yaml'

/**
 * Turns a tag into one that only applies when it is written out explicitly.
 *
 * In js-yaml v5 `implicit` is a property of the tag rather than of the way it is
 * added to a schema, so a tag has to be stripped of it on the way in. Without
 * this, adding `boolCoreTag` below would also resolve a bare `true`.
 */
const explicitOnly = <T>(tag: yaml.ScalarTagDefinition<T>): yaml.ScalarTagDefinition<T> => {
  return { ...tag, implicit: false }
}

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
 * readable while leaving numbers alone - `explicitOnly` keeps the implicit
 * resolvers off, so a bare `true` is still the string "true", which is exactly
 * what we want for a value that is meant to be a version.
 *
 * `merge` is deliberately not in the list, so a `<<: *base` in a catalog stays a
 * literal `<<` key instead of merging the anchor's entries in. Nothing throws and
 * `<<` is not a name we would look up, so the merged in dependencies simply get
 * no decoration.
 *
 * Adding `yaml.mergeTag` here would be enough to resolve the merge - v5 scopes
 * `implicit` per tag, so unlike v4 it does not drag the other implicit resolvers
 * back in with it. It would not gain us anything on its own though: `getKeyLines`
 * in pnpmWorkspaceFile.ts maps keys by their path through the document, and a
 * merged in `react` is not written anywhere under `catalog:`, so it would have no
 * line to decorate and be skipped just the same. Closing the gap means teaching
 * `getKeyLines` about anchors too, and anchors in a pnpm catalog are rare enough
 * that the gap is still the better trade.
 */
const WORKSPACE_YAML_SCHEMA = yaml.FAILSAFE_SCHEMA.withTags(
  explicitOnly(yaml.nullCoreTag),
  explicitOnly(yaml.boolCoreTag),
)

/**
 * The options every read of a pnpm-workspace.yaml goes through.
 *
 * `json` sounds like it is about json, but it does exactly one thing: it turns
 * off the duplicate key check. Without it a repeated key throws and costs us the
 * entire file - every other dependency in it loses its decoration too, over a
 * mistake in one entry. With it the last of the duplicates wins, which is what
 * pnpm itself installs.
 *
 * `getKeyLines` in pnpmWorkspaceFile.ts also lets the last win, so the version we
 * show and the line we show it on stay in agreement.
 */
export const WORKSPACE_YAML_OPTIONS: yaml.LoadOptions = {
  schema: WORKSPACE_YAML_SCHEMA,
  json: true,
}
