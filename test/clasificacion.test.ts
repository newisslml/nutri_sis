// Clasificaciones del informe: puntos de corte de la hoja FORMS de la ficha maestra.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clasificarGrasa, clasificarMusculo, estadoNutricional, pesoIdealKg, riesgoCardiovascular } from '../src/calculo/clasificacion.ts'

test('estado nutricional por IMC: cada corte pertenece al tramo de arriba', () => {
  assert.equal(estadoNutricional(18.4, 30)?.etiqueta, 'Enflaquecido')
  assert.equal(estadoNutricional(18.5, 30)?.etiqueta, 'Normal')
  assert.equal(estadoNutricional(26.16, 30)?.etiqueta, 'Sobrepeso') // paciente de la hoja
  assert.equal(estadoNutricional(35, 30)?.etiqueta, 'Obesidad II')
  assert.equal(estadoNutricional(40, 30)?.etiqueta, 'Obesidad III')
})

test('estado nutricional del adulto mayor usa otros cortes y en menores de 18 no aplica', () => {
  assert.equal(estadoNutricional(24, 70)?.etiqueta, 'Normal')
  assert.equal(estadoNutricional(22, 70)?.etiqueta, 'Enflaquecido') // a los 30 años, 22 sería normal
  assert.equal(estadoNutricional(17, 70)?.etiqueta, 'Enflaquecido') // sin tramo "desnutrido" en la tabla de Fabi
  assert.equal(estadoNutricional(23.04, 70)?.etiqueta, 'Enflaquecido') // ≤ 23,0
  assert.equal(estadoNutricional(23.1, 70)?.etiqueta, 'Normal')
  assert.equal(estadoNutricional(27.9, 70)?.etiqueta, 'Normal')
  assert.equal(estadoNutricional(28, 70)?.etiqueta, 'Sobrepeso')
  assert.equal(estadoNutricional(31.9, 70)?.etiqueta, 'Sobrepeso')
  assert.equal(estadoNutricional(32, 70)?.etiqueta, 'Obesidad')
  assert.equal(estadoNutricional(22, 12), null)
})

test('gestantes: curva de Atalah por semana, con un decimal', () => {
  assert.equal(estadoNutricional(18.4, 30, 6)?.etiqueta, 'Bajo peso')
  assert.equal(estadoNutricional(18.5, 30, 6)?.etiqueta, 'Normal')
  assert.equal(estadoNutricional(30.0, 30, 7)?.etiqueta, 'Sobrepeso')
  assert.equal(estadoNutricional(30.1, 30, 7)?.etiqueta, 'Obesidad')
  assert.equal(estadoNutricional(26.7, 30, 24)?.etiqueta, 'Normal')
  assert.equal(estadoNutricional(26.8, 30, 24)?.etiqueta, 'Sobrepeso')
  assert.equal(estadoNutricional(23.24, 30, 42)?.etiqueta, 'Bajo peso') // ≤ 23,2
  assert.equal(estadoNutricional(33, 30, 42)?.etiqueta, 'Obesidad')
  assert.equal(estadoNutricional(20.1, 30, 22)?.etiqueta, 'Bajo peso') // sin gestación sería normal
  assert.equal(estadoNutricional(24, 30, 5), null)
  assert.equal(estadoNutricional(24, 30, 43), null)
})

test('riesgo cardiovascular por cintura y sexo', () => {
  assert.equal(riesgoCardiovascular(85.3, 'M', 30)?.etiqueta, 'Normal') // paciente de la hoja
  assert.equal(riesgoCardiovascular(94, 'M', 30)?.etiqueta, 'Elevado')
  assert.equal(riesgoCardiovascular(102, 'M', 30)?.etiqueta, 'Muy elevado')
  assert.equal(riesgoCardiovascular(80, 'F', 30)?.etiqueta, 'Elevado')
  assert.equal(riesgoCardiovascular(88, 'F', 30)?.nivel, 'riesgo')
  assert.equal(riesgoCardiovascular(70, 'F', 15), null)
})

test('peso ideal: talla² × 23 en hombres y × 21,5 en mujeres', () => {
  assert.ok(Math.abs(pesoIdealKg(171, 'M') - 67.2543) < 1e-4) // hoja ANT!N50
  assert.ok(Math.abs(pesoIdealKg(160, 'F') - 55.04) < 1e-9)
})

test('% de grasa: cortes por sexo y edad, cada corte pertenece al tramo de arriba', () => {
  assert.equal(clasificarGrasa(13.6, 30, 'M')?.etiqueta, 'Normal') // paciente de la hoja
  assert.equal(clasificarGrasa(7.9, 30, 'M')?.etiqueta, 'Baja')
  assert.equal(clasificarGrasa(25, 30, 'M')?.etiqueta, 'Obesidad')
  assert.equal(clasificarGrasa(25, 65, 'M')?.etiqueta, 'Alta') // desde los 60 años el corte de obesidad sube a 30
  assert.equal(clasificarGrasa(33, 30, 'F')?.etiqueta, 'Alta')
  assert.equal(clasificarGrasa(33, 45, 'F')?.etiqueta, 'Normal') // entre 40 y 59 años el corte sube a 35
  assert.deepEqual(clasificarGrasa(20, 30, 'F')?.cortes, [21, 33, 39])
  assert.equal(clasificarGrasa(20, 15, 'F'), null)
})

test('% de masa muscular: el valor en un corte pertenece al tramo de abajo', () => {
  assert.equal(clasificarMusculo(48.38, 'M').etiqueta, 'Normal') // paciente de la hoja (BI!R32)
  assert.equal(clasificarMusculo(44, 'M').etiqueta, 'Bajo')
  assert.equal(clasificarMusculo(54.2, 'M').etiqueta, 'Bueno')
  assert.equal(clasificarMusculo(54.3, 'M').etiqueta, 'Excelente')
  assert.equal(clasificarMusculo(47.5, 'F').etiqueta, 'Bueno')
  assert.equal(clasificarMusculo(36.4, 'F').nivel, 'riesgo')
})
