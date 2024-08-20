/**
 * Object.keys but keeps type safety
 */
export function objectKeys<T extends object>(obj: T): Array<keyof T> {
  const entries = Object.keys(obj)
  return entries as Array<keyof T>
}

/**
 * Object.entries but keeps type safety
 */
export function objectEntries<K extends string | number | symbol, V>(
  obj: Record<K, V>,
): Array<[K, V]> {
  const entries = Object.entries(obj)
  return entries as Array<[K, V]>
}

export const replaceLastOccuranceOf = (s: string, replace: string, replaceWith: string) => {
  const indexOfReplace = s.lastIndexOf(replace)
  if (indexOfReplace !== -1) {
    return (
      s.substring(0, indexOfReplace) + replaceWith + s.substring(indexOfReplace + replace.length)
    )
  } else {
    return s
  }
}

export const waitForPromises = async (
  promises: Promise<void>[],
  interval: {
    cb: (newSettled: boolean) => void
    ms: number
  },
) => {
  let newSettled = false

  if (promises.length === 0) {
    return
  }

  promises.forEach((promise) => {
    void promise
      .then(() => {
        newSettled = true
      })
      .catch(() => {
        //
      })
  })

  const intervalTimeout = setInterval(() => {
    interval.cb(newSettled)
    newSettled = false
  }, interval.ms)

  await Promise.allSettled(promises)

  clearInterval(intervalTimeout)
}
