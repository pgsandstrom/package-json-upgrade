# Actions

Follow-ups from the review of `cba152b` ("Add support for seeing updates and updating in pnpm-workspace files").
Nothing here is a release blocker on its own; items 1 and 5 are the two that can produce visibly wrong
behaviour for a user.

Line references are as of `cba152b`.

---

## 1. Trailing YAML comments can be corrupted instead of the version — DONE

**Where:** `src/updateAll.ts:55`, `src/updateAction.ts:112`, helper in `src/util/util.ts:26`

Both the update-all command and the quick fix rewrote the whole line with
`replaceLastOccuranceOf(lineText, currentExactVersion, newVersion)`. "Last occurrence" was safe for
JSON, where the value is the last thing on the line. In YAML, comments come after the value:

```yaml
catalog:
  react: ^19.2.5 # see https://github.com/facebook/react/releases/tag/v19.2.5
```

`lastIndexOf('19.2.5')` matched inside the URL, so the version was left untouched and the comment
silently mangled. Same shape for `lodash: 4.17.21 # pinned to 4.17.21 until X`.

Resolved by giving the YAML path its own replace helper, anchored on the first occurrence _after_ the
`key:` separator. It reuses `KEY_REGEX` — the same regex `getKeyLines` uses to find the dependency
lines in the first place — so the two can only agree on where the key ends. A line the regex does not
match, or a version that is not in the value, is returned untouched: doing nothing is the right
failure mode when the alternative is corrupting the line.

Changed:

- `replaceVersionInWorkspaceLine` added to `pnpmWorkspaceFile.ts`
- `getUpdatedLineText(document, ...)` in `dependencyFile.ts` picks the replace for the file type,
  alongside the other per-file-type dispatches; `updateAll.ts` and `updateAction.ts` call it and no
  longer import `replaceLastOccuranceOf`
- `replaceLastOccuranceOf` stays in `util.ts`, now used only for package.json
- unit tests for the helper in `pnpmWorkspaceFile.test.ts`, plus an end-to-end `updateAll` case in
  `test-vscode/updateAll.test.ts` whose comment repeats the version
- the trailing comment in the existing parse fixture now repeats the version too

- [x] Fix the replacement anchor
- [x] Add a regression test with a version-repeating trailing comment

---

## 2. The workspace file is parsed twice per decoration pass

**Where:** `src/npm.ts:428-440` (`refreshWorkspaceFileData`), `src/texteditor.ts:45-52` (`loadDecoration`)

`loadDecoration` calls `getDependencyGroups(document)`, then `refreshDependencyFileData(document)` →
`refreshWorkspaceFileData` → `getWorkspaceFileDependencyInformation(...)` on the same text, running
js-yaml plus the full `getKeyLines` scan a second time. This runs on every keystroke (500ms debounce,
`src/extension.ts:56`).

It also forces `npm.ts` to import `pnpmWorkspaceFile.ts`, which is the coupling `dependencyFile.ts`
was introduced to avoid.

**Fix:** export the generic `refreshDependencies` from `npm.ts` and have `refreshDependencyFileData`
pass in the already-computed groups. That removes the double parse _and_ the import, and it actually
enforces the "the two can never drift apart" invariant that the comment at `src/npm.ts:432` currently
only asserts by re-deriving the same data.

- [ ] Thread the computed dependency groups through instead of re-parsing
- [ ] Drop the `pnpmWorkspaceFile` import from `npm.ts`

---

## 3. Versions that YAML reads as numbers are silently dropped

**Where:** `src/pnpmWorkspaceFile.ts:56` and `:61` (the `typeof value === 'string'` gates)

`typescript: 5.9` or `react: 19` (unquoted, no caret) parse as JS numbers, so the dependency vanishes
with no decoration and no diagnostic. `4.17.21` is safe — two dots means YAML keeps it a string — so
this is narrow, but a two-segment range is plausible in a catalog.

**Caveat before fixing:** coercing with `String(value)` would turn `5.10` into `5.1`, which is worse
than showing nothing. Options are (a) coerce only when the raw line text round-trips to the same
string, or (b) leave it and accept the gap knowingly. Decide which; do not coerce naively.

- [ ] Decide: coerce carefully, or document the gap and move on

---

## 4. `onLanguage:yaml` activates the extension for every YAML file

**Where:** `package.json:29-34`

Opening a docker-compose file, a k8s manifest, or a GitHub Actions workflow now boots the extension.
That is a startup-cost regression for every user who does not use catalogs.

**Alternative:** `workspaceContains:**/pnpm-workspace.yaml`, which is much narrower. Trade-off: it
would not activate for a `pnpm-workspace.yaml` opened outside of a workspace folder. Possibly declare
both and accept the union, or just accept `onLanguage:yaml` as the pragmatic choice — but make it a
deliberate decision.

- [ ] Decide on the activation event and note the reasoning

---

## 5. `rowToDecoration` is keyed by line number alone (pre-existing, now much more likely) — DONE

**Where:** `src/texteditor.ts:27`, consumed by `updateCache` at `:279`

The decoration cache is global and keyed only by line number, so two visible dependency files collide
on shared line numbers: `updateCache` returns `false` for the second document and its decoration is
never painted.

This predates the commit — it previously needed two open package.json files — but package.json and
pnpm-workspace.yaml side by side in a split view is a far more common pairing, so the bug goes from
rare to routine.

Resolved by keying on `document.fileName` + line, the same way `decorationStart` right above it is
already keyed by `document.fileName`.

Changed:

- `getDecorationKey(document, line)` in `texteditor.ts`; `rowToDecoration` is now
  `Record<string, ...>`
- `updateCache` and `clearLoadingOnDependencyGroups` take the document; the four `updateCache` call
  sites pass it
- `updateCache` is exported for tests, the way `setCachedNpmData` in `npm.ts` already is
- `test-vscode/decorationCache.test.ts` covers the collision (two documents, same line, same text —
  both must paint) plus the same-document dedupe that the cache exists for in the first place

- [x] Key the decoration cache per document
- [ ] Manually verify with package.json and pnpm-workspace.yaml open side by side

Note the manual check is still open: the regression test pins `updateCache` directly, not the paint
path through `paintDecorations`.

---

## 6. Duplicated file-name matching — DONE

**Where:** `src/pnpmWorkspaceFile.ts:8-14` and `src/packageJson.ts:141-144`

`isPnpmWorkspaceFile` duplicated `isPackageJson`'s slash logic, including the verbatim comment
"Is checking both slashes necessary? Test on linux and mac."

Resolved with one `endsWithFileName(document, fileName)` helper in `util/util.ts`, which both
predicates now call. A single name is enough now that `.yml` is gone (item 8), so the helper takes
one rather than a list.

The slash question does not need a linux or mac run to answer: `document.fileName` is the platform
path (`Uri.fsPath`), so it is backslash separated on Windows and slash separated everywhere else —
both checks were needed, one per platform family. The helper compares the last segment after
splitting on either separator instead, which is correct on all three platforms (Windows accepts
forward slashes too) and drops the question with it.

One behaviour change: a document whose `fileName` has no directory at all — plain `package.json` —
now matches where the old `endsWith('/package.json')` pair did not. That is the more correct answer,
and it is covered by a new case in the `isPnpmWorkspaceFile` test.

Changed:

- `endsWithFileName` added to `src/util/util.ts`
- `isPackageJson` and `isPnpmWorkspaceFile` reduced to one call each, comments deleted
- bare-filename case added to `isPnpmWorkspaceFile` in `test-node/pnpmWorkspaceFile.test.ts`

- [x] Extract the helper
- [x] Answer the slash question and delete the comment

---

## 7. Duplicated path splitting and lookup

**Where:** path splitting in `src/packageJson.ts:122`, `src/npm.ts:482`, `src/pnpmWorkspaceFile.ts:87`;
`getValueAtPath` in `src/npm.ts:481` and `src/pnpmWorkspaceFile.ts:94`

Three copies of the split-trim-filter logic and two of `getValueAtPath`, differing only in whether they
take a `string` or a `string[]`. Same spirit as the `isRecord` consolidation this commit already did.

- [ ] Consolidate into `src/util/`

---

## 8. `.yml` is accepted but pnpm only reads `pnpm-workspace.yaml` — DONE

**Where:** `src/pnpmWorkspaceFile.ts`, `src/extension.ts`, `src/workspace.ts`

Resolved by dropping `.yml` everywhere: we should not act on a file pnpm ignores, because doing so
implies the versions in it are used. `workspace.ts` turned out to be the more important half — it was
resolving `catalog:` refs in package.json out of a `pnpm-workspace.yml`, which produces wrong version
info rather than merely a stray decoration.

Changed:

- `isPnpmWorkspaceFile` now matches `pnpm-workspace.yaml` only, and mirrors `isPackageJson` exactly
  (which makes the item 6 extraction more obviously correct)
- dropped the `**/pnpm-workspace.yml` code action pattern in `activateCodeActionStuff`
- `findWorkspaceFile` no longer falls back to `.yml`
- `should support pnpm-workspace.yml extension` in `workspace.test.ts` inverted to assert the file is
  ignored; the `ws-yml` fixture is kept as the negative case
- `.yml` cases in `pnpmWorkspaceFile.test.ts` moved to their own not-recognized test

Note the `ws-yml` test passes because the root search walks up past it to
`testdata/pnpm-workspace.yaml`, which has no catalog — not because the search finds no root at all.

- [x] Drop `.yml` support in all three places
