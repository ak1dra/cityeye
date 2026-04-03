const TYPE_LABELS = {
  road: 'Дорожный дефект',
  light: 'Неисправность освещения',
  lighting: 'Неисправность освещения',
  trash: 'Санитарная проблема',
  waste: 'Санитарная проблема',
  greenery: 'Проблема благоустройства',
  utilities: 'Коммунальная проблема',
  parking: 'Проблема парковки',
  vandal: 'Следы вандализма',
  other: 'Городская инфраструктурная проблема',
};

export const AI_ROUTE_META = {
  government: {
    label: 'Вести акиматом',
    shortLabel: 'Акимат',
    color: '#6366f1',
    bg: '#eef2ff',
    border: '#c7d2fe',
  },
  business: {
    label: 'Передать бизнесу',
    shortLabel: 'Бизнес',
    color: '#0f766e',
    bg: '#ccfbf1',
    border: '#99f6e4',
  },
  shared: {
    label: 'Совместный кейс',
    shortLabel: 'Shared',
    color: '#a16207',
    bg: '#fef3c7',
    border: '#fde68a',
  },
};

export const AI_CONFIDENCE_META = {
  high: {
    label: 'Высокая уверенность',
    shortLabel: 'High confidence',
    color: '#166534',
    bg: '#dcfce7',
    border: '#86efac',
  },
  medium: {
    label: 'Средняя уверенность',
    shortLabel: 'Medium confidence',
    color: '#1d4ed8',
    bg: '#dbeafe',
    border: '#93c5fd',
  },
  low: {
    label: 'Низкая уверенность',
    shortLabel: 'Low confidence',
    color: '#b45309',
    bg: '#fef3c7',
    border: '#fcd34d',
  },
};

export const AI_SEVERITY_META = {
  critical: { label: 'Критично', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  high: { label: 'Высокий', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  medium: { label: 'Средний', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  low: { label: 'Низкий', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
};

function toNonEmptyString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeSeverityKey(value) {
  const source = toNonEmptyString(value)?.toLowerCase() || '';
  if (source.includes('крит') || source === 'critical' || source === 'crit') return 'critical';
  if (source.includes('выс') || source === 'high') return 'high';
  if (source.includes('сред') || source === 'medium' || source === 'mid') return 'medium';
  if (source.includes('низ') || source === 'low') return 'low';
  return 'medium';
}

export function normalizeSuggestedResponsibleRole(value, fallback = 'government') {
  const source = toNonEmptyString(value)?.toLowerCase() || '';
  if (['government', 'gov'].includes(source) || source.includes('аким')) return 'government';
  if (['business', 'company', 'private'].includes(source) || source.includes('бизнес') || source.includes('ук')) return 'business';
  if (['shared', 'joint'].includes(source) || source.includes('совмест')) return 'shared';
  return fallback;
}

export function normalizeConfidenceLabel(value, fallback = 'medium') {
  const source = toNonEmptyString(value)?.toLowerCase() || '';
  if (['high', 'strong'].includes(source) || source.includes('выс')) return 'high';
  if (['medium', 'mid', 'normal'].includes(source) || source.includes('сред')) return 'medium';
  if (['low', 'weak'].includes(source) || source.includes('низ')) return 'low';
  return fallback;
}

export function getUrgencyPercent(priorityScore, severity) {
  const numeric = Number(priorityScore);
  if (Number.isFinite(numeric)) return clamp(Math.round(numeric), 0, 100);
  const severityKey = normalizeSeverityKey(severity);
  if (severityKey === 'critical') return 92;
  if (severityKey === 'high') return 74;
  if (severityKey === 'low') return 24;
  return 52;
}

export function getAIDossier(source = {}) {
  const severityKey = normalizeSeverityKey(source.severity);
  const suggestedRole = normalizeSuggestedResponsibleRole(
    source.suggested_responsible_role,
    normalizeSuggestedResponsibleRole(source.responsible_role, source.reporter_role === 'business' ? 'shared' : 'government')
  );
  const confidenceKey = normalizeConfidenceLabel(source.confidence_label, source.image_url || source.image ? 'high' : 'medium');
  const diagnosisTitle =
    toNonEmptyString(source.detected_issue_title)
    || toNonEmptyString(source.title)
    || TYPE_LABELS[toNonEmptyString(source.type)?.toLowerCase()]
    || 'AI triage кейса';

  const aiComment = toNonEmptyString(source.ai_comment);
  const riskFor = toNonEmptyString(source.risk_for);
  const recommendedAction = toNonEmptyString(source.recommended_action);
  const estimatedFixTime = toNonEmptyString(source.estimated_fix_time);
  const responsibleDept = toNonEmptyString(source.responsible_dept);
  const priorityScore = getUrgencyPercent(source.priority_score, severityKey);

  const hasTriage = Boolean(
    aiComment
    || toNonEmptyString(source.detected_issue_title)
    || riskFor
    || recommendedAction
    || source.priority_score != null
    || toNonEmptyString(source.confidence_label)
    || toNonEmptyString(source.suggested_responsible_role)
  );

  return {
    hasTriage,
    diagnosisTitle,
    aiComment,
    riskFor,
    recommendedAction,
    estimatedFixTime,
    responsibleDept,
    duplicateLikely: Boolean(source.duplicate_likely),
    priorityScore,
    severity: AI_SEVERITY_META[severityKey] ?? AI_SEVERITY_META.medium,
    confidence: AI_CONFIDENCE_META[confidenceKey] ?? AI_CONFIDENCE_META.medium,
    suggestedRoleKey: suggestedRole,
    suggestedRole: AI_ROUTE_META[suggestedRole] ?? AI_ROUTE_META.government,
  };
}
