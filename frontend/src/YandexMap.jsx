import { useEffect, useRef } from 'react';

/* ── SVG icon HTML strings (14px, stroke white) ── */
const ICONS = {
  road: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  lighting: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  waste: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  greenery: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  utilities: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V12m0 0a4 4 0 0 0 4-4V2H8v6a4 4 0 0 0 4 4z"/></svg>`,
  resolved: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  other: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

/* ── Mock pins for Almaty demonstration ── */
const MOCK_PINS = [
  {
    id: 'm1', coords: [43.2460, 76.8820], category: 'road', label: 'Яма',
    address: 'ул. Абая 42', severity: 'critical',
    ai: 'Глубокая выбоина 40×60 см на проезжей части. Требует срочного ямочного ремонта. Риск для подвески автомобилей высокий. Оценочный срок устранения: 2-3 дня.',
  },
  {
    id: 'm2', coords: [43.2340, 76.8960], category: 'lighting', label: 'Фонарь',
    address: 'пр. Достык 18', severity: 'high',
    ai: '3 фонарных столба не работают уже 12 дней. Создаёт опасность в ночное время. Ответственный: АО "Алматыэнергосбыт". Срок реакции: 5 дней.',
  },
  {
    id: 'm3', coords: [43.2410, 76.8760], category: 'waste', label: 'Свалка',
    address: 'ул. Тимирязева 5', severity: 'high',
    ai: 'Стихийная свалка объёмом ~3 м³. Нарушение санитарных норм. Требуется вывоз мусора и дезинфекция территории. Срок: 48 часов.',
  },
  {
    id: 'm4', coords: [43.2300, 76.9030], category: 'greenery', label: 'Граффити',
    address: 'ул. Гоголя 22', severity: 'medium',
    ai: 'Граффити на фасаде административного здания, площадь ~8 м². Ухудшает эстетику квартала. Рекомендуется очистка или перекраска. Срок: 7 дней.',
  },
  {
    id: 'm5', coords: [43.2490, 76.9010], category: 'resolved', label: 'Решено',
    address: 'пр. Аль-Фараби 77', severity: 'resolved',
    ai: 'Проблема успешно устранена силами коммунальных служб за 18 часов. Отличный показатель работы ЖКХ Бостандыкского района.',
  },
  {
    id: 'm6', coords: [43.2390, 76.8880], category: 'road', label: 'Выбоина',
    address: 'ул. Байзакова 31', severity: 'medium',
    ai: 'Множественные трещины асфальта на участке 15 м². Рекомендован плановый ремонт в течение 7 дней до ухудшения состояния.',
  },
];

function makePinHtml(pin, idx) {
  const icon = ICONS[pin.category] ?? ICONS.other;
  const i = idx % 6;
  return `
    <div class="ypin ypin${i}" style="
      display:flex;flex-direction:column;align-items:center;
      cursor:pointer;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.3));
    ">
      <div style="
        background:rgba(15,15,15,0.88);
        backdrop-filter:blur(12px);
        -webkit-backdrop-filter:blur(12px);
        border:1px solid rgba(255,255,255,0.15);
        border-radius:10px;
        padding:5px 10px;
        display:flex;align-items:center;gap:6px;
        white-space:nowrap;
      ">
        ${icon}
        <span style="color:white;font-size:11px;font-weight:600;
          font-family:'DM Sans',system-ui,sans-serif;letter-spacing:0.2px;">
          ${pin.label}
        </span>
      </div>
      <div style="width:2px;height:7px;background:rgba(15,15,15,0.85);"></div>
      <div style="width:0;height:0;
        border-left:4px solid transparent;
        border-right:4px solid transparent;
        border-top:5px solid rgba(15,15,15,0.85);
      "></div>
    </div>
  `;
}

function makeBalloon(pin) {
  return `
    <div style="
      font-family:'DM Sans',system-ui,sans-serif;
      min-width:240px;max-width:280px;
      background:#0f0f0f;border-radius:12px;
      overflow:hidden;
    ">
      <div style="padding:14px 16px;">
        <div style="font-size:13px;font-weight:700;color:white;margin-bottom:4px;">
          ${pin.label}
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:10px;">
          📍 ${pin.address}
        </div>
        <div style="
          background:rgba(255,255,255,0.07);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:8px;padding:10px;
          font-size:12px;color:rgba(255,255,255,0.8);line-height:1.55;
        ">
          ${pin.ai}
        </div>
      </div>
    </div>
  `;
}

export default function YandexMap({ reports }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ymaps || !containerRef.current) return;

    window.ymaps.ready(() => {
      if (mapRef.current) return;

      const map = new window.ymaps.Map(
        containerRef.current,
        { center: [43.238949, 76.889709], zoom: 13, controls: ['zoomControl'] },
        { suppressMapOpenBlock: true }
      );
      mapRef.current = map;

      MOCK_PINS.forEach((pin, idx) => {
        const Layout = window.ymaps.templateLayoutFactory.createClass(makePinHtml(pin, idx));

        const pm = new window.ymaps.Placemark(
          pin.coords,
          {
            balloonContentHeader: '',
            balloonContentBody: makeBalloon(pin),
            balloonContentFooter: '',
          },
          {
            iconLayout: Layout,
            iconOffset: [-55, -44],
            iconShape: { type: 'Rectangle', coordinates: [[0, 0], [110, 44]] },
            balloonPanelMaxMapArea: 0,
          }
        );

        map.geoObjects.add(pm);
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
