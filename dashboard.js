<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Dashboard Actividad Comercial</title>
  <style>
    :root{
      --primary:#123A63;--primary2:#1C5D99;--accent:#0E9F6E;
      --danger:#D64545;--warning:#F59E0B;--bg:#F3F6FA;
      --card:#fff;--text:#1F2937;--muted:#6B7280;--line:#DCE3EC;
      --shadow:0 10px 28px rgba(18,58,99,.10)
    }
    *{box-sizing:border-box}
    body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;background:var(--bg);color:var(--text)}
    .hidden{display:none!important}
    button,.button{border:0;border-radius:11px;padding:10px 13px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:7px}
    button:disabled{opacity:.5;cursor:not-allowed}
    .primary{background:var(--primary);color:#fff}.soft{background:#EAF2F8;color:var(--primary)}
    .accent{background:var(--accent);color:#fff}.danger{background:#FDECEC;color:var(--danger)}
    .auth{min-height:100vh;display:grid;place-items:center;padding:20px;background:linear-gradient(145deg,#EAF2F8,#F8FAFC)}
    .auth-card{width:min(430px,100%);background:#fff;border:1px solid var(--line);border-radius:24px;padding:28px;box-shadow:0 18px 55px rgba(18,58,99,.16)}
    .auth-card h1{margin:0 0 8px;color:var(--primary)}.auth-card p{color:var(--muted);line-height:1.45}
    label{font-size:13px;font-weight:800;display:block;margin-bottom:6px}
    input,select,textarea{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:11px;font:inherit;outline:none;background:#fff}
    input:focus,select:focus,textarea:focus{border-color:var(--primary2);box-shadow:0 0 0 3px rgba(28,93,153,.12)}
    .error{display:none;margin-top:12px;padding:11px;border-radius:11px;background:#FFF0F0;border:1px solid #F2BABA;color:#A62F2F;font-weight:700}.error.show{display:block}
    .app{max-width:1500px;margin:auto;padding:18px}
    .top{background:linear-gradient(135deg,var(--primary),var(--primary2));color:#fff;border-radius:22px;padding:22px;display:flex;justify-content:space-between;gap:16px;align-items:center;box-shadow:var(--shadow)}
    .top h1{margin:0 0 5px}.top p{margin:0;opacity:.88}
    .top-actions{display:flex;gap:8px;flex-wrap:wrap}
    .tabs{display:flex;gap:8px;margin:14px 0}.tab.active{background:var(--primary);color:#fff}.tab{background:#fff;color:var(--primary);border:1px solid var(--line)}
    .panel{display:none}.panel.active{display:block}
    .kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin:14px 0}
    .kpi{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:var(--shadow)}
    .kpi span{color:var(--muted);font-size:12px;font-weight:800;text-transform:uppercase}.kpi strong{display:block;color:var(--primary);font-size:30px;margin-top:7px}
    .filters{background:#fff;border:1px solid var(--line);border-radius:16px;padding:15px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;box-shadow:var(--shadow)}
    .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:15px;margin-top:14px;box-shadow:var(--shadow)}
    .card-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.card h2{margin:0;color:var(--primary);font-size:20px}
    .table-wrap{overflow:auto;border:1px solid var(--line);border-radius:13px}
    table{width:100%;border-collapse:collapse;font-size:13px;min-width:1050px}
    th,td{padding:10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
    th{background:#EDF3F8;color:#233B55;position:sticky;top:0;z-index:1}
    tr.cancelled{opacity:.55;text-decoration:line-through}
    .badge{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:11px;font-weight:800}
    .pending{background:#FFF4D8;color:#865B00}.reviewed{background:#E8F8F0;color:#087554}.cancelled-badge{background:#FDECEC;color:#A62F2F}
    .actions{display:flex;gap:6px;flex-wrap:wrap}
    .empty{text-align:center;padding:32px;color:var(--muted)}
    .missing{display:flex;gap:8px;flex-wrap:wrap}.missing span{background:#FFF4D8;color:#7A5410;padding:7px 9px;border-radius:999px;font-size:12px;font-weight:700}
    .modal{position:fixed;inset:0;background:rgba(15,23,42,.72);display:none;place-items:center;padding:18px;z-index:9999}.modal.show{display:grid}
    .modal-card{width:min(1080px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:20px}
    .modal-head{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .detail-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.detail-box{background:#F8FAFC;border:1px solid var(--line);border-radius:12px;padding:11px}.detail-box strong{display:block;color:var(--primary);font-size:12px;margin-bottom:4px}
    .client-table{min-width:900px}
    @media(max-width:1000px){.kpis{grid-template-columns:repeat(3,1fr)}.filters{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:650px){.app{padding:9px}.top{align-items:flex-start;flex-direction:column}.kpis{grid-template-columns:repeat(2,1fr)}.filters{grid-template-columns:1fr}.detail-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <section id="authScreen" class="auth">
    <div class="auth-card">
      <h1>Dashboard Gerencial</h1>
      <p>Acceso exclusivo para usuarios con rol de gerente.</p>
      <form id="loginForm">
        <label for="employee">Usuario gerencial</label>
        <input id="employee" type="email" inputmode="email" autocomplete="username" placeholder="correo@empresa.com" required>
        <label for="password" style="margin-top:13px">Contraseña</label>
        <input id="password" type="password" autocomplete="current-password" required>
        <button id="loginButton" class="primary" style="width:100%;margin-top:18px" type="submit">Ingresar al dashboard</button>
        <div id="loginError" class="error"></div>
      </form>
    </div>
  </section>

  <main id="app" class="app hidden">
    <header class="top">
      <div>
        <h1>Dashboard de Actividad Comercial</h1>
        <p id="managerName">Administración gerencial en tiempo real</p>
      </div>
      <div class="top-actions">
        <a class="button soft" href="index.html">Abrir captura</a>
        <button class="accent" onclick="window.exportDashboardExcel()">Descargar Excel</button>
        <button class="danger" onclick="window.logoutManager()">Cerrar sesión</button>
      </div>
    </header>

    <div class="tabs">
      <button class="tab active" data-panel="summaryPanel">Resumen y reportes</button>
      <button class="tab" data-panel="staffPanel">Personal autorizado</button>
    </div>

    <section id="summaryPanel" class="panel active">
      <div class="kpis">
        <div class="kpi"><span>Reportes</span><strong id="kpiReports">0</strong></div>
        <div class="kpi"><span>Asesores activos</span><strong id="kpiActive">0</strong></div>
        <div class="kpi"><span>Reportaron hoy</span><strong id="kpiReported">0</strong></div>
        <div class="kpi"><span>Contactos</span><strong id="kpiContacts">0</strong></div>
        <div class="kpi"><span>Citas</span><strong id="kpiAppointments">0</strong></div>
        <div class="kpi"><span>Trámites</span><strong id="kpiProcedures">0</strong></div>
      </div>

      <div class="filters">
        <div><label>Desde</label><input id="dateFrom" type="date"></div>
        <div><label>Hasta</label><input id="dateTo" type="date"></div>
        <div><label>Asesor</label><select id="advisorFilter"><option value="">Todos</option></select></div>
        <div><label>Estado</label><select id="statusFilter"><option value="">Todos</option><option value="pending">Pendiente de revisión</option><option value="reviewed">Revisado</option><option value="cancelled">Anulado</option></select></div>
        <div><label>Buscar</label><input id="searchFilter" placeholder="Nombre, empresa, NSS o teléfono"></div>
      </div>

      <div class="card">
        <div class="card-head"><h2>Pendientes de reportar hoy</h2><span id="missingCount" class="badge pending">0</span></div>
        <div id="missingAdvisors" class="missing"></div>
      </div>

      <div class="card">
        <div class="card-head"><h2>Reportes registrados</h2><span id="visibleCount"></span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Asesor</th><th>Medio / lugar</th><th>Contactos</th><th>Citas</th><th>Clientes</th><th>Trámites</th><th>Revisión</th><th>Acciones</th></tr></thead>
            <tbody id="reportsBody"></tbody>
          </table>
        </div>
      </div>
    </section>

    <section id="staffPanel" class="panel">
      <div class="card">
        <div class="card-head"><h2>Personal autorizado</h2><span id="staffCount"></span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>No. empleado</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th>Administración</th></tr></thead>
            <tbody id="staffBody"></tbody>
          </table>
        </div>
      </div>
    </section>
  </main>

  <div id="detailModal" class="modal">
    <div class="modal-card">
      <div class="modal-head"><h2 id="detailTitle">Detalle</h2><button class="danger" onclick="document.getElementById('detailModal').classList.remove('show')">Cerrar</button></div>
      <div id="detailContent"></div>
    </div>
  </div>

  <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
  <script type="module" src="dashboard.js"></script>
</body>
</html>
