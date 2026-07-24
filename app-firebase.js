import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import {
  firebaseConfig,
  ADVISORS_COLLECTION,
  REPORTS_COLLECTION
} from "./firebase-config.js";

const advisorSelector = document.getElementById("advisorSelector");
const appRoot = document.getElementById("appRoot");
let advisors = [];
let allAdvisors = [];
let employeeManagerUnlockedUntil = 0;

const ADMIN_PASSWORD_HASH =
  "26afffd013603c1547932de323cc757340eeeefac0dd4f085697751b4792afd5";

async function sha256(value){
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)]
    .map(byte=>byte.toString(16).padStart(2,"0"))
    .join("");
}

async function requireEmployeeAdminPassword(){
  if(Date.now() < employeeManagerUnlockedUntil) return true;

  const password = prompt(
    "Ingresa la contraseña para administrar empleados:"
  );

  if(password === null) return false;

  if(await sha256(password) !== ADMIN_PASSWORD_HASH){
    alert("Contraseña incorrecta.");
    return false;
  }

  employeeManagerUnlockedUntil = Date.now() + (10 * 60 * 1000);
  return true;
}

const normalizeEmployeeNumber = value =>
  String(value || "").replace(/\D/g,"");

function setEmployeeManagerMessage(message="",type="error"){
  const box = document.getElementById("employeeManagerMessage");
  if(!box) return;
  box.textContent = message;
  box.className = `employee-admin-message ${type}`;
  if(message) box.classList.add("show");
}

function currentLocalDate(){
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0,10);
}

function reportDocumentId(employeeNumber, date){
  const timestamp = Date.now();
  const randomPart = (
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0,8)
      : Math.random().toString(36).slice(2,10)
  );

  return `${employeeNumber}_${date}_${timestamp}_${randomPart}`;
}

function showConfigurationError(message){
  const status = document.getElementById("status1");
  if(status){
    status.textContent = message;
    status.className = "status error show";
  } else {
    alert(message);
  }
}

function activateAdvisor(employeeNumber){
  const profile = advisors.find(
    advisor => advisor.employeeNumber === employeeNumber
  );

  if(!profile){
    window.currentUserProfile = null;
    document.getElementById("advisorName").value = "";
    document.getElementById("employeeNumber").value = "";
    document.getElementById("sessionName").textContent =
      "Selecciona un asesor";
    document.getElementById("sessionMeta").textContent =
      "Captura directa sin inicio de sesión";
    return;
  }

  window.prepareAdvisorSession({
    uid:`employee-${profile.employeeNumber}`,
    employeeNumber:profile.employeeNumber,
    name:profile.name,
    role:"advisor",
    active:true,
    accessMode:"public_selector"
  });
}

const hasPlaceholder = Object.values(firebaseConfig).some(value =>
  String(value).includes("REEMPLAZAR")
);

appRoot.classList.remove("hidden");

if(hasPlaceholder){
  showConfigurationError(
    "Falta colocar la configuración real de Firebase en firebase-config.js."
  );
} else {
  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp);

  onSnapshot(
    collection(db, ADVISORS_COLLECTION),
    snapshot=>{
      const selected = advisorSelector.value;

      allAdvisors = snapshot.docs
        .map(item=>({
          employeeNumber:item.id,
          ...item.data()
        }))
        .sort((a,b)=>(a.name || "").localeCompare(b.name || ""));

      advisors = allAdvisors.filter(
        advisor=>advisor.active === true
      );

      renderEmployeeManager();

      advisorSelector.innerHTML =
        '<option value="">Selecciona un número de empleado</option>' +
        advisors.map(advisor=>
          `<option value="${advisor.employeeNumber}">${advisor.employeeNumber}</option>`
        ).join("");

      if(advisors.some(item=>item.employeeNumber === selected)){
        advisorSelector.value = selected;
        activateAdvisor(selected);
      } else {
        activateAdvisor("");
      }
    },
    error=>{
      console.error(error);
      showConfigurationError(
        "No fue posible cargar la lista de asesores desde Firebase."
      );
    }
  );

  advisorSelector.addEventListener("change",()=>{
    activateAdvisor(advisorSelector.value);
  });

  window.logoutCommercialUser = function(){
    advisorSelector.value = "";
    activateAdvisor("");
    window.resetCommercialFormForSession();
  };


  function renderEmployeeManager(){
    const container = document.getElementById("employeeManagerList");
    if(!container) return;

    if(!allAdvisors.length){
      container.innerHTML =
        '<div class="employee-admin-note">No hay empleados registrados.</div>';
      return;
    }

    container.innerHTML = allAdvisors.map(employee=>`
      <div class="employee-admin-row">
        <strong>${employee.employeeNumber}</strong>
        <div>
          <b>${String(employee.name || "").replaceAll("<","&lt;")}</b><br>
          <span class="employee-admin-note">
            ${employee.active === true ? "Activo" : "Inactivo"}
          </span>
        </div>
        <div class="employee-admin-actions">
          <button class="btn-soft" type="button"
            onclick="window.editManagedEmployee('${employee.employeeNumber}')">
            Editar
          </button>
          <button class="btn-soft" type="button"
            onclick="window.toggleManagedEmployee(
              '${employee.employeeNumber}',${employee.active !== true}
            )">
            ${employee.active === true ? "Desactivar" : "Activar"}
          </button>
          <button class="btn-danger" type="button"
            onclick="window.deleteManagedEmployee(
              '${employee.employeeNumber}'
            )">
            Eliminar
          </button>
        </div>
      </div>
    `).join("");
  }

  function resetEmployeeManagerForm(){
    document.getElementById("employeeManagerForm").reset();
    document.getElementById("employeeManagerOriginalNumber").value = "";
    document.getElementById("employeeManagerActive").checked = true;
    document.getElementById("employeeManagerSaveButton").textContent =
      "Guardar empleado";
  }

  window.openEmployeeManager = async function(){
    if(!await requireEmployeeAdminPassword()) return;
    resetEmployeeManagerForm();
    setEmployeeManagerMessage();
    renderEmployeeManager();
    document.getElementById("employeeManagerModal").classList.add("show");
  };

  window.closeEmployeeManager = function(){
    document.getElementById("employeeManagerModal").classList.remove("show");
    resetEmployeeManagerForm();
    setEmployeeManagerMessage();
  };

  window.editManagedEmployee = async function(employeeNumber){
    if(!await requireEmployeeAdminPassword()) return;

    const employee = allAdvisors.find(
      item=>item.employeeNumber === employeeNumber
    );
    if(!employee) return;

    document.getElementById("employeeManagerOriginalNumber").value =
      employee.employeeNumber;
    document.getElementById("employeeManagerNumber").value =
      employee.employeeNumber;
    document.getElementById("employeeManagerName").value =
      employee.name || "";
    document.getElementById("employeeManagerActive").checked =
      employee.active === true;
    document.getElementById("employeeManagerSaveButton").textContent =
      "Actualizar empleado";
    setEmployeeManagerMessage();
  };

  document.getElementById("employeeManagerForm")
    .addEventListener("submit",async event=>{
      event.preventDefault();

      if(!await requireEmployeeAdminPassword()) return;

      setEmployeeManagerMessage();

      const originalNumber = normalizeEmployeeNumber(
        document.getElementById(
          "employeeManagerOriginalNumber"
        ).value
      );
      const employeeNumber = normalizeEmployeeNumber(
        document.getElementById("employeeManagerNumber").value
      );
      const name = document.getElementById(
        "employeeManagerName"
      ).value.trim().toUpperCase();
      const active = document.getElementById(
        "employeeManagerActive"
      ).checked;
      const saveButton = document.getElementById(
        "employeeManagerSaveButton"
      );

      if(employeeNumber.length < 3){
        setEmployeeManagerMessage(
          "Ingresa un número de empleado válido."
        );
        return;
      }

      if(!name){
        setEmployeeManagerMessage("Ingresa el nombre completo.");
        return;
      }

      saveButton.disabled = true;
      saveButton.textContent = "Guardando…";

      try{
        const targetRef = doc(
          db,ADVISORS_COLLECTION,employeeNumber
        );
        const targetSnapshot = await getDoc(targetRef);

        if(
          targetSnapshot.exists()
          && employeeNumber !== originalNumber
        ){
          throw new Error(
            "Ese número de empleado ya está registrado."
          );
        }

        const employeeData = {
          employeeNumber,
          name,
          role:"advisor",
          active,
          accessMode:"public_selector",
          updatedAt:serverTimestamp(),
          updatedBy:"password-admin"
        };

        if(!originalNumber){
          await setDoc(targetRef,{
            ...employeeData,
            createdAt:serverTimestamp(),
            createdBy:"password-admin"
          });
        }else if(originalNumber === employeeNumber){
          await setDoc(targetRef,employeeData,{merge:true});
        }else{
          const batch = writeBatch(db);
          batch.set(targetRef,{
            ...employeeData,
            createdAt:serverTimestamp(),
            createdBy:"password-admin"
          });
          batch.delete(
            doc(db,ADVISORS_COLLECTION,originalNumber)
          );
          await batch.commit();

          const relatedReports = await getDocs(
            query(
              collection(db,REPORTS_COLLECTION),
              where(
                "advisorEmployeeNumber","==",originalNumber
              )
            )
          );

          for(const reportSnapshot of relatedReports.docs){
            await updateDoc(reportSnapshot.ref,{
              advisorUid:`employee-${employeeNumber}`,
              advisorEmployeeNumber:employeeNumber,
              advisorName:name,
              updatedAt:serverTimestamp(),
              editedBy:"password-admin"
            });
          }
        }

        setEmployeeManagerMessage(
          "Empleado guardado correctamente.","success"
        );
        resetEmployeeManagerForm();
      }catch(error){
        console.error(error);
        setEmployeeManagerMessage(
          error?.message ||
            "No fue posible guardar el empleado."
        );
      }finally{
        saveButton.disabled = false;
        if(
          document.getElementById(
            "employeeManagerOriginalNumber"
          ).value
        ){
          saveButton.textContent = "Actualizar empleado";
        }else{
          saveButton.textContent = "Guardar empleado";
        }
      }
    });

  window.toggleManagedEmployee = async function(
    employeeNumber,active
  ){
    if(!await requireEmployeeAdminPassword()) return;

    const employee = allAdvisors.find(
      item=>item.employeeNumber === employeeNumber
    );
    if(!employee) return;

    const action = active ? "activar" : "desactivar";
    if(!confirm(
      `¿Deseas ${action} a ${employee.name}?`
    )) return;

    await updateDoc(
      doc(db,ADVISORS_COLLECTION,employeeNumber),
      {
        active,
        updatedAt:serverTimestamp(),
        updatedBy:"password-admin"
      }
    );
  };

  window.deleteManagedEmployee = async function(
    employeeNumber
  ){
    if(!await requireEmployeeAdminPassword()) return;

    const employee = allAdvisors.find(
      item=>item.employeeNumber === employeeNumber
    );
    if(!employee) return;

    if(!confirm(
      `¿Eliminar definitivamente a ${employee.name}?`
      + "\n\nSus reportes históricos no se eliminarán."
    )) return;

    await deleteDoc(
      doc(db,ADVISORS_COLLECTION,employeeNumber)
    );
  };

  window.saveFinalizedReportToFirebase = async function(data){
    const profile = window.currentUserProfile;

    if(!profile || profile.role !== "advisor"){
      throw new Error("Selecciona un asesor antes de guardar.");
    }

    const reportDate = currentLocalDate();
    const reportId = reportDocumentId(profile.employeeNumber, reportDate);
    const reportRef = doc(db, REPORTS_COLLECTION, reportId);

    const clients = (data.clients || []).map(client=>({
      ...client,
      points:Number(client.points || 0)
    }));

    const procedureCount = clients.filter(
      client => client.result === "Trámite realizado"
    ).length;

    const payload = {
      reportId,
      advisorUid:`employee-${profile.employeeNumber}`,
      advisorName:profile.name,
      advisorEmployeeNumber:profile.employeeNumber,
      advisorRole:"advisor",
      createdDate:reportDate,
      createdAt:serverTimestamp(),
      createdAtLocal:data.createdAt,
      prospecting:data.prospecting,
      activityPlace:data.activityPlace,
      activitySchedule:data.activitySchedule,
      contacts:Number(data.peopleContacted || 0),
      appointmentsGenerated:Number(data.appointmentsGenerated || 0),
      activityDescription:data.activityDescription,
      clients,
      clientCount:clients.length,
      procedureCount,
      plan:{
        date:data.promiseDate,
        place:data.promisePlace,
        method:data.promiseMethod,
        schedule:data.promiseSchedule,
        contactGoal:Number(data.contactGoal || 0),
        appointmentGoal:Number(data.appointmentGoal || 0),
        description:data.promiseDescription
      },
      status:"finalized",
      reviewStatus:"pending",
      reviewedAt:null,
      reviewedBy:null,
      updatedAt:serverTimestamp()
    };

    await setDoc(reportRef,payload);
    return reportId;
  };
}
