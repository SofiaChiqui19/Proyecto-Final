// frontend/js/main.js

// ===== Estado de UI =====
const state = {
  user: null,      // {id, name, role}
  q: '',           // término actual de búsqueda
  timer: null,     // debounce
  mode: 'all',     // 'all' | 'search'
  limit: 10,
  offset: 0,
  lastCount: 0     // cuántos trajo la última página
};

// ===== Utils =====
const $ = (sel) => document.querySelector(sel);
const money = (n) =>
  n == null || n === ''
    ? '—'
    : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n));
const snippet = (txt, max = 180) => {
  const s = String(txt || '');
  return s.length > max ? s.slice(0, max) + '…' : s;
};
const setJobsHTML = (html) => { const el = $('#job-list'); if (el) el.innerHTML = html; };
const showPager = (show) => { const p = $('#pager'); if (p) p.style.display = show ? 'block' : 'none'; };

// Placeholder para logos inexistentes (pon uno en /frontend/img/company-placeholder.png si quieres)
const PLACEHOLDER_LOGO = '/img/company-placeholder.png';

// ===== Sesión =====
async function fetchSession() {
  try {
    const r = await fetch('/api/auth/me', { method: 'GET' });
    const data = await r.json();
    state.user = data.user || null;
    renderUserArea();

    if (state.user?.role === 'USER') {
      await updateApplicationsCount();
    }
  } catch (e) {
    console.error('fetchSession error:', e);
  }
}

// Crea (si falta) y devuelve el anchor de perfil
function ensureProfileAnchor() {
  let a = $('#profileLink');
  if (!a) {
    const userArea = $('#userArea');
    if (userArea) {
      a = document.createElement('a');
      a.id = 'profileLink';
      a.style.marginLeft = '12px';
      a.style.display = 'none'; // por defecto oculto; se muestra según rol
      userArea.appendChild(a);
    }
  }
  return a;
}

function renderUserArea() {
  const userNameEl = $('#userName');
  const logoutBtn = $('#logoutBtn');
  const appsLink = $('#appsLink');
  const profileLink = ensureProfileAnchor();

  if (state.user) {
    if (userNameEl) userNameEl.textContent = `Hola, ${state.user.name || 'Usuario'}`;
    if (logoutBtn) logoutBtn.style.display = 'inline-block';

    if (appsLink) {
      // Link principal a la derecha del nombre
      if (state.user.role === 'USER') {
        appsLink.style.display = 'inline-block';
        appsLink.href = '/applications.html';
        appsLink.textContent = 'Mis postulaciones';
      } else {
        appsLink.style.display = 'inline-block';
        appsLink.href = '/dashboard.html';
        appsLink.textContent = 'Dashboard empresa';
      }
    }

    // Link de perfil según rol
    if (profileLink) {
      if (state.user.role === 'USER') {
        profileLink.style.display = 'inline-block';
        profileLink.href = '/profile.html';
        profileLink.textContent = 'Mi perfil';
      } else if (state.user.role === 'EMPLOYER') {
        profileLink.style.display = 'inline-block';
        profileLink.href = '/company-profile.html';
        profileLink.textContent = 'Perfil empresa';
      } else {
        // Otros roles, ocúltalo por ahora
        profileLink.style.display = 'none';
      }
    }
  } else {
    if (userNameEl) userNameEl.innerHTML = '<a href="/login.html">Iniciar sesión</a> | <a href="/register.html">Registrarse</a>';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (appsLink) appsLink.style.display = 'none';
    if (profileLink) profileLink.style.display = 'none';
  }

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
      localStorage.removeItem('user');
      location.reload();
    };
  }
}

async function updateApplicationsCount() {
  const appsLink = $('#appsLink');
  try {
    const r = await fetch('/api/applications/mine', { method: 'GET' });
    const data = await r.json();
    const list = Array.isArray(data.applications) ? data.applications : [];
    if (appsLink) appsLink.textContent = `Mis postulaciones (${list.length})`;
  } catch {
    if (appsLink) appsLink.textContent = 'Mis postulaciones';
  }
}

// ===== Listado de empleos =====
function jobCardHTML(j) {
  const canApply = state.user?.role === 'USER';
  const applyBtn = canApply
    ? `<button class="apply-btn" data-job="${j.id}" style="background:#1abc9c;color:#fff;border:none;border-radius:8px;padding:8px 10px;cursor:pointer;">Postularme</button>`
    : '';

  const created = j.created_at ? new Date(j.created_at).toLocaleDateString() : '';
  const logo = j.logo || PLACEHOLDER_LOGO;

  return `
    <article style="border:1px solid #eee;border-radius:12px;padding:14px;margin:10px 0;">
      <div style="display:flex; gap:12px; align-items:flex-start;">
        <img src="${logo}" alt="Logo ${j.company || ''}" onerror="this.src='${PLACEHOLDER_LOGO}'"
             style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid #eee;flex:0 0 auto;">
        <div style="flex:1 1 auto;">
          <h3 style="margin:0 0 6px">${j.title}</h3>
          <div style="color:#6c7a89;font-size:13px">${j.company} · ${j.location || '—'} ${created ? '· ' + created : ''}</div>
          <div style="margin:6px 0;color:#2c3e50;">${snippet(j.description)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <span style="background:#ecf0f1;border-radius:999px;padding:4px 10px;font-size:12px;">Salario: ${money(j.salary)}</span>
            <a class="detail-link" href="/job.html?id=${j.id}" data-job="${j.id}" style="background:#34495e;color:#fff;text-decoration:none;padding:8px 10px;border-radius:8px;">Ver detalle</a>
            ${applyBtn}
          </div>
        </div>
      </div>
    </article>
  `;
}

function bindApplyButtons() {
  document.querySelectorAll('.apply-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const jobId = Number(btn.getAttribute('data-job'));
      await applyToJob(jobId);
    });
  });
}
function bindDetailLinks() {
  document.querySelectorAll('.detail-link').forEach((a) => {
    a.addEventListener('click', () => { /* Hook opcional */ });
  });
}

// ===== Cargar listado general (paginado) =====
async function loadJobs() {
  state.mode = 'all';
  const params = new URLSearchParams({
    limit: String(state.limit),
    offset: String(state.offset)
  });

  setJobsHTML('Cargando...');
  try {
    const r = await fetch(`/api/jobs?${params.toString()}`);
    const data = await r.json();

    // ⚠️ Acepta array plano o { jobs: [] }
    const jobs = Array.isArray(data) ? data : (data.jobs || []);
    state.lastCount = jobs.length;

    if (!jobs.length) {
      setJobsHTML('<p style="text-align:center;color:#7f8c8d;">No hay ofertas por ahora.</p>');
      renderPager();
      return;
    }
    setJobsHTML(jobs.map(jobCardHTML).join(''));
    bindApplyButtons();
    bindDetailLinks();
    renderPager();
  } catch (e) {
    console.error('loadJobs error:', e);
    setJobsHTML('<p style="text-align:center;color:#e74c3c;">Error cargando empleos.</p>');
    renderPager();
  }
}

// ===== Búsqueda con paginación =====
async function searchJobs(q) {
  const term = (q || '').trim();
  if (term.length < 2) {
    state.mode = 'all';
    state.offset = 0;
    await loadJobs();
    return;
  }

  state.mode = 'search';
  setJobsHTML(`Buscando “${term}”…`);
  try {
    const params = new URLSearchParams({
      q: term,
      limit: String(state.limit),
      offset: String(state.offset)
    });
    const r = await fetch(`/api/jobs/search?${params.toString()}`);
    const data = await r.json();

    const jobs = Array.isArray(data) ? data : (data.jobs || []);
    state.lastCount = jobs.length;

    if (!jobs.length) {
      setJobsHTML(`<p style="text-align:center;color:#7f8c8d;">No se encontraron resultados para “${term}”.</p>`);
      renderPager();
      return;
    }

    setJobsHTML(jobs.map(jobCardHTML).join(''));
    bindApplyButtons();
    bindDetailLinks();
    renderPager();
  } catch (e) {
    console.error('searchJobs error:', e);
    setJobsHTML('<p style="text-align:center;color:#e74c3c;">Error buscando empleos.</p>');
    renderPager();
  }
}

// ===== Paginador (ambos modos) =====
function renderPager() {
  const pager = $('#pager');
  if (!pager) return;

  const start = state.offset + 1;
  const end = state.offset + state.lastCount;

  const prevDisabled = state.offset <= 0;
  const nextDisabled = state.lastCount < state.limit;

  const pageInfo = $('#pageInfo');
  if (pageInfo) pageInfo.textContent = state.lastCount ? `Mostrando ${start}–${end}` : 'Sin resultados';

  const prevBtn = $('#prevBtn');
  const nextBtn = $('#nextBtn');
  if (prevBtn) prevBtn.disabled = prevDisabled;
  if (nextBtn) nextBtn.disabled = nextDisabled;

  showPager(true);
}

function attachPagerHandlers() {
  const prevBtn = $('#prevBtn');
  const nextBtn = $('#nextBtn');
  if (!prevBtn || !nextBtn) return;

  prevBtn.addEventListener('click', async () => {
    state.offset = Math.max(0, state.offset - state.limit);
    if (state.mode === 'search') {
      await searchJobs(state.q);
    } else {
      await loadJobs();
    }
  });

  nextBtn.addEventListener('click', async () => {
    state.offset = state.offset + state.limit;
    if (state.mode === 'search') {
      await searchJobs(state.q);
    } else {
      await loadJobs();
    }
  });
}

// Debounce helper
function withDebounce(cb, ms = 400) {
  return (...args) => {
    clearTimeout(state.timer);
    state.timer = setTimeout(() => cb(...args), ms);
  };
}

// ===== Postular =====
async function applyToJob(jobId) {
  if (!state.user) {
    alert('Debes iniciar sesión para postularte.');
    location.href = `/login.html?next=${encodeURIComponent(`/job.html?id=${jobId}`)}`;
    return;
  }
  if (state.user.role !== 'USER') {
    alert('Solo usuarios (no empresas) pueden postularse.');
    return;
  }

  try {
    const r = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId }),
    });

    const json = await r.json();

    if (r.status === 409) {
      alert('Ya te postulaste a este empleo.');
      await updateApplicationsCount();
      return;
    }
    if (!r.ok) {
      alert(json.msg || json.error || 'Error al postularse.');
      return;
    }

    alert('¡Postulación enviada! ✅');
    await updateApplicationsCount();
  } catch (e) {
    console.error('applyToJob error:', e);
    alert('Error al postularse.');
  }
}

// ===== Bootstrap + eventos de buscador =====
(async function init() {
  await fetchSession(); // detecta sesión + pinta cabecera
  await loadJobs();     // listado inicial
  attachPagerHandlers();

  const qInput = $('#q');
  const searchBtn = $('#searchBtn');
  const clearBtn = $('#clearBtn');

  if (qInput && searchBtn && clearBtn) {
    // escribir → debounce
    qInput.addEventListener('input', withDebounce(() => {
      state.q = qInput.value;
      state.offset = 0; // primera página
      searchJobs(state.q);
    }, 400));

    // Enter
    qInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        state.q = qInput.value;
        state.offset = 0;
        searchJobs(state.q);
      }
    });

    // Clic buscar
    searchBtn.addEventListener('click', () => {
      state.q = qInput.value;
      state.offset = 0;
      searchJobs(state.q);
    });

    // Limpiar
    clearBtn.addEventListener('click', async () => {
      qInput.value = '';
      state.q = '';
      state.offset = 0;
      await loadJobs();
      showPager(true); // seguimos con paginador activo en modo "all"
      qInput.focus();
    });
  }
})();
