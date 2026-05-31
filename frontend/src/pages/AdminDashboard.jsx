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
  { id: 'faq',          label: 'Portal',       icon: 'hub' },
];

const FAQ_CATEGORIES = [
  { id: 'insurance', label: 'בדיקות ביטוח' },
  { id: 'screening', label: 'בדיקות סקר' },
];

function nowMonth() {
  return new Date().toISOString().slice(0, 7);
}

function Field({ label, value, onChange, type = 'text', dir, placeholder, step }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        dir={dir}
        placeholder={placeholder || label}
        step={step}
        className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none bg-white"
      />
    </div>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('directory');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  // Portal tab state
  const [portalSubTab, setPortalSubTab] = useState('faq');
  // FAQ sub-tab
  const [faqItems, setFaqItems] = useState({ insurance: [], screening: [] });
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqCategory, setFaqCategory] = useState('insurance');
  const [addingFaq, setAddingFaq] = useState(false);
  const [newFaqQ, setNewFaqQ] = useState('');
  const [newFaqA, setNewFaqA] = useState('');
  const [editingFaqId, setEditingFaqId] = useState(null);
  const [editFaqQ, setEditFaqQ] = useState('');
  const [editFaqA, setEditFaqA] = useState('');
  const [faqSaving, setFaqSaving] = useState(false);
  // Apps sub-tab
  const [appCreds, setAppCreds] = useState([]);
  const [appCredsLoading, setAppCredsLoading] = useState(false);
  const [addingApp, setAddingApp] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppUser, setNewAppUser] = useState('');
  const [newAppPass, setNewAppPass] = useState('');
  const [newAppImage, setNewAppImage] = useState(null);
  const [editingAppId, setEditingAppId] = useState(null);
  const [editAppName, setEditAppName] = useState('');
  const [editAppUser, setEditAppUser] = useState('');
  const [editAppPass, setEditAppPass] = useState('');
  const [editAppImage, setEditAppImage] = useState(null);
  const [appSaving, setAppSaving] = useState(false);

  // Reports state
  const [reportMonth, setReportMonth] = useState(nowMonth);
  const [reportSummary, setReportSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [approveMsgs, setApproveMsgs] = useState({});

  // Inline edit state for compensation tab
  const [edits, setEdits] = useState({});

  // Directory drawer state
  const [selectedUser, setSelectedUser] = useState(null);
  const [drawerEdits, setDrawerEdits] = useState({});
  const [drawerSaving, setDrawerSaving] = useState(false);

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

  const loadFaq = useCallback(async () => {
    setFaqLoading(true);
    try {
      const { data } = await api.get('/faq');
      setFaqItems(data);
    } catch { /* silent */ }
    finally { setFaqLoading(false); }
  }, []);

  const loadAppCreds = useCallback(async () => {
    setAppCredsLoading(true);
    try {
      const { data } = await api.get('/portal/credentials');
      setAppCreds(data);
    } catch { /* silent */ }
    finally { setAppCredsLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'faq') { loadFaq(); loadAppCreds(); }
  }, [activeTab, loadFaq, loadAppCreds]);

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
      loadReportSummary(reportMonth);
      setApproveMsgs({});
    }
  }, [activeTab, reportMonth, loadReportSummary]);

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

  // ── Download Excel for a single user ──────────────────────────────────
  async function downloadReport(userId, userName) {
    setDownloadingId(userId);
    try {
      const res = await api.get(`/admin/users/${userId}/report/excel?month=${reportMonth}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${userName} - ${reportMonth}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
    finally { setDownloadingId(null); }
  }

  // ── FAQ management ────────────────────────────────────────────────────────
  async function saveFaq() {
    if (!newFaqQ.trim() || !newFaqA.trim()) return;
    setFaqSaving(true);
    try {
      const sort_order = faqItems[faqCategory].length;
      const { data } = await api.post('/faq', { category: faqCategory, question: newFaqQ.trim(), answer: newFaqA.trim(), sort_order });
      setFaqItems(prev => ({ ...prev, [faqCategory]: [...prev[faqCategory], data] }));
      setNewFaqQ(''); setNewFaqA(''); setAddingFaq(false);
    } catch { /* silent */ }
    finally { setFaqSaving(false); }
  }

  async function updateFaq(id) {
    if (!editFaqQ.trim() || !editFaqA.trim()) return;
    setFaqSaving(true);
    try {
      await api.patch(`/faq/${id}`, { question: editFaqQ.trim(), answer: editFaqA.trim() });
      setFaqItems(prev => ({
        ...prev,
        [faqCategory]: prev[faqCategory].map(x => x.id === id ? { ...x, question: editFaqQ.trim(), answer: editFaqA.trim() } : x),
      }));
      setEditingFaqId(null);
    } catch { /* silent */ }
    finally { setFaqSaving(false); }
  }

  async function deleteFaq(id) {
    const backup = faqItems[faqCategory];
    setFaqItems(prev => ({ ...prev, [faqCategory]: prev[faqCategory].filter(x => x.id !== id) }));
    try { await api.delete(`/faq/${id}`); }
    catch { setFaqItems(prev => ({ ...prev, [faqCategory]: backup })); }
  }

  async function moveFaq(id, direction) {
    const items = faqItems[faqCategory];
    const idx = items.findIndex(x => x.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === items.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newItems = [...items];
    [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]];
    const reordered = newItems.map((item, i) => ({ ...item, sort_order: i }));
    setFaqItems(prev => ({ ...prev, [faqCategory]: reordered }));
    try {
      await api.post('/faq/reorder', { items: reordered.map(({ id: xid, sort_order }) => ({ id: xid, sort_order })) });
    } catch { setFaqItems(prev => ({ ...prev, [faqCategory]: items })); }
  }

  // ── App credentials management ────────────────────────────────────────
  async function saveApp() {
    if (!newAppName.trim() || !newAppUser.trim() || !newAppPass.trim()) return;
    setAppSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', newAppName.trim());
      fd.append('username', newAppUser.trim());
      fd.append('password', newAppPass.trim());
      fd.append('sort_order', appCreds.length);
      if (newAppImage) fd.append('image', newAppImage);
      const { data } = await api.post('/portal/credentials', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAppCreds(prev => [...prev, data]);
      setNewAppName(''); setNewAppUser(''); setNewAppPass(''); setNewAppImage(null); setAddingApp(false);
    } catch { /* silent */ }
    finally { setAppSaving(false); }
  }

  async function updateApp(id) {
    if (!editAppName.trim() || !editAppUser.trim() || !editAppPass.trim()) return;
    setAppSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', editAppName.trim());
      fd.append('username', editAppUser.trim());
      fd.append('password', editAppPass.trim());
      if (editAppImage) fd.append('image', editAppImage);
      const { data } = await api.patch(`/portal/credentials/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAppCreds(prev => prev.map(x => x.id === id ? data : x));
      setEditingAppId(null); setEditAppImage(null);
    } catch { /* silent */ }
    finally { setAppSaving(false); }
  }

  async function deleteApp(id) {
    const backup = appCreds;
    setAppCreds(prev => prev.filter(x => x.id !== id));
    try { await api.delete(`/portal/credentials/${id}`); }
    catch { setAppCreds(backup); }
  }

  async function moveApp(id, direction) {
    const idx = appCreds.findIndex(x => x.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === appCreds.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newItems = [...appCreds];
    [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]];
    const reordered = newItems.map((item, i) => ({ ...item, sort_order: i }));
    setAppCreds(reordered);
    try {
      await api.post('/portal/credentials/reorder', {
        items: reordered.map(({ id: xid, sort_order }) => ({ id: xid, sort_order })),
      });
    } catch { setAppCreds(appCreds); }
  }

  // ── Approve + email one user's report ─────────────────────────────────
  async function approveUserReport(userId) {
    setApprovingId(userId);
    setApproveMsgs(prev => ({ ...prev, [userId]: null }));
    try {
      const { data } = await api.post(`/admin/users/${userId}/report/approve`, { month: reportMonth });
      setReportSummary(prev => ({
        ...prev,
        summaries: prev.summaries.map(s =>
          s.user.id === userId ? { ...s, approved: { at: data.approvedAt } } : s
        ),
      }));
    } catch (err) {
      const status = err.response?.status;
      const text = status === 409
        ? 'Already approved and sent.'
        : err.response?.data?.error || 'Failed to approve.';
      setApproveMsgs(prev => ({ ...prev, [userId]: text }));
    } finally {
      setApprovingId(null);
    }
  }

  // ── Directory drawer ───────────────────────────────────────────────────
  function openDrawer(user) {
    setSelectedUser(user);
    setDrawerEdits({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      profession: user.profession || '',
      district: user.district || '',
      shifts_per_week: user.shifts_per_week || '',
      vehicle_type_color: user.vehicle_type_color || '',
      vehicle_number: user.vehicle_number || '',
      clothing_size: user.clothing_size || '',
      uniform_sets: user.uniform_sets ?? '',
      mileage_rate: user.mileage_rate ?? 2,
    });
  }

  async function saveDrawer() {
    if (!selectedUser) return;
    setDrawerSaving(true);
    try {
      const updates = { ...drawerEdits };
      if (updates.uniform_sets !== '') updates.uniform_sets = parseInt(updates.uniform_sets, 10);
      if (updates.mileage_rate !== '') updates.mileage_rate = parseFloat(updates.mileage_rate);
      await api.patch(`/admin/users/${selectedUser.id}`, updates);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...updates } : u));
      setSelectedUser(null);
    } catch { /* silent */ }
    finally { setDrawerSaving(false); }
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
        <div className="px-4 space-y-2">
          {users.map(u => {
            const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
            const initials = (`${(u.first_name || '')[0] || ''}${(u.last_name || '')[0] || ''}`.toUpperCase()) || u.username[0]?.toUpperCase() || '?';
            return (
              <button
                key={u.id}
                onClick={() => openDrawer(u)}
                className="w-full bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-all"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-bold text-slate-800 text-sm">{name}</p>
                    {u.is_admin && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full brand-gradient text-white">Admin</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {[u.district, u.profession].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <span className="material-symbols-outlined text-slate-300 text-xl flex-shrink-0">chevron_right</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Tab: Equipment ─────────────────────────────────────────────── */}
      {activeTab === 'equipment' && (
        <div className="overflow-x-auto px-4">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                <th className="sticky left-0 z-10 bg-slate-50 text-left px-3 py-2.5 min-w-[140px]">Employee</th>
                {EQUIPMENT_TYPES.map(t => (
                  <th key={t} className="text-center px-3 py-2.5 min-w-[80px]">{EQUIPMENT_LABELS[t]}</th>
                ))}
                <th className="text-center px-3 py-2.5 min-w-[90px]">Echo Cert.</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
                const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                return (
                  <tr key={u.id} className={`${rowBg} border-b border-slate-100`}>
                    <td className={`sticky left-0 z-10 ${rowBg} px-3 py-2.5 font-semibold text-slate-800 whitespace-nowrap`}>{name}</td>
                    {EQUIPMENT_TYPES.map(type => {
                      const has = u.equipment.includes(type);
                      return (
                        <td key={type} className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => toggleEquipment(u.id, type, has)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${has ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}
                          >{has ? 'Yes' : 'No'}</button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => toggleEcho(u.id, u.echo_certified)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${u.echo_certified ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}
                      >{u.echo_certified ? 'Yes' : 'No'}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

          {summaryLoading ? (
            <div className="flex justify-center py-10">
              <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
            </div>
          ) : !reportSummary || !reportSummary.summaries.some(s => s.totals.days > 0) ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-12 flex flex-col items-center gap-2 text-slate-400">
              <span className="material-symbols-outlined text-4xl opacity-30">inbox</span>
              <p className="text-sm font-medium">No entries for this month</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Employee Reports</p>
              </div>
              {reportSummary.summaries.filter(s => s.totals.days > 0).map(s => {
                const isDownloading = downloadingId === s.user.id;
                const isApproving  = approvingId   === s.user.id;
                const errMsg       = approveMsgs[s.user.id];
                const approvedAt   = s.approved?.at
                  ? new Date(s.approved.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : null;
                return (
                  <div key={s.user.id} className="px-4 py-3.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm">{s.user.name}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{s.totals.days} day{s.totals.days !== 1 ? 's' : ''} · ₪{s.totals.total.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                        {/* Open Report */}
                        <button
                          onClick={() => downloadReport(s.user.id, s.user.name)}
                          disabled={isDownloading}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-brand-purple/40 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isDownloading
                            ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Downloading...</>
                            : <><span className="material-symbols-outlined text-sm">download</span> Open Report</>
                          }
                        </button>

                        {/* Approve or badge */}
                        {approvedAt ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 whitespace-nowrap">
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            Approved {approvedAt}
                          </span>
                        ) : (
                          <button
                            onClick={() => approveUserReport(s.user.id)}
                            disabled={isApproving}
                            className="flex items-center gap-1.5 text-xs font-bold text-white brand-gradient px-3 py-1.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                            style={{ boxShadow: '0 2px 8px rgba(139,53,217,0.25)' }}
                          >
                            {isApproving
                              ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Approving...</>
                              : <><span className="material-symbols-outlined text-sm">send</span> Approve</>
                            }
                          </button>
                        )}
                      </div>
                    </div>
                    {errMsg && (
                      <p className="text-xs font-semibold mt-2 text-red-500">{errMsg}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* ── Tab: Portal (FAQ + Apps) ───────────────────────────────────── */}
      {activeTab === 'faq' && (
        <div className="px-4 space-y-4">
          {/* Sub-tab toggle */}
          <div className="flex gap-2">
            {[{ id: 'faq', label: 'FAQ', icon: 'quiz' }, { id: 'apps', label: 'Apps', icon: 'apps' }].map(st => {
              const active = portalSubTab === st.id;
              return (
                <button key={st.id} onClick={() => { setPortalSubTab(st.id); setAddingFaq(false); setEditingFaqId(null); setAddingApp(false); setEditingAppId(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95 ${active ? 'brand-gradient text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
                  style={active ? { boxShadow: '0 4px 14px rgba(139,53,217,0.3)' } : {}}>
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{st.icon}</span>
                  {st.label}
                </button>
              );
            })}
          </div>

          {/* Apps sub-tab */}
          {portalSubTab === 'apps' && (
            <div className="space-y-3">
              {appCredsLoading ? (
                <div className="flex justify-center py-10"><span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span></div>
              ) : (
                <>
                  {appCreds.length === 0 && !addingApp && (
                    <div className="bg-white rounded-2xl border border-slate-100 py-10 flex flex-col items-center gap-2 text-slate-400">
                      <span className="material-symbols-outlined text-4xl opacity-30">apps</span>
                      <p className="text-sm font-medium">No apps yet</p>
                    </div>
                  )}
                  {appCreds.map((cred, i) => {
                    const isEditing = editingAppId === cred.id;
                    return (
                      <div key={cred.id} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                        {isEditing ? (
                          <>
                            <Field label="App Name" value={editAppName} onChange={setEditAppName} />
                            <Field label="Username" value={editAppUser} onChange={setEditAppUser} />
                            <Field label="Password" value={editAppPass} onChange={setEditAppPass} />
                            {/* Image picker */}
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Image</label>
                              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${editAppImage ? 'border-brand-purple/40 bg-purple-50' : 'border-slate-200 hover:border-brand-purple/30'}`}>
                                {editAppImage ? (
                                  <img src={URL.createObjectURL(editAppImage)} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" alt="" />
                                ) : cred.image_signed_url ? (
                                  <img src={cred.image_signed_url} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" alt="" />
                                ) : (
                                  <span className="material-symbols-outlined text-slate-400 text-xl flex-shrink-0">image</span>
                                )}
                                <span className="text-xs text-slate-500 flex-1">{editAppImage ? editAppImage.name : cred.image_signed_url ? 'Change image' : 'Upload image'}</span>
                                <input type="file" accept="image/*" className="hidden" onChange={e => setEditAppImage(e.target.files[0] || null)} />
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => updateApp(cred.id)} disabled={appSaving || !editAppName.trim() || !editAppUser.trim() || !editAppPass.trim()}
                                className="flex-1 py-2 rounded-xl text-sm font-bold text-white brand-gradient active:scale-95 transition-all disabled:opacity-50">Save</button>
                              <button onClick={() => { setEditingAppId(null); setEditAppImage(null); }}
                                className="flex-1 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 active:scale-95 transition-all">Cancel</button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col gap-1 flex-shrink-0 pt-0.5">
                              <button onClick={() => moveApp(cred.id, 'up')} disabled={i === 0}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-20">
                                <span className="material-symbols-outlined text-base">arrow_upward</span>
                              </button>
                              <button onClick={() => moveApp(cred.id, 'down')} disabled={i === appCreds.length - 1}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-20">
                                <span className="material-symbols-outlined text-base">arrow_downward</span>
                              </button>
                            </div>
                            {cred.image_signed_url && (
                              <img src={cred.image_signed_url} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" alt={cred.name} />
                            )}
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setEditingAppId(cred.id); setEditAppName(cred.name); setEditAppUser(cred.username); setEditAppPass(cred.password); setEditAppImage(null); }}>
                              <p className="text-sm font-bold text-slate-800">{cred.name}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{cred.username}</p>
                              <p className="text-[10px] text-brand-purple mt-1 font-medium">Tap to edit</p>
                            </div>
                            <button onClick={() => deleteApp(cred.id)}
                              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 active:scale-95 transition-all">
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {addingApp ? (
                    <div className="bg-white rounded-2xl border border-brand-purple/20 p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">New App</p>
                      <Field label="App Name" value={newAppName} onChange={setNewAppName} />
                      <Field label="Username" value={newAppUser} onChange={setNewAppUser} />
                      <Field label="Password" value={newAppPass} onChange={setNewAppPass} />
                      {/* Image picker */}
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Image</label>
                        <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${newAppImage ? 'border-brand-purple/40 bg-purple-50' : 'border-slate-200 hover:border-brand-purple/30'}`}>
                          {newAppImage ? (
                            <img src={URL.createObjectURL(newAppImage)} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" alt="" />
                          ) : (
                            <span className="material-symbols-outlined text-slate-400 text-xl flex-shrink-0">image</span>
                          )}
                          <span className="text-xs text-slate-500 flex-1">{newAppImage ? newAppImage.name : 'Upload image (optional)'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={e => setNewAppImage(e.target.files[0] || null)} />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveApp} disabled={appSaving || !newAppName.trim() || !newAppUser.trim() || !newAppPass.trim()}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white brand-gradient active:scale-95 transition-all disabled:opacity-50">
                          {appSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => { setAddingApp(false); setNewAppName(''); setNewAppUser(''); setNewAppPass(''); setNewAppImage(null); }}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 active:scale-95 transition-all">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingApp(true); setEditingAppId(null); }}
                      className="w-full py-3 rounded-2xl text-sm font-bold text-brand-purple border-2 border-dashed border-brand-purple/30 hover:border-brand-purple/50 bg-white active:scale-95 transition-all flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-base">add</span>Add App
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* FAQ sub-tab */}
          {portalSubTab === 'faq' && (
          <div className="space-y-4">
          {/* Category toggle */}
          <div className="flex gap-2">
            {FAQ_CATEGORIES.map(cat => {
              const active = faqCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setFaqCategory(cat.id); setAddingFaq(false); setEditingFaqId(null); }}
                  className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
                    active ? 'brand-gradient text-white' : 'bg-white text-slate-500 border border-slate-200'
                  }`}
                  style={active ? { boxShadow: '0 4px 14px rgba(139,53,217,0.3)' } : {}}
                  dir="rtl"
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {faqLoading ? (
            <div className="flex justify-center py-10">
              <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
            </div>
          ) : (
            <>
              {/* Question list */}
              {faqItems[faqCategory].length === 0 && !addingFaq && (
                <div className="bg-white rounded-2xl border border-slate-100 py-10 flex flex-col items-center gap-2 text-slate-400">
                  <span className="material-symbols-outlined text-4xl opacity-30">quiz</span>
                  <p className="text-sm font-medium">No questions yet</p>
                </div>
              )}

              {faqItems[faqCategory].map((item, i) => {
                const isEditing = editingFaqId === item.id;
                const total = faqItems[faqCategory].length;
                return (
                  <div key={item.id} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                    {isEditing ? (
                      <>
                        <input
                          value={editFaqQ}
                          onChange={e => setEditFaqQ(e.target.value)}
                          dir="rtl"
                          placeholder="Question"
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none"
                        />
                        <textarea
                          value={editFaqA}
                          onChange={e => setEditFaqA(e.target.value)}
                          dir="rtl"
                          rows={3}
                          placeholder="Answer"
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateFaq(item.id)}
                            disabled={faqSaving || !editFaqQ.trim() || !editFaqA.trim()}
                            className="flex-1 py-2 rounded-xl text-sm font-bold text-white brand-gradient active:scale-95 transition-all disabled:opacity-50"
                          >Save</button>
                          <button
                            onClick={() => setEditingFaqId(null)}
                            className="flex-1 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 active:scale-95 transition-all"
                          >Cancel</button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-3">
                        {/* Reorder buttons */}
                        <div className="flex flex-col gap-1 flex-shrink-0 pt-0.5">
                          <button
                            onClick={() => moveFaq(item.id, 'up')}
                            disabled={i === 0}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-20"
                          >
                            <span className="material-symbols-outlined text-base">arrow_upward</span>
                          </button>
                          <button
                            onClick={() => moveFaq(item.id, 'down')}
                            disabled={i === total - 1}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-20"
                          >
                            <span className="material-symbols-outlined text-base">arrow_downward</span>
                          </button>
                        </div>

                        {/* Content — tap to edit */}
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => { setEditingFaqId(item.id); setEditFaqQ(item.question); setEditFaqA(item.answer); }}
                        >
                          <p className="text-sm font-semibold text-slate-800 leading-snug" dir="rtl">{item.question}</p>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2" dir="rtl">{item.answer}</p>
                          <p className="text-[10px] text-brand-purple mt-1.5 font-medium">Tap to edit</p>
                        </div>

                        {/* Delete */}
                        <button
                          onClick={() => deleteFaq(item.id)}
                          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add question form / button */}
              {addingFaq ? (
                <div className="bg-white rounded-2xl border border-brand-purple/20 p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">New Question</p>
                  <input
                    value={newFaqQ}
                    onChange={e => setNewFaqQ(e.target.value)}
                    dir="rtl"
                    placeholder="Question..."
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none"
                  />
                  <textarea
                    value={newFaqA}
                    onChange={e => setNewFaqA(e.target.value)}
                    dir="rtl"
                    rows={3}
                    placeholder="Answer..."
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveFaq}
                      disabled={faqSaving || !newFaqQ.trim() || !newFaqA.trim()}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white brand-gradient active:scale-95 transition-all disabled:opacity-50"
                    >
                      {faqSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setAddingFaq(false); setNewFaqQ(''); setNewFaqA(''); }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 active:scale-95 transition-all"
                    >Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingFaq(true); setEditingFaqId(null); }}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-brand-purple border-2 border-dashed border-brand-purple/30 hover:border-brand-purple/50 bg-white active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Add Question
                </button>
              )}
            </>
          )}
          </div>
          )}
        </div>
      )}

      {/* ── User Detail Drawer ─────────────────────────────────────────── */}
      {selectedUser && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setSelectedUser(null); }}>
          <div className="relative z-50 bg-white rounded-3xl flex flex-col w-full max-w-lg shadow-2xl" style={{ maxHeight: '85vh' }}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0" />
            <div className="px-5 py-3 flex items-center justify-between flex-shrink-0 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900">
                    {`${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.username}
                  </h2>
                  {selectedUser.is_admin && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full brand-gradient text-white">Admin</span>}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{selectedUser.username}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              <section>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Personal</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First Name" value={drawerEdits.first_name} onChange={v => setDrawerEdits(p => ({...p, first_name: v}))} />
                    <Field label="Last Name" value={drawerEdits.last_name} onChange={v => setDrawerEdits(p => ({...p, last_name: v}))} />
                  </div>
                  <Field label="Email" value={drawerEdits.email} onChange={v => setDrawerEdits(p => ({...p, email: v}))} type="email" />
                  <Field label="Phone" value={drawerEdits.phone} onChange={v => setDrawerEdits(p => ({...p, phone: v}))} type="tel" />
                  <Field label="כתובת מגורים" value={drawerEdits.address} onChange={v => setDrawerEdits(p => ({...p, address: v}))} dir="rtl" placeholder="רחוב, עיר" />
                </div>
              </section>
              <section>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Work</p>
                <div className="space-y-3">
                  <Field label="Profession" value={drawerEdits.profession} onChange={v => setDrawerEdits(p => ({...p, profession: v}))} />
                  <Field label="District" value={drawerEdits.district} onChange={v => setDrawerEdits(p => ({...p, district: v}))} />
                  <Field label="Shifts / Week" value={drawerEdits.shifts_per_week} onChange={v => setDrawerEdits(p => ({...p, shifts_per_week: v}))} />
                  {selectedUser.profession_document_signed_url && (
                    <a href={selectedUser.profession_document_signed_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs font-semibold text-brand-purple">
                      <span className="material-symbols-outlined text-sm">description</span>View Profession Document
                    </a>
                  )}
                </div>
              </section>
              <section>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">פרטי רכב</p>
                <div className="space-y-3">
                  <Field label="סוג רכב וצבע" value={drawerEdits.vehicle_type_color} onChange={v => setDrawerEdits(p => ({...p, vehicle_type_color: v}))} dir="rtl" />
                  <Field label="מספר רכב" value={drawerEdits.vehicle_number} onChange={v => setDrawerEdits(p => ({...p, vehicle_number: v}))} dir="rtl" />
                </div>
              </section>
              <section>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Uniform & Pay</p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Size" value={drawerEdits.clothing_size} onChange={v => setDrawerEdits(p => ({...p, clothing_size: v}))} placeholder="M" />
                  <Field label="Sets" value={String(drawerEdits.uniform_sets)} onChange={v => setDrawerEdits(p => ({...p, uniform_sets: v}))} type="number" />
                  <Field label="₪ / km" value={String(drawerEdits.mileage_rate)} onChange={v => setDrawerEdits(p => ({...p, mileage_rate: v}))} type="number" step="0.5" />
                </div>
              </section>
              <section>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Equipment</p>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT_TYPES.map(t => {
                    const has = selectedUser.equipment.includes(t);
                    return (
                      <span key={t} className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${has ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                        {EQUIPMENT_LABELS[t]}
                      </span>
                    );
                  })}
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${selectedUser.echo_certified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                    Echo Certified
                  </span>
                </div>
              </section>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0">
              <button
                onClick={saveDrawer}
                disabled={drawerSaving}
                className="w-full py-3 rounded-2xl text-sm font-bold text-white brand-gradient active:scale-[0.98] transition-all disabled:opacity-50"
                style={{ boxShadow: '0 4px 14px rgba(139,53,217,0.3)' }}
              >
                {drawerSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  );
}
