import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import {
  firebaseConfig,
  ADVISORS_COLLECTION,
  REPORTS_COLLECTION,
  SETTINGS_COLLECTION
} from "./firebase-config.js";

const INITIAL_ADVISORS = [
  {
    "employeeNumber": "130257",
    "name": "CORREA CERON MARIA DEL CARMEN",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "152642",
    "name": "ALVAREZ SOLIS CLAUDIA IVETT",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "158311",
    "name": "RAMIREZ BLANCO ARACELI GUADALUPE",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "161328",
    "name": "GUERRERO VILLEGAS ELSA GABRIELA",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "162129",
    "name": "MEZA MELO CLAUDIA GUADALUPE",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "164641",
    "name": "MENDOZA SANTIAGO ADRIANA",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "165555",
    "name": "SALAS TORRES RUBI ANAKAREN",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "169527",
    "name": "PATIÑO SILVA FERNANDA MONSERRAT",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "169884",
    "name": "SOTO DOMINGUEZ DAYANI SHERLIN GUADALUPE",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "171033",
    "name": "REYNA ORTIZ ROSA NANCY",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "171155",
    "name": "VEGA LUNA MARIA DE JESUS",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "172247",
    "name": "GARCIA BERLANGA BRENDA BERENICE",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "172852",
    "name": "BLANCO TORRES GILDA YAMILY",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "173151",
    "name": "ANGUIANO BERLANGA FRANCISCO DE JESUS",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "173159",
    "name": "MORALES LEYVA KARLA SAMANTA",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  },
  {
    "employeeNumber": "502488",
    "name": "RAMOS MARTINEZ LAURA GEORGINA",
    "role": "advisor",
    "active": true,
    "accessMode": "employee_number_only"
  }
];

const state = {
  reports: [],
  advisors: [],
  manager: {
    uid:"public-dashboard",
    employeeNumber:"PUBLIC",
    name:"ADMINISTRADOR GENERAL",
    role:"manager",
    active:true
  },
  editingReportId: null,
  editingClientCounter: 0
};

const appElement = document.getElementById("app");

const ADMIN_PASSWORD_HASH =
  "26afffd013603c1547932de323cc757340eeeefac0dd4f085697751b4792afd5";
let dashboardUnlockedUntil = 0;

async function dashboardSha256(value){
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)]
    .map(byte=>byte.toString(16).padStart(2,"0"))
    .join("");
}

async function requireDashboardPassword(action="realizar este cambio"){
  if(Date.now() < dashboardUnlockedUntil) return true;

  const password = prompt(
    `Ingresa la contraseña para ${action}:`
  );

  if(password === null) return false;

  if(await dashboardSha256(password) !== ADMIN_PASSWORD_HASH){
    alert("Contraseña incorrecta.");
    return false;
  }

  dashboardUnlockedUntil = Date.now() + (10 * 60 * 1000);
  return true;
}

const localISO = () => {
  const d = new Date(), offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0,10);
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

const normalizeEmployee = value => String(value || "").replace(/\D/g,"");

const setBox = (id, message="", kind="error") => {
  const box = document.getElementById(id);
  if(!box) return;
  box.textContent = message;
  box.classList.remove("show");
  if(message){
    box.className = `${kind} show`;
  }
};

const reviewLabel = report => {
  if(report.status === "cancelled") return '<span class="badge cancelled-badge">Anulado</span>';
  if(report.reviewStatus === "reviewed") return '<span class="badge reviewed">Revisado</span>';
  return '<span class="badge pending">Pendiente</span>';
};

const reportSearchText = report => [
  report.advisorName, report.advisorEmployeeNumber, report.activityPlace,
  report.prospecting, report.activityDescription,
  ...(report.clients || []).flatMap(c=>[
    c.name,c.nss,c.curp,c.phone,c.company,c.afore,c.notes
  ])
].join(" ").toLowerCase();

function advisorUid(employeeNumber){
  return `employee-${employeeNumber}`;
}

function advisorsForFilter(){
  const map = new Map();

  state.advisors.forEach(advisor=>{
    map.set(advisor.employeeNumber,{
      employeeNumber:advisor.employeeNumber,
      name:advisor.name,
      uid:advisorUid(advisor.employeeNumber),
      active:advisor.active === true
    });
  });

  state.reports.forEach(report=>{
    const number = String(report.advisorEmployeeNumber || "");
    if(number && !map.has(number)){
      map.set(number,{
        employeeNumber:number,
        name:report.advisorName || number,
        uid:advisorUid(number),
        active:false
      });
    }
  });

  return [...map.values()].sort((a,b)=>(a.name || "").localeCompare(b.name || ""));
}

if(Object.values(firebaseConfig).some(value =>
  String(value).includes("REEMPLAZAR")
)){
  appElement.classList.remove("hidden");
  document.getElementById("managerName").textContent =
    "Falta configurar Firebase en firebase-config.js";
  alert("Falta colocar la configuración real de Firebase.");
} else {
  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp);
  let unsubscribeReports = null;
  let unsubscribeAdvisors = null;

  async function seedInitialAdvisors(){
    const markerRef = doc(db, SETTINGS_COLLECTION, "advisor_seed_v1");
    const marker = await getDoc(markerRef);

    if(marker.exists()) return;

    const batch = writeBatch(db);

    INITIAL_ADVISORS.forEach(advisor=>{
      const ref = doc(db, ADVISORS_COLLECTION, advisor.employeeNumber);
      batch.set(ref,{
        ...advisor,
        accessMode:"public_selector",
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      },{merge:true});
    });

    batch.set(markerRef,{
      completed:true,
      advisorCount:INITIAL_ADVISORS.length,
      completedAt:serverTimestamp(),
      completedBy:state.manager.uid
    });

    await batch.commit();
  }

  async function startPublicDashboard(){
    appElement.classList.remove("hidden");
    document.getElementById("managerName").textContent =
      "Acceso directo · Administración en tiempo real";

    await seedInitialAdvisors();

    unsubscribeAdvisors = onSnapshot(
      collection(db, ADVISORS_COLLECTION),
      snapshot=>{
        state.advisors = snapshot.docs
          .map(item=>({id:item.id,employeeNumber:item.id,...item.data()}))
          .sort((a,b)=>(a.name || "").localeCompare(b.name || ""));
        renderAll();
      },
      error=>console.error("Asesores:",error)
    );

    unsubscribeReports = onSnapshot(
      query(collection(db, REPORTS_COLLECTION),orderBy("createdAt","desc")),
      snapshot=>{
        state.reports = snapshot.docs.map(
          item=>({id:item.id,...item.data()})
        );
        renderAll();
      },
      error=>console.error("Reportes:",error)
    );
  }

  startPublicDashboard().catch(error=>{
    console.error(error);
    document.getElementById("managerName").textContent =
      "No fue posible conectar con Firebase";
    alert(error?.message || "No fue posible abrir el dashboard.");
  });

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
    renderMissing();
    renderReports();
    renderStaff();
  }

  function renderAdvisorFilter(){
    const select = document.getElementById("advisorFilter");
    const current = select.value;
    const advisors = advisorsForFilter();

    select.innerHTML = '<option value="">Todos</option>' +
      advisors.map(advisor=>
        `<option value="${esc(advisor.uid)}">${esc(advisor.name)} · ${esc(advisor.employeeNumber)}</option>`
      ).join("");

    if([...select.options].some(option=>option.value === current)){
      select.value = current;
    }
  }

  function renderKPIs(){
    const today = localISO();
    const activeAdvisors = state.advisors.filter(advisor=>advisor.active === true);
    const todayReports = state.reports.filter(
      report=>report.createdDate === today && report.status !== "cancelled"
    );
    const reported = new Set(todayReports.map(report=>report.advisorUid));
    const visible = filteredReports().filter(report=>report.status !== "cancelled");

    document.getElementById("kpiReports").textContent = visible.length;
    document.getElementById("kpiActive").textContent = activeAdvisors.length;
    document.getElementById("kpiReported").textContent = reported.size;
    document.getElementById("kpiContacts").textContent =
      visible.reduce((sum,report)=>sum + Number(report.contacts || 0),0);
    document.getElementById("kpiAppointments").textContent =
      visible.reduce((sum,report)=>sum + Number(report.appointmentsGenerated || 0),0);
    document.getElementById("kpiProcedures").textContent =
      visible.reduce((sum,report)=>sum + Number(report.procedureCount || 0),0);
  }

  function renderMissing(){
    const today = localISO();
    const reported = new Set(
      state.reports
        .filter(report=>report.createdDate === today && report.status !== "cancelled")
        .map(report=>report.advisorUid)
    );

    const missing = state.advisors.filter(
      advisor=>advisor.active === true && !reported.has(advisorUid(advisor.employeeNumber))
    );

    document.getElementById("missingCount").textContent = missing.length;
    document.getElementById("missingAdvisors").innerHTML =
      missing.length
        ? missing.map(advisor=>
            `<span>${esc(advisor.employeeNumber)} · ${esc(advisor.name)}</span>`
          ).join("")
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
            <button class="warning" onclick="window.openEditReport('${report.id}')">Editar</button>
            ${report.status !== "cancelled" && report.reviewStatus !== "reviewed"
              ? `<button class="accent" onclick="window.markReviewed('${report.id}')">Revisar</button>` : ""}
            ${report.status !== "cancelled"
              ? `<button class="danger" onclick="window.cancelReport('${report.id}')">Anular</button>` : ""}
            <button class="danger" onclick="window.deleteReport('${report.id}')">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function renderStaff(){
    document.getElementById("staffCount").textContent =
      `${state.advisors.length} asesor(es)`;

    const body = document.getElementById("staffBody");

    if(!state.advisors.length){
      body.innerHTML = '<tr><td colspan="5" class="empty">No hay asesores registrados.</td></tr>';
      return;
    }

    body.innerHTML = state.advisors.map(advisor=>`
      <tr>
        <td>${esc(advisor.employeeNumber)}</td>
        <td><strong>${esc(advisor.name)}</strong></td>
        <td><span class="badge ${advisor.active ? "reviewed" : "cancelled-badge"}">${advisor.active ? "Activo" : "Inactivo"}</span></td>
        <td>Número de empleado</td>
        <td>
          <div class="actions">
            <button class="warning" onclick="window.openEditAdvisor('${advisor.employeeNumber}')">Editar</button>
            <button class="soft" onclick="window.toggleAdvisor('${advisor.employeeNumber}',${!advisor.active})">${advisor.active ? "Desactivar" : "Activar"}</button>
            <button class="danger" onclick="window.deleteAdvisor('${advisor.employeeNumber}')">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  window.closeModal = function(id){
    document.getElementById(id)?.classList.remove("show");
  };

  window.openReportDetail = function(id){
    const report = state.reports.find(item=>item.id === id);
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
          <tbody>${clients.map(client=>`
            <tr>
              <td>${esc(client.name)}</td>
              <td>${esc(client.nss)}<br>${esc(client.curp)}</td>
              <td>${esc(client.phone)}</td>
              <td>${esc(client.company)}</td>
              <td>${Number(client.points || 0)}</td>
              <td>${esc(client.afore)}</td>
              <td>${esc(client.result)}</td>
              <td>${esc(client.notes)}${client.appointment ? `<br><strong>Cita:</strong> ${formatDate(client.appointment)}`:""}</td>
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

  window.openAddAdvisor = async function(){
    if(!await requireDashboardPassword("agregar un empleado")) return;
    document.getElementById("advisorForm").reset();
    document.getElementById("advisorOriginalNumber").value = "";
    document.getElementById("advisorActive").checked = true;
    document.getElementById("advisorModalTitle").textContent = "Agregar asesor";
    setBox("advisorError");
    setBox("advisorSuccess");
    document.getElementById("advisorModal").classList.add("show");
  };

  window.openEditAdvisor = async function(employeeNumber){
    if(!await requireDashboardPassword("editar un empleado")) return;
    const advisor = state.advisors.find(item=>item.employeeNumber === employeeNumber);
    if(!advisor) return;

    document.getElementById("advisorOriginalNumber").value = advisor.employeeNumber;
    document.getElementById("advisorEmployeeNumber").value = advisor.employeeNumber;
    document.getElementById("advisorName").value = advisor.name || "";
    document.getElementById("advisorActive").checked = advisor.active === true;
    document.getElementById("advisorModalTitle").textContent = "Editar asesor";
    setBox("advisorError");
    setBox("advisorSuccess");
    document.getElementById("advisorModal").classList.add("show");
  };

  document.getElementById("advisorForm").addEventListener("submit", async event=>{
    event.preventDefault();
    if(!await requireDashboardPassword("guardar los cambios del empleado")) return;
    setBox("advisorError");
    setBox("advisorSuccess");

    const originalNumber = normalizeEmployee(
      document.getElementById("advisorOriginalNumber").value
    );
    const employeeNumber = normalizeEmployee(
      document.getElementById("advisorEmployeeNumber").value
    );
    const name = document.getElementById("advisorName").value.trim().toUpperCase();
    const active = document.getElementById("advisorActive").checked;
    const saveButton = document.getElementById("advisorSaveButton");

    if(!employeeNumber || employeeNumber.length < 3){
      setBox("advisorError","Ingresa un número de empleado válido.");
      return;
    }

    if(!name){
      setBox("advisorError","Ingresa el nombre completo.");
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Guardando…";

    try{
      const targetRef = doc(db, ADVISORS_COLLECTION, employeeNumber);
      const existingTarget = await getDoc(targetRef);

      if(existingTarget.exists() && employeeNumber !== originalNumber){
        throw new Error("Ese número de empleado ya está registrado.");
      }

      const data = {
        employeeNumber,
        name,
        role:"advisor",
        active,
        accessMode:"employee_number_only",
        updatedAt:serverTimestamp(),
        updatedBy:state.manager.uid,
        updatedByName:state.manager.name
      };

      if(!originalNumber){
        await setDoc(targetRef,{
          ...data,
          createdAt:serverTimestamp(),
          createdBy:state.manager.uid,
          createdByName:state.manager.name
        });
      }else if(originalNumber === employeeNumber){
        await setDoc(targetRef,data,{merge:true});
      }else{
        const batch = writeBatch(db);
        batch.set(targetRef,{
          ...data,
          createdAt:serverTimestamp(),
          createdBy:state.manager.uid,
          createdByName:state.manager.name
        });
        batch.delete(doc(db, ADVISORS_COLLECTION, originalNumber));
        await batch.commit();

        const relatedReports = state.reports.filter(
          report=>String(report.advisorEmployeeNumber) === originalNumber
        );

        for(const report of relatedReports){
          await updateDoc(doc(db, REPORTS_COLLECTION, report.id),{
            advisorUid:advisorUid(employeeNumber),
            advisorEmployeeNumber:employeeNumber,
            advisorName:name,
            updatedAt:serverTimestamp(),
            editedBy:state.manager.uid,
            editedByName:state.manager.name
          });
        }
      }

      setBox("advisorSuccess","Asesor guardado correctamente.","success");
      setTimeout(()=>window.closeModal("advisorModal"),700);
    }catch(error){
      console.error(error);
      setBox("advisorError",error?.message || "No fue posible guardar el asesor.");
    }finally{
      saveButton.disabled = false;
      saveButton.textContent = "Guardar asesor";
    }
  });

  window.toggleAdvisor = async function(employeeNumber, active){
    if(!await requireDashboardPassword("cambiar el estado de un empleado")) return;
    const advisor = state.advisors.find(item=>item.employeeNumber === employeeNumber);
    if(!advisor) return;

    const action = active ? "activar" : "desactivar";
    if(!confirm(`¿Deseas ${action} a ${advisor.name}?`)) return;

    await updateDoc(doc(db, ADVISORS_COLLECTION, employeeNumber),{
      active,
      updatedAt:serverTimestamp(),
      updatedBy:state.manager.uid,
      updatedByName:state.manager.name
    });
  };

  window.deleteAdvisor = async function(employeeNumber){
    if(!await requireDashboardPassword("eliminar un empleado")) return;
    const advisor = state.advisors.find(item=>item.employeeNumber === employeeNumber);
    if(!advisor) return;

    if(!confirm(
      `¿Eliminar definitivamente a ${advisor.name}?\n\nSus reportes históricos no se eliminarán.`
    )) return;

    await deleteDoc(doc(db, ADVISORS_COLLECTION, employeeNumber));
  };

  function populateEditAdvisorSelect(report){
    const select = document.getElementById("editReportAdvisor");
    const options = [...state.advisors];

    if(report && !options.some(
      advisor=>advisor.employeeNumber === String(report.advisorEmployeeNumber)
    )){
      options.push({
        employeeNumber:String(report.advisorEmployeeNumber || ""),
        name:report.advisorName || "Asesor histórico",
        active:false
      });
    }

    select.innerHTML = options
      .sort((a,b)=>(a.name || "").localeCompare(b.name || ""))
      .map(advisor=>
        `<option value="${esc(advisor.employeeNumber)}">${esc(advisor.name)} · ${esc(advisor.employeeNumber)}${advisor.active ? "" : " (inactivo)"}</option>`
      ).join("");
  }

  function clientEditorTemplate(client={}, index){
    return `
      <div class="client-editor" data-client-index="${index}">
        <div class="client-editor-head">
          <strong>Cliente</strong>
          <button class="danger" type="button" onclick="window.removeReportClient(${index})">Eliminar cliente</button>
        </div>
        <div class="form-grid">
          <div><label>Nombre</label><input data-field="name" value="${esc(client.name || "")}"></div>
          <div><label>NSS</label><input data-field="nss" value="${esc(client.nss || "")}"></div>
          <div><label>CURP</label><input data-field="curp" value="${esc(client.curp || "")}"></div>
          <div><label>Teléfono</label><input data-field="phone" value="${esc(client.phone || "")}"></div>
          <div><label>Correo o dirección</label><input data-field="email" value="${esc(client.email || "")}"></div>
          <div><label>Empresa</label><input data-field="company" value="${esc(client.company || "")}"></div>
          <div><label>Puntos</label><input data-field="points" type="number" min="0" value="${Number(client.points || 0)}"></div>
          <div><label>AFORE</label><input data-field="afore" value="${esc(client.afore || "")}"></div>
          <div><label>Resultado</label><input data-field="result" value="${esc(client.result || "")}"></div>
          <div><label>Fecha posible de cita</label><input data-field="appointment" type="date" value="${esc(client.appointment || "")}"></div>
          <div class="full"><label>Observación</label><textarea data-field="notes">${esc(client.notes || "")}</textarea></div>
        </div>
      </div>
    `;
  }

  window.addReportClient = function(client={}){
    state.editingClientCounter += 1;
    const container = document.getElementById("editClientsContainer");
    container.insertAdjacentHTML(
      "beforeend",
      clientEditorTemplate(client,state.editingClientCounter)
    );
  };

  window.removeReportClient = function(index){
    document.querySelector(
      `.client-editor[data-client-index="${index}"]`
    )?.remove();
  };

  function collectEditedClients(){
    return [...document.querySelectorAll("#editClientsContainer .client-editor")]
      .map((card,index)=>{
        const value = field =>
          card.querySelector(`[data-field="${field}"]`)?.value.trim() || "";

        return {
          number:index + 1,
          name:value("name"),
          nss:value("nss"),
          curp:value("curp"),
          phone:value("phone"),
          email:value("email"),
          company:value("company"),
          points:Number(value("points") || 0),
          afore:value("afore"),
          result:value("result"),
          appointment:value("appointment"),
          notes:value("notes")
        };
      });
  }

  window.openEditReport = async function(id){
    if(!await requireDashboardPassword("editar un reporte")) return;
    const report = state.reports.find(item=>item.id === id);
    if(!report) return;

    state.editingReportId = id;
    state.editingClientCounter = 0;

    document.getElementById("editReportOriginalId").value = id;
    document.getElementById("editReportDate").value = report.createdDate || localISO();
    populateEditAdvisorSelect(report);
    document.getElementById("editReportAdvisor").value =
      String(report.advisorEmployeeNumber || "");
    document.getElementById("editReportProspecting").value = report.prospecting || "";
    document.getElementById("editReportPlace").value = report.activityPlace || "";
    document.getElementById("editReportSchedule").value = report.activitySchedule || "";
    document.getElementById("editReportContacts").value = Number(report.contacts || 0);
    document.getElementById("editReportAppointments").value =
      Number(report.appointmentsGenerated || 0);
    document.getElementById("editReportStatus").value =
      report.status === "cancelled" ? "cancelled" : "finalized";
    document.getElementById("editReportReview").value =
      report.reviewStatus === "reviewed" ? "reviewed" : "pending";
    document.getElementById("editReportDescription").value =
      report.activityDescription || "";
    document.getElementById("editCancellationReason").value =
      report.cancellationReason || "";
    document.getElementById("editPlanDate").value = report.plan?.date || "";
    document.getElementById("editPlanPlace").value = report.plan?.place || "";
    document.getElementById("editPlanMethod").value = report.plan?.method || "";
    document.getElementById("editPlanSchedule").value = report.plan?.schedule || "";
    document.getElementById("editPlanContactGoal").value =
      Number(report.plan?.contactGoal || 0);
    document.getElementById("editPlanAppointmentGoal").value =
      Number(report.plan?.appointmentGoal || 0);
    document.getElementById("editPlanDescription").value =
      report.plan?.description || "";

    const container = document.getElementById("editClientsContainer");
    container.innerHTML = "";

    (report.clients || []).forEach(client=>window.addReportClient(client));

    setBox("reportEditError");
    setBox("reportEditSuccess");
    document.getElementById("reportEditModal").classList.add("show");
  };

  document.getElementById("reportEditForm").addEventListener("submit", async event=>{
    event.preventDefault();
    if(!await requireDashboardPassword("guardar los cambios del reporte")) return;
    setBox("reportEditError");
    setBox("reportEditSuccess");

    const originalId = document.getElementById("editReportOriginalId").value;
    const original = state.reports.find(item=>item.id === originalId);

    if(!original){
      setBox("reportEditError","El reporte ya no está disponible.");
      return;
    }

    const employeeNumber = normalizeEmployee(
      document.getElementById("editReportAdvisor").value
    );
    const advisor = state.advisors.find(
      item=>item.employeeNumber === employeeNumber
    ) || {
      employeeNumber,
      name:original.advisorName
    };
    const createdDate = document.getElementById("editReportDate").value;
    const clients = collectEditedClients();
    const targetId = `${employeeNumber}_${createdDate}`;
    const saveButton = document.getElementById("reportEditSaveButton");

    if(!employeeNumber || !createdDate){
      setBox("reportEditError","Selecciona asesor y fecha.");
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Guardando…";

    try{
      if(targetId !== originalId){
        const targetSnapshot = await getDoc(
          doc(db, REPORTS_COLLECTION, targetId)
        );

        if(targetSnapshot.exists()){
          throw new Error(
            "Ya existe un reporte para ese asesor en la fecha seleccionada."
          );
        }
      }

      const reviewStatus = document.getElementById("editReportReview").value;
      const status = document.getElementById("editReportStatus").value;
      const procedureCount = clients.filter(
        client=>client.result === "Trámite realizado"
      ).length;

      const changes = {
        advisorUid:advisorUid(employeeNumber),
        advisorName:advisor.name || original.advisorName,
        advisorEmployeeNumber:employeeNumber,
        advisorRole:"advisor",
        createdDate,
        prospecting:document.getElementById("editReportProspecting").value.trim(),
        activityPlace:document.getElementById("editReportPlace").value.trim(),
        activitySchedule:document.getElementById("editReportSchedule").value.trim(),
        contacts:Number(document.getElementById("editReportContacts").value || 0),
        appointmentsGenerated:Number(
          document.getElementById("editReportAppointments").value || 0
        ),
        activityDescription:
          document.getElementById("editReportDescription").value.trim(),
        clients,
        clientCount:clients.length,
        procedureCount,
        plan:{
          date:document.getElementById("editPlanDate").value,
          place:document.getElementById("editPlanPlace").value.trim(),
          method:document.getElementById("editPlanMethod").value.trim(),
          schedule:document.getElementById("editPlanSchedule").value.trim(),
          contactGoal:Number(
            document.getElementById("editPlanContactGoal").value || 0
          ),
          appointmentGoal:Number(
            document.getElementById("editPlanAppointmentGoal").value || 0
          ),
          description:
            document.getElementById("editPlanDescription").value.trim()
        },
        status,
        reviewStatus,
        cancellationReason:
          status === "cancelled"
            ? document.getElementById("editCancellationReason").value.trim()
            : "",
        reviewedAt:
          reviewStatus === "reviewed"
            ? (original.reviewedAt || serverTimestamp())
            : null,
        reviewedBy:
          reviewStatus === "reviewed"
            ? state.manager.uid
            : null,
        reviewedByName:
          reviewStatus === "reviewed"
            ? state.manager.name
            : null,
        updatedAt:serverTimestamp(),
        editedAt:serverTimestamp(),
        editedBy:state.manager.uid,
        editedByName:state.manager.name
      };

      if(targetId === originalId){
        await updateDoc(doc(db, REPORTS_COLLECTION, originalId),changes);
      }else{
        const batch = writeBatch(db);
        batch.set(
          doc(db, REPORTS_COLLECTION, targetId),
          {
            ...original,
            ...changes
          }
        );
        batch.delete(doc(db, REPORTS_COLLECTION, originalId));
        await batch.commit();
      }

      setBox("reportEditSuccess","Reporte actualizado correctamente.","success");
      setTimeout(()=>window.closeModal("reportEditModal"),700);
    }catch(error){
      console.error(error);
      setBox(
        "reportEditError",
        error?.message || "No fue posible actualizar el reporte."
      );
    }finally{
      saveButton.disabled = false;
      saveButton.textContent = "Guardar cambios";
    }
  });

  window.markReviewed = async function(id){
    if(!await requireDashboardPassword("marcar un reporte como revisado")) return;
    if(!confirm("¿Marcar este reporte como revisado?")) return;

    await updateDoc(doc(db, REPORTS_COLLECTION, id),{
      reviewStatus:"reviewed",
      reviewedAt:serverTimestamp(),
      reviewedBy:state.manager.uid,
      reviewedByName:state.manager.name,
      updatedAt:serverTimestamp()
    });
  };

  window.cancelReport = async function(id){
    if(!await requireDashboardPassword("anular un reporte")) return;
    const reason = prompt("Escribe el motivo de la anulación:");
    if(!reason?.trim()) return;

    await updateDoc(doc(db, REPORTS_COLLECTION, id),{
      status:"cancelled",
      cancellationReason:reason.trim(),
      cancelledAt:serverTimestamp(),
      cancelledBy:state.manager.uid,
      cancelledByName:state.manager.name,
      updatedAt:serverTimestamp()
    });
  };

  window.deleteReport = async function(id){
    if(!await requireDashboardPassword("eliminar un reporte")) return;
    const report = state.reports.find(item=>item.id === id);
    if(!report) return;

    if(!confirm(
      `¿Eliminar definitivamente el reporte de ${report.advisorName} del ${formatDate(report.createdDate)}?\n\nEsta acción no se puede deshacer.`
    )) return;

    await deleteDoc(doc(db, REPORTS_COLLECTION, id));
  };
  window.exportDashboardExcel = function(){
    const reports = filteredReports();

    const reportRows = reports.map(report=>({
      "Fecha":report.createdDate,
      "Fecha y hora local":report.createdAtLocal,
      "Número de empleado":report.advisorEmployeeNumber,
      "Asesor":report.advisorName,
      "Medio de prospección":report.prospecting,
      "Lugar":report.activityPlace,
      "Horario":report.activitySchedule,
      "Contactos":Number(report.contacts || 0),
      "Citas generadas":Number(report.appointmentsGenerated || 0),
      "Clientes":Number(report.clientCount || (report.clients || []).length),
      "Trámites realizados":Number(report.procedureCount || 0),
      "Descripción":report.activityDescription,
      "Estado":report.status === "cancelled" ? "Anulado" : "Finalizado",
      "Revisión":report.reviewStatus === "reviewed" ? "Revisado" : "Pendiente",
      "Plan - fecha":report.plan?.date,
      "Plan - lugar":report.plan?.place,
      "Plan - medio":report.plan?.method,
      "Plan - horario":report.plan?.schedule,
      "Plan - meta contactos":Number(report.plan?.contactGoal || 0),
      "Plan - meta citas":Number(report.plan?.appointmentGoal || 0),
      "Plan - descripción":report.plan?.description,
      "Motivo de anulación":report.cancellationReason || ""
    }));

    const clientRows = reports.flatMap(report=>
      (report.clients || []).map(client=>({
        "Fecha":report.createdDate,
        "Número de empleado":report.advisorEmployeeNumber,
        "Asesor":report.advisorName,
        "Cliente":client.name,
        "CURP":client.curp,
        "NSS":client.nss,
        "Teléfono":client.phone,
        "Correo o dirección":client.email,
        "Empresa":client.company,
        "Puntos":Number(client.points || 0),
        "AFORE":client.afore,
        "Resultado":client.result,
        "Fecha posible de cita":client.appointment,
        "Observación":client.notes,
        "Estado del reporte":
          report.status === "cancelled" ? "Anulado" : "Finalizado"
      }))
    );

    const advisorRows = state.advisors.map(advisor=>({
      "Número de empleado":advisor.employeeNumber,
      "Nombre":advisor.name,
      "Estado":advisor.active ? "Activo" : "Inactivo",
      "Modalidad":"Selección directa",
      "Última actualización":timestampText(advisor.updatedAt)
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(reportRows),
      "Reportes"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(clientRows),
      "Clientes"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(advisorRows),
      "Asesores"
    );

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

  window.openEmployeeAdministration = async function(){
    if(!await requireDashboardPassword("administrar empleados")) return;

    document.querySelectorAll(".tab").forEach(
      item=>item.classList.remove("active")
    );
    document.querySelectorAll(".panel").forEach(
      panel=>panel.classList.remove("active")
    );

    const staffTab = document.querySelector(
      '.tab[data-panel="staffPanel"]'
    );
    staffTab?.classList.add("active");
    document.getElementById("staffPanel")?.classList.add("active");
    window.scrollTo({top:0,behavior:"smooth"});
  };

  document.querySelectorAll(".tab").forEach(button=>{
    button.addEventListener("click",async ()=>{
      if(
        button.dataset.panel === "staffPanel"
        && !await requireDashboardPassword("administrar empleados")
      ){
        return;
      }

      document.querySelectorAll(".tab").forEach(
        item=>item.classList.remove("active")
      );
      document.querySelectorAll(".panel").forEach(
        panel=>panel.classList.remove("active")
      );
      button.classList.add("active");
      document.getElementById(button.dataset.panel).classList.add("active");
    });
  });

  const today = localISO();
  document.getElementById("dateFrom").value = today.slice(0,8) + "01";
  document.getElementById("dateTo").value = today;
}
