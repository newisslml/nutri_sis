# Sprints v1 — Sistema de consultas de nutrición

Actualizado: 8 de octubre de 2026

Plan de trabajo de la v1 descrita en `Planv1.md`, dividido en 12 sprints de dos semanas, con horas y valor de cada sprint para un developer a $6.000 CLP la hora. El total es de 480 horas ($2.880.000), más una contingencia del 15 % que lleva el presupuesto a $3.312.000.

## Supuestos

- Un developer a medio tiempo: 20 horas por semana, 40 horas por sprint.
- Valor hora: $6.000 CLP. Cada sprint cuesta $240.000.
- El profesional de nutrición valida al cierre de cada sprint. Su tiempo no está incluido en estos montos.
- El developer tiene experiencia con TypeScript y React. Si no la tiene, hay que sumar horas de aprendizaje.
- Alcance según las decisiones del 8 de octubre de 2026: se atienden todos los tipos de pacientes (niños menores de 5 años, escolares y adolescentes, adultos, adultos mayores, gestantes y nodrizas, deportistas). Las pruebas las hace un solo profesional y el sistema crece a varios usuarios después de la v1.

## Resumen

| Sprint | Semanas | Fase | Objetivo | Horas | Valor |
| --- | --- | --- | --- | ---: | ---: |
| 0 | 1–2 | 0. Definición | Especificación validada y prueba técnica en el Windows de la consulta | 40 | $240.000 |
| 1 | 3–4 | 1. Base y pacientes | Proyecto, puente IPC tipado, base de datos y migraciones | 40 | $240.000 |
| 2 | 5–6 | 1. Base y pacientes | Acceso seguro, ficha y listado de pacientes | 40 | $240.000 |
| 3 | 7–8 | 1. Base y pacientes | Respaldo, privacidad e instalación en la consulta | 40 | $240.000 |
| 4 | 9–10 | 2. Motor de gasto | Motor de cálculo con fórmulas, MET y gasto semanal | 40 | $240.000 |
| 5 | 11–12 | 2. Motor de gasto | Rutina semanal y configuración de cálculo | 40 | $240.000 |
| 6 | 13–14 | 3. Controles y antropometría | Controles completos e historial | 40 | $240.000 |
| 7 | 15–16 | 3. Controles y antropometría | Mediciones ISAK y composición corporal | 40 | $240.000 |
| 8 | 17–18 | 3. Controles y antropometría | Diagnóstico nutricional por perfil | 40 | $240.000 |
| 9 | 19–20 | 4. Alimentación | Recordatorio de 24 horas, frecuencia de consumo, agua e ingesta | 40 | $240.000 |
| 10 | 21–22 | 5. Dashboard y cierre | Gráficos de evolución y comparación entre controles | 40 | $240.000 |
| 11 | 23–24 | 5. Dashboard y cierre | Pruebas con casos reales, correcciones y versión final | 40 | $240.000 |
| | | | **Subtotal** | **480** | **$2.880.000** |
| | | | Contingencia 15 % | 72 | $432.000 |
| | | | **Total con contingencia** | **552** | **$3.312.000** |

Son 24 semanas a medio tiempo, unos seis meses. A tiempo completo (40 horas semanales) cada sprint dura una semana y la v1 toma 12 semanas, con el mismo costo.

El plan original estimaba de 14 a 18 semanas. La diferencia viene del alcance que se sumó (menores de 5 años, gestantes, adultos mayores y kcal de la ingesta) y de una estimación más detallada por tarea.

Si el pago se hace por entregable, conviene pagar al cierre de cada fase, cuando el profesional valida algo usable:

| Fase | Sprints | Horas | Valor |
| --- | --- | ---: | ---: |
| 0. Definición | 0 | 40 | $240.000 |
| 1. Base técnica y pacientes | 1–3 | 120 | $720.000 |
| 2. Motor de gasto | 4–5 | 80 | $480.000 |
| 3. Controles y antropometría | 6–8 | 120 | $720.000 |
| 4. Alimentación | 9 | 40 | $240.000 |
| 5. Dashboard y cierre | 10–11 | 80 | $480.000 |

## Cambios al plan que estos sprints ya incluyen

- **Preparado para varios usuarios:** `paciente` y `control` llevan `profesional_id` desde el primer esquema. Así, sumar profesionales no obliga a migrar los datos.
- **Pediatría:** z-scores OMS (2006 para 0 a 5 años, 2007 para 5 a 19 años) con clasificación según la norma MINSAL. Las curvas gráficas completas siguen en la v2.
- **Gestantes y nodrizas:** IMC gestacional por semana (curva Atalah), adicional energético por trimestre y lactancia, y bloqueo de las ecuaciones de pliegues que no aplican.
- **Adulto mayor:** puntos de corte de IMC propios y talla estimada por altura de rodilla (Chumlea).
- **Niños y MET:** el compendio juvenil (METy) se calcula siempre en modo TMB.
- **Edad congelada:** la edad se calcula a la fecha del control, en años y meses.
- **Recálculo en cadena:** mediciones → composición → TMB → gasto. Guardar mediciones también recalcula el gasto.
- **ETA:** opción de Configuración, apagada por defecto para no duplicarla.
- **Ingesta en kcal:** cada grupo de alimentos tiene kcal y macronutrientes por porción de intercambio, lo que permite comparar gasto con ingesta sin una base de alimentos.

## Detalle por sprint

### Sprint 0 — Definición y prueba técnica (semanas 1–2)

| Tarea | Horas |
| --- | ---: |
| Sesiones con el profesional: campos de la ficha, perfiles, primera fórmula, protocolo y ecuación, y casos de prueba calculados a mano | 8 |
| Bocetos de pantallas: ficha, control, rutina, mediciones y evolución | 8 |
| Prueba técnica: Electron con base cifrada SQLCipher e instalador NSIS funcionando en el Windows de la consulta | 12 |
| Datos semilla: tabla MET inicial (adultos, juvenil y adultos mayores) y grupos de intercambio con kcal y macronutrientes | 10 |
| Especificación final validada | 2 |
| **Total** | **40** |

Entregable: especificación firmada por el profesional y una prueba técnica instalada en el equipo real. Si el módulo nativo de cifrado falla en Windows, se resuelve aquí, antes de construir encima.

### Sprint 1 — Base técnica (semanas 3–4)

| Tarea | Horas |
| --- | ---: |
| Proyecto con electron-vite, React, TypeScript, Mantine y React Router | 6 |
| Puente IPC tipado: preload `window.nutri`, contratos Zod de entrada y salida, errores legibles | 10 |
| Esquema completo de la base con Drizzle, incluido `profesional_id` | 10 |
| Migraciones automáticas al abrir la aplicación, con respaldo previo | 6 |
| Registro de errores (electron-log), ventana segura (contextIsolation, sandbox) y Vitest | 4 |
| Primer instalador del proyecto real | 4 |
| **Total** | **40** |

Entregable: la aplicación se instala y abre en blanco, con la base cifrada y migrada.

### Sprint 2 — Acceso seguro y pacientes (semanas 5–6)

| Tarea | Horas |
| --- | ---: |
| Cifrado: clave aleatoria protegida por la contraseña y por una clave de recuperación; asistente inicial que genera e imprime la clave | 12 |
| Pantalla de desbloqueo, bloqueo por inactividad y sesión recordada con safeStorage | 6 |
| Ficha del paciente: datos personales, perfil, disciplina, antecedentes, objetivo y consentimiento (del paciente o de su tutor) | 10 |
| Listado con búsqueda y filtros por perfil | 6 |
| Auditoría de cambios en la ficha | 4 |
| Pruebas | 2 |
| **Total** | **40** |

Entregable: se crean, buscan y editan pacientes detrás de una contraseña.

### Sprint 3 — Respaldo y privacidad (semanas 7–8)

| Tarea | Horas |
| --- | ---: |
| Respaldo en caliente al cerrar y a pedido, en la carpeta elegida, con rotación de copias | 8 |
| Restauración con verificación del archivo | 6 |
| Exportar y eliminar los datos de un paciente a pedido | 6 |
| Configuración: carpeta de respaldo y cambio de contraseña | 4 |
| Instalación en el equipo de la consulta y prueba real de restauración | 4 |
| Ajustes por la validación del profesional | 10 |
| Pruebas | 2 |
| **Total** | **40** |

Entregable de la fase 1: el sistema se instala en el computador de la consulta, registra pacientes y se respalda.

### Sprint 4 — Motor de cálculo (semanas 9–10)

| Tarea | Horas |
| --- | ---: |
| Catálogo de fórmulas: id, versión, población, datos requeridos y fuente | 6 |
| Mifflin-St Jeor (adultos) y FAO/OMS/UNU-Schofield (todas las edades), con los casos de prueba del profesional | 8 |
| Gasto por MET en modo estándar y en modo TMB, con MET de reposo para las horas sin asignar | 6 |
| METy juvenil forzado a modo TMB en niños | 3 |
| Adicional de gestación por trimestre y de lactancia; ETA opcional | 5 |
| Gasto semanal: siete días y promedio | 4 |
| Aviso cuando la fórmula no corresponde a la población del paciente | 4 |
| Pruebas | 4 |
| **Total** | **40** |

Entregable: el motor calcula y pasa todos los casos del profesional, todavía sin pantallas.

### Sprint 5 — Rutina semanal (semanas 11–12)

| Tarea | Horas |
| --- | ---: |
| Tabla MET en la base: carga de la semilla, columna de población y filtro por perfil | 6 |
| Control mínimo (paciente y fecha) donde se guarda la rutina | 3 |
| Editor de rutina de 24 horas por día, con bloques de actividad | 10 |
| Copiar un día a otros | 3 |
| Gasto en vivo mientras se edita y tabla de siete días con promedio | 6 |
| Configuración: fórmula por defecto, modo MET, MET de reposo, ETA y edición de la tabla MET | 7 |
| Ajustes por la validación del profesional | 3 |
| Pruebas | 2 |
| **Total** | **40** |

Entregable de la fase 2: gasto calórico por día de la semana para cualquier paciente.

### Sprint 6 — Controles (semanas 13–14)

| Tarea | Horas |
| --- | ---: |
| Ficha de control en pestañas: Rutina, Alimentación, Mediciones, Resultados y Notas | 8 |
| Crear un control copiando la rutina y la alimentación del anterior | 6 |
| Edad congelada a la fecha del control, en años y meses | 2 |
| Resultados congelados con el id y la versión de la fórmula, la ecuación y el protocolo | 6 |
| Recálculo en cadena: mediciones → composición → TMB → gasto | 6 |
| Ajuste manual de valores calculados, con auditoría | 5 |
| Línea de tiempo de controles en la ficha del paciente | 5 |
| Pruebas | 2 |
| **Total** | **40** |

Entregable: cada consulta queda guardada, fechada y recalculable igual que el día en que se hizo.

### Sprint 7 — Antropometría (semanas 15–16)

| Tarea | Horas |
| --- | ---: |
| Catálogo de protocolos y perfil restringido ISAK (pliegues, perímetros y diámetros) | 6 |
| Pantalla de mediciones generada a partir del protocolo | 10 |
| Tomas por sitio: tercera toma si la diferencia supera 5 % en pliegues o 1 % en el resto; valor final por media o mediana | 5 |
| Composición corporal: Durnin-Womersley + Siri (adultos), Slaughter (niños), masa grasa y masa libre de grasa | 8 |
| Masa muscular con la ecuación que defina el profesional (Lee pide además el perímetro de muslo medio) | 4 |
| Katch-McArdle y Cunningham, habilitadas cuando existe la masa libre de grasa | 3 |
| Pruebas con los casos del profesional | 4 |
| **Total** | **40** |

Entregable: se toman mediciones ISAK y se obtiene la composición corporal de cada control.

### Sprint 8 — Diagnóstico por perfil (semanas 17–18)

| Tarea | Horas |
| --- | ---: |
| Tablas LMS de la OMS (2006 y 2007) y cálculo de z-score | 8 |
| Indicadores P/E, P/T, T/E, IMC/E y perímetro cefálico/E, con la clasificación de la norma MINSAL | 6 |
| Protocolo pediátrico básico: peso, longitud o talla y perímetro cefálico | 3 |
| Gestantes: IMC gestacional por semana (Atalah) y bloqueo de ecuaciones de pliegues | 6 |
| Adulto mayor: puntos de corte de IMC propios y talla por altura de rodilla (Chumlea) | 4 |
| Adulto: clasificación del IMC (OMS) y riesgo por perímetro de cintura | 2 |
| Tabla comparativa de controles con sus indicadores | 5 |
| Ajustes por la validación del profesional | 4 |
| Pruebas | 2 |
| **Total** | **40** |

Entregable de la fase 3: diagnóstico nutricional correcto para cada perfil y un historial comparable.

### Sprint 9 — Alimentación (semanas 19–20)

| Tarea | Horas |
| --- | ---: |
| Recordatorio de 24 horas: comidas, hora, tipo, alimento, grupo y porciones | 10 |
| Hidratación: agua y otros líquidos | 2 |
| Frecuencia de consumo por grupo de alimentos | 6 |
| kcal y macronutrientes calculados a partir de las porciones de intercambio | 5 |
| Variedad por grupos de alimentos | 3 |
| Copiar la alimentación del control anterior | 3 |
| Catálogo de grupos de alimentos editable en Configuración | 4 |
| Ajustes por la validación del profesional | 5 |
| Pruebas | 2 |
| **Total** | **40** |

Entregable de la fase 4: registro alimentario por control, con ingesta estimada en kcal.

### Sprint 10 — Dashboard (semanas 21–22)

| Tarea | Horas |
| --- | ---: |
| Canal de series de evolución por paciente y rango de fechas | 6 |
| Gráficos: peso, IMC o z-score, % de grasa, masas, sumatoria de pliegues y perímetros | 12 |
| Gasto semanal por día y comparación de gasto con ingesta | 6 |
| Comparación entre dos controles, con las diferencias | 6 |
| Ajustes por la validación del profesional | 6 |
| Pruebas | 4 |
| **Total** | **40** |

Entregable: lectura visual del avance de cada paciente.

### Sprint 11 — Cierre de la v1 (semanas 23–24)

| Tarea | Horas |
| --- | ---: |
| Recorrido automatizado con Playwright: paciente → control → evolución | 6 |
| Consultas completas con el profesional, de principio a fin | 6 |
| Corrección de errores | 14 |
| Rendimiento con cientos de pacientes y controles | 4 |
| Instalador final y procedimiento de actualización | 4 |
| Guía breve de uso, respaldo y restauración | 4 |
| Revisión de seguridad: ventana, IPC y cifrado | 2 |
| **Total** | **40** |

Criterio de cierre: el profesional atiende una consulta completa sin recurrir a planillas ni papel.

## Línea continua: nuevas fórmulas, ecuaciones y protocolos

Las entradas de catálogo que no están en los sprints se cobran por separado, cada una con sus casos de prueba:

| Entrada | Horas | Valor |
| --- | ---: | ---: |
| Fórmula de gasto basal (por ejemplo, Harris-Benedict revisada) | 4 | $24.000 |
| Ecuación de composición corporal (por ejemplo, Kerr 5 componentes) | 5 | $30.000 |
| Protocolo de medición (por ejemplo, perfil completo ISAK o bioimpedancia) | 8 | $48.000 |
| Actividades MET y grupos de alimentos | 0 | $0 |

Las actividades MET y los grupos de alimentos no tienen costo de desarrollo porque el profesional los agrega desde Configuración.

## No incluido

- **Versión para varios usuarios:** servidor, cuentas, permisos y sincronización. Se estima aparte al cerrar la v1; la v1 solo deja los datos preparados.
- **Revisión legal** del consentimiento y de la conservación de fichas. La Ley 21.719 entra en vigencia el 1 de diciembre de 2026, antes de que termine la v1.
- **Certificado de firma de código,** necesario cuando el instalador se distribuya a otros profesionales.
- **Horas del profesional de nutrición** en validaciones y casos de prueba.
- **Impuestos:** los montos son brutos. Si el developer emite boleta de honorarios, la retención de 2026 (15,25 %) sale de esos montos. Si los $6.000 son líquidos, hay que sumarla.
