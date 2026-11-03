// Textos de la pauta del paciente, tomados de la ficha maestra (hojas PLAN, 24H-REQ y FORMS) y de la tarjeta #6 de Trello
// (suplementos). Fabi debe validarlos; se corrigieron solo erratas evidentes.
import type { CodigoGrupo } from '../../calculo/intercambio'
import type { PREFERENCIAS } from '../../shared/contratos'

export const OBJETIVOS = [
  'Disminuir tejido adiposo',
  'Aumentar masa muscular',
  'Continuar plan anterior',
  'Mejorar hábitos',
  'Optimizar rendimiento',
  'Transición a alimentación vegetal'
]

export const REGIMENES = [
  'Normocalórico',
  'Hipercalórico',
  'Hipocalórico',
  'Hiperproteico',
  'Normoproteico',
  'Hipoproteico',
  'Hipoglucídico',
  'Hiperglucídico',
  'Normolipídico',
  'Hipolipídico',
  'Liviano / sin residuos',
  'Bajo índice glicémico',
  'Selección AGE',
  'Alto en micronutrientes'
]

/** Sugerencias de 24H-REQ AV66:AV97, en grupos para el selector. Se omiten las que hablan de colores u opciones de la planilla. */
export const RECOMENDACIONES: { group: string; items: string[] }[] = [
  {
    group: 'Comentarios',
    items: [
      'Las porciones de CBG que ves en las colaciones sugiero que sean barritas de proteína (marcas WildFoods/ProteinSnack/Twentys) o proteína en polvo por su practicidad.',
      'Recuerda la importancia de cuantificar tus porciones para avanzar acorde a lo esperado.'
    ]
  },
  {
    group: 'Dieta',
    items: [
      'Incorpora verduras y frutas de todos los colores para una cantidad apropiada de vitaminas y minerales.',
      'Consume distintas "proteínas" durante el día. Ej: almuerzo porotos negros c/ arroz, cena tofu sellado c/ quínoa.',
      'Intenta comer c/ 2-3 horas, en volúmenes bajos, y al menos 2 horas entre la última comida y el sueño.',
      'Régimen liviano: evita frituras, snacks envasados, carnes rojas/cerdo, embutidos, legumbres, verduras como brócoli, coliflor, cebolla. Limita verduras y frutas crudas en general.',
      'Régimen sin residuo: evita frituras, snacks envasados, carnes rojas/cerdo, legumbres, verduras y lácteos. Se puede incorporar manzana cocida, plátano molido y yogurt s/lactosa según tolerancia.',
      'Prefiere el consumo de espinaca, acelga, brócoli, kale, nueces, almendras. Estos son más densos en vitaminas y minerales.',
      'Para mayor variedad, considera la siguiente equivalencia: 1 CER = 2 FRT.',
      'Recuerda priorizar las porciones de proteínas; estas son fundamentales para la pérdida de peso/aumento de masa muscular.',
      '2 porciones de LBG en una misma comida pueden equivaler a una unidad de yogurt/leche protein (1 u = 2 LBG).'
    ]
  },
  {
    group: 'Ejercicio',
    items: [
      'Sugiero comenzar con ejercicio aeróbico: 30+ min de baja intensidad (permite conversar) en bicicleta/elíptica/trotadora.',
      'Puedes comenzar con entrenamiento de alta intensidad en intervalos: trotando/en bicicleta/elíptica en tiempos 1:3.',
      'Sugiero comenzar entrenamiento de fuerza. Es necesario para estimular tu musculatura y mejorar tu salud en general.',
      'Para el gym: 3-4 sesiones a la semana de TREN SUP/TREN INF o FULL BODY. Priorizando pesos libres (barras, discos, mancuernas) con series de 8-15 reps trabajando cercano al fallo muscular.',
      'Sugiero incluir caminatas largas (30+ min mínimo) 2-3 veces por semana.',
      'Aumenta el estímulo de la musculación progresivamente para lograr la hipertrofia y ganancia de fuerza.'
    ]
  },
  {
    group: 'Otros',
    items: [
      'Solo para 1-2 veces por semana: puedes considerar 1 porción de CER equivalente a 1 cerveza de 330 ml o 1 copa de vino (120 ml).',
      'Reduce la ingesta de alcohol a la mitad. Mitad de destilado/licor y/o mitad de frecuencia.',
      'Aumenta tus horas de sueño, idealmente entre 6,5 a 7 horas.',
      'Considera aumentar tu actividad no relacionada con el ejercicio (caminar, estar de pie, subir escaleras, etc).',
      'Intenta reducir la cantidad de café paulatinamente; ojalá lograr la mitad de la ingesta para el próximo control. Prueba con el descafeinado.',
      'Te recomiendo aumentar tus pasos diarios a un promedio de 4000 por día.',
      'Te recomiendo aumentar tus pasos diarios a un promedio de 6000 por día.',
      'Te recomiendo aumentar tus pasos diarios a un promedio de 8000 por día.',
      'Te recomiendo aumentar tus pasos diarios a un promedio de 10000 por día.'
    ]
  }
]

export type Suplemento = { producto: string; queEs: string; paraQue: string; dosis: string; cuando: string; como: string; marcas: string }

/** Tarjeta #6 de Trello ("Adjuntar marcas al sistema"), escrita por Fabi. */
export const SUPLEMENTOS: Suplemento[] = [
  {
    producto: 'Omega-3 (aceite de pescado)',
    queEs: 'Ácidos grasos esenciales (EPA/DHA) derivados del pescado.',
    paraQue: 'Reduce la inflamación muscular, apoya la salud cardiovascular, articular y cognitiva.',
    dosis: '1000-2000 mg de EPA/DHA al día',
    cuando: 'Junto a una comida principal.',
    como: 'Con un vaso de agua junto a alimentos que contengan grasas para mejorar su absorción.',
    marcas: 'New Science, Pure Science, Strive, Vitamin Life'
  },
  {
    producto: 'Omega-3 (de algas)',
    queEs: 'Fuente vegana directa de EPA y DHA proveniente de microalgas.',
    paraQue: 'Reduce la inflamación muscular, apoya la salud cardiovascular, articular y cognitiva.',
    dosis: '250-500 mg de DHA/EPA combinados al día',
    cuando: 'Junto a una comida principal.',
    como: 'Con un vaso de agua junto a alimentos que contengan grasas para mejorar su absorción.',
    marcas: 'New Science, Vitamin Life'
  },
  {
    producto: 'Creatina monohidratada',
    queEs: 'Compuesto orgánico que incrementa las reservas de fosfocreatina.',
    paraQue: 'Aumenta la fuerza, la potencia muscular y la masa magra; mejora la recuperación.',
    dosis: '3-5 g al día',
    cuando: 'A cualquier hora (el efecto es por acumulación diaria).',
    como: 'Disuelta en agua o jugo.',
    marcas: 'Optimum Nutrition, Strive, Winkler, Ultimate Nutrition, MuscleTech'
  },
  {
    producto: 'Cafeína',
    queEs: 'Estimulante del sistema nervioso central.',
    paraQue: 'Reduce la percepción del esfuerzo, aumenta el estado de alerta y la resistencia.',
    dosis: '3-6 mg/kg de peso corporal',
    cuando: '30 a 60 minutos antes del entrenamiento o la competencia.',
    como: 'En pastillas, anhidra o en café concentrado. Evitar tomarla de noche.',
    marcas: 'Optimum Nutrition, Strive, Winkler'
  },
  {
    producto: 'Beta-alanina',
    queEs: 'Aminoácido precursor de la carnosina intramuscular.',
    paraQue: 'Amortigua la acidez muscular (ácido láctico) en esfuerzos de alta intensidad (1-4 min).',
    dosis: '3,2-6,4 g al día',
    cuando: 'Todos los días (efecto acumulativo).',
    como: 'Disuelta en agua. Dividir en dosis de 1,5-2 g si produce hormigueo.',
    marcas: 'Winkler, Vitamin Life, Biotech, Clean Label, Strive'
  },
  {
    producto: 'Nitrato / jugo de betarraga',
    queEs: 'Precursor de óxido nítrico derivado de la betarraga.',
    paraQue: 'Vasodilatador que mejora la eficiencia metabólica y el flujo sanguíneo de oxígeno.',
    dosis: '300-600 mg de nitratos',
    cuando: '2 a 3 horas antes del ejercicio.',
    como: 'En toma directa (concentrado en shot) o jugo natural.',
    marcas: 'Beet It Sport, Clean Label'
  },
  {
    producto: 'ZMA',
    queEs: 'Combinación de zinc, magnesio y vitamina B6.',
    paraQue: 'Mejora el descanso nocturno, la recuperación muscular y el entorno hormonal.',
    dosis: '1 dosis comercial (suele contener ~30 mg de zinc, ~450 mg de magnesio y ~10 mg de B6)',
    cuando: '30 a 60 minutos antes de dormir.',
    como: 'Con el estómago vacío. No tomar junto con lácteos (el calcio compite con el zinc).',
    marcas: 'Optimum Nutrition, Winkler, Vitamin Life'
  },
  {
    producto: 'Whey protein (proteína de suero)',
    queEs: 'Proteína de alto valor biológico extraída del suero de la leche.',
    paraQue: 'Facilita la síntesis proteica, la reparación y la ganancia de masa muscular.',
    dosis: '20-30 g de proteína por toma (según requerimiento diario)',
    cuando: 'Post-entrenamiento o entre comidas.',
    como: 'Mezclada con agua, leche o en batidos.',
    marcas: 'Optimum Nutrition (Gold Standard), Dymatize, MyProtein, Winkler, Spartan, MuscleTech'
  },
  {
    producto: 'Proteína vegetal',
    queEs: 'Aislado de proteína proveniente de arveja, arroz, soya o cáñamo.',
    paraQue: 'Ayuda a cubrir el requerimiento proteico diario en veganos y vegetarianos.',
    dosis: '20-30 g de proteína por toma',
    cuando: 'Post-entrenamiento o entre comidas.',
    como: 'Disuelta en agua, bebidas vegetales o mezclada en avena.',
    marcas: 'Ultimate Nutrition, Cascara Foods, Winkler, Spartan'
  },
  {
    producto: 'Bicarbonato de sodio',
    queEs: 'Agente tampón (buffer) extracelular.',
    paraQue: 'Neutraliza la acidosis metabólica durante ejercicios intensos de corta duración.',
    dosis: '0,2-0,3 g/kg de peso corporal',
    cuando: '60 a 90 minutos antes del ejercicio.',
    como: 'Disuelto en abundante agua con algo de carbohidrato; tomar despacio para evitar molestias gastrointestinales.',
    marcas: 'Bicarbonato alimenticio'
  },
  {
    producto: 'Vitamina B12',
    queEs: 'Vitamina hidrosoluble esencial para el sistema nervioso y la producción de glóbulos rojos.',
    paraQue: 'Previene la anemia megaloblástica y mantiene la energía celular (esencial en veganos).',
    dosis: '250-1000 mcg al día (o 2000 mcg semanales si es cianocobalamina)',
    cuando: 'Por la mañana o con cualquier comida.',
    como: 'Sublingual o tragada con agua (preferir metilcobalamina o cianocobalamina).',
    marcas: 'Tol 12, Neurobionta / Neurobionta Advance, Dulzura Natural'
  },
  {
    producto: 'Vitamina D3',
    queEs: 'Prohormona liposoluble que la piel sintetiza con la luz solar.',
    paraQue: 'Apoya la salud ósea, la función inmunitaria, la fuerza y los niveles de testosterona.',
    dosis: '1000-4000 UI al día (según exámenes previos)',
    cuando: 'Por la mañana con el desayuno.',
    como: 'Junto con alimentos que contengan grasas para máxima absorción.',
    marcas: 'Bonavid, Vidyn, Dvidamax, Dulzura Natural'
  },
  {
    producto: 'Calcio',
    queEs: 'Mineral fundamental para el tejido óseo y la contracción muscular.',
    paraQue: 'Salud ósea y correcta transmisión de impulsos nerviosos y musculares.',
    dosis: '500-1000 mg al día (suplementar solo si no se cubre con la dieta)',
    cuando: 'Dividido en dosis de 500 mg como máximo, con las comidas.',
    como: 'Citrato de calcio: con o sin comida. Carbonato de calcio: siempre con comida.',
    marcas: 'Vitalbones, Calcium Bariatric, Elcal-D, Dulzura Natural'
  },
  {
    producto: 'Multivitamínico',
    queEs: 'Mezcla balanceada de vitaminas y minerales esenciales.',
    paraQue: 'Previene deficiencias de micronutrientes en períodos de alto desgaste físico o déficit calórico.',
    dosis: '1 dosis diaria (según la etiqueta del fabricante)',
    cuando: 'Con el desayuno o el almuerzo.',
    como: 'Acompañado de agua y alimentos para evitar náuseas.',
    marcas: 'Centrum, Bion3, Daily One, Infor'
  },
  {
    producto: 'Sulfato ferroso (hierro)',
    queEs: 'Forma de hierro inorgánico de alta absorción para corregir deficiencias.',
    paraQue: 'Previene o trata la anemia ferropénica; esencial para el transporte de oxígeno (hemoglobina).',
    dosis: 'Según prescripción médica (habitualmente ~60-100 mg de hierro elemental)',
    cuando: 'En ayunas o antes de dormir.',
    como: 'Con agua o jugo de naranja (la vitamina C mejora la absorción). Evitar café, té, lácteos o calcio al mismo tiempo.',
    marcas: 'Ferranim, genérico, Folifer, Globifer, Dulzura Natural'
  },
  {
    producto: 'Pre-entreno (pre-workout)',
    queEs: 'Mezcla comercial que suele incluir cafeína, beta-alanina, citrulina, etc.',
    paraQue: 'Incrementa la energía, la concentración, el bombeo vascular y la resistencia.',
    dosis: '1 scoop por servicio (empezar con medio scoop para tolerar la cafeína)',
    cuando: '20 a 30 minutos antes de entrenar.',
    como: 'Mezclado con agua bien fría. No consumir dentro de las 6 horas previas a dormir.',
    marcas: 'Kreator, Optimum Nutrition, Vitamin Life, Spartan'
  },
  {
    producto: 'Colágeno hidrolizado',
    queEs: 'Proteína desglosada en péptidos para favorecer su asimilación.',
    paraQue: 'Favorece la salud de articulaciones, ligamentos, cartílagos, piel y tendones.',
    dosis: '10-15 g al día',
    cuando: 'En la mañana, o 1 hora antes del entrenamiento si se busca foco articular.',
    como: 'Disuelto en agua, café, té o batidos (ideal combinar con vitamina C).',
    marcas: 'Xray, Vital Proteins, Genacol, Vitamin Life, Hidrolágeno'
  }
]

/** Tablas de intercambio de la hoja PLAN: [alimento, 1 porción]. Una fila sin porción es un subtítulo. */
export const ALIMENTOS_POR_GRUPO: Record<CodigoGrupo, [string, string][]> = {
  CER: [
    ['Arroz (cocido)', '3/4 taza (80 g)'],
    ['Arroz integral, cuscús, fideos (cocidos)', '3/4 taza (100 g)'],
    ['Fideos integrales (cocidos)', '3/4 taza (90 g)'],
    ['Arvejas (cocidas)', '1 1/2 taza (150 g)'],
    ['Mote (cocido)', '1 taza (100 g)'],
    ['Quínoa (cocida)', '1/2 taza (100 g)'],
    ['Marraqueta o hallulla normal', '1/2 unidad (50 g)'],
    ['Pan de molde blanco o integral', '2 rebanadas (50 g)'],
    ['Pan pita blanco o integral', '1 unidad (50 g)'],
    ['Galletas de salvado / Salmas', '6 galletas (30 g)'],
    ['Galletas de agua o soda', '8 unidades (40 g)'],
    ['Galletas de arroz', '4-6 galletas (35 g)'],
    ['Cereal en barra (Quaker, Costa u otra)', '2 barras (40 g)'],
    ['Cereales de desayuno (corn flakes, hojuelas integrales, Chocapic, Quadritos)', '3/4 taza (40 g)'],
    ['Granola', '1/3 taza (30 g)'],
    ['Avena', '1/2 taza (35 g)'],
    ['Papa cocida o camote cocido', '1 unidad regular (150 g)'],
    ['Puré de papa (con leche descremada)', '3/4 taza (150 g)'],
    ['Choclo, habas (cocidos)', '1 taza (150 g)'],
    ['Humitas', '1/2 unidad grande (75 g)'],
    ['Arepa mediana', '1 unidad regular (50 g)'],
    ['Tortillas / fajitas', '1 grande o 2 chicas (50 g)']
  ],
  VG: [
    ['Alcachofa', '1 unidad chica (50 g)'],
    ['Betarraga, berenjena', '1/2 taza (90 g)'],
    ['Brócoli, coliflor', '1 taza (100 g)'],
    ['Cebolla (cruda)', '3/4 taza (60 g)'],
    ['Champiñones (crudos)', '1 1/2 taza (100 g)'],
    ['Espárragos', '5 unidades regulares (100 g)'],
    ['Palmitos', '3 unidades (160 g)'],
    ['Porotos verdes', '3/4 taza (70 g)'],
    ['Zanahoria (cruda)', '1/2 taza (50 g)'],
    ['Zanahoria (cocida)', '1 taza (50 g)'],
    ['Zapallo camote', '1/2 taza (70 g)'],
    ['Zapallo italiano', '1 taza (150 g)'],
    ['Tomate (crudo)', '1 unidad chica (120 g)'],
    ['Repollitos de Bruselas', '1/2 taza (100 g)']
  ],
  VLC: [
    ['Apio', '1 taza (70 g)'],
    ['Cochayuyo', '1 taza (25 g)'],
    ['Espinaca, lechuga, repollo', '1 taza (50 g)'],
    ['Penca', '1/2 taza (50 g)'],
    ['Pepino', '1 taza (100 g)'],
    ['Pimentón rojo y verde', '1/2 taza (60 g)'],
    ['Kale', '1 taza (50 g)'],
    ['Zapallo italiano (crudo)', '1 taza (100 g)']
  ],
  FRT: [
    ['Cerezas', '15 unidades (90 g)'],
    ['Ciruelas, damascos', '3 unidades (110 g)'],
    ['Durazno', '1 unidad regular (130 g)'],
    ['Arándanos, frambuesas', '1 taza (130 g)'],
    ['Frutillas, sandía', '1 taza (200 g)'],
    ['Kiwi', '2 unidades chicas (100 g)'],
    ['Mandarinas', '3 unidades (100 g)'],
    ['Manzana, pera', '1 unidad chica (100 g)'],
    ['Mango', '1/2 unidad regular (110 g)'],
    ['Melón', '1 taza (180 g)'],
    ['Naranja', '1 unidad regular (120 g)'],
    ['Piña', '3/4 taza (120 g)'],
    ['Plátano', '1/2 unidad regular (60 g)'],
    ['Tuna', '2 unidades regulares (150 g)'],
    ['Uvas', '10 unidades (90 g)'],
    ['Compota sin azúcar', '1 unidad o 1 taza']
  ],
  CBG: [
    ['Pechuga de pollo o pavo sin piel (cocida)', '40 g (1/2 palma de mano)'],
    ['Asiento, lomo liso, filete, pollo ganso, posta, carne molida 5-7 % (cocidos)', '40 g (1/2 palma de mano)'],
    ['Churrascos (cocidos)', '50 g (3 unidades delgadas)'],
    ['Merluza, reineta, corvina, salmón sin piel (cocidos)', '50 g (1/2 palma de mano)'],
    ['Jurel enlatado', '75 g (1/4 lata)'],
    ['Atún en agua, choritos en agua', '60 g (1/2 lata)'],
    ['Camarón, jaiba', '1/2 taza (60 g)'],
    ['Jamón de pavo o de pierna', '60 g (2 rebanadas)'],
    ['Huevo', '1 huevo o 3 claras (50 o 120 g)'],
    ['Hamburguesa de vacuno La Crianza Light, Pollo King', '1/2 unidad'],
    ["Twenty's, ProteinSnack, Wild Foods, En Línea", '1/2 barra'],
    ['Whey protein o proteína vegetal (suplemento)', '1/2 scoop (15 g)'],
    ['Origen vegetal', ''],
    ['Tofu', '1 rebanada (50 g firme / 100 g blando)'],
    ['Seitán', '1 rebanada (60 g)'],
    ['Tempeh', '1 rebanada (40 g)'],
    ['Harina o carne de soya (hidratada)', '70 g (1/2 taza)'],
    ['Porotos, garbanzos, lentejas (cocidos)', '50 g (1/2 taza)'],
    ['Hamburguesa de soya (Mister Veggie o casera)', '50 g (1/2 unidad)']
  ],
  LAG: [
    ['Leche entera', '1 taza (200 ml)'],
    ['Yogurt normal (batido)', '1 unidad (125 g)'],
    ['Queso gauda, chanco, mantecoso', '2 rebanadas (30 g)']
  ],
  LMG: [
    ['Leche semidescremada', '1 taza (200 ml)'],
    ['Queso fresco', '1 rebanada de 1,5 cm (30 g)'],
    ['Queso ricota', '2 cucharadas (25 g)'],
    ['Quesillo', '1 rodela de 3 cm (60 g)']
  ],
  LBG: [
    ['Leche descremada / leche cultivada', '1 taza (200 ml)'],
    ['Leche en caja light', '1 unidad (200 ml)'],
    ['Yogurt light / yogurt de soya light', '1 unidad (125 g)'],
    ['Leche protein (cualquiera)', '1/2 cajita (100 ml)'],
    ['Yogurt protein (cualquiera)', '1/2 unidad']
  ],
  AC: [
    ['Aceites (maravilla, oliva, soya, etc.)', '1 cdta (5 ml)'],
    ['Coco', '4 cucharaditas (20 g)'],
    ['Mayonesa light', '1 cda (10 ml)'],
    ['Mayonesa normal o Not Mayo', '1 cdta (5 g)'],
    ['Margarina, mantequilla', '1 cdta (7 g)']
  ],
  ARL: [
    ['Aceitunas', '11 unidades (115 g)'],
    ['Avellanas', '50 unidades (30 g)'],
    ['Chocolate amargo (>70 %)', '3-4 cuadraditos (30 g)'],
    ['Semillas de chía, amapola, linaza', '3 1/2 cucharadas (35 g)'],
    ['Sésamo', '3 cucharadas (30 g)'],
    ['Mantequilla de maní (idealmente casera)', '2 cucharadas (28 g)'],
    ['Maní, almendras, nueces (sin sal)', '25 g (1 puñado)'],
    ['Pistachos', '40 unidades (30 g)'],
    ['Palta', '100 g (1/2 palta)']
  ],
  AZ: [
    ['Azúcar', '1 cdta (5 g)'],
    ['Jugos light con azúcar', '1 vaso (200 ml)'],
    ['Bebidas con azúcar', '1/4 de vaso o lata (50 ml)'],
    ['Ketchup, salsa de tomate', '2 cdas (20 g)'],
    ['Mermelada light', '2 cdtas (15 g)'],
    ['Manjar o mermelada normal', '1 cda (10 g)'],
    ['Manjar light', '1 cda (30 g)']
  ],
  INT: [
    ['GU Roctane', '1 sachet'],
    ['Power Honey', '1 sachet'],
    ['Winkler', '1 sachet'],
    ['Powerade', '500 ml'],
    ['Gatorade', '500 ml'],
    ['Go Zuko', '500 ml']
  ],
  EX: [
    ['Papas fritas, ramitas, doritos, suflés', '1/2 taza (25 g)'],
    ['Chocolate', '3-4 cuadraditos (20-30 g)'],
    ['Helado (ej.: San Francisco)', '1/2 taza (50 g)'],
    ['Galletas (Tritón, Frac, Kuky, Toddy)', '3 galletas (35 g)'],
    ['Alfajor', '1 unidad chica (50 g)'],
    ['Queque o muffin', '1 trozo pequeño (100 g)']
  ]
}

/** Hoja PLAN CF33: antojos que equivalen a 1 CER, para la "comida trampa". */
export const EQUIVALENTES_CER: [string, string][] = [
  ['Chocolate Sahne-Nuss o similar', '3 cuadraditos (20 g)'],
  ['Galletas Frac', '2 galletas (26 g)'],
  ['Dona simple', '1 pequeña'],
  ['Galletón Nutra Bien', '1 galletón (40 g)'],
  ['Doritos, papas fritas, ramitas', '1 taza de té (25 g)']
]

export const MEDIDAS_CASERAS = [
  '1 taza (chica, de té): 200 ml',
  '1 vaso (promedio): 300 ml',
  '1 cuchara sopera (cda): 10 ml',
  '1 cucharadita de té (cdta): 5 ml'
]

type Dieta = 'omnivoro' | 'vegetariano' | 'vegano'
export type Preparacion = { tipo: string; dieta: Dieta; nombre: string }
/** El nombre lleva sus porciones de intercambio: "Aliado (pan de molde + jamón + queso) — 1 CER · 1 CBG · 1 LAG". */
const lista = (tipo: string, dieta: Dieta, filas: [string, string][]): Preparacion[] =>
  filas.map(([nombre, porciones]) => ({ tipo, dieta, nombre: porciones ? `${nombre} — ${porciones}` : nombre }))

/**
 * "Lista de preparaciones" de la hoja FORMS (K94:K188), para las ideas rápidas de cada comida. Las porciones (pedidas por Fabi en
 * la tarjeta #40) son de una porción habitual según las tablas de intercambio de la hoja PLAN; Fabi debe validarlas. Sin porciones = libre.
 */
export const PREPARACIONES: Preparacion[] = [
  ...lista('Colaciones', 'omnivoro', [
    ['Leche descremada + hallulla c/ mantequilla y jamón', '1 CER · 1 CBG · 1 LBG · 1 AC'],
    ['Aliado (pan de molde + jamón + queso)', '1 CER · 1 CBG · 1 LAG'],
    ['Pan de molde integral c/ jamón de pavo', '1 CER · 1 CBG'],
    ['Leche descremada + tostadas c/ jamón de pavo', '1 CER · 1 CBG · 1 LBG'],
    ['Té + ave palta (pan de molde, pollo desmenuzado, palta)', '1 CER · 1 CBG · ½ ARL']
  ]),
  ...lista('Colaciones', 'vegetariano', [
    ['1 scoop de whey protein', '2 CBG'],
    ['Leche descremada', '1 LBG'],
    ['Leche semidescremada', '1 LMG'],
    ['Leche en caja light', '1 LBG'],
    ['Yogurt light', '1 LBG'],
    ['Yogurt batido normal', '1 LAG'],
    ['Yogurt protein', '2 LBG'],
    ['Leche descremada + tostadas c/ huevo', '1 CER · 1 CBG · 1 LBG'],
    ['Yogurt light c/ avena', '1 CER · 1 LBG'],
    ['Yogurt protein c/ cereal de desayuno', '1 CER · 2 LBG'],
    ['Omelette (huevo c/ verduras mixtas)', '1 VG · 2 CBG'],
    ['Infusión o té verde + galletas de salvado c/ quesillo y palta', '1 CER · 1 LMG · ½ ARL'],
    ['Jugo natural + hallulla c/ mermelada y queso', '1 CER · 1 FRT · 1 LAG · 1 AZ'],
    ['Panqueques proteicos (huevo y avena)', '1 CER · 1 CBG'],
    ['Porridge proteico (avena, agua, whey, fruta)', '1 CER · 1 FRT · 2 CBG'],
    ['Muffin de microondas (huevo, avena, fruta, cacao)', '1 CER · 1 FRT · 1 CBG'],
    ['Batido proteico (leche descremada, whey, plátano, maní)', '1 FRT · 2 CBG · 1 LBG · ½ ARL'],
    ['Galletas de soda o salvado c/ quesillo', '1 CER · 1 LMG']
  ]),
  ...lista('Colaciones', 'vegano', [
    ['Café', ''],
    ['Té', ''],
    ['Infusión de hierbas', ''],
    ['Fruta', '1 FRT'],
    ['Jugo de fruta natural', '1 FRT'],
    ['Almendras', '1 ARL'],
    ['Maní sin sal', '1 ARL'],
    ['Maní salado', '1 ARL'],
    ['Cereal de desayuno (corn flakes, Chocapic)', '1 CER'],
    ['1 scoop de proteína vegetal', '2 CBG'],
    ['Yogurt de soya c/ cereal y fruta', '1 CER · 1 FRT · 1 LBG'],
    ['Tostadas c/ tofu revuelto', '1 CER · 1 CBG'],
    ['Café + porridge de avena (avena, agua tibia, fruta)', '1 CER · 1 FRT'],
    ['Jugo natural sin azúcar + tostadas c/ palta', '1 CER · 1 FRT · ½ ARL'],
    ['Porridge vegetal (avena, leche de soya, fruta)', '1 CER · 1 FRT · 1 LMG'],
    ['Tostadas c/ palta y hummus', '1 CER · ½ CBG · ½ ARL'],
    ['Smoothie (leche de soya, fruta, proteína vegetal)', '1 FRT · 2 CBG · 1 LMG']
  ]),
  ...lista('Ensaladas y entradas', 'vegetariano', [
    ['Ensalada mixta: choclo, tomate, quesillo', '½ CER · 1 VG · 1 LMG'],
    ['Ensalada de lechuga y huevo', '1 VLC · 1 CBG']
  ]),
  ...lista('Ensaladas y entradas', 'vegano', [
    ['Ensalada de espinaca y tomate', '1 VG · 1 VLC'],
    ['Ensalada de lechuga y tomate', '1 VG · 1 VLC'],
    ['Ensalada de apio y zanahoria', '1 VG · 1 VLC'],
    ['Ensalada de betarraga y brócoli', '2 VG'],
    ['Ensalada chilena', '1½ VG'],
    ['Ensalada de apio y palta', '1 VLC · ½ ARL'],
    ['Ensalada de habas y cebolla', '½ CER · ½ VG'],
    ['Ensalada de lechuga y pimentón rojo', '2 VLC'],
    ['Ensalada de porotos verdes y cebolla', '1½ VG'],
    ['Ensalada de champiñones y cebolla', '1½ VG'],
    ['Ensalada de choclo y tomate', '½ CER · 1 VG'],
    ['Ensalada de pepino y lechuga', '2 VLC'],
    ['Ensalada de lechuga y zanahoria', '1 VG · 1 VLC'],
    ['Crema de zapallo', '2 VG']
  ]),
  ...lista('Almuerzos y cenas', 'omnivoro', [
    ['Pollo al jugo c/ arroz graneado', '2 CER · 3 CBG · 1 AC'],
    ['Pasta bolognesa', '2 CER · 1 VG · 2 CBG · 1 AC'],
    ['Pescado al horno c/ puré', '2 CER · 3 CBG · 1 AC'],
    ['Chacarero (pan, churrascos, porotos verdes, tomate)', '2 CER · 1 VG · 2 CBG · 1 AC'],
    ['Tortilla de jurel', '½ VG · 3 CBG · 1 AC'],
    ['Chapsui de pollo', '1 VG · 3 CBG · 1 AC'],
    ['Pollo champiñón c/ arroz graneado', '2 CER · 1 VG · 3 CBG · 1 AC'],
    ['Estofado de carne', '1 CER · 1 VG · 3 CBG · 1 AC'],
    ['Carne al jugo c/ arroz', '2 CER · 3 CBG · 1 AC']
  ]),
  ...lista('Almuerzos y cenas', 'vegetariano', [
    ['Tortilla de verduras', '1 VG · 2 CBG · 1 AC'],
    ['Ensalada surtida, huevo, quesillo, palta', '1 VG · 1 VLC · 1 CBG · 1 LMG · ½ ARL']
  ]),
  ...lista('Almuerzos y cenas', 'vegano', [
    ['Guiso de porotos c/ riendas', '1 CER · ½ VG · 2 CBG · 1 AC'],
    ['Pasta bolognesa de soya', '2 CER · 1 VG · 2 CBG · 1 AC'],
    ['Lentejas c/ arroz', '1 CER · 2 CBG · 1 AC'],
    ['Fajitas de legumbres', '2 CER · 1 VG · 2 CBG · 1 AC'],
    ['Ensalada de legumbres', '1 VG · 2 CBG · 1 AC'],
    ['Tomaticán de soya (soya, tomate, choclo)', '½ CER · 1 VG · 2 CBG · 1 AC']
  ]),
  ...lista('Postres', 'vegano', [
    ['Manzana', '1 FRT'],
    ['Naranja', '1 FRT'],
    ['Plátano', '2 FRT'],
    ['Kiwis', '1 FRT'],
    ['Berries', '1 FRT'],
    ['Jalea normal', '3 AZ'],
    ['Jalea diet', '']
  ]),
  ...lista('Postres', 'vegetariano', [['Postre de leche', '1 LAG · 2 AZ']])
]

/** Qué listas de preparaciones calzan con la preferencia del paciente (sin preferencia: todas). */
export function preparacionesPara(preferencia: (typeof PREFERENCIAS)[number] | null): Preparacion[] {
  const dietas: Dieta[] =
    preferencia === 'vegano' || preferencia === 'ovo_vegano'
      ? ['vegano']
      : preferencia && preferencia !== 'omnivoro'
        ? ['vegetariano', 'vegano']
        : ['omnivoro', 'vegetariano', 'vegano']
  return PREPARACIONES.filter((p) => dietas.includes(p.dieta))
}

// Textos fijos de la hoja PLAN (cuadros de texto).
export const ANTES_DE_COMENZAR = [
  'En primer lugar, me gustaría agradecerte por confiar en mí para cuidar de tu alimentación. Mi objetivo siempre será velar porque cumplas tus objetivos, considerando tus gustos, salud, estilo de vida y por supuesto, tu deporte.',
  'En este documento encontrarás todo lo necesario para lograr tus metas, sin embargo, cualquier duda que tengas o consideres necesario cambiar algo, siempre me puedes preguntar.'
]
export const UTENSILIOS = {
  intro:
    'Para llevar a cabo esta pauta de mejor manera siempre recomiendo contar con algunos utensilios básicos. Si bien no son indispensables, nos pueden ayudar mucho. Estos son:',
  items: [
    'Balanza de piso: servirá para monitorear los cambios agudos en tu peso y así controlar más frecuentemente el progreso.',
    'Balanza de cocina: te ayudará a ser más preciso con las porciones, y por tanto lograr los objetivos será mucho más fácil.'
  ]
}
export const VIDEO_PORCIONES = 'https://youtu.be/4y6wVWrMCKs'
export const NOTA_REQUERIMIENTOS =
  'Esto se estima mediante modelos matemáticos, siempre hay un margen de error. Por ello, es importante que mantengas una retroalimentación constante para realizar ajustes a tiempo.'
export const NOTA_HIDRATACION =
  'Una técnica efectiva y fácil para evaluar tu estado de hidratación es el color de tu orina: si es oscura, bebe 200-250 ml (1 taza aprox.) cada 15-20 minutos hasta lograr un color más claro. Durante y después del ejercicio, la cantidad óptima es la diferencia entre tu peso antes y después de entrenar.'
export const COMO_LEER = [
  'A continuación verás varias tablas que agrupan los alimentos según su aporte nutricional (porciones de intercambio). Así, por ejemplo, 1 porción de fruta puede traducirse en una manzana pequeña, una pera regular, 1/2 plátano, etc.',
  'En tu plan verás que por tiempo de comida requieres cierta cantidad de porciones de cada grupo. Ej.: 1 FRT = 1 porción del grupo Frutas.',
  'Escoge los alimentos según tus preferencias, pero manteniendo variedad en la semana.',
  'Por ejemplo, si al desayuno tienes 1 porción de cereales (CER), 1 de frutas (FRT) y otra de lácteos (LMG), se podría traducir en leche con chocolate, manzana y granola, o también en jugo natural y pan integral con quesillo.',
  'Todo se encuentra con medidas métricas (gramos) y caseras.'
]
export const RECOMENDACIONES_GENERALES = [
  'Procura cambiar los alimentos para otorgarle mayor diversidad a tu alimentación. Incluye todos los colores que puedas a tu minuta para aumentar el aporte de vitaminas y minerales.',
  'Ten una exposición solar adecuada para óptimos niveles de vitamina D: 5-10 min de exposición de brazos y piernas o de piernas, manos y cara, al menos 3 veces por semana.',
  'Asegúrate de dormir mínimo 6 horas para mantener una buena salud hormonal. Aumentará tu estado de alerta, productividad y rendimiento deportivo.',
  'Caminar al metro, subir escaleras u ocupar la bicicleta como transporte aumentan tu gasto energético no asociado al entrenamiento (NEAT). Esto ayuda si tu objetivo es perder grasa.'
]
export const PREGUNTAS_FRECUENTES: [string, string][] = [
  [
    '¿Qué pasa si me salgo de la dieta?',
    'Si te sales de la pauta, no te compliques. Aprovecha la energía extra para aumentar la carga de entrenamiento o actividades al día siguiente.'
  ],
  [
    '¿Qué puedo comer si me da hambre?',
    'Puedes añadir un LBG, una porción de CBG o una porción de FRT. Si es recurrente coméntamelo; puede que debamos hacer ajustes.'
  ],
  [
    '¿Puedo tener un día "trampa"?',
    'Un día de "trampa" usualmente se transforma en un exceso descontrolado. Evítalo, ya que puede retrocedernos varios pasos. Mejor sería una "comida trampa": come algo que te guste respetando tu saciedad normal. Más abajo tienes una pequeña lista de alimentos que puedes incorporar sin salirte.'
  ],
  [
    'No tengo hambre y aún me quedan porciones por completar, ¿qué hago?',
    'Si no tienes hambre no comas por cumplir; al día siguiente continúa normalmente. Si sucede frecuentemente coméntamelo.'
  ]
]
