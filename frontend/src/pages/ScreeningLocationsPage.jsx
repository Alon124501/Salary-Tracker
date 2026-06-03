import { useState, useEffect, useCallback } from 'react';
import api from '../api.js';

const TEST_TYPES = ['early_detection', 'cardio', 'fit_wellness'];
const TEST_LABELS = {
  early_detection: 'גילוי מוקדם',
  cardio: 'קרדיו',
  fit_wellness: 'Fit & Wellness',
};
const TEST_COLORS = {
  early_detection: 'bg-emerald-50 text-emerald-700',
  cardio: 'bg-red-50 text-red-600',
  fit_wellness: 'bg-sky-50 text-sky-600',
};

const EMPTY_COMPANY_FORM = { name: '' };
const EMPTY_BRANCH_FORM = {
  name: '', contacts: [],
  requires_echo_bed: false, test_types: [], registration_url: '',
};

function whatsappLink(phone) {
  if (!phone) return '#';
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? '972' + digits.slice(1) : digits;
  return `https://wa.me/${normalized}`;
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

export default function ScreeningLocationsPage() {
  const [companies, setCompanies] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

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
  }, []);

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
    setCompanyForm({ name: company.name });
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
      setCompanyFormError(err.response?.data?.error || 'שגיאה בשמירה');
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
      requires_echo_bed: !!branch.requires_echo_bed,
      test_types: branch.test_types || [],
      registration_url: branch.registration_url || '',
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

  function toggleTestType(type) {
    setBranchForm(prev => ({
      ...prev,
      test_types: prev.test_types.includes(type)
        ? prev.test_types.filter(t => t !== type)
        : [...prev.test_types, type],
    }));
  }

  async function submitBranch() {
    if (!branchForm.name.trim()) { setBranchFormError('שם הסניף הוא שדה חובה'); return; }
    setBranchSubmitting(true);
    setBranchFormError('');
    try {
      const fd = new FormData();
      fd.append('name', branchForm.name.trim());
      fd.append('contacts', JSON.stringify(branchForm.contacts.filter(c => c.name.trim() || c.phone.trim())));
      fd.append('requires_echo_bed', branchForm.requires_echo_bed ? 'true' : 'false');
      fd.append('test_types', JSON.stringify(branchForm.test_types));
      fd.append('registration_url', branchForm.registration_url.trim());

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
      setBranchFormError(err.response?.data?.error || 'שגיאה בשמירה');
    } finally {
      setBranchSubmitting(false);
    }
  }

  async function uploadCompanyBrochure(file) {
    setBrochureUploading(true);
    try {
      const fd = new FormData();
      fd.append('name', selectedCompany.name);
      fd.append('brochure', file);
      const { data } = await api.put(`/screening/companies/${selectedCompany.id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSelectedCompany(data);
      setCompanies(prev => prev.map(c => c.id === data.id ? data : c));
    } catch {
      alert('שגיאה בהעלאת החוברת');
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
          <button
            onClick={openAddCompany}
            className="flex items-center gap-2 brand-gradient text-white text-sm font-semibold px-4 py-2.5 rounded-full brand-shadow active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">add</span>
            הוסף חברה
          </button>
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
                    onClick={() => { setSelectedBranch(branch); setActiveTab('details'); setSmsPhone(''); }}
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
              {[{ key: 'details', label: 'פרטים' }, { key: 'brochures', label: 'חוברות' }].map(tab => (
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

                {/* Echo bed badge */}
                <div
                  className={`flex items-center gap-3 p-4 rounded-2xl ${
                    selectedBranch.requires_echo_bed
                      ? 'bg-red-50 border border-red-100'
                      : 'bg-emerald-50 border border-emerald-100'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-xl ${selectedBranch.requires_echo_bed ? 'text-red-500' : 'text-emerald-500'}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {selectedBranch.requires_echo_bed ? 'bed' : 'check_circle'}
                  </span>
                  <p className={`font-bold text-sm ${selectedBranch.requires_echo_bed ? 'text-red-700' : 'text-emerald-700'}`}>
                    {selectedBranch.requires_echo_bed ? 'נדרשת מיטת אקו לב' : 'אין צורך במיטת אקו לב'}
                  </p>
                </div>

                {/* Test types */}
                {selectedBranch.test_types?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">בדיקות סקר רלוונטיות</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedBranch.test_types.map(type => (
                        <span
                          key={type}
                          className={`${TEST_COLORS[type] || 'bg-purple-50 text-brand-purple'} font-semibold text-xs px-3 py-1.5 rounded-full`}
                        >
                          {TEST_LABELS[type] || type}
                        </span>
                      ))}
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

                {!selectedBranch.contacts?.length && !selectedBranch.test_types?.length && !selectedBranch.registration_url && (
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

              {/* Echo bed toggle */}
              <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer select-none">
                <div
                  className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${branchForm.requires_echo_bed ? 'bg-brand-purple' : 'bg-slate-200'}`}
                  onClick={() => setBranchForm(p => ({ ...p, requires_echo_bed: !p.requires_echo_bed }))}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${branchForm.requires_echo_bed ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">מיטת אקו לב</p>
                  <p className="text-xs text-slate-400">נדרשת מיטה לבדיקה</p>
                </div>
              </label>

              {/* Test types */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">סוגי בדיקות</p>
                <div className="space-y-2">
                  {TEST_TYPES.map(type => (
                    <label key={type} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer select-none hover:bg-slate-100 transition-colors">
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          branchForm.test_types.includes(type)
                            ? 'bg-brand-purple border-brand-purple'
                            : 'border-slate-300 bg-white'
                        }`}
                        onClick={() => toggleTestType(type)}
                      >
                        {branchForm.test_types.includes(type) && (
                          <span className="material-symbols-outlined text-white text-xs">check</span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{TEST_LABELS[type]}</span>
                    </label>
                  ))}
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
    </main>
  );
}
