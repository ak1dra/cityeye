import { randomUUID } from 'crypto';
import {
  normalizeReportPayload,
  VALID_STATUSES,
} from '../../backend/src/reportStore.js';
import { createServerSupabaseClient } from './supabaseServer.js';

const REPORT_FIELDS = [
  'id',
  'title',
  'description',
  'type',
  'category',
  'severity',
  'status',
  'address',
  'lat',
  'lng',
  'image',
  'image_url',
  'completion_image_url',
  'comment',
  'priority_score',
  'detected_issue_title',
  'ai_comment',
  'recommended_action',
  'estimated_fix_time',
  'responsible_dept',
  'risk_for',
  'duplicate_likely',
  'suggested_responsible_role',
  'confidence_label',
  'estimated_resolution_days',
  'recommendations',
  'user_email',
  'user_name',
  'reporter_role',
  'reporter_org_name',
  'responsible_role',
  'assigned_org_name',
  'contractor_org_name',
  'operator_org_name',
  'asset_type',
  'asset_owner',
  'service_zone',
  'warranty_until',
  'responsibility_mode',
  'work_order_status',
  'sla_due_at',
  'proof_status',
  'verification_score',
  'shared_case',
  'partner_comment',
  'created_at',
  'updated_at',
];

const ANALYTICS_FIELDS = [
  'id',
  'type',
  'category',
  'severity',
  'status',
  'address',
  'lat',
  'lng',
  'priority_score',
  'responsible_role',
  'suggested_responsible_role',
  'shared_case',
  'duplicate_likely',
  'created_at',
  'updated_at',
];

const REPORT_SELECT = REPORT_FIELDS.join(',');
const ANALYTICS_SELECT = ANALYTICS_FIELDS.join(',');
const CLOSED_STATUSES = ['resolved', 'verified', 'rejected'];

const MAP_FIELDS = [
  'id',
  'title',
  'description',
  'type',
  'category',
  'severity',
  'status',
  'address',
  'lat',
  'lng',
  'image',
  'image_url',
  'completion_image_url',
  'comment',
  'priority_score',
  'detected_issue_title',
  'ai_comment',
  'recommended_action',
  'estimated_fix_time',
  'responsible_dept',
  'risk_for',
  'duplicate_likely',
  'suggested_responsible_role',
  'confidence_label',
  'user_email',
  'user_name',
  'reporter_role',
  'reporter_org_name',
  'responsible_role',
  'assigned_org_name',
  'contractor_org_name',
  'shared_case',
  'created_at',
  'updated_at',
];

const FEED_FIELDS = [
  'id',
  'title',
  'description',
  'type',
  'category',
  'severity',
  'status',
  'address',
  'image',
  'image_url',
  'completion_image_url',
  'comment',
  'detected_issue_title',
  'ai_comment',
  'confidence_label',
  'user_email',
  'user_name',
  'reporter_role',
  'reporter_org_name',
  'responsible_role',
  'assigned_org_name',
  'contractor_org_name',
  'shared_case',
  'partner_comment',
  'created_at',
  'updated_at',
];

const REPORT_SELECT_PROFILES = {
  default: REPORT_SELECT,
  map: MAP_FIELDS.join(','),
  feed: FEED_FIELDS.join(','),
  gov: REPORT_SELECT,
  contractor: REPORT_SELECT,
};

function createHttpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function quotedIn(values) {
  return `(${values.map(value => `"${value}"`).join(',')})`;
}

function sanitizeSearchTerm(value) {
  if (typeof value !== 'string') return null;
  const sanitized = value
    .trim()
    .replace(/[%(),]/g, ' ')
    .replace(/\s+/g, ' ');
  return sanitized.length > 0 ? sanitized : null;
}

function resolveReportSelect(view = 'default') {
  return REPORT_SELECT_PROFILES[view] ?? REPORT_SELECT_PROFILES.default;
}

function buildPageResult(base) {
  return {
    ...base,
    source: 'supabase',
  };
}

function buildAnalyticsResult(base) {
  return {
    ...base,
    source: 'supabase',
  };
}

function applyListFilter(query, column, values = []) {
  if (!Array.isArray(values) || values.length === 0) return query;
  if (values.length === 1) return query.eq(column, values[0]);
  return query.in(column, values);
}

function applyTextSearch(query, value) {
  const search = sanitizeSearchTerm(value);
  if (!search) return query;

  return query.or([
    `title.ilike.%${search}%`,
    `description.ilike.%${search}%`,
    `detected_issue_title.ilike.%${search}%`,
    `address.ilike.%${search}%`,
    `comment.ilike.%${search}%`,
    `type.ilike.%${search}%`,
    `category.ilike.%${search}%`,
  ].join(','));
}

function applyReportFilters(query, filters = {}) {
  let next = query;
  next = applyListFilter(next, 'status', filters.statuses);
  next = applyListFilter(next, 'severity', filters.severities);
  next = applyListFilter(next, 'responsible_role', filters.responsibleRoles);

  if (typeof filters.sharedCase === 'boolean') {
    next = next.eq('shared_case', filters.sharedCase);
  }

  return applyTextSearch(next, filters.search);
}

function normalizeSupabaseError(error, fallbackMessage) {
  if (!error) return createHttpError(fallbackMessage, 500);
  return createHttpError(error.message || fallbackMessage, error.code === 'PGRST116' ? 404 : 500);
}

export async function readReportById(id, { authToken = null, select = REPORT_SELECT } = {}) {
  const supabase = createServerSupabaseClient({ authToken });
  const { data, error } = await supabase
    .from('reports')
    .select(select)
    .eq('id', id)
    .maybeSingle();

  if (error) throw normalizeSupabaseError(error, 'Failed to read report');
  return data ?? null;
}

export async function readReportsPage(filters = {}, { authToken = null, select = null } = {}) {
  const supabase = createServerSupabaseClient({ authToken });
  const limit = Math.max(1, Number(filters.limit) || 120);
  const offset = Math.max(0, Number(filters.offset) || 0);
  const resolvedSelect = select ?? resolveReportSelect(filters.view);

  let query = supabase
    .from('reports')
    .select(resolvedSelect, { count: 'exact' });

  query = applyReportFilters(query, filters)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw normalizeSupabaseError(error, 'Failed to read reports');

  const items = Array.isArray(data) ? data : [];
  return buildPageResult({
    items,
    total: Number.isFinite(count) ? count : items.length,
    limit,
    offset,
    has_more: Number.isFinite(count) ? (offset + items.length) < count : items.length === limit,
  });
}

async function countReports(client, filters = {}) {
  let query = client
    .from('reports')
    .select('id', { head: true, count: 'exact' });

  query = applyReportFilters(query, filters);

  if (Array.isArray(filters.excludedStatuses) && filters.excludedStatuses.length > 0) {
    query = query.not('status', 'in', quotedIn(filters.excludedStatuses));
  }

  const { count, error } = await query;
  if (error) throw normalizeSupabaseError(error, 'Failed to count reports');
  return Number.isFinite(count) ? count : 0;
}

export async function readAnalyticsSource() {
  const supabase = createServerSupabaseClient();

  const [projectionResult, total, open, resolved, newCnt, inProgCnt, criticalCnt, waitingPartner, sharedOpen] = await Promise.all([
    supabase
      .from('reports')
      .select(ANALYTICS_SELECT)
      .order('created_at', { ascending: false }),
    countReports(supabase),
    countReports(supabase, { excludedStatuses: CLOSED_STATUSES }),
    countReports(supabase, { statuses: ['resolved', 'verified'] }),
    countReports(supabase, { statuses: ['new'] }),
    countReports(supabase, { statuses: ['triage', 'in_progress', 'waiting_partner'] }),
    countReports(supabase, { severities: ['critical'] }),
    countReports(supabase, { statuses: ['waiting_partner'] }),
    countReports(supabase, { sharedCase: true, excludedStatuses: CLOSED_STATUSES }),
  ]);

  if (projectionResult.error) {
    throw normalizeSupabaseError(projectionResult.error, 'Failed to read analytics projection');
  }

  const projectionData = Array.isArray(projectionResult.data) ? projectionResult.data : [];
  return buildAnalyticsResult({
    reports: projectionData,
    summary: {
      total,
      open,
      resolved,
      resolvedCnt: resolved,
      newCnt,
      inProgCnt,
      criticalCnt,
      waitingPartner,
      sharedOpen,
    },
  });
}

export async function createReport(payload = {}, { authToken = null } = {}) {
  const normalized = normalizeReportPayload(payload);
  const now = new Date().toISOString();
  const report = {
    id: randomUUID(),
    ...normalized,
    created_at: now,
    updated_at: now,
  };

  const supabase = createServerSupabaseClient({ authToken });
  const { data, error } = await supabase
    .from('reports')
    .insert(report)
    .select(REPORT_SELECT)
    .single();

  if (error) throw normalizeSupabaseError(error, 'Failed to create report');
  return data ?? report;
}

export async function updateReport(id, patch = {}, { authToken = null } = {}) {
  const existing = await readReportById(id, { authToken, select: REPORT_SELECT });
  if (!existing) {
    throw createHttpError('Report not found', 404);
  }

  const normalized = normalizeReportPayload({ ...existing, ...patch });
  const nextReport = {
    ...existing,
    ...normalized,
    updated_at: new Date().toISOString(),
  };

  const supabase = createServerSupabaseClient({ authToken });
  const { data, error } = await supabase
    .from('reports')
    .update(nextReport)
    .eq('id', id)
    .select(REPORT_SELECT)
    .single();

  if (error) throw normalizeSupabaseError(error, 'Failed to update report');
  return data ?? nextReport;
}

export async function updateReportStatus(id, status, extraFields = {}, options = {}) {
  if (!VALID_STATUSES.includes(status)) {
    throw createHttpError(`status must be one of: ${VALID_STATUSES.join(', ')}`, 400);
  }

  return updateReport(id, { ...extraFields, status }, options);
}
