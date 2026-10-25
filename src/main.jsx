import React from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Download, Gauge, Pause, Play, RotateCcw, Settings2, Sparkles, TrendingDown, TrendingUp, X, Zap } from 'lucide-react';
import { Bar, Doughnut, Line, Scatter } from 'react-chartjs-2';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import jsPDF from 'jspdf';
import ExcelJS from 'exceljs';
import './index.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

const defaultProcesses = [
  { id: 1, name: 'RECEPCIÓN Y LAVADO', capacity: 1200, target: 9600, available: 480, stops: 18, defects: 2.2, actualSpeed: 1040, produced: 8200 },
  { id: 2, name: 'DESPULPADO / MEZCLADO', capacity: 980, target: 7840, available: 480, stops: 26, defects: 3.4, actualSpeed: 830, produced: 6500 },
  { id: 3, name: 'PASTEURIZACIÓN', capacity: 1105, target: 8840, available: 480, stops: 35, defects: 4.2, actualSpeed: 875, produced: 6900 },
  { id: 4, name: 'EMPAQUE', capacity: 950, target: 7600, available: 480, stops: 64, defects: 6.2, actualSpeed: 690, produced: 5100 },
  { id: 5, name: 'PALETIZADO', capacity: 720, target: 5760, available: 480, stops: 15, defects: 1.8, actualSpeed: 665, produced: 5350 }
];
const average = (list, key) => list.length ? list.reduce((sum, item) => sum + item[key], 0) / list.length : 0;
const format = value => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
const money = value => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

function calculate(process, scenario = 'Base actual', stopCost = 15000) {
  const stopFactor = scenario === 'Reducir paros 25%' ? .75 : 1;
  const defectFactor = scenario === 'Reducir defectos 50%' ? .5 : 1;
  const speedFactor = scenario === 'Aumentar velocidad 10%' ? 1.1 : 1;
  const stops = process.stops * stopFactor;
  const defects = process.defects * defectFactor;
  const actualSpeed = process.actualSpeed * speedFactor;
  const availability = Math.max(0, Math.min(100, ((process.available - stops) / Math.max(1, process.available)) * 100));
  const performance = Math.max(0, Math.min(100, actualSpeed / Math.max(1, process.capacity) * 100));
  const quality = Math.max(0, 100 - defects);
  const oee = availability * performance * quality / 10000;
  const real = process.produced * speedFactor;
  return { ...process, stops, defects, actualSpeed, availability, performance, quality, oee, real, compliance: real / Math.max(1, process.target) * 100, stopImpact: stops * stopCost, lost: process.capacity * stops / 60 };
}

const options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } } } }, scales: { x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } }, y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#1e293b' } } } };

function Card({ label, value, detail, icon: Icon, tone = 'cyan' }) {
  const color = tone === 'red' ? 'text-rose-400' : tone === 'amber' ? 'text-amber-400' : tone === 'green' ? 'text-emerald-400' : 'text-cyan-400';
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl shadow-black/10"><div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-slate-500"><span>{label}</span><Icon size={18} className={color} /></div><div className="mt-3 font-mono text-3xl font-black text-white">{value}</div><div className="mt-1 text-xs text-slate-400">{detail}</div></div>;
}

function App() {
  const [processes, setProcesses] = React.useState(defaultProcesses);
  const [targetOee, setTargetOee] = React.useState(85);
  const [defectLimit, setDefectLimit] = React.useState(5);
  const [stopCost, setStopCost] = React.useState(15000);
  const [tab, setTab] = React.useState('resumen');
  const [scenario, setScenario] = React.useState('Base actual');
  const [running, setRunning] = React.useState(false);
  const [hasStarted, setHasStarted] = React.useState(false);
  const [simulationSpeed, setSimulationSpeed] = React.useState(1);
  const [simulationMinute, setSimulationMinute] = React.useState(0);
  const [trend, setTrend] = React.useState([]);
  const timer = React.useRef(null);
  const rows = processes.map(process => calculate(process, scenario, stopCost));
  const oee = average(rows, 'oee');
  const availability = average(rows, 'availability');
  const performance = average(rows, 'performance');
  const quality = average(rows, 'quality');
  const defects = average(rows, 'defects');
  const produced = rows.reduce((sum, row) => sum + row.real, 0);
  const target = rows.reduce((sum, row) => sum + row.target, 0);
  const compliance = produced / Math.max(1, target) * 100;
  const cost = rows.reduce((sum, row) => sum + row.stopImpact, 0);
  const lost = rows.reduce((sum, row) => sum + row.lost, 0);
  const bottleneck = rows.reduce((low, row) => row.oee < low.oee ? row : low, rows[0]);
  const worstQuality = rows.reduce((high, row) => row.defects > high.defects ? row : high, rows[0]);
  const improved = bottleneck ? calculate(bottleneck, 'Reducir paros 25%', stopCost).oee : 0;
  const state = row => row.oee > targetOee ? 'Óptimo' : row.oee >= 60 ? 'Alerta' : 'Cuello de botella';
  const productMix = ['Naranja', 'Uva', 'Tamarindo', 'Mandarina', 'Agua con gas', 'Agua sin gas'].map((name, index) => ({ name, volume: Math.round(produced * [0.24, 0.18, 0.13, 0.16, 0.15, 0.14][index]) }));
  const scenarioNames = ['Base actual', 'Reducir paros 25%', 'Reducir defectos 50%', 'Aumentar velocidad 10%'];
  const scenarioResults = scenarioNames.map(name => {
    const scenarioRows = processes.map(process => calculate(process, name, stopCost));
    return {
      name,
      oee: average(scenarioRows, 'oee'),
      cost: scenarioRows.reduce((sum, row) => sum + row.stopImpact, 0),
      lost: scenarioRows.reduce((sum, row) => sum + row.lost, 0)
    };
  });
  const bestScenario = scenarioResults.reduce((best, result) => result.oee > best.oee ? result : best, scenarioResults[0]);

  React.useEffect(() => () => clearInterval(timer.current), []);
  React.useEffect(() => {
    if (!running) return undefined;
    timer.current = setInterval(() => {
      setSimulationMinute(value => value + 1);
      setProcesses(current => current.map(process => ({ ...process, produced: process.produced + Math.max(1, Math.round(process.actualSpeed / 60 * (1 - process.defects / 100))), stops: process.stops + (Math.random() < .03 ? 1 : 0) })));
    }, 1000 / simulationSpeed);
    return () => clearInterval(timer.current);
  }, [running, simulationSpeed]);
  React.useEffect(() => { if (simulationMinute) setTrend(current => [...current.slice(-11), { label: `${simulationMinute} min`, value: average(processes, 'actualSpeed') }]); }, [simulationMinute]);

  const update = (id, field, value) => setProcesses(current => current.map(process => process.id === id ? { ...process, [field]: field === 'name' ? value : Number(value) } : process));
  const add = () => { const id = Math.max(0, ...processes.map(item => item.id)) + 1; setProcesses([...processes, { id, name: `NUEVO PROCESO ${id}`, capacity: 1000, target: 8000, available: 480, stops: 10, defects: 2, actualSpeed: 850, produced: 5000 }]); };
  const remove = id => setProcesses(current => current.filter(item => item.id !== id));
  const reset = () => { setRunning(false); setHasStarted(false); setSimulationMinute(0); setTrend([]); setScenario('Base actual'); setProcesses(defaultProcesses); };
  const insight = oee > targetOee
    ? `Planta en nivel World Class: OEE general ${oee.toFixed(1)}%, superior al objetivo editable de ${targetOee}%. Replica el estándar de ${rows.sort((a, b) => b.oee - a.oee)[0]?.name}.`
    : `Alerta de cuello de botella: ${bottleneck?.name} opera en ${bottleneck?.oee.toFixed(1)}% OEE. Tiene ${bottleneck?.stops.toFixed(0)} minutos de paro, genera aproximadamente ${format(bottleneck?.lost)} litros no producidos y cuesta ${money(bottleneck?.stopImpact)}. Reducir paros 25% proyecta ${improved.toFixed(1)}% OEE en este proceso.`;
  const qualityInsight = defects > defectLimit
    ? `Riesgo de calidad: la tasa global de defectos es ${defects.toFixed(1)}%, por encima del límite ${defectLimit}%. ${worstQuality?.name} concentra el mayor riesgo con ${worstQuality?.defects.toFixed(1)}%. Reducir sus defectos a ${defectLimit}% recuperaría aproximadamente ${format(worstQuality?.real * (worstQuality?.defects - defectLimit) / 100)} litros conformes.`
    : `Calidad controlada: la tasa global de defectos (${defects.toFixed(1)}%) está dentro del límite de ${defectLimit}%. Mantén inspección en ${worstQuality?.name}.`;

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const data = workbook.addWorksheet('Datos');
    data.addRows([['PRODSIM IA - DATOS SINTÉTICOS DE PLANTA'], [], ['Proceso', 'Capacidad L/h', 'Meta L/turno', 'Paros min', 'Defectos %', 'Real L', 'Cumplimiento %', 'Disponibilidad %', 'Rendimiento %', 'Calidad %', 'OEE %', 'Impacto COP'], ...rows.map(row => [row.name, row.capacity, row.target, row.stops, row.defects / 100, row.real, row.compliance / 100, row.availability / 100, row.performance / 100, row.quality / 100, row.oee / 100, row.stopImpact])]);
    const kpis = workbook.addWorksheet('KPIs');
    kpis.addRows([['PRODSIM IA - KPIs Y ANÁLISIS'], [], ['Indicador', 'Valor'], ['Escenario', scenario], ['OEE general', oee / 100], ['Disponibilidad', availability / 100], ['Rendimiento', performance / 100], ['Calidad', quality / 100], ['Velocidad promedio L/h', average(rows, 'actualSpeed')], ['Cumplimiento plan', compliance / 100], ['Defectos', defects / 100], ['Costo paros COP', cost], ['Conclusión', insight], ['Calidad', qualityInsight]]);
    const methodology = workbook.addWorksheet('Metodología');
    methodology.addRows([
      ['PRODSIM IA - METODOLOGÍA Y SUPUESTOS'],
      [],
      ['Elemento', 'Descripción'],
      ['OEE', 'Disponibilidad x Rendimiento x Calidad'],
      ['Disponibilidad', '(Tiempo disponible - paros) / tiempo disponible'],
      ['Rendimiento', 'Velocidad real / capacidad nominal'],
      ['Calidad', '100 - porcentaje de defectos'],
      ['Datos', 'Sintéticos, generados para fines académicos'],
      ['Unidad', 'Litros por hora y litros por turno'],
      ['Operación', 'Turno sintético de 480 minutos'],
      ['Objetivo', 'Comparar escenarios y priorizar mejoras operativas'],
      ['Alcance', 'No usa Azure, credenciales ni datos empresariales reales']
    ]);
    const charts = workbook.addWorksheet('Gráficas');
    charts.addRows([
      ['PRODSIM IA - GRÁFICAS EJECUTIVAS'],
      [],
      ['OEE por proceso', 'OEE %'],
      ...rows.map(row => [row.name, row.oee / 100]),
      [],
      ['Escenario', 'OEE %', 'Costo paros COP', 'Litros perdidos'],
      ...scenarioResults.map(result => [result.name, result.oee / 100, result.cost, result.lost])
    ]);
    [data, kpis, methodology].forEach(sheet => { sheet.getRow(1).font = { bold: true, color: { argb: '22D3EE' }, size: 14 }; sheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFF' } }; sheet.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '123044' } }; sheet.columns.forEach(column => { column.width = 24; }); });
    [5, 7, 8, 9, 10, 11].forEach(columnNumber => { data.getColumn(columnNumber).numFmt = '0.0%'; });
    data.getColumn(12).numFmt = '"COP" #,##0';
    kpis.getColumn(2).numFmt = '0.0%';
    kpis.getCell('B9').numFmt = '#,##0';
    kpis.getCell('B12').numFmt = '"COP" #,##0';
    charts.getColumn(1).width = 30;
    charts.getColumn(2).width = 16;
    charts.getColumn(3).width = 20;
    charts.getColumn(4).width = 18;
    charts.getColumn(2).numFmt = '0.0%';
    charts.getColumn(3).numFmt = '"COP" #,##0';
    charts.getColumn(4).numFmt = '#,##0';
    charts.getRow(1).font = { bold: true, color: { argb: '22D3EE' }, size: 14 };
    charts.getRow(3).font = { bold: true, color: { argb: 'FFFFFF' } };
    charts.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '123044' } };
    const createChartImage = (labels, values, colors, title, maxValue = 100) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 440;
      const context = canvas.getContext('2d');
      context.fillStyle = '#0f172a';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#e2e8f0';
      context.font = 'bold 24px Arial';
      context.fillText(title, 32, 42);
      const chartLeft = 270;
      const chartTop = 75;
      const chartWidth = 650;
      const rowHeight = Math.min(62, 300 / Math.max(1, labels.length));
      labels.forEach((label, index) => {
        const y = chartTop + index * rowHeight;
        const value = values[index];
        context.fillStyle = '#94a3b8';
        context.font = '18px Arial';
        context.fillText(label.substring(0, 30), 32, y + 24);
        context.fillStyle = '#1e293b';
        context.fillRect(chartLeft, y + 4, chartWidth, 24);
        context.fillStyle = colors[index] || '#22d3ee';
        context.fillRect(chartLeft, y + 4, chartWidth * Math.max(0, Math.min(value, maxValue)) / maxValue, 24);
        context.fillStyle = '#f8fafc';
        context.font = 'bold 18px Arial';
        context.fillText(`${value.toFixed(1)}%`, chartLeft + chartWidth + 12, y + 24);
      });
      return canvas.toDataURL('image/png');
    };
    const processImage = createChartImage(rows.map(row => row.name), rows.map(row => row.oee), rows.map(row => row.oee >= targetOee ? '#34d399' : row.oee >= 60 ? '#f59e0b' : '#fb7185'), 'OEE por proceso');
    const scenarioImage = createChartImage(scenarioResults.map(result => result.name), scenarioResults.map(result => result.oee), scenarioResults.map(result => result.name === bestScenario.name ? '#34d399' : '#22d3ee'), 'Escenarios de mejora');
    const processImageId = workbook.addImage({ base64: processImage, extension: 'png' });
    const scenarioImageId = workbook.addImage({ base64: scenarioImage, extension: 'png' });
    charts.addImage(processImageId, 'F2:N18');
    charts.addImage(scenarioImageId, 'F20:N36');
    const buffer = await workbook.xlsx.writeBuffer(); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([buffer])); link.download = 'prodsim-ia-reporte.xlsx'; link.click();
  };
  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setTextColor(10, 15, 30);
    doc.setFontSize(20);
    doc.text('ProdSim IA - Barranquilla', 18, 20);
    doc.setFontSize(10);
    doc.text(`Informe sintético | Escenario: ${scenario} | ${new Date().toLocaleDateString('es-CO')}`, 18, 29);
    doc.text(`OEE ${oee.toFixed(1)}% | Disponibilidad ${availability.toFixed(1)}% | Rendimiento ${performance.toFixed(1)}% | Calidad ${quality.toFixed(1)}%`, 18, 41);
    doc.text(`Producción ${format(produced)} L | Cumplimiento ${compliance.toFixed(1)}% | Paros ${money(cost)}`, 18, 49);
    doc.setFontSize(13);
    doc.text('OEE por proceso', 18, 61);
    rows.forEach((row, index) => {
      const y = 68 + index * 9;
      const barWidth = Math.max(2, row.oee * 1.15);
      doc.setFillColor(row.oee > targetOee ? 22 : row.oee >= 60 ? 245 : 244, row.oee > targetOee ? 163 : row.oee >= 60 ? 158 : 63, row.oee > targetOee ? 74 : row.oee >= 60 ? 11 : 94);
      doc.rect(80, y - 4, barWidth, 5, 'F');
      doc.setTextColor(10, 15, 30);
      doc.setFontSize(8);
      doc.text(`${row.name.substring(0, 28)}: ${row.oee.toFixed(1)}%`, 18, y);
    });
    doc.setFontSize(13);
    doc.text('Comparación de escenarios', 18, 122);
    scenarioResults.forEach((result, index) => {
      const y = 130 + index * 8;
      doc.setFillColor(result.name === scenario ? 34 : 100, result.name === scenario ? 211 : 116, result.name === scenario ? 238 : 139);
      doc.rect(80, y - 4, Math.max(2, result.oee * 1.15), 5, 'F');
      doc.setTextColor(10, 15, 30);
      doc.setFontSize(8);
      doc.text(`${result.name}: ${result.oee.toFixed(1)}% OEE | ${format(result.lost)} L perdidos`, 18, y);
    });
    doc.setFontSize(13);
    doc.text('Metodología OEE', 18, 170);
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize('OEE = Disponibilidad x Rendimiento x Calidad. Disponibilidad = (tiempo disponible - paros) / tiempo disponible. Rendimiento = velocidad real / capacidad nominal. Calidad = 100 - defectos. Todos los datos son sintéticos y se analizan localmente.', 174), 18, 178);
    doc.setFontSize(13);
    doc.text('Conclusiones', 18, 202);
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(`${insight} ${qualityInsight}`, 174), 18, 210);
    doc.save('prodsim-ia-informe.pdf');
  };

  const tabs = [['resumen', 'Resumen General', Gauge], ['oee', 'Análisis OEE', Activity], ['produccion', 'Métricas de Producción', Settings2], ['calidad', 'Insights Calidad', Sparkles]];
  return <div className="grid-bg min-h-screen">
    <aside className="fixed hidden h-screen w-64 flex-col border-r border-slate-800 bg-slate-950/95 p-6 lg:flex"><div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-400 p-2 text-slate-950"><Zap size={22} /></div><div><div className="font-black text-white">PRODSIM IA</div><div className="text-[10px] tracking-[.25em] text-cyan-400">BARRANQUILLA</div></div></div><nav className="mt-12 space-y-2 text-sm">{tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} className={`flex w-full gap-3 rounded-xl px-4 py-3 text-left ${tab === id ? 'bg-cyan-400/10 font-bold text-cyan-300' : 'text-slate-400 hover:bg-slate-900'}`}><Icon size={18} />{label}</button>)}</nav><div className="mt-auto rounded-2xl border border-cyan-900/50 bg-cyan-950/30 p-4 text-xs leading-5 text-slate-400"><b className="text-cyan-300">Startup académica</b><br />Planta sintética de bebidas naturales. Sin datos reales ni conexiones externas.</div></aside>
    <main className="lg:ml-64"><header className="border-b border-slate-800 bg-slate-950/90 px-5 py-4 backdrop-blur md:px-10"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-lg font-black text-white"><span className="text-cyan-400">ProdSim IA</span><span className="text-rose-400">◉</span><span className="text-amber-400">⚙</span></div><div className="text-xs text-slate-500">Simulador de Planta de Bebidas · Barranquilla, Atlántico</div></div><div className="flex items-center gap-3 text-xs text-slate-400"><span>{new Date().toLocaleDateString('es-CO')}</span><span className="rounded-md border border-slate-700 px-2 py-1">Usuario: Analista Operaciones</span><span className={`h-2 w-2 rounded-full ${running ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'}`} /></div></div></header>
      <div className="mx-auto max-w-[1550px] space-y-5 p-5 md:p-8"><section className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-black text-white md:text-3xl">Resumen General</h2><p className="mt-1 text-sm text-slate-400">Monitoreo sintético de procesos · jugos naturales y aguas</p></div><div className="flex flex-wrap gap-2"><button onClick={exportPdf} className="btn-export"><Download size={16} /> Exportar Informe</button><button onClick={exportExcel} className="btn-export"><Download size={16} /> Exportar Excel</button></div></section>
        <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-2 lg:hidden">{tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${tab === id ? 'bg-cyan-400 text-slate-950' : 'bg-slate-900 text-slate-400'}`}>{label}</button>)}</div>
        <section className="dashboard-filters"><span>⌕ Filtros:</span><button>Periodo: Turno actual ▾</button><button>Producto: Todos los productos ▾</button><button>Proceso: Todos ▾</button><span className="filter-status">● Datos sintéticos actualizados</span></section>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card label="OEE GENERAL" value={`${oee.toFixed(1)}%`} detail={`vs objetivo ${targetOee}% · ${oee > targetOee ? '↑ óptimo' : '↓ requiere mejora'}`} icon={Gauge} tone={oee > targetOee ? 'green' : oee < 60 ? 'red' : 'amber'} /><Card label="VELOCIDAD PROMEDIO" value={`${average(rows, 'actualSpeed').toFixed(0)} L/h`} detail={`${format(average(rows, 'actualSpeed') - 850)} L/h vs referencia`} icon={Zap} /><Card label="TASA DEFECTOS" value={`${defects.toFixed(1)}%`} detail={`${defects <= defectLimit ? '↓ dentro del límite' : '↑ sobre el límite'} de ${defectLimit}%`} icon={AlertTriangle} tone={defects > defectLimit ? 'red' : 'amber'} /><Card label="IMPACTO PAROS" value={money(cost)} detail={`${format(rows.reduce((sum, row) => sum + row.stops, 0))} min acumulados`} icon={TrendingDown} tone="red" /></section>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card label="Velocidad promedio" value={`${average(rows, 'actualSpeed').toFixed(0)} L/h`} detail="Eficiencia de flujo" icon={Zap} /><Card label="Meta vs real" value={`${compliance.toFixed(1)}%`} detail={`${format(produced)} / ${format(target)} litros`} icon={BarChart3} tone={compliance >= 90 ? 'green' : 'amber'} /><Card label="Impacto de paros" value={money(cost)} detail={`${format(rows.reduce((sum, row) => sum + row.stops, 0))} minutos`} icon={TrendingDown} tone="red" /><Card label="Litros no producidos" value={format(lost)} detail="Estimación por paros" icon={AlertTriangle} tone="red" /></section>

        {tab === 'produccion' && <section className="rounded-2xl border border-cyan-900/60 bg-slate-900/90 p-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-white">Variables editables por proceso</h3><p className="text-xs text-slate-500">Escribe nombres y valores; el modelo recalcula al instante.</p></div><div className="flex gap-2"><label className="compact-label">OEE objetivo %<input type="number" value={targetOee} onChange={event => setTargetOee(Number(event.target.value))} /></label><label className="compact-label">Defectos máximo %<input type="number" value={defectLimit} onChange={event => setDefectLimit(Number(event.target.value))} /></label><label className="compact-label">Costo paro COP/min<input type="number" value={stopCost} onChange={event => setStopCost(Number(event.target.value))} /></label></div><button onClick={add} className="btn-primary">+ Agregar Proceso</button></div><div className="space-y-4">{processes.map(process => { const row = calculate(process, scenario, stopCost); return <div key={process.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="mb-4 flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-400/10 text-xs font-bold text-cyan-300">{process.id}</span><input className="input-dark flex-1 font-bold" value={process.name} onChange={event => update(process.id, 'name', event.target.value)} /><button onClick={() => remove(process.id)} disabled={processes.length <= 1} className="text-rose-400 disabled:opacity-30"><X size={18} /></button></div><div className="grid gap-3 md:grid-cols-4"><label className="field">Capacidad nominal L/h<input type="number" value={process.capacity} onChange={event => update(process.id, 'capacity', event.target.value)} /><input type="range" min="100" max="3000" value={process.capacity} onChange={event => update(process.id, 'capacity', event.target.value)} /></label><label className="field">Meta L/turno<input type="number" value={process.target} onChange={event => update(process.id, 'target', event.target.value)} /></label><label className="field">Paros min<input type="number" value={process.stops} onChange={event => update(process.id, 'stops', event.target.value)} /><input type="range" min="0" max={process.available} value={Math.min(process.stops, process.available)} onChange={event => update(process.id, 'stops', event.target.value)} /></label><label className="field">Defectos %<input type="number" step=".1" value={process.defects} onChange={event => update(process.id, 'defects', event.target.value)} /><input type="range" min="0" max="20" step=".1" value={process.defects} onChange={event => update(process.id, 'defects', event.target.value)} /></label></div><div className="mt-3 grid gap-3 md:grid-cols-4"><label className="field">Velocidad real L/h<input type="number" value={process.actualSpeed} onChange={event => update(process.id, 'actualSpeed', event.target.value)} /><input type="range" min="0" max="3000" value={process.actualSpeed} onChange={event => update(process.id, 'actualSpeed', event.target.value)} /></label><div className="metric-mini"><span>Disponibilidad</span><b>{row.availability.toFixed(1)}%</b></div><div className="metric-mini"><span>Rendimiento</span><b>{row.performance.toFixed(1)}%</b></div><div className="metric-mini"><span>Calidad / OEE</span><b>{row.quality.toFixed(1)}% / {row.oee.toFixed(1)}%</b></div><div className="metric-mini"><span>Meta vs real</span><b>{row.compliance.toFixed(1)}%</b></div></div></div>; })}</div></section>}

        {tab === 'oee' && <section className="grid gap-4 xl:grid-cols-4"><div className="analysis-card"><span>Brecha contra OEE objetivo</span><b>{Math.max(0, targetOee - oee).toFixed(1)} puntos</b><small>Meta editable: {targetOee}%</small></div><div className="analysis-card"><span>Litros perdidos por paros</span><b>{format(lost)} L</b><small>{format(rows.reduce((sum, row) => sum + row.stops, 0))} minutos acumulados</small></div><div className="analysis-card"><span>Brecha meta vs real</span><b>{format(Math.max(0, target - produced))} L</b><small>Cumplimiento actual: {compliance.toFixed(1)}%</small></div><div className="analysis-card"><span>Escenario de mejora</span><b>{improved.toFixed(1)}% OEE</b><small>Reduciendo 25% los paros del cuello</small></div><div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 xl:col-span-2"><h3 className="font-bold text-white">Ranking de procesos</h3><div className="mt-4 space-y-3">{[...rows].sort((a, b) => b.oee - a.oee).map((row, index) => <div className="flex items-center gap-3" key={row.id}><span className="grid h-7 w-7 place-items-center rounded-full bg-slate-800 text-xs font-bold text-cyan-300">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm text-slate-300">{row.name}</span><div className="h-2 w-32 rounded-full bg-slate-800"><i className="block h-full rounded-full bg-cyan-400" style={{ width: `${row.oee}%` }} /></div><b className="w-14 text-right font-mono text-sm text-white">{row.oee.toFixed(1)}%</b></div>)}</div></div><div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5 xl:col-span-2"><div className="flex gap-3"><Sparkles className="shrink-0 text-amber-400" /><div><h3 className="font-bold text-amber-300">Conclusión de análisis OEE</h3><p className="mt-2 text-sm leading-6 text-slate-300">{insight}</p></div></div></div></section>}

        <section className="rounded-2xl border border-cyan-900/50 bg-slate-900/90 p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-white">Comparación de escenarios de mejora</h3><p className="text-xs text-slate-500">Simula acciones sobre la planta sin modificar los datos base.</p></div><div className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">Mejor alternativa: <b>{bestScenario.name}</b> · {bestScenario.oee.toFixed(1)}% OEE</div></div><div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]"><div className="h-64"><Bar data={{ labels: scenarioResults.map(result => result.name), datasets: [{ label: 'OEE general %', data: scenarioResults.map(result => result.oee), backgroundColor: scenarioResults.map(result => result.name === scenario ? '#22d3ee' : '#334155'), borderRadius: 6 }] }} options={{ ...options, indexAxis: 'y', plugins: { ...options.plugins, legend: { display: false } }, scales: { ...options.scales, x: { ...options.scales.x, min: 0, max: 100 } } }} /></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{scenarioResults.map(result => <button key={result.name} onClick={() => setScenario(result.name)} className={`rounded-xl border p-3 text-left transition ${result.name === scenario ? 'border-cyan-400 bg-cyan-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-slate-600'}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-200">{result.name}</span><span className="font-mono text-sm font-bold text-cyan-300">{result.oee.toFixed(1)}%</span></div><div className="mt-1 text-[11px] text-slate-500">Paros: {money(result.cost)} · Pérdida estimada: {format(result.lost)} L</div></button>)}</div></div></section>
        <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]"><div className="space-y-6"><div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-white">{tab === 'oee' ? 'Análisis OEE por proceso' : 'Desempeño de procesos'}</h3><p className="text-xs text-slate-500">Escenario activo: {scenario}</p></div><select className="select-dark" value={scenario} onChange={event => setScenario(event.target.value)}><option>Base actual</option><option>Reducir paros 25%</option><option>Reducir defectos 50%</option><option>Aumentar velocidad 10%</option></select></div><div className="h-72"><Bar data={{ labels: rows.map(row => row.name), datasets: [{ label: 'OEE %', data: rows.map(row => row.oee), backgroundColor: rows.map(row => row.oee > targetOee ? '#34d399' : row.oee >= 60 ? '#f59e0b' : '#fb7185'), borderRadius: 6 }] }} options={{ ...options, plugins: { ...options.plugins, legend: { display: false } }, scales: { ...options.scales, y: { ...options.scales.y, min: 0, max: 100 } } }} /></div></div><div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5"><h3 className="font-bold text-white">Meta versus producción real</h3><div className="h-64"><Bar data={{ labels: rows.map(row => row.name), datasets: [{ label: 'Meta litros', data: rows.map(row => row.target), backgroundColor: '#334155' }, { label: 'Real litros', data: rows.map(row => row.real), backgroundColor: '#22d3ee' }] }} options={options} /></div></div></div><div className="space-y-6"><div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5"><h3 className="font-bold text-white">Control de simulación</h3>        <p className="mt-1 text-xs text-slate-500">Estado: <span className={running ? 'text-emerald-400' : 'text-amber-400'}>{running ? 'Simulación en curso' : hasStarted ? 'Pausada' : 'Lista'}</span></p><div className="mt-4 flex flex-wrap gap-2">        <button onClick={() => { setHasStarted(true); setRunning(true); }} disabled={running} className="btn-primary"><Play size={16} /> Iniciar</button><button onClick={() => setRunning(false)} disabled={!running} className="btn-warning"><Pause size={16} /> Pausa</button><button onClick={reset} className="btn-danger"><RotateCcw size={16} /> Reinicio</button></div>        <div className="mt-3 flex gap-2">{[1, 2, 4].map(value => <button key={value} onClick={() => setSimulationSpeed(value)} className={`speed-btn ${simulationSpeed === value ? 'speed-active' : ''}`}>x{value}</button>)}<span className="text-xs text-slate-500">Tiempo simulado: {simulationMinute} min · Velocidad x{simulationSpeed}</span></div></div><div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5"><div className="flex gap-3"><Sparkles className="shrink-0 text-amber-400" /><div><h3 className="font-bold text-amber-300">Insights IA</h3><p className="mt-2 text-sm leading-6 text-slate-300">{insight}</p></div></div></div><div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5"><h3 className="font-bold text-white">Velocidad en el tiempo</h3><div className="mt-3 h-48"><Line data={{ labels: trend.map(item => item.label), datasets: [{ label: 'L/h', data: trend.map(item => item.value), borderColor: '#f59e0b', backgroundColor: '#f59e0b22', fill: true, tension: .35 }] }} options={options} /></div></div></div></section>

        {tab === 'resumen' && <section className="grid gap-6 xl:grid-cols-2"><div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5"><h3 className="font-bold text-white">Volumen por producto</h3><p className="mb-3 text-xs text-slate-500">Distribución sintética de litros producidos por familia</p><div className="h-64"><Bar data={{ labels: productMix.map(item => item.name), datasets: [{ label: 'Litros', data: productMix.map(item => item.volume), backgroundColor: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22d3ee', '#3b82f6'], borderRadius: 5 }] }} options={{ ...options, indexAxis: 'y', plugins: { ...options.plugins, legend: { display: false } } }} /></div></div><div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5"><h3 className="font-bold text-white">Distribución de operación</h3><p className="mb-3 text-xs text-slate-500">Tiempo operativo, paros y oportunidad de recuperación</p><div className="mx-auto h-64 max-w-xs"><Doughnut data={{ labels: ['Tiempo operativo', 'Paros'], datasets: [{ data: [availability, 100 - availability], backgroundColor: ['#34d399', '#fb7185'], borderWidth: 0 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }} /></div></div></section>}
        {(tab === 'resumen' || tab === 'calidad') && <section className="grid gap-6 xl:grid-cols-2"><div className="rounded-2xl border border-rose-900/40 bg-slate-900/90 p-5"><h3 className="font-bold text-white">Defectos por proceso</h3><div className="h-64"><Bar data={{ labels: rows.map(row => row.name), datasets: [{ label: 'Defectos %', data: rows.map(row => row.defects), backgroundColor: '#fb7185', borderRadius: 5 }] }} options={{ ...options, plugins: { ...options.plugins, legend: { display: false } } }} /></div></div><div className="rounded-2xl border border-emerald-900/40 bg-slate-900/90 p-5"><h3 className="font-bold text-white">Calidad conforme versus defecto</h3><div className="mx-auto h-64 max-w-xs"><Doughnut data={{ labels: ['Conforme', 'Defecto'], datasets: [{ data: [quality, defects], backgroundColor: ['#34d399', '#fb7185'], borderWidth: 0 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }} /></div></div></section>}
        {tab === 'calidad' && <section className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-5"><div className="flex gap-3"><AlertTriangle className="shrink-0 text-rose-400" /><div><h3 className="font-bold text-rose-300">Diagnóstico automático de calidad</h3><p className="mt-2 text-sm leading-6 text-slate-200">{qualityInsight}</p></div></div></section>}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90"><div className="border-b border-slate-800 p-5"><h3 className="font-bold text-white">Tabla automática de procesos</h3><p className="text-xs text-slate-500">Incluye meta versus real, OEE, estado e impacto económico.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-left text-sm"><thead className="bg-slate-950/60 text-[10px] uppercase tracking-wider text-slate-500"><tr>{['Proceso', 'Capacidad L/h', 'Meta L/turno', 'Real L', 'Cumplimiento', 'Paros', 'Defectos', 'Disponibilidad', 'Rendimiento', 'Calidad', 'OEE', 'Impacto', 'Estado'].map(header => <th className="px-3 py-3" key={header}>{header}</th>)}</tr></thead><tbody>{rows.map(row => <tr className="border-t border-slate-800" key={row.id}><td className="px-3 py-4 font-bold text-white">{row.name}</td><td className="px-3 py-4 font-mono text-slate-300">{format(row.capacity)}</td><td className="px-3 py-4 font-mono text-slate-300">{format(row.target)}</td><td className="px-3 py-4 font-mono text-slate-300">{format(row.real)}</td><td className="px-3 py-4 font-mono text-slate-300">{row.compliance.toFixed(1)}%</td><td className="px-3 py-4 font-mono text-slate-300">{row.stops.toFixed(0)} min</td><td className={`px-3 py-4 font-mono ${row.defects > defectLimit ? 'text-rose-400' : row.defects < 2 ? 'text-emerald-400' : 'text-slate-300'}`}>{row.defects.toFixed(1)}%</td><td className="px-3 py-4 font-mono text-slate-300">{row.availability.toFixed(1)}%</td><td className="px-3 py-4 font-mono text-slate-300">{row.performance.toFixed(1)}%</td><td className="px-3 py-4 font-mono text-slate-300">{row.quality.toFixed(1)}%</td><td className={`px-3 py-4 font-mono font-bold ${row.oee > targetOee ? 'text-emerald-400' : row.oee >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>{row.oee.toFixed(1)}%</td><td className="px-3 py-4 font-mono text-slate-300">{money(row.stopImpact)}</td><td className="px-3 py-4"><span className={`rounded-full px-2 py-1 text-xs ${row.oee > targetOee ? 'bg-emerald-400/10 text-emerald-300' : row.oee >= 60 ? 'bg-amber-400/10 text-amber-300' : 'bg-rose-400/10 text-rose-300'}`}>{state(row)}</span></td></tr>)}</tbody></table></div></section>
      </div>
    </main>
  </div>;
}

const style = document.createElement('style');
style.textContent = `.dashboard-filters{display:flex;align-items:center;gap:.55rem;flex-wrap:wrap;border:1px solid #1e293b;background:#0f172a;padding:.65rem .8rem;color:#94a3b8;font-size:.7rem}.dashboard-filters button{border:1px solid #334155;border-radius:.45rem;background:#111c2d;color:#cbd5e1;padding:.4rem .65rem;font-size:.7rem}.filter-status{margin-left:auto;color:#34d399;font-size:.68rem}.btn-primary,.btn-warning,.btn-danger,.btn-export{display:inline-flex;align-items:center;gap:.45rem;border-radius:.65rem;padding:.6rem .85rem;font-size:.75rem;font-weight:700;transition:all .2s}.btn-primary{background:#22d3ee;color:#08202a}.btn-primary:hover{background:#67e8f9}.btn-warning{background:#f59e0b;color:#241304}.btn-danger{background:#fb7185;color:#350a12}.btn-export{background:#e11d48;color:#fff}.btn-export:hover{background:#fb7185}.btn-primary:disabled,.btn-warning:disabled{cursor:not-allowed;opacity:.4}.input-dark,.field input[type=number],.compact-label input{border:1px solid #334155;border-radius:.45rem;background:#0f172a;padding:.55rem .65rem;color:#f8fafc;outline:0;width:100%}.input-dark:focus,.field input[type=number]:focus,.compact-label input:focus{border-color:#22d3ee;box-shadow:0 0 0 2px #22d3ee22}.field{display:block;color:#94a3b8;font-size:.68rem;font-weight:700}.field input[type=number]{margin-top:.35rem}.field input[type=range]{display:block;margin-top:.45rem;width:100%;accent-color:#22d3ee}.compact-label{display:block;min-width:130px;color:#94a3b8;font-size:.65rem;font-weight:700}.compact-label input{display:block;margin-top:.3rem}.metric-mini{border:1px solid #1e293b;border-radius:.55rem;background:#0b1220;padding:.7rem}.metric-mini span{display:block;color:#64748b;font-size:.68rem}.metric-mini b{display:block;margin-top:.35rem;color:#67e8f9;font-family:ui-monospace,monospace;font-size:1.05rem}.select-dark{border:1px solid #334155;border-radius:.5rem;background:#0f172a;color:#cbd5e1;padding:.55rem;font-size:.75rem}.speed-btn{border:1px solid #334155;border-radius:.45rem;padding:.25rem .55rem;color:#67e8f9;font-size:.7rem}.speed-btn:hover,.speed-active{background:#22d3ee;color:#08202a}.analysis-card{border:1px solid #1e293b;border-radius:1rem;background:#0f172a;padding:1.1rem}.analysis-card span{display:block;color:#94a3b8;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.analysis-card b{display:block;margin-top:.55rem;color:#f8fafc;font-family:ui-monospace,monospace;font-size:1.4rem}.analysis-card small{display:block;margin-top:.35rem;color:#64748b;font-size:.7rem}`;
document.head.appendChild(style);
createRoot(document.getElementById('root')).render(<App />);
