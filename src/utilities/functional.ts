import { Result, ResultAsync, err, ok, okAsync } from 'neverthrow'

// Helper function to merge type definitions when we want conditional results
export function conditionalResultAsync<R1, R2, E1, E2>(
  flag: boolean,
  onTrue: () => ResultAsync<R1, E1>,
  onFalse: () => ResultAsync<R2, E2>,
): ResultAsync<R1 | R2, E1 | E2> {
  return flag ? onTrue() : onFalse()
}

export function conditionalResult<R1, R2, E1, E2>(
  flag: boolean,
  onTrue: () => Result<R1, E1>,
  onFalse: () => Result<R2, E2>,
): Result<R1 | R2, E1 | E2> {
  return flag ? onTrue() : onFalse()
}

export function onlyIf<R1, E1>(flag: boolean, onTrue: () => Result<R1, E1>): Result<R1 | undefined, E1> {
  return flag ? onTrue() : ok(undefined)
}

export function errorIf<Error extends string = string>(flag: boolean, error: Error): Result<undefined, Error>
export function errorIf<Error>(flag: boolean, error: Error): Result<undefined, Error>
export function errorIf<Error>(flag: boolean, error: Error): Result<undefined, Error> {
  return flag ? err(error) : ok(undefined)
}

export function onlyIfAsync<R1, E1>(flag: boolean, onTrue: () => ResultAsync<R1, E1>): ResultAsync<R1 | undefined, E1> {
  return flag ? onTrue() : okAsync(undefined)
}

// Returns arguments as a strongly typed array
export function tuple<T extends unknown[]>(...args: T): T {
  return args
}

// Returns the error when the provided value is not a number
export function expectNumber<E extends string = string>(error: E): (value: unknown) => Result<number, E>
export function expectNumber<E>(error: E): (value: unknown) => Result<number, E>
export function expectNumber<E>(error: E) {
  return (value: unknown) =>
    conditionalResult(
      typeof value !== 'number' || isNaN(value),
      () => err(error),
      () => ok(value as number),
    )
}

// Overload signatures
export function expectDefined<E extends string = string>(
  error: E,
): <V>(value: V | null | undefined) => Result<NonNullable<V>, E>
export function expectDefined(): <V>(value: V | null | undefined) => Result<NonNullable<V>, void>
export function expectDefined<E>(error: E): <V>(value: V | null | undefined) => Result<NonNullable<V>, E>

// Implementation
// Returns the error when the provided value is null or undefined
export function expectDefined<E>(error?: E) {
  return <V>(value: V | null | undefined): Result<NonNullable<V>, E | void> =>
    value ? ok(value as NonNullable<V>) : err(error as E | void)
}

type FalsyTypes = null | undefined | false | 0 | ''

export function expectFalsy<E extends string = string>(
  error: E,
): <V>(value: V) => Result<FalsyTypes, E>
export function expectFalsy<E>(error: E): <V>(value: V) => Result<FalsyTypes, E>
export function expectFalsy<E>(error: E) {
  return <V>(value: V): Result<FalsyTypes, E> =>
    value ? err(error) : ok(value as FalsyTypes)
}



// Returns an ok result when the value is successfully parsed as a number or an error otherwise
export function parseNumber<E extends string = string>(value: string | undefined, error: E): Result<number, E>
export function parseNumber<E>(value: string | undefined, error: E): Result<number, E>
export function parseNumber<E>(value: string | undefined, error: E) {
  const parsed = parseInt(value ?? '')
  return conditionalResult(
    isNaN(parsed),
    () => err(error),
    () => ok(parsed),
  )
}

export function parseOptionalBoolean<E extends string = string>(
  value: string | undefined,
  error: E,
): Result<boolean | undefined, E>
export function parseOptionalBoolean<E>(value: string | undefined, error: E): Result<boolean | undefined, E>
export function parseOptionalBoolean<E>(value: string | undefined, error: E) {
  if (!value) {
    return ok(undefined)
  }

  const isTrue = value === 'true'
  const isFalse = value === 'false'
  return conditionalResult(
    isTrue || isFalse,
    () => ok(isTrue),
    () => err(error),
  )
}

export function parseOptionalDate<E extends string = string>(
  value: string | undefined,
  error: E,
): Result<Date | undefined, E>
export function parseOptionalDate<E>(value: string | undefined, error: E): Result<Date | undefined, E>
export function parseOptionalDate<E>(value: string | undefined, error: E) {
  if (!value) {
    return ok(undefined)
  }

  const parsed = Date.parse(value)
  return conditionalResult(
    !isNaN(parsed),
    () => ok(new Date(parsed)),
    () => err(error),
  )
}

// Returns an ok result when the value is successfully parsed as a date or an error otherwise
export function parseDate<E extends string = string>(value: string, error: E): Result<Date, E>
export function parseDate<E>(value: string, error: E): Result<Date, E>

export function parseDate<E>(value: string, error: E) {
  const date = Date.parse(value)
  return conditionalResult(
    isNaN(date),
    () => err(error),
    () => ok(new Date(date)),
  )
}

export type ExtractOkAsync<T extends ResultAsync<unknown, unknown>> = T extends ResultAsync<infer U, unknown>
  ? U
  : never
export type ExtractOk<T extends Result<unknown, unknown>> = T extends Result<infer U, unknown> ? U : never

type ErrorUnion<U> = U[keyof U] extends Result<any, infer E> | ResultAsync<any, infer E> ? E : never

export function merge<T extends object, R, E, U extends Record<string, Result<R, E>>>(results: U, base?: T) {
  const combinedResult = Result.combine(Object.values(results))
  return combinedResult
    .map((values) => {
      return Object.keys(results).reduce((result, key, index) => {
        return {
          ...result,
          [key]: values[index],
        }
      }, (base ?? {}) as T & { [K in keyof U]: ExtractOk<U[K]> })
    })
    .mapErr((err) => err as ErrorUnion<U>)
}

export function mergeAsync<T extends object, R, E, U extends Record<string, ResultAsync<R, E>>>(results: U, base?: T) {
  const combinedResult = ResultAsync.combine(Object.values(results))
  return combinedResult
    .map((values) => {
      return Object.keys(results).reduce((result, key, index) => {
        return {
          ...result,
          [key]: values[index],
        }
      }, (base ?? {}) as T & { [K in keyof U]: ExtractOkAsync<U[K]> })
    })
    .mapErr((err) => err as ErrorUnion<U>)
}

export function pick<T, K extends keyof T>(key: K) {
  return (t: T): T[K] => t[key]
}

export function combineSequentially<T extends readonly (() => ResultAsync<any, any>)[]>(
  results: readonly [...T]
): ResultAsync<
  { [K in keyof T]: T[K] extends () => ResultAsync<infer R, any> ? R : never },
  T[number] extends () => ResultAsync<any, infer E> ? E : never
> {
  type RTuple = { [K in keyof T]: T[K] extends () => ResultAsync<infer R, any> ? R : never };
  type E = T[number] extends () => ResultAsync<any, infer EE> ? EE : never;

  // Start with an empty tuple typed as RTuple
  const initial = okAsync([] as unknown as RTuple) as unknown as ResultAsync<RTuple, E>;

  // Build sequentially; cast at the end to the desired ResultAsync<RTuple, E>.
  return results.reduce<ResultAsync<any, any>>(
    (acc, cur) =>
      acc.andThen((arr) =>
        cur().map((v) => {
          // at runtime we push into the array; typing is enforced by the function signature
          return ([...arr, v] as unknown);
        })
      ),
    initial
  ) as unknown as ResultAsync<RTuple, E>;
}
