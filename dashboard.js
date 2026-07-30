import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, updateDoc, arrayUnion,
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  firebaseConfig, ADVISORS_COLLECTION, REPORTS_COLLECTION
} from "./firebase-config.js";

const LEGACY_NIPS = {
  "130257":"9435","152642":"2776","158311":"6364","161328":"2229",
  "162129":"1338","164641":"1327","165555":"5120","169527":"8122",
  "169884":"3842","171033":"5553","171155":"6810","172247":"6627",
  "172852":"8272","173151":"6367","173159":"1296","502488":"8144"
};

const state = {
  reports:[], advisors:[],
  calendarDate:new Date(), selectedDate:null, calendarAdvisor:"",
  manager:{uid:"manager-143561",name:"Jacquelinne",employeeNumber:"143561"}
};

const $ = id => document.getElementById(id);
const digits = value => String(value || "").replace(/\D/g,"");
const esc = value => String(value ?? "")
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");
const localISO = date => {
  const d = date ? new Date(date) : new Date();
  return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
};
const formatDate = value => {
  if(!value) return "—";
  const p=String(value).slice(0,10).split("-");
  return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:value;
};
const timestampText = value => {
  if(!value) return "—";
  try{
    const d=value.toDate?value.toDate():new Date(value);
    return d.toLocaleString("es-MX");
  }catch{return "—";}
};
const reportTime = report => {
  try{
    return report.createdAt?.toDate
      ? report.createdAt.toDate().getTime()
      : new Date(report.createdAtLocal || report.createdDate || 0).getTime();
  }catch{return 0;}
};
const closureCount = report => Number(
  report.closureCount ??
  report.procedureCount ??
  (report.clients || []).filter(c=>["Cierre","Trámite realizado"].includes(c.result)).length
);
const socialPerformed = report =>
  report.socialService?.performed === true ||
  Number(report.socialServiceCount || 0) > 0 ||
  (report.clients || []).some(client => client.result === "Servicio social");
const socialPeople = report => Number(
  report.socialService?.peopleReached ?? report.peopleReached ?? 0
);
const advisorActive = advisor =>
  advisor.active !== false &&
  !["inactive","inactivo"].includes(String(advisor.status || "").toLowerCase());
const reportSearch = report => [
  report.advisorName,report.advisorEmployeeNumber,report.activityPlace,
  report.prospecting,report.activityDescription,report.generalNotes,
  ...(report.clients||[]).flatMap(c=>[c.name,c.nss,c.curp,c.phone,c.company,c.afore,c.notes])
].join(" ").toLowerCase();

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function normalizeAdvisor(item){
  const employeeNumber=String(item.employeeNumber||item.advisorEmployeeNumber||item.id||"");
  return {
    ...item,id:item.id||employeeNumber,employeeNumber,
    advisorUid:item.advisorUid||`employee-${employeeNumber}`,
    name:item.name||item.advisorName||item.fullName||"ASESOR",
    pin:digits(item.pin??item.nip??item.accessPin??item.password??item.PIN??""),
    active:advisorActive(item)
  };
}

function authorize(){
  if(sessionStorage.getItem("manager_dialog_access")==="granted"){
    openApp(); return;
  }
  const password=window.prompt("Ingresa la contraseña gerencial:");
  if(password===null){window.location.assign("./index.html");return;}
  if(password!=="Saltillo20$$"){
    alert("Contraseña gerencial incorrecta.");
    window.location.assign("./index.html");return;
  }
  sessionStorage.setItem("manager_dialog_access","granted");
  openApp();
}

function openApp(){
  $("authScreen").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("todayBadge").textContent=new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"});
  subscribeData();
}

function subscribeData(){
  onSnapshot(collection(db,REPORTS_COLLECTION),snapshot=>{
    state.reports=snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>reportTime(b)-reportTime(a));
    renderAll();
  },error=>console.error("Reportes:",error));

  onSnapshot(collection(db,ADVISORS_COLLECTION),snapshot=>{
    state.advisors=snapshot.docs.map(d=>normalizeAdvisor({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name));
    loadLegacyNips();
    fillAdvisorSelectors();
    renderAll();
  },error=>console.error("Asesores:",error));
}

async function loadLegacyNips(){
  for(const advisor of state.advisors){
    const nip=LEGACY_NIPS[advisor.employeeNumber];
    if(nip && !advisor.pin){
      try{
        await updateDoc(doc(db,ADVISORS_COLLECTION,advisor.id),{
          pin:nip,nipLoadedAt:serverTimestamp(),updatedAt:serverTimestamp()
        });
      }catch(error){console.warn("NIP:",advisor.employeeNumber,error);}
    }
  }
}

function selectedReports(){
  const advisor=$("globalAdvisorFilter")?.value||"";
  return state.reports.filter(r=>!advisor||r.advisorUid===advisor||String(r.advisorEmployeeNumber)===advisor);
}

function filteredReports(){
  const from=$("dateFrom")?.value||"";
  const to=$("dateTo")?.value||"";
  const advisor=$("advisorFilter")?.value||"";
  const status=$("statusFilter")?.value||"";
  const search=($("searchFilter")?.value||"").trim().toLowerCase();
  return state.reports.filter(r=>{
    if(from && String(r.createdDate||"")<from)return false;
    if(to && String(r.createdDate||"")>to)return false;
    if(advisor && r.advisorUid!==advisor && String(r.advisorEmployeeNumber)!==advisor)return false;
    if(status==="cancelled" && r.status!=="cancelled")return false;
    if(status==="reviewed" && r.reviewStatus!=="reviewed")return false;
    if(status==="pending" && (r.reviewStatus==="reviewed"||r.status==="cancelled"))return false;
    if(search && !reportSearch(r).includes(search))return false;
    return true;
  });
}

function fillAdvisorSelectors(){
  const selectors=[$("globalAdvisorFilter"),$("advisorFilter"),$("calendarAdvisorFilter")].filter(Boolean);
  selectors.forEach(select=>{
    const current=select.value;
    const first=select.id==="globalAdvisorFilter"||select.id==="calendarAdvisorFilter"?"Todos los asesores":"Todos";
    select.innerHTML=`<option value="">${first}</option>`+state.advisors.map(a=>`<option value="${esc(a.advisorUid)}">${esc(a.name)} · ${esc(a.employeeNumber)}</option>`).join("");
    select.value=current;
  });
}

function renderAll(){
  renderKPIs();renderTrend();renderFunnel();renderTopAdvisors();renderActivityTypes();
  renderMiniCalendar();renderActivities();renderMissing();renderReports();renderCalendar();
  renderSocial();renderStaff();
}

function totals(reports){
  return reports.reduce((a,r)=>{
    a.contacts+=Number(r.contacts||0);a.appointments+=Number(r.appointmentsGenerated||0);
    a.closures+=closureCount(r);a.prospects+=Number(r.clientCount??(r.clients||[]).length);
    a.social+=socialPerformed(r)?1:0;a.socialPeople+=socialPeople(r);
    a.reviewed+=r.reviewStatus==="reviewed"?1:0;
    return a;
  },{contacts:0,appointments:0,closures:0,prospects:0,social:0,socialPeople:0,reviewed:0});
}

function renderKPIs(){
  const reports=selectedReports().filter(r=>r.status!=="cancelled");
  const t=totals(reports);
  $("kpiContacts").textContent=t.contacts;$("kpiAppointments").textContent=t.appointments;
  $("kpiClosures").textContent=t.closures;$("kpiProspects").textContent=t.prospects;
  $("kpiSocial").textContent=t.social;$("kpiActive").textContent=state.advisors.filter(a=>a.active).length;
  const count=reports.length||1;
  $("avgContacts").textContent=(t.contacts/count).toFixed(1);
  $("avgAppointments").textContent=(t.appointments/count).toFixed(1);
  $("avgClosures").textContent=(t.closures/count).toFixed(1);
  $("avgSocial").textContent=(t.social/count).toFixed(1);
  $("reviewedRate").textContent=`${Math.round(t.reviewed/count*100)}%`;
}

function canvasSetup(canvas){
  const rect=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1;
  canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));
  const ctx=canvas.getContext("2d");ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,rect.width,rect.height);
  return {ctx,width:rect.width,height:rect.height};
}

function daySeries(reports,limit=7){
  const map=new Map();
  reports.filter(r=>r.status!=="cancelled").forEach(r=>{
    const date=r.createdDate||"";
    if(!map.has(date))map.set(date,{date,contacts:0,appointments:0,closures:0,social:0});
    const x=map.get(date);x.contacts+=Number(r.contacts||0);x.appointments+=Number(r.appointmentsGenerated||0);
    x.closures+=closureCount(r);x.social+=socialPerformed(r)?1:0;
  });
  return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-limit);
}

function drawLineChart(canvas,rows,series){
  if(!canvas)return;
  const {ctx,width,height}=canvasSetup(canvas),pad={l:38,r:14,t:14,b:32},cw=width-pad.l-pad.r,ch=height-pad.t-pad.b;
  if(!rows.length){ctx.fillStyle="#AFC5E6";ctx.textAlign="center";ctx.fillText("Sin datos",width/2,height/2);return;}
  const max=Math.max(1,...rows.flatMap(r=>series.map(s=>r[s.key])));
  ctx.font="10px Segoe UI";ctx.strokeStyle="#174579";ctx.fillStyle="#AFC5E6";ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const y=pad.t+ch-ch*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(width-pad.r,y);ctx.stroke();ctx.textAlign="right";ctx.fillText(String(Math.round(max*i/4)),pad.l-7,y+3);}
  const x=i=>rows.length===1?pad.l+cw/2:pad.l+cw*i/(rows.length-1),y=v=>pad.t+ch-ch*v/max;
  rows.forEach((r,i)=>{ctx.textAlign="center";ctx.fillStyle="#AFC5E6";ctx.fillText(formatDate(r.date).slice(0,5),x(i),height-9);});
  series.forEach(s=>{
    ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=3;ctx.beginPath();
    rows.forEach((r,i)=>i?ctx.lineTo(x(i),y(r[s.key])):ctx.moveTo(x(i),y(r[s.key])));ctx.stroke();
    rows.forEach((r,i)=>{ctx.beginPath();ctx.arc(x(i),y(r[s.key]),3.3,0,Math.PI*2);ctx.fill();});
  });
}

function renderTrend(){drawLineChart($("trendCanvas"),daySeries(selectedReports(),7),[{key:"contacts",color:"#2E8BFF"},{key:"appointments",color:"#FFB71B"},{key:"closures",color:"#20CA88"}]);}
function renderFunnel(){
  const t=totals(selectedReports().filter(r=>r.status!=="cancelled"));
  $("funnelContacts").textContent=t.contacts;$("funnelAppointments").textContent=t.appointments;$("funnelClosures").textContent=t.closures;
  $("conversionBadge").textContent=`${t.contacts?Math.round(t.closures/t.contacts*100):0}% conversión`;
}

function renderTopAdvisors(){
  const map=new Map();selectedReports().filter(r=>r.status!=="cancelled").forEach(r=>{
    const key=r.advisorUid||r.advisorEmployeeNumber||r.advisorName;
    if(!map.has(key))map.set(key,{name:r.advisorName||"Asesor",closures:0,contacts:0});
    const x=map.get(key);x.closures+=closureCount(r);x.contacts+=Number(r.contacts||0);
  });
  const rows=[...map.values()].sort((a,b)=>b.closures-a.closures||b.contacts-a.contacts).slice(0,7),max=Math.max(1,...rows.map(r=>r.closures));
  $("topAdvisors").innerHTML=rows.length?rows.map((r,i)=>`<div class="rank-row"><strong>${i+1}</strong><div><span>${esc(r.name)}</span><div class="rank-bar"><i style="width:${Math.max(5,r.closures/max*100)}%"></i></div></div><strong>${r.closures}</strong></div>`).join(""):'<div class="empty">Sin datos.</div>';
}

function renderActivityTypes(){
  const canvas=$("activityTypeCanvas");if(!canvas)return;
  const map=new Map();selectedReports().filter(r=>r.status!=="cancelled").forEach(r=>map.set(r.prospecting||"Otro",(map.get(r.prospecting||"Otro")||0)+1));
  const rows=[...map.entries()].sort((a,b)=>b[1]-a[1]),colors=["#1266D7","#FFB71B","#0E9F6E","#7D50E7","#E94C86","#19BED2"];
  const {ctx,width,height}=canvasSetup(canvas),total=rows.reduce((s,r)=>s+r[1],0)||1,cx=width*.38,cy=height*.5,r=Math.min(width,height)*.28,inner=r*.55;
  let start=-Math.PI/2;rows.forEach(([name,val],i)=>{const a=val/total*Math.PI*2;ctx.beginPath();ctx.arc(cx,cy,r,start,start+a);ctx.arc(cx,cy,inner,start+a,start,true);ctx.closePath();ctx.fillStyle=colors[i%colors.length];ctx.fill();start+=a;});
  ctx.font="11px Segoe UI";rows.slice(0,6).forEach(([name,val],i)=>{const y=40+i*27;ctx.fillStyle=colors[i%colors.length];ctx.fillRect(width*.72,y-8,10,10);ctx.fillStyle="#DCE9FB";ctx.fillText(`${name} (${val})`,width*.72+16,y);});
}

function relativeTime(report){
  const mins=Math.max(0,Math.floor((Date.now()-reportTime(report))/60000));
  if(mins<1)return"Ahora";if(mins<60)return`Hace ${mins} min`;if(mins<1440)return`Hace ${Math.floor(mins/60)} h`;return formatDate(report.createdDate);
}
function renderActivities(){
  const rows=state.reports.filter(r=>r.status!=="cancelled").slice(0,15);
  $("activityCount").textContent=rows.length;
  $("activityFeed").innerHTML=rows.length?rows.map(r=>`<div class="activity-item"><div class="item-icon">↗</div><div class="item-copy"><strong>${esc(r.advisorName||"Asesor")} registró actividad</strong><span>${esc(r.activityPlace||r.prospecting||"Actividad")} · ${Number(r.contacts||0)} contactos · ${closureCount(r)} cierres</span></div><div class="item-time">${relativeTime(r)}</div></div>`).join(""):'<div class="empty">Sin actividad.</div>';
}
function renderMissing(){
  const today=localISO(),reported=new Set(state.reports.filter(r=>r.createdDate===today&&r.status!=="cancelled").map(r=>r.advisorUid));
  const missing=state.advisors.filter(a=>a.active&&!reported.has(a.advisorUid));$("missingCount").textContent=missing.length;
  $("missingAdvisors").innerHTML=missing.length?missing.map(a=>`<div class="activity-item"><div class="item-icon">!</div><div class="item-copy"><strong>${esc(a.name)}</strong><span>Empleado ${esc(a.employeeNumber)} · Sin reporte hoy</span></div></div>`).join(""):'<div class="empty">Todos reportaron hoy.</div>';
}

function reviewBadge(r){if(r.status==="cancelled")return'<span class="status cancelled">Anulado</span>';if(r.reviewStatus==="reviewed")return'<span class="status reviewed">Revisado</span>';return'<span class="status pending">Pendiente</span>';}
function renderReports(){
  const rows=filteredReports();$("visibleCount").textContent=`${rows.length} registro(s)`;
  $("reportsBody").innerHTML=rows.length?rows.map(r=>`<tr><td>${formatDate(r.createdDate)}<br><small>${esc(r.createdAtLocal||"")}</small></td><td><strong>${esc(r.advisorName||"")}</strong><br>${esc(r.advisorEmployeeNumber||"")}</td><td>${esc(r.prospecting||"")}<br><small>${esc(r.activityPlace||"")}</small></td><td>${Number(r.contacts||0)}</td><td>${Number(r.appointmentsGenerated||0)}</td><td>${Number(r.clientCount??(r.clients||[]).length)}</td><td>${closureCount(r)}</td><td>${socialPerformed(r)?`Sí · ${socialPeople(r)} pers.`:"No"}</td><td>${reviewBadge(r)}</td><td><div class="actions"><button class="soft" onclick="window.openReportDetail('${r.id}')">Ver</button>${r.status!=="cancelled"&&r.reviewStatus!=="reviewed"?`<button class="success" onclick="window.reviewReport('${r.id}')">Revisar</button>`:""}${r.status!=="cancelled"?`<button class="danger" onclick="window.cancelReport('${r.id}')">Anular</button>`:""}<button class="report-note-button" onclick="window.openReportNotes('${r.id}')">Notas${Array.isArray(r.managerNotes)&&r.managerNotes.length?` (${r.managerNotes.length})`:""}</button></div></td></tr>`).join(""):'<tr><td colspan="10" class="empty">Sin reportes.</td></tr>';
}

window.openReportDetail=id=>{
  const r=state.reports.find(x=>x.id===id);if(!r)return;
  $("detailTitle").textContent=`Reporte · ${r.advisorName||""}`;
  $("detailContent").innerHTML=`<div class="grid two"><div><h3>Actividad</h3><p><strong>Fecha:</strong> ${formatDate(r.createdDate)}<br><strong>Medio:</strong> ${esc(r.prospecting||"")}<br><strong>Lugar:</strong> ${esc(r.activityPlace||"")}<br><strong>Contactos:</strong> ${Number(r.contacts||0)}<br><strong>Citas:</strong> ${Number(r.appointmentsGenerated||0)}<br><strong>Cierres:</strong> ${closureCount(r)}</p><p>${esc(r.activityDescription||"")}</p></div><div><h3>Servicio Social</h3><p><strong>Realizado:</strong> ${socialPerformed(r)?"Sí":"No"}<br><strong>Tipo:</strong> ${esc(r.socialService?.type||"—")}<br><strong>Lugar:</strong> ${esc(r.socialService?.place||"—")}<br><strong>Personas:</strong> ${socialPeople(r)}</p><p>${esc(r.socialService?.description||"")}</p><h3>Notas</h3><p>${esc(r.generalNotes||"Sin notas.")}</p></div></div><h3>Clientes</h3><div class="table-wrap"><table><thead><tr><th>Cliente</th><th>NSS</th><th>Teléfono</th><th>Empresa</th><th>Resultado</th><th>Nota</th></tr></thead><tbody>${(r.clients||[]).map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.nss)}</td><td>${esc(c.phone)}</td><td>${esc(c.company)}</td><td>${esc(c.result)}</td><td>${esc(c.notes)}</td></tr>`).join("")}</tbody></table></div>`;
  $("detailModal").classList.add("show");
};
window.reviewReport=async id=>{if(confirm("¿Marcar este reporte como revisado?"))await updateDoc(doc(db,REPORTS_COLLECTION,id),{reviewStatus:"reviewed",reviewedAt:serverTimestamp(),reviewedBy:"manager-143561",updatedAt:serverTimestamp()});};
window.cancelReport=async id=>{const reason=prompt("Motivo de anulación:");if(!reason)return;await updateDoc(doc(db,REPORTS_COLLECTION,id),{status:"cancelled",cancelReason:reason,cancelledAt:serverTimestamp(),updatedAt:serverTimestamp()});};

function reportNotes(report){
  return Array.isArray(report?.managerNotes) ? report.managerNotes : [];
}

function renderReportNotesModal(report){
  const notes = reportNotes(report);
  $("reportNotesList").innerHTML = notes.length
    ? notes.slice().reverse().map(note => `
        <div class="report-note-entry">
          <strong>Nota gerencial</strong>
          <span>${esc(note.text || "")}</span>
          <small>${note.createdAt
            ? new Date(note.createdAt).toLocaleString("es-MX")
            : "Fecha no disponible"}</small>
        </div>
      `).join("")
    : '<div class="empty">Todavía no hay notas gerenciales para este reporte.</div>';

  const advisorNote = $("advisorOriginalNote");
  if(report.generalNotes){
    advisorNote.classList.remove("hidden");
    advisorNote.innerHTML = `<strong>Nota enviada por el asesor:</strong><br>${esc(report.generalNotes)}`;
  }else{
    advisorNote.classList.add("hidden");
    advisorNote.innerHTML = "";
  }
}

window.openReportNotes = id => {
  const report = state.reports.find(item => item.id === id);
  if(!report) return;

  $("reportNoteId").value = id;
  $("reportNoteText").value = "";
  $("reportNotesTitle").textContent = `Notas · ${report.advisorName || "Reporte"}`;
  $("reportNotesMeta").textContent =
    `${formatDate(report.createdDate)} · Empleado ${report.advisorEmployeeNumber || "N/D"}`;

  renderReportNotesModal(report);
  $("reportNotesModal").classList.add("show");
};

window.closeReportNotes = () => {
  $("reportNotesModal").classList.remove("show");
  $("reportNoteForm").reset();
  $("reportNoteId").value = "";
};

$("reportNoteForm").addEventListener("submit", async event => {
  event.preventDefault();

  const reportId = $("reportNoteId").value;
  const noteText = $("reportNoteText").value.trim();

  if(!reportId || !noteText) return;

  await updateDoc(doc(db, REPORTS_COLLECTION, reportId), {
    managerNotes: arrayUnion({
      text: noteText,
      createdAt: new Date().toISOString(),
      createdBy: "manager-143561"
    }),
    updatedAt: serverTimestamp()
  });

  window.closeReportNotes();
});


function calendarReports(){
  return state.reports.filter(r=>{
    if(r.status==="cancelled")return false;
    if(state.calendarAdvisor && r.advisorUid!==state.calendarAdvisor)return false;
    const d=new Date(`${r.createdDate||"1900-01-01"}T12:00:00`);
    return d.getFullYear()===state.calendarDate.getFullYear()&&d.getMonth()===state.calendarDate.getMonth();
  });
}
function renderMiniCalendar(){
  const now=new Date(),first=new Date(now.getFullYear(),now.getMonth(),1),start=new Date(first);start.setDate(1-first.getDay());
  const reports=selectedReports().filter(r=>r.status!=="cancelled"),map=new Map();reports.forEach(r=>map.set(r.createdDate,(map.get(r.createdDate)||0)+1));
  let html=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(d=>`<div class="cal-head">${d}</div>`).join("");
  for(let i=0;i<35;i++){const d=new Date(start);d.setDate(start.getDate()+i);const iso=localISO(d),out=d.getMonth()!==now.getMonth();html+=`<div class="cal-day ${out?"out":""}" onclick="window.openCalendarDate('${iso}')"><div class="day-number">${d.getDate()}</div><div class="day-metrics">${map.get(iso)?`<span class="color-blue">● ${map.get(iso)}</span>`:""}</div></div>`;}
  $("miniCalendar").innerHTML=html;
}
function renderCalendar(){
  const first=new Date(state.calendarDate.getFullYear(),state.calendarDate.getMonth(),1),start=new Date(first);start.setDate(1-first.getDay());
  const rows=calendarReports(),map=new Map();rows.forEach(r=>{if(!map.has(r.createdDate))map.set(r.createdDate,[]);map.get(r.createdDate).push(r);});
  $("calendarMonthLabel").textContent=state.calendarDate.toLocaleDateString("es-MX",{month:"long",year:"numeric"});
  let html=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(d=>`<div class="cal-head">${d}</div>`).join("");
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const iso=localISO(d),list=map.get(iso)||[],t=totals(list),out=d.getMonth()!==state.calendarDate.getMonth();html+=`<div class="cal-day ${out?"out":""} ${state.selectedDate===iso?"selected":""}" data-date="${iso}"><div class="day-number">${d.getDate()}</div><div class="day-metrics">${list.length?`<span class="color-blue">●${t.contacts}</span><span class="color-gold">●${t.appointments}</span><span class="color-green">●${t.closures}</span>${t.social?`<span class="color-pink">●${t.social}</span>`:""}`:""}</div></div>`;}
  $("calendarGrid").innerHTML=html;
  $("calendarGrid").querySelectorAll(".cal-day").forEach(el=>el.addEventListener("click",()=>{state.selectedDate=el.dataset.date;renderCalendar();renderCalendarDay();}));
  renderCalendarDay();drawCalendarBars(rows);drawCalendarAdvisors(rows);
}
function renderCalendarDay(){
  const date=state.selectedDate,rows=calendarReports().filter(r=>r.createdDate===date);$("selectedDateBadge").textContent=date?formatDate(date):"Selecciona un día";
  $("calendarDayDetail").innerHTML=date?(rows.length?rows.map(r=>`<div class="activity-item"><div class="item-icon">▤</div><div class="item-copy"><strong>${esc(r.advisorName)}</strong><span>${Number(r.contacts||0)} contactos · ${Number(r.appointmentsGenerated||0)} citas · ${closureCount(r)} cierres${socialPerformed(r)?" · Servicio social":""}</span></div><button class="soft" onclick="window.openReportDetail('${r.id}')">Ver</button></div>`).join(""):'<div class="empty">No se entregaron actividades este día.</div>'):'<div class="empty">Selecciona un día del calendario.</div>';
}
function drawCalendarBars(rows){drawLineChart($("calendarBarsCanvas"),daySeries(rows,31),[{key:"contacts",color:"#2E8BFF"},{key:"appointments",color:"#FFB71B"},{key:"closures",color:"#20CA88"}]);}
function drawCalendarAdvisors(rows){
  const canvas=$("calendarAdvisorCanvas");if(!canvas)return;const {ctx,width,height}=canvasSetup(canvas),map=new Map();
  rows.forEach(r=>map.set(r.advisorName||"Asesor",(map.get(r.advisorName||"Asesor")||0)+1));
  const data=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10),max=Math.max(1,...data.map(x=>x[1]));
  ctx.font="11px Segoe UI";data.forEach(([name,val],i)=>{const y=20+i*Math.min(27,(height-30)/Math.max(1,data.length)),barW=(width-190)*val/max;ctx.fillStyle="#AFC5E6";ctx.fillText(name.slice(0,22),8,y+8);ctx.fillStyle="#173F77";ctx.fillRect(165,y,Math.max(1,width-185),13);ctx.fillStyle="#2E8BFF";ctx.fillRect(165,y,barW,13);ctx.fillStyle="#fff";ctx.fillText(String(val),170+barW,y+8);});
  if(!data.length){ctx.fillStyle="#AFC5E6";ctx.textAlign="center";ctx.fillText("Sin datos",width/2,height/2);}
}
window.openCalendarDate=iso=>{state.calendarDate=new Date(`${iso}T12:00:00`);state.selectedDate=iso;window.openPanel("calendarPanel");renderCalendar();};

function renderSocial(){
  const rows=state.reports.filter(r=>r.status!=="cancelled"&&socialPerformed(r)),people=rows.reduce((s,r)=>s+socialPeople(r),0),advisors=new Set(rows.map(r=>r.advisorUid)).size;
  $("socialActivities").textContent=rows.length;$("socialPeople").textContent=people;$("socialAdvisors").textContent=advisors;
  const map=new Map();rows.forEach(r=>map.set(r.socialService?.type||"Otro",(map.get(r.socialService?.type||"Otro")||0)+1));const types=[...map.entries()].sort((a,b)=>b[1]-a[1]),max=Math.max(1,...types.map(x=>x[1]));
  $("socialTypeBars").innerHTML=types.length?types.map(([name,val],i)=>`<div class="rank-row"><strong>${i+1}</strong><div><span>${esc(name)}</span><div class="rank-bar"><i style="width:${val/max*100}%"></i></div></div><strong>${val}</strong></div>`).join(""):'<div class="empty">Sin registros.</div>';
  $("socialList").innerHTML=rows.slice(0,12).map(r=>`<div class="social-item"><div class="item-icon" style="background:linear-gradient(145deg,#C52F6B,#F06A9E)">❤</div><div class="item-copy"><strong>${esc(r.advisorName)}</strong><span>${esc(r.socialService?.type||"Servicio social")} · ${socialPeople(r)} personas · ${esc(r.socialService?.place||"")}</span></div><div class="item-time">${formatDate(r.createdDate)}</div></div>`).join("")||'<div class="empty">Sin registros.</div>';
}


function renderStaff(){
  const active=state.advisors.filter(a=>a.active).length;$("staffCount").textContent=`${state.advisors.length} asesores`;$("staffActiveCount").textContent=`${active} activos`;$("staffInactiveCount").textContent=`${state.advisors.length-active} retirados`;
  $("staffBody").innerHTML=state.advisors.map(a=>`<tr><td><strong>${esc(a.employeeNumber)}</strong></td><td>${esc(a.name)}</td><td><span id="nip-${a.id}">${a.pin?"••••":"Sin NIP"}</span>${a.pin?` <button class="soft" onclick="window.toggleNip('${a.id}')">👁</button>`:""}</td><td>${a.active?'<span class="status reviewed">Activo</span>':'<span class="status cancelled">Retirado</span>'}</td><td>${timestampText(a.lastLoginAt)}</td><td><div class="actions"><button class="soft" onclick="window.changeNip('${a.id}')">Cambiar NIP</button>${a.active?`<button class="danger" onclick="window.removeEmployee('${a.id}')">Quitar</button>`:`<button class="success" onclick="window.restoreEmployee('${a.id}')">Reasignar</button>`}</div></td></tr>`).join("");
}
window.toggleNip=id=>{const a=state.advisors.find(x=>x.id===id),el=$(`nip-${id}`);if(!a||!el)return;el.textContent=el.textContent==="••••"?a.pin:"••••";if(el.textContent!== "••••")setTimeout(()=>{if(el)el.textContent="••••";},10000);};
window.changeNip=async id=>{const pin=digits(prompt("Nuevo NIP de 4 dígitos:")||"");if(pin.length!==4){if(pin)alert("El NIP debe tener 4 dígitos.");return;}await updateDoc(doc(db,ADVISORS_COLLECTION,id),{pin,updatedAt:serverTimestamp()});};
window.removeEmployee=async id=>{const a=state.advisors.find(x=>x.id===id);if(a&&confirm(`¿Quitar acceso a ${a.name}?`))await updateDoc(doc(db,ADVISORS_COLLECTION,id),{active:false,status:"inactive",updatedAt:serverTimestamp()});};
window.restoreEmployee=async id=>{await updateDoc(doc(db,ADVISORS_COLLECTION,id),{active:true,status:"active",updatedAt:serverTimestamp()});};
window.openEmployeeModal=()=>{$("employeeForm").reset();$("employeeFormError").textContent="";$("employeeModal").classList.add("show");};
window.closeEmployeeModal=()=>$("employeeModal").classList.remove("show");
$("employeeForm").addEventListener("submit",async e=>{e.preventDefault();const number=digits($("newEmployeeNumber").value),pin=digits($("newEmployeePin").value),name=$("newEmployeeName").value.trim().toUpperCase();if(number.length<4||pin.length!==4||name.length<5){$("employeeFormError").textContent="Completa un número, nombre y NIP válidos.";return;}if(state.advisors.some(a=>a.employeeNumber===number)){$("employeeFormError").textContent="Ese empleado ya existe.";return;}await setDoc(doc(db,ADVISORS_COLLECTION,number),{employeeNumber:number,advisorUid:`employee-${number}`,name,pin,role:"advisor",active:true,status:"active",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});window.closeEmployeeModal();});

window.exportDashboardExcel=()=>{
  const rows=filteredReports().map(r=>({"Fecha":r.createdDate,"Asesor":r.advisorName,"No. empleado":r.advisorEmployeeNumber,"Medio":r.prospecting,"Lugar":r.activityPlace,"Contactos":Number(r.contacts||0),"Citas":Number(r.appointmentsGenerated||0),"Clientes":Number(r.clientCount??(r.clients||[]).length),"Cierres":closureCount(r),"Servicio social":socialPerformed(r)?"Sí":"No","Personas servicio social":socialPeople(r),"Notas":r.generalNotes||"","Revisión":r.reviewStatus||"pending","Estado":r.status||"finalized"}));
  if(typeof XLSX==="undefined"){alert("No fue posible cargar el módulo de Excel.");return;}const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,"Reportes");XLSX.writeFile(wb,`Actividad_Comercial_Dashboard_${localISO()}.xlsx`);
};

function openPanel(id){document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));document.querySelectorAll(".nav button[data-panel]").forEach(b=>b.classList.remove("active"));$(id)?.classList.add("active");document.querySelector(`.nav button[data-panel="${id}"]`)?.classList.add("active");window.scrollTo({top:0,behavior:"smooth"});if(id==="summaryPanel")setTimeout(()=>{renderTrend();renderActivityTypes();},120);if(id==="calendarPanel")setTimeout(renderCalendar,100);}
window.openPanel=openPanel;
document.querySelectorAll(".nav button[data-panel]").forEach(b=>b.addEventListener("click",()=>openPanel(b.dataset.panel)));
$("exportNav").addEventListener("click",()=>window.exportDashboardExcel());
$("logoutButton").addEventListener("click",()=>{sessionStorage.removeItem("manager_dialog_access");window.location.assign("./index.html");});
$("globalAdvisorFilter").addEventListener("change",renderAll);
["dateFrom","dateTo","advisorFilter","statusFilter","searchFilter"].forEach(id=>$(id).addEventListener(id==="searchFilter"?"input":"change",renderReports));
$("prevMonth").addEventListener("click",()=>{state.calendarDate.setMonth(state.calendarDate.getMonth()-1);renderCalendar();});
$("nextMonth").addEventListener("click",()=>{state.calendarDate.setMonth(state.calendarDate.getMonth()+1);renderCalendar();});
$("todayMonth").addEventListener("click",()=>{state.calendarDate=new Date();state.selectedDate=localISO();renderCalendar();});
$("calendarAdvisorFilter").addEventListener("change",e=>{state.calendarAdvisor=e.target.value;renderCalendar();});
window.addEventListener("resize",()=>{if(!$("app").classList.contains("hidden")){renderTrend();renderActivityTypes();if($("calendarPanel").classList.contains("active"))renderCalendar();}});
authorize();
