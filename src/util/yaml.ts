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
 * below maps keys by their path through the document, and a
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
 * `getKeyLines` below also lets the last win, so the version we show and the line
 * we show it on stay in agreement.
 */
export const WORKSPACE_YAML_OPTIONS: yaml.LoadOptions = {
  schema: WORKSPACE_YAML_SCHEMA,
  json: true,
}

/**
 * Matches the indentation and the raw key of a `key: value` or `key:` line. The
 * three key alternatives are double quoted, single quoted and plain keys.
 */
export const KEY_REGEX = /^(\s*)("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s#][^:]*?)\s*:(?=\s|$)/

/**
 * Yaml keys may contain almost anything, so we flatten a key path with JSON to
 * make sure two different paths never collide.
 */
export const toKeyLineKey = (path: string[]): string => {
  return JSON.stringify(path)
}

/**
 * Maps the path of every mapping key in the document to the line it is written on.
 * The path is the list of ancestor keys, so `react` inside `catalogs: legacy:` ends
 * up as `catalogs`, `legacy`, `react`.
 *
 * This goes by indentation rather than using a real yaml parser, so it does not
 * understand flow style mappings or block scalars. Neither is used for pnpm
 * catalogs, and any dependency we fail to find a line for is simply skipped.
 *
 * This currently does not respect CR-only line breaks... but no one uses that, right?
 */
export const getKeyLines = (yamlAsString: string): Map<string, number> => {
  const keyLines = new Map<string, number>()
  const parents: { key: string; indent: number }[] = []

  yamlAsString.split('\n').forEach((lineText, line) => {
    // Sequence entries are never dependencies, and letting them through would
    // corrupt the parent stack.
    if (/^\s*-(\s|$)/.test(lineText)) {
      return
    }

    const match = KEY_REGEX.exec(lineText)
    if (match === null) {
      return
    }

    const indent = match[1].length
    const key = getKey(match[2])

    while (parents.length > 0 && parents[parents.length - 1].indent >= indent) {
      parents.pop()
    }

    const path = [...parents.map((parent) => parent.key), key]
    parents.push({ key, indent })

    // Duplicate keys are a mistake (not supported by yaml) rather than something we support, but they have
    // to land somewhere. The last one wins, matching both WORKSPACE_YAML_OPTIONS -
    // where js-yaml keeps the last value - and pnpm, which installs the last one.
    // Line and version therefore describe the same entry, so the upgrade quick fix
    // finds the version it is replacing and the decoration sits on the line that
    // actually takes effect.
    keyLines.set(toKeyLineKey(path), line)
  })

  return keyLines
}

const getKey = (rawKey: string): string => {
  if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
    // Package names never contain anything fancier than a backslash escape.
    return rawKey.slice(1, -1).replace(/\\(.)/g, '$1')
  }
  if (rawKey.startsWith("'") && rawKey.endsWith("'")) {
    return rawKey.slice(1, -1).replace(/''/g, "'")
  }
  return rawKey
}
