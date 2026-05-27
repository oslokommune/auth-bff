import {describe, expect, test, it, vi} from 'vitest'
import {replaceConfigValues} from "../src/config/config.js"

vi.mock(import("../src/config/variable-loaders.js"), () => {
  return {
    getSsmParameter: vi.fn().mockReturnValue("SSM_VAL"),
    getEnv: vi.fn().mockReturnValue("ENV_VAL")
  }
})

describe("replaceConfigValues", () => {
  it("should not replace normal values", async () => {
    const stringValue = await replaceConfigValues('normal-string')
    expect(stringValue).toBe('normal-string')

    const numberValue = await replaceConfigValues(1)
    expect(numberValue).toBe(1)

    const nullValue = await replaceConfigValues(null)
    expect(nullValue).toBe(null)

    const undefinedValue = await replaceConfigValues(undefined)
    expect(undefinedValue).toBe(undefined)
  })

  it("should replace env string values", async () => {
    const stringValue = await replaceConfigValues('{env:SOME_ENV}')
    expect(stringValue).toBe('ENV_VAL')
  })

  it("should replace ssm string values", async () => {
    const stringValue = await replaceConfigValues('{ssm:/some/var}')
    expect(stringValue).toBe('SSM_VAL')
  })

  it("should fail if var type is invalid", async () => {
    await expect(replaceConfigValues('{oops:BOOM}')).rejects.toThrow('unknown varType')
  })

  it("should replace values in objects", async () => {
    const result = await replaceConfigValues({
      "a": '{env:SOME_ENV}',
      "b": 'normal-string'
    })

    expect(result).toStrictEqual({
      "a": 'ENV_VAL',
      "b": 'normal-string'
    })
  })

  it("should replace values in arrays", async () => {
    const result = await replaceConfigValues([
      'normal-string',
      '{env:SOME_ENV}',
      'another-normal-string'
    ])

    expect(result).toStrictEqual([
      'normal-string',
      'ENV_VAL',
      'another-normal-string'
    ])
  })

  it("should replace nested values", async () => {
    const result = await replaceConfigValues({
      "a": '{env:SOME_ENV}',
      "b": 'normal-string',
      "c": [
        'normal-string',
        '{env:SOME_ENV}',
        {'inlist': '{env:SOME_ENV}'}
      ],
      "d": {
        "da": 1,
        "db": '{env:SOME_ENV}',
        "dc": {"dca": '{env:SOME_ENV}'},
        "dd": [1, 2, '{env:SOME_ENV}', 4]
      }
    })

    expect(result).toStrictEqual({
      "a": 'ENV_VAL',
      "b": 'normal-string',
      "c": [
        'normal-string',
        'ENV_VAL',
        {'inlist': 'ENV_VAL'}
      ],
      "d": {
        "da": 1,
        "db": 'ENV_VAL',
        "dc": {"dca": 'ENV_VAL'},
        "dd": [1, 2, 'ENV_VAL', 4]
      }
    })
  })
})
