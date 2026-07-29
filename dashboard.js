import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import {
  firebaseConfig,
  USERS_COLLECTION,
  REPORTS_COLLECTION,
  AUTH_EMAIL_DOMAIN
} from "./firebase-config.js";

const state = { reports: [], users: [], manager: null };
const authScreen = document.getElementById("authScreen");
const appElement = document.getElementById("app");
const loginError = document.getElementById("loginError");
const loginButton = document.getElementById("loginButton");

const digits = value => String(value || "").replace(/\D/g,"");
const employeeEmail = number => `${number}@${AUTH_EMAIL_DOMAIN}`;
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
  report.advisorName, report.advisorEmployeeNumber, report.activityPlace,
  report.prospecting, report.activityDescription,
  ...(report.clients || []).flatMap(c=>[
    c.name,c.nss,c.curp,c.phone,c.company,c.afore,c.notes
  ])
].join(" ").toLowerCase();

if(Object.values(firebaseConfig).some(value => String(value).includes("REEMPLAZAR"))){
  showError("Falta colocar la configuración real de Firebase en firebase-config.js.");
  loginButton.disabled = true;
} else {
  const firebaseApp = initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  let unsubscribeReports = null;
  let unsubscribeUsers = null;

  document.getElementById("loginForm").addEventListener("submit", async event=>{
    event.preventDefault();
    loginError.classList.remove("show");
    loginButton.disabled = true;
    loginButton.textContent = "Validando…";

    try{
      const managerEmail = document.getElementById("employee").value.trim().toLowerCase();
      const password = document.getElementById("password").value;

      if(!managerEmail || !password){
        throw new Error("Completa el usuario gerencial y la contraseña.");
      }

      await signInWithEmailAndPassword(auth, managerEmail, password);
    }catch(error){
      console.error(error);
      showError("Usuario gerencial o contraseña incorrectos.");
      loginButton.disabled = false;
      loginButton.textContent = "Ingresar al dashboard";
    }
  });

  onAuthStateChanged(auth, async user=>{
    if(!user){
      unsubscribeReports?.();
      unsubscribeUsers?.();
      authScreen.classList.remove("hidden");
      appElement.classList.add("hidden");
      loginButton.disabled = false;
      loginButton.textContent = "Ingresar al dashboard";
      return;
    }

    try{
      const profileRef = doc(db, USERS_COLLECTION, user.uid);
      let profileSnap = await getDoc(profileRef);

      if(!profileSnap.exists()){
        const managerEmail = String(user.email || "").toLowerCase();

        if(managerEmail !== "jacquelinne.santos@profuturo.com.mx"){
          throw new Error("Usuario no autorizado.");
        }

        await setDoc(profileRef,{
          employeeNumber:"143561",
          name:"SANTOS GUTIERREZ JACQUELINNE ADRIANA",
          role:"manager",
          active:true,
          mustChangePassword:false,
          authEmail:managerEmail,
          accessMode:"username_password",
          createdAt:serverTimestamp(),
          updatedAt:serverTimestamp()
        });

        profileSnap = await getDoc(profileRef);
      }

      const profile = {uid:user.uid,...profileSnap.data()};
      if(profile.active !== true || profile.role !== "manager"){
        await signOut(auth);
        throw new Error("Este acceso es exclusivo para gerentes.");
      }

      state.manager = profile;
      document.getElementById("managerName").textContent =
        `${profile.name} · Empleado ${profile.employeeNumber}`;
      authScreen.classList.add("hidden");
      appElement.classList.remove("hidden");

      unsubscribeReports = onSnapshot(
        query(collection(db, REPORTS_COLLECTION), orderBy("createdAt","desc")),
        snapshot=>{
          state.reports = snapshot.docs.map(item=>({id:item.id,...item.data()}));
          renderAll();
        },
        error=>console.error("Reportes:",error)
      );

      unsubscribeUsers = onSnapshot(
        collection(db, USERS_COLLECTION),
        snapshot=>{
          state.users = snapshot.docs
            .map(item=>({uid:item.id,...item.data()}))
            .sort((a,b)=>(a.name||"").localeCompare(b.name||""));
          renderAll();
        },
        error=>console.error("Usuarios:",error)
      );
    }catch(error){
      console.error(error);
      showError(error.message || "No fue posible validar el acceso.");
    }
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
    const advisors = state.users.filter(u=>u.role === "advisor" && u.active);

    select.innerHTML = '<option value="">Todos</option>' +
      advisors.map(u=>`<option value="${u.uid}">${esc(u.name)}</option>`).join("");
    select.value = current;
  }

  function renderKPIs(){
    const today = localISO();
    const activeAdvisors = state.users.filter(u=>u.role === "advisor" && u.active);
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

  function renderMissing(){
    const today = localISO();
    const reported = new Set(
      state.reports
        .filter(r=>r.createdDate === today && r.status !== "cancelled")
        .map(r=>r.advisorUid)
    );

    const missing = state.users.filter(
      u=>u.role === "advisor" && u.active && !reported.has(u.uid)
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
    document.getElementById("staffCount").textContent = `${state.users.length} usuario(s)`;
    document.getElementById("staffBody").innerHTML = state.users.map(user=>`
      <tr>
        <td>${esc(user.employeeNumber)}</td>
        <td><strong>${esc(user.name)}</strong></td>
        <td><span class="badge ${user.role === "manager" ? "reviewed" : "pending"}">${user.role === "manager" ? "Gerente" : "Asesor"}</span></td>
        <td><span class="badge ${user.active ? "reviewed" : "cancelled-badge"}">${user.active ? "Activo" : "Inactivo"}</span></td>
        <td>${timestampText(user.lastLoginAt)}</td>
        <td>
          <div class="actions">
            <button class="soft" onclick="window.toggleUser('${user.uid}',${!user.active})">${user.active ? "Desactivar" : "Activar"}</button>
            ${user.uid !== state.manager?.uid
              ? `<button class="soft" onclick="window.toggleRole('${user.uid}','${user.role === "manager" ? "advisor" : "manager"}')">${user.role === "manager" ? "Cambiar a asesor" : "Cambiar a gerente"}</button>`
              : ""}
          </div>
        </td>
      </tr>
    `).join("");
  }

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
      reviewedBy:state.manager.uid,
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
      cancelledBy:state.manager.uid,
      cancelledByName:state.manager.name,
      updatedAt:serverTimestamp()
    });
  };

  window.toggleUser = async function(uid, active){
    const user = state.users.find(u=>u.uid === uid);
    if(!user) return;
    if(!confirm(`${active ? "Activar" : "Desactivar"} a ${user.name}?`)) return;

    await updateDoc(doc(db, USERS_COLLECTION, uid),{
      active,
      updatedAt:serverTimestamp()
    });
  };

  window.toggleRole = async function(uid, role){
    const user = state.users.find(u=>u.uid === uid);
    if(!user) return;
    const roleLabel = role === "manager" ? "Gerente" : "Asesor";
    if(!confirm(`Cambiar a ${user.name} al rol ${roleLabel}?`)) return;

    await updateDoc(doc(db, USERS_COLLECTION, uid),{
      role,
      updatedAt:serverTimestamp()
    });
  };

  window.logoutManager = async function(){
    await signOut(auth);
    window.location.reload();
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

  document.querySelectorAll(".tab").forEach(button=>{
    button.addEventListener("click",()=>{
      document.querySelectorAll(".tab").forEach(item=>item.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(panel=>panel.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.panel).classList.add("active");
    });
  });

  const today = localISO();
  document.getElementById("dateFrom").value = today.slice(0,8) + "01";
  document.getElementById("dateTo").value = today;
}
