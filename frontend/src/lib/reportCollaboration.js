import { BUSINESS_PROFILE } from './userProfile';

export const BUSINESS_ORG_NAME = BUSINESS_PROFILE.name;

export const REPORTER_ROLE_LABEL = {
  citizen: 'Гражданин',
  business: 'Частный сектор',
  government: 'Акимат',
};

export const RESPONSIBILITY_LABEL = {
  government: 'Акимат',
  business: 'Частный сектор',
  shared: 'Совместно',
};

export const RESPONSIBILITY_STYLE = {
  government: { color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  business: { color: '#0f766e', bg: '#ccfbf1', border: '#99f6e4' },
  shared: { color: '#a16207', bg: '#fef3c7', border: '#fde68a' },
};

export const REPORT_STATUS_LABEL = {
  new: 'Новый',
  triage: 'На рассмотрении',
  in_progress: 'В работе',
  waiting_partner: 'Ожидает партнёра',
  resolved: 'Решено',
  verified: 'Подтверждено',
  rejected: 'Отклонено',
};

function toNonEmptyString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getReporterRole(report) {
  if (report?.reporter_role) return report.reporter_role;
  if (report?.user_email === 'business@cityeye.kz') return 'business';
  if (report?.user_email === 'gov@cityeye.kz') return 'government';
  return 'citizen';
}

export function getResponsibleRole(report) {
  if (report?.responsible_role) return report.responsible_role;
  return getReporterRole(report) === 'business' ? 'shared' : 'government';
}

export function getAssignedOrgName(report) {
  if (report?.assigned_org_name) return report.assigned_org_name;
  const responsibleRole = getResponsibleRole(report);
  if (responsibleRole === 'business' || responsibleRole === 'shared') return BUSINESS_ORG_NAME;
  return null;
}

export function isSharedCase(report) {
  return Boolean(report?.shared_case) || getResponsibleRole(report) === 'shared';
}

export function getReporterName(report) {
  const reporterRole = getReporterRole(report);
  if (reporterRole === 'business') {
    return report?.reporter_org_name || report?.user_name || BUSINESS_ORG_NAME;
  }
  if (reporterRole === 'government') {
    return report?.user_name || 'Акимат';
  }
  return report?.user_name || 'Гражданин';
}

export function buildCollaborationFields(user) {
  const reporterRole = user?.role || 'citizen';
  const isBusiness = reporterRole === 'business';

  return {
    reporter_role: reporterRole,
    reporter_org_name: isBusiness ? (user?.name || BUSINESS_ORG_NAME) : null,
    responsible_role: isBusiness ? 'shared' : 'government',
    assigned_org_name: isBusiness ? (user?.name || BUSINESS_ORG_NAME) : null,
    shared_case: isBusiness,
  };
}

export function buildGovernmentRouteFields() {
  return {
    responsible_role: 'government',
    assigned_org_name: null,
    shared_case: false,
  };
}

export function buildBusinessRouteFields(orgName = BUSINESS_ORG_NAME) {
  return {
    responsible_role: 'business',
    assigned_org_name: orgName,
    shared_case: false,
  };
}

export function buildSharedRouteFields(orgName = BUSINESS_ORG_NAME) {
  return {
    responsible_role: 'shared',
    assigned_org_name: orgName,
    shared_case: true,
  };
}

export function isVisibleToBusiness(report, user) {
  if (user?.role !== 'business') return false;

  const orgName = user?.name || BUSINESS_ORG_NAME;
  return report?.user_email === user?.email
    || getReporterName(report) === orgName
    || getAssignedOrgName(report) === orgName;
}

export function getReportTimeline(report) {
  const status = report?.status ?? 'new';
  const reporterRole = getReporterRole(report);
  const responsibility = getResponsibleRole(report);
  const shared = isSharedCase(report);
  const assignedOrg = getAssignedOrgName(report);

  const createdLabel = reporterRole === 'business'
    ? 'Подано бизнесом'
    : reporterRole === 'government'
      ? 'Зарегистрировано акиматом'
      : 'Подано жителем';

  const routeLabel = shared
    ? 'Совместный контур'
    : responsibility === 'business'
      ? 'Передано бизнесу'
      : 'Ведёт акимат';

  const routeCaption = shared
    ? 'Обе стороны видят одну заявку и работают синхронно'
    : assignedOrg
      ? `Назначено: ${assignedOrg}`
      : 'Ответственный контур определён';

  const workLabel = status === 'waiting_partner' ? 'Ожидание партнёра' : 'В работе';
  const workCaption = status === 'waiting_partner'
    ? 'Нужен ответ или действие второй стороны'
    : REPORT_STATUS_LABEL[status] ?? 'Исполнение в процессе';

  const finishLabel = status === 'verified' ? 'Подтверждено' : 'Завершено';
  const finishCaption = report?.completion_image_url
    ? 'Фото результата приложено'
    : 'Ожидается фиксация результата';

  const currentStep = status === 'resolved' || status === 'verified'
    ? 'done'
    : status === 'in_progress' || status === 'waiting_partner'
      ? 'work'
      : 'route';

  const stepOrder = ['created', 'route', 'work', 'done'];

  return [
    { id: 'created', label: createdLabel, caption: getReporterName(report) },
    { id: 'route', label: routeLabel, caption: routeCaption },
    { id: 'work', label: workLabel, caption: workCaption },
    { id: 'done', label: finishLabel, caption: finishCaption },
  ].map(step => {
    const stepIndex = stepOrder.indexOf(step.id);
    const currentIndex = stepOrder.indexOf(currentStep);

    let state = 'upcoming';
    if (step.id === 'created') {
      state = 'complete';
    } else if (stepIndex < currentIndex) {
      state = 'complete';
    } else if (stepIndex === currentIndex) {
      state = 'current';
    }

    return { ...step, state };
  });
}

export function getPartnerComment(report) {
  return toNonEmptyString(report?.partner_comment);
}

export function buildPartnerCommentEntry(report, author, message) {
  const cleanMessage = toNonEmptyString(message);
  if (!cleanMessage) {
    return getPartnerComment(report);
  }

  const authorRoleLabel = REPORTER_ROLE_LABEL[author?.role] ?? 'Участник';
  const authorName = author?.name || authorRoleLabel;
  const timestamp = new Date().toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const entry = `${timestamp} · ${authorRoleLabel}: ${authorName}\n${cleanMessage}`;
  const previous = getPartnerComment(report);

  return previous ? `${entry}\n\n${previous}` : entry;
}
