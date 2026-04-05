import { getAssignedOrgName, getResponsibleRole, isSharedCase } from './reportCollaboration';

export const RESPONSIBILITY_MODE_META = {
  warranty_contractor: {
    label: 'Гарантийный подряд',
    caption: 'Объект ещё на гарантии подрядчика',
    color: '#0f766e',
    bg: '#ccfbf1',
    border: '#99f6e4',
  },
  operator: {
    label: 'Эксплуатация',
    caption: 'Исполнение по сервисному контуру ТОО',
    color: '#0284c7',
    bg: '#e0f2fe',
    border: '#bae6fd',
  },
  government: {
    label: 'Акимат',
    caption: 'Кейс остаётся в государственном контуре',
    color: '#6366f1',
    bg: '#eef2ff',
    border: '#c7d2fe',
  },
  shared: {
    label: 'Совместно',
    caption: 'Нужен общий выезд с акиматом',
    color: '#a16207',
    bg: '#fef3c7',
    border: '#fde68a',
  },
  disputed: {
    label: 'Спорная зона',
    caption: 'Нужно подтвердить ответственность',
    color: '#b91c1c',
    bg: '#fef2f2',
    border: '#fecaca',
  },
};

export const WORK_ORDER_STATUS_META = {
  assigned: {
    label: 'Новое назначение',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  accepted: {
    label: 'В работе',
    color: '#d97706',
    bg: '#fff7ed',
    border: '#fed7aa',
  },
  blocked: {
    label: 'Ждёт акимат',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
  },
  disputed: {
    label: 'Оспорено',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
  },
  completed: {
    label: 'На верификации',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  verified: {
    label: 'Подтверждено',
    color: '#15803d',
    bg: '#dcfce7',
    border: '#86efac',
  },
};

export const PROOF_STATUS_META = {
  not_required: {
    label: 'Proof не нужен',
    color: '#64748b',
    bg: '#f8fafc',
    border: '#e2e8f0',
  },
  required: {
    label: 'Нужно фото after',
    color: '#d97706',
    bg: '#fff7ed',
    border: '#fed7aa',
  },
  uploaded: {
    label: 'Proof загружен',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  verified: {
    label: 'Proof подтверждён',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
};

function toTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function getContractorOrgName(report) {
  return report?.contractor_org_name || getAssignedOrgName(report) || null;
}

export function inferResponsibilityMode(report) {
  const explicit = report?.responsibility_mode;
  if (explicit && RESPONSIBILITY_MODE_META[explicit]) return explicit;
  if (isSharedCase(report)) return 'shared';

  const responsibleRole = getResponsibleRole(report);
  if (responsibleRole === 'business') {
    const warrantyUntil = toTimestamp(report?.warranty_until);
    if (warrantyUntil && warrantyUntil.getTime() >= Date.now()) {
      return 'warranty_contractor';
    }
    return 'operator';
  }

  return 'government';
}

export function getResponsibilityModeMeta(report) {
  return RESPONSIBILITY_MODE_META[inferResponsibilityMode(report)] ?? RESPONSIBILITY_MODE_META.operator;
}

export function inferWorkOrderStatus(report) {
  const explicit = report?.work_order_status;
  if (explicit && WORK_ORDER_STATUS_META[explicit]) return explicit;

  if (report?.status === 'verified') return 'verified';
  if (report?.status === 'resolved') return 'completed';
  if (report?.status === 'waiting_partner') return 'blocked';
  if (report?.status === 'rejected') return 'disputed';
  if (report?.status === 'in_progress') return 'accepted';
  return 'assigned';
}

export function getWorkOrderStatusMeta(report) {
  return WORK_ORDER_STATUS_META[inferWorkOrderStatus(report)] ?? WORK_ORDER_STATUS_META.assigned;
}

export function inferProofStatus(report) {
  const explicit = report?.proof_status;
  if (explicit && PROOF_STATUS_META[explicit]) return explicit;
  if (report?.status === 'verified') return 'verified';
  if (report?.completion_image_url) return 'uploaded';

  const workOrderStatus = inferWorkOrderStatus(report);
  if (workOrderStatus === 'completed') return 'uploaded';

  const responsibility = getResponsibleRole(report);
  if (responsibility === 'business' || responsibility === 'shared') return 'required';
  return 'not_required';
}

export function getProofStatusMeta(report) {
  return PROOF_STATUS_META[inferProofStatus(report)] ?? PROOF_STATUS_META.required;
}

export function getSlaDueAt(report) {
  const explicit = toTimestamp(report?.sla_due_at);
  if (explicit) return explicit;

  const createdAt = toTimestamp(report?.created_at);
  const estimatedDays = Number(report?.estimated_resolution_days);
  if (!createdAt || !Number.isFinite(estimatedDays) || estimatedDays <= 0) return null;
  return addDays(createdAt, estimatedDays);
}

export function getDeadlineState(report) {
  const dueAt = getSlaDueAt(report);
  if (!dueAt) return { label: 'SLA уточняется', tone: 'neutral', dueAt: null };

  const diffHours = Math.round((dueAt.getTime() - Date.now()) / 3600000);
  if (diffHours < 0) {
    return { label: `Просрочено на ${Math.abs(diffHours)} ч`, tone: 'overdue', dueAt };
  }
  if (diffHours <= 24) {
    return { label: `До дедлайна ${diffHours} ч`, tone: 'risk', dueAt };
  }
  const diffDays = Math.max(1, Math.round(diffHours / 24));
  return { label: `${diffDays} д до SLA`, tone: 'ok', dueAt };
}

export function getDeadlineToneStyle(tone) {
  if (tone === 'overdue') return { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' };
  if (tone === 'risk') return { color: '#b45309', bg: '#fffbeb', border: '#fde68a' };
  if (tone === 'ok') return { color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' };
  return { color: '#475569', bg: '#f8fafc', border: '#e2e8f0' };
}

export function getLiabilityNarrative(report) {
  const mode = inferResponsibilityMode(report);
  const orgName = getContractorOrgName(report) || 'ТОО не назначено';
  const assetType = report?.asset_type || 'городской объект';
  const zone = report?.service_zone || report?.district || 'Алматы';
  const warrantyUntil = toTimestamp(report?.warranty_until);

  if (mode === 'warranty_contractor') {
    return `AI направил кейс подрядчику ${orgName}: ${assetType} находится в гарантийном контуре до ${warrantyUntil ? warrantyUntil.toLocaleDateString('ru-RU') : 'указанной даты'}.`;
  }
  if (mode === 'operator') {
    return `Исполнение закреплено за ${orgName}: объект обслуживается в сервисной зоне ${zone}.`;
  }
  if (mode === 'shared') {
    return `Нужен совместный сценарий: ${orgName} выполняет работы на месте, акимат подтверждает контур и фиксирует результат.`;
  }
  if (mode === 'disputed') {
    return `Ответственность спорная. ТОО и акимат должны подтвердить контур исполнения до начала работ.`;
  }
  return 'Кейс пока остаётся в государственном контуре и ждёт точного назначения исполнителя.';
}

export function getNextRequiredAction(report) {
  const workOrderStatus = inferWorkOrderStatus(report);
  const proofStatus = inferProofStatus(report);

  if (workOrderStatus === 'assigned') return 'Подтвердить приём задания и выставить бригаду.';
  if (workOrderStatus === 'blocked') return 'Оставить апдейт для акимата и дождаться согласования.';
  if (workOrderStatus === 'disputed') return 'Описать причину спора и приложить контур ответственности.';
  if (workOrderStatus === 'completed' && proofStatus !== 'verified') return 'Дождаться верификации результата и быть готовым к повторному выезду.';
  if (workOrderStatus === 'verified') return 'Кейс закрыт. Оставить в архиве для отчётности.';
  if (proofStatus === 'required') return 'Загрузить фото результата и короткий отчёт бригады.';
  return 'Держать работу в исполнении и обновлять таймлайн при каждом изменении.';
}
