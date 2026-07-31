// ============================================================================
// DBTYCS — Insulina Activa (IOB + Actividad en tiempo real)
//
// Muestra DOS cosas distintas, calculadas para basal y rápida por separado:
//
//   1) IOB (Insulina Activa): cuántas unidades de la dosis todavía no
//      terminaron de metabolizarse. Empieza en el 100% de la dosis apenas
//      te la aplicás y baja hasta 0 con el tiempo.
//
//   2) Actividad actual: cuánto está bajando tu glucemia EN ESTE MOMENTO.
//      A diferencia del IOB, arranca en 0 (recién inyectada no hizo efecto
//      todavía), sube hasta un pico, y vuelve a bajar a 0. Junto a este
//      valor se muestra una flecha de tendencia (↑ subiendo / → estable /
//      ↓ bajando), calculada proyectando la misma curva 5 minutos hacia
//      adelante — no hace falta esperar para saber para dónde va.
//
// Usa el modelo exponencial de curva de insulina publicado por la comunidad
// OpenAPS/Loop (peak time + duración de acción). Es una ESTIMACIÓN
// matemática, no una medición real — la absorción real varía por sitio de
// inyección, temperatura, actividad física, etc. El mismo modelo se usa
// para basal y rápida, cambiando solo los minutos al pico y la duración
// según la marca configurada en el perfil.
// ============================================================================

const INSULINA_ACTIVA_KEY_PERFIL = 'dbtycs_perfil';
const INSULINA_ACTIVA_KEY_LOG = 'dbtycs_insulina';
const PASO_TENDENCIA_MIN = 5; // minutos hacia adelante para calcular la flecha

// Perfiles de RÁPIDA: peakMin = minutos al pico, diaMin = duración total en minutos
const PERFILES_RAPIDA = [
  { match: ['fiasp'], peakMin: 55, diaMin: 300, nombre: 'Fiasp (ultra-rápida)' },
  { match: ['novorapid', 'novolog', 'humalog', 'apidra', 'lispro', 'aspart', 'glulisina'], peakMin: 75, diaMin: 300, nombre: 'Análoga rápida estándar' },
  { match: ['regular', 'corriente', 'actrapid', 'humulin r', 'cristalina'], peakMin: 150, diaMin: 480, nombre: 'Regular / Corriente (aproximado)' },
];
const DEFAULT_RAPIDA = { peakMin: 75, diaMin: 300, nombre: 'Genérica (asumida análoga estándar)' };

// Perfiles de BASAL: mismo modelo que la rápida, con pico mucho más suave
// y tardío (representa el ascenso gradual típico de las basales modernas;
// NPH es la excepción con un pico más marcado, ahí sí clínicamente real).
const PERFILES_BASAL = [
  { match: ['tresiba', 'degludec'], peakMin: 450, diaMin: 2520, nombre: 'Tresiba' },       // 42h, pico muy suave ~7.5h
  { match: ['toujeo'], peakMin: 360, diaMin: 1800, nombre: 'Toujeo' },                     // 30h, pico suave ~6h
  { match: ['lantus', 'glargina', 'glargine', 'basaglar'], peakMin: 360, diaMin: 1440, nombre: 'Lantus / glargina' }, // 24h, pico suave ~6h
  { match: ['levemir', 'detemir'], peakMin: 360, diaMin: 1200, nombre: 'Levemir' },        // 20h, pico moderado ~6h
  { match: ['nph', 'humulin n', 'novolin n'], peakMin: 420, diaMin: 960, nombre: 'NPH' },  // 16h, pico marcado ~7h (clínicamente real)
];
const DEFAULT_BASAL = { peakMin: 360, diaMin: 1440, nombre: 'Genérica (asumida 24hs)' };

function buscarPerfilInsulinaActiva(nombreConfigurado, tabla, porDefecto) {
  if (!nombreConfigurado) return porDefecto;
  const norm = nombreConfigurado.toLowerCase();
  const encontrado = tabla.find((p) => p.match.some((m) => norm.includes(m)));
  return encontrado || porDefecto;
}

// --- Modelo exponencial (OpenAPS/Loop) ---
// Devuelve { iob, actividad } para una dosis, en un momento dado.
function calcularCurvaExponencial(dosisUnidades, minutosTranscurridos, peakMin, diaMin) {
  if (minutosTranscurridos <= 0) return { iob: dosisUnidades, actividad: 0 };
  if (minutosTranscurridos >= diaMin) return { iob: 0, actividad: 0 };

  const tau = (peakMin * (1 - peakMin / diaMin)) / (1 - (2 * peakMin) / diaMin);
  const a = (2 * tau) / diaMin;
  const S = 1 / (1 - a + (1 + a) * Math.exp(-diaMin / tau));
  const t = minutosTranscurridos;

  const iobFraccion =
    1 - S * (1 - a) * ((Math.pow(t, 2) / (tau * diaMin * (1 - a)) - t / tau - 1) * Math.exp(-t / tau) + 1);

  const actividadFraccion = (S / Math.pow(tau, 2)) * t * (1 - t / diaMin) * Math.exp(-t / tau);

  return {
    iob: dosisUnidades * Math.max(0, Math.min(1, iobFraccion)),
    actividad: dosisUnidades * Math.max(0, actividadFraccion),
  };
}

function calcularParaTipo(aplicaciones, tipo, perfilCurva, ahora) {
  let iobTotal = 0;
  let actividadAhora = 0;
  let actividadFutura = 0;

  aplicaciones
    .filter((a) => a.tipo === tipo)
    .forEach((a) => {
      const fechaAplicacion = new Date(a.fechaHora);
      if (isNaN(fechaAplicacion.getTime())) return;

      const minutosTranscurridos = (ahora - fechaAplicacion) / 60000;
      if (minutosTranscurridos < 0) return; // aplicación cargada a futuro, se ignora

      const actual = calcularCurvaExponencial(a.unidades, minutosTranscurridos, perfilCurva.peakMin, perfilCurva.diaMin);
      const futura = calcularCurvaExponencial(a.unidades, minutosTranscurridos + PASO_TENDENCIA_MIN, perfilCurva.peakMin, perfilCurva.diaMin);

      iobTotal += actual.iob;
      actividadAhora += actual.actividad;
      actividadFutura += futura.actividad;
    });

  const UMBRAL_ESTABLE = 0.00015; // por debajo de esto, la consideramos "sin cambios"
  let tendencia = 'estable';
  if (actividadFutura - actividadAhora > UMBRAL_ESTABLE) tendencia = 'subiendo';
  else if (actividadAhora - actividadFutura > UMBRAL_ESTABLE) tendencia = 'bajando';

  return {
    iob: Math.round(iobTotal * 10) / 10,
    actividad: actividadAhora,
    tendencia,
  };
}

function calcularInsulinaActivaTotal() {
  let perfil = {};
  let aplicaciones = [];

  try {
    perfil = JSON.parse(localStorage.getItem(INSULINA_ACTIVA_KEY_PERFIL) || '{}');
  } catch (e) {
    console.error('No se pudo leer el perfil:', e);
  }

  try {
    aplicaciones = JSON.parse(localStorage.getItem(INSULINA_ACTIVA_KEY_LOG) || '[]');
  } catch (e) {
    console.error('No se pudieron leer las aplicaciones de insulina:', e);
  }

  const perfilRapida = buscarPerfilInsulinaActiva(perfil.insulinaRapida, PERFILES_RAPIDA, DEFAULT_RAPIDA);
  const perfilBasal = buscarPerfilInsulinaActiva(perfil.insulinaBasal, PERFILES_BASAL, DEFAULT_BASAL);

  const ahora = new Date();
  const rapida = calcularParaTipo(aplicaciones, 'rapida', perfilRapida, ahora);
  const basal = calcularParaTipo(aplicaciones, 'basal', perfilBasal, ahora);

  return {
    rapidaActiva: rapida.iob,
    rapidaTendencia: rapida.tendencia,
    basalActiva: basal.iob,
    basalTendencia: basal.tendencia,
    totalActiva: Math.round((rapida.iob + basal.iob) * 10) / 10,
    perfilRapidaNombre: perfilRapida.nombre,
    perfilBasalNombre: perfilBasal.nombre,
  };
}

// --- Widget de UI reutilizable ---
// Busca en el DOM los elementos con estos IDs y los actualiza si existen.
// Así el mismo script sirve tanto en index.html como en pages/insulinaactiva.html.

const TEXTOS_TENDENCIA = {
  subiendo: 'Efecto: ↑ subiendo hacia el pico',
  bajando: 'Efecto: ↓ bajando',
  estable: 'Efecto: → mínimo o nulo',
};

function actualizarWidgetInsulinaActiva() {
  const resultado = calcularInsulinaActivaTotal();

  const elRapida = document.getElementById('iaValorRapida');
  const elBasal = document.getElementById('iaValorBasal');
  const elTotal = document.getElementById('iaValorTotal');
  const elTendenciaRapida = document.getElementById('iaTendenciaRapida');
  const elTendenciaBasal = document.getElementById('iaTendenciaBasal');
  const elDetalle = document.getElementById('iaDetalleModelo');
  const elActualizado = document.getElementById('iaUltimaActualizacion');

  if (elRapida) elRapida.textContent = `${resultado.rapidaActiva} U`;
  if (elBasal) elBasal.textContent = `${resultado.basalActiva} U`;
  if (elTotal) elTotal.textContent = `${resultado.totalActiva} U`;

  if (elTendenciaRapida) {
    elTendenciaRapida.textContent = TEXTOS_TENDENCIA[resultado.rapidaTendencia];
    elTendenciaRapida.className = `ia-tendencia ia-tendencia-${resultado.rapidaTendencia}`;
  }
  if (elTendenciaBasal) {
    elTendenciaBasal.textContent = TEXTOS_TENDENCIA[resultado.basalTendencia];
    elTendenciaBasal.className = `ia-tendencia ia-tendencia-${resultado.basalTendencia}`;
  }

  if (elDetalle) {
    elDetalle.textContent = `Modelo: ${resultado.perfilRapidaNombre} (rápida) · ${resultado.perfilBasalNombre} (basal)`;
  }
  if (elActualizado) {
    elActualizado.textContent = `Actualizado ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  }
}

function inicializarWidgetInsulinaActiva() {
  // Si no existe ningún elemento del widget en esta página, no hacemos nada
  if (!document.getElementById('iaValorRapida') && !document.getElementById('iaValorBasal')) return;

  actualizarWidgetInsulinaActiva();
  setInterval(actualizarWidgetInsulinaActiva, 60000); // se refresca sola cada 1 minuto
}

document.addEventListener('DOMContentLoaded', inicializarWidgetInsulinaActiva);