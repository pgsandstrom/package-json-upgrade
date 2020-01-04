export type StrictDict<K extends string | number | symbol, V> = { [key in K]: V }

export type Dict<K extends string | number | symbol, V> = { [key in K]: V | undefined }

export enum AsyncState {
  NotStarted = 'NOT_STARTED',
  InProgress = 'IN_PROGRESS',
  Fulfilled = 'FULFILLED',
  Rejected = 'REJECTED',
}

export interface Loader<T> {
  asyncstate: AsyncState
  item?: T
}
