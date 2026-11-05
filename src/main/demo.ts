// Pacientes de prueba ficticios, uno por perfil y con tres controles cada uno, para validar el sistema y para el recorrido automatizado.
// Se reconocen por el apellido terminado en "(prueba)" y se eliminan juntos. Las medidas son inventadas pero plausibles.
import type { Medidas } from '../calculo/antropometria'
import type { EstadoFisiologico } from '../calculo/gasto'
import { controlGuardar, pacienteEntrada, pautaVacia, type BloqueRutina, type PacienteFormulario, type Recordatorio } from '../shared/contratos'
import * as controles from './controles'
import type { DB } from './db'
import * as pacientes from './pacientes'

const MARCA = '(prueba)'

type Medicion = {
  diasAtras: number
  pesoKg: number
  tallaCm: number
  medidas: { [G in keyof Medidas]?: Medidas[G] }
  estado?: EstadoFisiologico
  semanaEmbarazo?: number
}
type Ficticio = {
  paciente: Partial<PacienteFormulario> & Pick<PacienteFormulario, 'nombres' | 'apellidos' | 'fechaNacimiento' | 'sexo' | 'perfil'>
  rutina: { codigo: string; poblacion: string; minutos: number; dias: number[] }[] // dias: 0 = lunes
  formulaId?: string
  masaLibreGrasaKg?: number
  mediciones: Medicion[]
}

const LABORALES = [0, 1, 2, 3, 4]
const TODOS = [0, 1, 2, 3, 4, 5, 6]

const FICTICIOS: Ficticio[] = [
  {
    paciente: { nombres: 'Tomás', apellidos: `Soto ${MARCA}`, fechaNacimiento: '2017-05-10', sexo: 'M', perfil: 'nino', tutorNombre: 'Carla Soto' },
    rutina: [
      { codigo: '501002', poblacion: '6-9', minutos: 600, dias: TODOS }, // acostado tranquilo (sueño)
      { codigo: '553402', poblacion: '6-9', minutos: 360, dias: LABORALES }, // sentado tranquilo (colegio)
      { codigo: '654802', poblacion: '6-9', minutos: 60, dias: [1, 3, 5] } // fútbol, partido
    ],
    mediciones: [
      { diasAtras: 120, pesoKg: 29.2, tallaCm: 131.5, medidas: { pliegues: { tricipital: 11, subescapular: 7, pantorrilla: 10 }, perimetros: { cintura: 61, brazoRelajado: 19.5 } } },
      { diasAtras: 60, pesoKg: 29.8, tallaCm: 132.8, medidas: { pliegues: { tricipital: 10.5, subescapular: 6.5, pantorrilla: 9.5 }, perimetros: { cintura: 60.5, brazoRelajado: 19.6 } } },
      { diasAtras: 5, pesoKg: 30.4, tallaCm: 134, medidas: { pliegues: { tricipital: 10, subescapular: 6.5, pantorrilla: 9 }, perimetros: { cintura: 60, brazoRelajado: 19.8 } } }
    ]
  },
  {
    paciente: { nombres: 'Camila', apellidos: `Rojas ${MARCA}`, fechaNacimiento: '1991-03-22', sexo: 'F', perfil: 'adulto', objetivo: 'Bajar de peso' },
    rutina: [
      { codigo: '07030', poblacion: 'adulto', minutos: 480, dias: TODOS }, // dormir
      { codigo: '11580', poblacion: 'adulto', minutos: 480, dias: LABORALES }, // trabajo de oficina
      { codigo: '17190', poblacion: 'adulto', minutos: 30, dias: TODOS } // caminata
    ],
    mediciones: [66.2, 64.6, 63.1].map((pesoKg, i) => ({
      diasAtras: [150, 90, 20][i],
      pesoKg,
      tallaCm: 163,
      medidas: {
        basicos: { tallaSentado: 86 },
        pliegues: {
          tricipital: 19 - i,
          subescapular: 15 - i,
          bicipital: 8,
          crestaIliaca: 17 - i,
          supraespinal: 12 - i,
          abdominal: 21 - i,
          musloFrontal: 26 - i,
          pantorrilla: 15
        },
        perimetros: { brazoRelajado: 28.5, brazoContraido: 29.5, cintura: 77 - i, cadera: 99 - i, musloMaximo: 57, pantorrilla: 35 },
        diametros: { humero: 6, femur: 8.8 }
      }
    }))
  },
  {
    paciente: { nombres: 'Jorge', apellidos: `Muñoz ${MARCA}`, fechaNacimiento: '1952-08-14', sexo: 'M', perfil: 'adulto_mayor' },
    rutina: [
      { codigo: '0702160', poblacion: '60+', minutos: 300, dias: TODOS }, // sentado tranquilo
      { codigo: '1606060', poblacion: '60+', minutos: 45, dias: TODOS } // caminar
    ],
    mediciones: [78.4, 77.6, 77.9].map((pesoKg, i) => ({
      diasAtras: [140, 70, 10][i],
      pesoKg,
      tallaCm: 168,
      medidas: {
        basicos: { alturaRodilla: 52 },
        pliegues: { tricipital: 12, subescapular: 18, bicipital: 6, crestaIliaca: 20 },
        perimetros: { brazoRelajado: 29, cintura: 99 - i, pantorrilla: 34 }
      }
    }))
  },
  {
    paciente: {
      nombres: 'Diego',
      apellidos: `Vera ${MARCA}`,
      fechaNacimiento: '1999-11-02',
      sexo: 'M',
      perfil: 'deportista',
      disciplina: 'Fútbol',
      objetivo: 'Subir masa muscular'
    },
    rutina: [
      { codigo: '07030', poblacion: 'adulto', minutos: 480, dias: TODOS },
      { codigo: '11580', poblacion: 'adulto', minutos: 360, dias: LABORALES },
      { codigo: '02050', poblacion: 'adulto', minutos: 60, dias: [0, 2, 4] }, // fuerza
      { codigo: '15610', poblacion: 'adulto', minutos: 90, dias: [1, 3, 5] } // fútbol
    ],
    formulaId: 'katch-mcardle',
    masaLibreGrasaKg: 67,
    mediciones: [76.5, 77.1, 77.8].map((pesoKg, i) => ({
      diasAtras: [100, 55, 3][i],
      pesoKg,
      tallaCm: 178,
      medidas: {
        basicos: { tallaSentado: 92, envergadura: 182 },
        pliegues: {
          tricipital: 8 - i * 0.5,
          subescapular: 9,
          bicipital: 4,
          crestaIliaca: 11 - i * 0.5,
          supraespinal: 7,
          abdominal: 12 - i * 0.5,
          musloFrontal: 10,
          pantorrilla: 6
        },
        perimetros: {
          cabeza: 57,
          cuello: 38,
          brazoRelajado: 32 + i * 0.3,
          brazoContraido: 35 + i * 0.3,
          antebrazo: 28,
          muneca: 17,
          torax: 100,
          cintura: 80,
          cadera: 96,
          musloMaximo: 58 + i * 0.3,
          musloMedio: 54,
          pantorrilla: 38,
          tobillo: 22
        },
        diametros: {
          biacromial: 41,
          toraxTransverso: 29,
          toraxAnteroposterior: 20,
          biiliocrestideo: 28,
          humero: 7,
          femur: 9.8,
          muneca: 5.8,
          tobillo: 7.4,
          mano: 8.5
        }
      }
    }))
  },
  {
    paciente: { nombres: 'Valentina', apellidos: `Pérez ${MARCA}`, fechaNacimiento: '1995-01-30', sexo: 'F', perfil: 'gestante' },
    rutina: [
      { codigo: '07030', poblacion: 'adulto', minutos: 540, dias: TODOS },
      { codigo: '11580', poblacion: 'adulto', minutos: 420, dias: LABORALES },
      { codigo: '17190', poblacion: 'adulto', minutos: 30, dias: TODOS }
    ],
    mediciones: [
      { diasAtras: 84, pesoKg: 61, tallaCm: 162, estado: 'gestacion_t2', semanaEmbarazo: 18, medidas: { pliegues: { tricipital: 20, subescapular: 15 }, perimetros: { brazoRelajado: 27 } } },
      { diasAtras: 42, pesoKg: 63.8, tallaCm: 162, estado: 'gestacion_t2', semanaEmbarazo: 24, medidas: { perimetros: { brazoRelajado: 27.3 } } },
      { diasAtras: 0, pesoKg: 66.5, tallaCm: 162, estado: 'gestacion_t3', semanaEmbarazo: 30, medidas: { perimetros: { brazoRelajado: 27.5 } } }
    ]
  }
]

const RECORDATORIO: Recordatorio = {
  comidas: [
    { tiempo: 'Desayuno', hora: '08:00', alimentos: 'Pan con palta y té', porciones: { CER: 2, ARL: 1 } },
    { tiempo: 'Almuerzo', hora: '13:30', alimentos: 'Arroz con pollo y ensalada', porciones: { CER: 2, CBG: 3, VG: 1, VLC: 1, AC: 2 } },
    { tiempo: 'Once', hora: '18:00', alimentos: 'Pan con queso y una fruta', porciones: { CER: 2, LMG: 1, FRT: 1 } },
    { tiempo: 'Cena', hora: '21:00', alimentos: 'Tortilla de verduras', porciones: { CBG: 2, VG: 1, AC: 1 } }
  ],
  noConsume: []
}

const haceDias = (n: number) => {
  const f = new Date()
  f.setDate(f.getDate() - n)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

const idsDePrueba = (db: DB) => db.prepare(`SELECT id FROM paciente WHERE apellidos LIKE '%${MARCA}'`).pluck().all() as number[]

export function crear(db: DB, profesionalId: number, predeterminado: controles.Predeterminado): number {
  if (idsDePrueba(db).length) throw new Error('Ya hay pacientes de prueba: elimínelos antes de crearlos de nuevo')
  const buscar = db.prepare('SELECT id, nombre, met FROM actividad_met WHERE codigo = ? AND poblacion = ?')
  db.transaction(() => {
    for (const f of FICTICIOS) {
      const p = pacientes.guardar(
        db,
        pacienteEntrada.parse({
          rut: '',
          semanasGestacion: '',
          pesoNacerG: '',
          disciplina: '',
          direccion: '',
          telefono: '',
          correo: '',
          preferencia: null,
          sintomas: [],
          tabaco: '',
          alcohol: '',
          objetivo: '',
          tutorNombre: '',
          consentimiento: true,
          ...f.paciente
        }),
        profesionalId
      )
      const semana: BloqueRutina[][] = [[], [], [], [], [], [], []]
      for (const r of f.rutina) {
        const a = buscar.get(r.codigo, r.poblacion) as { id: number; nombre: string; met: number } | undefined
        if (!a) throw new Error(`Falta la actividad ${r.codigo} (${r.poblacion}) en la tabla MET`)
        for (const d of r.dias) semana[d].push({ actividadId: a.id, nombre: a.nombre, met: a.met, minutos: r.minutos })
      }
      for (const m of f.mediciones) {
        const c = controles.obtener(db, controles.crear(db, p.id, profesionalId, predeterminado))
        const antropometria = { ...c.antropometria }
        for (const [g, sitios] of Object.entries(m.medidas)) Object.assign(antropometria, { [g]: { ...antropometria[g as keyof Medidas], ...sitios } })
        controles.guardar(
          db,
          controlGuardar.parse({
            ...c,
            fecha: haceDias(m.diasAtras),
            pesoKg: m.pesoKg,
            tallaCm: m.tallaCm,
            masaLibreGrasaKg: f.masaLibreGrasaKg ?? null,
            formulaId: f.formulaId ?? c.formulaId,
            estado: m.estado ?? null,
            semanaEmbarazo: m.semanaEmbarazo ?? null,
            motivo: 'Control de prueba',
            antropometria,
            semana,
            recordatorio: RECORDATORIO,
            pauta: {
              ...pautaVacia(),
              objetivo: f.paciente.objetivo ?? '',
              dias: semana.map(() => RECORDATORIO.comidas.map(({ tiempo, hora, porciones }) => ({ tiempo, hora, porciones, idea: '' })))
            }
          }),
          profesionalId
        )
      }
    }
  })()
  return FICTICIOS.length
}

export function eliminar(db: DB, profesionalId: number): number {
  const ids = idsDePrueba(db)
  for (const id of ids) pacientes.eliminar(db, id, profesionalId)
  return ids.length
}
