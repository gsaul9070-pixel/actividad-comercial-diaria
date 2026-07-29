import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, onSnapshot, query,
  orderBy, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  firebaseConfig, ADVISORS_COLLECTION, REPORTS_COLLECTION
} from "./firebase-config.js";

const LEGACY_NIPS = {"130257": "9435", "152642": "2776", "158311": "6364", "161328": "2229", "162129": "1338", "164641": "1327", "165555": "5120", "169527": "8122", "169884": "3842", "171033": "5553", "171155": "6810", "172247": "6627", "172852": "8272", "173151": "6367", "173159": "1296", "502488": "8144"};

const state = {
  reports:[],
  advisors:[],
  manager:{
    uid:"manager-143561",
    employeeNumber:"143561",
    name:"SANTOS GUTIERREZ JACQUELINNE ADRIANA",
    role:"manager",
    active:true
  }
};

const authScreen = document.getElementById("authScreen");
const appElement = document.getElementById("app");
const loginError = document.getElementById("loginError");
const loginButton = document.getElementById("loginButton");

const digits = value => String(value || "").replace(/\D/g,"");
const localISO = () => {
  const d = new Date(), offset = d.getTimezoneOffset();
  return new Date(d.getTime()-offset*60000).toISOString().slice(0,10);
};
const esc = value => String(value ?? "")
  .replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;")
  .replaceAll("'","&#039;");
const formatDate = value => {
  if(!value) return "—";
  const p = String(value).slice(0,10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : value;
};
const timestampText = value => {
  if(!value) return "—";
  try{
    const d = value.toDate ? value.toDate() : new Date(value);
    return d.toLocaleString("es-MX");
  }catch{return "—";}
};
const showError = message => {
  loginError.textContent = message;
  loginError.classList.add("show");
};
const reviewLabel = report => {
  if(report.status === "cancelled") return '<span class="badge cancelled-badge">Anulado</span>';
  if(report.reviewStatus === "reviewed") return '<span class="badge reviewed">Revisado</span>';
  return '<span class="badge pending">Pendiente</span>';
};
const reportSearchText = report => [
  report.advisorName,report.advisorEmployeeNumber,report.activityPlace,
  report.prospecting,report.activityDescription,
  ...(report.clients || []).flatMap(c=>[
    c.name,c.nss,c.curp,c.phone,c.company,c.afore,c.notes
  ])
].join(" ").toLowerCase();

if(Object.values(firebaseConfig).some(value=>String(value).includes("REEMPLAZAR"))){
  showError("Falta colocar la configuración real de Firebase.");
  loginButton.disabled = true;
}else{
  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp);

  const normalizeAdvisor = item => {
    const employeeNumber = String(
      item.employeeNumber || item.advisorEmployeeNumber || item.id || ""
    );
    return {
      ...item,
      id:item.id || employeeNumber,
      employeeNumber,
      advisorUid:item.advisorUid || `employee-${employeeNumber}`,
      name:item.name || item.advisorName || item.fullName || "ASESOR",
      pin:String(item.pin ?? item.accessPin ?? item.password ?? item.PIN ?? "").replace(/\D/g,""),
      role:"advisor",
      active:item.active !== false &&
        !["inactive","inactivo"].includes(String(item.status || "").toLowerCase())
    };
  };


  async function loadLegacyNips(){
    const updates = [];

    for(const advisor of state.advisors){
      const employeeNumber = String(advisor.employeeNumber || advisor.id || "");
      const nip = LEGACY_NIPS[employeeNumber];

      if(!nip || advisor.pin) continue;

      updates.push(
        updateDoc(doc(db,ADVISORS_COLLECTION,advisor.id),{
          pin:nip,
          nipLoadedAt:serverTimestamp(),
          nipLoadedBy:"manager-143561",
          updatedAt:serverTimestamp()
        }).catch(error=>{
          console.error(`No se pudo cargar el NIP de ${employeeNumber}:`,error);
        })
      );
    }

    if(updates.length){
      await Promise.all(updates);
      console.log(`${updates.length} NIP(s) históricos cargados en Firestore.`);
    }
  }

  function openDashboard(){
    document.getElementById("managerName").textContent =
      "Resumen general de la actividad comercial";
    const sideManagerName = document.getElementById("sideManagerName");
    if(sideManagerName){
      sideManagerName.textContent =
        `${state.manager.name} · ${state.manager.employeeNumber}`;
    }
    authScreen.classList.add("hidden");
    appElement.classList.remove("hidden");

    onSnapshot(
      query(collection(db,REPORTS_COLLECTION),orderBy("createdAt","desc")),
      snapshot=>{
        state.reports = snapshot.docs.map(item=>({id:item.id,...item.data()}));
        renderAll();
      },
      error=>showError(`No fue posible cargar reportes: ${error.code || error.message}`)
    );

    onSnapshot(
      collection(db,ADVISORS_COLLECTION),
      snapshot=>{
        state.advisors = snapshot.docs
          .map(item=>normalizeAdvisor({id:item.id,...item.data()}))
          .sort((a,b)=>(a.name || "").localeCompare(b.name || ""));
        renderAll();
        loadLegacyNips();
      },
      error=>showError(`No fue posible cargar empleados: ${error.code || error.message}`)
    );
  }

  const granted = sessionStorage.getItem("manager_dialog_access") === "granted";
  if(granted){
    openDashboard();
  }else{
    const password = window.prompt("Ingresa la contraseña gerencial:");
    if(password === null){
      window.location.assign("./index.html");
    }else if(password !== "Saltillo20$$"){
      window.alert("Contraseña gerencial incorrecta.");
      window.location.assign("./index.html");
    }else{
      sessionStorage.setItem("manager_dialog_access","granted");
      openDashboard();
    }
  }

  function filteredReports(){
    const from = document.getElementById("dateFrom").value;
    const to = document.getElementById("dateTo").value;
    const advisor = document.getElementById("advisorFilter").value;
    const status = document.getElementById("statusFilter").value;
    const search = document.getElementById("searchFilter").value.trim().toLowerCase();

    return state.reports.filter(report=>{
      const date = report.createdDate || "";
      const computedStatus = report.status === "cancelled"
        ? "cancelled"
        : (report.reviewStatus === "reviewed" ? "reviewed" : "pending");

      return (!from || date >= from)
        && (!to || date <= to)
        && (!advisor || report.advisorUid === advisor)
        && (!status || computedStatus === status)
        && (!search || reportSearchText(report).includes(search));
    });
  }

  function renderAll(){
    renderAdvisorFilter();
    renderKPIs();
    renderCharts();
    renderRecentActivity();
    renderSummaryMissing();
    renderMissing();
    renderReports();
    renderStaff();
  }

  function renderAdvisorFilter(){
    const select = document.getElementById("advisorFilter");
    const current = select.value;
    const advisors = state.advisors.filter(u=>u.active !== false);

    select.innerHTML = '<option value="">Todos</option>' +
      advisors.map(u=>`<option value="${u.advisorUid}">${esc(u.name)}</option>`).join("");
    select.value = current;
  }

  function renderKPIs(){
    const today = localISO();
    const activeAdvisors = state.advisors.filter(u=>u.active !== false);
    const todayReports = state.reports.filter(
      r=>r.createdDate === today && r.status !== "cancelled"
    );
    const reported = new Set(todayReports.map(r=>r.advisorUid));
    const visible = filteredReports().filter(r=>r.status !== "cancelled");

    document.getElementById("kpiReports").textContent = visible.length;
    document.getElementById("kpiActive").textContent = activeAdvisors.length;
    document.getElementById("kpiReported").textContent = reported.size;
    document.getElementById("kpiContacts").textContent =
      visible.reduce((sum,r)=>sum + Number(r.contacts || 0),0);
    document.getElementById("kpiAppointments").textContent =
      visible.reduce((sum,r)=>sum + Number(r.appointmentsGenerated || 0),0);
    document.getElementById("kpiProcedures").textContent =
      visible.reduce((sum,r)=>sum + Number(r.procedureCount || 0),0);
  }


  function reportDateLabel(date){
    if(!date) return "—";
    const parts = String(date).split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;
  }

  function percent(value,total){
    if(!total) return 0;
    return Math.round((value / total) * 100);
  }

  function renderTrendCanvas(dayRows){
    const canvas = document.getElementById("trendCanvas");
    if(!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1,Math.round(rect.width * ratio));
    canvas.height = Math.max(1,Math.round(rect.height * ratio));

    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio,0,0,ratio,0,0);

    const width = rect.width;
    const height = rect.height;
    const pad = {left:42,right:18,top:18,bottom:38};
    const chartW = Math.max(1,width-pad.left-pad.right);
    const chartH = Math.max(1,height-pad.top-pad.bottom);

    ctx.clearRect(0,0,width,height);
    ctx.font = "11px Segoe UI, Arial";
    ctx.textBaseline = "middle";

    if(!dayRows.length){
      ctx.fillStyle = "#64748B";
      ctx.textAlign = "center";
      ctx.fillText("No hay datos para representar.",width/2,height/2);
      return;
    }

    const maxValue = Math.max(
      1,
      ...dayRows.flatMap(row=>[row.contacts,row.appointments,row.procedures])
    );
    const steps = 4;

    ctx.strokeStyle = "#E1E8F0";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#64748B";
    ctx.textAlign = "right";

    for(let i=0;i<=steps;i++){
      const y = pad.top + chartH - (chartH * i / steps);
      ctx.beginPath();
      ctx.moveTo(pad.left,y);
      ctx.lineTo(width-pad.right,y);
      ctx.stroke();
      ctx.fillText(String(Math.round(maxValue*i/steps)),pad.left-8,y);
    }

    const xFor = index => dayRows.length === 1
      ? pad.left + chartW/2
      : pad.left + chartW * index/(dayRows.length-1);
    const yFor = value => pad.top + chartH - chartH*(value/maxValue);

    ctx.textAlign = "center";
    ctx.fillStyle = "#64748B";
    const labelEvery = Math.max(1,Math.ceil(dayRows.length/7));
    dayRows.forEach((row,index)=>{
      if(index % labelEvery === 0 || index === dayRows.length-1){
        ctx.fillText(reportDateLabel(row.date),xFor(index),height-15);
      }
    });

    const series = [
      {key:"contacts",color:"#1C5D99"},
      {key:"appointments",color:"#FFB71B"},
      {key:"procedures",color:"#0E9F6E"}
    ];

    series.forEach(item=>{
      ctx.strokeStyle = item.color;
      ctx.fillStyle = item.color;
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();

      dayRows.forEach((row,index)=>{
        const x=xFor(index), y=yFor(row[item.key]);
        if(index===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      });
      ctx.stroke();

      dayRows.forEach((row,index)=>{
        const x=xFor(index), y=yFor(row[item.key]);
        ctx.beginPath();
        ctx.arc(x,y,3.5,0,Math.PI*2);
        ctx.fill();
        ctx.strokeStyle="#FFFFFF";
        ctx.lineWidth=2;
        ctx.stroke();
      });
    });
  }

  function renderCharts(){
    const reports = filteredReports().filter(report=>report.status !== "cancelled");
    const totals = reports.reduce((acc,report)=>{
      acc.contacts += Number(report.contacts || 0);
      acc.appointments += Number(report.appointmentsGenerated || 0);
      acc.procedures += Number(report.procedureCount || 0);
      if(report.reviewStatus === "reviewed") acc.reviewed += 1;
      return acc;
    },{contacts:0,appointments:0,procedures:0,reviewed:0});

    const appointmentRate = percent(totals.appointments,totals.contacts);
    const procedureRate = percent(totals.procedures,totals.contacts);
    const reviewedRate = percent(totals.reviewed,reports.length);

    document.getElementById("chartContacts").textContent = totals.contacts;
    document.getElementById("chartAppointments").textContent = totals.appointments;
    document.getElementById("chartProcedures").textContent = totals.procedures;
    document.getElementById("appointmentRate").textContent = `${appointmentRate}% de los contactos`;
    document.getElementById("procedureRate").textContent = `${procedureRate}% de los contactos`;
    document.getElementById("appointmentsProgress").style.width = `${Math.min(100,appointmentRate)}%`;
    document.getElementById("proceduresProgress").style.width = `${Math.min(100,procedureRate)}%`;
    document.getElementById("conversionBadge").textContent = `${procedureRate}% conversión`;

    const divisor = reports.length || 1;
    document.getElementById("avgContacts").textContent = (totals.contacts/divisor).toFixed(1);
    document.getElementById("avgAppointments").textContent = (totals.appointments/divisor).toFixed(1);
    document.getElementById("avgProcedures").textContent = (totals.procedures/divisor).toFixed(1);
    document.getElementById("reviewedRate").textContent = `${reviewedRate}%`;

    const byDay = new Map();
    reports.forEach(report=>{
      const date = report.createdDate || "Sin fecha";
      if(!byDay.has(date)){
        byDay.set(date,{date,contacts:0,appointments:0,procedures:0});
      }
      const item = byDay.get(date);
      item.contacts += Number(report.contacts || 0);
      item.appointments += Number(report.appointmentsGenerated || 0);
      item.procedures += Number(report.procedureCount || 0);
    });

    const dayRows = [...byDay.values()]
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)))
      .slice(-14);

    renderTrendCanvas(dayRows);
    document.getElementById("trendRangeBadge").textContent =
      dayRows.length ? `${dayRows.length} día(s)` : "Sin datos";

    const advisorMap = new Map();
    reports.forEach(report=>{
      const key = report.advisorUid || report.advisorEmployeeNumber || report.advisorName;
      if(!advisorMap.has(key)){
        advisorMap.set(key,{
          name:report.advisorName || "Sin nombre",
          number:report.advisorEmployeeNumber || "",
          procedures:0,
          contacts:0
        });
      }
      const item = advisorMap.get(key);
      item.procedures += Number(report.procedureCount || 0);
      item.contacts += Number(report.contacts || 0);
    });

    const top = [...advisorMap.values()]
      .sort((a,b)=>b.procedures-a.procedures || b.contacts-a.contacts)
      .slice(0,7);
    const max = Math.max(1,...top.map(item=>item.procedures));
    const container = document.getElementById("topAdvisorsChart");

    container.innerHTML = top.length
      ? top.map((item,index)=>`
          <div class="top-row">
            <div class="top-name">
              ${index+1}. ${esc(item.name)}
              <span class="top-meta">${esc(item.number)} · ${item.contacts} contacto(s)</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${Math.max(4,(item.procedures/max)*100)}%"></div>
            </div>
            <div class="top-value">${item.procedures}</div>
          </div>
        `).join("")
      : '<div class="empty">No hay información para generar el ranking.</div>';
  }


  function relativeActivityTime(report){
    try{
      const date = report.createdAt?.toDate ? report.createdAt.toDate() : new Date(report.createdAtLocal || report.createdDate || Date.now());
      const minutes = Math.max(0,Math.floor((Date.now()-date.getTime())/60000));
      if(minutes < 1) return "Ahora";
      if(minutes < 60) return `Hace ${minutes} min`;
      const hours = Math.floor(minutes/60);
      if(hours < 24) return `Hace ${hours} h`;
      return formatDate(report.createdDate);
    }catch{return formatDate(report.createdDate);}
  }

  function renderRecentActivity(){
    const reports = [...state.reports]
      .filter(report=>report.status !== "cancelled")
      .sort((a,b)=>{
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAtLocal || a.createdDate || 0).getTime();
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAtLocal || b.createdDate || 0).getTime();
        return bTime-aTime;
      }).slice(0,12);

    const rows = reports.length ? reports.map(report=>`
      <div class="activity-item">
        <div class="activity-icon">↗</div>
        <div class="activity-copy">
          <strong>${esc(report.advisorName || "Asesor")} registró actividad</strong>
          <span>${esc(report.activityPlace || report.prospecting || "Actividad comercial")} · ${Number(report.contacts || 0)} contacto(s), ${Number(report.appointmentsGenerated || 0)} cita(s), ${Number(report.procedureCount || 0)} trámite(s)</span>
        </div>
        <div class="activity-time">${esc(relativeActivityTime(report))}</div>
      </div>`).join("") : '<div class="empty">Todavía no hay actividad registrada.</div>';

    const full = document.getElementById("recentActivityFeed");
    const compact = document.getElementById("summaryRecentActivity");
    if(full) full.innerHTML = rows;
    if(compact) compact.innerHTML = rows;
    const count = document.getElementById("recentActivityCount");
    if(count) count.textContent = reports.length;
  }

  function renderSummaryMissing(){
    const today = localISO();
    const reported = new Set(state.reports.filter(r=>r.createdDate===today && r.status!=="cancelled").map(r=>r.advisorUid));
    const missing = state.advisors.filter(a=>a.active!==false && !reported.has(a.advisorUid));
    const preview = document.getElementById("summaryMissingAdvisors");
    const count = document.getElementById("summaryMissingCount");
    if(count) count.textContent = missing.length;
    if(preview) preview.innerHTML = missing.length
      ? missing.slice(0,8).map(item=>`<span class="pending-person">${esc(item.name)}</span>`).join("")
      : '<span class="badge reviewed">Todos reportaron hoy</span>';
  }

  function renderMissing(){
    const today = localISO();
    const reported = new Set(
      state.reports
        .filter(r=>r.createdDate === today && r.status !== "cancelled")
        .map(r=>r.advisorUid)
    );

    const missing = state.advisors.filter(
      u=>u.active !== false && !reported.has(u.advisorUid)
    );

    document.getElementById("missingCount").textContent = missing.length;
    document.getElementById("missingAdvisors").innerHTML =
      missing.length
        ? missing.map(u=>`<span>${esc(u.employeeNumber)} · ${esc(u.name)}</span>`).join("")
        : '<span style="background:#E8F8F0;color:#087554">Todos los asesores activos han reportado.</span>';
  }

  function renderReports(){
    const rows = filteredReports();
    document.getElementById("visibleCount").textContent = `${rows.length} registro(s)`;
    const body = document.getElementById("reportsBody");

    if(!rows.length){
      body.innerHTML = '<tr><td colspan="9" class="empty">No hay reportes con los filtros seleccionados.</td></tr>';
      return;
    }

    body.innerHTML = rows.map(report=>`
      <tr class="${report.status === "cancelled" ? "cancelled" : ""}">
        <td>${formatDate(report.createdDate)}<br><small>${esc(report.createdAtLocal || "")}</small></td>
        <td><strong>${esc(report.advisorName)}</strong><br>${esc(report.advisorEmployeeNumber)}</td>
        <td>${esc(report.prospecting)}<br><small>${esc(report.activityPlace)}</small></td>
        <td>${Number(report.contacts || 0)}</td>
        <td>${Number(report.appointmentsGenerated || 0)}</td>
        <td>${Number(report.clientCount || (report.clients || []).length)}</td>
        <td>${Number(report.procedureCount || 0)}</td>
        <td>${reviewLabel(report)}</td>
        <td>
          <div class="actions">
            <button class="soft" onclick="window.openReportDetail('${report.id}')">Ver</button>
            ${report.status !== "cancelled" && report.reviewStatus !== "reviewed"
              ? `<button class="accent" onclick="window.markReviewed('${report.id}')">Revisar</button>` : ""}
            ${report.status !== "cancelled"
              ? `<button class="danger" onclick="window.cancelReport('${report.id}')">Anular</button>` : ""}
          </div>
        </td>
      </tr>
    `).join("");
  }

  function renderStaff(){
    const advisors = state.advisors;
    const active = advisors.filter(user=>user.active === true).length;
    const inactive = advisors.filter(user=>user.active !== true).length;

    document.getElementById("staffCount").textContent = `${advisors.length} asesor(es)`;
    document.getElementById("staffActiveCount").textContent = `${active} activo(s)`;
    document.getElementById("staffInactiveCount").textContent = `${inactive} retirado(s)`;

    const body = document.getElementById("staffBody");

    if(!advisors.length){
      body.innerHTML = '<tr><td colspan="7" class="empty">Todavía no hay asesores asignados.</td></tr>';
      return;
    }

    body.innerHTML = advisors.map(user=>`
      <tr>
        <td><strong>${esc(user.employeeNumber)}</strong></td>
        <td>
          <strong class="staff-name">${esc(user.name)}</strong>
          <br><small class="staff-subtext">Asesor comercial</small>
        </td>
        <td class="nip-cell">
          <div class="nip-wrap">
            <span
              id="nip-${esc(user.id)}"
              class="nip-value"
              data-pin="${esc(user.pin || "")}"
              data-visible="false"
            >${user.pin ? "••••" : "Sin NIP"}</span>
            ${user.pin ? `
              <button
                type="button"
                class="icon-button"
                title="Mostrar u ocultar NIP"
                onclick="window.toggleEmployeePin('${esc(user.id)}')"
              >👁</button>
            ` : ""}
          </div>
        </td>
        <td><span class="badge pending">Asesor</span></td>
        <td>
          <span class="badge ${user.active ? "reviewed" : "cancelled-badge"}">
            ${user.active ? "Activo" : "Retirado"}
          </span>
        </td>
        <td>${timestampText(user.lastLoginAt)}</td>
        <td>
          <div class="actions">
            <button class="soft" onclick="window.changeEmployeePin('${esc(user.id)}')">
              Cambiar NIP
            </button>
            ${user.active
              ? `<button class="danger" onclick="window.removeEmployee('${esc(user.id)}')">Quitar acceso</button>`
              : `<button class="accent" onclick="window.restoreEmployee('${esc(user.id)}')">Reasignar</button>`}
          </div>
        </td>
      </tr>
    `).join("");
  }

  window.toggleEmployeePin = function(id){
    const element = document.getElementById(`nip-${id}`);
    if(!element) return;

    const pin = element.dataset.pin || "";
    const visible = element.dataset.visible === "true";

    element.textContent = visible ? "••••" : pin;
    element.dataset.visible = visible ? "false" : "true";

    if(!visible){
      window.setTimeout(()=>{
        if(element && element.dataset.visible === "true"){
          element.textContent = "••••";
          element.dataset.visible = "false";
        }
      },10000);
    }
  };

  window.changeEmployeePin = async function(id){
    const advisor = state.advisors.find(item=>item.id === id);
    if(!advisor) return;

    const newPin = digits(window.prompt(
      `Escribe el nuevo NIP de 4 dígitos para ${advisor.name}:`,
      ""
    ));

    if(!newPin) return;
    if(newPin.length !== 4){
      window.alert("El NIP debe contener exactamente 4 dígitos.");
      return;
    }

    const confirmation = digits(window.prompt("Confirma nuevamente el NIP:",""));
    if(confirmation !== newPin){
      window.alert("Los NIP no coinciden. No se realizaron cambios.");
      return;
    }

    await updateDoc(doc(db,ADVISORS_COLLECTION,id),{
      pin:newPin,
      updatedAt:serverTimestamp(),
      pinUpdatedAt:serverTimestamp(),
      pinUpdatedBy:"manager-143561"
    });

    window.alert(`NIP actualizado para ${advisor.name}.`);
  };

  window.openReportDetail = function(id){
    const report = state.reports.find(r=>r.id === id);
    if(!report) return;

    document.getElementById("detailTitle").textContent =
      `${report.advisorName} · ${formatDate(report.createdDate)}`;

    const clients = report.clients || [];
    document.getElementById("detailContent").innerHTML = `
      <div class="detail-grid">
        <div class="detail-box"><strong>Medio</strong>${esc(report.prospecting)}</div>
        <div class="detail-box"><strong>Lugar</strong>${esc(report.activityPlace)}</div>
        <div class="detail-box"><strong>Horario</strong>${esc(report.activitySchedule || "—")}</div>
        <div class="detail-box"><strong>Contactos</strong>${Number(report.contacts || 0)}</div>
        <div class="detail-box"><strong>Citas</strong>${Number(report.appointmentsGenerated || 0)}</div>
        <div class="detail-box"><strong>Revisión</strong>${reviewLabel(report)}</div>
      </div>

      <h3>Actividad realizada</h3>
      <p>${esc(report.activityDescription)}</p>

      <h3>Clientes registrados</h3>
      <div class="table-wrap">
        <table class="client-table">
          <thead><tr><th>Cliente</th><th>NSS / CURP</th><th>Teléfono</th><th>Empresa</th><th>Puntos</th><th>AFORE</th><th>Resultado</th><th>Observación</th></tr></thead>
          <tbody>${clients.map(c=>`
            <tr>
              <td>${esc(c.name)}</td>
              <td>${esc(c.nss)}<br>${esc(c.curp)}</td>
              <td>${esc(c.phone)}</td>
              <td>${esc(c.company)}</td>
              <td>${Number(c.points || 0)}</td>
              <td>${esc(c.afore)}</td>
              <td>${esc(c.result)}</td>
              <td>${esc(c.notes)}${c.appointment ? `<br><strong>Cita:</strong> ${formatDate(c.appointment)}`:""}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>

      <h3>Plan de trabajo</h3>
      <div class="detail-grid">
        <div class="detail-box"><strong>Fecha</strong>${formatDate(report.plan?.date)}</div>
        <div class="detail-box"><strong>Lugar</strong>${esc(report.plan?.place)}</div>
        <div class="detail-box"><strong>Medio</strong>${esc(report.plan?.method)}</div>
        <div class="detail-box"><strong>Horario</strong>${esc(report.plan?.schedule || "—")}</div>
        <div class="detail-box"><strong>Meta contactos</strong>${Number(report.plan?.contactGoal || 0)}</div>
        <div class="detail-box"><strong>Meta citas</strong>${Number(report.plan?.appointmentGoal || 0)}</div>
      </div>
      <p>${esc(report.plan?.description)}</p>
      ${report.cancellationReason ? `<h3>Motivo de anulación</h3><p>${esc(report.cancellationReason)}</p>`:""}
    `;
    document.getElementById("detailModal").classList.add("show");
  };

  window.markReviewed = async function(id){
    if(!confirm("¿Marcar este reporte como revisado?")) return;
    await updateDoc(doc(db, REPORTS_COLLECTION, id),{
      reviewStatus:"reviewed",
      reviewedAt:serverTimestamp(),
      reviewedBy:"manager-143561",
      reviewedByName:state.manager.name,
      updatedAt:serverTimestamp()
    });
  };

  window.cancelReport = async function(id){
    const reason = prompt("Escribe el motivo de la anulación:");
    if(!reason?.trim()) return;

    await updateDoc(doc(db, REPORTS_COLLECTION, id),{
      status:"cancelled",
      cancellationReason:reason.trim(),
      cancelledAt:serverTimestamp(),
      cancelledBy:"manager-143561",
      cancelledByName:state.manager.name,
      updatedAt:serverTimestamp()
    });
  };

  window.openEmployeeModal = function(){
    const modal = document.getElementById("employeeModal");
    const form = document.getElementById("employeeForm");
    const errorBox = document.getElementById("employeeFormError");

    form.reset();
    errorBox.classList.remove("show");
    errorBox.textContent = "";
    modal.classList.add("show");
    setTimeout(()=>document.getElementById("newEmployeeNumber").focus(),50);
  };

  window.closeEmployeeModal = function(){
    document.getElementById("employeeModal").classList.remove("show");
  };

  document.getElementById("employeeForm").addEventListener("submit", async event=>{
    event.preventDefault();

    const button = document.getElementById("saveEmployeeButton");
    const errorBox = document.getElementById("employeeFormError");
    const employeeNumber = digits(document.getElementById("newEmployeeNumber").value);
    const pin = digits(document.getElementById("newEmployeePin").value);
    const name = document.getElementById("newEmployeeName").value.trim().replace(/\s+/g," ");

    errorBox.classList.remove("show");
    errorBox.textContent = "";

    try{
      if(employeeNumber.length < 4){
        throw new Error("Ingresa un número de empleado válido.");
      }
      if(pin.length !== 4){
        throw new Error("El NIP debe contener exactamente 4 dígitos.");
      }
      if(name.length < 5){
        throw new Error("Ingresa el nombre completo del empleado.");
      }
      if(employeeNumber === "143561"){
        throw new Error("Ese número pertenece al usuario gerencial.");
      }
      if(state.advisors.some(user=>String(user.employeeNumber) === employeeNumber)){
        throw new Error("Ese número de empleado ya está asignado.");
      }

      button.disabled = true;
      button.textContent = "Asignando…";

      const uid = employeeNumber;

      await setDoc(doc(db,ADVISORS_COLLECTION,employeeNumber),{
        employeeNumber,
        name:name.toUpperCase(),
        role:"advisor",
        active:true,
        pin,
        
        createdAt:serverTimestamp(),
        createdBy:"manager-143561",
        createdByName:state.manager.name,
        updatedAt:serverTimestamp()
      });

      window.closeEmployeeModal();
      alert(`Empleado ${employeeNumber} asignado correctamente.`);
    }catch(error){
      console.error(error);
      errorBox.textContent = error.message || "No fue posible asignar al empleado.";
      errorBox.classList.add("show");
    }finally{
      button.disabled = false;
      button.textContent = "Asignar empleado";
    }
  });

  window.removeEmployee = async function(uid){
    const user = state.advisors.find(item=>item.uid === uid);
    if(!user) return;

    const confirmation = prompt(
      `Para quitar el acceso de ${user.name}, escribe su número de empleado:`
    );

    if(confirmation !== String(user.employeeNumber)){
      if(confirmation !== null) alert("El número no coincide. No se realizaron cambios.");
      return;
    }

    await updateDoc(doc(db,ADVISORS_COLLECTION,uid),{
      active:false,
      removedAt:serverTimestamp(),
      removedBy:"manager-143561",
      removedByName:state.manager.name,
      updatedAt:serverTimestamp()
    });
  };

  window.restoreEmployee = async function(uid){
    const user = state.advisors.find(item=>item.uid === uid);
    if(!user) return;
    if(!confirm(`¿Reasignar el acceso a ${user.name}?`)) return;

    await updateDoc(doc(db,ADVISORS_COLLECTION,uid),{
      active:true,
      restoredAt:serverTimestamp(),
      restoredBy:"manager-143561",
      restoredByName:state.manager.name,
      updatedAt:serverTimestamp()
    });
  };

  window.logoutManager = function(){
    sessionStorage.removeItem("manager_dialog_access");
    window.location.assign("./index.html");
  };

  window.exportDashboardExcel = function(){
    const reports = filteredReports();

    const reportRows = reports.map(r=>({
      "Fecha":r.createdDate,
      "Fecha y hora local":r.createdAtLocal,
      "Número de empleado":r.advisorEmployeeNumber,
      "Asesor":r.advisorName,
      "Medio de prospección":r.prospecting,
      "Lugar":r.activityPlace,
      "Horario":r.activitySchedule,
      "Contactos":Number(r.contacts || 0),
      "Citas generadas":Number(r.appointmentsGenerated || 0),
      "Clientes":Number(r.clientCount || (r.clients || []).length),
      "Trámites realizados":Number(r.procedureCount || 0),
      "Descripción":r.activityDescription,
      "Estado":r.status === "cancelled" ? "Anulado" : "Finalizado",
      "Revisión":r.reviewStatus === "reviewed" ? "Revisado" : "Pendiente",
      "Plan - fecha":r.plan?.date,
      "Plan - lugar":r.plan?.place,
      "Plan - medio":r.plan?.method,
      "Plan - horario":r.plan?.schedule,
      "Plan - meta contactos":Number(r.plan?.contactGoal || 0),
      "Plan - meta citas":Number(r.plan?.appointmentGoal || 0),
      "Plan - descripción":r.plan?.description,
      "Motivo de anulación":r.cancellationReason || ""
    }));

    const clientRows = reports.flatMap(r=>(r.clients || []).map(c=>({
      "Fecha":r.createdDate,
      "Número de empleado":r.advisorEmployeeNumber,
      "Asesor":r.advisorName,
      "Cliente":c.name,
      "CURP":c.curp,
      "NSS":c.nss,
      "Teléfono":c.phone,
      "Correo o dirección":c.email,
      "Empresa":c.company,
      "Puntos":Number(c.points || 0),
      "AFORE":c.afore,
      "Resultado":c.result,
      "Fecha posible de cita":c.appointment,
      "Observación":c.notes,
      "Estado del reporte":r.status === "cancelled" ? "Anulado" : "Finalizado"
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(reportRows),"Reportes");
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(clientRows),"Clientes");
    XLSX.writeFile(
      workbook,
      `Actividad_Comercial_Dashboard_${localISO()}.xlsx`,
      {compression:true}
    );
  };

  ["dateFrom","dateTo","advisorFilter","statusFilter","searchFilter"].forEach(id=>{
    document.getElementById(id).addEventListener(
      id === "searchFilter" ? "input" : "change",
      renderAll
    );
  });

  function openPanel(panelId){
    const target = document.getElementById(panelId);
    if(!target) return;
    document.querySelectorAll(".panel").forEach(panel=>panel.classList.remove("active"));
    document.querySelectorAll(".side-nav .tab").forEach(item=>item.classList.remove("active"));
    target.classList.add("active");
    const nav = document.querySelector(`.side-nav .tab[data-panel="${panelId}"]`);
    if(nav) nav.classList.add("active");
    window.scrollTo({top:0,behavior:"smooth"});
    if(panelId === "summaryPanel") setTimeout(renderCharts,180);
  }

  document.querySelectorAll(".tab[data-panel]").forEach(button=>{
    button.addEventListener("click",()=>openPanel(button.dataset.panel));
  });
  document.querySelectorAll(".tab-jump[data-target]").forEach(button=>{
    button.addEventListener("click",()=>openPanel(button.dataset.target));
  });
  window.openDashboardPanel = openPanel;

  const today = localISO();
  document.getElementById("dateFrom").value = today.slice(0,8) + "01";
  document.getElementById("dateTo").value = today;
}
