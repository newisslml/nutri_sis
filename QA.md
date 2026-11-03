# Pruebas con AgenteQA

Guía para probar Sistema Nutri con AgenteQA (u otro agente con Playwright). AgenteQA no lee este archivo: el bloque del final se pega en su chat.

## Cómo se levanta

- El `Dockerfile` de la raíz construye el **modo web de prueba** (`src/main/web.ts`): la misma interfaz y el mismo backend de la app de escritorio, servidos como página web en el puerto **8080**, sin Electron.
- Cada contenedor parte con la **base vacía** (se guarda en `/tmp/nutri` y se pierde al apagarlo).
- Sin Docker: `npm run build && node out/main/web.js` (http://127.0.0.1:8080).
- Solo para pruebas: nunca con datos reales de pacientes.

## Primer ingreso (obligatorio en cada corrida)

1. Pantalla **Configuración inicial**: "Nombre del profesional", "Contraseña" y "Repetir contraseña" (mínimo 8 caracteres) → botón **Crear base de datos**.
2. Pantalla **Clave de recuperación**: marcar **Ya la imprimí o anoté** → botón **Continuar**. No usar "Imprimir".
3. Queda en el Inicio: **Paciente nuevo** y **Paciente existente**.

Credenciales sugeridas: profesional `QA Prueba`, contraseña `prueba1234`.

El candado arriba a la derecha bloquea la sesión; se vuelve a entrar con la contraseña y el botón **Abrir**.

## Qué probar

- **Paciente nuevo** (ficha): RUT chileno válido o vacío; nombres, apellidos, fecha de nacimiento, sexo y perfil obligatorios; sin **consentimiento** no guarda; menor de 18 años exige nombre del tutor; correo con formato válido.
- **Paciente existente**: búsqueda por nombre o RUT y filtro por perfil.
- **Control** (desde la ficha del paciente): pestañas Rutina y gasto, Antropometría, Pentacompartimental, Bicompartimental, Alimentación, Pauta, Entrega, Motivo y notas, Historial médico. Botón **Guardar** arriba; al salir con cambios sin guardar pide confirmación.
- Los informes (Pentacompartimental, Bicompartimental, Entrega) necesitan fecha, peso y talla en Antropometría; sin eso muestran un aviso, no un error.

Datos de prueba: RUT válidos `12.345.678-5` y `6.000.000-K`; inválido `12.345.678-9`.

## Comportamiento esperado que no es bug

- **Guardar informes PDF** (pestaña Entrega) responde "El PDF solo se genera en la app de escritorio": en el modo web no hay PDF.
- La sesión es **una sola por servidor**: dos pestañas o pruebas en paralelo comparten la misma sesión y los mismos datos.
- Antes de crear la base o con la sesión bloqueada, todo lo demás responde "La base de datos está bloqueada".
- Limitación conocida: la búsqueda de pacientes no ignora acentos ("jose" no encuentra "José").

## API (pruebas de endpoints)

`POST /api/<canal>` con cuerpo JSON `{"entrada": ...}` (sin `entrada` en los canales que no reciben nada). La respuesta es **siempre HTTP 200** con `{"ok": true, "datos": ...}` o `{"ok": false, "error": "mensaje legible"}`: el resultado se mira en `ok`, no en el código HTTP. JSON mal formado devuelve 400.

| Canal | Entrada |
| --- | --- |
| `sesion.estado` | — |
| `sesion.configurar` | `{"nombreProfesional": "QA Prueba", "contrasena": "prueba1234"}` |
| `sesion.desbloquear` | `{"secreto": "prueba1234"}` (contraseña o clave de recuperación) |
| `sesion.bloquear` | — |
| `pacientes.listar` | `{"busqueda": "", "perfil": null}` |
| `pacientes.obtener` | `{"id": 1}` |
| `pacientes.guardar` | ver ejemplo abajo |
| `catalogos.met` | — |
| `controles.listar` / `controles.crear` / `controles.evolucion` | `{"pacienteId": 1}` |
| `controles.obtener` / `controles.descartar` | `{"id": 1}` |
| `controles.guardar` | el control que devuelve `controles.obtener`, con los cambios; `pesoKg` es obligatorio |

Perfiles: `nino`, `adolescente`, `adulto`, `adulto_mayor`, `deportista`, `gestante`.

Ejemplo de `pacientes.guardar` válido:

```json
{"entrada": {"rut": "12.345.678-5", "nombres": "Ana", "apellidos": "Prueba Uno", "fechaNacimiento": "1995-04-12",
  "sexo": "F", "semanasGestacion": null, "pesoNacerG": null, "perfil": "deportista", "disciplina": "Running",
  "direccion": "", "telefono": "", "correo": "", "preferencia": "omnivoro", "sintomas": [], "tabaco": "",
  "alcohol": "", "objetivo": "Bajar grasa", "consentimiento": true, "tutorNombre": ""}}
```

## Para pegar en el chat de AgenteQA

```text
App: Sistema Nutri, sistema de consultas de nutrición (React + Mantine). Se levanta con el Dockerfile del repo, puerto 8080, base vacía en cada corrida.
Primer ingreso obligatorio: en "Configuración inicial" escribir Nombre del profesional "QA Prueba", Contraseña y Repetir contraseña "prueba1234", botón "Crear base de datos". Luego marcar "Ya la imprimí o anoté" y botón "Continuar". No usar "Imprimir".
Para volver a entrar después de bloquear (candado arriba a la derecha): contraseña "prueba1234", botón "Abrir".
Probar: crear paciente (RUT válido 12.345.678-5, consentimiento obligatorio, menor de 18 exige tutor), buscar paciente, crear un control y guardar peso y talla en Antropometría, revisar informes y pestaña Entrega.
No es bug: "Guardar informes PDF" responde "El PDF solo se genera en la app de escritorio". La API es POST /api/<canal> con {"entrada": ...} y responde siempre HTTP 200; el éxito se mira en el campo "ok".
```
