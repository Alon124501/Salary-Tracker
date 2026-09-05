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

function dailyExpenses(e) {
  return (e.food_expense || 0) + (e.parking_expense || 0);
}

module.exports = { totalTestsFor, foodAudit, dailyExpenses, FOOD_BONUS_TEST_THRESHOLD };
