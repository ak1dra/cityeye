import { buildGeoAnalytics } from './analytics.js';

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
    queue: 'Дорожный штаб района',
    districtLead: 'Дежурный аппарат акима района',
    escalation: 'Заместитель акима по инфраструктуре',
    defaultRoute: 'government',
    routeReason: 'Дорожные дефекты и вопросы уличной безопасности требуют реакции городских служб.',
  },
  lighting: {
    department: 'Контур уличного освещения',
    queue: 'Диспетчер освещения и подрядной сети',
    districtLead: 'Дежурный районный координатор',
    escalation: 'Руководитель инфраструктурного блока района',
    defaultRoute: 'government',
    routeReason: 'Проблемы освещения относятся к базовой городской инфраструктуре и ведутся акиматом.',
  },
  utilities: {
    department: 'Контур коммунальной инфраструктуры',
    queue: 'Аварийно-коммунальный штаб',
    districtLead: 'Дежурный по коммунальному контуру',
    escalation: 'Руководитель коммунального направления района',
    defaultRoute: 'government',
    routeReason: 'Коммунальные сети требуют городского исполнителя и аварийного контроля.',
  },
  greenery: {
    department: 'Контур благоустройства и озеленения',
    queue: 'Бригада благоустройства района',
    districtLead: 'Координатор районного благоустройства',
    escalation: 'Заместитель акима по благоустройству',
    defaultRoute: 'government',
    routeReason: 'Озеленение и благоустройство в городской среде обычно находятся в ведении акимата.',
  },
  waste: {
    department: 'Санитарный контур района',
    queue: 'Санитарный штаб и подрядный клининг',
    districtLead: 'Дежурный районного санитарного контура',
    escalation: 'Руководитель санитарного штаба района',
    defaultRoute: 'shared',
    routeReason: 'Санитарные кейсы часто находятся на стыке городской и подрядной ответственности.',
  },
  parking: {
    department: 'Контур городской мобильности',
    queue: 'Парковочный и уличный контроль',
    districtLead: 'Координатор мобильности района',
    escalation: 'Заместитель акима по транспортной инфраструктуре',
    defaultRoute: 'shared',
    routeReason: 'Парковочные кейсы требуют проверки режима пространства и назначенного исполнителя.',
  },
  vandal: {
    department: 'Контур районного благоустройства',
    queue: 'Штаб восстановления городской среды',
    districtLead: 'Дежурный районного аппарата',
    escalation: 'Районный штаб реагирования',
    defaultRoute: 'shared',
    routeReason: 'Повреждение среды часто требует участия владельца объекта и городской координации.',
  },
  other: {
    department: 'Дежурный triage-контур акимата',
    queue: 'Операционный triage-стол',
    districtLead: 'Дежурный аппарат акима района',
    escalation: 'Операционный руководитель смены',
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
      : report.status === 'waiting_partner' ? 18
        : report.status === 'in_progress' ? 6
          : 0;
  const duplicateBonus = report.duplicate_likely ? 4 : 0;
  return priority + statusBonus + duplicateBonus;
}

function isOpenStatus(status) {
  return !['resolved', 'verified', 'rejected'].includes(status);
}

function buildPriorityLabel(score) {
  if (score >= 90) return 'Эскалация в текущую смену';
  if (score >= 75) return 'Немедленная реакция';
  if (score >= 55) return 'Приоритетное реагирование';
  if (score >= 35) return 'Плановое реагирование';
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

function getRule(report = {}) {
  const type = normalizeProblemType(report.type ?? report.category);
  return DEPARTMENT_RULES[type] ?? DEPARTMENT_RULES.other;
}

function buildDepartment(report = {}, route) {
  const rule = getRule(report);
  const assignedOrg = toNonEmptyString(report.assigned_org_name);

  if (route === 'business') {
    return assignedOrg || 'Подрядчик / ТОО';
  }
  if (route === 'shared') {
    return assignedOrg ? `${rule.department} + ${assignedOrg}` : `${rule.department} + подрядчик / ТОО`;
  }
  return rule.department;
}

function buildDepartmentQueue(report = {}, route) {
  const rule = getRule(report);
  const assignedOrg = toNonEmptyString(report.assigned_org_name);

  if (route === 'business') {
    return assignedOrg ? `Контур исполнения ${assignedOrg}` : 'Контур подрядчика / ТОО';
  }
  if (route === 'shared') {
    return assignedOrg ? `${rule.queue} + ${assignedOrg}` : `${rule.queue} + подрядчик / ТОО`;
  }
  return rule.queue;
}

function buildControlMode(route) {
  if (route === 'shared') return 'Совместный контроль акимата и подрядчика';
  if (route === 'business') return 'Контроль исполнения через назначенного подрядчика';
  return 'Прямое городское исполнение';
}

function buildEscalationOwner(report = {}, route) {
  const rule = getRule(report);
  const assignedOrg = toNonEmptyString(report.assigned_org_name);

  if (route === 'business') {
    return assignedOrg ? `Координатор ${assignedOrg}` : 'Координатор подрядчика';
  }
  if (route === 'shared') {
    return assignedOrg ? `${rule.districtLead} + ${assignedOrg}` : `${rule.districtLead} + подрядчик`;
  }
  return rule.escalation;
}

function buildSlaTarget(report = {}, route) {
  const severity = normalizeSeverity(report.severity);
  const isShared = route === 'shared';
  const isBusiness = route === 'business';

  if (severity === 'critical') {
    if (isShared) return 'Реакция 2 часа, координация сторон в текущую смену';
    if (isBusiness) return 'Реакция 4 часа, подтверждение работ до конца суток';
    return 'Реакция 2 часа, выезд в текущую смену';
  }
  if (severity === 'high') {
    if (isShared) return 'Маршрут и исполнитель подтверждены до конца суток';
    if (isBusiness) return 'Подтверждение исполнения до конца суток';
    return 'Назначение и запуск работ в течение 24 часов';
  }
  if (severity === 'low') {
    return 'Включить в плановые работы в горизонте 7 дней';
  }
  return 'Подтвердить исполнителя и срок в горизонте 72 часов';
}

function buildReasoning(report = {}, route, department, queue, slaTarget) {
  const rule = getRule(report);
  const triageSignal = toNonEmptyString(report.ai_comment)
    ? 'AI triage уже зафиксировал приоритет и характер кейса.'
    : 'Кейс ещё требует уточняющего triage, но базовые routing rules уже применимы.';

  return `${rule.routeReason} ${triageSignal} Рабочая очередь: ${queue}. Контрольный SLA: ${slaTarget}. Рекомендуемый исполнитель: ${department}.`;
}

function buildNextActions(report = {}, route, department, queue, slaTarget) {
  const actions = [];
  const title = toNonEmptyString(report.detected_issue_title) || toNonEmptyString(report.type) || 'кейс';

  if (report.status === 'new') {
    actions.push(`Подтвердить маршрут исполнения для кейса "${title}".`);
    actions.push(`Назначить исполнителя в очереди "${queue}".`);
    actions.push(`Зафиксировать SLA: ${slaTarget}.`);
  } else if (report.status === 'waiting_partner') {
    actions.push('Снять блокировку shared-case и запросить действие второй стороны.');
    actions.push(`Подтвердить, что очередь "${queue}" приняла кейс в работу.`);
    actions.push(`Уточнить срок реакции по SLA: ${slaTarget}.`);
  } else if (report.status === 'in_progress') {
    actions.push(`Проверить прогресс по контуру "${queue}".`);
    actions.push(`Сверить исполнителя: ${department}.`);
    actions.push('Контролировать фотофиксацию результата до закрытия кейса.');
  } else if (report.status === 'resolved') {
    actions.push('Проверить качество закрытия кейса и убедиться, что фото результата приложено.');
    actions.push('При необходимости перевести кейс в verified после проверки.');
  } else {
    actions.push('Провести оперативный triage и назначить ответственный контур.');
  }

  if (route === 'shared') {
    actions.push('Добавить координационный комментарий для подрядчика.');
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

  return flags.slice(0, 5);
}

function buildReportTitle(report = {}) {
  return (
    toNonEmptyString(report.detected_issue_title)
    || toNonEmptyString(report.title)
    || TYPE_LABELS[normalizeProblemType(report.type ?? report.category)]
    || 'городской кейс'
  );
}

function buildHotspots(reports = []) {
  return buildGeoAnalytics(reports).hotspots.slice(0, 3);
}

export function buildReportGuidance(report = {}) {
  const route = inferRoute(report);
  const department = buildDepartment(report, route);
  const departmentQueue = buildDepartmentQueue(report, route);
  const controlMode = buildControlMode(route);
  const slaTarget = buildSlaTarget(report, route);
  const escalationOwner = buildEscalationOwner(report, route);
  const priorityScore = scoreReport(report);
  const title = buildReportTitle(report);
  const confidence = normalizeConfidence(report.confidence_label, report.image_url || report.image ? 'high' : 'medium');
  const riskLevel = buildRiskLevel(report);
  const nextActions = buildNextActions(report, route, department, departmentQueue, slaTarget);
  const oversightFlags = buildOversightFlags(report, route);
  const address = toNonEmptyString(report.address) || 'адрес уточняется';

  return {
    mode: 'report_guidance',
    executive_summary: `Кейс "${title}" по адресу ${address} лучше вести через контур "${route}" с постановкой в очередь "${departmentQueue}".`,
    recommended_department: department,
    recommended_route: route,
    department_queue: departmentQueue,
    control_mode: controlMode,
    sla_target: slaTarget,
    escalation_owner: escalationOwner,
    reasoning: buildReasoning(report, route, department, departmentQueue, slaTarget),
    risk_level: riskLevel,
    priority_label: buildPriorityLabel(priorityScore),
    confidence_label: confidence,
    next_actions: nextActions,
    oversight_flags: oversightFlags,
    hotspots: [],
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
  const hotspots = buildHotspots(openReports);

  const criticalOpen = openReports.filter(report => ['critical', 'high', 'КРИТИЧНО', 'ВЫСОКО'].includes(report.severity)).length;
  const sharedWaiting = openReports.filter(report => inferRoute(report) === 'shared' && ['new', 'waiting_partner'].includes(report.status)).length;
  const businessQueue = openReports.filter(report => inferRoute(report) === 'business').length;
  const waitingPartner = openReports.filter(report => report.status === 'waiting_partner').length;
  const unresolvedCount = openReports.length;
  const missingCompletion = openReports.filter(report => report.status === 'resolved' && !toNonEmptyString(report.completion_image_url)).length;

  const nextActions = [];
  if (criticalOpen > 0) nextActions.push(`Разобрать ${criticalOpen} кейсов высокого риска до конца смены.`);
  if (sharedWaiting > 0) nextActions.push(`Снять зависание по ${sharedWaiting} shared-case с участием подрядчика.`);
  if (businessQueue > 0) nextActions.push(`Проверить назначение исполнителя в ${businessQueue} кейсах подрядного контура.`);
  if (hotspots.length > 0) nextActions.push(`Усилить контроль по hotspot "${hotspots[0].label}".`);
  if (nextActions.length === 0) nextActions.push('Поддерживать текущий темп исполнения и контролировать новые поступления.');

  const oversightFlags = [];
  if (waitingPartner > 0) oversightFlags.push(`${waitingPartner} кейсов стоят в ожидании ответа партнёра.`);
  if (missingCompletion > 0) oversightFlags.push(`${missingCompletion} закрытых кейсов требуют фото-подтверждения.`);
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
      : `Сегодня в контуре акимата ${unresolvedCount} активных кейсов. ${criticalOpen} требуют приоритетной реакции, ${sharedWaiting} нуждаются в координации с подрядчиком.`,
    recommended_department: criticalOpen > 0 ? 'Дежурный triage-штаб и профильные городские контуры' : 'Операционный triage-стол акимата',
    recommended_route: null,
    department_queue: sharedWaiting > 0 ? 'Диспетчерский контур shared-case' : 'Операционный triage-стол',
    control_mode: 'Операционный контроль смены',
    sla_target: criticalOpen > 0 ? 'Критичные кейсы должны быть распределены в текущую смену' : 'Новые кейсы должны быть распределены в течение 24 часов',
    escalation_owner: criticalOpen > 0 ? 'Заместитель акима по инфраструктуре' : 'Дежурный руководитель смены',
    reasoning: 'Ассистент агрегирует severity, status, shared-case поля и routing rules, чтобы подсветить кейсы, очереди и точки эскалации для акимата.',
    risk_level: riskLevel,
    priority_label: buildPriorityLabel(criticalOpen > 0 ? 88 : unresolvedCount > 0 ? 58 : 20),
    confidence_label: 'high',
    next_actions: nextActions.slice(0, 4),
    oversight_flags: oversightFlags.slice(0, 5),
    hotspots,
    spotlight_reports: spotlightReports,
  };
}

export function getKnowledgeSnapshot() {
  return {
    departments: Object.entries(DEPARTMENT_RULES).map(([type, rule]) => ({
      type,
      issue_label: TYPE_LABELS[type],
      department: rule.department,
      queue: rule.queue,
      district_lead: rule.districtLead,
      escalation: rule.escalation,
      default_route: rule.defaultRoute,
      route_reason: rule.routeReason,
    })),
    sla_policy: {
      critical: '2 часа на реакцию, исполнение в текущую смену',
      high: 'до конца суток на назначение и запуск',
      medium: 'до 72 часов на исполнителя и срок',
      low: 'плановые работы в горизонте 7 дней',
    },
  };
}
