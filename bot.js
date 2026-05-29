<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Wazzi — Villanueva Casanare</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.47.0/tabler-icons.min.css"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    :root{--pk:#FF4D1C;--dark:#0D0D0D;--surface:#1A1A1A;--card:#242424;--border:#2E2E2E;--txt:#F5F5F0;--muted:#888;--green:#1DB87A;--amber:#F5A623}
    body{font-family:'DM Sans',sans-serif;background:var(--dark);color:var(--txt);min-height:100vh}
    .app{max-width:390px;margin:0 auto;min-height:100vh}
    .screen{display:none}.screen.active{display:block}
    /* ONBOARDING */
    .ob-hero{background:var(--pk);padding:60px 32px 40px;position:relative;overflow:hidden}
    .ob-hero::before{content:'';position:absolute;bottom:-60px;right:-60px;width:200px;height:200px;background:rgba(255,255,255,0.08);border-radius:50%}
    .ob-logo{font-family:'Syne',sans-serif;font-weight:800;font-size:42px;color:white;letter-spacing:-1px;margin-bottom:8px}
    .ob-tagline{font-size:15px;color:rgba(255,255,255,0.85);line-height:1.5}
    .ob-body{padding:28px 24px 0}
    .ob-feat{display:flex;align-items:flex-start;gap:14px;margin-bottom:22px}
    .ob-icon{width:40px;height:40px;border-radius:12px;background:rgba(255,77,28,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .ob-icon i{font-size:20px;color:var(--pk)}
    .ob-feat-title{font-size:14px;font-weight:500;color:var(--txt);margin-bottom:2px}
    .ob-feat-desc{font-size:12px;color:var(--muted);line-height:1.5}
    .ob-actions{padding:20px 24px 40px;display:flex;flex-direction:column;gap:10px}
    /* FORMS */
    .form-wrap{padding:16px 24px 40px}
    .form-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--txt);margin-bottom:4px}
    .form-sub{font-size:13px;color:var(--muted);margin-bottom:24px}
    .back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;padding:16px 24px 0}
    .role-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}
    .role-card{background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:16px 12px;text-align:center;cursor:pointer;transition:all 0.15s}
    .role-card.selected{border-color:var(--pk);background:rgba(255,77,28,0.08)}
    .role-card i{font-size:26px;color:var(--muted);margin-bottom:8px;display:block}
    .role-card.selected i{color:var(--pk)}
    .role-name{font-size:14px;font-weight:500;color:var(--txt)}
    .role-desc{font-size:11px;color:var(--muted);margin-top:3px}
    .field{margin-bottom:14px}
    .field-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px}
    .field-input{width:100%;padding:12px 14px;background:var(--card);border:0.5px solid var(--border);border-radius:10px;color:var(--txt);font-size:14px;font-family:'DM Sans',sans-serif}
    .field-input::placeholder{color:var(--muted)}
    .field-input:focus{outline:none;border-color:var(--pk)}
    .field-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .driver-extra{display:none}
    .pin-field{margin-bottom:14px}
    .pin-input{width:100%;padding:14px;background:var(--card);border:0.5px solid var(--border);border-radius:10px;color:var(--txt);font-size:24px;font-family:'DM Sans',sans-serif;text-align:center;letter-spacing:8px}
    .pin-hint{font-size:11px;color:var(--muted);text-align:center;margin-top:6px}
    /* BUTTONS */
    .btn-pk{width:100%;padding:14px;background:var(--pk);color:white;border:none;border-radius:10px;font-size:15px;font-weight:500;cursor:pointer;font-family:'Syne',sans-serif;margin-top:8px}
    .btn-sec{width:100%;padding:12px;background:transparent;color:var(--txt);border:0.5px solid var(--border);border-radius:10px;font-size:14px;cursor:pointer}
    .btn-ghost{background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;padding:8px;width:100%}
    .btn-outline{width:100%;padding:11px;background:var(--card);color:var(--muted);border:0.5px solid var(--border);border-radius:10px;font-size:13px;cursor:pointer;margin-top:8px}
    .wsp-btn{width:100%;padding:13px;background:#25D366;color:white;border:none;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px}
    .divider{display:flex;align-items:center;gap:12px;margin:16px 0}
    .divider-line{flex:1;height:0.5px;background:var(--border)}
    .divider-txt{font-size:12px;color:var(--muted)}
    /* TOAST */
    .toast{border-radius:12px;padding:12px 16px;margin:10px 0;font-size:13px;font-weight:500;display:none;align-items:center;gap:8px;background:var(--green);color:white}
    .toast.show{display:flex}
    .toast.error{background:#c0392b}
    /* TOPBAR */
    .topbar{padding:14px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:0.5px solid var(--border);background:var(--surface)}
    .logo{font-family:'Syne',sans-serif;font-weight:800;font-size:22px;color:var(--pk);letter-spacing:-0.5px}
    .logo span{color:var(--txt)}
    .user-chip{display:flex;align-items:center;gap:8px;background:var(--surface);border:0.5px solid var(--border);border-radius:20px;padding:5px 12px 5px 5px;cursor:pointer}
    .user-av{width:26px;height:26px;border-radius:50%;background:var(--pk);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white}
    /* TABS */
    .tab-bar{display:flex;background:var(--surface);border-bottom:0.5px solid var(--border)}
    .tab{flex:1;padding:12px 8px;text-align:center;font-size:11px;font-weight:500;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;transition:all 0.15s}
    .tab.active{color:var(--pk);border-bottom-color:var(--pk)}
    .tab i{display:block;font-size:17px;margin-bottom:3px}
    .tab-content{display:none;padding-bottom:60px}
    .tab-content.active{display:block}
    /* HERO */
    .hero{background:var(--surface);margin:16px;border-radius:16px;padding:20px;border:0.5px solid var(--border);position:relative;overflow:hidden}
    .hero::before{content:'';position:absolute;top:-30px;right:-30px;width:100px;height:100px;background:var(--pk);opacity:0.08;border-radius:50%}
    .hero-label{font-size:11px;font-weight:500;color:var(--pk);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px}
    .hero-title{font-family:'Syne',sans-serif;font-size:19px;font-weight:700;color:var(--txt);line-height:1.2;margin-bottom:16px}
    .pk-input{width:100%;padding:11px 14px;background:var(--card);border:0.5px solid var(--border);border-radius:10px;color:var(--txt);font-size:14px;font-family:'DM Sans',sans-serif;margin-bottom:10px}
    .pk-input::placeholder{color:var(--muted)}
    .svc-tabs{display:flex;gap:6px;margin-bottom:14px}
    .svc-tab{flex:1;padding:8px 4px;border-radius:8px;font-size:11px;font-weight:500;text-align:center;cursor:pointer;background:var(--card);color:var(--muted);border:0.5px solid var(--border);transition:all 0.15s}
    .svc-tab.active{background:rgba(255,77,28,0.12);color:var(--pk);border-color:var(--pk)}
    /* CARDS */
    .section-head{display:flex;justify-content:space-between;align-items:center;padding:0 16px;margin:16px 0 10px}
    .section-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--txt)}
    .driver-card{background:var(--surface);margin:0 16px 10px;border-radius:14px;padding:14px 16px;border:0.5px solid var(--border);display:flex;align-items:center;gap:12px}
    .d-av{width:40px;height:40px;border-radius:50%;background:var(--card);display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:700;font-size:13px;color:var(--pk);border:1.5px solid var(--pk);flex-shrink:0}
    .d-info{flex:1}.d-name{font-size:14px;font-weight:500;color:var(--txt)}
    .d-zone{font-size:11px;color:var(--muted);margin-top:1px}
    .d-badge{display:flex;align-items:center;gap:4px;font-size:11px;padding:4px 10px;border-radius:20px;font-weight:500;flex-shrink:0}
    .bon{background:rgba(29,184,122,0.15);color:var(--green)}
    .dot{width:6px;height:6px;border-radius:50%;background:currentColor}
    /* ESPERA */
    .espera-card{background:var(--surface);margin:16px;border-radius:16px;padding:20px;border:1.5px solid var(--amber);display:none}
    .espera-anim{display:flex;align-items:center;gap:12px;margin-bottom:14px}
    .espera-dot{width:12px;height:12px;border-radius:50%;background:var(--amber);animation:blink 1.2s infinite}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
    /* TAXISTA */
    .tx-header{background:var(--pk);padding:20px}
    .tx-bienvenida{font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:2px}
    .tx-nombre{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:white}
    .tx-placa{font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px}
    .tx-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:rgba(255,255,255,0.15);margin-top:14px;border-radius:10px;overflow:hidden}
    .tx-stat{background:rgba(0,0,0,0.2);padding:10px;text-align:center}
    .tx-stat-n{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:white}
    .tx-stat-l{font-size:10px;color:rgba(255,255,255,0.6);margin-top:1px}
    .disp-bar{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:var(--surface);border-bottom:0.5px solid var(--border)}
    .disp-txt{font-size:13px;font-weight:500;color:var(--txt)}
    .disp-sub{font-size:11px;color:var(--muted);margin-top:1px}
    .toggle{width:44px;height:26px;background:var(--green);border-radius:13px;cursor:pointer;position:relative;border:none;transition:background 0.2s}
    .toggle.off{background:var(--border)}
    .toggle::after{content:'';position:absolute;width:20px;height:20px;background:white;border-radius:50%;top:3px;left:21px;transition:left 0.2s}
    .toggle.off::after{left:3px}
    .pedido-card{background:var(--surface);margin:0 16px 10px;border-radius:14px;padding:16px;border:0.5px solid var(--border)}
    .pedido-cliente{font-size:12px;color:var(--muted);margin-bottom:4px}
    .pedido-lugar{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:var(--txt);margin-bottom:8px}
    .pedido-meta{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
    .tag{font-size:11px;padding:3px 10px;border-radius:20px;background:var(--card);color:var(--muted);border:0.5px solid var(--border)}
    .tag.amber{background:rgba(245,166,35,0.12);color:var(--amber);border-color:transparent}
    .price-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
    .price-label{font-size:12px;color:var(--muted);white-space:nowrap}
    .price-input{flex:1;padding:8px 12px;background:var(--card);border:0.5px solid var(--border);border-radius:8px;color:var(--txt);font-size:14px;font-family:'DM Sans',sans-serif}
    .price-hint{font-size:10px;color:var(--muted);margin-bottom:10px}
    .btn-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .btn-take{padding:11px;background:var(--pk);color:white;border:none;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;font-family:'Syne',sans-serif}
    .btn-skip{padding:11px;background:var(--card);color:var(--muted);border:0.5px solid var(--border);border-radius:10px;font-size:13px;cursor:pointer}
    /* NEGOCIOS */
    .biz-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 16px}
    .biz-card{background:var(--surface);border-radius:14px;overflow:hidden;border:0.5px solid var(--border);cursor:pointer}
    .biz-img{height:80px;display:flex;align-items:center;justify-content:center;font-size:28px}
    .biz-body{padding:10px 12px}
    .biz-name{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--txt)}
    .biz-type{font-size:11px;color:var(--muted)}
    .biz-tag{display:inline-block;font-size:10px;padding:2px 8px;border-radius:20px;margin-top:5px;font-weight:500;margin-right:3px}
    .biz-open{background:rgba(29,184,122,0.15);color:var(--green)}
    .biz-dom{background:rgba(255,77,28,0.12);color:var(--pk)}
    /* PERFIL */
    .prof-card{background:var(--surface);margin:16px;border-radius:16px;padding:20px;border:0.5px solid var(--border)}
    .prof-top{display:flex;align-items:center;gap:14px;margin-bottom:20px}
    .prof-av{width:54px;height:54px;border-radius:50%;background:var(--pk);display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:18px;color:white}
    .prof-name{font-family:'Syne',sans-serif;font-size:17px;font-weight:700;color:var(--txt)}
    .prof-role{font-size:12px;color:var(--muted);margin-top:2px}
    .prof-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
    .ps{background:var(--card);border-radius:10px;padding:12px;text-align:center}
    .ps-n{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--txt)}
    .ps-l{font-size:10px;color:var(--muted);margin-top:2px}
    .loading{text-align:center;padding:2rem;color:var(--muted);font-size:13px}
    /* MODAL */
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.8);display:none;align-items:flex-end;justify-content:center;z-index:9999}
    .modal-overlay.show{display:flex}
    .modal-box{background:var(--surface);border-radius:24px 24px 0 0;padding:28px 24px 40px;width:100%;max-width:390px;border-top:0.5px solid var(--border)}
    .modal-handle{width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 20px}
  </style>
</head>
<body>
<div class="app">

  <!-- ONBOARDING -->
  <div class="screen active" id="s-onboarding">
    <div class="ob-hero">
      <div class="ob-logo">wazzi</div>
      <div class="ob-tagline">Pide tu taxi, conecta con negocios y viaja por Villanueva — todo desde WhatsApp o aqui.</div>
    </div>
    <div class="ob-body">
      <div class="ob-feat">
        <div class="ob-icon"><i class="ti ti-car"></i></div>
        <div><div class="ob-feat-title">Taxis locales e intermunicipales</div><div class="ob-feat-desc">Pide un taxi en segundos. Ve quien esta disponible ahora mismo.</div></div>
      </div>
      <div class="ob-feat">
        <div class="ob-icon"><i class="ti ti-building-store"></i></div>
        <div><div class="ob-feat-title">Directorio de negocios</div><div class="ob-feat-desc">Restaurantes, droguerias, supermercados con menu y domicilios.</div></div>
      </div>
      <div class="ob-feat">
        <div class="ob-icon"><i class="ti ti-brand-whatsapp"></i></div>
        <div><div class="ob-feat-title">Funciona sin internet ilimitado</div><div class="ob-feat-desc">Pide por WhatsApp si no tienes datos. Solo necesitas el numero de Wazzi.</div></div>
      </div>
    </div>
    <div class="ob-actions">
      <button class="btn-pk" onclick="goto('s-registro')">Crear mi cuenta gratis</button>
      <button class="btn-sec" onclick="goto('s-login')">Ya tengo cuenta — Entrar</button>
      <button class="btn-ghost" onclick="entrarSinCuenta()">Ver la app sin registrarme</button>
    </div>
  </div>

  <!-- REGISTRO -->
  <div class="screen" id="s-registro">
    <button class="back-btn" onclick="goto('s-onboarding')"><i class="ti ti-arrow-left" style="font-size:16px"></i> Volver</button>
    <div class="form-wrap">
      <div class="form-title">Crear cuenta</div>
      <div class="form-sub">Como vas a usar Wazzi?</div>
      <div class="role-grid">
        <div class="role-card selected" id="rc-client" onclick="selectRole('client')">
          <i class="ti ti-user"></i>
          <div class="role-name">Soy cliente</div>
          <div class="role-desc">Quiero pedir taxi</div>
        </div>
        <div class="role-card" id="rc-driver" onclick="selectRole('driver')">
          <i class="ti ti-steering-wheel"></i>
          <div class="role-name">Soy taxista</div>
          <div class="role-desc">Quiero ofrecer servicio</div>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><div class="field-label">Nombre</div><input class="field-input" id="reg-nom" placeholder="Carlos"/></div>
        <div class="field"><div class="field-label">Apellido</div><input class="field-input" id="reg-ape" placeholder="Mora"/></div>
      </div>
      <div class="field"><div class="field-label">WhatsApp</div><input class="field-input" id="reg-tel" type="tel" placeholder="316 000 0000"/></div>
      <div class="driver-extra" id="driver-extra">
        <div class="field"><div class="field-label">Placa del taxi</div><input class="field-input" id="reg-placa" placeholder="BHT-234"/></div>
        <div class="field"><div class="field-label">Paradero habitual</div>
          <select class="field-input" id="reg-paradero"><option>Contramarginal</option><option>Comdisol</option></select>
        </div>
        <div class="field"><div class="field-label">Tipo de servicio</div>
          <select class="field-input" id="reg-tipo">
            <option value="local">Local / Expreso</option>
            <option value="intermunicipal">Intermunicipal — vende puestos</option>
          </select>
        </div>
      </div>
      <div class="pin-field">
        <div class="field-label">PIN de seguridad (4 digitos)</div>
        <input class="pin-input" id="reg-pin" type="tel" maxlength="4" placeholder="0000" inputmode="numeric"/>
        <div class="pin-hint">Usalo cada vez que entres. No lo olvides.</div>
      </div>
      <div class="toast" id="toast-reg"><i class="ti ti-alert-circle"></i> <span id="toast-reg-msg"></span></div>
      <button class="btn-pk" onclick="registrar()">Crear mi cuenta en Wazzi</button>
      <div class="divider"><div class="divider-line"></div><div class="divider-txt">o</div><div class="divider-line"></div></div>
      <button class="wsp-btn" onclick="registrar()"><i class="ti ti-brand-whatsapp" style="font-size:18px"></i>Continuar con WhatsApp</button>
    </div>
  </div>

  <!-- LOGIN -->
  <div class="screen" id="s-login">
    <button class="back-btn" onclick="goto('s-onboarding')"><i class="ti ti-arrow-left" style="font-size:16px"></i> Volver</button>
    <div class="form-wrap">
      <div class="form-title">Entrar a Wazzi</div>
      <div class="form-sub">Ingresa con tu numero y PIN</div>
      <div class="field"><div class="field-label">WhatsApp</div><input class="field-input" id="log-tel" type="tel" placeholder="316 000 0000"/></div>
      <div class="pin-field">
        <div class="field-label">PIN de seguridad</div>
        <input class="pin-input" id="log-pin" type="tel" maxlength="4" placeholder="0000" inputmode="numeric"/>
      </div>
      <div class="toast" id="toast-log"><i class="ti ti-alert-circle"></i> <span id="toast-log-msg"></span></div>
      <button class="btn-pk" onclick="login()">Entrar</button>
      <div class="divider"><div class="divider-line"></div><div class="divider-txt">o</div><div class="divider-line"></div></div>
      <button class="wsp-btn" onclick="login()"><i class="ti ti-brand-whatsapp" style="font-size:18px"></i>Entrar con WhatsApp</button>
      <button class="btn-ghost" style="margin-top:8px" onclick="goto('s-registro')">No tienes cuenta? Registrate</button>
    </div>
  </div>

  <!-- APP CLIENTE -->
  <div class="screen" id="s-cliente">
    <div class="topbar">
      <div class="logo">wazz<span>i</span></div>
      <div class="user-chip" onclick="cliTab('perfil')">
        <div class="user-av" id="cli-av">?</div>
        <span style="font-size:12px;color:var(--txt)" id="cli-nombre-chip">—</span>
      </div>
    </div>
    <div class="tab-bar">
      <div class="tab active" id="tab-pedir" onclick="cliTab('pedir')"><i class="ti ti-car"></i>Pedir taxi</div>
      <div class="tab" id="tab-inter" onclick="cliTab('inter')"><i class="ti ti-bus"></i>Intermunicipales</div>
      <div class="tab" id="tab-biz" onclick="cliTab('biz')"><i class="ti ti-building-store"></i>Negocios</div>
      <div class="tab" id="tab-perfil" onclick="cliTab('perfil')"><i class="ti ti-user"></i>Perfil</div>
    </div>

    <!-- PEDIR TAXI -->
    <div class="tab-content active" id="cli-pedir">
      <div class="hero">
        <div class="hero-label">A donde vas hoy?</div>
        <div class="hero-title">Pide tu taxi en segundos</div>
        <div class="svc-tabs">
          <div class="svc-tab active" onclick="setSvc(this,'local')">Local</div>
          <div class="svc-tab" onclick="setSvc(this,'expreso')">Expreso</div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.05em">Estoy en</div>
        <input class="pk-input" id="sel-origen" placeholder="Frente al parque, Cra 5 con Calle 8..."/>
        <div style="font-size:11px;color:var(--muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.05em">Voy a</div>
        <input class="pk-input" id="sel-destino" placeholder="Barrio El Mirador, Caribayona..."/>
        <button class="btn-pk" onclick="pedirTaxi()" style="margin-top:4px">Pedir Wazzi ahora</button>
      </div>
      <div class="toast" id="toast-cli" style="margin:0 16px"><i class="ti ti-circle-check"></i> <span id="toast-cli-msg"></span></div>

      <!-- ESPERANDO -->
      <div class="espera-card" id="espera-card">
        <div class="espera-anim">
          <div class="espera-dot"></div>
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--txt)">Buscando taxista...</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">Los taxistas disponibles ya ven tu solicitud</div>
          </div>
        </div>
        <div style="background:var(--card);border-radius:10px;padding:12px 14px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:12px;color:var(--muted)">Desde</span>
            <span style="font-size:12px;font-weight:500;color:var(--txt)" id="esp-origen">—</span>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="font-size:12px;color:var(--muted)">Hasta</span>
            <span style="font-size:12px;font-weight:500;color:var(--txt)" id="esp-destino">—</span>
          </div>
        </div>
        <button onclick="cancelarEspera()" class="btn-outline">Cancelar solicitud</button>
      </div>

      <div class="section-head"><div class="section-title">Taxistas disponibles</div></div>
      <div id="taxistas-list"><div class="loading">Cargando taxistas...</div></div>
    </div>

    <!-- INTERMUNICIPALES -->
    <div class="tab-content" id="cli-inter">
      <div class="section-head" style="margin-top:16px"><div class="section-title">Viajes disponibles</div></div>
      <div style="padding:0 16px">
        <div style="background:var(--surface);border-radius:14px;padding:16px;border:0.5px solid var(--border);margin-bottom:10px">
          <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--txt);margin-bottom:4px">Villanueva a Yopal</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:12px;display:flex;align-items:center;gap:6px"><i class="ti ti-clock" style="font-size:12px;color:var(--amber)"></i> Sale: 2:00 PM · Jorge R. · BHT-234</div>
          <div style="display:flex;gap:6px;margin-bottom:12px">
            <div style="width:38px;height:38px;border-radius:8px;background:var(--card);color:var(--muted);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">P1</div>
            <div style="width:38px;height:38px;border-radius:8px;background:rgba(29,184,122,0.1);color:var(--green);border:1.5px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;cursor:pointer">P2</div>
            <div style="width:38px;height:38px;border-radius:8px;background:rgba(29,184,122,0.1);color:var(--green);border:1.5px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;cursor:pointer">P3</div>
            <div style="width:38px;height:38px;border-radius:8px;background:var(--card);color:var(--muted);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">P4</div>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:10px">2 puestos libres · <span style="color:var(--pk);font-weight:500">$25.000 c/u</span></div>
          <button class="btn-pk" style="margin-top:0" onclick="showToastCli('Puesto reservado. El taxista te contactara.')">Reservar puesto</button>
        </div>
      </div>
    </div>

    <!-- NEGOCIOS -->
    <div class="tab-content" id="cli-biz">
      <div class="section-head" style="margin-top:16px"><div class="section-title">Negocios de Villanueva</div></div>
      <div class="biz-grid">
        <div class="biz-card" onclick="openBiz(0)"><div class="biz-img" style="background:#1a1a0a">🍽️</div><div class="biz-body"><div class="biz-name">La Palma</div><div class="biz-type">Restaurante</div><span class="biz-tag biz-open">Abierto</span><span class="biz-tag biz-dom">Domicilio</span></div></div>
        <div class="biz-card" onclick="openBiz(1)"><div class="biz-img" style="background:#0a0a1a">💊</div><div class="biz-body"><div class="biz-name">Drogueria Central</div><div class="biz-type">Farmacia</div><span class="biz-tag biz-open">24 horas</span></div></div>
        <div class="biz-card" onclick="openBiz(2)"><div class="biz-img" style="background:#0a1a0a">🛒</div><div class="biz-body"><div class="biz-name">Orion Mercado</div><div class="biz-type">Supermercado</div><span class="biz-tag biz-dom">Domicilio</span></div></div>
        <div class="biz-card" onclick="openBiz(3)"><div class="biz-img" style="background:#1a0a0a">🍞</div><div class="biz-body"><div class="biz-name">Panaderia Llanera</div><div class="biz-type">Panaderia</div><span class="biz-tag biz-open">Abierto</span></div></div>
      </div>
    </div>

    <!-- PERFIL CLIENTE -->
    <div class="tab-content" id="cli-perfil">
      <div class="prof-card">
        <div class="prof-top">
          <div class="prof-av" id="cli-prof-av">?</div>
          <div><div class="prof-name" id="cli-prof-nombre">—</div><div class="prof-role">Cliente Wazzi · Villanueva</div></div>
        </div>
        <div class="prof-stats">
          <div class="ps"><div class="ps-n" id="cli-viajes">0</div><div class="ps-l">Viajes</div></div>
          <div class="ps"><div class="ps-n">4</div><div class="ps-l">Negocios</div></div>
        </div>
        <button class="btn-outline" onclick="logout()"><i class="ti ti-logout" style="font-size:14px;vertical-align:-2px;margin-right:6px"></i>Cerrar sesion</button>
      </div>
    </div>
  </div>

  <!-- APP TAXISTA -->
  <div class="screen" id="s-taxista">
    <div class="tx-header">
      <div class="tx-bienvenida">Bienvenido,</div>
      <div class="tx-nombre" id="tx-nombre">—</div>
      <div class="tx-placa" id="tx-placa">—</div>
      <div class="tx-stats">
        <div class="tx-stat"><div class="tx-stat-n" id="tx-servicios">0</div><div class="tx-stat-l">Servicios hoy</div></div>
        <div class="tx-stat"><div class="tx-stat-n" id="tx-pendientes">0</div><div class="tx-stat-l">Solicitudes</div></div>
      </div>
    </div>
    <div class="disp-bar">
      <div><div class="disp-txt">Disponible para servicios</div><div class="disp-sub" id="disp-sub">Activo — los clientes te ven</div></div>
      <button class="toggle" id="toggle-st" onclick="toggleStatus()"></button>
    </div>
    <div class="toast" id="toast-tx" style="margin:10px 16px 0"><i class="ti ti-circle-check"></i> <span id="toast-tx-msg"></span></div>
    <div class="section-head"><div class="section-title">Solicitudes activas</div></div>
    <div id="pedidos-list"><div class="loading">Cargando solicitudes...</div></div>
    <div style="padding:16px">
      <button class="btn-outline" onclick="logout()"><i class="ti ti-logout" style="font-size:14px;vertical-align:-2px;margin-right:6px"></i>Cerrar sesion</button>
    </div>
  </div>

  <!-- MODAL NOTIFICACION -->
  <div class="modal-overlay" id="modal-acepto">
    <div class="modal-box">
      <div class="modal-handle"></div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div style="width:48px;height:48px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ti-check" style="font-size:24px;color:white"></i>
        </div>
        <div>
          <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--txt)">Tu taxi esta en camino!</div>
          <div style="font-size:13px;color:var(--muted);margin-top:2px">Un taxista tomo tu servicio</div>
        </div>
      </div>
      <div style="background:var(--card);border-radius:14px;padding:16px;margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid var(--border)">
          <span style="font-size:13px;color:var(--muted)">Taxista</span>
          <span style="font-size:13px;font-weight:500;color:var(--txt)" id="modal-taxista">—</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid var(--border)">
          <span style="font-size:13px;color:var(--muted)">Placa</span>
          <span style="font-size:13px;font-weight:500;color:var(--txt)" id="modal-placa">—</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid var(--border)">
          <span style="font-size:13px;color:var(--muted)">Precio</span>
          <span style="font-size:14px;font-weight:700;color:var(--pk)" id="modal-precio">—</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0">
          <span style="font-size:13px;color:var(--muted)">Llega en</span>
          <span style="font-size:13px;font-weight:500;color:var(--green)" id="modal-minutos">—</span>
        </div>
      </div>
      <button onclick="cerrarModal()" style="width:100%;padding:14px;background:var(--green);color:white;border:none;border-radius:10px;font-size:15px;font-weight:500;cursor:pointer;font-family:'Syne',sans-serif">Entendido</button>
    </div>
  </div>

</div>

<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>

<script>
  // Firebase init
  const firebaseConfig = {
    apiKey: "AIzaSyDgGtXuztW6z6FceGtkmfezNeB1JgfWkEQ",
    authDomain: "wazzi-9f204.firebaseapp.com",
    projectId: "wazzi-9f204",
    storageBucket: "wazzi-9f204.firebasestorage.app",
    messagingSenderId: "50627925661",
    appId: "1:50627925661:web:15d039064bf5d9c75e6674",
    measurementId: "G-8E2M6GTTLB"
  };
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  // State
  let currentUser = null;
  let userRole = 'client';
  let svcType = 'local';
  let statusOn = true;
  let unsubPedidos = null;
  let unsubTaxistas = null;
  let unsubPedidoCliente = null;
  let activePedidoId = null;

  const bizData = [
    {name:'La Palma',type:'Restaurante · 311 542 8801',items:[{n:'Bandeja paisa',d:'Frijoles, chicharron, arroz, huevo',p:'$16.000'},{n:'Sancocho de gallina',d:'Receta casera',p:'$14.000'},{n:'Almuerzo corriente',d:'Sopa + seco + jugo',p:'$12.000'}]},
    {name:'Drogueria Central',type:'Farmacia · 315 221 9934',items:[{n:'Medicamentos genericos',d:'Amplio surtido',p:'Consultar'},{n:'Domicilio urgente',d:'En Villanueva',p:'$3.000'}]},
    {name:'Orion Mercado',type:'Supermercado · 320 889 1145',items:[{n:'Domicilio gratis',d:'Pedidos desde $30.000',p:'Gratis'},{n:'Frutas y verduras',d:'Frescas cada manana',p:'Desde $2.000'}]},
    {name:'Panaderia Llanera',type:'Panaderia · 317 445 6600',items:[{n:'Pan de bono',d:'Recien horneado',p:'$1.500 c/u'},{n:'Pandebono docena',d:'Ideal para desayuno',p:'$16.000'}]},
  ];

  // NAVIGATION
  function goto(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo(0,0);
  }

  function entrarSinCuenta() {
    currentUser = {nombre:'Visitante', apellido:'', rol:'client', telefono:''};
    mostrarCliente('Visitante','');
  }

  // ROLE SELECTION
  function selectRole(r) {
    userRole = r;
    document.getElementById('rc-client').classList.toggle('selected', r==='client');
    document.getElementById('rc-driver').classList.toggle('selected', r==='driver');
    document.getElementById('driver-extra').style.display = r==='driver' ? 'block' : 'none';
  }

  function setSvc(el, t) {
    svcType = t;
    document.querySelectorAll('.svc-tab').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
  }

  // REGISTER
  async function registrar() {
    const nom = document.getElementById('reg-nom').value.trim();
    const ape = document.getElementById('reg-ape').value.trim();
    const tel = document.getElementById('reg-tel').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();
    if(!nom){ showToast('toast-reg','Ingresa tu nombre','error'); return; }
    if(!tel){ showToast('toast-reg','Ingresa tu WhatsApp','error'); return; }
    if(!pin || pin.length !== 4 || isNaN(pin)){ showToast('toast-reg','El PIN debe ser exactamente 4 numeros','error'); return; }
    try {
      const rol = userRole === 'driver' ? 'driver' : 'client';
      const datos = { nombre:nom, apellido:ape, telefono:tel, pin, rol, ciudad:'Villanueva', fecha_registro:firebase.firestore.FieldValue.serverTimestamp() };
      if(rol === 'driver'){
        datos.placa = document.getElementById('reg-placa').value.trim().toUpperCase();
        datos.paradero = document.getElementById('reg-paradero').value;
        datos.tipo = document.getElementById('reg-tipo').value;
        datos.disponible = true;
        await db.collection('taxistas').add(datos);
        currentUser = {...datos};
        mostrarTaxista(nom, ape, datos);
      } else {
        await db.collection('usuarios').add(datos);
        currentUser = {...datos};
        mostrarCliente(nom, ape);
      }
    } catch(e){ showToast('toast-reg','Error al registrar: '+e.message,'error'); }
  }

  // LOGIN
  async function login() {
    const tel = document.getElementById('log-tel').value.trim();
    const pin = document.getElementById('log-pin').value.trim();
    if(!tel){ showToast('toast-log','Ingresa tu WhatsApp','error'); return; }
    if(!pin || pin.length !== 4){ showToast('toast-log','Ingresa tu PIN de 4 digitos','error'); return; }
    try {
      // Buscar en clientes
      const snap = await db.collection('usuarios').where('telefono','==',tel).limit(1).get();
      if(!snap.empty){
        const d = snap.docs[0].data();
        if(d.pin && pin !== d.pin.toString()){ showToast('toast-log','PIN incorrecto','error'); return; }
        currentUser = {...d, rol:'client'};
        mostrarCliente(d.nombre, d.apellido||'');
        return;
      }
      // Buscar en taxistas
      const snap2 = await db.collection('taxistas').where('telefono','==',tel).limit(1).get();
      if(!snap2.empty){
        const d = snap2.docs[0].data();
        if(d.pin && pin !== d.pin.toString()){ showToast('toast-log','PIN incorrecto','error'); return; }
        currentUser = {...d, rol:'driver'};
        mostrarTaxista(d.nombre, d.apellido||'', d);
        return;
      }
      showToast('toast-log','Numero no encontrado. Ya te registraste?','error');
    } catch(e){ showToast('toast-log','Error: '+e.message,'error'); }
  }

  // MOSTRAR APP CLIENTE
  function mostrarCliente(nom, ape) {
    const ini = (nom[0]||'')+(ape[0]||'');
    document.getElementById('cli-av').textContent = ini;
    document.getElementById('cli-nombre-chip').textContent = nom;
    document.getElementById('cli-prof-av').textContent = ini;
    document.getElementById('cli-prof-nombre').textContent = nom+' '+ape;
    goto('s-cliente');
    cargarTaxistas();
  }

  // MOSTRAR APP TAXISTA
  function mostrarTaxista(nom, ape, datos) {
    document.getElementById('tx-nombre').textContent = nom+' '+ape;
    document.getElementById('tx-placa').textContent = (datos.placa||'')+' · '+(datos.paradero||'')+' · '+(datos.tipo||'');
    goto('s-taxista');
    cargarPedidos();
  }

  // TABS CLIENTE
  function cliTab(t) {
    ['pedir','inter','biz','perfil'].forEach(id => {
      document.getElementById('cli-'+id).classList.toggle('active', id===t);
      document.getElementById('tab-'+(id==='biz'?'biz':id)).classList.toggle('active', id===t);
    });
    if(t==='pedir') cargarTaxistas();
  }

  // PEDIR TAXI
  async function pedirTaxi() {
    if(!currentUser || !currentUser.telefono){ showToastCli('Completa tu registro para pedir taxi.'); return; }
    const origen = document.getElementById('sel-origen').value.trim();
    const destino = document.getElementById('sel-destino').value.trim();
    if(!origen){ showToastCli('Indica desde donde te recogemos.'); return; }
    try {
      const ref = await db.collection('pedidos').add({
        cliente_telefono: currentUser.telefono,
        cliente_nombre: currentUser.nombre,
        origen, destino, tipo: svcType,
        estado: 'pendiente',
        ciudad: 'Villanueva',
        taxista_id: 'sin asignar',
        canal: 'app',
        fecha: firebase.firestore.FieldValue.serverTimestamp()
      });
      activePedidoId = ref.id;
      document.getElementById('esp-origen').textContent = origen;
      document.getElementById('esp-destino').textContent = destino;
      document.querySelector('.hero').style.display = 'none';
      document.getElementById('espera-card').style.display = 'block';
      const v = parseInt(document.getElementById('cli-viajes').textContent)||0;
      document.getElementById('cli-viajes').textContent = v+1;
      escucharPedido(ref.id);
    } catch(e){ showToastCli('Error: '+e.message); }
  }

  function cancelarEspera() {
    if(unsubPedidoCliente){ unsubPedidoCliente(); unsubPedidoCliente = null; }
    document.querySelector('.hero').style.display = 'block';
    document.getElementById('espera-card').style.display = 'none';
    activePedidoId = null;
  }

  function escucharPedido(pedidoId) {
    if(unsubPedidoCliente) unsubPedidoCliente();
    unsubPedidoCliente = db.collection('pedidos').doc(pedidoId).onSnapshot(snap => {
      if(!snap.exists) return;
      const data = snap.data();
      if(data.estado === 'aceptado'){
        cancelarEspera();
        document.getElementById('modal-taxista').textContent = data.taxista_nombre || 'Taxista';
        document.getElementById('modal-placa').textContent = data.taxista_placa || '—';
        document.getElementById('modal-precio').textContent = '$'+(data.precio_acordado||7500).toLocaleString('es-CO');
        document.getElementById('modal-minutos').textContent = (data.minutos_llegada||5)+' minutos';
        document.getElementById('modal-acepto').classList.add('show');
        if(navigator.vibrate) navigator.vibrate([300,100,300]);
        if(unsubPedidoCliente){ unsubPedidoCliente(); unsubPedidoCliente = null; }
      }
    });
  }

  function cerrarModal() {
    document.getElementById('modal-acepto').classList.remove('show');
  }

  // CARGAR TAXISTAS EN TIEMPO REAL
  function cargarTaxistas() {
    const list = document.getElementById('taxistas-list');
    if(!list) return;
    if(unsubTaxistas) unsubTaxistas();
    unsubTaxistas = db.collection('taxistas').where('disponible','==',true).onSnapshot(snap => {
      if(snap.empty){ list.innerHTML='<div class="loading">No hay taxistas disponibles ahora</div>'; return; }
      list.innerHTML = snap.docs.map(d => {
        const t = d.data();
        const ini = (t.nombre[0]||'')+(t.apellido?t.apellido[0]:'');
        return '<div class="driver-card"><div class="d-av">'+ini+'</div><div class="d-info"><div class="d-name">'+t.nombre+' '+(t.apellido||'')+'</div><div class="d-zone">'+( t.paradero||'')+' · '+(t.placa||'')+' · '+(t.tipo==='intermunicipal'?'Intermunicipal':'Local/Expreso')+'</div></div><div class="d-badge bon"><span class="dot"></span>Libre</div></div>';
      }).join('');
    });
  }

  // CARGAR PEDIDOS EN TIEMPO REAL
  function cargarPedidos() {
    const list = document.getElementById('pedidos-list');
    if(!list) return;
    list.innerHTML = '<div class="loading">Conectando...</div>';
    if(unsubPedidos) unsubPedidos();
    unsubPedidos = db.collection('pedidos').where('estado','==','pendiente').orderBy('fecha','desc').onSnapshot(snap => {
      document.getElementById('tx-pendientes').textContent = snap.size;
      if(snap.empty){ list.innerHTML='<div style="text-align:center;padding:2rem"><i class="ti ti-clock" style="font-size:32px;color:var(--muted);display:block;margin-bottom:8px"></i><div style="font-size:13px;color:var(--muted)">Sin solicitudes ahora</div></div>'; return; }
      list.innerHTML = snap.docs.map(d => {
        const p = d.data();
        return '<div class="pedido-card" id="pc-'+d.id+'">'+
          '<div class="pedido-cliente">Cliente: '+(p.cliente_nombre||'Anonimo')+'</div>'+
          '<div class="pedido-lugar">'+p.origen+'</div>'+
          '<div class="pedido-meta">'+
            '<span class="tag">→ '+(p.destino||'Sin especificar')+'</span>'+
            '<span class="tag">'+p.tipo+'</span>'+
            '<span class="tag amber">Ahora</span>'+
          '</div>'+
          '<div class="price-row"><span class="price-label">Precio $</span>'+
            '<input class="price-input" type="number" id="precio-'+d.id+'" value="7500" min="7500"/>'+
            '<span style="font-size:12px;color:var(--muted)">COP</span></div>'+
          '<div class="price-hint">Minimo $7.500 — ajusta segun el trayecto</div>'+
          '<div class="price-row"><span class="price-label">Llego en</span>'+
            '<input class="price-input" type="number" id="minutos-'+d.id+'" value="5" min="1" style="max-width:70px"/>'+
            '<span style="font-size:12px;color:var(--muted)">min</span></div>'+
          '<div class="btn-row">'+
            '<button class="btn-take" onclick="tomarServicio(\''+d.id+'\')">Tomar servicio</button>'+
            '<button class="btn-skip" onclick="skipServicio(\''+d.id+'\')">No puedo</button>'+
          '</div></div>';
      }).join('');
    }, err => {
      list.innerHTML = '<div class="loading">Error: '+err.message+'</div>';
    });
  }

  // TOMAR SERVICIO
  async function tomarServicio(id) {
    if(!currentUser || currentUser.rol !== 'driver'){ showToastTx('Solo taxistas pueden tomar servicios.'); return; }
    const precio = parseInt(document.getElementById('precio-'+id)?.value || '7500');
    const minutos = parseInt(document.getElementById('minutos-'+id)?.value || '5');
    const precioFinal = Math.max(7500, precio);
    try {
      await db.collection('pedidos').doc(id).update({
        estado: 'aceptado',
        taxista_id: currentUser.telefono || '',
        taxista_nombre: currentUser.nombre+' '+(currentUser.apellido||''),
        taxista_placa: currentUser.placa || '',
        precio_acordado: precioFinal,
        minutos_llegada: minutos
      });
      const s = parseInt(document.getElementById('tx-servicios').textContent)||0;
      document.getElementById('tx-servicios').textContent = s+1;
      showToastTx('Servicio tomado! El cliente fue notificado.');
      // Notificar por WhatsApp si el pedido es de ese canal
      const pedDoc = await db.collection('pedidos').doc(id).get();
      const pedData = pedDoc.data();
      if(pedData && pedData.canal === 'whatsapp' && pedData.cliente_telefono){
        fetch('https://wazzi-bot-production.up.railway.app/notificar-cliente', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            cliente_telefono: pedData.cliente_telefono,
            taxista_nombre: currentUser.nombre+' '+(currentUser.apellido||''),
            placa: currentUser.placa||'',
            taxista_telefono: currentUser.telefono||'',
            precio: precioFinal,
            minutos
          })
        }).catch(e => console.log('WhatsApp notify error:', e));
      }
    } catch(e){ showToastTx('Error: '+e.message); }
  }

  function skipServicio(id) {
    const el = document.getElementById('pc-'+id);
    if(el) el.style.display='none';
  }

  function toggleStatus() {
    statusOn = !statusOn;
    document.getElementById('toggle-st').classList.toggle('off', !statusOn);
    document.getElementById('disp-sub').textContent = statusOn ? 'Activo — los clientes te ven' : 'Pausado — no apareces en la app';
    showToastTx(statusOn ? 'Estas disponible.' : 'Pausaste tu disponibilidad.');
  }

  // NEGOCIOS
  function openBiz(i) {
    const d = bizData[i];
    const items = d.items.map(it => '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:0.5px solid var(--border)"><div><div style="font-size:13px;color:var(--txt)">'+it.n+'</div><div style="font-size:11px;color:var(--muted);margin-top:1px">'+it.d+'</div></div><div style="font-size:14px;font-weight:500;color:var(--pk);flex-shrink:0;margin-left:12px">'+it.p+'</div></div>').join('');
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:flex-end;justify-content:center;z-index:9999';
    overlay.innerHTML = '<div style="background:var(--surface);border-radius:24px 24px 0 0;padding:24px;width:100%;max-width:390px;max-height:80vh;overflow-y:auto"><div style="font-family:Syne,sans-serif;font-size:20px;font-weight:800;color:var(--txt);margin-bottom:4px">'+d.name+'</div><div style="font-size:12px;color:var(--muted);margin-bottom:16px">'+d.type+'</div>'+items+'<button onclick="this.closest(\'[style*=fixed]\').remove()" style="width:100%;padding:12px;margin-top:16px;background:var(--card);border:0.5px solid var(--border);color:var(--muted);border-radius:10px;font-size:13px;cursor:pointer">Cerrar</button></div>';
    document.body.appendChild(overlay);
  }

  // LOGOUT
  function logout() {
    currentUser = null;
    if(unsubPedidos){ unsubPedidos(); unsubPedidos = null; }
    if(unsubTaxistas){ unsubTaxistas(); unsubTaxistas = null; }
    if(unsubPedidoCliente){ unsubPedidoCliente(); unsubPedidoCliente = null; }
    goto('s-onboarding');
  }

  // TOAST HELPERS
  function showToast(id, msg, tipo) {
    const t = document.getElementById(id);
    const sp = document.getElementById(id+'-msg');
    if(sp) sp.textContent = msg; else if(t) t.innerHTML = '<i class="ti ti-alert-circle"></i> '+msg;
    if(t){ t.classList.toggle('error', tipo==='error'); t.classList.add('show'); setTimeout(()=>{ t.classList.remove('show'); t.classList.remove('error'); },3500); }
  }
  function showToastCli(msg){ showToast('toast-cli', msg, ''); }
  function showToastTx(msg){ showToast('toast-tx', msg, ''); }
</script>
</body>
</html>
