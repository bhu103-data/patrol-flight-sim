/* PATROL orbital gateway: additive to the existing city renderers. */
(() => {
  'use strict';
  const isChongqing = location.pathname.endsWith('/chongqing.html');
  const allowed = new Set(['manhattan','dc','vegas','alaska','coast','valley','chongqing']);
  const form = document.getElementById('flightSetup');
  const menu = document.getElementById('titleOverlay');
  // Capture the classic script's asset folder, not the index page base URL.
  const nyModuleUrl = new URL('ny-cosmos.js',
    document.currentScript?.src || new URL('assets/cosmos/portal.js', document.baseURI)).href;
  const state = () => {
    const bridge = window.PatrolSpaceBridge?.getState?.();
    const chosen = form ? new FormData(form) : null;
    const map = bridge?.playing ? bridge.map : chosen?.get('flightMap');
    return {
      map: isChongqing ? 'chongqing' : allowed.has(map) ? map : 'manhattan',
      craft: bridge?.playing ? bridge.aircraft : chosen?.get('aircraft') || (isChongqing?'jetpack':'fighter'),
      playing: Boolean(bridge?.playing),
      altitude: Number(bridge?.altitude) || 0,
      climb: Number(bridge?.climb) || 0,
      position: bridge?.playing && Array.isArray(bridge?.position) ? bridge.position : null,
      yaw: Number(bridge?.yaw)||0,
      pitch: Number(bridge?.pitch)||0,
      speed: Number(bridge?.speed)||0,
      heading: Number(bridge?.heading)||0,
      avatarFlying: Boolean(bridge?.avatarFlying)
    };
  };
  let jumping=false,lastExitAt=-Infinity;
  window.addEventListener('patrol:orbitReturn',()=>{
    jumping=false;lastExitAt=performance.now();
  });
  function jumpToOrbit(){
    if(window.PatrolNYCosmos?.isActive?.()){
      window.PatrolNYCosmos.exit();return;
    }
    if(jumping || performance.now()-lastExitAt<1700)return;
    const flight=state();
    jumping=true;
    if(!isChongqing && flight.map==='manhattan'){
      if(flight.playing)window.PatrolSpaceBridge?.suspendForOrbit?.();
      import(nyModuleUrl).then(module=>module.enter(flight)).catch(error=>{
        jumping=false;
        console.error('Manhattan universe could not start:',error);
        button.title='Cosmos failed to load; check network or WebGL';
      });
      return;
    }
    // The existing behavior for non-NY maps is unchanged this round.
    try{sessionStorage.setItem('patrol.cosmos.lastLaunch',JSON.stringify(flight));}catch(_){}
    const next=new URL('./space.html',location.href);
    next.searchParams.set('from',flight.map);
    next.searchParams.set('craft',flight.craft);
    location.assign(next.href);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'cosmosLaunch';
  button.textContent = '🚀 ORBIT / 宇宙 [U]';
  button.title = 'Launch from this map into orbit, the solar system, and the Milky Way';
  button.addEventListener('click', jumpToOrbit);
  if (isChongqing) {
    Object.assign(button.style, {
      position:'absolute', right:'18px', top:'265px', zIndex:'6',
      padding:'8px 11px', border:'1px solid #93c8f6', borderRadius:'8px',
      background:'#142944e8', color:'#e5f5ff', font:'bold 12px system-ui', cursor:'pointer'
    });
    document.body.append(button);
  } else {
    button.style.cssText='padding:5px 9px;background:#193951;color:#e9f7ff;border:1px solid #82bbe2;cursor:pointer;font:inherit';
    (document.querySelector('#statusBar .bar-right') || document.body).prepend(button);
    const menuLaunch = button.cloneNode(true);
    menuLaunch.removeAttribute('id');
    menuLaunch.textContent = '🚀 EXPLORE SPACE / 宇宙';
    menuLaunch.style.cssText='width:100%;padding:9px;margin-top:8px;background:#193951;border:1px solid #82bbe2;color:#e9f7ff;cursor:pointer;font:inherit';
    menuLaunch.addEventListener('click', jumpToOrbit);
    document.getElementById('startFlight')?.insertAdjacentElement('afterend', menuLaunch);
  }
  window.addEventListener('patrol:orbitLaunch', jumpToOrbit);
  window.addEventListener('keydown', event => {
    if (event.code !== 'KeyU' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(event.target?.tagName || '')) return;
    event.preventDefault();
    jumpToOrbit();
  });
  // Manhattan has a 180-unit orbit gate; keep this observer alive after every return.
  window.setInterval(() => {
    if (jumping || document.hidden || !window.PatrolSpaceBridge) return;
    const f = state();
    if(!isChongqing && f.playing && f.map==='manhattan' && !window.PatrolNYCosmos?.isActive?.()){
      button.textContent=f.altitude>100
        ? '🚀 ORBIT '+Math.floor(Math.max(0,f.altitude))+'/180 [U]'
        : '🚀 ORBIT / 宇宙 [U]';
    }
    if (f.playing && f.climb > 0.4 &&
        (isChongqing ? f.altitude>650 : f.map==='manhattan'?f.altitude>=179.6:f.altitude>=99.6)) {
      // Keep watching after returning from orbit for subsequent ascents.
      jumpToOrbit();
    }
  }, 400);
  if (!isChongqing) {
    const params = new URLSearchParams(location.search);
    const map = params.get('returnSpace');
    const craft = params.get('craft');
    if (allowed.has(map) && map !== 'chongqing' && form && menu) {
      const mapInput = form.querySelector('input[name="flightMap"][value="' + map + '"]');
      const craftInput = form.querySelector('input[name="aircraft"][value="' + craft + '"]');
      if (mapInput) {
        mapInput.checked = true;
        if (craftInput) craftInput.checked = true;
        // Remove one-shot flags so refresh never launches without an explicit action.
        history.replaceState(null, '', location.pathname);
        // If orbit was opened from the title menu, return to the title menu;
        // automatically resume only a flight that actually existed.
        let previous=null;
        try{previous=JSON.parse(sessionStorage.getItem('patrol.cosmos.lastLaunch')||'null');}catch(_){}
        if(previous?.playing && previous.map===map)
          window.setTimeout(() => form.requestSubmit(), 0);
      }
    }
  }
})();
