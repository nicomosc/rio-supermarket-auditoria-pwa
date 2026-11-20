import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fechaCaracasDeInstante,
  getFechaOperativaCaracas,
  sumarDiasAFecha,
  ZONA_HORARIA_RIO,
} from '../src/lib/fechas.ts';
import { calcularPermisoEdicion } from '../src/lib/permisos.ts';
import {
  parsearCsv,
  normalizarCedula,
  analizarCsvPersonal,
  generarCsvPersonal,
} from '../src/lib/importarPersonalCsv.ts';

test('1. America/Caracas timezone: 23:30 VET (03:30 UTC siguiente día) permanece en el mismo día venezolano', () => {
  assert.equal(ZONA_HORARIA_RIO, 'America/Caracas');
  // 2026-04-19T03:30:00Z = 2026-04-18 23:30:00 en Caracas (UTC-4)
  const instanteNocheCaracas = new Date('2026-04-19T03:30:00.000Z');
  assert.equal(fechaCaracasDeInstante(instanteNocheCaracas), '2026-04-18');
  assert.equal(getFechaOperativaCaracas(0, instanteNocheCaracas), '2026-04-18');
  assert.equal(getFechaOperativaCaracas(-1, instanteNocheCaracas), '2026-04-17');
});

test('2. America/Caracas timezone: 00:05 VET (04:05 UTC) cruza exactamente a la medianoche 12:00 AM', () => {
  // 2026-04-19T04:05:00Z = 2026-04-19 00:05:00 en Caracas (UTC-4)
  const instanteMadrugadaCaracas = new Date('2026-04-19T04:05:00.000Z');
  assert.equal(fechaCaracasDeInstante(instanteMadrugadaCaracas), '2026-04-19');
  assert.equal(sumarDiasAFecha('2026-04-19', -2), '2026-04-17');
});

test('3. Regla de cierre automático por día y rol (ANALISTA vs COORDINADOR)', () => {
  const hoy = '2026-04-19';

  // Mismo día: analista puede editar
  const pMismoDiaAnalista = calcularPermisoEdicion('2026-04-19', 'ANALISTA', hoy);
  assert.equal(pMismoDiaAnalista.esMismoDia, true);
  assert.equal(pMismoDiaAnalista.cerradaAutomaticamentePorDia, false);
  assert.equal(pMismoDiaAnalista.editable, true);
  assert.equal(pMismoDiaAnalista.desbloqueadaPorJefe, false);

  // Día anterior: analista queda bloqueado automáticamente en modo Solo Vista
  const pAyerAnalista = calcularPermisoEdicion('2026-04-18', 'ANALISTA', hoy);
  assert.equal(pAyerAnalista.esMismoDia, false);
  assert.equal(pAyerAnalista.cerradaAutomaticamentePorDia, true);
  assert.equal(pAyerAnalista.editable, false);
  assert.equal(pAyerAnalista.desbloqueadaPorJefe, false);
  assert.ok(pAyerAnalista.etiquetaEstado.includes('Día Cerrado'));

  // Día anterior: Jefe Encargado / Coordinador tiene override habilitado
  const pAyerCoordinador = calcularPermisoEdicion('2026-04-18', 'COORDINADOR', hoy);
  assert.equal(pAyerCoordinador.esMismoDia, false);
  assert.equal(pAyerCoordinador.cerradaAutomaticamentePorDia, true);
  assert.equal(pAyerCoordinador.editable, true);
  assert.equal(pAyerCoordinador.desbloqueadaPorJefe, true);
});

test('4. Parser y Validador CSV de Personal (CREAR, ACTUALIZAR por cédula, ERROR de sucursal o duplicado)', () => {
  const sucursales = [
    { id: 1, codigo: 'RIO-JBA', nombre: 'Río Supermarket • Av. Juan Bautista Arismendi' },
    { id: 8, codigo: 'RIO-MAT', nombre: 'Río Supermarket • Maturín' },
  ];
  const existentes = [
    { tipo: 'ANALISTA', id: 101, cedula: 'V-12345678' },
  ];

  const csvTexto = '\uFEFF' + [
    'tipo;sucursal_codigo;nombre_completo;cedula;email;cargo;turno',
    'ANALISTA;RIO-JBA;Juan Pérez Nuevo;V-20111222;jperez@riosupermarket.com;Analista de Sistemas;MAÑANA',
    'ANALISTA;RIO-MAT;Analista Existente Actualizado;12.345.678;existente@riosupermarket.com;Analista Senior;TARDE',
    'JEFE;RIO-MAT;María Gómez;V-15999888;mgomez@riosupermarket.com;Jefe Encargado de Sucursal;',
    'ANALISTA;RIO-NOEXISTE;Pedro Error;V-99999999;perror@riosupermarket.com;Analista;MAÑANA',
    'ANALISTA;RIO-JBA;Duplicado En Archivo;V-20111222;;Analista;MAÑANA',
  ].join('\r\n');

  assert.equal(normalizarCedula('12.345.678'), 'V-12345678');

  const matriz = parsearCsv(csvTexto);
  assert.equal(matriz.length, 6);

  const resultado = analizarCsvPersonal(
    csvTexto,
    sucursales,
    existentes,
    (t) => t || 'MAÑANA'
  );
  assert.equal(resultado.errorGeneral, null);
  assert.equal(resultado.filas.length, 5);
  assert.equal(resultado.resumen.crear, 2); // Juan Pérez Nuevo + María Gómez
  assert.equal(resultado.resumen.actualizar, 1); // Analista Existente Actualizado (V-12345678)
  assert.equal(resultado.resumen.errores, 2); // RIO-NOEXISTE + Duplicado En Archivo

  assert.equal(resultado.filas[0].accion, 'CREAR');
  assert.equal(resultado.filas[1].accion, 'ACTUALIZAR');
  assert.equal(resultado.filas[1].idExistente, 101);
  assert.equal(resultado.filas[2].accion, 'CREAR');
  assert.equal(resultado.filas[3].accion, 'ERROR');
  assert.equal(resultado.filas[4].accion, 'ERROR');

  const exportado = generarCsvPersonal([
    {
      tipo: 'ANALISTA',
      sucursal_codigo: 'RIO-JBA',
      nombre_completo: 'Juan Pérez Nuevo',
      cedula: 'V-20111222',
      email: 'jperez@riosupermarket.com',
      cargo: 'Analista de Sistemas',
      turno: 'MAÑANA',
    },
  ]);
  assert.ok(exportado.includes('RIO-JBA'));
  assert.ok(exportado.includes('V-20111222'));
});
