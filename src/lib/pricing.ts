/**
 * Price calculator logic. Every number comes from src/pricing.json (same file the dashboard payment will read),
 * nothing is hard-coded here. A `null` price figure means "not approved yet": the package is still recommended,
 * the price becomes "on request".
 */

export type PricingPackage = {
  id: string
  name: string
  maxProducts: number
  maxConversations: number
  maxLanguages: number
  priceMonthly: number | null
}

export type PricingModel = {
  id: string
  label: string
  /** Provider cost of one answer in `currency` (table in shudflow/shud-ai-service#19). */
  costPerAnswer: number | null
}

export type ShopDiscount = { minShops: number; discountPercent: number }

export type PricingConfig = {
  currency: string
  /** Average bot answers in one conversation. */
  answersPerConversation: number | null
  /** Our margin on top of the provider cost of an answer. */
  markupPercent: number | null
  /** Ordered from the smallest package to the largest. */
  packages: PricingPackage[]
  models: PricingModel[]
  shopDiscounts: ShopDiscount[]
}

export type CalculatorInput = {
  products: number
  /** Conversations per month, per shop. */
  conversations: number
  languages: number
  shops: number
  modelId: string
}

export type InputField = keyof CalculatorInput

export type CalculatorResult =
  | { kind: 'invalid'; errors: Partial<Record<InputField, string>> }
  | { kind: 'custom' }
  | {
      kind: 'package'
      packageId: string
      packageName: string
      currency: string
      shops: number
      /** `null` while any figure needed for the price is not approved. */
      pricePerShop: number | null
      total: number | null
    }

function fail(message: string): never {
  throw new Error(`pricing.json: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nullableNumber(value: unknown, path: string, min: number, allowEqual = true): number | null {
  if (value === null) {
    return null
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || (!allowEqual && value === min)) {
    fail(`${path} must be null or a number ${allowEqual ? '>=' : '>'} ${min}`)
  }
  return value
}

function positiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    fail(`${path} must be a whole number >= 1`)
  }
  return value
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${path} must be a non-empty string`)
  }
  return value
}

function uniqueIds(items: Array<{ id: string }>, path: string) {
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id)) {
      fail(`${path} has a duplicate id "${item.id}"`)
    }
    seen.add(item.id)
  }
}

/** Checks the shape of pricing.json so a bad edit fails the build loudly instead of showing wrong prices. */
export function parsePricingConfig(raw: unknown): PricingConfig {
  if (!isRecord(raw)) {
    fail('must be an object')
  }
  const currency = nonEmptyString(raw.currency, 'currency')
  if (!Array.isArray(raw.packages) || raw.packages.length === 0) {
    fail('packages must be a non-empty array')
  }
  if (!Array.isArray(raw.models) || raw.models.length === 0) {
    fail('models must be a non-empty array')
  }
  const rawDiscounts = raw.shopDiscounts ?? []
  if (!Array.isArray(rawDiscounts)) {
    fail('shopDiscounts must be an array')
  }

  const packages = raw.packages.map((item: unknown, index): PricingPackage => {
    const path = `packages[${index}]`
    if (!isRecord(item)) {
      fail(`${path} must be an object`)
    }
    return {
      id: nonEmptyString(item.id, `${path}.id`),
      name: nonEmptyString(item.name, `${path}.name`),
      maxProducts: positiveInteger(item.maxProducts, `${path}.maxProducts`),
      maxConversations: positiveInteger(item.maxConversations, `${path}.maxConversations`),
      maxLanguages: positiveInteger(item.maxLanguages, `${path}.maxLanguages`),
      priceMonthly: nullableNumber(item.priceMonthly, `${path}.priceMonthly`, 0),
    }
  })
  const models = raw.models.map((item: unknown, index): PricingModel => {
    const path = `models[${index}]`
    if (!isRecord(item)) {
      fail(`${path} must be an object`)
    }
    return {
      id: nonEmptyString(item.id, `${path}.id`),
      label: nonEmptyString(item.label, `${path}.label`),
      costPerAnswer: nullableNumber(item.costPerAnswer, `${path}.costPerAnswer`, 0),
    }
  })
  const shopDiscounts = rawDiscounts.map((item: unknown, index): ShopDiscount => {
    const path = `shopDiscounts[${index}]`
    if (!isRecord(item)) {
      fail(`${path} must be an object`)
    }
    const minShops = positiveInteger(item.minShops, `${path}.minShops`)
    const discountPercent = nullableNumber(item.discountPercent, `${path}.discountPercent`, 0)
    if (discountPercent === null || discountPercent >= 100) {
      fail(`${path}.discountPercent must be a number from 0 up to (not including) 100`)
    }
    return { minShops, discountPercent }
  })
  uniqueIds(packages, 'packages')
  uniqueIds(models, 'models')

  return {
    currency,
    answersPerConversation: nullableNumber(raw.answersPerConversation, 'answersPerConversation', 0, false),
    markupPercent: nullableNumber(raw.markupPercent, 'markupPercent', 0),
    packages,
    models,
    shopDiscounts,
  }
}

const INPUT_ERROR = 'Enter a whole number, 1 or more.'

function validate(input: CalculatorInput, config: PricingConfig): Partial<Record<InputField, string>> {
  const errors: Partial<Record<InputField, string>> = {}
  for (const field of ['products', 'conversations', 'languages', 'shops'] as const) {
    const value = input[field]
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      errors[field] = INPUT_ERROR
    }
  }
  if (!config.models.some((model) => model.id === input.modelId)) {
    errors.modelId = 'Choose a model from the list.'
  }
  return errors
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** First package (config order, smallest first) that holds all three numbers, or `undefined` above the largest. */
export function pickPackage(config: PricingConfig, input: CalculatorInput): PricingPackage | undefined {
  return config.packages.find(
    (pkg) =>
      input.products <= pkg.maxProducts &&
      input.conversations <= pkg.maxConversations &&
      input.languages <= pkg.maxLanguages,
  )
}

/** Largest discount whose `minShops` is reached; 0 when none. */
function discountPercentFor(config: PricingConfig, shops: number): number {
  return config.shopDiscounts.reduce(
    (best, tier) => (shops >= tier.minShops && tier.discountPercent > best ? tier.discountPercent : best),
    0,
  )
}

/**
 * pricePerShop = (package.priceMonthly + conversations × answersPerConversation × model.costPerAnswer × (1 + markupPercent/100))
 *                × (1 − shop discount/100)
 * total = pricePerShop × shops. Any null figure → price is null (package is still returned).
 */
export function calculate(config: PricingConfig, input: CalculatorInput): CalculatorResult {
  const errors = validate(input, config)
  if (Object.keys(errors).length > 0) {
    return { kind: 'invalid', errors }
  }

  const pkg = pickPackage(config, input)
  if (!pkg) {
    return { kind: 'custom' }
  }

  const model = config.models.find((item) => item.id === input.modelId)
  const { answersPerConversation, markupPercent } = config
  let pricePerShop: number | null = null
  let total: number | null = null
  if (
    model &&
    pkg.priceMonthly !== null &&
    model.costPerAnswer !== null &&
    answersPerConversation !== null &&
    markupPercent !== null
  ) {
    const usage = input.conversations * answersPerConversation * model.costPerAnswer * (1 + markupPercent / 100)
    const discount = discountPercentFor(config, input.shops)
    pricePerShop = round2((pkg.priceMonthly + usage) * (1 - discount / 100))
    total = round2(pricePerShop * input.shops)
  }

  return {
    kind: 'package',
    packageId: pkg.id,
    packageName: pkg.name,
    currency: config.currency,
    shops: input.shops,
    pricePerShop,
    total,
  }
}

export type ResultView = {
  state: 'package' | 'custom' | 'invalid'
  title: string
  price: string
  total: string
  note: string
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const ON_REQUEST = 'Price after consultation'

/** The texts shown to the visitor; the page renders them at build time and the script updates them. */
export function describeResult(result: CalculatorResult): ResultView {
  if (result.kind === 'invalid') {
    return { state: 'invalid', title: '', price: '', total: '', note: 'Fill in every field with a whole number, 1 or more.' }
  }
  if (result.kind === 'custom') {
    return {
      state: 'custom',
      title: 'Custom plan',
      price: ON_REQUEST,
      total: '',
      note: 'Your numbers are above our standard packages. Tell us about the shop and we will make an offer.',
    }
  }
  if (result.pricePerShop === null) {
    return {
      state: 'package',
      title: result.packageName,
      price: ON_REQUEST,
      total: '',
      note: 'Prices are not final yet. This is the package that fits; we will quote the price after a short consultation.',
    }
  }
  return {
    state: 'package',
    title: result.packageName,
    price: `${formatMoney(result.pricePerShop, result.currency)} / month per shop`,
    total:
      result.shops > 1 && result.total !== null
        ? `${formatMoney(result.total, result.currency)} / month for ${result.shops} shops`
        : '',
    note: '',
  }
}
