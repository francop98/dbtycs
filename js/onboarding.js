// DBTYCS Onboarding Wizard
const PERFIL_KEY = 'dbtycs_perfil';
const TOTAL_STEPS = 8;

let currentStep = 1;

const seleccion = {
    tipoDiabetes: null,
    metodo: null,
    trabajo: null,
    deporte: null
};

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('onboardingForm');
    if (form) {
        form.addEventListener('submit', (e) => e.preventDefault());
    }

    precargarPerfilExistente();
    configurarOpciones('#tipoDiabetesGrid', 'tipoDiabetes');
    configurarOpciones('#metodoGrid', 'metodo');
    configurarOpciones('#trabajoGrid', 'trabajo');
    configurarOpciones('#deporteGrid', 'deporte');

    const btnSiguiente = document.getElementById('btnSiguiente');
    const btnAtras = document.getElementById('btnAtras');

    if (btnSiguiente) {
        btnSiguiente.addEventListener('click', (e) => {
            e.preventDefault();
            irSiguiente();
        });
    }

    if (btnAtras) {
        btnAtras.addEventListener('click', (e) => {
            e.preventDefault();
            irAtras();
        });
    }

    actualizarUI();
});

function calcularEdad(fechaNacimientoString) {
    if (!fechaNacimientoString) return null;
    const hoy = new Date();
    const fechaNac = new Date(fechaNacimientoString);

    if (isNaN(fechaNac.getTime())) return null;

    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mesDiff = hoy.getMonth() - fechaNac.getMonth();

    if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < fechaNac.getDate())) {
        edad--;
    }
    return edad;
}

function configurarOpciones(gridSelector, campo) {
    const container = document.querySelector(gridSelector);
    if (!container) return;

    container.querySelectorAll('.option-card').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            container.querySelectorAll('.option-card').forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
            seleccion[campo] = btn.dataset.value;
        });
    });
}

function irSiguiente() {
    if (!validarPasoActual()) return;

    if (currentStep === TOTAL_STEPS) {
        guardarPerfil();
        window.location.href = '../index.html';
        return;
    }

    if (currentStep === TOTAL_STEPS - 1) {
        renderResumen();
    }

    currentStep++;
    actualizarUI();
}

function irAtras() {
    if (currentStep <= 1) return;
    currentStep--;
    actualizarUI();
}

function validarPasoActual() {
    switch (currentStep) {
        case 1: {
            const nombre = document.getElementById('nombre')?.value?.trim();
            const fechaNac = document.getElementById('fechaNacimiento')?.value;
            const peso = document.getElementById('peso')?.value;
            const altura = document.getElementById('altura')?.value;

            if (!nombre || !fechaNac || !peso || !altura) {
                alert('Por favor, completá tu Nombre y Apellido, fecha de nacimiento, peso y altura para continuar.');
                return false;
            }
            return true;
        }

        case 2: {
            if (!seleccion.tipoDiabetes) {
                alert('Elegí el tipo de diabetes para continuar.');
                return false;
            }
            return true;
        }

        case 3: {
            if (!seleccion.metodo) {
                alert('Elegí cómo aplicás la insulina para continuar.');
                return false;
            }
            return true;
        }

        case 7: {
            if (!seleccion.trabajo || !seleccion.deporte) {
                alert('Por favor, seleccioná tu nivel de actividad laboral y frecuencia de ejercicio.');
                return false;
            }
            return true;
        }

        default:
            return true;
    }
}

function actualizarUI() {
    document.querySelectorAll('.step').forEach((step) => {
        const numStep = Number(step.dataset.step);
        if (numStep === currentStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });

    const stepText = `Paso ${currentStep} de ${TOTAL_STEPS}`;
    const stepRatio = `${currentStep}/${TOTAL_STEPS}`;

    const elCounterText = document.getElementById('stepCounterText');
    const elCounterFooter = document.getElementById('stepCounterFooter');
    const elDialLabel = document.getElementById('dialLabel');

    if (elCounterText) elCounterText.textContent = stepText;
    if (elCounterFooter) elCounterFooter.textContent = stepRatio;
    if (elDialLabel) elDialLabel.textContent = currentStep;

    const dialFill = document.getElementById('dialFill');
    if (dialFill) {
        const perimetro = 150.8;
        const progreso = currentStep / TOTAL_STEPS;
        dialFill.style.strokeDashoffset = perimetro * (1 - progreso);
    }

    const btnAtras = document.getElementById('btnAtras');
    const btnSiguiente = document.getElementById('btnSiguiente');

    if (btnAtras) btnAtras.style.visibility = (currentStep === 1) ? 'hidden' : 'visible';
    if (btnSiguiente) btnSiguiente.textContent = (currentStep === TOTAL_STEPS) ? 'Finalizar' : 'Siguiente';
}

function renderResumen() {
    const f = document.getElementById('onboardingForm');
    const patrones = f ? Array.from(f.querySelectorAll('input[name="patron"]:checked')).map((i) => i.value) : [];
    
    const etiquetasTipo = {
        tipo1: 'Diabetes Tipo 1',
        tipo2_insulina: 'Diabetes Tipo 2 con insulina',
        lada: 'Diabetes LADA',
        otro: 'Otro tipo de diabetes'
    };

    const etiquetasMetodo = {
        mdi: 'Múltiples inyecciones (MDI)',
        bomba: 'Bomba de insulina'
    };

    const etiquetasTrabajo = {
        sedentario: 'Sedentario (Oficina)',
        ligero: 'Ligeramente activo',
        activo: 'Moderadamente activo',
        muy_activo: 'Muy activo (Físico intenso)'
    };

    const etiquetasDeporte = {
        ninguno: 'Sin ejercicio regular',
        '1_2': '1 a 2 veces por semana',
        '3_4': '3 a 4 veces por semana',
        '5_mas': '5 o más veces por semana'
    };

    const etiquetasPatrones = {
        fenomeno_alba: 'Fenómeno del alba',
        sensibilidad_ejercicio: 'Sensibilidad al ejercicio',
        ciclo_menstrual: 'Ciclo menstrual',
        estres: 'Estrés / enfermedad'
    };

    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

    const fechaNac = getVal('fechaNacimiento');
    const edad = calcularEdad(fechaNac);

    const rMin = getVal('rangoMin') || '70';
    const rMax = getVal('rangoMax') || '180';
    const ratio = getVal('ratioIC');
    const factor = getVal('factorCorreccion');

    const filas = [
        ['Nombre y Apellido', getVal('nombre')],
        ['Fecha de Nacimiento', fechaNac ? `${fechaNac} (${edad !== null ? edad + ' años' : ''})` : ''],
        ['Peso', getVal('peso') ? `${getVal('peso')} kg` : ''],
        ['Altura', getVal('altura') ? `${getVal('altura')} cm` : ''],
        ['Diagnóstico', etiquetasTipo[seleccion.tipoDiabetes] || ''],
        ['Año de diagnóstico', getVal('anioDiagnostico') || ''],
        ['Método', etiquetasMetodo[seleccion.metodo] || ''],
        ['Insulina basal', getVal('insulinaBasal') || ''],
        ['Insulina rápida', getVal('insulinaRapida') || ''],
        ['Rango objetivo', `${rMin} - ${rMax} mg/dL`],
        ['Ratio I:C', ratio ? `1U cada ${ratio}g` : 'Sin definir'],
        ['Factor de corrección', factor ? `1U baja ${factor} mg/dL` : 'Sin definir'],
        ['Actividad laboral', etiquetasTrabajo[seleccion.trabajo] || 'Sin definir'],
        ['Ejercicio programado', etiquetasDeporte[seleccion.deporte] || 'Sin definir'],
        ['Patrones', patrones.length ? patrones.map((p) => etiquetasPatrones[p] || p).join(', ') : 'Ninguno indicado']
    ];

    const contenedor = document.getElementById('summaryList');
    if (contenedor) {
        contenedor.innerHTML = filas.map(([label, value]) => `
            <div class="summary-item">
                <span class="label">${label}</span>
                <span class="value">${value}</span>
            </div>
        `).join('');
    }
}

function guardarPerfil() {
    const f = document.getElementById('onboardingForm');
    const patrones = f ? Array.from(f.querySelectorAll('input[name="patron"]:checked')).map((i) => i.value) : [];

    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

    const perfilPrevio = JSON.parse(localStorage.getItem(PERFIL_KEY) || '{}');
    const perfil = {
        nombre: getVal('nombre'),
        fechaNacimiento: getVal('fechaNacimiento') || null,
        peso: getVal('peso') ? Number(getVal('peso')) : null,
        altura: getVal('altura') ? Number(getVal('altura')) : null,
        tipoDiabetes: seleccion.tipoDiabetes,
        anioDiagnostico: getVal('anioDiagnostico') || null,
        metodo: seleccion.metodo,
        insulinaBasal: getVal('insulinaBasal') || null,
        insulinaRapida: getVal('insulinaRapida') || null,
        rangoObjetivo: {
            min: Number(getVal('rangoMin')) || 70,
            max: Number(getVal('rangoMax')) || 180
        },
        ratioIC: getVal('ratioIC') ? Number(getVal('ratioIC')) : null,
        factorCorreccion: getVal('factorCorreccion') ? Number(getVal('factorCorreccion')) : null,
        trabajo: seleccion.trabajo,
        deporte: seleccion.deporte,
        patrones,
        creadoEn: perfilPrevio.creadoEn || new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
    };

    localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil));
}

function precargarPerfilExistente() {
    const guardado = localStorage.getItem(PERFIL_KEY);
    if (!guardado) return;

    try {
        const perfil = JSON.parse(guardado);

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val ?? '';
        };

        setVal('nombre', perfil.nombre);
        setVal('fechaNacimiento', perfil.fechaNacimiento);
        setVal('peso', perfil.peso);
        setVal('altura', perfil.altura);
        setVal('anioDiagnostico', perfil.anioDiagnostico);
        setVal('insulinaBasal', perfil.insulinaBasal);
        setVal('insulinaRapida', perfil.insulinaRapida);
        setVal('rangoMin', perfil.rangoObjetivo?.min ?? 70);
        setVal('rangoMax', perfil.rangoObjetivo?.max ?? 180);
        setVal('ratioIC', perfil.ratioIC);
        setVal('factorCorreccion', perfil.factorCorreccion);

        if (perfil.tipoDiabetes) {
            seleccion.tipoDiabetes = perfil.tipoDiabetes;
            const btn = document.querySelector(`#tipoDiabetesGrid .option-card[data-value="${perfil.tipoDiabetes}"]`);
            if (btn) btn.classList.add('selected');
        }

        if (perfil.metodo) {
            seleccion.metodo = perfil.metodo;
            const btn = document.querySelector(`#metodoGrid .option-card[data-value="${perfil.metodo}"]`);
            if (btn) btn.classList.add('selected');
        }

        if (perfil.trabajo) {
            seleccion.trabajo = perfil.trabajo;
            const btn = document.querySelector(`#trabajoGrid .option-card[data-value="${perfil.trabajo}"]`);
            if (btn) btn.classList.add('selected');
        }

        if (perfil.deporte) {
            seleccion.deporte = perfil.deporte;
            const btn = document.querySelector(`#deporteGrid .option-card[data-value="${perfil.deporte}"]`);
            if (btn) btn.classList.add('selected');
        }

        if (Array.isArray(perfil.patrones)) {
            perfil.patrones.forEach((valor) => {
                const input = document.querySelector(`input[name="patron"][value="${valor}"]`);
                if (input) input.checked = true;
            });
        }
    } catch (e) {
        console.error('No se pudo leer el perfil guardado:', e);
    }
}