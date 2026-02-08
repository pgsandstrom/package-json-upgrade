declare module '@pnpm/npm-conf' {
  interface NpmConfResult {
    config: {
      snapshot: Record<string, unknown>
      get(key: string): unknown
      localPrefix: string
    }
    warnings: string[]
    failedToLoadBuiltInConfig: boolean
  }

  function npmConf(opts?: Record<string, unknown>): NpmConfResult
  export = npmConf
}
