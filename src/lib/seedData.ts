export type TipoArea = 'OFICINA' | 'OPERATIVIDAD_FRESCOS' | 'CAJA_PISO' | 'INFRAESTRUCTURA';
export type EstadoInspeccion = 'EN_PROGRESO' | 'COMPLETADA';
export type EstadoItem = 'OK' | 'FALLA' | 'NA';
export type EstadoItemBusqueda = 'OK' | 'FALLA' | 'NA' | 'NO_MARCADO';

export interface Departamento {
  id: number;
  nombre: string;
  tipo_area: TipoArea;
  orden: number;
  activo: boolean;
}

export interface ChecklistItem {
  id: number;
  departamento_id: number;
  descripcion: string;
  orden: number;
  es_critico: boolean;
  activo: boolean;
}

export interface Inspeccion {
  id: string;
  codigo_caso: string;
  analista_nombre: string;
  turno: string;
  fecha_operativa: string; // YYYY-MM-DD
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: EstadoInspeccion;
  observaciones_manuales: string | null;
}

export interface InspeccionDetalle {
  id: number;
  inspeccion_id: string;
  item_id: number;
  estado: EstadoItem;
  observacion_item: string | null;
  evidencia_url: string | null;
  registrado_at: string;
}

export interface ReporteInspeccionRow {
  inspeccion_id: string;
  codigo_caso: string;
  analista_nombre: string;
  turno: string;
  fecha_operativa: string;
  estado_inspeccion: EstadoInspeccion;
  observaciones_manuales: string | null;
  departamento_id: number;
  departamento: string;
  tipo_area: TipoArea;
  departamento_orden: number;
  total_items: number;
  total_evaluados: number;
  total_ok: number;
  total_fallas: number;
  total_na: number;
  porcentaje_cumplimiento: number;
}

export interface BusquedaAuditoriaRow {
  inspeccion_id: string;
  codigo_caso: string;
  analista_nombre: string;
  turno: string;
  fecha_operativa: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado_inspeccion: EstadoInspeccion;
  observaciones_manuales: string | null;
  departamento_id: number;
  departamento_nombre: string;
  tipo_area: TipoArea;
  departamento_orden: number;
  item_id: number;
  item_descripcion: string;
  item_orden: number;
  es_critico: boolean;
  estado_item: EstadoItemBusqueda;
  observacion_item: string | null;
  evidencia_url: string | null;
  tiene_evidencia: boolean;
  registrado_at: string | null;
}

export interface AlertaReporteDiario {
  fecha_ayer: string;
  fecha_hoy: string;
  ayer_omitido: boolean;
  ayer_en_progreso: boolean;
  turno_actual_pendiente: boolean;
  caso_en_progreso: string | null;
  alerta_activa: boolean;
  mensaje: string;
}

export const DEPARTAMENTOS_SEED: Departamento[] = [
  { id: 1,  nombre: 'Gerencia',        tipo_area: 'OFICINA',              orden: 1,  activo: true },
  { id: 2,  nombre: 'Control',         tipo_area: 'OFICINA',              orden: 2,  activo: true },
  { id: 3,  nombre: 'Recaudación',     tipo_area: 'OFICINA',              orden: 3,  activo: true },
  { id: 4,  nombre: 'Insumo',          tipo_area: 'OFICINA',              orden: 4,  activo: true },
  { id: 5,  nombre: 'Auditoria',       tipo_area: 'OFICINA',              orden: 5,  activo: true },
  { id: 6,  nombre: 'Producción',      tipo_area: 'OPERATIVIDAD_FRESCOS', orden: 6,  activo: true },
  { id: 7,  nombre: 'Inventario',      tipo_area: 'OFICINA',              orden: 7,  activo: true },
  { id: 8,  nombre: 'Recepción',       tipo_area: 'INFRAESTRUCTURA',      orden: 8,  activo: true },
  { id: 9,  nombre: 'Carniceria',      tipo_area: 'OPERATIVIDAD_FRESCOS', orden: 9,  activo: true },
  { id: 10, nombre: 'Charcuteria',     tipo_area: 'OPERATIVIDAD_FRESCOS', orden: 10, activo: true },
  { id: 11, nombre: 'Panaderia',       tipo_area: 'OPERATIVIDAD_FRESCOS', orden: 11, activo: true },
  { id: 12, nombre: 'Frulevel',        tipo_area: 'OPERATIVIDAD_FRESCOS', orden: 12, activo: true },
  { id: 13, nombre: 'Linea de Caja',   tipo_area: 'CAJA_PISO',            orden: 13, activo: true },
  { id: 14, nombre: 'Piso de Venta',   tipo_area: 'CAJA_PISO',            orden: 14, activo: true },
  { id: 15, nombre: 'Sistemas',        tipo_area: 'INFRAESTRUCTURA',      orden: 15, activo: true },
  { id: 16, nombre: 'Seguridad CECOM', tipo_area: 'INFRAESTRUCTURA',      orden: 16, activo: true },
];

export const CHECKLIST_ITEMS_SEED: ChecklistItem[] = [
  // 1. Gerencia (Incluye explícitamente Tablet y Cashea individuales)
  { id: 101, departamento_id: 1, descripcion: 'Tablet de Gerencia (Carga, conectividad Wi-Fi y acceso a dashboard)', orden: 1, es_critico: true, activo: true },
  { id: 102, departamento_id: 1, descripcion: 'Dispositivo / Portal Cashea en Gerencia (Conciliación y estado en línea)', orden: 2, es_critico: true, activo: true },
  { id: 103, departamento_id: 1, descripcion: 'Estación de Trabajo PC Gerencia y Sistema ERP', orden: 3, es_critico: false, activo: true },
  { id: 104, departamento_id: 1, descripcion: 'Impresora Multifuncional de Gerencia (Tóner y red)', orden: 4, es_critico: false, activo: true },
  { id: 105, departamento_id: 1, descripcion: 'UPS de Respaldo Eléctrico en Oficina de Gerencia', orden: 5, es_critico: true, activo: true },

  // 2. Control
  { id: 201, departamento_id: 2, descripcion: 'Estación PC de Control y Monitoreo de Procesos', orden: 1, es_critico: true, activo: true },
  { id: 202, departamento_id: 2, descripcion: 'Reloj Biométrico de Control de Asistencia de Personal', orden: 2, es_critico: true, activo: true },
  { id: 203, departamento_id: 2, descripcion: 'Impresora de Reportes de Control Interno', orden: 3, es_critico: false, activo: true },
  { id: 204, departamento_id: 2, descripcion: 'Punto de Red LAN y UPS de Estación Control', orden: 4, es_critico: false, activo: true },

  // 3. Recaudación
  { id: 301, departamento_id: 3, descripcion: 'PC Principal de Bóveda y Sistema de Tesorería/Recaudación', orden: 1, es_critico: true, activo: true },
  { id: 302, departamento_id: 3, descripcion: 'Máquinas Contadoras y Validadoras de Efectivo', orden: 2, es_critico: true, activo: true },
  { id: 303, departamento_id: 3, descripcion: 'Impresora Térmica/Láser de Actas de Cierre de Caja', orden: 3, es_critico: true, activo: true },
  { id: 304, departamento_id: 3, descripcion: 'UPS de Respaldo en Cuarto de Recaudación', orden: 4, es_critico: true, activo: true },

  // 4. Insumo
  { id: 401, departamento_id: 4, descripcion: 'Computador de Control de Suministros e Insumos Internos', orden: 1, es_critico: false, activo: true },
  { id: 402, departamento_id: 4, descripcion: 'Impresora de Notas de Entrega y Etiquetas de Insumos', orden: 2, es_critico: false, activo: true },
  { id: 403, departamento_id: 4, descripcion: 'Escáner Lector de Código de Barras de Almacén Insumos', orden: 3, es_critico: false, activo: true },
  { id: 404, departamento_id: 4, descripcion: 'Conectividad LAN y Respaldo UPS de Insumo', orden: 4, es_critico: false, activo: true },

  // 5. Auditoria
  { id: 501, departamento_id: 5, descripcion: 'Estación de Trabajo de Auditoría y Consultas SQL/ERP', orden: 1, es_critico: true, activo: true },
  { id: 502, departamento_id: 5, descripcion: 'Enlace de Red Seguro y Acceso a Servidor de Históricos', orden: 2, es_critico: true, activo: true },
  { id: 503, departamento_id: 5, descripcion: 'Impresora Láser de Actas de Auditoría', orden: 3, es_critico: false, activo: true },
  { id: 504, departamento_id: 5, descripcion: 'UPS de Protección Eléctrica de Auditoría', orden: 4, es_critico: false, activo: true },

  // 6. Producción
  { id: 601, departamento_id: 6, descripcion: 'Balanza Industrial de Producción y Formulación', orden: 1, es_critico: true, activo: true },
  { id: 602, departamento_id: 6, descripcion: 'Impresora Térmica de Etiquetas de Lote y Vencimiento', orden: 2, es_critico: true, activo: true },
  { id: 603, departamento_id: 6, descripcion: 'Terminal PC de Registro de Órdenes de Producción y Mermas', orden: 3, es_critico: true, activo: true },
  { id: 604, departamento_id: 6, descripcion: 'Cobertura Wi-Fi Industrial en Área de Producción', orden: 4, es_critico: false, activo: true },

  // 7. Inventario
  { id: 701, departamento_id: 7, descripcion: 'Colectores de Datos Portátiles (PDT / Handhelds Zebra)', orden: 1, es_critico: true, activo: true },
  { id: 702, departamento_id: 7, descripcion: 'Estación PC de Sincronización de Inventario y Costos', orden: 2, es_critico: true, activo: true },
  { id: 703, departamento_id: 7, descripcion: 'Impresora Térmica de Habladores y Etiquetas de Anaquel', orden: 3, es_critico: true, activo: true },
  { id: 704, departamento_id: 7, descripcion: 'Cobertura de Antenas Access Point en Depósito', orden: 4, es_critico: false, activo: true },

  // 8. Recepción
  { id: 801, departamento_id: 8, descripcion: 'Báscula / Romana Electrónica de Recepción de Proveedores', orden: 1, es_critico: true, activo: true },
  { id: 802, departamento_id: 8, descripcion: 'Terminal PC de Entrada de Mercancía y Cruce de Facturas', orden: 2, es_critico: true, activo: true },
  { id: 803, departamento_id: 8, descripcion: 'Dispositivos Handheld de Verificación en Muelle de Carga', orden: 3, es_critico: true, activo: true },
  { id: 804, departamento_id: 8, descripcion: 'Impresora de Notas de Recepción y Retenciones', orden: 4, es_critico: false, activo: true },

  // 9. Carniceria
  { id: 901, departamento_id: 9, descripcion: 'Balanza Etiquetadora Principal de Carnicería (Red y PLU)', orden: 1, es_critico: true, activo: true },
  { id: 902, departamento_id: 9, descripcion: 'Balanza Etiquetadora Auxiliar de Carnicería', orden: 2, es_critico: true, activo: true },
  { id: 903, departamento_id: 9, descripcion: 'Cabezal Térmico y Nitidez de Código de Barras en Etiquetas', orden: 3, es_critico: true, activo: true },
  { id: 904, departamento_id: 9, descripcion: 'Sincronización de Precios por Red LAN/Wi-Fi en Carnicería', orden: 4, es_critico: false, activo: true },

  // 10. Charcuteria
  { id: 1001, departamento_id: 10, descripcion: 'Balanza Etiquetadora Mostrador Charcutería #1', orden: 1, es_critico: true, activo: true },
  { id: 1002, departamento_id: 10, descripcion: 'Balanza Etiquetadora Autoservicio Charcutería #2', orden: 2, es_critico: true, activo: true },
  { id: 1003, departamento_id: 10, descripcion: 'Cabezal Térmico y Lectura de Etiquetas de Peso Variable', orden: 3, es_critico: true, activo: true },
  { id: 1004, departamento_id: 10, descripcion: 'Sincronización de Catálogo PLU en Charcutería', orden: 4, es_critico: false, activo: true },

  // 11. Panaderia
  { id: 1101, departamento_id: 11, descripcion: 'Balanza Etiquetadora de Panadería y Pastelería', orden: 1, es_critico: true, activo: true },
  { id: 1102, departamento_id: 11, descripcion: 'Terminal de Punto de Comanda / Despacho de Barra', orden: 2, es_critico: true, activo: true },
  { id: 1103, departamento_id: 11, descripcion: 'Impresora Térmica de Tickets y Etiquetas de Panadería', orden: 3, es_critico: true, activo: true },
  { id: 1104, departamento_id: 11, descripcion: 'Conectividad de Red y Actualización de Precios PLU', orden: 4, es_critico: false, activo: true },

  // 12. Frulevel
  { id: 1201, departamento_id: 12, descripcion: 'Balanza Etiquetadora Frulevel #1 (Frutas y Hortalizas)', orden: 1, es_critico: true, activo: true },
  { id: 1202, departamento_id: 12, descripcion: 'Balanza Etiquetadora Frulevel #2', orden: 2, es_critico: true, activo: true },
  { id: 1203, departamento_id: 12, descripcion: 'Impresión Térmica de Códigos de Barra y Calibración de Peso', orden: 3, es_critico: true, activo: true },
  { id: 1204, departamento_id: 12, descripcion: 'Pantalla / Visor Digital y Red de Precios Frulevel', orden: 4, es_critico: false, activo: true },

  // 13. Linea de Caja (Incluye explícitamente Cashea individual)
  { id: 1301, departamento_id: 13, descripcion: 'Sistema y Terminales Cashea en Línea de Caja (Operatividad y QR)', orden: 1, es_critico: true, activo: true },
  { id: 1302, departamento_id: 13, descripcion: 'Puntos de Venta Bancarios (POS Inalámbricos e Integrados)', orden: 2, es_critico: true, activo: true },
  { id: 1303, departamento_id: 13, descripcion: 'Impresoras Fiscales de Línea de Caja (Cinta, puerto fiscal y Z)', orden: 3, es_critico: true, activo: true },
  { id: 1304, departamento_id: 13, descripcion: 'Terminales de Facturación POS, Teclados y Pantallas de Cajeros', orden: 4, es_critico: true, activo: true },
  { id: 1305, departamento_id: 13, descripcion: 'Escáneres Biópticos de Mesa y de Mano en Cajas', orden: 5, es_critico: true, activo: true },
  { id: 1306, departamento_id: 13, descripcion: 'UPS de Respaldo Eléctrico Individuales en Línea de Caja', orden: 6, es_critico: true, activo: true },

  // 14. Piso de Venta
  { id: 1401, departamento_id: 14, descripcion: 'Lectores Verificadores de Precios en Pasillos de Venta', orden: 1, es_critico: true, activo: true },
  { id: 1402, departamento_id: 14, descripcion: 'Antenas Wi-Fi Corporativas y de Clientes en Piso de Venta', orden: 2, es_critico: true, activo: true },
  { id: 1403, departamento_id: 14, descripcion: 'Pantallas Publicitarias Digital Signage y Precios', orden: 3, es_critico: false, activo: true },
  { id: 1404, departamento_id: 14, descripcion: 'Sistema de Audio Ambiental y Voceo IP en Piso de Venta', orden: 4, es_critico: false, activo: true },

  // 15. Sistemas
  { id: 1501, departamento_id: 15, descripcion: 'Servidores Principales, Base de Datos y Virtualización', orden: 1, es_critico: true, activo: true },
  { id: 1502, departamento_id: 15, descripcion: 'Rack Principal, Switches Core y Distribución Fibra/UTP', orden: 2, es_critico: true, activo: true },
  { id: 1503, departamento_id: 15, descripcion: 'Enlaces de Internet Dedicados (Principal + Failover Automático)', orden: 3, es_critico: true, activo: true },
  { id: 1504, departamento_id: 15, descripcion: 'Climatización de Cuarto de Servidores (Temperatura y Humedad)', orden: 4, es_critico: true, activo: true },
  { id: 1505, departamento_id: 15, descripcion: 'UPS Online Central de Cuarto de Datos y Banco de Baterías', orden: 5, es_critico: true, activo: true },
  { id: 1506, departamento_id: 15, descripcion: 'Ejecución de Backups Automáticos Locales y en Nube', orden: 6, es_critico: true, activo: true },

  // 16. Seguridad CECOM
  { id: 1601, departamento_id: 16, descripcion: 'Videowall y Estaciones de Monitoreo de Cámaras CCTV', orden: 1, es_critico: true, activo: true },
  { id: 1602, departamento_id: 16, descripcion: 'Grabadores NVR/DVR y Estado de Discos Duros de Grabación', orden: 2, es_critico: true, activo: true },
  { id: 1603, departamento_id: 16, descripcion: 'Repetidora y Radios de Comunicación (Walkie-Talkies CECOM)', orden: 3, es_critico: true, activo: true },
  { id: 1604, departamento_id: 16, descripcion: 'Central de Alarmas de Intrusión, Incendio y Control de Acceso', orden: 4, es_critico: true, activo: true },
  { id: 1605, departamento_id: 16, descripcion: 'UPS de Respaldo Eléctrico Dedicado para Seguridad CECOM', orden: 5, es_critico: true, activo: true },
];

// Generador de evidencias fotográficas simuladas en SVG Data URI para el modo Demo
export function buildDemoPhotoSvg(titulo: string, depto: string, codigoCaso: string, fecha: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
    </defs>
    <rect width="720" height="480" fill="url(#bg)"/>
    <rect x="24" y="24" width="672" height="432" rx="16" fill="#090d16" stroke="#334155" stroke-width="2"/>
    <rect x="44" y="44" width="210" height="32" rx="6" fill="#dc2626"/>
    <text x="58" y="65" fill="#ffffff" font-family="monospace" font-size="14" font-weight="bold">EVIDENCIA DE FALLA</text>
    <text x="670" y="65" text-anchor="end" fill="#94a3b8" font-family="monospace" font-size="13">${codigoCaso} • ${fecha}</text>
    <!-- Ilustración de equipo tecnológico -->
    <rect x="190" y="110" width="340" height="210" rx="12" fill="#1e293b" stroke="#475569" stroke-width="3"/>
    <rect x="215" y="132" width="290" height="130" rx="6" fill="#0f172a" stroke="#ef4444" stroke-width="2" stroke-dasharray="6,4"/>
    <circle cx="360" cy="182" r="24" fill="#ef4444" opacity="0.2"/>
    <path d="M360 166 L360 186 M360 194 L360 197" stroke="#f87171" stroke-width="4" stroke-linecap="round"/>
    <text x="360" y="232" text-anchor="middle" fill="#fca5a5" font-family="monospace" font-size="13" font-weight="bold">ALERTA DE HARDWARE / CONECTIVIDAD</text>
    <rect x="300" y="275" width="120" height="24" rx="4" fill="#334155"/>
    <text x="360" y="291" text-anchor="middle" fill="#e2e8f0" font-family="monospace" font-size="11">RÍO SUPERMARKET</text>
    <!-- Pie de foto con metadatos de cámara -->
    <rect x="44" y="350" width="632" height="84" rx="10" fill="#1e293b"/>
    <text x="64" y="378" fill="#38bdf8" font-family="sans-serif" font-size="14" font-weight="bold">DEPARTAMENTO: ${depto.toUpperCase()}</text>
    <text x="64" y="402" fill="#f8fafc" font-family="sans-serif" font-size="15">${titulo}</text>
    <text x="64" y="422" fill="#94a3b8" font-family="monospace" font-size="11">BUCKET: evidencias-auditoria • SIGNED URL (3600s) • CAM-MOBILE</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
