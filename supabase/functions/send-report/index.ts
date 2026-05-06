import { createClient } from 'npm:@supabase/supabase-js@2';
import ExcelJS from 'npm:exceljs@4';
import nodemailer from 'npm:nodemailer@6';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function calcDaily(e: Record<string, number>) {
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
  return { insurance, screening, mixed, partial: partial + minBonus, km, learning, expenses,
           total: testsPay + km + learning + expenses };
}

function extOf(mime: string) {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg', 'image/png': '.png',
    'image/heic': '.heic', 'image/webp': '.webp',
  };
  return map[mime] || '.jpg';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  const formData = await req.formData();
  const month = formData.get('month') as string;
  if (!month) return json({ error: 'month required' }, 400);

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, gmail_user, gmail_app_password')
    .eq('id', user.id)
    .single();

  if (!profile?.gmail_user || !profile?.gmail_app_password) {
    return json({ error: 'No Gmail account configured. Please set it in Settings.' }, 400);
  }

  const [year, mon] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = new Date(year, mon, 0).toISOString().slice(0, 10);

  const { data: entries } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  // Build Excel
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Salary Report');

  sheet.columns = [
    { header: 'Date',             key: 'date',         width: 14 },
    { header: 'Insurance Tests',  key: 'ins',          width: 16 },
    { header: 'Screening Tests',  key: 'scr',          width: 16 },
    { header: 'Mixed Screening',  key: 'mix',          width: 16 },
    { header: 'Partial Tests',    key: 'par',          width: 14 },
    { header: 'Kilometers',       key: 'km',           width: 12 },
    { header: 'Learning Hours',   key: 'hrs',          width: 14 },
    { header: 'Food (₪)',         key: 'food',         width: 12 },
    { header: 'Parking (₪)',      key: 'parking',      width: 12 },
    { header: 'Tests Pay (₪)',    key: 'tests_pay',    width: 14 },
    { header: 'KM Pay (₪)',       key: 'km_pay',       width: 12 },
    { header: 'Learning Pay (₪)', key: 'learning_pay', width: 15 },
    { header: 'Expenses (₪)',     key: 'expenses',     width: 12 },
    { header: 'Daily Total (₪)',  key: 'total',        width: 14 },
  ];

  const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF4F46E5' } };
  sheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  sheet.getRow(1).height = 22;

  const sums: Record<string, number> = {
    ins: 0, scr: 0, mix: 0, par: 0, km: 0, hrs: 0, food: 0, parking: 0,
    tests_pay: 0, km_pay: 0, learning_pay: 0, expenses: 0, total: 0,
  };

  for (const e of (entries || [])) {
    const c = calcDaily(e);
    const tests_pay = c.insurance + c.screening + c.mixed + c.partial;
    const row = {
      date: e.date, ins: e.insurance_tests, scr: e.screening_tests,
      mix: e.mixed_screening_tests, par: e.partial_tests, km: e.kilometers,
      hrs: e.learning_hours, food: e.food_expense, parking: e.parking_expense,
      tests_pay, km_pay: c.km, learning_pay: c.learning, expenses: c.expenses, total: c.total,
    };
    sheet.addRow(row);
    for (const k of Object.keys(sums)) sums[k] += (row as Record<string, number>)[k] || 0;
  }

  sheet.addRow({});
  const totalsRow = sheet.addRow({ date: 'TOTAL', ...sums });
  totalsRow.eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF0F2F5' } };
  });

  for (let i = 2; i <= (entries?.length || 0) + 1; i++) {
    if (i % 2 === 0) {
      sheet.getRow(i).eachCell(cell => {
        cell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF9FAFB' } };
      });
    }
  }

  const xlsxBuffer = await workbook.xlsx.writeBuffer();

  const monthName = new Date(year, mon - 1).toLocaleString('en-US', { month: 'long' });
  const subject = `${monthName} ${year} - ${profile.username}`;

  // Collect file attachments
  const receiptFiles = formData.getAll('receipts') as File[];
  const parkingFiles = formData.getAll('parking') as File[];

  const attachments: nodemailer.Attachment[] = [
    {
      filename: `${subject}.xlsx`,
      content: Buffer.from(xlsxBuffer),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  ];

  for (let i = 0; i < receiptFiles.length; i++) {
    const buf = await receiptFiles[i].arrayBuffer();
    attachments.push({
      filename: `receipt_${i + 1}${extOf(receiptFiles[i].type)}`,
      content: Buffer.from(buf),
      contentType: receiptFiles[i].type,
    });
  }
  for (let i = 0; i < parkingFiles.length; i++) {
    const buf = await parkingFiles[i].arrayBuffer();
    attachments.push({
      filename: `parking_${i + 1}.pdf`,
      content: Buffer.from(buf),
      contentType: parkingFiles[i].type,
    });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: profile.gmail_user, pass: profile.gmail_app_password },
  });

  const text = `Please find attached the salary report for ${monthName} ${year}.` +
    (receiptFiles.length ? `\n\nGeneral receipts: ${receiptFiles.length} photo(s) attached.` : '') +
    (parkingFiles.length ? `\nParking receipts: ${parkingFiles.length} photo(s) attached.` : '');

  try {
    await transporter.sendMail({
      from: `Salary Tracker <${profile.gmail_user}>`,
      to: 'Yelena.p@mpcheck.co.il',
      subject,
      text,
      attachments,
    });
    return json({ success: true, subject });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
