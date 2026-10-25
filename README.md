# ProdSim IA - Barranquilla

Simulador académico para el análisis OEE de una planta sintética de bebidas
naturales.

## Alcance

ProdSim IA analiza cinco procesos: recepción y lavado, despulpado y mezclado,
pasteurización, empaque y paletizado. Permite editar variables, calcular
disponibilidad, rendimiento, calidad y OEE, comparar escenarios de mejora,
ejecutar una simulación y exportar reportes gerenciales en PDF y Excel.

Los datos son sintéticos y se incluyen exclusivamente con fines académicos.
La aplicación no usa Azure, credenciales, marcas corporativas ni datos
empresariales reales.

## Tecnologías

- React
- Vite
- Tailwind CSS
- Chart.js
- jsPDF
- ExcelJS

## Ejecución local

```powershell
npm install
npm run dev
```

Abre `http://localhost:5173/`.

## Build de producción

```powershell
npm run build
```

## Metodología OEE

```text
OEE = Disponibilidad x Rendimiento x Calidad
Disponibilidad = (Tiempo disponible - Paros) / Tiempo disponible
Rendimiento = Velocidad real / Capacidad nominal
Calidad = 100 - Porcentaje de defectos
```
