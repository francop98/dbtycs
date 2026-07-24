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
            
            // 1. Dosis por carbohidratos
            const unidadesCarbs = gramosCarbs / ratioIC;

            // 2. Corrección opcional por glucemia actual
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

        const textosActividad = {
            sedentario: 'Sedentario',
            ligero: 'Ligeramente activo',
            activo: 'Moderadamente activo',
            muy_activo: 'Muy activo'
        };

        const items = [
            { label: 'Nombre Completo', val: perfil.nombre || 'No especificado' },
            { label: 'Tipo de Diabetes', val: perfil.tipoDiabetes || 'No especificado' },
            { label: 'Peso Corporal', val: perfil.peso ? `${perfil.peso} kg` : 'No especificado' },
            { label: 'Actividad / Ocupación', val: textosActividad[perfil.trabajo] || 'No especificado' },
            { label: 'Método / Tratamiento', val: perfil.metodo || 'No especificado' },
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

    // Exportar a PDF
    if (btnExportarPDF) {
        btnExportarPDF.addEventListener('click', () => {
            const contenido = document.getElementById('contenidoFichaMedica');
            if (!contenido) return;
            contenido.classList.add('pdf-export-mode');
            const nombreUsuario = (perfil && perfil.nombre) ? perfil.nombre : 'Paciente';
            const opt = {
                margin: 10,
                filename: `Ficha_Medica_${nombreUsuario.trim().replace(/\s+/g, '_')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(opt).from(contenido).save().then(() => {
                contenido.classList.remove('pdf-export-mode');
            }).catch(err => {
                console.error('Error generando PDF:', err);
                contenido.classList.remove('pdf-export-mode');
            });
        });
    }
});