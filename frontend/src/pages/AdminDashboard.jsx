import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import api from '../api.js';
import { useFetch } from '../hooks/useFetch.js';
import { useToast } from '../context/ToastContext.jsx';

function activityColor(shiftsPerWeek) {
  const n = parseInt(shiftsPerWeek, 10);
  if (!n || n <= 2) return 'bg-red-100 text-red-700';
  if (n <= 4)       return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
}

const TABS = [
  { id: 'directory',    label: 'Directory',    icon: 'people' },
  { id: 'equipment',    label: 'Equipment',    icon: 'medical_services' },
  { id: 'reports',       label: 'Reports',       icon: 'assignment' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
  { id: 'faq',           label: 'Portal',        icon: 'hub' },
  { id: 'eq_orders',     label: 'Orders',        icon: 'inventory' },
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
  const showToast = useToast();
  const [activeTab, setActiveTab] = useState('directory');

  const { data: users = [], setData: setUsers, loading, error, reload: loadUsers } =
    useFetch('/admin/users');

  // Portal tab state
  const [portalSubTab, setPortalSubTab] = useState('faq');
  // FAQ sub-tab
  const { data: faqItems = { insurance: [], screening: [] }, setData: setFaqItems,
          loading: faqLoading, reload: loadFaq } =
    useFetch('/faq', { enabled: activeTab === 'faq' });
  const [faqCategory, setFaqCategory] = useState('insurance');
  const [addingFaq, setAddingFaq] = useState(false);
  const [newFaqQ, setNewFaqQ] = useState('');
  const [newFaqA, setNewFaqA] = useState('');
  const [editingFaqId, setEditingFaqId] = useState(null);
  const [editFaqQ, setEditFaqQ] = useState('');
  const [editFaqA, setEditFaqA] = useState('');
  const [faqSaving, setFaqSaving] = useState(false);
  // Apps sub-tab
  const { data: appCreds = [], setData: setAppCreds, loading: appCredsLoading, reload: loadAppCreds } =
    useFetch('/portal/credentials', { enabled: activeTab === 'faq' });
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

  // Contacts sub-tab
  const { data: contacts = [], setData: setContacts, loading: contactsLoading, reload: loadContacts } =
    useFetch('/contacts', { enabled: activeTab === 'faq' });
  const [addingContact, setAddingContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', title: '', phone: '' });
  const [editingContactId, setEditingContactId] = useState(null);
  const [editContact, setEditContact] = useState({ name: '', title: '', phone: '' });
  const [contactSaving, setContactSaving] = useState(false);

  // Videos sub-tab
  const { data: tutorialVideos = [], setData: setTutorialVideos, loading: tutorialsLoading } =
    useFetch('/tutorials', { enabled: activeTab === 'faq' });
  const [addingVideo, setAddingVideo] = useState(false);
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoDeviceId, setNewVideoDeviceId] = useState('');
  const [newVideoDeviceOther, setNewVideoDeviceOther] = useState('');
  const [newVideoDesc, setNewVideoDesc] = useState('');
  const [newVideoSourceType, setNewVideoSourceType] = useState('upload');
  const [newVideoFile, setNewVideoFile] = useState(null);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [videoSaving, setVideoSaving] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState(null);
  const [editVideoTitle, setEditVideoTitle] = useState('');
  const [editVideoDeviceId, setEditVideoDeviceId] = useState('');
  const [editVideoDeviceOther, setEditVideoDeviceOther] = useState('');
  const [editVideoDesc, setEditVideoDesc] = useState('');

  // Reports state
  const [reportMonth, setReportMonth] = useState(nowMonth);
  const [reportSummary, setReportSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [approveMsgs, setApproveMsgs] = useState({});

  // Notifications tab state
  const { data: notifList = [], setData: setNotifList, loading: notifLoading, reload: loadNotifications } =
    useFetch('/notifications/admin/all', { enabled: activeTab === 'notifications' });
  const [notifForm, setNotifForm] = useState({
    title: '',
    content: '',
    requires_approval: false,
    sendMode: 'now',         // 'now' | 'schedule'
    scheduled_for: '',        // datetime-local string
    isRecurring: false,
    recurrence_days: [],      // int[] e.g. [0, 2]
    recurrence_time: '12:00', // "HH:MM" Israel time
    documentMode: 'none',    // 'none' | 'upload' | 'link'
    documentFile: null,       // File object
    documentExternalUrl: '',
    force_view_document: false,
  });
  const docFileInputRef = useRef(null);
  const [notifSubmitting, setNotifSubmitting] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [complianceModal, setComplianceModal] = useState(null);

  // Equipment Orders tab state
  const { data: eqCatalog = [], setData: setEqCatalog, loading: eqCatalogLoading, reload: loadEqCatalog } =
    useFetch('/equipment/catalog', { enabled: activeTab === 'eq_orders' });
  const { data: eqOrders = [], setData: setEqOrders, loading: eqOrdersLoading, reload: loadEqOrders } =
    useFetch('/equipment/orders');
  const pendingOrdersCount = eqOrders.filter(o => o.status === 'pending').length;
  const [newItemName, setNewItemName] = useState('');
  const [eqSubTab, setEqSubTab] = useState('catalog');
  const [eqOrderModal, setEqOrderModal] = useState(null);
  const [completingOrderId, setCompletingOrderId] = useState(null);

  // Device recap ("Equipment" directory tab) state
  const { data: deviceCatalog = [], loading: deviceCatalogLoading, reload: loadDeviceCatalog } =
    useFetch('/devices/catalog', { enabled: activeTab === 'equipment' || activeTab === 'faq' });
  const [devSubTab, setDevSubTab] = useState('grid');
  const [newDeviceName, setNewDeviceName] = useState('');

  // Directory drawer state
  const [selectedUser, setSelectedUser] = useState(null);
  const [drawerEdits, setDrawerEdits] = useState({});
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);
  useEffect(() => {
    api.get('/auth/me').then(r => setCurrentUserId(r.data.id)).catch(() => {});
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
      loadReportSummary(reportMonth);
      setApproveMsgs({});
    }
  }, [activeTab, reportMonth, loadReportSummary]);


  // ── Equipment Orders actions ───────────────────────────────────────────
  async function addCatalogItem() {
    if (!newItemName.trim()) return;
    try {
      await api.post('/equipment/catalog', { name: newItemName.trim() });
      setNewItemName('');
      loadEqCatalog();
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to add item'); }
  }

  async function deleteCatalogItem(id) {
    try {
      await api.delete(`/equipment/catalog/${id}`);
      loadEqCatalog();
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to delete item'); }
  }

  // ── Device catalog actions ──────────────────────────────────────────────
  async function addDeviceCatalogItem() {
    if (!newDeviceName.trim()) return;
    try {
      await api.post('/devices/catalog', { name: newDeviceName.trim() });
      setNewDeviceName('');
      loadDeviceCatalog();
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to add device'); }
  }

  async function deleteDeviceCatalogItem(id) {
    try {
      await api.delete(`/devices/catalog/${id}`);
      loadDeviceCatalog();
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to delete device'); }
  }

  async function deleteEmployee(user) {
    setDeletingUser(true);
    try {
      await api.delete(`/admin/users/${user.id}`);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setSelectedUser(null);
      setDeleteConfirmUser(null);
      showToast(`${user.first_name || ''} ${user.last_name || ''}`.trim() + ' has been deleted', 'success');
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to delete employee');
    } finally {
      setDeletingUser(false);
    }
  }

  async function completeOrder(id) {
    setCompletingOrderId(id);
    try {
      await api.delete(`/equipment/orders/${id}`);
      setEqOrders(prev => prev.filter(o => o.id !== id));
      setEqOrderModal(null);
      showToast('Order marked as complete', 'success');
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to complete order'); }
    finally { setCompletingOrderId(null); }
  }

  // ── Device toggle ───────────────────────────────────────────────────────
  async function toggleDevice(userId, device, hasIt) {
    try {
      if (hasIt) {
        await api.delete(`/admin/users/${userId}/devices/${device.id}`);
      } else {
        await api.post(`/admin/users/${userId}/devices`, { device_id: device.id });
      }
      setUsers(prev => prev.map(u => {
        if (u.id !== userId) return u;
        const devices = hasIt ? u.devices.filter(d => d.id !== device.id) : [...u.devices, device];
        return { ...u, devices };
      }));
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to update device'); }
  }

  // ── Echo certified toggle ──────────────────────────────────────────────
  async function toggleEcho(userId, current) {
    try {
      await api.patch(`/admin/users/${userId}`, { echo_certified: !current });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, echo_certified: !current } : u));
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to update echo certification'); }
  }

  // ── Notifications ─────────────────────────────────────────────────────
  async function submitNotification() {
    const { title, content, requires_approval, sendMode, scheduled_for,
            isRecurring, recurrence_days, recurrence_time,
            documentMode, documentFile, documentExternalUrl, force_view_document } = notifForm;

    if (!title.trim() || !content.trim()) return;
    if (isRecurring && !recurrence_days.length) return;
    if (sendMode === 'schedule' && !isRecurring && !scheduled_for) return;

    setNotifSubmitting(true);
    setNotifError('');
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('content', content.trim());
      fd.append('requires_approval', String(requires_approval));
      fd.append('type', isRecurring ? 'recurring' : 'manual');
      fd.append('force_view_document', String(force_view_document));

      if (isRecurring) {
        fd.append('recurrence_days', JSON.stringify(recurrence_days));
        fd.append('recurrence_time', recurrence_time);
      } else if (sendMode === 'schedule' && scheduled_for) {
        fd.append('scheduled_for', new Date(scheduled_for).toISOString());
      }

      if (documentMode === 'upload' && documentFile) {
        fd.append('document', documentFile);
      } else if (documentMode === 'link' && documentExternalUrl.trim()) {
        fd.append('document_external_url', documentExternalUrl.trim());
      }

      await api.post('/notifications', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setNotifForm({
        title: '', content: '', requires_approval: false,
        sendMode: 'now', scheduled_for: '', isRecurring: false,
        recurrence_days: [], recurrence_time: '12:00',
        documentMode: 'none', documentFile: null, documentExternalUrl: '', force_view_document: false,
      });
      if (docFileInputRef.current) docFileInputRef.current.value = '';
      loadNotifications();
    } catch (err) {
      setNotifError(err?.response?.data?.error || 'Failed to send notification. Please try again.');
    }
    finally { setNotifSubmitting(false); }
  }

  async function deactivateNotification(id) {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifList(prev => prev.map(n => n.id === id ? { ...n, is_active: false } : n));
    } catch { /* silent */ }
  }

  async function openCompliance(notifId) {
    setComplianceModal({ loading: true });
    try {
      const { data } = await api.get(`/notifications/admin/${notifId}/compliance`);
      setComplianceModal(data);
    } catch {
      setComplianceModal(null);
    }
  }

  // ── Download Excel for a single user ──────────────────────────────────
  async function downloadReport(userId, userName) {
    setDownloadingId(userId);
    try {
      const res = await api.get(`/admin/users/${userId}/report/excel?month=${reportMonth}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const [yr, mo] = reportMonth.split('-').map(Number);
      const monthLabel = new Date(yr, mo - 1).toLocaleString('en-US', { month: 'long' });
      const a = document.createElement('a');
      a.href = url;
      a.download = `${userName} - ${monthLabel} ${yr}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to download report'); }
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
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to save question'); }
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
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to update question'); }
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
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to save app'); }
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
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to update app'); }
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

  // ── Tutorial videos management ──────────────────────────────────────────
  async function saveVideo() {
    if (!newVideoTitle.trim()) return;
    if (newVideoSourceType === 'upload' && !newVideoFile) return;
    if (newVideoSourceType === 'link' && !newVideoUrl.trim()) return;
    setVideoSaving(true);
    try {
      let storage_path = null;
      if (newVideoSourceType === 'upload') {
        const { data: signed } = await api.post('/tutorials/upload-url', { filename: newVideoFile.name });
        await axios.put(signed.uploadUrl, newVideoFile, {
          headers: { 'Content-Type': newVideoFile.type || 'application/octet-stream' },
        });
        storage_path = signed.storagePath;
      }
      const isOther = newVideoDeviceId === '__other__';
      const { data } = await api.post('/tutorials', {
        title: newVideoTitle.trim(),
        device_id: (!isOther && newVideoDeviceId) ? newVideoDeviceId : null,
        device_name_other: isOther ? (newVideoDeviceOther.trim() || null) : null,
        description: newVideoDesc.trim() || null,
        source_type: newVideoSourceType,
        storage_path,
        external_url: newVideoSourceType === 'link' ? newVideoUrl.trim() : null,
        sort_order: tutorialVideos.length,
      });
      setTutorialVideos(prev => [...prev, data]);
      setNewVideoTitle(''); setNewVideoDeviceId(''); setNewVideoDeviceOther('');
      setNewVideoDesc(''); setNewVideoFile(null); setNewVideoUrl(''); setAddingVideo(false);
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to save video'); }
    finally { setVideoSaving(false); }
  }

  async function updateVideo(id) {
    if (!editVideoTitle.trim()) return;
    setVideoSaving(true);
    try {
      const isOther = editVideoDeviceId === '__other__';
      const { data } = await api.patch(`/tutorials/${id}`, {
        title: editVideoTitle.trim(),
        device_id: (!isOther && editVideoDeviceId) ? editVideoDeviceId : null,
        device_name_other: isOther ? (editVideoDeviceOther.trim() || null) : null,
        description: editVideoDesc.trim() || null,
      });
      setTutorialVideos(prev => prev.map(x => x.id === id ? data : x));
      setEditingVideoId(null);
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to update video'); }
    finally { setVideoSaving(false); }
  }

  async function deleteVideo(id) {
    const backup = tutorialVideos;
    setTutorialVideos(prev => prev.filter(x => x.id !== id));
    try { await api.delete(`/tutorials/${id}`); }
    catch { setTutorialVideos(backup); }
  }

  async function moveVideo(id, direction) {
    const idx = tutorialVideos.findIndex(x => x.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === tutorialVideos.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newItems = [...tutorialVideos];
    [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]];
    const reordered = newItems.map((item, i) => ({ ...item, sort_order: i }));
    setTutorialVideos(reordered);
    try {
      await api.post('/tutorials/reorder', {
        items: reordered.map(({ id: xid, sort_order }) => ({ id: xid, sort_order })),
      });
    } catch { setTutorialVideos(tutorialVideos); }
  }

  // ── Contacts ──────────────────────────────────────────────────────────
  async function moveContact(id, direction) {
    const idx = contacts.findIndex(x => x.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === contacts.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newItems = [...contacts];
    [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]];
    const reordered = newItems.map((item, i) => ({ ...item, sort_order: i }));
    setContacts(reordered);
    try {
      await api.post('/contacts/reorder', {
        items: reordered.map(({ id: xid, sort_order }) => ({ id: xid, sort_order })),
      });
    } catch { setContacts(contacts); }
  }

  async function saveContact() {
    if (!newContact.name.trim() || !newContact.phone.trim()) return;
    setContactSaving(true);
    try {
      const { data } = await api.post('/contacts', {
        name: newContact.name.trim(),
        title: newContact.title.trim() || null,
        phone: newContact.phone.trim(),
        sort_order: contacts.length,
      });
      setContacts(prev => [...prev, data]);
      setNewContact({ name: '', title: '', phone: '' });
      setAddingContact(false);
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to save contact'); }
    finally { setContactSaving(false); }
  }

  async function updateContact(id) {
    if (!editContact.name.trim() || !editContact.phone.trim()) return;
    setContactSaving(true);
    try {
      const { data } = await api.patch(`/contacts/${id}`, {
        name: editContact.name.trim(),
        title: editContact.title.trim() || null,
        phone: editContact.phone.trim(),
      });
      setContacts(prev => prev.map(x => x.id === id ? data : x));
      setEditingContactId(null);
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to update contact'); }
    finally { setContactSaving(false); }
  }

  async function deleteContact(id) {
    const backup = contacts;
    setContacts(prev => prev.filter(x => x.id !== id));
    try { await api.delete(`/contacts/${id}`); }
    catch { setContacts(backup); }
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
      const raw = err.response?.data?.error;
      const text = status === 409
        ? 'Already approved and sent.'
        : (typeof raw === 'string' ? raw : 'Failed to approve.');
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
      is_admin: user.is_admin ?? false,
    });
  }

  async function saveDrawer() {
    if (!selectedUser) return;
    setDrawerSaving(true);
    try {
      const updates = { ...drawerEdits };
      if (updates.uniform_sets !== '') updates.uniform_sets = parseInt(updates.uniform_sets, 10);
      await api.patch(`/admin/users/${selectedUser.id}`, updates);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...updates } : u));
      setSelectedUser(null);
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to save changes'); }
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
                {tab.id === 'eq_orders' && pendingOrdersCount > 0 && (
                  <span className="bg-blue-500 text-white text-[10px] font-bold min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center leading-none">
                    {pendingOrdersCount}
                  </span>
                )}
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
        <div className="px-4 space-y-4">
          {/* Sub-tab toggle */}
          <div className="flex gap-2">
            {[{ id: 'grid', label: 'Grid', icon: 'grid_view' }, { id: 'catalog', label: 'Catalog', icon: 'list' }].map(st => (
              <button
                key={st.id}
                onClick={() => setDevSubTab(st.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                  devSubTab === st.id ? 'brand-gradient text-white' : 'bg-white border border-slate-200 text-slate-500'
                }`}
                style={devSubTab === st.id ? { boxShadow: '0 4px 14px rgba(139,53,217,0.25)' } : {}}
              >
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: devSubTab === st.id ? "'FILL' 1" : "'FILL' 0" }}>{st.icon}</span>
                {st.label}
              </button>
            ))}
          </div>

          {/* Grid sub-tab */}
          {devSubTab === 'grid' && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                    <th className="sticky left-0 z-10 bg-slate-50 text-left px-3 py-2.5 min-w-[140px]">Employee</th>
                    {deviceCatalog.map(d => (
                      <th key={d.id} className="text-center px-3 py-2.5 min-w-[80px]">{d.name}</th>
                    ))}
                    <th className="text-center px-3 py-2.5 min-w-[90px]">Echo Cert.</th>
                    <th className="text-center px-3 py-2.5 min-w-[110px]">Last Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
                    const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                    return (
                      <tr key={u.id} className={`${rowBg} border-b border-slate-100`}>
                        <td className={`sticky left-0 z-10 ${rowBg} px-3 py-2.5 font-semibold text-slate-800 whitespace-nowrap`}>{name}</td>
                        {deviceCatalog.map(device => {
                          const has = u.devices.some(d => d.id === device.id);
                          return (
                            <td key={device.id} className="px-3 py-2.5 text-center">
                              <button
                                onClick={() => toggleDevice(u.id, device, has)}
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
                        <td className="px-3 py-2.5 text-center text-slate-400" title="Date employee last submitted their own recap; admin edits above do not change this date">
                          {u.last_reported
                            ? new Date(u.last_reported).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : 'Never'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Catalog sub-tab */}
          {devSubTab === 'catalog' && (
            <div>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={e => setNewDeviceName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addDeviceCatalogItem()}
                  placeholder="Device name..."
                  className="flex-1 px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none bg-white"
                />
                <button
                  onClick={addDeviceCatalogItem}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-white brand-gradient active:scale-95 transition-all"
                  style={{ boxShadow: '0 4px 14px rgba(139,53,217,0.25)' }}
                >
                  Add
                </button>
              </div>
              {deviceCatalogLoading ? (
                <div className="flex justify-center py-10">
                  <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
                </div>
              ) : deviceCatalog.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 py-10 flex flex-col items-center gap-2 text-slate-400"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <span className="material-symbols-outlined text-3xl opacity-30">devices</span>
                  <p className="text-sm">No devices in catalog yet</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {deviceCatalog.map(item => (
                    <div key={item.id} className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center justify-between"
                      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                      <button
                        onClick={() => deleteDeviceCatalogItem(item.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
                        <p className="text-[11px] text-slate-400 mt-0.5">{s.totals.days} day{s.totals.days !== 1 ? 's' : ''} · {s.totals.total_tests} test{s.totals.total_tests !== 1 ? 's' : ''}</p>
                        {s.foodAudit?.overBy > 0 && (
                          <p className="text-[11px] font-bold text-amber-600 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">warning</span>
                            Food: ₪{s.foodAudit.claimed.toLocaleString()} claimed / ₪{s.foodAudit.entitlement.toLocaleString()} allowed ({s.foodAudit.qualifyingDays} qualifying day{s.foodAudit.qualifyingDays !== 1 ? 's' : ''}) — over by ₪{s.foodAudit.overBy.toLocaleString()}
                          </p>
                        )}
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
            {[{ id: 'faq', label: 'FAQ', icon: 'quiz' }, { id: 'apps', label: 'Apps', icon: 'apps' }, { id: 'contacts', label: 'Contacts', icon: 'call' }, { id: 'videos', label: 'Videos', icon: 'smart_display' }].map(st => {
              const active = portalSubTab === st.id;
              return (
                <button key={st.id} onClick={() => { setPortalSubTab(st.id); setAddingFaq(false); setEditingFaqId(null); setAddingApp(false); setEditingAppId(null); setAddingContact(false); setEditingContactId(null); setAddingVideo(false); setEditingVideoId(null); }}
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

          {/* Contacts sub-tab */}
          {portalSubTab === 'contacts' && (
            <div className="space-y-3">
              {contactsLoading ? (
                <div className="flex justify-center py-10"><span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span></div>
              ) : (
                <>
                  {contacts.length === 0 && !addingContact && (
                    <div className="bg-white rounded-2xl border border-slate-100 py-10 flex flex-col items-center gap-2 text-slate-400">
                      <span className="material-symbols-outlined text-4xl opacity-30">call</span>
                      <p className="text-sm font-medium">No contacts yet</p>
                    </div>
                  )}
                  {contacts.map((c, i) => {
                    const isEditing = editingContactId === c.id;
                    return (
                      <div key={c.id} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                        {isEditing ? (
                          <>
                            <Field label="Name" value={editContact.name} onChange={v => setEditContact(p => ({ ...p, name: v }))} />
                            <Field label="Role / Title" value={editContact.title} onChange={v => setEditContact(p => ({ ...p, title: v }))} placeholder="e.g. HR Manager" />
                            <Field label="Phone" value={editContact.phone} onChange={v => setEditContact(p => ({ ...p, phone: v }))} type="tel" />
                            <div className="flex gap-2">
                              <button onClick={() => updateContact(c.id)} disabled={contactSaving || !editContact.name.trim() || !editContact.phone.trim()}
                                className="flex-1 py-2 rounded-xl text-sm font-bold text-white brand-gradient active:scale-95 transition-all disabled:opacity-50">Save</button>
                              <button onClick={() => setEditingContactId(null)}
                                className="flex-1 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 active:scale-95 transition-all">Cancel</button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              <button onClick={() => moveContact(c.id, 'up')} disabled={i === 0}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-20">
                                <span className="material-symbols-outlined text-base">arrow_upward</span>
                              </button>
                              <button onClick={() => moveContact(c.id, 'down')} disabled={i === contacts.length - 1}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-20">
                                <span className="material-symbols-outlined text-base">arrow_downward</span>
                              </button>
                            </div>
                            <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                              {(c.name[0] || '?').toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setEditingContactId(c.id); setEditContact({ name: c.name, title: c.title || '', phone: c.phone }); }}>
                              <p className="text-sm font-bold text-slate-800">{c.name}</p>
                              {c.title && <p className="text-xs text-slate-400 mt-0.5">{c.title}</p>}
                              <p className="text-xs text-slate-500 mt-0.5">{c.phone}</p>
                              <p className="text-[10px] text-brand-purple mt-1 font-medium">Tap to edit</p>
                            </div>
                            <a href={`tel:${c.phone}`}
                              className="flex items-center gap-1.5 text-xs font-bold text-white brand-gradient px-3 py-1.5 rounded-xl active:scale-95 transition-all flex-shrink-0"
                              style={{ boxShadow: '0 2px 8px rgba(139,53,217,0.25)' }}>
                              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>call</span>
                              Call
                            </a>
                            <button onClick={() => deleteContact(c.id)}
                              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 active:scale-95 transition-all">
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {addingContact ? (
                    <div className="bg-white rounded-2xl border border-brand-purple/20 p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">New Contact</p>
                      <Field label="Name" value={newContact.name} onChange={v => setNewContact(p => ({ ...p, name: v }))} />
                      <Field label="Role / Title" value={newContact.title} onChange={v => setNewContact(p => ({ ...p, title: v }))} placeholder="e.g. HR Manager" />
                      <Field label="Phone" value={newContact.phone} onChange={v => setNewContact(p => ({ ...p, phone: v }))} type="tel" />
                      <div className="flex gap-2">
                        <button onClick={saveContact} disabled={contactSaving || !newContact.name.trim() || !newContact.phone.trim()}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white brand-gradient active:scale-95 transition-all disabled:opacity-50">
                          {contactSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => { setAddingContact(false); setNewContact({ name: '', title: '', phone: '' }); }}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 active:scale-95 transition-all">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingContact(true); setEditingContactId(null); }}
                      className="w-full py-3 rounded-2xl text-sm font-bold text-brand-purple border-2 border-dashed border-brand-purple/30 hover:border-brand-purple/50 bg-white active:scale-95 transition-all flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-base">add</span>Add Contact
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Videos sub-tab */}
          {portalSubTab === 'videos' && (
            <div className="space-y-3">
              {tutorialsLoading ? (
                <div className="flex justify-center py-10"><span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span></div>
              ) : (
                <>
                  {tutorialVideos.length === 0 && !addingVideo && (
                    <div className="bg-white rounded-2xl border border-slate-100 py-10 flex flex-col items-center gap-2 text-slate-400">
                      <span className="material-symbols-outlined text-4xl opacity-30">smart_display</span>
                      <p className="text-sm font-medium">No videos yet</p>
                    </div>
                  )}
                  {tutorialVideos.map((v, i) => {
                    const isEditing = editingVideoId === v.id;
                    const deviceLabel = v.device_name_other || deviceCatalog.find(d => d.id === v.device_id)?.name;
                    return (
                      <div key={v.id} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                        {isEditing ? (
                          <>
                            <Field label="Title" value={editVideoTitle} onChange={setEditVideoTitle} />
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Device</label>
                              <select
                                value={editVideoDeviceId}
                                onChange={e => setEditVideoDeviceId(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none bg-white"
                              >
                                <option value="">None</option>
                                {deviceCatalog.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                <option value="__other__">Other...</option>
                              </select>
                              {editVideoDeviceId === '__other__' && (
                                <input
                                  value={editVideoDeviceOther}
                                  onChange={e => setEditVideoDeviceOther(e.target.value)}
                                  placeholder="Device name"
                                  className="mt-2 w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none bg-white"
                                />
                              )}
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</label>
                              <textarea
                                value={editVideoDesc}
                                onChange={e => setEditVideoDesc(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none bg-white resize-none"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => updateVideo(v.id)} disabled={videoSaving || !editVideoTitle.trim()}
                                className="flex-1 py-2 rounded-xl text-sm font-bold text-white brand-gradient active:scale-95 transition-all disabled:opacity-50">Save</button>
                              <button onClick={() => setEditingVideoId(null)}
                                className="flex-1 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 active:scale-95 transition-all">Cancel</button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col gap-1 flex-shrink-0 pt-0.5">
                              <button onClick={() => moveVideo(v.id, 'up')} disabled={i === 0}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-20">
                                <span className="material-symbols-outlined text-base">arrow_upward</span>
                              </button>
                              <button onClick={() => moveVideo(v.id, 'down')} disabled={i === tutorialVideos.length - 1}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-20">
                                <span className="material-symbols-outlined text-base">arrow_downward</span>
                              </button>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-slate-400 text-lg">{v.source_type === 'upload' ? 'movie' : 'link'}</span>
                            </div>
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                              setEditingVideoId(v.id);
                              setEditVideoTitle(v.title);
                              setEditVideoDeviceId(v.device_id || (v.device_name_other ? '__other__' : ''));
                              setEditVideoDeviceOther(v.device_name_other || '');
                              setEditVideoDesc(v.description || '');
                            }}>
                              <p className="text-sm font-bold text-slate-800">{v.title}</p>
                              {deviceLabel && <p className="text-xs text-slate-400 mt-0.5">{deviceLabel}</p>}
                              <p className="text-[10px] text-brand-purple mt-1 font-medium">Tap to edit</p>
                            </div>
                            <button onClick={() => deleteVideo(v.id)}
                              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 active:scale-95 transition-all">
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {addingVideo ? (
                    <div className="bg-white rounded-2xl border border-brand-purple/20 p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">New Video</p>
                      <Field label="Title" value={newVideoTitle} onChange={setNewVideoTitle} />
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Device</label>
                        <select
                          value={newVideoDeviceId}
                          onChange={e => setNewVideoDeviceId(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none bg-white"
                        >
                          <option value="">None</option>
                          {deviceCatalog.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          <option value="__other__">Other...</option>
                        </select>
                        {newVideoDeviceId === '__other__' && (
                          <input
                            value={newVideoDeviceOther}
                            onChange={e => setNewVideoDeviceOther(e.target.value)}
                            placeholder="Device name"
                            className="mt-2 w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none bg-white"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</label>
                        <textarea
                          value={newVideoDesc}
                          onChange={e => setNewVideoDesc(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none bg-white resize-none"
                        />
                      </div>
                      {/* Upload vs Link toggle */}
                      <div className="flex gap-2">
                        {[['upload', 'Upload File'], ['link', 'Paste Link']].map(([mode, label]) => (
                          <button key={mode} type="button"
                            onClick={() => setNewVideoSourceType(mode)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                              newVideoSourceType === mode ? 'brand-gradient text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >{label}</button>
                        ))}
                      </div>
                      {newVideoSourceType === 'upload' ? (
                        <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${newVideoFile ? 'border-brand-purple/40 bg-purple-50' : 'border-slate-200 hover:border-brand-purple/30'}`}>
                          <span className="material-symbols-outlined text-slate-400 text-xl flex-shrink-0">movie</span>
                          <span className="text-xs text-slate-500 flex-1">{newVideoFile ? newVideoFile.name : 'Choose video file (max 200MB)'}</span>
                          <input type="file" accept="video/*" className="hidden" onChange={e => setNewVideoFile(e.target.files[0] || null)} />
                        </label>
                      ) : (
                        <Field label="Video URL" value={newVideoUrl} onChange={setNewVideoUrl} placeholder="https://youtube.com/..." />
                      )}
                      <div className="flex gap-2">
                        <button onClick={saveVideo}
                          disabled={videoSaving || !newVideoTitle.trim() || (newVideoSourceType === 'upload' ? !newVideoFile : !newVideoUrl.trim()) || (newVideoFile && newVideoFile.size > 200 * 1024 * 1024)}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white brand-gradient active:scale-95 transition-all disabled:opacity-50">
                          {videoSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => { setAddingVideo(false); setNewVideoTitle(''); setNewVideoDeviceId(''); setNewVideoDeviceOther(''); setNewVideoDesc(''); setNewVideoFile(null); setNewVideoUrl(''); }}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 active:scale-95 transition-all">Cancel</button>
                      </div>
                      {newVideoFile && newVideoFile.size > 200 * 1024 * 1024 && (
                        <p className="text-xs font-semibold text-red-500">File exceeds 200MB limit</p>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => { setAddingVideo(true); setEditingVideoId(null); }}
                      className="w-full py-3 rounded-2xl text-sm font-bold text-brand-purple border-2 border-dashed border-brand-purple/30 hover:border-brand-purple/50 bg-white active:scale-95 transition-all flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-base">add</span>Add Video
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Notifications ────────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="px-4 space-y-6">

          {/* Create notification form */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">New Notification</p>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Title</label>
              <input
                value={notifForm.title}
                onChange={e => setNotifForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Notification title"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Content</label>
              <textarea
                value={notifForm.content}
                onChange={e => setNotifForm(p => ({ ...p, content: e.target.value }))}
                rows={4}
                placeholder="Notification body..."
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none bg-white resize-none"
              />
            </div>
            {/* Send timing */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">When to Send</label>
              <div className="flex gap-2">
                {[['now', 'Send Now'], ['schedule', 'Schedule']].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setNotifForm(p => ({ ...p, sendMode: mode }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      notifForm.sendMode === mode ? 'brand-gradient text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >{label}</button>
                ))}
              </div>
              {notifForm.sendMode === 'schedule' && !notifForm.isRecurring && (
                <input
                  type="datetime-local"
                  value={notifForm.scheduled_for}
                  onChange={e => setNotifForm(p => ({ ...p, scheduled_for: e.target.value }))}
                  min={new Date().toISOString().slice(0, 16)}
                  className="mt-2 w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none bg-white"
                />
              )}
            </div>

            {/* Repeat weekly toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={notifForm.isRecurring}
                  onChange={e => setNotifForm(p => ({ ...p, isRecurring: e.target.checked }))}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${notifForm.isRecurring ? 'brand-gradient' : 'bg-slate-200'}`} />
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifForm.isRecurring ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm font-semibold text-slate-700">Repeat Weekly</span>
            </label>

            {notifForm.isRecurring && (
              <div className="space-y-3 pl-4 border-l-2 border-brand-purple/20">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Repeat on</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, i) => {
                      const active = notifForm.recurrence_days.includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setNotifForm(p => ({
                            ...p,
                            recurrence_days: active
                              ? p.recurrence_days.filter(d => d !== i)
                              : [...p.recurrence_days, i],
                          }))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                            active ? 'brand-gradient text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >{day}</button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Time (Israel)</label>
                  <input
                    type="time"
                    value={notifForm.recurrence_time}
                    onChange={e => setNotifForm(p => ({ ...p, recurrence_time: e.target.value }))}
                    className="px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none bg-white"
                  />
                </div>
              </div>
            )}

            {/* Requires approval toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={notifForm.requires_approval}
                  onChange={e => setNotifForm(p => ({ ...p, requires_approval: e.target.checked }))}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${notifForm.requires_approval ? 'brand-gradient' : 'bg-slate-200'}`} />
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifForm.requires_approval ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm font-semibold text-slate-700">Requires Tester Approval</span>
            </label>

            {/* Document Attachment */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Document Attachment <span className="normal-case font-normal">(optional)</span></label>
              <div className="flex gap-2">
                {[['none', 'None'], ['upload', 'Upload File'], ['link', 'Paste Link']].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setNotifForm(p => ({ ...p, documentMode: mode, documentFile: null, documentExternalUrl: '', force_view_document: false }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      notifForm.documentMode === mode ? 'brand-gradient text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >{label}</button>
                ))}
              </div>

              {notifForm.documentMode === 'upload' && (
                <div className="mt-2">
                  <input
                    ref={docFileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="sr-only"
                    onChange={e => setNotifForm(p => ({ ...p, documentFile: e.target.files[0] || null }))}
                  />
                  <button
                    type="button"
                    onClick={() => docFileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-brand-purple/40 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-slate-400 text-lg">upload_file</span>
                    <span className={`text-sm ${notifForm.documentFile ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>
                      {notifForm.documentFile ? notifForm.documentFile.name : 'Choose PDF or Word document'}
                    </span>
                  </button>
                </div>
              )}

              {notifForm.documentMode === 'link' && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 focus-within:border-brand-purple/50 bg-white">
                  <span className="material-symbols-outlined text-slate-400 text-base flex-shrink-0">link</span>
                  <input
                    type="url"
                    value={notifForm.documentExternalUrl}
                    onChange={e => setNotifForm(p => ({ ...p, documentExternalUrl: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1 text-sm bg-transparent focus:outline-none"
                  />
                </div>
              )}

              {notifForm.documentMode !== 'none' && (
                <label className="flex items-center gap-3 cursor-pointer select-none mt-3">
                  <div className="relative flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={notifForm.force_view_document}
                      onChange={e => setNotifForm(p => ({ ...p, force_view_document: e.target.checked }))}
                      className="sr-only"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors ${notifForm.force_view_document ? 'brand-gradient' : 'bg-slate-200'}`} />
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifForm.force_view_document ? 'translate-x-5' : 'translate-x-1'}`} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700">Force user to open document before approving</span>
                </label>
              )}
            </div>

            <button
              onClick={submitNotification}
              disabled={notifSubmitting || !notifForm.title.trim() || !notifForm.content.trim()}
              className="w-full py-3 rounded-xl text-sm font-bold text-white brand-gradient active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ boxShadow: '0 4px 14px rgba(139,53,217,0.25)' }}
            >
              {notifSubmitting
                ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Sending...</>
                : <><span className="material-symbols-outlined text-sm">send</span> Send Notification</>
              }
            </button>
            {notifError && (
              <p className="text-xs text-red-500 text-center mt-1">{notifError}</p>
            )}
          </div>

          {/* Notifications list */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Sent Notifications</p>
            {notifLoading ? (
              <div className="flex justify-center py-10">
                <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
              </div>
            ) : notifList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 py-10 flex flex-col items-center gap-2 text-slate-400">
                <span className="material-symbols-outlined text-4xl opacity-30">notifications_off</span>
                <p className="text-sm font-medium">No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifList.map(n => (
                  <div key={n.id} className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-bold text-slate-800 text-sm">{n.title}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${n.type === 'recurring' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                            {n.type}
                          </span>
                          {n.requires_approval && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">approval required</span>
                          )}
                          {(n.document_file_name || n.document_external_url) && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-xs">attach_file</span>
                              {n.document_file_name || 'link'}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${n.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            {n.is_active ? 'active' : 'inactive'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">{n.content}</p>
                        <div className="flex flex-col gap-0.5 mt-1.5">
                          <p className="text-[10px] text-slate-300">Created {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          {n.scheduled_for && !n.is_active && (
                            <p className="text-[10px] text-amber-500 font-semibold">
                              Sends {new Date(n.scheduled_for).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                          {n.recurrence_days?.length > 0 && n.recurrence_time && (
                            <p className="text-[10px] text-violet-500 font-semibold">
                              Repeats {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].filter((_, i) => n.recurrence_days.includes(i)).join(', ')} at {n.recurrence_time}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {n.requires_approval && (
                          <button
                            onClick={() => openCompliance(n.id)}
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-brand-purple/40 active:scale-95 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">bar_chart</span>
                            Compliance
                          </button>
                        )}
                        {n.is_active && (
                          <button
                            onClick={() => deactivateNotification(n.id)}
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 active:scale-95 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">visibility_off</span>
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Compliance Modal ──────────────────────────────────────────────── */}
      {complianceModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setComplianceModal(null); }}>
          <div className="relative z-50 bg-white rounded-3xl flex flex-col w-full max-w-lg shadow-2xl" style={{ maxHeight: '85vh' }}>
            <div className="px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-100">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-extrabold text-slate-900 truncate">
                  {complianceModal.loading ? 'Loading...' : complianceModal.notification?.title}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Tester approval status</p>
              </div>
              <button onClick={() => setComplianceModal(null)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 ml-3 flex-shrink-0">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            {complianceModal.loading ? (
              <div className="flex justify-center py-10">
                <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1">
                {(complianceModal.compliance || []).length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                    <span className="material-symbols-outlined text-4xl opacity-30">group</span>
                    <p className="text-sm font-medium">No testers found</p>
                  </div>
                ) : (
                  <div>
                    {(() => {
                      const hasDocument = !!(complianceModal.notification?.document_storage_path || complianceModal.notification?.document_external_url);
                      return (complianceModal.compliance || []).map(t => {
                        const name = `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.username;
                        return (
                          <div key={t.user_id} className="px-5 py-3.5 flex items-center justify-between gap-3 border-b border-slate-50 last:border-0">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                              <p className="text-[11px] text-slate-400">{t.username}</p>
                            </div>
                            <div className="flex flex-col gap-1 items-end flex-shrink-0">
                              {t.approved_at ? (
                                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-100 whitespace-nowrap">
                                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                  {new Date(t.approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1.5 rounded-xl whitespace-nowrap">
                                  <span className="material-symbols-outlined text-sm">schedule</span>
                                  Pending
                                </span>
                              )}
                              {hasDocument && (
                                t.document_opened_at ? (
                                  <span className="flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-100 whitespace-nowrap">
                                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>visibility</span>
                                    Opened {new Date(t.document_opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1.5 rounded-xl whitespace-nowrap">
                                    <span className="material-symbols-outlined text-sm">visibility_off</span>
                                    Not opened
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Equipment Orders ──────────────────────────────────────── */}
      {activeTab === 'eq_orders' && (
        <div className="px-4 space-y-4">
          {/* Sub-tab toggle */}
          <div className="flex gap-2">
            {[{ id: 'catalog', label: 'Catalog', icon: 'list' }, { id: 'orders', label: 'Orders', icon: 'inventory' }].map(st => (
              <button
                key={st.id}
                onClick={() => setEqSubTab(st.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                  eqSubTab === st.id ? 'brand-gradient text-white' : 'bg-white border border-slate-200 text-slate-500'
                }`}
                style={eqSubTab === st.id ? { boxShadow: '0 4px 14px rgba(139,53,217,0.25)' } : {}}
              >
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: eqSubTab === st.id ? "'FILL' 1" : "'FILL' 0" }}>{st.icon}</span>
                {st.label}
              </button>
            ))}
          </div>

          {/* Catalog sub-tab */}
          {eqSubTab === 'catalog' && (
            <div>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCatalogItem()}
                  placeholder="Item name..."
                  className="flex-1 px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-brand-purple/50 focus:outline-none bg-white"
                />
                <button
                  onClick={addCatalogItem}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-white brand-gradient active:scale-95 transition-all"
                  style={{ boxShadow: '0 4px 14px rgba(139,53,217,0.25)' }}
                >
                  Add
                </button>
              </div>
              {eqCatalogLoading ? (
                <div className="flex justify-center py-10">
                  <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
                </div>
              ) : eqCatalog.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 py-10 flex flex-col items-center gap-2 text-slate-400"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <span className="material-symbols-outlined text-3xl opacity-30">list</span>
                  <p className="text-sm">No items in catalog yet</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {eqCatalog.map(item => (
                    <div key={item.id} className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center justify-between"
                      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                      <button
                        onClick={() => deleteCatalogItem(item.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Orders sub-tab */}
          {eqSubTab === 'orders' && (
            <div>
              {eqOrdersLoading ? (
                <div className="flex justify-center py-10">
                  <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
                </div>
              ) : eqOrders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 py-10 flex flex-col items-center gap-2 text-slate-400"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <span className="material-symbols-outlined text-3xl opacity-30">inventory</span>
                  <p className="text-sm">No orders yet</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {eqOrders.map(order => {
                    const profile = order.profiles;
                    const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username : '—';
                    const itemCount = Array.isArray(order.items) ? order.items.length : 0;
                    return (
                      <button
                        key={order.id}
                        onClick={() => setEqOrderModal(order)}
                        className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center justify-between text-left w-full active:scale-[0.99] transition-all"
                        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-800">{name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {itemCount} item{itemCount !== 1 ? 's' : ''} · {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-xl ${order.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {order.status === 'completed' ? 'Completed' : 'Pending'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Equipment Order Modal ──────────────────────────────────────── */}
      {eqOrderModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setEqOrderModal(null); }}>
          <div className="relative z-50 bg-white rounded-3xl w-full max-w-md shadow-2xl" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 flex-shrink-0">
              <div>
                {(() => {
                  const p = eqOrderModal.profiles;
                  const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username : '—';
                  return <h2 className="text-base font-extrabold text-slate-900">{name}</h2>;
                })()}
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(eqOrderModal.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setEqOrderModal(null)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-2">
              {(eqOrderModal.items || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                  <p className="text-sm text-slate-700">{item.name}</p>
                  <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">×{item.quantity}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0">
              <button
                onClick={() => completeOrder(eqOrderModal.id)}
                disabled={completingOrderId === eqOrderModal.id}
                className="w-full py-3 rounded-2xl text-sm font-bold text-white brand-gradient active:scale-[0.98] transition-all disabled:opacity-50"
                style={{ boxShadow: '0 4px 14px rgba(139,53,217,0.3)' }}
              >
                {completingOrderId === eqOrderModal.id ? 'Saving...' : 'Mark as Complete'}
              </button>
            </div>
          </div>
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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Uniform</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Size" value={drawerEdits.clothing_size} onChange={v => setDrawerEdits(p => ({...p, clothing_size: v}))} placeholder="M" />
                  <Field label="Sets" value={String(drawerEdits.uniform_sets)} onChange={v => setDrawerEdits(p => ({...p, uniform_sets: v}))} type="number" />
                </div>
              </section>
              <section>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Permissions</p>
                <label className={`flex items-center gap-3 p-4 rounded-2xl select-none ${selectedUser.id === currentUserId ? 'opacity-40 pointer-events-none bg-slate-50' : 'bg-red-50 cursor-pointer'}`}>
                  <div
                    className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${drawerEdits.is_admin ? 'bg-red-500' : 'bg-slate-200'}`}
                    onClick={() => {
                      if (selectedUser.id === currentUserId) return;
                      if (!drawerEdits.is_admin && !confirm(`Grant full admin access to ${selectedUser.first_name || selectedUser.username}?`)) return;
                      setDrawerEdits(p => ({ ...p, is_admin: !p.is_admin }));
                    }}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${drawerEdits.is_admin ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Admin Access</p>
                    <p className="text-xs text-slate-400">
                      {selectedUser.id === currentUserId ? 'Cannot change your own status' : 'Full access to admin dashboard'}
                    </p>
                  </div>
                </label>
              </section>

              <section>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Equipment</p>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.devices.length === 0 && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl border bg-slate-50 text-slate-400 border-slate-200">
                      No devices reported
                    </span>
                  )}
                  {selectedUser.devices.map(d => (
                    <span key={d.id} className="text-xs font-bold px-2.5 py-1 rounded-xl border bg-emerald-50 text-emerald-700 border-emerald-200">
                      {d.name}
                    </span>
                  ))}
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${selectedUser.echo_certified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                    Echo Certified
                  </span>
                </div>
              </section>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0 flex items-center gap-3">
              {selectedUser?.id !== currentUserId && (
                <button
                  onClick={() => setDeleteConfirmUser(selectedUser)}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-2xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 active:scale-[0.98] transition-all"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  Delete
                </button>
              )}
              <button
                onClick={saveDrawer}
                disabled={drawerSaving}
                className="flex-1 py-3 rounded-2xl text-sm font-bold text-white brand-gradient active:scale-[0.98] transition-all disabled:opacity-50"
                style={{ boxShadow: '0 4px 14px rgba(139,53,217,0.3)' }}
              >
                {drawerSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
          </div>
        </>
      )}

      {/* ── Delete Employee Confirmation Modal ────────────────────────────── */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-red-600" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Delete Employee</h3>
            <p className="text-sm text-slate-500 mb-6">
              This will permanently delete{' '}
              <span className="font-bold text-slate-700">
                {`${deleteConfirmUser.first_name || ''} ${deleteConfirmUser.last_name || ''}`.trim() || deleteConfirmUser.username}
              </span>{' '}
              and all their data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                disabled={deletingUser}
                className="flex-1 px-4 py-2.5 rounded-2xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteEmployee(deleteConfirmUser)}
                disabled={deletingUser}
                className="flex-1 px-4 py-2.5 rounded-2xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50"
              >
                {deletingUser ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
