import { useState, useEffect, useCallback } from 'react';
import api from '../api.js';

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EMPTY_COMPANY_FORM = { name: '', requires_vouchers: false };
const EMPTY_BRANCH_FORM = {
  name: '', contacts: [],
  performed_test_ids: [], registration_url: '', address: '', has_parking: null,
};

function whatsappLink(phone) {
  if (!phone) return '#';
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? '972' + digits.slice(1) : digits;
  return `https://wa.me/${normalized}`;
}

function wazeLink(address) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

function CompanyAvatar({ company, size = 'lg' }) {
  const dim = size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-10 h-10 text-base';
  if (company.logo_url) {
    return (
      <img
        src={company.logo_url}
        alt={company.name}
        className={`${dim} rounded-2xl object-contain bg-slate-50 border border-slate-100`}
        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
      />
    );
  }
  return (
    <div className={`${dim} rounded-2xl brand-gradient flex items-center justify-center text-white font-extrabold flex-shrink-0`}>
      {company.name[0]}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const isPdf = (url) => url?.toLowerCase().endsWith('.pdf');

function TestCatalogRow({ test, onRename, onDelete }) {
  const [name, setName] = useState(test.name);
  useEffect(() => { setName(test.name); }, [test.name]);

  function commit() {
    const trimmed = name.trim();
    if (!trimmed) { setName(test.name); return; }
    if (trimmed !== test.name) onRename(test, trimmed).catch(() => setName(test.name));
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 text-right"
        maxLength={200}
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      <button
        type="button"
        onClick={() => onDelete(test)}
        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
      >
        <span className="material-symbols-outlined text-sm">delete</span>
      </button>
    </div>
  );
}

export default function ScreeningLocationsPage() {
  const [companies, setCompanies] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testCatalog, setTestCatalog] = useState([]);
  const [showTestCatalog, setShowTestCatalog] = useState(false);
  const [newTestName, setNewTestName] = useState('');
  const [catalogNewName, setCatalogNewName] = useState('');
  const [testCatalogError, setTestCatalogError] = useState('');

  // Branches sheet
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  // Branch detail sheet
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [smsPhone, setSmsPhone] = useState('');

  // Brochure upload (inline, from detail sheet)
  const [brochureUploading, setBrochureUploading] = useState(false);

  // Company CRUD modal
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY_FORM);
  const [companyLogoFile, setCompanyLogoFile] = useState(null);
  const [companyLogoPreview, setCompanyLogoPreview] = useState(null);
  const [companyBrochureFile, setCompanyBrochureFile] = useState(null);
  const [companyBrochurePreview, setCompanyBrochurePreview] = useState(null);
  const [companySubmitting, setCompanySubmitting] = useState(false);
  const [companyFormError, setCompanyFormError] = useState('');

  // Branch CRUD modal
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [branchForm, setBranchForm] = useState(EMPTY_BRANCH_FORM);
  const [branchSubmitting, setBranchSubmitting] = useState(false);
  const [branchFormError, setBranchFormError] = useState('');

  // Vouchers
  const [voucherDate, setVoucherDate] = useState(() => localDateStr(new Date()));
  const [vouchers, setVouchers] = useState([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [voucherUploading, setVoucherUploading] = useState(false);
  const [voucherDownloading, setVoucherDownloading] = useState(false);

  useEffect(() => {
    const viewport = document.querySelector('meta[name=viewport]');
    if (!viewport) return;
    viewport.setAttribute(
      'content',
      lightboxUrl
        ? 'width=device-width, initial-scale=1.0'
        : 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    );
  }, [lightboxUrl]);

  // ── Load ───────────────────────────────────────────────────────────────

  useEffect(() => {
    // Run independently so one failure doesn't block the other
    api.get('/auth/me')
      .then(res => setIsAdmin(!!res.data.is_admin))
      .catch(() => {});

    api.get('/screening/companies')
      .then(res => setCompanies(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));

    api.get('/screening/tests-catalog')
      .then(res => setTestCatalog(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'vouchers' && selectedBranch) {
      loadVouchers(selectedBranch.id, voucherDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedBranch?.id]);

  const loadBranches = useCallback(async (companyId) => {
    setBranchesLoading(true);
    try {
      const { data } = await api.get(`/screening/companies/${companyId}/branches`);
      setBranches(data);
    } catch {}
    finally { setBranchesLoading(false); }
  }, []);

  // ── Company sheet ──────────────────────────────────────────────────────

  function openCompany(company) {
    setSelectedCompany(company);
    setBranches([]);
    setSelectedBranch(null);
    loadBranches(company.id);
  }

  function closeCompanySheet() {
    setSelectedCompany(null);
    setBranches([]);
    setSelectedBranch(null);
    setVouchers([]);
    setVoucherDate(localDateStr(new Date()));
  }

  // ── Company CRUD ───────────────────────────────────────────────────────

  function openAddCompany() {
    setEditingCompany(null);
    setCompanyForm(EMPTY_COMPANY_FORM);
    setCompanyLogoFile(null);
    setCompanyLogoPreview(null);
    setCompanyBrochureFile(null);
    setCompanyBrochurePreview(null);
    setCompanyFormError('');
    setShowCompanyForm(true);
  }

  function openEditCompany(company) {
    setEditingCompany(company);
    setCompanyForm({ name: company.name, requires_vouchers: !!company.requires_vouchers });
    setCompanyLogoFile(null);
    setCompanyLogoPreview(company.logo_url || null);
    setCompanyBrochureFile(null);
    setCompanyBrochurePreview(company.brochure_url || null);
    setCompanyFormError('');
    setShowCompanyForm(true);
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompanyLogoFile(file);
    setCompanyLogoPreview(URL.createObjectURL(file));
  }

  function handleBrochureChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompanyBrochureFile(file);
    setCompanyBrochurePreview(URL.createObjectURL(file));
  }

  async function submitCompany() {
    if (!companyForm.name.trim()) { setCompanyFormError('שם החברה הוא שדה חובה'); return; }
    setCompanySubmitting(true);
    setCompanyFormError('');
    try {
      const formData = new FormData();
      formData.append('name', companyForm.name.trim());
      formData.append('requires_vouchers', companyForm.requires_vouchers ? 'true' : 'false');
      if (companyLogoFile) formData.append('logo', companyLogoFile);
      if (companyBrochureFile) formData.append('brochure', companyBrochureFile);

      if (editingCompany) {
        const { data } = await api.put(`/screening/companies/${editingCompany.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setCompanies(prev => prev.map(c => c.id === data.id ? data : c));
        if (selectedCompany?.id === data.id) setSelectedCompany(data);
      } else {
        const { data } = await api.post('/screening/companies', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setCompanies(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowCompanyForm(false);
    } catch (err) {
      const msg = err.response?.data?.error;
      setCompanyFormError(typeof msg === 'string' ? msg : 'שגיאה בשמירה');
    } finally {
      setCompanySubmitting(false);
    }
  }

  async function deleteCompany(company) {
    if (!confirm(`למחוק את "${company.name}"? כל הסניפים יימחקו גם כן.`)) return;
    try {
      await api.delete(`/screening/companies/${company.id}`);
      setCompanies(prev => prev.filter(c => c.id !== company.id));
      if (selectedCompany?.id === company.id) closeCompanySheet();
    } catch (err) {
      alert(err.response?.data?.error || 'שגיאה במחיקה');
    }
  }

  // ── Branch CRUD ────────────────────────────────────────────────────────

  function openAddBranch() {
    setEditingBranch(null);
    setBranchForm(EMPTY_BRANCH_FORM);
    setBranchFormError('');
    setShowBranchForm(true);
  }

  function openEditBranch(branch) {
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name,
      contacts: branch.contacts || [],
      performed_test_ids: branch.performed_test_ids || [],
      registration_url: branch.registration_url || '',
      address: branch.address || '',
      has_parking: branch.has_parking ?? null,
    });
    setBranchFormError('');
    setShowBranchForm(true);
  }

  function addContact() {
    setBranchForm(p => ({ ...p, contacts: [...p.contacts, { name: '', phone: '' }] }));
  }

  function removeContact(index) {
    setBranchForm(p => ({ ...p, contacts: p.contacts.filter((_, i) => i !== index) }));
  }

  function updateContact(index, field, value) {
    setBranchForm(p => ({
      ...p,
      contacts: p.contacts.map((c, i) => i === index ? { ...c, [field]: value } : c),
    }));
  }

  function togglePerformedTest(id) {
    setBranchForm(prev => ({
      ...prev,
      performed_test_ids: prev.performed_test_ids.includes(id)
        ? prev.performed_test_ids.filter(t => t !== id)
        : [...prev.performed_test_ids, id],
    }));
  }

  // ── Performed-tests catalog ────────────────────────────────────────────

  function sortTests(list) {
    return [...list].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name, 'he'));
  }

  async function addCatalogTest(name) {
    const { data } = await api.post('/screening/tests-catalog', { name });
    setTestCatalog(prev => sortTests([...prev, data]));
    return data;
  }

  async function addTestFromBranchForm() {
    const name = newTestName.trim();
    if (!name) return;
    setBranchFormError('');
    try {
      const test = await addCatalogTest(name);
      setNewTestName('');
      setBranchForm(p => ({ ...p, performed_test_ids: [...p.performed_test_ids, test.id] }));
    } catch (err) {
      const msg = err.response?.data?.error;
      setBranchFormError(typeof msg === 'string' ? msg : 'שגיאה בהוספת בדיקה');
    }
  }

  async function addTestFromCatalogModal() {
    const name = catalogNewName.trim();
    if (!name) return;
    setTestCatalogError('');
    try {
      await addCatalogTest(name);
      setCatalogNewName('');
    } catch (err) {
      const msg = err.response?.data?.error;
      setTestCatalogError(typeof msg === 'string' ? msg : 'שגיאה בהוספת בדיקה');
    }
  }

  async function renameCatalogTest(test, name) {
    setTestCatalogError('');
    try {
      const { data } = await api.put(`/screening/tests-catalog/${test.id}`, { name });
      setTestCatalog(prev => sortTests(prev.map(t => t.id === data.id ? data : t)));
    } catch (err) {
      const msg = err.response?.data?.error;
      setTestCatalogError(typeof msg === 'string' ? msg : 'שגיאה בשמירה');
      throw err;
    }
  }

  async function deleteCatalogTest(test) {
    if (!confirm(`למחוק את "${test.name}"? הבדיקה תוסר מכל הסניפים.`)) return;
    setTestCatalogError('');
    try {
      await api.delete(`/screening/tests-catalog/${test.id}`);
      setTestCatalog(prev => prev.filter(t => t.id !== test.id));
    } catch (err) {
      const msg = err.response?.data?.error;
      setTestCatalogError(typeof msg === 'string' ? msg : 'שגיאה במחיקה');
    }
  }

  async function submitBranch() {
    if (!branchForm.name.trim()) { setBranchFormError('שם הסניף הוא שדה חובה'); return; }
    setBranchSubmitting(true);
    setBranchFormError('');
    try {
      const fd = new FormData();
      fd.append('name', branchForm.name.trim());
      fd.append('contacts', JSON.stringify(branchForm.contacts.filter(c => c.name.trim() || c.phone.trim())));
      fd.append('performed_test_ids', JSON.stringify(branchForm.performed_test_ids.filter(id => testCatalog.some(t => t.id === id))));
      fd.append('registration_url', branchForm.registration_url.trim());
      fd.append('address', branchForm.address.trim());
      fd.append('has_parking', branchForm.has_parking === null ? '' : String(branchForm.has_parking));

      const headers = { 'Content-Type': 'multipart/form-data' };
      if (editingBranch) {
        const { data } = await api.put(`/screening/branches/${editingBranch.id}`, fd, { headers });
        setBranches(prev => prev.map(b => b.id === data.id ? data : b));
        if (selectedBranch?.id === data.id) setSelectedBranch(data);
      } else {
        const { data } = await api.post(`/screening/companies/${selectedCompany.id}/branches`, fd, { headers });
        setBranches(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowBranchForm(false);
    } catch (err) {
      const msg = err.response?.data?.error;
      setBranchFormError(typeof msg === 'string' ? msg : 'שגיאה בשמירה');
    } finally {
      setBranchSubmitting(false);
    }
  }

  async function uploadCompanyBrochure(file) {
    setBrochureUploading(true);
    try {
      const fd = new FormData();
      fd.append('name', selectedCompany.name);
      fd.append('requires_vouchers', selectedCompany.requires_vouchers ? 'true' : 'false');
      fd.append('brochure', file);
      const { data } = await api.put(`/screening/companies/${selectedCompany.id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSelectedCompany(data);
      setCompanies(prev => prev.map(c => c.id === data.id ? data : c));
    } catch (err) {
      const msg = err.response?.data?.error;
      alert(typeof msg === 'string' ? msg : 'שגיאה בהעלאת החוברת');
    } finally {
      setBrochureUploading(false);
    }
  }

  function sendRegistrationSms() {
    if (!smsPhone.trim() || !selectedBranch?.registration_url) return;
    const digits = smsPhone.replace(/\D/g, '');
    window.location.href = `sms:${digits}?body=${encodeURIComponent(selectedBranch.registration_url)}`;
  }

  async function deleteBranch(branch) {
    if (!confirm(`למחוק את הסניף "${branch.name}"?`)) return;
    try {
      await api.delete(`/screening/branches/${branch.id}`);
      setBranches(prev => prev.filter(b => b.id !== branch.id));
      if (selectedBranch?.id === branch.id) setSelectedBranch(null);
    } catch (err) {
      alert(err.response?.data?.error || 'שגיאה במחיקה');
    }
  }

  // ── Vouchers ───────────────────────────────────────────────────────────

  async function loadVouchers(branchId, date) {
    setVouchersLoading(true);
    try {
      const { data } = await api.get(`/screening/branches/${branchId}/vouchers?date=${date}`);
      setVouchers(data);
    } catch {
      setVouchers([]);
    } finally {
      setVouchersLoading(false);
    }
  }

  async function uploadVoucher(file) {
    setVoucherUploading(true);
    try {
      const fd = new FormData();
      fd.append('work_date', voucherDate);
      fd.append('voucher', file);
      const { data } = await api.post(`/screening/branches/${selectedBranch.id}/vouchers`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setVouchers(prev => [data, ...prev]);
    } catch (err) {
      const msg = err.response?.data?.error;
      alert(typeof msg === 'string' ? msg : 'שגיאה בהעלאת השובר');
    } finally {
      setVoucherUploading(false);
    }
  }

  async function downloadVouchers() {
    setVoucherDownloading(true);
    try {
      const res = await api.get(
        `/screening/branches/${selectedBranch.id}/vouchers/download?date=${voucherDate}`,
        { responseType: 'blob', timeout: 300000 }
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vouchers-${voucherDate}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      let msg;
      if (err.response?.data instanceof Blob) {
        try { msg = JSON.parse(await err.response.data.text())?.error; } catch {}
      } else {
        msg = err.response?.data?.error;
      }
      alert(typeof msg === 'string' ? msg : 'שגיאה בהורדת השוברים');
    } finally {
      setVoucherDownloading(false);
    }
  }

  async function deleteVoucher(id) {
    if (!confirm('למחוק שובר זה?')) return;
    try {
      await api.delete(`/screening/vouchers/${id}`);
      setVouchers(prev => prev.filter(v => v.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'שגיאה במחיקה');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <span className="material-symbols-outlined text-brand-purple animate-spin text-4xl">progress_activity</span>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-32 lg:pb-24 space-y-6" dir="rtl">

      {/* Header */}
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 font-headline">בדיקות סקר</h1>
          <p className="text-sm text-slate-400 font-medium mt-1">חברות וסניפי בדיקות</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setTestCatalogError(''); setCatalogNewName(''); setShowTestCatalog(true); }}
              className="flex items-center gap-2 text-brand-purple bg-purple-50 text-sm font-semibold px-4 py-2.5 rounded-full hover:bg-purple-100 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-base">checklist</span>
              ניהול בדיקות
            </button>
            <button
              onClick={openAddCompany}
              className="flex items-center gap-2 brand-gradient text-white text-sm font-semibold px-4 py-2.5 rounded-full brand-shadow active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-base">add</span>
              הוסף חברה
            </button>
          </div>
        )}
      </section>

      {/* Companies grid */}
      {companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-300">
          <span className="material-symbols-outlined text-6xl">business</span>
          <p className="text-sm font-medium text-slate-400">אין חברות עדיין</p>
          {isAdmin && (
            <button onClick={openAddCompany} className="text-sm font-semibold text-brand-purple mt-1">
              הוסף חברה ראשונה
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {companies.map(company => (
            <div
              key={company.id}
              onClick={() => openCompany(company)}
              className="relative bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col items-center gap-3 cursor-pointer hover:shadow-md hover:border-slate-200 transition-all active:scale-[0.97] select-none"
            >
              <CompanyAvatar company={company} size="lg" />
              <p className="text-sm font-bold text-slate-800 text-center leading-tight">{company.name}</p>

              {company.brochure_url && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (isPdf(company.brochure_url)) window.open(company.brochure_url, '_blank');
                    else setLightboxUrl(company.brochure_url);
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-brand-purple bg-purple-50 px-2.5 py-1 rounded-full hover:bg-purple-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">description</span>
                  חוברת
                </button>
              )}

              {isAdmin && (
                <div className="absolute top-2 left-2 flex gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => openEditCompany(company)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-brand-purple hover:bg-purple-50 transition-colors"
                    title="עריכה"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button
                    onClick={() => deleteCompany(company)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="מחיקה"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══ Branches sheet ══════════════════════════════════════════════ */}
      {selectedCompany && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={closeCompanySheet}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white rounded-3xl flex flex-col overflow-hidden"
            style={{ maxHeight: '82dvh' }}
            onClick={e => e.stopPropagation()}
          >

            {/* Sheet header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <CompanyAvatar company={selectedCompany} size="sm" />
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-slate-900 text-base truncate">{selectedCompany.name}</h2>
                <p className="text-xs text-slate-400">
                  {branchesLoading ? 'טוען...' : `${branches.length} סניפים`}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={openAddBranch}
                  className="flex items-center gap-1 text-xs font-bold text-brand-purple bg-purple-50 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  הוסף סניף
                </button>
              )}
              <button
                onClick={closeCompanySheet}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition-colors mr-1"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Branch list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {branchesLoading ? (
                <div className="flex justify-center py-12">
                  <span className="material-symbols-outlined text-brand-purple animate-spin text-3xl">progress_activity</span>
                </div>
              ) : branches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-300">
                  <span className="material-symbols-outlined text-4xl">location_off</span>
                  <p className="text-sm text-slate-400">אין סניפים עדיין</p>
                </div>
              ) : (
                branches.map(branch => (
                  <div
                    key={branch.id}
                    className="flex items-center gap-3 px-5 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => { setSelectedBranch(branch); setActiveTab('details'); setSmsPhone(''); setVouchers([]); setVoucherDate(new Date().toISOString().slice(0, 10)); }}
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-brand-purple text-base">location_on</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{branch.name}</p>
                      {branch.contacts?.[0]?.name && (
                        <p className="text-xs text-slate-400 truncate">{branch.contacts[0].name}</p>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openEditBranch(branch)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-brand-purple hover:bg-purple-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button
                          onClick={() => deleteBranch(branch)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    )}

                    <span className="material-symbols-outlined text-slate-200 text-base flex-shrink-0">chevron_left</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Branch detail sheet ════════════════════════════════════════ */}
      {selectedBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedBranch(null)} />
          <div
            className="relative w-full max-w-md bg-white rounded-3xl flex flex-col overflow-hidden"
            style={{ maxHeight: '88dvh' }}
            onClick={e => e.stopPropagation()}
          >

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <button
                onClick={() => setSelectedBranch(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-base">arrow_forward_ios</span>
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-slate-900 text-base truncate">{selectedBranch.name}</h2>
                <p className="text-xs text-slate-400">{selectedCompany?.name}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => { setSelectedBranch(null); openEditBranch(selectedBranch); }}
                  className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-brand-purple transition-colors"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100">
              {[
                { key: 'details', label: 'פרטים' },
                { key: 'brochures', label: 'חוברות' },
                ...(selectedCompany?.requires_vouchers ? [{ key: 'vouchers', label: 'שוברים' }] : []),
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-3 text-sm font-bold transition-colors relative ${
                    activeTab === tab.key ? 'text-brand-purple' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-4 right-4 h-0.5 brand-gradient rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">

              {activeTab === 'details' && (<>

                {/* Waze navigation */}
                {selectedBranch.address && (
                  <a
                    href={wazeLink(selectedBranch.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl font-bold text-white text-sm transition-opacity active:opacity-80"
                    style={{ backgroundColor: '#33CCFF' }}
                  >
                    <span className="material-symbols-outlined text-base">near_me</span>
                    נווט עם Waze
                  </a>
                )}

                {/* Parking */}
                {selectedBranch.has_parking != null && (
                  <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${selectedBranch.has_parking ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <span className={`material-symbols-outlined text-base ${selectedBranch.has_parking ? 'text-emerald-600' : 'text-red-500'}`} style={{ fontVariationSettings: "'FILL' 1" }}>local_parking</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">חניה</p>
                      <p className={`font-semibold text-sm ${selectedBranch.has_parking ? 'text-emerald-700' : 'text-red-600'}`}>
                        {selectedBranch.has_parking ? 'יש חניה' : 'אין חניה'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Contacts */}
                {selectedBranch.contacts?.map((contact, i) => (
                  <div key={i} className="space-y-3">
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                      {contact.name && (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-brand-purple text-base" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">איש קשר</p>
                            <p className="font-semibold text-slate-800 text-sm">{contact.name}</p>
                          </div>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-brand-purple text-base" style={{ fontVariationSettings: "'FILL' 1" }}>phone</span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">מספר טלפון</p>
                            <p className="font-semibold text-slate-800 text-sm" dir="ltr">{contact.phone}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {contact.phone && (
                      <a
                        href={whatsappLink(contact.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl font-bold text-white text-sm transition-opacity active:opacity-80"
                        style={{ backgroundColor: '#25D366' }}
                      >
                        <WhatsAppIcon />
                        {contact.name ? `WhatsApp — ${contact.name}` : 'שלח הודעה ב-WhatsApp'}
                      </a>
                    )}
                  </div>
                ))}

                {/* Performed tests */}
                {selectedBranch.performed_test_ids?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">בדיקות שמבצעים בסניף</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedBranch.performed_test_ids.map(id => {
                        const test = testCatalog.find(t => t.id === id);
                        return test ? (
                          <span
                            key={id}
                            className="bg-purple-50 text-brand-purple font-semibold text-xs px-3 py-1.5 rounded-full"
                          >
                            {test.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* Registration link widget */}
                {selectedBranch.registration_url && (
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">שלח קישור הרשמה</p>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        dir="ltr"
                        placeholder="050-0000000"
                        value={smsPhone}
                        onChange={e => setSmsPhone(e.target.value)}
                        className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                      />
                      <button
                        onClick={sendRegistrationSms}
                        disabled={!smsPhone.trim()}
                        className="flex items-center gap-1.5 px-4 py-2.5 brand-gradient text-white text-sm font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-transform"
                      >
                        <span className="material-symbols-outlined text-base">sms</span>
                        שלח
                      </button>
                    </div>
                  </div>
                )}

                {!selectedBranch.contacts?.length && selectedBranch.has_parking == null && !selectedBranch.registration_url && !selectedBranch.address && !selectedBranch.performed_test_ids?.length && (
                  <p className="text-sm text-slate-400 text-center py-4">אין פרטים נוספים לסניף זה</p>
                )}
              </>)}

              {activeTab === 'brochures' && (<>
                {selectedCompany?.brochure_url ? (
                  <div className="space-y-3">
                    {isPdf(selectedCompany.brochure_url) ? (
                      <div className="rounded-2xl overflow-hidden border border-slate-100">
                        <embed
                          src={selectedCompany.brochure_url}
                          type="application/pdf"
                          className="w-full"
                          style={{ height: '480px' }}
                        />
                        <a
                          href={selectedCompany.brochure_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 py-3 text-xs font-bold text-brand-purple hover:underline"
                        >
                          <span className="material-symbols-outlined text-base">open_in_new</span>
                          פתח בחלון נפרד
                        </a>
                      </div>
                    ) : (
                      <button
                        onClick={() => setLightboxUrl(selectedCompany.brochure_url)}
                        className="w-full rounded-2xl overflow-hidden border border-slate-100 hover:border-brand-purple/40 transition-colors active:scale-[0.98]"
                      >
                        <img
                          src={selectedCompany.brochure_url}
                          alt="חוברת"
                          className="w-full object-contain max-h-64"
                        />
                        <div className="flex items-center justify-center gap-1.5 py-3 text-xs font-bold text-brand-purple">
                          <span className="material-symbols-outlined text-base">open_in_full</span>
                          לחץ לצפייה מלאה
                        </div>
                      </button>
                    )}
                    {isAdmin && (
                      <label className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-sm font-semibold text-slate-400 hover:border-brand-purple/40 hover:text-brand-purple cursor-pointer transition-colors">
                        {brochureUploading
                          ? <><span className="material-symbols-outlined text-base animate-spin">progress_activity</span> מעלה...</>
                          : <><span className="material-symbols-outlined text-base">upload</span> החלף חוברת</>
                        }
                        <input type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadCompanyBrochure(f); }} disabled={brochureUploading} />
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-300">
                    <span className="material-symbols-outlined text-5xl">description</span>
                    <p className="text-sm text-slate-400">אין חוברת לחברה זו</p>
                    {isAdmin && (
                      <label className="flex items-center gap-2 mt-1 px-5 py-2.5 brand-gradient text-white text-sm font-bold rounded-full cursor-pointer active:scale-95 transition-transform">
                        {brochureUploading
                          ? <><span className="material-symbols-outlined text-base animate-spin">progress_activity</span> מעלה...</>
                          : <><span className="material-symbols-outlined text-base">upload</span> העלה חוברת</>
                        }
                        <input type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadCompanyBrochure(f); }} disabled={brochureUploading} />
                      </label>
                    )}
                  </div>
                )}
              </>)}

              {activeTab === 'vouchers' && (<>
                {/* Date navigation */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const [y, m, d] = voucherDate.split('-').map(Number);
                      const next = localDateStr(new Date(y, m - 1, d - 1));
                      setVoucherDate(next);
                      loadVouchers(selectedBranch.id, next);
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-slate-500 text-base">chevron_right</span>
                  </button>
                  <input
                    type="date"
                    value={voucherDate}
                    onChange={e => { setVoucherDate(e.target.value); loadVouchers(selectedBranch.id, e.target.value); }}
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                  />
                  <button
                    onClick={() => {
                      const [y, m, d] = voucherDate.split('-').map(Number);
                      const next = localDateStr(new Date(y, m - 1, d + 1));
                      setVoucherDate(next);
                      loadVouchers(selectedBranch.id, next);
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-slate-500 text-base">chevron_left</span>
                  </button>
                </div>

                {/* Admin download button */}
                {isAdmin && vouchers.length > 0 && (
                  <button
                    onClick={downloadVouchers}
                    disabled={voucherDownloading}
                    className="flex items-center justify-center gap-2 w-full py-2.5 border-2 border-brand-purple/30 text-brand-purple text-sm font-bold rounded-2xl hover:bg-purple-50 disabled:opacity-50 transition-colors"
                  >
                    {voucherDownloading
                      ? <><span className="material-symbols-outlined text-base animate-spin">progress_activity</span> מכין ZIP + OCR...</>
                      : <><span className="material-symbols-outlined text-base">download</span> הורד הכל ({vouchers.length})</>
                    }
                  </button>
                )}

                {/* Voucher list */}
                {vouchersLoading ? (
                  <div className="flex justify-center py-8">
                    <span className="material-symbols-outlined text-brand-purple animate-spin text-3xl">progress_activity</span>
                  </div>
                ) : vouchers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-300">
                    <span className="material-symbols-outlined text-5xl">receipt_long</span>
                    <p className="text-sm text-slate-400">אין שוברים לתאריך זה</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {vouchers.map(v => (
                      <div key={v.id} className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-brand-purple text-base">
                            {v.file_name?.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf' : 'image'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {v.user_label && (
                            <p className="text-[10px] font-bold text-brand-purple truncate">{v.user_label}</p>
                          )}
                          <p className="text-sm font-semibold text-slate-800 truncate">{v.file_name}</p>
                          <p className="text-xs text-slate-400">{new Date(v.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <a
                          href={v.signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-brand-purple hover:bg-purple-50 transition-colors flex-shrink-0"
                        >
                          <span className="material-symbols-outlined text-base">open_in_new</span>
                        </a>
                        <button
                          onClick={() => deleteVoucher(v.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button */}
                <label className="flex items-center justify-center gap-2 w-full py-3 brand-gradient text-white text-sm font-bold rounded-2xl cursor-pointer active:scale-95 transition-transform">
                  {voucherUploading
                    ? <><span className="material-symbols-outlined text-base animate-spin">progress_activity</span> מעלה...</>
                    : <><span className="material-symbols-outlined text-base">upload</span> העלה שובר</>
                  }
                  <input
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadVoucher(f); e.target.value = ''; }}
                    disabled={voucherUploading}
                  />
                </label>
              </>)}

            </div>
          </div>
        </div>
      )}

      {/* ══ Brochure lightbox ═════════════════════════════════════════ */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
          <img
            src={lightboxUrl}
            alt="חוברת"
            className="max-w-full max-h-full object-contain rounded-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* ══ Company form modal ════════════════════════════════════════ */}
      {showCompanyForm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCompanyForm(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">
                {editingCompany ? 'עריכת חברה' : 'הוספת חברה'}
              </h3>
              <button onClick={() => setShowCompanyForm(false)} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">שם החברה *</label>
                <input
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 text-right"
                  placeholder="לדוג׳: מזרחי טפחות"
                  value={companyForm.name}
                  onChange={e => setCompanyForm(p => ({ ...p, name: e.target.value }))}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && submitCompany()}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">לוגו החברה</label>
                <label className={`flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${companyLogoPreview ? 'border-brand-purple/40 bg-purple-50' : 'border-slate-200 hover:border-brand-purple/30 hover:bg-purple-50/40'}`}>
                  {companyLogoPreview ? (
                    <img src={companyLogoPreview} alt="preview" className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-100" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-slate-400 text-2xl">add_photo_alternate</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-semibold text-slate-700">
                      {companyLogoFile ? companyLogoFile.name : companyLogoPreview ? 'לחץ להחלפת תמונה' : 'העלה תמונה'}
                    </p>
                    <p className="text-xs text-slate-400">PNG, JPG, WEBP עד 5MB</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">חוברת החברה</label>
                <label className={`flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${companyBrochurePreview ? 'border-brand-purple/40 bg-purple-50' : 'border-slate-200 hover:border-brand-purple/30 hover:bg-purple-50/40'}`}>
                  {companyBrochurePreview && !isPdf(companyBrochurePreview) ? (
                    <img src={companyBrochurePreview} alt="preview" className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-100" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-slate-400 text-2xl">
                        {companyBrochurePreview ? 'picture_as_pdf' : 'description'}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-semibold text-slate-700">
                      {companyBrochureFile ? companyBrochureFile.name : companyBrochurePreview ? 'לחץ להחלפת חוברת' : 'העלה חוברת'}
                    </p>
                    <p className="text-xs text-slate-400">PNG, JPG, PDF עד 10MB</p>
                  </div>
                  <input type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={handleBrochureChange} />
                </label>
              </div>

              <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer select-none">
                <div
                  className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${companyForm.requires_vouchers ? 'bg-brand-purple' : 'bg-slate-200'}`}
                  onClick={() => setCompanyForm(p => ({ ...p, requires_vouchers: !p.requires_vouchers }))}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${companyForm.requires_vouchers ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">העלאת שוברים</p>
                  <p className="text-xs text-slate-400">עובדים מעלים שובר לכל מטופל</p>
                </div>
              </label>
            </div>

            {companyFormError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{companyFormError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowCompanyForm(false)}
                className="flex-1 text-sm font-semibold text-slate-600 bg-slate-100 py-3 rounded-full hover:bg-slate-200 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={submitCompany}
                disabled={companySubmitting}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-white brand-gradient py-3 rounded-full brand-shadow disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">{companySubmitting ? 'hourglass_top' : 'save'}</span>
                {companySubmitting ? 'שומר...' : 'שמור'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Branch form modal ═════════════════════════════════════════ */}
      {showBranchForm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowBranchForm(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">
                {editingBranch ? 'עריכת סניף' : 'הוספת סניף'}
              </h3>
              <button onClick={() => setShowBranchForm(false)} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">שם הסניף *</label>
                <input
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 text-right"
                  placeholder="לדוג׳: סניף תל אביב"
                  value={branchForm.name}
                  onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))}
                  autoFocus
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">אנשי קשר</label>
                  <button
                    type="button"
                    onClick={addContact}
                    className="flex items-center gap-1 text-xs font-bold text-brand-purple bg-purple-50 px-2.5 py-1 rounded-full hover:bg-purple-100 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    הוסף
                  </button>
                </div>
                {branchForm.contacts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">אין אנשי קשר</p>
                ) : (
                  <div className="space-y-2">
                    {branchForm.contacts.map((contact, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-1.5">
                          <input
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 text-right"
                            placeholder="שם מלא"
                            value={contact.name}
                            onChange={e => updateContact(i, 'name', e.target.value)}
                          />
                          <input
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                            placeholder="050-0000000"
                            dir="ltr"
                            type="tel"
                            value={contact.phone}
                            onChange={e => updateContact(i, 'phone', e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeContact(i)}
                          className="mt-1 w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Performed tests */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">בדיקות שמבצעים בסניף</p>
                {testCatalog.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">לא הוגדרו בדיקות במאגר</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {testCatalog.map(test => {
                      const selected = branchForm.performed_test_ids.includes(test.id);
                      return (
                        <button
                          key={test.id}
                          type="button"
                          onClick={() => togglePerformedTest(test.id)}
                          className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                            selected
                              ? 'bg-brand-purple border-brand-purple text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-brand-purple/40'
                          }`}
                        >
                          {selected && <span className="material-symbols-outlined text-xs">check</span>}
                          {test.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2 items-center mt-3">
                  <input
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 text-right"
                    placeholder="בדיקה חדשה שלא ברשימה"
                    maxLength={200}
                    value={newTestName}
                    onChange={e => setNewTestName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTestFromBranchForm(); } }}
                  />
                  <button
                    type="button"
                    onClick={addTestFromBranchForm}
                    disabled={!newTestName.trim()}
                    className="flex items-center gap-1 text-xs font-bold text-brand-purple bg-purple-50 px-2.5 py-2 rounded-full hover:bg-purple-100 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    הוסף
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">קישור הרשמה</label>
                <input
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                  placeholder="https://..."
                  dir="ltr"
                  value={branchForm.registration_url}
                  onChange={e => setBranchForm(p => ({ ...p, registration_url: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">כתובת</label>
                <input
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                  placeholder="רחוב, עיר"
                  value={branchForm.address}
                  onChange={e => setBranchForm(p => ({ ...p, address: e.target.value }))}
                />
              </div>

              {/* Parking */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">חניה</p>
                <div className="flex gap-2">
                  {[{ value: true, label: 'יש חניה' }, { value: false, label: 'אין חניה' }].map(opt => {
                    const selected = branchForm.has_parking === opt.value;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setBranchForm(p => ({ ...p, has_parking: selected ? null : opt.value }))}
                        className={`flex-1 flex items-center justify-center gap-1 text-sm font-semibold py-2.5 rounded-full border transition-colors ${
                          selected
                            ? 'bg-brand-purple border-brand-purple text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-brand-purple/40'
                        }`}
                      >
                        {selected && <span className="material-symbols-outlined text-sm">check</span>}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {branchFormError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{branchFormError}</p>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowBranchForm(false)}
                className="flex-1 text-sm font-semibold text-slate-600 bg-slate-100 py-3 rounded-full hover:bg-slate-200 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={submitBranch}
                disabled={branchSubmitting}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-white brand-gradient py-3 rounded-full brand-shadow disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">{branchSubmitting ? 'hourglass_top' : 'save'}</span>
                {branchSubmitting ? 'שומר...' : 'שמור'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Performed-tests catalog modal ═════════════════════════════ */}
      {showTestCatalog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowTestCatalog(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">ניהול מאגר בדיקות</h3>
              <button onClick={() => setShowTestCatalog(false)} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="flex gap-2 items-center">
                <input
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 text-right"
                  placeholder="שם בדיקה חדשה"
                  maxLength={200}
                  value={catalogNewName}
                  onChange={e => setCatalogNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTestFromCatalogModal(); }}
                />
                <button
                  type="button"
                  onClick={addTestFromCatalogModal}
                  disabled={!catalogNewName.trim()}
                  className="flex items-center gap-1 text-xs font-bold text-brand-purple bg-purple-50 px-2.5 py-2 rounded-full hover:bg-purple-100 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  הוסף
                </button>
              </div>

              {testCatalogError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{testCatalogError}</p>
              )}

              {testCatalog.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">לא הוגדרו בדיקות במאגר</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">לחיצה על שם מאפשרת לערוך אותו. השינוי יחול בכל הסניפים.</p>
                  {testCatalog.map(test => (
                    <TestCatalogRow
                      key={test.id}
                      test={test}
                      onRename={renameCatalogTest}
                      onDelete={deleteCatalogTest}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
