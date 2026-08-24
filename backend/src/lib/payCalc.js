const FOOD_BONUS_TEST_THRESHOLD = 4;
const FOOD_BONUS_DAILY_AMOUNT = 40;

function totalTestsFor(e) {
  return (e.insurance_tests || 0) + (e.screening_tests || 0) +
         (e.mixed_screening_tests || 0) + (e.partial_tests || 0);
}

// Monthly food-spend audit: employees with >=4 tests on a day are entitled to
// up to 40₪ food money for that day; this checks the month's actual
// food_expense claims against that entitlement in aggregate (not per-day).
function foodAudit(entries) {
  const qualifyingDays = entries.filter(e => totalTestsFor(e) >= FOOD_BONUS_TEST_THRESHOLD).length;
  const entitlement = qualifyingDays * FOOD_BONUS_DAILY_AMOUNT;
  const claimed = entries.reduce((sum, e) => sum + (e.food_expense || 0), 0);
  return { qualifyingDays, entitlement, claimed, overBy: Math.max(0, claimed - entitlement) };
}

// Computes a single entry's pay based on the employee's assigned payment_type.
function calcDaily(e, profile = {}) {
  const paymentType = profile.payment_type || 'per_test';
  const mileageRate = profile.mileage_rate ?? 2;
  const km = (e.kilometers || 0) * mileageRate + ((e.kilometers || 0) >= 100 ? 100 : 0);
  const expenses = (e.food_expense || 0) + (e.parking_expense || 0);

  if (paymentType === 'per_hour') {
    const hourlyRate = profile.hourly_rate ?? 90;
    const office = (e.office_hours || 0) * hourlyRate;
    return {
      insurance: 0, screening: 0, mixed: 0, partial: 0, minBonus: 0,
      km, office, expenses, total: office + km + expenses,
    };
  }

  if (paymentType === 'global') {
    // Tests/km/hours contribute nothing per day for global employees; only
    // expenses count per day. The flat global_salary is added once at the
    // monthly-summing layer, not here.
    return {
      insurance: 0, screening: 0, mixed: 0, partial: 0, minBonus: 0,
      km: 0, office: 0, expenses, total: expenses,
    };
  }

  // 'per_test' (default/fallback)
  const insRate = profile.insurance_rate ?? 80;
  const scrRate = profile.screening_rate ?? 105;
  const mixRate = profile.mixed_screening_rate ?? 120;
  const parRate = profile.partial_rate ?? 50;

  const totalTests = (e.insurance_tests || 0) + (e.screening_tests || 0) +
                     (e.mixed_screening_tests || 0) + (e.partial_tests || 0);
  const insurance = (e.insurance_tests || 0) * insRate;
  const screening = (e.screening_tests || 0) * scrRate;
  const mixed = (e.mixed_screening_tests || 0) * mixRate;
  const partial = (e.partial_tests || 0) * parRate;
  const rawTestsPay = insurance + screening + mixed + partial;
  const MIN_TESTS_PAY = 240;
  const testsPay = totalTests > 0 ? Math.max(rawTestsPay, MIN_TESTS_PAY) : rawTestsPay;
  const minBonus = testsPay - rawTestsPay;
  const office = (e.office_hours || 0) * 60;

  return { insurance, screening, mixed, partial, minBonus, km, office, expenses,
           total: testsPay + km + office + expenses };
}

module.exports = { calcDaily, foodAudit, totalTestsFor, FOOD_BONUS_TEST_THRESHOLD };
