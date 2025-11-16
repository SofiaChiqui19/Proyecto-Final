(function () {
  const EL = (tag, attrs={}, html='') => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v]) => (k==='class') ? e.className=v : e.setAttribute(k,v));
    if (html) e.innerHTML = html;
    return e;
  };

  async function getMe(){
    try{
      const r = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include'
      });
      const j = await r.json();
      return j.user || null;
    }
    catch{ return null; }
  }

  function buildLinks(user){
    const guest = [
      `<a href="/">Inicio</a>`,
      `<span class="divider">|</span>`,
      `<a href="/login.html">Iniciar sesión</a>`,
      `<span class="divider">|</span>`,
      `<a href="/register.html">Registrarse</a>`,
      `<a href="/register-company.html">Registrarse Empresa</a>`
    ];

    const userLinks = [
      `<a href="/">Inicio</a>`,
      `<span class="divider">|</span>`,
      `<a id="profileLink" href="/profile.html">Mi perfil</a>`,
      `<span class="divider">|</span>`,
      `<a id="appsLink" href="/applications.html">Mis postulaciones</a>`,
      `<span class="divider">|</span>`,
      `<button id="logoutBtn">Cerrar sesión</button>`
    ];

    const employerLinks = [
      `<a href="/">Inicio</a>`,
      `<span class="divider">|</span>`,
      `<a id="profileLink" href="/company-profile.html">Perfil empresa</a>`,
      `<span class="divider">|</span>`,
      `<a id="appsLink" href="/dashboard.html">Dashboard</a>`,
      `<span class="divider">|</span>`,
      `<button id="logoutBtn">Cerrar sesión</button>`
    ];

    if (!user) return guest.join('');
    if (user.role === 'USER') return userLinks.join('');
    if (user.role === 'EMPLOYER') return employerLinks.join('');
    return guest.join('');
  }

  function attachLogout(){
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;
    btn.onclick = async () => {
      try{
        await fetch('/api/auth/logout', { 
          method:'POST',
          credentials: 'include'
        });
      }catch{}

      location.href = '/';
    };
  }

  async function renderSiteChrome(){
    const header = document.getElementById('appHeader');
    const footer = document.getElementById('appFooter');

    const me = await getMe();

    if (header){
      header.classList.add('site-header');
      const wrap = EL('div', {class:'wrap container'});
      const brand = EL('a', {href:'/', class:'brand'}, `
        <img src="/img/logo.png" alt="Logo">
        <span>Portal Empleos</span>
      `);
      const right = EL('nav', {class:'nav', id:'userArea'}, `
        <span id="userName">${me ? `Hola, ${me.name || ''}` : ''}</span>
        <span class="divider">${me ? '|' : ''}</span>
        ${buildLinks(me)}
      `);
      wrap.appendChild(brand);
      wrap.appendChild(right);
      header.innerHTML = '';
      header.appendChild(wrap);
      attachLogout();
    }

    if (footer){
      footer.classList.add('site-footer');
      footer.innerHTML = `
        <div class="wrap container">
          <small>© ${new Date().getFullYear()} Portal Empleos • Corredor Ecológico Villavicencio Meta</small>
        </div>
      `;
    }
  }

  window.renderSiteChrome = renderSiteChrome;
  document.addEventListener('DOMContentLoaded', renderSiteChrome);
})();
