const TYPE_LABELS = {
  road: 'дорожная инфраструктура',
  lighting: 'уличное освещение',
  waste: 'санитарное состояние территории',
  greenery: 'благоустройство и озеленение',
  utilities: 'коммунальная инфраструктура',
  parking: 'парковочное пространство',
  vandal: 'вандализм и повреждение городской среды',
  other: 'городская инфраструктура',
};

const TYPE_ALIASES = new Map([
  ['road', 'road'],
  ['roads', 'road'],
  ['яма', 'road'],
  ['дорож', 'road'],
  ['lighting', 'lighting'],
  ['light', 'lighting'],
  ['освещ', 'lighting'],
  ['фонар', 'lighting'],
  ['waste', 'waste'],
  ['trash', 'waste'],
  ['мусор', 'waste'],
  ['свалк', 'waste'],
  ['greenery', 'greenery'],
  ['green', 'greenery'],
  ['зелен', 'greenery'],
  ['дерев', 'greenery'],
  ['utilities', 'utilities'],
  ['utility', 'utilities'],
  ['коммун', 'utilities'],
  ['вода', 'utilities'],
  ['канализ', 'utilities'],
  ['parking', 'parking'],
  ['парков', 'parking'],
  ['vandal', 'vandal'],
  ['вандал', 'vandal'],
  ['other', 'other'],
  ['другое', 'other'],
]);

const DEPARTMENT_RULES = {
  road: {
    department: 'Управление городской мобильности',
    defaultRoute: 'government',
    routeReason: 'Дорожные дефекты и вопросы уличной безопасности требуют реакции городских служб.',
  },
  lighting: {
    department: 'Служба уличного освещения',
    defaultRoute: 'government',
    routeReason: 'Проблемы освещения относятся к базовой городской инфраструктуре и ведутся акиматом.',
  },
  utilities: {
    department: 'Коммунальные службы города',
    defaultRoute: 'government',
    routeReason: 'Коммунальные сети требуют городского исполнителя и аварийного контроля.',
  },
  greenery: {
    department: 'Служба благоустройства и озеленения',
    defaultRoute: 'government',
    routeReason: 'Озеленение и благоустройство в городской среде обычно находятся в ведении акимата.',
  },
  waste: {
    department: 'Санитарная служба района',
    defaultRoute: 'shared',
    routeReason: 'Санитарные кейсы часто находятся на стыке городской и частной ответственности.',
  },
  parking: {
    department: 'Управление городской мобильности',
    defaultRoute: 'shared',
    routeReason: 'Парковочные кейсы требуют проверки режима пространства и балансодержателя.',
  },
  vandal: {
    department: 'Отдел благоустройства и балансодержатель',
    defaultRoute: 'shared',
    routeReason: 'Повреждение среды часто требует участия владельца объекта и городской координации.',
  },
  other: {
    department: 'Управление городской инфраструктуры',
    defaultRoute: 'government',
    routeReason: 'Кейс требует городского triage и назначения профильного департамента.',
  },
};

function toNonEmptyString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRole(value, fallback = 'government') {
  const source = toNonEmptyString(value)?.toLowerCase() || '';
  if (['government', 'business', 'shared'].includes(source)) return source;
  if (source.includes('аким')) return 'government';
  if (source.includes('бизнес') || source.includes('company') || source.includes('private')) return 'business';
  if (source.includes('совмест') || source.includes('joint')) return 'shared';
  return fallback;
}

export function normalizeProblemType(value) {
  const source = toNonEmptyString(value)?.toLowerCase() || '';

  if (TYPE_LABELS[source]) return source;

  for (const [marker, type] of TYPE_ALIASES.entries()) {
    if (source.includes(marker)) return type;
  }

  return 'other';
}

function normalizeSeverity(value) {
  const source = toNonEmptyString(value)?.toLowerCase() || '';
  if (source.includes('крит') || source === 'critical') return 'critical';
  if (source.includes('выс') || source === 'high') return 'high';
  if (source.includes('низ') || source === 'low') return 'low';
  return 'medium';
}

function normalizeConfidence(value, fallback = 'medium') {
  const source = toNonEmptyString(value)?.toLowerCase() || '';
  if (['high', 'medium', 'low'].includes(source)) return source;
  if (source.includes('выс')) return 'high';
  if (source.includes('низ')) return 'low';
  return fallback;
}

function severityWeight(report = {}) {
  const severity = normalizeSeverity(report.severity);
  if (severity === 'critical') return 100;
  if (severity === 'high') return 80;
  if (severity === 'low') return 20;
  return 55;
}

function scoreReport(report = {}) {
  const priorityScore = Number(report.priority_score);
  const priority = Number.isFinite(priorityScore) ? priorityScore : severityWeight(report);
  const statusBonus =
    report.status === 'new' ? 12
      : report.status === 'waiting_partner' ? 8
        : report.status === 'in_progress' ? 4
          : 0;
  return priority + statusBonus;
}

function isOpenStatus(status) {
  return !['resolved', 'verified', 'rejected'].includes(status);
}

function buildPriorityLabel(score) {
  if (score >= 85) return 'Немедленная реакция';
  if (score >= 65) return 'Приоритетное реагирование';
  if (score >= 40) return 'Плановое реагирование';
  return 'Наблюдение';
}

function buildRiskLevel(report = {}) {
  const severity = normalizeSeverity(report.severity);
  if (severity === 'critical') return 'critical';
  if (severity === 'high') return 'high';

  if (report.status === 'waiting_partner') return 'high';
  if (report.status === 'new') return 'medium';
  if (severity === 'low') return 'low';
  return 'medium';
}

function inferRoute(report = {}) {
  if (report.suggested_responsible_role) {
    return normalizeRole(report.suggested_responsible_role, 'government');
  }
  if (report.responsible_role) {
    return normalizeRole(report.responsible_role, 'government');
  }
  if (report.reporter_role === 'business' || report.user_email === 'business@cityeye.kz') {
    return 'shared';
  }

  const type = normalizeProblemType(report.type ?? report.category);
  return DEPARTMENT_RULES[type]?.defaultRoute ?? 'government';
}

function buildDepartment(report = {}, route) {
  const type = normalizeProblemType(report.type ?? report.category);
  const baseDepartment = DEPARTMENT_RULES[type]?.department ?? DEPARTMENT_RULES.other.department;
  const assignedOrg = toNonEmptyString(report.assigned_org_name);

  if (route === 'business') {
    return assignedOrg || 'Управляющая компания / частный балансодержатель';
  }
  if (route === 'shared') {
    return assignedOrg ? `${baseDepartment} + ${assignedOrg}` : `${baseDepartment} + частный балансодержатель`;
  }
  return baseDepartment;
}

function buildReasoning(report = {}, route, department) {
  const type = normalizeProblemType(report.type ?? report.category);
  const rule = DEPARTMENT_RULES[type] ?? DEPARTMENT_RULES.other;
  const triageSignal = toNonEmptyString(report.ai_comment)
    ? 'AI triage уже зафиксировал приоритет и характер кейса.'
    : 'Кейс ещё требует уточняющего triage, но базовые routing rules уже применимы.';

  return `${rule.routeReason} ${triageSignal} Рекомендуемый исполнитель: ${department}.`;
}

function buildNextActions(report = {}, route, department) {
  const actions = [];
  const title = toNonEmptyString(report.detected_issue_title) || toNonEmptyString(report.type) || 'кейс';

  if (report.status === 'new') {
    actions.push(`Подтвердить маршрут исполнения для кейса "${title}".`);
    actions.push(`Назначить исполнителя: ${department}.`);
    actions.push('Поставить кейс в работу и зафиксировать ожидаемый срок.');
  } else if (report.status === 'waiting_partner') {
    actions.push('Снять блокировку shared-case и запросить действие второй стороны.');
    actions.push(`Подтвердить, что ${department} получил задачу и срок реакции.`);
  } else if (report.status === 'in_progress') {
    actions.push('Проверить прогресс исполнения и наличие подтверждающих материалов.');
    actions.push('Контролировать фотофиксацию результата до закрытия кейса.');
  } else if (report.status === 'resolved') {
    actions.push('Проверить качество закрытия кейса и убедиться, что фото результата приложено.');
    actions.push('При необходимости перевести кейс в verified после проверки.');
  } else {
    actions.push('Провести оперативный triage и назначить ответственный контур.');
  }

  if (route === 'shared') {
    actions.push('Добавить координационный комментарий для частного сектора.');
  }

  return actions.slice(0, 4);
}

function buildOversightFlags(report = {}, route) {
  const flags = [];
  const priority = scoreReport(report);

  if (priority >= 85 && report.status === 'new') {
    flags.push('Критичный кейс остаётся без исполнителя.');
  }
  if (route !== 'government' && !toNonEmptyString(report.assigned_org_name)) {
    flags.push('Маршрут указывает на внешнего исполнителя, но организация не назначена.');
  }
  if (route === 'shared' && !toNonEmptyString(report.partner_comment)) {
    flags.push('Для shared-case нет координационного комментария.');
  }
  if (report.status === 'resolved' && !toNonEmptyString(report.completion_image_url)) {
    flags.push('Кейс закрыт без фото результата.');
  }
  if (report.duplicate_likely) {
    flags.push('Есть риск дублирования кейса, нужна сверка с похожими обращениями.');
  }
  if (report.status === 'waiting_partner') {
    flags.push('Кейс завис в ожидании ответа партнёра.');
  }

  return flags;
}

function buildReportTitle(report = {}) {
  return (
    toNonEmptyString(report.detected_issue_title)
    || toNonEmptyString(report.title)
    || TYPE_LABELS[normalizeProblemType(report.type ?? report.category)]
    || 'городской кейс'
  );
}

export function buildReportGuidance(report = {}) {
  const route = inferRoute(report);
  const department = buildDepartment(report, route);
  const priorityScore = scoreReport(report);
  const title = buildReportTitle(report);
  const confidence = normalizeConfidence(report.confidence_label, report.image_url || report.image ? 'high' : 'medium');
  const riskLevel = buildRiskLevel(report);
  const nextActions = buildNextActions(report, route, department);
  const oversightFlags = buildOversightFlags(report, route);
  const address = toNonEmptyString(report.address) || 'адрес уточняется';

  return {
    mode: 'report_guidance',
    executive_summary: `Кейс "${title}" по адресу ${address} лучше вести через контур "${route}" с назначением ${department}.`,
    recommended_department: department,
    recommended_route: route,
    reasoning: buildReasoning(report, route, department),
    risk_level: riskLevel,
    priority_label: buildPriorityLabel(priorityScore),
    confidence_label: confidence,
    next_actions: nextActions,
    oversight_flags: oversightFlags,
    spotlight_reports: [],
  };
}

function buildOverviewSpotlight(report = {}) {
  const route = inferRoute(report);
  const department = buildDepartment(report, route);
  const priorityScore = scoreReport(report);

  return {
    id: report.id,
    title: buildReportTitle(report),
    address: toNonEmptyString(report.address) || 'Адрес уточняется',
    status: report.status || 'new',
    priority_label: buildPriorityLabel(priorityScore),
    recommended_route: route,
    recommended_department: department,
  };
}

export function buildOverviewGuidance(reports = [], filters = {}) {
  const scopedReports = Array.isArray(reports) ? reports : [];
  const openReports = scopedReports.filter(report => isOpenStatus(report.status));
  const sorted = [...openReports].sort((left, right) => scoreReport(right) - scoreReport(left));
  const spotlightReports = sorted.slice(0, 3).map(buildOverviewSpotlight);

  const criticalOpen = openReports.filter(report => ['critical', 'high', 'КРИТИЧНО', 'ВЫСОКО'].includes(report.severity)).length;
  const sharedWaiting = openReports.filter(report => inferRoute(report) === 'shared' && ['new', 'waiting_partner'].includes(report.status)).length;
  const businessQueue = openReports.filter(report => inferRoute(report) === 'business').length;
  const waitingPartner = openReports.filter(report => report.status === 'waiting_partner').length;
  const unresolvedCount = openReports.length;

  const nextActions = [];
  if (criticalOpen > 0) nextActions.push(`Разобрать ${criticalOpen} кейсов с высоким риском до конца смены.`);
  if (sharedWaiting > 0) nextActions.push(`Снять зависание по ${sharedWaiting} shared-case с участием бизнеса.`);
  if (businessQueue > 0) nextActions.push(`Проверить назначение исполнителя в ${businessQueue} кейсах частного контура.`);
  if (nextActions.length === 0) nextActions.push('Поддерживать текущий темп исполнения и контролировать новые поступления.');

  const oversightFlags = [];
  if (waitingPartner > 0) oversightFlags.push(`${waitingPartner} кейсов стоят в ожидании ответа партнёра.`);
  if (spotlightReports.length === 0) oversightFlags.push('Активных кейсов в выбранной выборке не найдено.');

  const riskLevel =
    criticalOpen > 2 ? 'critical'
      : criticalOpen > 0 || waitingPartner > 0 ? 'high'
        : unresolvedCount > 0 ? 'medium'
          : 'low';

  const filterSummary = [];
  if (filters.status && filters.status !== 'all') filterSummary.push(`статус: ${filters.status}`);
  if (filters.severity && filters.severity !== 'all') filterSummary.push(`приоритет: ${filters.severity}`);
  if (filters.search) filterSummary.push(`поиск: ${filters.search}`);

  return {
    mode: 'dashboard_overview',
    executive_summary: filterSummary.length > 0
      ? `В текущей выборке ${unresolvedCount} активных кейсов. ${criticalOpen} требуют приоритетной реакции, ${sharedWaiting} относятся к совместному контуру.`
      : `Сегодня в контуре акимата ${unresolvedCount} активных кейсов. ${criticalOpen} требуют приоритетной реакции, ${sharedWaiting} нуждаются в координации с частным сектором.`,
    recommended_department: criticalOpen > 0 ? 'Дежурный triage и профильные городские службы' : null,
    recommended_route: null,
    reasoning: 'Ассистент агрегирует severity, status, shared-case поля и текущие routing rules, чтобы подсветить кейсы, требующие внимания акимата.',
    risk_level: riskLevel,
    priority_label: buildPriorityLabel(criticalOpen > 0 ? 85 : unresolvedCount > 0 ? 55 : 20),
    confidence_label: 'high',
    next_actions: nextActions,
    oversight_flags: oversightFlags,
    spotlight_reports: spotlightReports,
  };
}

export function getKnowledgeSnapshot() {
  return {
    departments: Object.entries(DEPARTMENT_RULES).map(([type, rule]) => ({
      type,
      issue_label: TYPE_LABELS[type],
      department: rule.department,
      default_route: rule.defaultRoute,
      route_reason: rule.routeReason,
    })),
  };
}
