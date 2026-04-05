import { buildBusinessUser, buildGovernmentUser } from './userProfile';

export const DEMO_USER_STORAGE_KEY = 'cityeye_demo_user';
export const DEMO_REPORTS_STORAGE_KEY = 'cityeye_demo_reports';

export const DEMO_ACCOUNTS = {
  'gov@cityeye.kz': { password: 'CityEye2026', role: 'government' },
  'user@cityeye.kz': { password: 'User2026', role: 'citizen' },
  'business@cityeye.kz': { password: 'Business2026', role: 'business' },
};

function toJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function buildCitizenDemoUser(email) {
  return {
    id: `demo:${email}`,
    email,
    role: 'citizen',
    status: 'active',
    name: 'Demo Citizen',
    full_name: 'Demo Citizen',
    district: 'Алматы',
    demo: true,
  };
}

export function buildDemoUser(email) {
  const account = DEMO_ACCOUNTS[email];
  if (!account) return null;

  const user = account.role === 'government'
    ? buildGovernmentUser(email)
    : account.role === 'business'
      ? buildBusinessUser(email)
      : buildCitizenDemoUser(email);

  return {
    ...user,
    id: user.id || `demo:${email}`,
    email,
    role: account.role,
    status: 'active',
    demo: true,
  };
}

export function authenticateDemoUser(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const account = DEMO_ACCOUNTS[normalizedEmail];
  if (!account || account.password !== password) return null;
  return buildDemoUser(normalizedEmail);
}

export function readDemoUser() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(DEMO_USER_STORAGE_KEY);
  const parsed = raw ? toJson(raw, null) : null;
  return parsed?.email && parsed?.role ? parsed : null;
}

export function writeDemoUser(user) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearDemoUser() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
}

export function isDemoUser(user) {
  return Boolean(user?.demo);
}

export function readDemoReports() {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(DEMO_REPORTS_STORAGE_KEY);
  const parsed = raw ? toJson(raw, []) : [];
  return Array.isArray(parsed) ? parsed : [];
}

export function writeDemoReports(reports) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_REPORTS_STORAGE_KEY, JSON.stringify(reports));
}

export function mergeReportsWithDemo(baseReports) {
  const demoReports = readDemoReports();
  if (demoReports.length === 0) return baseReports;

  const next = new Map((Array.isArray(baseReports) ? baseReports : []).map(report => [String(report.id), report]));
  demoReports.forEach(report => {
    next.set(String(report.id), report);
  });

  return [...next.values()].sort((left, right) => {
    const rightDate = new Date(right?.created_at ?? 0).getTime();
    const leftDate = new Date(left?.created_at ?? 0).getTime();
    return rightDate - leftDate;
  });
}

function ensureReporterFields(report, user) {
  const next = { ...report };
  if (!user) return next;

  next.user_email = next.user_email || user.email;
  next.user_name = next.user_name || user.name || user.full_name || 'Demo User';
  next.reporter_role = next.reporter_role || user.role || 'citizen';
  if (user.role === 'business') {
    next.reporter_org_name = next.reporter_org_name || user.name || 'Подрядчик';
    next.assigned_org_name = next.assigned_org_name || user.name || 'Подрядчик';
    next.contractor_org_name = next.contractor_org_name || user.name || 'Подрядчик';
  }

  return next;
}

export function createDemoReport(payload, user) {
  const now = new Date().toISOString();
  const report = ensureReporterFields({
    id: `demo-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title: payload.title || payload.detected_issue_title || payload.type || 'Проблема',
    description: payload.description || payload.ai_comment || payload.comment || '',
    type: payload.type || payload.category || 'other',
    category: payload.category || payload.type || 'other',
    severity: payload.severity || 'medium',
    status: payload.status || 'new',
    address: payload.address || null,
    comment: payload.comment || null,
    image_url: payload.image_url || null,
    image: payload.image || null,
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,
    detected_issue_title: payload.detected_issue_title || payload.title || payload.type || 'Проблема',
    ai_comment: payload.ai_comment || null,
    priority_score: payload.priority_score ?? null,
    recommended_action: payload.recommended_action || null,
    estimated_fix_time: payload.estimated_fix_time || null,
    responsible_dept: payload.responsible_dept || null,
    risk_for: payload.risk_for || null,
    duplicate_likely: Boolean(payload.duplicate_likely),
    suggested_responsible_role: payload.suggested_responsible_role || null,
    confidence_label: payload.confidence_label || null,
    responsible_role: payload.responsible_role || null,
    reporter_org_name: payload.reporter_org_name || null,
    assigned_org_name: payload.assigned_org_name || null,
    contractor_org_name: payload.contractor_org_name || null,
    operator_org_name: payload.operator_org_name || null,
    asset_type: payload.asset_type || null,
    asset_owner: payload.asset_owner || null,
    service_zone: payload.service_zone || null,
    warranty_until: payload.warranty_until || null,
    responsibility_mode: payload.responsibility_mode || null,
    work_order_status: payload.work_order_status || null,
    sla_due_at: payload.sla_due_at || null,
    proof_status: payload.proof_status || null,
    verification_score: payload.verification_score ?? null,
    shared_case: Boolean(payload.shared_case),
    completion_image_url: payload.completion_image_url || null,
    partner_comment: payload.partner_comment || null,
    created_at: now,
    updated_at: now,
    demo: true,
  }, user);

  const next = [report, ...readDemoReports()];
  writeDemoReports(next);
  return report;
}

export function updateDemoReport(existingReport, fields) {
  const nextReport = {
    ...existingReport,
    ...fields,
    updated_at: new Date().toISOString(),
    demo: true,
  };

  const reports = readDemoReports();
  const id = String(existingReport.id);
  const nextReports = reports.filter(report => String(report.id) !== id);
  nextReports.unshift(nextReport);
  writeDemoReports(nextReports);
  return nextReport;
}
