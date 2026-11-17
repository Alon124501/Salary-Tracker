const FOOD_BONUS_TEST_THRESHOLD = 4;
const FOOD_BONUS_DAILY_AMOUNT = 40;
const FOOD_HOURS_THRESHOLD = 7;

function totalTestsFor(e) {
  return (e.insurance_tests || 0) + (e.screening_tests || 0) +
         (e.mixed_screening_tests || 0) + (e.partial_tests || 0) + (e.other_tests || 0);
}

// Food-gate count: cancellations count toward the 4-per-day food threshold,
// but never toward test totals or pay.
function foodQualifyingCountFor(e) {
  return totalTestsFor(e) + (e.cancellations || 0);
}

// Food unlocks on a day with >=4 tests+cancellations OR >=7 office hours.
// The two conditions are independent (no combining partial tests + hours).
function foodUnlocked(e) {
  return foodQualifyingCountFor(e) >= FOOD_BONUS_TEST_THRESHOLD ||
         (Number(e.office_hours) || 0) >= FOOD_HOURS_THRESHOLD;
}

// Monthly food-spend audit: employees on a food-unlocked day (see foodUnlocked)
// are entitled to up to 40₪ food money for that day; this checks the month's actual
// food_expense claims against that entitlement in aggregate (not per-day).
function foodAudit(entries) {
  const qualifyingDays = entries.filter(foodUnlocked).length;
  const entitlement = qualifyingDays * FOOD_BONUS_DAILY_AMOUNT;
  const claimed = entries.reduce((sum, e) => sum + (e.food_expense || 0), 0);
  return { qualifyingDays, entitlement, claimed, overBy: Math.max(0, claimed - entitlement) };
}

function dailyExpenses(e) {
  return (e.food_expense || 0) + (e.parking_expense || 0) + (e.toll_expense || 0);
}

module.exports = { totalTestsFor, foodQualifyingCountFor, foodUnlocked, foodAudit, dailyExpenses, FOOD_BONUS_TEST_THRESHOLD, FOOD_HOURS_THRESHOLD };
