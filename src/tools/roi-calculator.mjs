function finitePositive(value, name) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) throw new TypeError(`${name} must be a positive number`)
  return number
}

function unitInterval(value, name) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new TypeError(`${name} must be between 0 and 1`)
  return number
}

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export class RoiCalculator {
  constructor({
    currency = 'USD',
    fullyLoadedHourlyCost = 75,
    hoursSavedPerRepPerMonth = 2,
    adoptionRate = 0.6,
    assumptionSet = 'illustrative-default-v1',
  } = {}) {
    this.currency = String(currency || 'USD').trim().toUpperCase()
    this.fullyLoadedHourlyCost = finitePositive(fullyLoadedHourlyCost, 'fullyLoadedHourlyCost')
    this.hoursSavedPerRepPerMonth = finitePositive(hoursSavedPerRepPerMonth, 'hoursSavedPerRepPerMonth')
    this.adoptionRate = unitInterval(adoptionRate, 'adoptionRate')
    this.assumptionSet = String(assumptionSet || 'illustrative-default-v1').trim()
  }

  calculate({ state, product } = {}) {
    const teamSize = Number(state?.teamSize)
    if (!Number.isSafeInteger(teamSize) || teamSize <= 0) return null
    if (!product?.id) return null

    const monthlyHoursSaved = teamSize * this.hoursSavedPerRepPerMonth * this.adoptionRate
    const monthlyGrossValue = money(monthlyHoursSaved * this.fullyLoadedHourlyCost)
    const annualGrossValue = money(monthlyGrossValue * 12)
    const monthlyProductCost = Number.isFinite(Number(product.priceMonthly))
      ? money(Number(product.priceMonthly))
      : null
    const annualProductCost = monthlyProductCost == null ? null : money(monthlyProductCost * 12)
    const annualNetValue = annualProductCost == null ? null : money(annualGrossValue - annualProductCost)
    const paybackMonths = monthlyProductCost == null || monthlyGrossValue <= 0
      ? null
      : money(monthlyProductCost / monthlyGrossValue)

    return {
      product: structuredClone(product),
      currency: this.currency,
      teamSize,
      monthlyHoursSaved: money(monthlyHoursSaved),
      monthlyGrossValue,
      annualGrossValue,
      monthlyProductCost,
      annualProductCost,
      annualNetValue,
      paybackMonths,
      assumptionSet: this.assumptionSet,
      assumptions: [
        { key: 'fullyLoadedHourlyCost', value: this.fullyLoadedHourlyCost, unit: `${this.currency}/hour` },
        { key: 'hoursSavedPerRepPerMonth', value: this.hoursSavedPerRepPerMonth, unit: 'hours/rep/month' },
        { key: 'adoptionRate', value: this.adoptionRate, unit: 'ratio' },
      ],
      disclaimer: 'Illustrative estimate using configured assumptions; not a guarantee of savings or return.',
    }
  }
}
