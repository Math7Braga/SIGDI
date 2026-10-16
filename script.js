(function(){
  // ============================================================
  // CONFIGURAÇÃO — ID da planilha (trecho da URL entre /d/ e /edit)
  // A planilha precisa estar como "Qualquer pessoa com o link -> Leitor"
  // ============================================================
  const SHEET_ID = "1T-KCX-9qif-6ZEFnzsL4NoW7PgNI2uM1jxpdEtqXKVE";

  // ============================================================
  // AGENDA — Google Calendar API (leitura pública, sem login)
  // 1. Crie uma API key gratuita no Google Cloud Console
  //    (console.cloud.google.com → APIs e serviços → Credenciais)
  //    com a "Google Calendar API" ativada e restrita a ela.
  // 2. Cole a key abaixo. A agenda já está como pública, então
  //    não precisa de OAuth/login — só a key.
  // ============================================================
  const CALENDAR_ID = "distritocantareira@gmail.com";
  const CALENDAR_API_KEY = "AIzaSyCjFC9NhH4p5XfzCiP4L0J_1XjQ5BHb62Q";

  // Nome da aba + ordem EXATA das colunas de cada tabela.
  // Mapear por posição (não pelo rótulo que o Google devolve) evita
  // o bug de colunas virarem "undefined" quando o Sheets falha em
  // detectar o cabeçalho automaticamente.
  const TABS = {
    kpis:          { sheet: "KPIs",          cols: ["Chave","Valor","Descricao"] },
    projetos:      { sheet: "Projetos",      cols: ["Projeto","Fase","Progresso","ProximoMarco","Risco"] },
    parcerias:     { sheet: "Parcerias",     cols: ["Nome","Etapa"] },
    pendencias:    { sheet: "Pendencias",    cols: ["Descricao","Prioridade"] },
    processos:     { sheet: "Processos",     cols: ["Nome","Nivel","Status"] },
    oportunidades: { sheet: "Oportunidades", cols: ["Nome","Status"] }
  };

  // ============================================================
  // DADOS DE DEMONSTRAÇÃO (usados se a planilha não carregar)
  // ============================================================
  const DEMO = {
    kpis: {
      gov_reunioes_realizadas:14, gov_deliberacoes_aprovadas:28, gov_deliberacoes_pendentes:6,
      agenda_eventos_realizados:12, agenda_eventos_previstos:9, agenda_visitas_tecnicas:7, agenda_solicitacoes:11,
      com_linkedin:23, com_instagram:18, com_materias:7, com_alcance:"32.4K",
      mem_reunioes:118, mem_documentos:246, mem_decisoes:37, mem_fotos:132,
      ind_parcerias:34, ind_projetos:37, ind_eventos:9, ind_visitas:22
    },
    projetos: [
      {Projeto:"IBM Quantum (QIC)", Fase:"100%", Progresso:100, ProximoMarco:"Workshop IBM 25/08", Risco:"Baixo"},
      {Projeto:"NVIDIA HPC / IA", Fase:"70%", Progresso:70, ProximoMarco:"Chegada equip. 27/08", Risco:"Médio"},
      {Projeto:"PONTTE - Conexão ONS", Fase:"50%", Progresso:50, ProximoMarco:"Testes integração 29/08", Risco:"Médio"},
      {Projeto:"Infraestrutura Predial", Fase:"40%", Progresso:40, ProximoMarco:"Conclusão Fase 1", Risco:"Alto"}
    ],
    parcerias: [
      {Nome:"IBM", Etapa:"Ativa"}, {Nome:"NVIDIA", Etapa:"Negociação"},
      {Nome:"enel", Etapa:"Prospecção"}, {Nome:"PONTTE / ONS", Etapa:"Ativa"}
    ],
    pendencias: [
      {Descricao:"Aprovação do Regimento Interno do Distrito", Prioridade:"Alta"},
      {Descricao:"Definição do Parceiro Gestor", Prioridade:"Alta"},
      {Descricao:"Formalização da parceria NVIDIA", Prioridade:"Média"}
    ],
    processos: [
      {Nome:"Parceiro Gestor", Nivel:"1", Status:"Atrasado"},
      {Nome:"NVIDIA", Nivel:"1", Status:"Em andamento"},
      {Nome:"IBM", Nivel:"1", Status:"No prazo"},
      {Nome:"Obras e Adequações", Nivel:"1", Status:"Em andamento"}
    ],
    oportunidades: [
      {Nome:"Universidade X — interc. IA e HPC", Status:"Primeiro contato"},
      {Nome:"Empresa Y — interesse P&D quântico", Status:"Visita agendada"},
      {Nome:"Centro de Pesquisa Z — comp. quântica", Status:"Em negociação"}
    ]
  };

  // ============================================================
  // UTILITÁRIOS
  // ============================================================
  const $ = sel => document.querySelector(sel);
  const escapeHtml = s => String(s ?? "").replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

  // ============================================================
  // LEITURA DA PLANILHA (Google Sheets via gviz — só leitura)
  // ============================================================
  function gvizUrl(tabName){
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}&headers=1`;
  }

  // Mapeia cada linha pela POSIÇÃO da coluna (row.c[0], row.c[1]...) usando
  // a lista `cols` que define a ordem esperada — não depende do rótulo que
  // o Google Sheets tenta adivinhar, que às vezes vem vazio.
  function parseGviz(text, expectedCols){
    const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}')+1));
    const rows = json.table.rows.map(r => {
      const obj = {};
      expectedCols.forEach((colName, i) => {
        const cell = r.c[i];
        obj[colName] = cell ? (cell.f ?? cell.v ?? "") : "";
      });
      return obj;
    });
    // remove linhas totalmente vazias (ex: linhas em branco ou de legenda
    // mesclada, cuja primeira coluna não bate com um valor válido)
    const nonEmpty = rows.filter(row => {
      const first = row[expectedCols[0]];
      return first !== "" && first !== null && first !== undefined;
    });
    // remove linhas de "nota/legenda" (texto longo na 1ª coluna, todas as
    // outras vazias) — evita que uma anotação da planilha vire um item de
    // verdade na tabela/gráfico e distorça o layout inteiro
    return nonEmpty.filter(row => {
      const first = String(row[expectedCols[0]] ?? "");
      const restEmpty = expectedCols.slice(1).every(c => !row[c] || String(row[c]).trim() === "");
      const looksLikeNote = first.length > 60 && restEmpty;
      return !looksLikeNote;
    });
  }

  async function fetchTab(key){
    const cfg = TABS[key];
    const res = await fetch(gvizUrl(cfg.sheet));
    if(!res.ok) throw new Error("fetch failed: " + cfg.sheet);
    return parseGviz(await res.text(), cfg.cols);
  }

  // ============================================================
  // HELPERS DE ESTILO (cor por risco/status)
  // ============================================================
  function riskClass(r){
    r = (r||"").toString().toLowerCase();
    if(r.startsWith("alt")) return "risk-alto";
    if(r.startsWith("m")) return "risk-medio";
    return "risk-baixo";
  }
  function pillClass(p){
    p = (p||"").toString().toLowerCase();
    if(p.startsWith("alt")) return "alta";
    if(p.startsWith("m")) return "media";
    return "baixa";
  }
  function statusDot(s){
    s = (s||"").toString().toLowerCase();
    if(s.includes("atras")) return "🔴";
    if(s.includes("andamento")) return "🟡";
    return "🟢";
  }

  // ============================================================
  // RENDERIZAÇÃO — cards da Visão Geral e tabelas
  // ============================================================
  function renderKpis(k){
    document.querySelectorAll("[data-k]").forEach(el=>{
      const key = el.getAttribute("data-k");
      if(k[key] !== undefined && k[key] !== "") el.textContent = k[key];
    });
  }

  function renderProjetos(list){
    const tbody = $("#projetos_tabela tbody");
    tbody.innerHTML = list.map(p => `
      <tr>
        <td><b>${escapeHtml(p.Projeto)}</b><br><span class="empty-note">${escapeHtml(p.ProximoMarco)}</span></td>
        <td style="width:70px">${escapeHtml(p.Fase)}</td>
        <td class="${riskClass(p.Risco)}" style="width:60px">${escapeHtml(p.Risco)}</td>
      </tr>`).join("") || `<tr><td class="empty-note">Nenhum projeto cadastrado.</td></tr>`;
  }

  function renderParcerias(list){
    const stages = ["Prospecção","Negociação","Formalização","Ativa"];
    const counts = {}; stages.forEach(s=>counts[s]=0);
    list.forEach(p => { if(counts[p.Etapa] !== undefined) counts[p.Etapa]++; });
    const max = Math.max(1, ...Object.values(counts));
    let html = stages.map(s => `
      <div class="barline">
        <span style="width:88px">${s}</span>
        <div class="track"><div class="fill" style="width:${(counts[s]/max*100)}%"></div></div>
        <span class="num">${counts[s]}</span>
      </div>`).join("");
    html += `<div style="margin-top:8px">` + list.map(p=>{
      const cls = p.Etapa==='Ativa' ? 'baixa' : (p.Etapa==='Negociação' ? 'media' : 'alta');
      return `<span class="pill ${cls}">${escapeHtml(p.Nome)}</span>`;
    }).join("") + `</div>`;
    $("#parcerias_funil").innerHTML = html;
  }

  function renderPendencias(list){
    $("#gov_pendencias").innerHTML = list.map(p=>
      `<div style="margin:4px 0; font-size:11.5px;">• ${escapeHtml(p.Descricao)} <span class="pill ${pillClass(p.Prioridade)}">${escapeHtml(p.Prioridade)}</span></div>`
    ).join("") || `<div class="empty-note">Sem pendências críticas.</div>`;
  }

  function renderProcessos(list){
    $("#processos_tabela tbody").innerHTML = list.map(p =>
      `<tr><td><span class="status-dot">${statusDot(p.Status)}</span>${escapeHtml(p.Nome)}</td><td style="width:90px">${escapeHtml(p.Status)}</td></tr>`
    ).join("") || `<tr><td class="empty-note">Nenhum processo cadastrado.</td></tr>`;
  }

  function renderOportunidades(list){
    $("#oportunidades_tabela tbody").innerHTML = list.map(o =>
      `<tr><td>${escapeHtml(o.Nome)}</td><td style="width:100px">${escapeHtml(o.Status)}</td></tr>`
    ).join("") || `<tr><td class="empty-note">Nenhuma oportunidade cadastrada.</td></tr>`;
  }

  function renderParceriasTabela(list){
    const tbody = $("#parcerias_tabela tbody");
    if(!tbody) return;
    tbody.innerHTML = list.map(p =>
      `<tr><td>${escapeHtml(p.Nome)}</td><td style="width:110px">${escapeHtml(p.Etapa)}</td></tr>`
    ).join("") || `<tr><td class="empty-note">Nenhuma parceria cadastrada.</td></tr>`;
  }

  function renderMiniBars(containerId, items){
    const el = $("#" + containerId);
    if(!el) return;
    const max = Math.max(1, ...items.map(i => Number(i.value) || 0));
    el.innerHTML = items.map(i => `
      <div class="barline">
        <span style="width:120px">${escapeHtml(i.label)}</span>
        <div class="track"><div class="fill" style="width:${(Number(i.value)||0)/max*100}%"></div></div>
        <span class="num">${escapeHtml(i.value)}</span>
      </div>`).join("");
  }

  function renderMiniBarCards(kpis){
    renderMiniBars("agenda_mini_bars", [
      { label: "Eventos realiz.", value: kpis.agenda_eventos_realizados || 0 },
      { label: "Eventos prev.",   value: kpis.agenda_eventos_previstos || 0 },
      { label: "Visitas técn.",   value: kpis.agenda_visitas_tecnicas || 0 },
      { label: "Solicitações",    value: kpis.agenda_solicitacoes || 0 }
    ]);
    renderMiniBars("com_mini_bars", [
      { label: "LinkedIn",   value: kpis.com_linkedin || 0 },
      { label: "Instagram",  value: kpis.com_instagram || 0 },
      { label: "Matérias",   value: kpis.com_materias || 0 }
    ]);
    renderMiniBars("mem_mini_bars", [
      { label: "Reuniões",     value: kpis.mem_reunioes || 0 },
      { label: "Documentos",   value: kpis.mem_documentos || 0 },
      { label: "Decisões",     value: kpis.mem_decisoes || 0 },
      { label: "Fotos/mídia",  value: kpis.mem_fotos || 0 }
    ]);
    renderMiniBars("ind_mini_bars", [
      { label: "Parcerias",     value: kpis.ind_parcerias || 0 },
      { label: "Projetos",      value: kpis.ind_projetos || 0 },
      { label: "Eventos prev.", value: kpis.ind_eventos || 0 },
      { label: "Visitas técn.", value: kpis.ind_visitas || 0 }
    ]);
  }

  function renderAll(data){
    renderKpis(data.kpis);
    renderMiniBarCards(data.kpis);
    renderProjetos(data.projetos);
    renderParcerias(data.parcerias);
    renderParceriasTabela(data.parcerias);
    renderPendencias(data.pendencias);
    renderProcessos(data.processos);
    renderOportunidades(data.oportunidades);
  }

  // ---------------- Gráficos (Chart.js) ----------------
  // Guarda o último conjunto de dados carregado, para os gráficos poderem
  // ser (re)desenhados sempre que o usuário abrir uma página específica.
  let lastData = null;
  const chartInstances = {};

  function makeChart(canvasId, config){
    const el = document.getElementById(canvasId);
    if(!el) return;
    if(chartInstances[canvasId]) chartInstances[canvasId].destroy();
    chartInstances[canvasId] = new Chart(el.getContext("2d"), config);
  }

  const CHART_COLORS = ["#3ee0d0", "#f0b84c", "#ef5d5d", "#4fd07a", "#6ea8ff", "#c084fc"];
  const chartBaseOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: "#8fa1b3", font: { size: 10.5 } } } },
    scales: {
      x: { ticks: { color: "#8fa1b3", font: { size: 10.5 } }, grid: { color: "#1c2733" } },
      y: { ticks: { color: "#8fa1b3", font: { size: 10.5 } }, grid: { color: "#1c2733" } }
    }
  };

  function renderChartsForPage(page){
    if(!lastData) return;
    const d = lastData;

    if(page === "governanca"){
      makeChart("chart-governanca-reunioes", {
        type: "bar",
        data: { labels: ["Reuniões no mês"], datasets: [
          { label: "Realizadas", data: [Number(d.kpis.gov_reunioes_realizadas) || 0], backgroundColor: CHART_COLORS[0] }
        ]},
        options: { ...chartBaseOptions, indexAxis: "y" }
      });
      makeChart("chart-governanca-delib", {
        type: "doughnut",
        data: {
          labels: ["Aprovadas", "Pendentes"],
          datasets: [{ data: [Number(d.kpis.gov_deliberacoes_aprovadas)||0, Number(d.kpis.gov_deliberacoes_pendentes)||0],
            backgroundColor: [CHART_COLORS[3], CHART_COLORS[2]] }]
        },
        options: { ...chartBaseOptions, scales: {} }
      });
    }

    if(page === "parcerias"){
      const stages = ["Prospecção","Negociação","Formalização","Ativa"];
      const counts = stages.map(s => d.parcerias.filter(p => p.Etapa === s).length);
      makeChart("chart-parcerias-funil", {
        type: "bar",
        data: { labels: stages, datasets: [{ label: "Parcerias", data: counts, backgroundColor: CHART_COLORS[0] }] },
        options: { ...chartBaseOptions, indexAxis: "y", plugins:{legend:{display:false}} }
      });
    }

    if(page === "projetos"){
      const riskCounts = { Baixo:0, Médio:0, Alto:0 };
      d.projetos.forEach(p => { if(riskCounts[p.Risco] !== undefined) riskCounts[p.Risco]++; });
      makeChart("chart-projetos-risco", {
        type: "doughnut",
        data: { labels: Object.keys(riskCounts), datasets: [{ data: Object.values(riskCounts),
          backgroundColor: [CHART_COLORS[3], CHART_COLORS[1], CHART_COLORS[2]] }] },
        options: { ...chartBaseOptions, scales: {} }
      });
      makeChart("chart-projetos-progresso", {
        type: "bar",
        data: { labels: d.projetos.map(p=>p.Projeto), datasets: [{ label:"Progresso (%)", data: d.projetos.map(p=>Number(p.Progresso)||0), backgroundColor: CHART_COLORS[0] }] },
        options: { ...chartBaseOptions, indexAxis: "y", plugins:{legend:{display:false}},
          scales: { ...chartBaseOptions.scales,
            y: { ...chartBaseOptions.scales.y,
              ticks: { ...chartBaseOptions.scales.y.ticks,
                callback: function(value){
                  const label = this.getLabelForValue(value);
                  return label.length > 28 ? label.slice(0, 26) + "…" : label;
                }
              }
            }
          }
        }
      });
    }

    if(page === "agenda"){
      makeChart("chart-agenda", {
        type: "bar",
        data: {
          labels: ["Eventos realizados","Eventos previstos","Visitas técnicas","Solicitações"],
          datasets: [{ data: [
            Number(d.kpis.agenda_eventos_realizados)||0, Number(d.kpis.agenda_eventos_previstos)||0,
            Number(d.kpis.agenda_visitas_tecnicas)||0, Number(d.kpis.agenda_solicitacoes)||0
          ], backgroundColor: CHART_COLORS }]
        },
        options: { ...chartBaseOptions, plugins:{legend:{display:false}} }
      });
    }

    if(page === "comunicacao"){
      makeChart("chart-comunicacao", {
        type: "bar",
        data: {
          labels: ["LinkedIn","Instagram","Matérias"],
          datasets: [{ data: [
            Number(d.kpis.com_linkedin)||0, Number(d.kpis.com_instagram)||0, Number(d.kpis.com_materias)||0
          ], backgroundColor: CHART_COLORS }]
        },
        options: { ...chartBaseOptions, plugins:{legend:{display:false}} }
      });
    }

    if(page === "processos"){
      const statusCounts = { "No prazo":0, "Em andamento":0, "Atrasado":0 };
      d.processos.forEach(p => { if(statusCounts[p.Status] !== undefined) statusCounts[p.Status]++; });
      makeChart("chart-processos-status", {
        type: "doughnut",
        data: { labels: Object.keys(statusCounts), datasets: [{ data: Object.values(statusCounts),
          backgroundColor: [CHART_COLORS[3], CHART_COLORS[1], CHART_COLORS[2]] }] },
        options: { ...chartBaseOptions, scales: {} }
      });
    }

    if(page === "inteligencia"){
      const byStatus = {};
      d.oportunidades.forEach(o => { byStatus[o.Status] = (byStatus[o.Status]||0) + 1; });
      makeChart("chart-oportunidades", {
        type: "bar",
        data: { labels: Object.keys(byStatus), datasets: [{ data: Object.values(byStatus), backgroundColor: CHART_COLORS[0] }] },
        options: { ...chartBaseOptions, indexAxis: "y", plugins:{legend:{display:false}} }
      });
    }

    if(page === "memoria"){
      makeChart("chart-memoria", {
        type: "bar",
        data: {
          labels: ["Reuniões","Documentos","Decisões","Fotos/mídia"],
          datasets: [{ data: [
            Number(d.kpis.mem_reunioes)||0, Number(d.kpis.mem_documentos)||0,
            Number(d.kpis.mem_decisoes)||0, Number(d.kpis.mem_fotos)||0
          ], backgroundColor: CHART_COLORS }]
        },
        options: { ...chartBaseOptions, plugins:{legend:{display:false}} }
      });
    }

    if(page === "indicadores"){
      makeChart("chart-indicadores", {
        type: "bar",
        data: {
          labels: ["Parcerias ativas","Projetos","Eventos previstos","Visitas técnicas"],
          datasets: [{ data: [
            Number(d.kpis.ind_parcerias)||0, Number(d.kpis.ind_projetos)||0,
            Number(d.kpis.ind_eventos)||0, Number(d.kpis.ind_visitas)||0
          ], backgroundColor: CHART_COLORS }]
        },
        options: { ...chartBaseOptions, plugins:{legend:{display:false}} }
      });
    }
  }

  // ============================================================
  // CARREGAMENTO DOS DADOS DA PLANILHA
  // ============================================================
  function kpiListToMap(list){
    const map = {};
    list.forEach(row => { if(row.Chave) map[row.Chave] = row.Valor; });
    return map;
  }

  async function loadFromSheets(){
    const [kpisRaw, projetos, parcerias, pendencias, processos, oportunidades] = await Promise.all([
      fetchTab("kpis"), fetchTab("projetos"), fetchTab("parcerias"),
      fetchTab("pendencias"), fetchTab("processos"), fetchTab("oportunidades")
    ]);
    lastData = { kpis: kpiListToMap(kpisRaw), projetos, parcerias, pendencias, processos, oportunidades };
    renderAll(lastData);
    $("#sigdi-status").textContent = "Conectado à planilha • atualizado " + new Date().toLocaleTimeString('pt-BR');
    renderChartsForPage(currentPage);
  }

  // ---------------- Agenda (calendário próprio) ----------------
  let calViewDate = new Date(); // mês atualmente exibido
  const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

  async function fetchMonthEvents(year, month){
    // month: 0-11
    const timeMin = new Date(year, month, 1).toISOString();
    const timeMax = new Date(year, month + 1, 1).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events` +
      `?key=${CALENDAR_API_KEY}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("calendar fetch failed");
    const json = await res.json();
    return json.items || [];
  }

  function dateKey(d){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function renderCalendarGrid(year, month, events){
    $("#cal-month-label").textContent = `${MESES[month]} de ${year}`;

    // agrupa eventos por dia
    const byDay = {};
    events.forEach(ev => {
      const startStr = ev.start.date || ev.start.dateTime; // dia inteiro ou com hora
      const d = new Date(startStr);
      const key = dateKey(d);
      (byDay[key] = byDay[key] || []).push(ev);
    });

    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay(); // 0=domingo
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayKey = dateKey(today);

    const cells = [];
    // dias do mês anterior pra completar a primeira semana
    for(let i = startWeekday - 1; i >= 0; i--){
      const d = new Date(year, month, -i);
      cells.push({ date: d, outside: true });
    }
    for(let day = 1; day <= daysInMonth; day++){
      cells.push({ date: new Date(year, month, day), outside: false });
    }
    // completa a última semana
    while(cells.length % 7 !== 0){
      const last = cells[cells.length - 1].date;
      cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), outside: true });
    }

    const grid = $("#calendar-grid");
    grid.innerHTML = cells.map(c => {
      const key = dateKey(c.date);
      const dayEvents = byDay[key] || [];
      const isToday = key === todayKey;
      const shown = dayEvents.slice(0, 3).map(ev => `<div class="cal-event" title="${escapeHtml(ev.summary||"")}">${escapeHtml(ev.summary||"(sem título)")}</div>`).join("");
      const more = dayEvents.length > 3 ? `<div class="cal-event-more">+${dayEvents.length - 3}</div>` : "";
      return `<div class="cal-day ${c.outside?"outside":""} ${isToday?"today":""}">
        <div class="cal-day-num">${c.date.getDate()}</div>
        ${shown}${more}
      </div>`;
    }).join("");
  }

  async function loadCalendarMonth(){
    const year = calViewDate.getFullYear();
    const month = calViewDate.getMonth();
    try{
      const events = await fetchMonthEvents(year, month);
      renderCalendarGrid(year, month, events);
    }catch(e){
      renderCalendarGrid(year, month, []); // mostra a grade mesmo sem eventos
    }
  }

  function initCalendarNav(){
    $("#cal-prev").addEventListener("click", () => {
      calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth() - 1, 1);
      loadCalendarMonth();
    });
    $("#cal-next").addEventListener("click", () => {
      calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth() + 1, 1);
      loadCalendarMonth();
    });
    $("#cal-today").addEventListener("click", () => {
      calViewDate = new Date();
      loadCalendarMonth();
    });
  }

  // ---------------- Navegação por página ----------------
  let currentPage = "geral";

  function setPage(page){
    currentPage = page;
    document.querySelectorAll(".sigdi-nav button").forEach(b=>{
      b.classList.toggle("active", b.getAttribute("data-page") === page);
    });
    const grid = $("#sigdi-grid");
    const cards = document.querySelectorAll(".card");
    const layout = document.querySelector(".sigdi-layout");
    if(page === "geral"){
      grid.classList.remove("single-view");
      if(layout) layout.classList.remove("detail-mode");
      cards.forEach(c => c.classList.remove("visible"));
    }else{
      grid.classList.add("single-view");
      if(layout) layout.classList.add("detail-mode");
      cards.forEach(c => c.classList.toggle("visible", c.getAttribute("data-page") === page));
      // pequeno atraso para o card ficar visível (e o canvas ganhar tamanho)
      // antes do Chart.js desenhar — canvas com display:none tem largura 0.
      setTimeout(() => renderChartsForPage(page), 30);
      if(page === "agenda") loadCalendarMonth();
    }
  }

  function initNav(){
    document.querySelectorAll(".sigdi-nav button").forEach(btn=>{
      btn.addEventListener("click", () => setPage(btn.getAttribute("data-page")));
    });
    setPage("geral"); // página inicial = Visão Geral
  }

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================
  async function init(){
    initNav();
    initCalendarNav();

    function tick(){
      const now = new Date();
      $("#sigdi-date").textContent = now.toLocaleDateString('pt-BR', {weekday:'long', day:'2-digit', month:'long', year:'numeric'});
      $("#sigdi-time").textContent = now.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    }
    tick(); setInterval(tick, 30000);

    if(SHEET_ID.includes("COLE_AQUI")){
      lastData = DEMO;
      renderAll(DEMO);
      $("#sigdi-status").textContent = "Modo demonstração — configure SHEET_ID no código para conectar sua planilha real.";
      return;
    }
    try{
      await loadFromSheets();
    }catch(e){
      lastData = DEMO;
      renderAll(DEMO);
      $("#sigdi-status").textContent = "Não foi possível ler a planilha (verifique o compartilhamento). Mostrando dados de demonstração.";
    }
  }

  init();
  setInterval(()=>{ if(!SHEET_ID.includes("COLE_AQUI")) loadFromSheets().catch(()=>{}); }, 60000);
})();