import { describe, expect, it } from 'vitest'

import rawPricing from '../pricing.json'
import {
  calculate,
  describeResult,
  parsePricingConfig,
  pickPackage,
  type CalculatorInput,
  type PricingConfig,
} from './pricing'

const priced: PricingConfig = {
  currency: 'EUR',
  answersPerConversation: 4,
  markupPercent: 50,
  packages: [
    { id: 'start', name: 'Start', maxProducts: 100, maxConversations: 200, maxLanguages: 1, priceMonthly: 20 },
    { id: 'growth', name: 'Growth', maxProducts: 1000, maxConversations: 2000, maxLanguages: 3, priceMonthly: 60 },
    { id: 'scale', name: 'Scale', maxProducts: 10000, maxConversations: 20000, maxLanguages: 10, priceMonthly: 200 },
  ],
  models: [
    { id: 'claude', label: 'Claude', costPerAnswer: 0.01 },
    { id: 'gpt', label: 'GPT', costPerAnswer: 0.02 },
    { id: 'deepseek', label: 'DeepSeek', costPerAnswer: null },
  ],
  shopDiscounts: [
    { minShops: 3, discountPercent: 10 },
    { minShops: 10, discountPercent: 25 },
  ],
}

const small: CalculatorInput = { products: 50, conversations: 100, languages: 1, shops: 1, modelId: 'claude' }

describe('package choice', () => {
  it('takes the smallest package, and a value exactly at the limit still fits', () => {
    expect(pickPackage(priced, { ...small, products: 100, conversations: 200 })?.id).toBe('start')
  })

  it('moves up one package as soon as any single number passes a limit', () => {
    expect(pickPackage(priced, { ...small, products: 101 })?.id).toBe('growth')
    expect(pickPackage(priced, { ...small, conversations: 201 })?.id).toBe('growth')
    expect(pickPackage(priced, { ...small, languages: 2 })?.id).toBe('growth')
  })

  it('the tightest dimension decides when several are high', () => {
    expect(pickPackage(priced, { ...small, products: 90, conversations: 1500, languages: 4 })?.id).toBe('scale')
  })

  it('returns a custom plan above the largest package', () => {
    expect(calculate(priced, { ...small, products: 10001 })).toEqual({ kind: 'custom' })
  })
})

describe('price formula', () => {
  it('adds the package fee and the model usage with markup', () => {
    // usage = 100 conv × 4 answers × 0.01 × 1.5 = 6; start fee 20
    expect(calculate(priced, small)).toMatchObject({ kind: 'package', packageId: 'start', pricePerShop: 26, total: 26 })
    // usage = 100 × 4 × 0.02 × 1.5 = 12
    expect(calculate(priced, { ...small, modelId: 'gpt' })).toMatchObject({ pricePerShop: 32 })
  })

  it('rounds the price per shop to cents and builds the total from the rounded price', () => {
    const config = { ...priced, answersPerConversation: 3, markupPercent: 33 }
    // usage = 100 × 3 × 0.01 × 1.33 = 3.99; 20 + 3.99 = 23.99
    expect(calculate(config, { ...small, shops: 2 })).toMatchObject({ pricePerShop: 23.99, total: 47.98 })
  })

  it('applies the largest shop discount reached and multiplies by the number of shops', () => {
    expect(calculate(priced, { ...small, shops: 2 })).toMatchObject({ pricePerShop: 26, total: 52 })
    expect(calculate(priced, { ...small, shops: 3 })).toMatchObject({ pricePerShop: 23.4, total: 70.2 })
    expect(calculate(priced, { ...small, shops: 12 })).toMatchObject({ pricePerShop: 19.5, total: 234 })
  })

  it('keeps recommending the package while any price figure is still null', () => {
    const model = { ...small, modelId: 'deepseek' }
    expect(calculate(priced, model)).toMatchObject({ kind: 'package', packageId: 'start', pricePerShop: null, total: null })
    for (const patch of [{ markupPercent: null }, { answersPerConversation: null }] as const) {
      expect(calculate({ ...priced, ...patch }, small)).toMatchObject({ packageId: 'start', pricePerShop: null })
    }
    const noFee = { ...priced, packages: priced.packages.map((pkg) => ({ ...pkg, priceMonthly: null })) }
    expect(calculate(noFee, small)).toMatchObject({ packageId: 'start', pricePerShop: null })
  })
})

describe('config drives the result', () => {
  it('a different config gives a different answer for the same input, with no code change', () => {
    const before = calculate(priced, small)
    const edited: PricingConfig = {
      ...priced,
      markupPercent: 100,
      packages: priced.packages.map((pkg) => (pkg.id === 'start' ? { ...pkg, maxConversations: 50, priceMonthly: 30 } : pkg)),
    }
    const after = calculate(edited, small)
    expect(before).toMatchObject({ packageId: 'start', pricePerShop: 26 })
    expect(after).toMatchObject({ packageId: 'growth', pricePerShop: 60 + 100 * 4 * 0.01 * 2 })
  })
})

describe('input validation', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s in every numeric field', (bad) => {
    for (const field of ['products', 'conversations', 'languages', 'shops'] as const) {
      const result = calculate(priced, { ...small, [field]: bad })
      expect(result.kind).toBe('invalid')
      expect(result.kind === 'invalid' && Object.keys(result.errors)).toEqual([field])
    }
  })

  it('rejects an unknown model', () => {
    const result = calculate(priced, { ...small, modelId: 'llama' })
    expect(result).toEqual({ kind: 'invalid', errors: { modelId: 'Choose a model from the list.' } })
  })
})

describe('pricing.json guard', () => {
  it('accepts the real config and gives every default input a package', () => {
    const config = parsePricingConfig(rawPricing)
    const result = calculate(config, { products: 500, conversations: 500, languages: 1, shops: 1, modelId: config.models[0].id })
    expect(result.kind).toBe('package')
  })

  it.each([
    ['no packages', { ...priced, packages: [] }],
    ['a limit of 0', { ...priced, packages: [{ ...priced.packages[0], maxProducts: 0 }] }],
    ['a negative price', { ...priced, packages: [{ ...priced.packages[0], priceMonthly: -5 }] }],
    ['a price as text', { ...priced, packages: [{ ...priced.packages[0], priceMonthly: '20' }] }],
    ['a duplicate package id', { ...priced, packages: [priced.packages[0], priced.packages[0]] }],
    ['a duplicate model id', { ...priced, models: [priced.models[0], priced.models[0]] }],
    ['a 100% shop discount', { ...priced, shopDiscounts: [{ minShops: 2, discountPercent: 100 }] }],
    ['zero answers per conversation', { ...priced, answersPerConversation: 0 }],
  ])('rejects %s', (_label, config) => {
    expect(() => parsePricingConfig(config)).toThrow(/pricing\.json/)
  })
})

describe('texts', () => {
  it('shows the package and "Price after consultation" while prices are not approved', () => {
    const view = describeResult(calculate(parsePricingConfig(rawPricing), { ...small, modelId: 'claude' }))
    expect(view).toMatchObject({ state: 'package', title: 'Start', price: 'Price after consultation', total: '' })
    expect(view.note).not.toBe('')
  })

  it('shows the monthly price per shop and the total for several shops', () => {
    expect(describeResult(calculate(priced, small))).toMatchObject({ title: 'Start', price: '€26 / month per shop', total: '' })
    expect(describeResult(calculate(priced, { ...small, shops: 3 }))).toMatchObject({
      price: '€23.40 / month per shop',
      total: '€70.20 / month for 3 shops',
    })
  })

  it('has a text for the custom plan and for invalid input', () => {
    expect(describeResult({ kind: 'custom' })).toMatchObject({ state: 'custom', title: 'Custom plan' })
    expect(describeResult({ kind: 'invalid', errors: { products: 'x' } }).state).toBe('invalid')
  })
})
