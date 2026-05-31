import { useState, useEffect, useCallback } from 'react';
import api from '../api.js';

const EQUIPMENT_TYPES = ['bone_density', 'tonometer', 'echocardiogram', 'tanita', 'ge'];
const EQUIPMENT_LABELS = {
  bone_density:   'Bone Density',
  tonometer:      'Tonometer',
  echocardiogram: 'Echo',
  tanita:         'Tanita',
  ge:             'GE',
};

function activityColor(shiftsPerWeek) {
  const n = parseInt(shiftsPerWeek, 10);
  if (!n || n <= 2) return 'bg-red-100 text-red-700';
  if (n <= 4)       return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
}

const TABS = [
  { id: 'directory',    label: 'Directory',    icon: 'people' },
  { id: 'equipment',    label: 'Equipment',    icon: 'medical_services' },
  { id: 'compensation', label: 'Compensation', icon: 'payments' },
  { id: 'reports',      label: 'Reports',      icon: 'assignment' },
];

function nowMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('directory');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  // Reports state
  const [reportMonth, setReportMonth] = useState(nowMonth);
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [sendMsgs, setSendMsgs] = useState({});
  const [reportSummary, setReportSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveMsg, setApproveMsg] = useState(null);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  // Inline edit state: { [userId]: { field: value } }
  const [edits, setEdits] = useState({});

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/users');
      setUsers(data);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const loadSubmissions = useCallback(async (month) => {
    setSubmissionsLoading(true);
    setSendMsgs({});
    try {
      const { data } = await api.get(`/admin/submissions?month=${month}`);
      setSubmissions(data.submissions || []);
    } catch {
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  }, []);

  const loadReportSummary = useCallback(async (month) => {
    setSummaryLoading(true);
    try {
      const { data } = await api.get(`/admin/reports?month=${month}`);
      setReportSummary(data);
    } catch {
      setReportSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') {
      loadSubmissions(reportMonth);
      loadReportSummary(reportMonth);
      setApproveMsg(null);
    }
  }, [activeTab, reportMonth, loadSubmissions, loadReportSummary]);

  // ── Equipment toggle ───────────────────────────────────────────────────
  async function toggleEquipment(userId, type, hasIt) {
    try {
      if (hasIt) {
        await api.delete(`/admin/users/${userId}/equipment/${type}`);
      } else {
        await api.post(`/admin/users/${userId}/equipment`, { equipment_type: type });
      }
      setUsers(prev => prev.map(u => {
        if (u.id !== userId) return u;
        const eq = hasIt ? u.equipment.filter(e => e !== type) : [...u.equipment, type];
        return { ...u, equipment: eq };
      }));
    } catch { /* silent */ }
  }

  // ── Echo certified toggle ──────────────────────────────────────────────
  async function toggleEcho(userId, current) {
    try {
      await api.patch(`/admin/users/${userId}`, { echo_certified: !current });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, echo_certified: !current } : u));
    } catch { /* silent */ }
  }

  // ── Inline PATCH on blur ───────────────────────────────────────────────
  function setEdit(userId, field, value) {
    setEdits(prev => ({ ...prev, [userId]: { ...(prev[userId] || {}), [field]: value } }));
  }

  async function commitEdit(userId, field) {
    const value = edits[userId]?.[field];
    if (value === undefined) return;
    const user = users.find(u => u.id === userId);
    const original = user?.[field];
    const parsed = field === 'mileage_rate' || field === 'uniform_sets'
      ? (field === 'mileage_rate' ? parseFloat(value) : parseInt(value, 10))
      : value;
    if (parsed === original || (isNaN(parsed) && original == null)) return;
    try {
      await api.patch(`/admin/users/${userId}`, { [field]: parsed });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: parsed } : u));
    } catch { /* silent */ }
  }

  // ── Send individual submission ─────────────────────────────────────────
  async function sendSubmission(submissionId) {
    setSendingId(submissionId);
    setSendMsgs(prev => ({ ...prev, [submissionId]: null }));
    try {
      await api.post(`/admin/submissions/${submissionId}/send`);
      setSubmissions(prev => prev.map(s =>
        s.id === submissionId ? { ...s, sent_at: new Date().toISOString() } : s
      ));
      setSendMsgs(prev => ({ ...prev, [submissionId]: { type: 'success', text: 'Sent to accounting.' } }));
    } catch (err) {
      setSendMsgs(prev => ({ ...prev, [submissionId]: { type: 'error', text: err.response?.data?.error || 'Failed to send.' } }));
    } finally {
      setSendingId(null);
    }
  }

  async function approveMonth() {
    setShowApproveConfirm(false);
    setApproving(true);
    setApproveMsg(null);
    try {
      await api.post('/admin/reports/approve', { month: reportMonth });
      setApproveMsg({ type: 'success', text: 'Reports approved and emailed to accounting.' });
      loadReportSummary(reportMonth);
    } catch (err) {
      const status = err.response?.status;
      const text = status === 409
        ? 'This month has already been approved and sent.'
        : err.response?.data?.error || 'Failed to approve.';
      setApproveMsg({ type: status === 409 ? 'info' : 'error', text });
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-16 pb-24">
      {/* Page header */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Admin Dashboard</h1>
        <p className="text-xs text-slate-400 mt-0.5">{users.length} employees</p>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
                  active ? 'brand-gradient text-white' : 'bg-white text-slate-500 hover:bg-slate-100'
                }`}
                style={active ? { boxShadow: '0 4px 14px rgba(139,53,217,0.3)' } : {}}
              >
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab: Directory ─────────────────────────────────────────────── */}
      {activeTab === 'directory' && (
        <div className="overflow-x-auto px-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                <th className="sticky left-0 z-10 bg-slate-50 text-left px-3 py-2.5 min-w-[140px]">Full Name</th>
                <th className="text-left px-3 py-2.5 min-w-[90px]">Region</th>
                <th className="text-left px-3 py-2.5 min-w-[130px]">Certification</th>
                <th className="text-center px-3 py-2.5 min-w-[70px]">Echo</th>
                <th className="text-center px-3 py-2.5 min-w-[90px]">Bone Density</th>
                <th className="text-center px-3 py-2.5 min-w-[80px]">Tonometer</th>
                <th className="text-center px-3 py-2.5 min-w-[80px]">Days/Wk</th>
                <th className="text-left px-3 py-2.5 min-w-[130px]">Uniform</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const name = u.first_name || u.last_name
                  ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
                  : u.username;
                const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                const hasEcho = u.equipment.includes('echocardiogram');
                const hasBone = u.equipment.includes('bone_density');
                const hasTono = u.equipment.includes('tonometer');
                return (
                  <tr key={u.id} className={`${rowBg} border-b border-slate-100`}>
                    {/* Full Name — sticky */}
                    <td className={`sticky left-0 z-10 ${rowBg} px-3 py-2.5 min-w-[140px]`}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-900 whitespace-nowrap">{name}</span>
                        {u.is_admin && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full brand-gradient text-white">Admin</span>
                        )}
                      </div>
                    </td>

                    {/* Region */}
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{u.district || '—'}</td>

                    {/* Certification */}
                    <td className="px-3 py-2.5">
                      <div className="text-slate-700">{u.profession || '—'}</div>
                      {u.profession_document_signed_url && (
                        <a
                          href={u.profession_document_signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-brand-purple underline"
                        >View</a>
                      )}
                    </td>

                    {/* Echo */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => toggleEquipment(u.id, 'echocardiogram', hasEcho)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
                          hasEcho ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                        }`}
                      >{hasEcho ? 'Yes' : 'No'}</button>
                    </td>

                    {/* Bone Density */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => toggleEquipment(u.id, 'bone_density', hasBone)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
                          hasBone ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                        }`}
                      >{hasBone ? 'Yes' : 'No'}</button>
                    </td>

                    {/* Tonometer */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => toggleEquipment(u.id, 'tonometer', hasTono)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
                          hasTono ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                        }`}
                      >{hasTono ? 'Yes' : 'No'}</button>
                    </td>

                    {/* Days/Week */}
                    <td className="px-3 py-2.5 text-center">
                      <select
                        value={u.shifts_per_week || ''}
                        onChange={async e => {
                          const val = e.target.value || null;
                          setUsers(prev => prev.map(x => x.id === u.id ? { ...x, shifts_per_week: val } : x));
                          try { await api.patch(`/admin/users/${u.id}`, { shifts_per_week: val }); } catch { /* silent */ }
                        }}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border-0 cursor-pointer focus:outline-none ${activityColor(u.shifts_per_week)} ${!u.shifts_per_week ? 'bg-slate-100 text-slate-400' : ''}`}
                      >
                        <option value="">—</option>
                        <option value="1-2">1–2</option>
                        <option value="3-4">3–4</option>
                        <option value="5-6">5–6</option>
                      </select>
                    </td>

                    {/* Uniform */}
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <input
                          type="text"
                          defaultValue={u.clothing_size || ''}
                          placeholder="Size"
                          className="w-14 px-1.5 py-1 text-xs rounded-lg border border-slate-200 focus:border-brand-purple/50 focus:outline-none"
                          onFocus={e => setEdit(u.id, 'clothing_size', e.target.value)}
                          onChange={e => setEdit(u.id, 'clothing_size', e.target.value)}
                          onBlur={() => commitEdit(u.id, 'clothing_size')}
                        />
                        <input
                          type="number"
                          min="0"
                          defaultValue={u.uniform_sets ?? 0}
                          placeholder="Sets"
                          className="w-12 px-1.5 py-1 text-xs rounded-lg border border-slate-200 focus:border-brand-purple/50 focus:outline-none text-center"
                          onChange={e => setEdit(u.id, 'uniform_sets', e.target.value)}
                          onBlur={() => commitEdit(u.id, 'uniform_sets')}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Equipment ─────────────────────────────────────────────── */}
      {activeTab === 'equipment' && (
        <div className="px-4 space-y-3">
          {users.map(u => (
            <div key={u.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <p className="font-bold text-slate-900 mb-3">
                {u.first_name || u.last_name
                  ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
                  : u.username}
              </p>

              {/* Equipment toggles */}
              <div className="flex flex-wrap gap-2 mb-3">
                {EQUIPMENT_TYPES.map(type => {
                  const has = u.equipment.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => toggleEquipment(u.id, type, has)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
                        has
                          ? 'brand-gradient text-white border-transparent'
                          : 'bg-white text-slate-400 border-slate-200 hover:border-brand-purple/40'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: has ? "'FILL' 1" : "'FILL' 0" }}>
                        {type === 'echocardiogram' ? 'ecg_heart' : 'stethoscope'}
                      </span>
                      {EQUIPMENT_LABELS[type]}
                    </button>
                  );
                })}
              </div>

              {/* Echo certified */}
              <button
                onClick={() => toggleEcho(u.id, u.echo_certified)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
                  u.echo_certified
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-emerald-300'
                }`}
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: u.echo_certified ? "'FILL' 1" : "'FILL' 0" }}>
                  verified
                </span>
                Echo Certified: {u.echo_certified ? 'Yes' : 'No'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Compensation ──────────────────────────────────────────── */}
      {activeTab === 'compensation' && (
        <div className="px-4 space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-700 font-medium">
            <span className="material-symbols-outlined text-sm align-[-3px] mr-1">info</span>
            The 240 ₪ daily minimum guarantee applies to all employees. Only the mileage rate varies per person.
          </div>

          {users.map(u => (
            <div key={u.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900">
                    {u.first_name || u.last_name
                      ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
                      : u.username}
                  </p>
                  <p className="text-xs text-slate-400">{u.district || ''}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium whitespace-nowrap">₪ / km</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    defaultValue={u.mileage_rate ?? 2}
                    className="w-20 px-2 py-1.5 text-sm font-bold rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none text-center"
                    onChange={e => setEdit(u.id, 'mileage_rate', e.target.value)}
                    onBlur={() => commitEdit(u.id, 'mileage_rate')}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Reports ───────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="px-4 space-y-4">
          {/* Month picker */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-slate-400">calendar_month</span>
            <input
              type="month"
              value={reportMonth}
              onChange={e => setReportMonth(e.target.value)}
              className="flex-1 text-sm font-bold text-slate-800 border-0 focus:outline-none bg-transparent"
            />
          </div>

          {/* Salary Summary */}
          {summaryLoading ? (
            <div className="flex justify-center py-6">
              <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
            </div>
          ) : reportSummary && reportSummary.summaries.some(s => s.totals.days > 0) && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Salary Summary</p>
                {reportSummary.approved ? (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    Approved {new Date(reportSummary.approved.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                ) : (
                  <button
                    onClick={() => setShowApproveConfirm(true)}
                    disabled={approving || showApproveConfirm}
                    className="flex items-center gap-1.5 text-xs font-bold text-white brand-gradient px-3 py-1.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                    style={{ boxShadow: '0 2px 8px rgba(139,53,217,0.25)' }}
                  >
                    {approving
                      ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Approving...</>
                      : <><span className="material-symbols-outlined text-sm">send</span> Approve Month</>
                    }
                  </button>
                )}
              </div>

              {showApproveConfirm && (
                <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-amber-700 font-medium">This will email all salary reports to accounting. Continue?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowApproveConfirm(false)} className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 active:scale-95 transition-all">Cancel</button>
                    <button onClick={approveMonth} className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-600 text-white active:scale-95 transition-all">Confirm</button>
                  </div>
                </div>
              )}

              {approveMsg && (
                <div className={`mx-4 mt-3 px-4 py-2.5 rounded-xl text-xs font-semibold ${
                  approveMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  approveMsg.type === 'info'    ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                                  'bg-red-50 text-red-600 border border-red-200'
                }`}>{approveMsg.text}</div>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 min-w-[140px]">Employee</th>
                      <th className="text-center px-3 py-2.5">Days</th>
                      <th className="text-center px-3 py-2.5">Ins</th>
                      <th className="text-center px-3 py-2.5">Screen</th>
                      <th className="text-center px-3 py-2.5">Mixed</th>
                      <th className="text-center px-3 py-2.5">Partial</th>
                      <th className="text-center px-3 py-2.5">KM</th>
                      <th className="text-center px-3 py-2.5">Off Hrs</th>
                      <th className="text-right px-4 py-2.5 min-w-[80px]">Total ₪</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportSummary.summaries.filter(s => s.totals.days > 0).map((s, i) => (
                      <tr key={s.user.id} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{s.user.name}</td>
                        <td className="px-3 py-2.5 text-center text-slate-500">{s.totals.days}</td>
                        <td className="px-3 py-2.5 text-center text-slate-500">{s.totals.insurance_tests}</td>
                        <td className="px-3 py-2.5 text-center text-slate-500">{s.totals.screening_tests}</td>
                        <td className="px-3 py-2.5 text-center text-slate-500">{s.totals.mixed_screening_tests}</td>
                        <td className="px-3 py-2.5 text-center text-slate-500">{s.totals.partial_tests}</td>
                        <td className="px-3 py-2.5 text-center text-slate-500">{s.totals.kilometers}</td>
                        <td className="px-3 py-2.5 text-center text-slate-500">{s.totals.office_hours}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">₪{s.totals.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td className="px-4 py-2.5 font-bold text-slate-700 text-xs" colSpan="8">Grand Total</td>
                      <td className="px-4 py-2.5 text-right font-extrabold text-slate-900">
                        ₪{reportSummary.summaries.reduce((sum, s) => sum + s.totals.total, 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Submitted Reports */}
          {submissionsLoading ? (
            <div className="flex justify-center py-8">
              <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
            </div>
          ) : submissions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-12 flex flex-col items-center gap-2 text-slate-400">
              <span className="material-symbols-outlined text-4xl opacity-30">inbox</span>
              <p className="text-sm font-medium">No reports submitted yet for this month</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Submitted Reports</p>
              </div>
              {submissions.map(sub => {
                const isSent = !!sub.sent_at;
                const isSending = sendingId === sub.id;
                const msg = sendMsgs[sub.id];
                const submittedDate = new Date(sub.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const sentDate = isSent ? new Date(sub.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
                return (
                  <div key={sub.id} className="px-4 py-3.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{sub.user.name}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Submitted {submittedDate}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isSent ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 whitespace-nowrap">
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            Sent {sentDate}
                          </span>
                        ) : (
                          <button
                            onClick={() => sendSubmission(sub.id)}
                            disabled={isSending}
                            className="flex items-center gap-1.5 text-xs font-bold text-white brand-gradient px-3 py-1.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                            style={{ boxShadow: '0 2px 8px rgba(139,53,217,0.25)' }}
                          >
                            {isSending
                              ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Sending...</>
                              : <><span className="material-symbols-outlined text-sm">send</span> Send to Accounting</>
                            }
                          </button>
                        )}
                      </div>
                    </div>
                    {msg && (
                      <p className={`text-xs font-semibold mt-2 ${msg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {msg.text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
