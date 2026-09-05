function buildSheet(sheet, entries, profile = {}, title = '') {
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const centerAlign = { horizontal: 'center', vertical: 'middle' };
  const stripeFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
  const totalFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F2F5' } };
  const numCols = 9;

  sheet.columns = [
    { header: 'תאריך',           key: 'date',   width: 14 },
    { header: 'בדיקות ביטוח',     key: 'ins',    width: 16 },
    { header: 'בדיקות סקר',       key: 'scr',    width: 16 },
    { header: 'סקר מעורב',        key: 'mix',    width: 16 },
    { header: 'בדיקות חלקיות',    key: 'par',    width: 14 },
    { header: 'סה"כ בדיקות',      key: 'total',  width: 14 },
    { header: 'קילומטרים',        key: 'km',     width: 12 },
    { header: 'שעות משרד',        key: 'hrs',    width: 14 },
    { header: 'אוכל (₪)',         key: 'food',   width: 12 },
    { header: 'חניה (₪)',         key: 'parking', width: 12 },
  ];

  sheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = centerAlign;
  });
  sheet.getRow(1).height = 22;

  const sums = { ins: 0, scr: 0, mix: 0, par: 0, total: 0, km: 0, hrs: 0, food: 0, parking: 0 };

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const total = (e.insurance_tests || 0) + (e.screening_tests || 0) +
                  (e.mixed_screening_tests || 0) + (e.partial_tests || 0);

    const dataRow = sheet.addRow({
      date: e.date, ins: e.insurance_tests, scr: e.screening_tests,
      mix: e.mixed_screening_tests, par: e.partial_tests, total,
      km: e.kilometers, hrs: e.office_hours,
      food: e.food_expense, parking: e.parking_expense,
    });

    if (i % 2 === 0) {
      for (let col = 1; col <= numCols; col++) {
        dataRow.getCell(col).fill = stripeFill;
      }
    }

    sums.ins     += e.insurance_tests       || 0;
    sums.scr     += e.screening_tests       || 0;
    sums.mix     += e.mixed_screening_tests || 0;
    sums.par     += e.partial_tests         || 0;
    sums.total   += total;
    sums.km      += e.kilometers            || 0;
    sums.hrs     += e.office_hours          || 0;
    sums.food    += e.food_expense          || 0;
    sums.parking += e.parking_expense       || 0;
  }

  // Blank separator
  sheet.addRow({});

  // TOTAL count row
  const totalsRow = sheet.addRow({ date: 'סה"כ', ...sums });
  totalsRow.eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = totalFill;
    cell.alignment = centerAlign;
  });

  // Grand total tests row
  sheet.addRow({});
  const grandTotalRow = sheet.addRow({ date: 'סה"כ בדיקות', total: sums.total });
  grandTotalRow.height = 26;
  for (let col = 1; col <= numCols; col++) {
    const cell = grandTotalRow.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    cell.alignment = centerAlign;
  }

  if (title) {
    sheet.spliceRows(1, 0, [title]);
    sheet.mergeCells(1, 1, 1, numCols);
    sheet.getRow(1).height = 30;
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E1B4B' } };
    titleCell.alignment = centerAlign;
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };
  }
}

module.exports = { buildSheet };
