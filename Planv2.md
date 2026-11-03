# Plan v2 — Ecosistema Sistema Nutri (borrador)

Actualizado: 22 de octubre de 2026

Este documento reúne las ideas y estimaciones conversadas para una eventual v2. No es un compromiso ni un acuerdo firmado: todas las cifras son estimaciones propias, sin cotizaciones, salvo donde se indican fuentes. La v2 solo se inicia después de cerrar la v1 local para el primer cliente (ver `Planv1.md` y `Sprints_v1.md`).

## Punto de partida: la v1 local

- Aplicación de escritorio para un solo profesional (Fabi), con los datos cifrados en su computador, sin servidor ni internet.
- Precio propuesto para la v1 con lo agregado: $280.000 CLP ($120.000 por la v1 y el PDF del informe de composición corporal, más $160.000 por la pauta alimentaria con su PDF). Propuesto, no confirmado.
- El tablero de Trello "Nutri_sis" tiene las tarjetas pendientes de la v1 (#18 a #49), separadas en "Pendientes Newis" y "Pendientes Fabi".

## Alcance de la v2

| Módulo | Qué incluye |
| --- | --- |
| Nube y cuentas | Servidor, base de datos, login para nutricionistas y pacientes, varios profesionales, permisos |
| Sincronización | Datos entre el escritorio y la nube, con manejo de conflictos |
| App móvil del paciente | Ver su pauta, su informe antropométrico y sus controles; ver y pedir su próximo control |
| Agenda | Disponibilidad del profesional, reservas, recordatorios |
| Suscripciones | Cobro mensual y anual, licencias, panel de administración |
| Ciberseguridad y legal | Cifrado, doble factor, auditoría de accesos, consentimiento digital, contratos |

Camino recomendado: primero una licencia por suscripción con datos locales (cada nutricionista conserva sus datos en su computador, sin que la sociedad aloje datos de salud ajenos), y después la nube y la app de paciente como proyecto aparte.

## Esfuerzo y costo de desarrollo

Estimado a $6.000 CLP por hora de developer, la misma base de `Sprints_v1.md`.

| Concepto | Valor |
| --- | --- |
| Horas base | 620 a 740 h |
| Con contingencia del 15 % | 710 a 850 h |
| Valor equivalente | $4,3 a $5,1 millones |

| Escenario | Desembolso en dinero | Tiempo |
| --- | --- | --- |
| Un developer con Claude | $0,7 a $1,5 millones (abogado, revisión de seguridad, tiendas de apps, hosting el primer año) | 250 a 350 h del developer |
| Con un developer externo por horas | $2,5 a $4,5 millones | 300 a 400 h externas más el desembolso anterior |
| Tres socios desarrolladores | Solo el desembolso del primer escenario | Unas 17 semanas, con unas 50 h semanales en total |

## Equipo y sociedad

- Sociedad (SpA) con 3 socios desarrolladores.
- Roles mínimos: backend con experiencia en seguridad, desarrollo de la app móvil y líder de producto, escritorio y calidad.
- Servicios externos, no socios: pentest antes de lanzar y abogado.
- En el pacto de socios definir: porcentajes con vesting, obligaciones de trabajo de cada uno y cesión del código a la sociedad. No repartir por partes iguales sin compromisos de horas.

## Ciberseguridad y datos sensibles

- Cifrado en tránsito y en reposo.
- Doble factor para nutricionistas; acceso de pacientes con código por correo o biometría.
- Cada paciente ve solo lo suyo; registro de accesos; respaldos cifrados.
- Consentimiento digital, con el tutor en el caso de menores.
- Procedimiento para informar vulneraciones.
- Con la nube, la sociedad trata los datos por encargo de cada nutricionista, lo que requiere un contrato y confirmar con un abogado el término legal exacto.
- La Ley 21.719 entra en vigencia el 1 de diciembre de 2026, con un proyecto del Ejecutivo para postergarla que conviene confirmar (ver `Planv1.md`).

## Fabi: participación propuesta

Fabi queda fuera de la SpA de desarrollo, como socio comercial y clínico. Hasta hoy ha dedicado unas 6 horas en 3 reuniones, más el material que envía, y le queda material pendiente.

| Concepto | Propuesta |
| --- | --- |
| Licencia | Gratuita de por vida, con todas las versiones nuevas |
| Clientes que traiga | 15 % recurrente, mientras el cliente pague y él siga activo |
| Mejoras nutricionales y contenido | 5 % de los ingresos netos de toda la plataforma, con un mínimo de 6 a 8 horas al mes y revisión anual |
| Capacitación | 100 % de lo que cobre por las sesiones que dé |
| Acciones de la SpA | No por ahora; máximo 5 a 10 % con vesting de 4 años y plazo inicial de 12 meses, solo si se compromete con horas y clientes |

Capacitación de los clientes nuevos: un tutorial incluido en el precio (guía en PDF y videos cortos) y una sesión de incorporación en vivo, opcional y aparte, de unos $30.000 a $50.000 una sola vez. Fabi cubre el uso clínico y la sociedad lo técnico.

## Precio de la mensualidad

| Plan | Qué incluye | Precio |
| --- | --- | --- |
| Básico | Sistema local, sin nube | $19.990 al mes |
| Completo | Nube, app de paciente, agenda y login | $34.990 al mes, o $349.900 al año (10 meses pagados) |

- Lanzamiento sugerido para los primeros 5 clientes: precio rebajado durante 6 meses (por ejemplo $14.990 en el plan Básico).
- Referencia de mercado: Nutrium cobra US$25 a 39 al mes en su plan ilimitado, según blogs de un competidor suyo; hay que verificarlo en su página.
- Tipo de cambio de referencia: unos 960 CLP por dólar (cierre del 18 de septiembre de 2026).
- Definir si el precio incluye IVA. Los cálculos de abajo asumen que sí.

## Rentabilidad (plan Completo)

Supuestos por cliente al mes:

| Concepto | Monto |
| --- | --- |
| Precio con IVA | $34.990 |
| Neto sin IVA | $29.403 |
| Menos 4 % de la pasarela de pago | unos $28.200 |
| Menos infraestructura por cliente | $2.000 |
| Menos pago a Fabi (promedio de 12 %) | unos $3.400 |
| **Queda por cliente** | **unos $22.800** |

El 12 % sale de 5 % de toda la plataforma más 15 % sobre la parte de clientes que él traiga; supone que cerca de la mitad son suyos.

| Si Fabi trae | Queda por cliente | Clientes para el equilibrio |
| --- | --- | --- |
| Ninguno (5 %) | $24.800 | 19 |
| La mitad (12 %) | $22.800 | 20 |
| Todos (20 %) | $20.600 | 22 |

Costos fijos supuestos: $450.000 al mes.

| Concepto | Monto |
| --- | --- |
| Hosting y base de datos en la nube | $150.000 |
| Seguridad y respaldos | $100.000 |
| Contabilidad y legal recurrente | $100.000 |
| Herramientas y suscripciones (desarrollo, correo, notificaciones, mensajes de recordatorio, dominio, tiendas de apps) | $100.000 |

No incluye sueldos, el pentest anual, la firma de código ni el costo de los mensajes de recordatorio, que crece con el uso. Con pocos clientes, el costo real del primer año probablemente sea menor.

Utilidad con 3 socios que cobran por igual, antes de impuestos:

| Clientes | Utilidad mensual | Por socio |
| --- | --- | --- |
| 20 | $6.000 | $2.000 |
| 40 | $462.000 | $154.000 |
| 60 | $918.000 | $306.000 |
| 86 | $1.511.000 | $504.000 |
| 100 | $1.830.000 | $610.000 |
| 151 | $2.993.000 | $998.000 |
| 180 | $3.654.000 | $1.218.000 |

- Antes de llegar a 20 clientes, los socios cubren la diferencia: hasta $150.000 cada uno con 0 clientes.
- Con 100 clientes o más, los costos fijos probablemente suban a unos $700.000 por soporte e infraestructura. Entonces $1,2 millones por socio requiere de 180 a 200 clientes.
- No descuenta bajas de clientes, impuestos de la sociedad ni el tiempo de soporte.
- Ejemplo de ritmo, no pronóstico: con 3 clientes nuevos al mes se llega a 20 en unos 7 meses y a 100 en casi 3 años; con 5 al mes, a 20 en 4 meses y a 100 en unos 20.
- Recomendación: mantener los trabajos actuales hasta pasar los 60 clientes.

## Pendientes antes de decidir

- [ ] Cerrar la v1 local para Fabi y confirmar el precio acordado.
- [ ] Hablar con un abogado: constitución de la SpA, pacto de socios, términos de servicio, política de privacidad y contrato de tratamiento de datos.
- [ ] Cotizar hosting, contador y pentest con precios reales.
- [ ] Verificar los precios de la competencia en sus páginas oficiales.
- [ ] Confirmar con Fabi sus horas reales y su compromiso futuro.
- [ ] Decidir si el precio incluye IVA y cómo se factura.
- [ ] Probar la demanda con la v1 local antes de invertir en la nube.

## Fuentes consultadas

- [Reseña de Nutrium (2026)](https://www.promealplan.com/es/blog/nutrium-resena-2026)
- [Nutrium vs NutriAdmin](https://www.promealplan.com/es/blog/nutrium-vs-nutriadmin-comparativa-dietistas)
- [Cronoshare: costo de un nutricionista online](https://www.cronoshare.cl/cuanto-cuesta/nutricionista-online)
- [Bloomberg Línea: USD/CLP](https://www.bloomberglinea.com/quote/USDCLP:CUr/)
