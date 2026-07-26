document.addEventListener('DOMContentLoaded', () => {
  const perfilGuardado = localStorage.getItem('dbtycs_perfil') || localStorage.getItem('perfilDiabetes');
  let perfil = null;

  if (perfilGuardado) {
    try {
      perfil = JSON.parse(perfilGuardado);
    } catch (e) {
      console.error('Error al parsear el perfil:', e);
    }
  }

  // Saludo principal
  const saludoUsuario = document.getElementById('saludoUsuario');
  if (saludoUsuario) {
    if (perfil && perfil.nombre) {
      const primerNombre = perfil.nombre.split(' ')[0];
      saludoUsuario.textContent = `Hola, ${primerNombre}`;
    } else {
      saludoUsuario.textContent = 'Hola, Usuario';
    }
  }

  // Función auxiliar para calcular la edad exacta a partir de la fecha de nacimiento
  function calcularEdad(fechaNacimientoStr) {
    if (!fechaNacimientoStr) return null;
    const fechaNac = new Date(fechaNacimientoStr);
    if (isNaN(fechaNac.getTime())) return null;

    const hoy = new Date();
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const m = hoy.getMonth() - fechaNac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }
    return edad >= 0 ? edad : null;
  }

  // --- CALCULADORA DE INSULINA BASAL ---
  const btnIrBasal = document.getElementById('btnIrBasal');
  const modalBasal = document.getElementById('modalBasal');
  const btnCerrarModalBasal = document.getElementById('btnCerrarModalBasal');
  const btnCalcularBasalAccion = document.getElementById('btnCalcularBasalAccion');

  const lblPesoPerfil = document.getElementById('lblPesoPerfil');
  const lblActividadPerfil = document.getElementById('lblActividadPerfil');
  const resultadoBasalContainer = document.getElementById('resultadoBasalContainer');
  const valorDosisBasal = document.getElementById('valorDosisBasal');
  const detalleCalculoBasal = document.getElementById('detalleCalculoBasal');

  const basalContenidoNormal = document.getElementById('basalContenidoNormal');
  const basalAlertaFaltaDatos = document.getElementById('basalAlertaFaltaDatos');

  let pesoUsuario = null;
  let actividadLaboral = 'ligero';
  let deporteFrecuencia = 'ninguno';
  let patronesEspeciales = [];

  if (btnIrBasal) {
    btnIrBasal.addEventListener('click', () => {
      pesoUsuario = perfil ? (perfil.peso || perfil.pesoKg) : null;
      actividadLaboral = perfil ? (perfil.trabajo || 'ligero') : 'ligero';
      deporteFrecuencia = perfil ? (perfil.deporte || 'ninguno') : 'ninguno';
      patronesEspeciales = perfil && Array.isArray(perfil.patrones) ? perfil.patrones : [];

      if (!pesoUsuario) {
        if (basalContenidoNormal) basalContenidoNormal.style.display = 'none';
        if (basalAlertaFaltaDatos) basalAlertaFaltaDatos.style.display = 'block';
      } else {
        if (basalContenidoNormal) basalContenidoNormal.style.display = 'block';
        if (basalAlertaFaltaDatos) basalAlertaFaltaDatos.style.display = 'none';
        if (lblPesoPerfil) lblPesoPerfil.textContent = `${pesoUsuario} kg`;

        const textosActividad = {
          sedentario: 'Sedentario (Oficina / Poco movimiento)',
          ligero: 'Ligeramente activo',
          activo: 'Moderadamente activo',
          muy_activo: 'Muy activo / Trabajo pesado'
        };

        const textosDeporte = {
          ninguno: 'Sin ejercicio regular',
          '1_2': '1-2 veces por semana',
          '3_4': '3-4 veces por semana',
          '5_mas': '5+ veces por semana (Intenso)'
        };

        if (lblActividadPerfil) {
          let textoPatronesInfo = patronesEspeciales.length > 0 ? ` | Factores: ${patronesEspeciales.length}` : '';
          lblActividadPerfil.textContent = `${textosActividad[actividadLaboral] || 'Estándar'} | Deporte: ${textosDeporte[deporteFrecuencia] || 'Ninguno'}${textoPatronesInfo}`;
        }

        if (resultadoBasalContainer) resultadoBasalContainer.style.display = 'none';
      }

      if (modalBasal) modalBasal.classList.add('active');
    });
  }

  if (btnCerrarModalBasal) {
    btnCerrarModalBasal.addEventListener('click', () => {
      if (modalBasal) modalBasal.classList.remove('active');
    });
  }

  if (btnCalcularBasalAccion) {
    btnCalcularBasalAccion.addEventListener('click', () => {
      if (!pesoUsuario) return;

      let factorMin = 0.35;
      let factorMax = 0.50;

      if (actividadLaboral === 'sedentario') {
        factorMin += 0.05;
        factorMax += 0.05;
      } else if (actividadLaboral === 'muy_activo') {
        factorMin -= 0.05;
        factorMax -= 0.05;
      }

      if (deporteFrecuencia === '5_mas') {
        factorMin -= 0.08;
        factorMax -= 0.08;
      } else if (deporteFrecuencia === '3_4') {
        factorMin -= 0.04;
        factorMax -= 0.04;
      }

      if (patronesEspeciales.includes('fenomeno_alba') || patronesEspeciales.includes('estres')) {
        factorMin += 0.05;
        factorMax += 0.08;
      }
      if (patronesEspeciales.includes('ciclo_menstrual')) {
        factorMax += 0.05;
      }

      if (factorMin < 0.30) factorMin = 0.30;
      if (factorMax > 0.65) factorMax = 0.65;

      const dosisMinCalculada = pesoUsuario * factorMin;
      const dosisMaxCalculada = pesoUsuario * factorMax;

      const dosisMinFinal = Math.round(dosisMinCalculada * 2) / 2;
      const dosisMaxFinal = Math.round(dosisMaxCalculada * 2) / 2;

      if (valorDosisBasal) {
        valorDosisBasal.textContent = `Entre ${dosisMinFinal} y ${dosisMaxFinal} Unidades / día`;
      }

      if (detalleCalculoBasal) {
        detalleCalculoBasal.innerHTML = `
          Cálculo basado en tu peso de <strong>${pesoUsuario} kg</strong>, factor adaptado de <strong>${factorMin.toFixed(2)} a ${factorMax.toFixed(2)} u/kg</strong> (considerando actividad, deporte y factores especiales).<br>
          <em>Nota: Este rango orientativo te ayuda a evaluar valores lógicos. Valida siempre cualquier ajuste con tu médico tratante.</em>
        `;
      }

      if (resultadoBasalContainer) {
        resultadoBasalContainer.style.display = 'block';
      }
    });
  }

  // --- CALCULADORA DE INSULINA RÁPIDA ---
  const btnIrRapida = document.getElementById('btnIrRapida');
  const modalRapida = document.getElementById('modalRapida');
  const btnCerrarModalRapida = document.getElementById('btnCerrarModalRapida');
  const btnCalcularRapidaAccion = document.getElementById('btnCalcularRapidaAccion');

  const rapidaContenidoNormal = document.getElementById('rapidaContenidoNormal');
  const rapidaAlertaFaltaDatos = document.getElementById('rapidaAlertaFaltaDatos');

  const inputCarbs = document.getElementById('inputCarbs');
  const inputGlucemiaActual = document.getElementById('inputGlucemiaActual');
  const inputGlucemiaObjetivo = document.getElementById('inputGlucemiaObjetivo');

  const resultadoRapidaContainer = document.getElementById('resultadoRapidaContainer');
  const valorDosisRapida = document.getElementById('valorDosisRapida');
  const detalleCalculoRapida = document.getElementById('detalleCalculoRapida');

  if (btnIrRapida) {
    btnIrRapida.addEventListener('click', () => {
      const ratioIC = perfil ? perfil.ratioIC : null;

      if (!ratioIC) {
        if (rapidaContenidoNormal) rapidaContenidoNormal.style.display = 'none';
        if (rapidaAlertaFaltaDatos) rapidaAlertaFaltaDatos.style.display = 'block';
      } else {
        if (rapidaContenidoNormal) rapidaContenidoNormal.style.display = 'block';
        if (rapidaAlertaFaltaDatos) rapidaAlertaFaltaDatos.style.display = 'none';
        if (inputCarbs) inputCarbs.value = '';
        if (inputGlucemiaActual) inputGlucemiaActual.value = '';
        if (resultadoRapidaContainer) resultadoRapidaContainer.style.display = 'none';
      }

      if (modalRapida) modalRapida.classList.add('active');
    });
  }

  if (btnCerrarModalRapida) {
    btnCerrarModalRapida.addEventListener('click', () => {
      if (modalRapida) modalRapida.classList.remove('active');
    });
  }

  if (btnCalcularRapidaAccion) {
    btnCalcularRapidaAccion.addEventListener('click', () => {
      if (!perfil || !perfil.ratioIC) return;

      const gramosCarbs = parseFloat(inputCarbs.value) || 0;
      const ratioIC = Number(perfil.ratioIC);

      const unidadesCarbs = gramosCarbs / ratioIC;

      let unidadesCorreccion = 0;
      const glucemiaActual = parseFloat(inputGlucemiaActual.value);
      const glucemiaObjetivo = parseFloat(inputGlucemiaObjetivo.value) || 100;
      const isf = Number(perfil.factorCorreccion) || 0;

      let textoCorreccion = '';
      if (!isNaN(glucemiaActual) && isf > 0) {
        const diferenciaGlucemia = glucemiaActual - glucemiaObjetivo;
        unidadesCorreccion = diferenciaGlucemia / isf;
        textoCorreccion = `<br>Corrección por glucemia (${glucemiaActual} mg/dL vs objetivo ${glucemiaObjetivo}): <strong>${unidadesCorreccion >= 0 ? '+' : ''}${unidadesCorreccion.toFixed(1)} U</strong> (ISF: ${isf})`;
      }

      let dosisTotal = unidadesCarbs + unidadesCorreccion;
      if (dosisTotal < 0) dosisTotal = 0;

      const dosisRedondeada = Math.round(dosisTotal * 2) / 2;

      if (valorDosisRapida) {
        valorDosisRapida.textContent = `${dosisRedondeada} Unidades`;
      }

      if (detalleCalculoRapida) {
        detalleCalculoRapida.innerHTML = `
          Insulina para ${gramosCarbs} g de carbohidratos (Ratio I:C: ${ratioIC}): <strong>${unidadesCarbs.toFixed(1)} U</strong>
          ${textoCorreccion}<br>
          <em>Total exacto calculado: ${dosisTotal.toFixed(2)} U (redondeado a ${dosisRedondeada} U). Valida siempre con tu médico.</em>
        `;
      }

      if (resultadoRapidaContainer) {
        resultadoRapidaContainer.style.display = 'block';
      }
    });
  }

  // --- CALCULADORA DE RATIO I:C (Regla del 500) ---
  const btnIrRatioIC = document.getElementById('btnIrRatioIC');
  const modalRatioIC = document.getElementById('modalRatioIC');
  const btnCerrarModalRatioIC = document.getElementById('btnCerrarModalRatioIC');
  const btnCalcularRatioICAccion = document.getElementById('btnCalcularRatioICAccion');
  const btnAplicarRatioIC = document.getElementById('btnAplicarRatioIC');

  const inputDTDRatio = document.getElementById('inputDTDRatio');
  const resultadoRatioICContainer = document.getElementById('resultadoRatioICContainer');
  const valorRatioIC = document.getElementById('valorRatioIC');
  const detalleCalculoRatioIC = document.getElementById('detalleCalculoRatioIC');

  let ratioCalculado = null;

  if (btnIrRatioIC) {
    btnIrRatioIC.addEventListener('click', () => {
      if (inputDTDRatio) inputDTDRatio.value = '';
      if (resultadoRatioICContainer) resultadoRatioICContainer.style.display = 'none';
      if (modalRatioIC) modalRatioIC.classList.add('active');
    });
  }

  if (btnCerrarModalRatioIC) {
    btnCerrarModalRatioIC.addEventListener('click', () => {
      if (modalRatioIC) modalRatioIC.classList.remove('active');
    });
  }

  if (btnCalcularRatioICAccion) {
    btnCalcularRatioICAccion.addEventListener('click', () => {
      const dtd = parseFloat(inputDTDRatio.value);

      if (!dtd || dtd <= 0) {
        alert('Ingresá tu Dosis Total Diaria (basal + bolos) para calcular.');
        return;
      }

      // Regla del 500
      ratioCalculado = Math.round((500 / dtd) * 2) / 2;

      if (valorRatioIC) valorRatioIC.textContent = `1U cada ${ratioCalculado} g`;

      if (detalleCalculoRatioIC) {
        detalleCalculoRatioIC.innerHTML = `
          Con una DTD de <strong>${dtd} U/día</strong>: 500 ÷ ${dtd} = <strong>${ratioCalculado} g/U</strong> (Regla del 500).
        `;
      }

      if (resultadoRatioICContainer) resultadoRatioICContainer.style.display = 'block';
    });
  }

  if (btnAplicarRatioIC) {
    btnAplicarRatioIC.addEventListener('click', () => {
      if (ratioCalculado === null) return;

      const confirmado = confirm(
        `¿Confirmás que ya validaste este valor con tu médico?\n\nRatio I:C: 1U cada ${ratioCalculado}g\n\nEsto va a reemplazar el valor actual de tu ficha.`
      );
      if (!confirmado) return;

      const perfilActual = JSON.parse(localStorage.getItem('dbtycs_perfil') || '{}');
      perfilActual.ratioIC = ratioCalculado;
      perfilActual.actualizadoEn = new Date().toISOString();

      localStorage.setItem('dbtycs_perfil', JSON.stringify(perfilActual));
      perfil = perfilActual;

      alert('Listo, se actualizó tu Ratio I:C en la ficha médica.');
      if (modalRatioIC) modalRatioIC.classList.remove('active');
    });
  }

  // --- CALCULADORA DE FSI (Regla del 1800 / 1500) ---
  const btnIrFSI = document.getElementById('btnIrFSI');
  const modalFSI = document.getElementById('modalFSI');
  const btnCerrarModalFSI = document.getElementById('btnCerrarModalFSI');
  const btnCalcularFSIAccion = document.getElementById('btnCalcularFSIAccion');
  const btnAplicarFSI = document.getElementById('btnAplicarFSI');

  const inputDTDFSI = document.getElementById('inputDTDFSI');
  const resultadoFSIContainer = document.getElementById('resultadoFSIContainer');
  const valorFSI = document.getElementById('valorFSI');
  const detalleCalculoFSI = document.getElementById('detalleCalculoFSI');

  let fsiCalculado = null;

  if (btnIrFSI) {
    btnIrFSI.addEventListener('click', () => {
      if (inputDTDFSI) inputDTDFSI.value = '';
      if (resultadoFSIContainer) resultadoFSIContainer.style.display = 'none';
      if (modalFSI) modalFSI.classList.add('active');
    });
  }

  if (btnCerrarModalFSI) {
    btnCerrarModalFSI.addEventListener('click', () => {
      if (modalFSI) modalFSI.classList.remove('active');
    });
  }

  if (btnCalcularFSIAccion) {
    btnCalcularFSIAccion.addEventListener('click', () => {
      const dtd = parseFloat(inputDTDFSI.value);

      if (!dtd || dtd <= 0) {
        alert('Ingresá tu Dosis Total Diaria (basal + bolos) para calcular.');
        return;
      }

      const constanteFSI = 1800;

      fsiCalculado = Math.round((constanteFSI / dtd) * 2) / 2;

      if (valorFSI) valorFSI.textContent = `${fsiCalculado} mg/dL`;

      if (detalleCalculoFSI) {
        detalleCalculoFSI.innerHTML = `
          Con una DTD de <strong>${dtd} U/día</strong>: ${constanteFSI} ÷ ${dtd} = <strong>${fsiCalculado} mg/dL/U</strong> (Regla del ${constanteFSI}, para NovoRapid).
        `;
      }

      if (resultadoFSIContainer) resultadoFSIContainer.style.display = 'block';
    });
  }

  if (btnAplicarFSI) {
    btnAplicarFSI.addEventListener('click', () => {
      if (fsiCalculado === null) return;

      const confirmado = confirm(
        `¿Confirmás que ya validaste este valor con tu médico?\n\nFSI: ${fsiCalculado} mg/dL/U\n\nEsto va a reemplazar el valor actual de tu ficha.`
      );
      if (!confirmado) return;

      const perfilActual = JSON.parse(localStorage.getItem('dbtycs_perfil') || '{}');
      perfilActual.factorCorreccion = fsiCalculado;
      perfilActual.actualizadoEn = new Date().toISOString();

      localStorage.setItem('dbtycs_perfil', JSON.stringify(perfilActual));
      perfil = perfilActual;

      alert('Listo, se actualizó tu FSI en la ficha médica.');
      if (modalFSI) modalFSI.classList.remove('active');
    });
  }

  // --- MODAL FICHA MÉDICA ---
  const modalFicha = document.getElementById('modalFicha');
  const cardFichaMedica = document.getElementById('cardFichaMedica');
  const btnCerrarModal = document.getElementById('btnCerrarModal');
  const btnExportarPDF = document.getElementById('btnExportarPDF');
  const fichaDatos = document.getElementById('fichaDatos');

  if (cardFichaMedica) {
    cardFichaMedica.addEventListener('click', () => {
      renderFichaMedica();
      if (modalFicha) modalFicha.classList.add('active');
    });
  }

  if (btnCerrarModal) {
    btnCerrarModal.addEventListener('click', () => {
      if (modalFicha) modalFicha.classList.remove('active');
    });
  }

  function renderFichaMedica() {
    if (!fichaDatos) return;

    if (!perfil) {
      fichaDatos.innerHTML = '<p>No se encontraron datos registrados. Completa la configuración de perfil primero.</p>';
      return;
    }

    const fechaNac = perfil.fechaNacimiento || perfil.fechaNac || perfil.nacimiento;
    const edadCalculada = calcularEdad(fechaNac);
    const textoEdad = edadCalculada !== null ? `${edadCalculada} años` : (perfil.edad ? `${perfil.edad} años` : 'No especificado');

    const textosActividad = {
      sedentario: 'Sedentario',
      ligero: 'Ligeramente activo',
      activo: 'Moderadamente activo',
      muy_activo: 'Muy activo'
    };

    const items = [
      { label: 'Nombre Completo', val: perfil.nombre || 'No especificado' },
      { label: 'Edad', val: textoEdad },
      { label: 'Tipo de Diabetes', val: perfil.tipoDiabetes || 'No especificado' },
      { label: 'Altura', val: perfil.altura ? `${perfil.altura} cm` : 'No especificado' },
      { label: 'Peso Corporal', val: perfil.peso ? `${perfil.peso} kg` : 'No especificado' },
      { label: 'Actividad / Ocupación', val: textosActividad[perfil.trabajo] || 'No especificado' },
      { label: 'Método / Tratamiento', val: 'Insulinodependiente' },
      { label: 'Insulina Basal', val: perfil.insulinaBasal || 'No especificado' },
      { label: 'Insulina Rápida', val: perfil.insulinaRapida || 'No especificado' },
      { label: 'Ratio Carb', val: perfil.ratioIC ? `${perfil.ratioIC} g/U` : 'No especificado' },
      { label: 'Factor ISF', val: perfil.factorCorreccion ? `${perfil.factorCorreccion} mg/dL/U` : 'No especificado' }
    ];

    let html = '<div class="summary-list">';
    items.forEach(item => {
      html += `
        <div class="summary-item">
          <span class="label">${item.label}:</span>
          <span class="value">${item.val}</span>
        </div>
      `;
    });
    html += '</div>';

    fichaDatos.innerHTML = html;
  }

  // Exportar a PDF optimizado (Evita cortes y mantiene un diseño profesional prolijo)
  if (btnExportarPDF) {
    btnExportarPDF.addEventListener('click', () => {
      const contenido = document.getElementById('contenidoFichaMedica');
      if (!contenido) return;

      const nombreUsuario = (perfil && perfil.nombre) ? perfil.nombre : 'Paciente';

      // Configuración optimizada para escala correcta sin recortes y tamaño exacto en A4
      const opt = {
        margin: [10, 10, 10, 10], // Márgenes equilibrados en mm
        filename: `Ficha_Medica_${nombreUsuario.trim().replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          backgroundColor: '#182232' // Mantiene la estética oscura formal del panel
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // Oculta temporalmente los botones de acción para que no salgan en el PDF impreso
      const accionesModal = contenido.querySelector('.modal-actions');
      if (accionesModal) accionesModal.style.display = 'none';

      html2pdf().set(opt).from(contenido).save().then(() => {
        if (accionesModal) accionesModal.style.display = 'flex';
      }).catch(err => {
        console.error('Error generando PDF:', err);
        if (accionesModal) accionesModal.style.display = 'flex';
      });
    });
  }
});