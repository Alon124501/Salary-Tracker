export function calcDaily(e) {
  const totalTests = (e.insurance_tests || 0) + (e.screening_tests || 0) +
                     (e.mixed_screening_tests || 0) + (e.partial_tests || 0);
  const insurance = (e.insurance_tests || 0) * 80;
  const screening = (e.screening_tests || 0) * 105;
  const mixed = (e.mixed_screening_tests || 0) * 120;
  const partial = (e.partial_tests || 0) * 50;
  const rawTestsPay = insurance + screening + mixed + partial;
  const testsPay = totalTests > 0 && totalTests < 3 ? Math.max(rawTestsPay, 240) : rawTestsPay;
  const minBonus = testsPay - rawTestsPay;
  const km = (e.kilometers || 0) * 2 + ((e.kilometers || 0) >= 100 ? 100 : 0);
  const learning = (e.learning_hours || 0) * 60;
  const expenses = (e.food_expense || 0) + (e.parking_expense || 0);
  return {
    insurance,
    screening,
    mixed,
    partial: partial + minBonus,
    km,
    learning,
    expenses,
    total: testsPay + km + learning + expenses,
  };
}

export function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  return {
    start: `${month}-01`,
    end: new Date(year, mon, 0).toISOString().slice(0, 10),
  };
}
