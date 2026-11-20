// ============================================================================
// IMPORTACIÓN / EXPORTACIÓN CSV DE PERSONAL (Analistas y Jefes Encargados)
// Sin dependencias: acepta separador ',' o ';' (Excel en español), comillas,
// BOM UTF-8 y acentos. Probado con `node --test`.
// ============================================================================

export type TipoPersonal = 'ANALISTA' | 'JEFE';

export const COLUMNAS_CSV_PERSONAL = [
  'tipo',
  'sucursal_codigo',
  'nombre_completo',
  'cedula',
  'email',
  'cargo',
  'turno',
] as const;

export interface SucursalRef {
  id: number;
  codigo: string;
  nombre: string;
}

export interface PersonaExistenteRef {
  tipo: TipoPersonal;
  id: number;
  cedula?: string | null;
}

export interface FilaPersonalCsv {
  numeroFila: number; // número de línea en el archivo (1 = encabezado)
  tipo: TipoPersonal | null;
  sucursal_id: number | null;
  sucursal_nombre: string;
  nombre_completo: string;
  cedula: string | null;
  email: string | null;
  cargo: string;
  turno: string | null;
  accion: 'CREAR' | 'ACTUALIZAR' | 'ERROR';
  idExistente: number | null;
  errores: string[];
}

export interface ResultadoAnalisisCsv {
  filas: FilaPersonalCsv[];
  errorGeneral: string | null;
  resumen: { crear: number; actualizar: number; errores: number };
}

/** Divide el texto CSV en filas de celdas, respetando comillas dobles. */
export function parsearCsv(texto: string): string[][] {
  const limpio = texto.replace(/^\uFEFF/, '');
  const primeraLinea = limpio.split(/\r?\n/)[0] || '';
  const separador =
    (primeraLinea.match(/;/g) || []).length > (primeraLinea.match(/,/g) || []).length
      ? ';'
      : ',';

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let enComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          celda += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        celda += c;
      }
      continue;
    }
    if (c === '"') {
      enComillas = true;
    } else if (c === separador) {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else {
      celda += c;
    }
  }
  if (celda.length > 0 || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

function normalizarTexto(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function normalizarCedula(v: string): string | null {
  const limpio = v.toUpperCase().replace(/[\s.]/g, '');
  if (!limpio) return null;
  const m = limpio.match(/^([VEJPG])?-?(\d{5,10})$/);
  if (!m) return limpio;
  return `${m[1] || 'V'}-${m[2]}`;
}

function normalizarTipo(v: string): TipoPersonal | null {
  const t = normalizarTexto(v);
  if (['analista', 'analistas', 'analista de sistemas'].includes(t)) return 'ANALISTA';
  if (['jefe', 'jefes', 'jefe encargado', 'coordinador', 'gerente'].includes(t)) return 'JEFE';
  return null;
}

export function analizarCsvPersonal(
  texto: string,
  sucursales: SucursalRef[],
  existentes: PersonaExistenteRef[],
  normalizarTurno: (t: string) => string
): ResultadoAnalisisCsv {
  const vacio = { filas: [], resumen: { crear: 0, actualizar: 0, errores: 0 } };
  const filasRaw = parsearCsv(texto).filter((f) => f.some((c) => c.trim() !== ''));
  if (filasRaw.length < 2) {
    return { ...vacio, errorGeneral: 'El archivo no tiene filas de datos (solo encabezado o está vacío).' };
  }

  const encabezado = filasRaw[0].map((h) => normalizarTexto(h).replace(/\s+/g, '_'));
  const idx = (col: string) => encabezado.indexOf(col);
  const faltantes = ['tipo', 'sucursal_codigo', 'nombre_completo'].filter((c) => idx(c) === -1);
  if (faltantes.length > 0) {
    return {
      ...vacio,
      errorGeneral: `Faltan columnas obligatorias: ${faltantes.join(', ')}. Usa la plantilla descargable.`,
    };
  }

  const cedulasVistas = new Map<string, number>();
  const filas: FilaPersonalCsv[] = [];

  filasRaw.slice(1).forEach((celdas, i) => {
    const numeroFila = i + 2;
    const val = (col: string) => {
      const k = idx(col);
      return k === -1 ? '' : (celdas[k] ?? '').trim();
    };
    const errores: string[] = [];

    const tipo = normalizarTipo(val('tipo'));
    if (!tipo) errores.push(`Tipo inválido "${val('tipo')}" (usa ANALISTA o JEFE)`);

    const sucRaw = val('sucursal_codigo');
    const sucursal =
      sucursales.find((s) => s.codigo.toUpperCase() === sucRaw.toUpperCase()) ||
      (/^\d+$/.test(sucRaw) ? sucursales.find((s) => s.id === Number(sucRaw)) : undefined);
    if (!sucursal) errores.push(`Sucursal "${sucRaw}" no existe`);

    const nombre = val('nombre_completo').replace(/\s+/g, ' ');
    if (nombre.length < 3) errores.push('Nombre vacío o muy corto');

    const cedula = normalizarCedula(val('cedula'));
    const email = val('email').toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errores.push(`Email inválido "${email}"`);
    }

    let idExistente: number | null = null;
    if (cedula) {
      const previa = cedulasVistas.get(cedula);
      if (previa) {
        errores.push(`Cédula ${cedula} repetida (ya aparece en la fila ${previa})`);
      } else {
        cedulasVistas.set(cedula, numeroFila);
      }
      const existente = existentes.find(
        (p) => p.cedula && normalizarCedula(p.cedula) === cedula
      );
      if (existente) {
        if (tipo && existente.tipo !== tipo) {
          errores.push(`Cédula ${cedula} ya está registrada como ${existente.tipo}`);
        } else {
          idExistente = existente.id;
        }
      }
    }

    const turnoRaw = val('turno');
    const turno = tipo === 'ANALISTA' ? normalizarTurno(turnoRaw) : null;
    const cargo =
      val('cargo') ||
      (tipo === 'JEFE' ? 'Jefe Encargado de Tienda' : 'Analista de Sistemas');

    filas.push({
      numeroFila,
      tipo,
      sucursal_id: sucursal?.id ?? null,
      sucursal_nombre: sucursal?.nombre ?? sucRaw,
      nombre_completo: nombre,
      cedula,
      email,
      cargo,
      turno,
      accion: errores.length > 0 ? 'ERROR' : idExistente ? 'ACTUALIZAR' : 'CREAR',
      idExistente,
      errores,
    });
  });

  return {
    filas,
    errorGeneral: null,
    resumen: {
      crear: filas.filter((f) => f.accion === 'CREAR').length,
      actualizar: filas.filter((f) => f.accion === 'ACTUALIZAR').length,
      errores: filas.filter((f) => f.accion === 'ERROR').length,
    },
  };
}

function celdaCsv(v: string | null | undefined): string {
  const s = v ?? '';
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Genera un CSV con ';' (abre directo en Excel en español) y BOM UTF-8 para los acentos. */
export function generarCsvPersonal(
  filas: Array<{
    tipo: TipoPersonal;
    sucursal_codigo: string;
    nombre_completo: string;
    cedula?: string | null;
    email?: string | null;
    cargo?: string | null;
    turno?: string | null;
  }>
): string {
  const lineas = [COLUMNAS_CSV_PERSONAL.join(';')];
  for (const f of filas) {
    lineas.push(
      [f.tipo, f.sucursal_codigo, f.nombre_completo, f.cedula, f.email, f.cargo, f.turno]
        .map(celdaCsv)
        .join(';')
    );
  }
  return '\uFEFF' + lineas.join('\r\n') + '\r\n';
}
