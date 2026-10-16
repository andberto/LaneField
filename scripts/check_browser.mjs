// Local Chrome QA without npm dependencies. Start and stop only our own processes.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const qa = path.join(root, 'qa');
await mkdir(qa, { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), 'lane-field-chrome-'));
const server = spawn('python3', ['-m', 'http.server', '18483', '--bind', '127.0.0.1', '--directory', path.join(root, 'dist')], { stdio: 'ignore' });
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=18484', `--user-data-dir=${profile}`, '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
const failures = [];
const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  if (!pass) failures.push(name);
};
try {
  let targets;
  for (let i = 0; i < 80; i++) {
    try { targets = await (await fetch('http://127.0.0.1:18484/json')).json(); if (targets.length) break; } catch {}
    await pause(150);
  }
  if (!targets) throw new Error('Chrome debugging endpoint did not start');
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let nextId = 0;
  const pending = new Map();
  const runtimeErrors = [];
  const networkFailures = [];
  const requests = [];
  const navigationRequests = [];
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id); pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message)); else resolve(data.result);
    }
    if (data.method === 'Runtime.exceptionThrown') runtimeErrors.push(data.params.exceptionDetails.text);
    if (data.method === 'Network.responseReceived' && data.params.response.status >= 400) networkFailures.push(data.params.response.url);
    if (data.method === 'Network.requestWillBeSent') requests.push(data.params.request.url);
    if (data.method === 'Page.frameRequestedNavigation') navigationRequests.push(data.params.url);
  });
  function cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression, userGesture = false) {
    const response = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
  async function screenshot(file, fullPage = false) {
    const params = { format: 'png', captureBeyondViewport: fullPage };
    if (fullPage) {
      const metrics = await cdp('Page.getLayoutMetrics');
      params.clip = { x: 0, y: 0, width: metrics.cssContentSize.width, height: metrics.cssContentSize.height, scale: 1 };
    }
    const result = await cdp('Page.captureScreenshot', params);
    await writeFile(path.join(qa, file), Buffer.from(result.data, 'base64'));
  }
  async function dragRange(id, to, touch = false, drift = 0) {
    await evaluate(`document.getElementById('${id}').scrollIntoView({behavior:'instant',block:'center'})`);
    const r = await evaluate(`(()=>{const el=document.getElementById('${id}'),r=el.getBoundingClientRect(),thumb=parseFloat(getComputedStyle(el).getPropertyValue('--range-thumb'))||20;return {x:r.x+thumb/2,y:r.y+r.height/2,width:r.width-thumb,ratio:(el.value-el.min)/(el.max-el.min)};})()`);
    const start = { x:r.x+r.width*r.ratio,y:r.y };
    if (touch) await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
    else await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...start,button:'left',clickCount:1});
    for (let i=1;i<=8;i++) {
      const point={x:r.x+r.width*(r.ratio+(to-r.ratio)*i/8),y:r.y+drift*i/8};
      if (touch) await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});
      else await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...point,buttons:1});
    }
    if (touch) await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    else await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x+r.width*to,y:r.y+drift,button:'left',clickCount:1});
    return evaluate(`Number(document.getElementById('${id}').value)`);
  }
  async function dragMap(from, to, touch = false) {
    await evaluate('document.querySelector("#field-canvas").scrollIntoView({behavior:"instant",block:"center"})');
    const r=await evaluate('(()=>{const r=document.querySelector("#field-canvas").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()');
    const screen=p=>({x:r.x+(p[0]+14)/28*r.width,y:r.y+(9-p[1])/18*r.height});
    if(touch) await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[screen(from)]});
    else await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...screen(from),button:'left',clickCount:1});
    for(let i=1;i<=6;i++) {
      const point=screen(from.map((v,j)=>v+(to[j]-v)*i/6));
      if(touch) await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});
      else await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...point,buttons:1});
    }
    if(touch) await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    else await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...screen(to),button:'left',clickCount:1});
  }
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
  await cdp('Emulation.setFocusEmulationEnabled', {enabled:true});
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: 'http://127.0.0.1:18483/' });
  for (let i = 0; i < 50; i++) { if (await evaluate('document.readyState === "complete"')) break; await pause(100); }
  await evaluate('document.fonts.ready.then(() => true)'); await pause(350);
  check('No eager video downloads', !requests.some(url => url.endsWith('.mp4')), requests.filter(url => url.endsWith('.mp4')));
  check('Self-hosted font loaded', await evaluate('document.fonts.check("500 16px Manrope")'));
  check('All images decode', await evaluate('Promise.all([...document.images].filter(image => image.hasAttribute("src")).map(image => { image.loading="eager"; return image.decode().then(() => true).catch(() => false); })).then(values => values.every(Boolean))'));
  await screenshot('desktop.png');
  const total = await evaluate('document.documentElement.scrollHeight');
  for (let y = 0; y < total; y += 700) { await evaluate(`window.scrollTo({top:${y},behavior:'instant'})`); await pause(110); }
  await pause(800); await evaluate("window.scrollTo({top:0,behavior:'instant'})");
  await screenshot('desktop-full.png', true);
  check('Eight author names without profile links', await evaluate('document.querySelectorAll(".authors .author").length === 8 && document.querySelectorAll(".authors a").length === 0'));
  check('Updated Bologna and VisLab affiliation labels', await evaluate('document.querySelector("#affiliation-bologna").textContent.trim()==="2 University of Bologna" && document.querySelector("#affiliation-ambarella").textContent.includes("VisLab, an Ambarella Inc. company") && document.querySelector(".unibo-logo").naturalWidth > 0'));
  check('Bertozzi is affiliated only with Parma; MUNER is removed',await evaluate('[...document.querySelectorAll(".author")].find(el=>el.textContent.includes("Massimo Bertozzi")).querySelector("sup").textContent==="1" && !document.querySelector("#affiliation-muner, .muner-logo")'));
  check('The map has no movement-target selector',await evaluate('!document.querySelector("#lab-edit-target") && !document.querySelector("#field-lab select")'));
  check('Draft PDF downloads and metadata removed', await evaluate('[...document.links].every(a => !a.getAttribute("href").includes("assets/papers/")) && !document.querySelector("meta[name=citation_pdf_url]")'));
  check('Full abstract visible without disclosure', await evaluate('document.querySelector(".abstract-text").textContent.includes("High-definition maps") && !document.querySelector(".abstract-text").closest("details")'));
  check('Analytic construction precedes the spread-factor comparison', await evaluate('!!(document.querySelector("#field-lab").compareDocumentPosition(document.querySelector(".spread-comparison-title")) & Node.DOCUMENT_POSITION_FOLLOWING) && !document.querySelector("#field-lab").hidden'));
  check('Architecture details and secondary tables start compact', await evaluate('[...document.querySelectorAll(".method-detail, .result-detail, .construction-derivation")].every(details => !details.open)'));
  for (let stage = 0; stage < 4; stage++) {
    await evaluate(`document.querySelector('#lab-tab-${stage}').click(); document.querySelector('#field-lab').scrollIntoView({behavior:'instant',block:'center'});`);
    check(`Construction step ${stage + 1} reveals its matching panel`, await evaluate(`document.querySelector('#lab-tab-${stage}').getAttribute('aria-selected') === 'true' && !document.querySelector('#lab-panel-${stage}').hidden && document.querySelectorAll('#field-lab [role=tabpanel]:not([hidden])').length === 1`));
    await screenshot(`field-lab-step-${stage + 1}.png`);
  }
  await evaluate('document.querySelector("#lab-tab-1").click(); document.querySelector("#kernel-t").value=".8"; document.querySelector("#kernel-t").dispatchEvent(new Event("input",{bubbles:true}));');
  check('Integration slider updates q(t) and the graph marker', await evaluate('document.querySelector("#kernel-t-value").textContent==="0.80" && Number(document.querySelector("#kernel-marker").getAttribute("x1"))===224'));
  check('Integration slider follows a real mouse drag', (await dragRange('kernel-t', .2)) < .25);
  check('Slider keeps capture outside the track and reaches its end', (await dragRange('kernel-t', 1.1)) === 1);
  await evaluate('document.querySelector("#kernel-t").focus()');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
  check('Integration slider keeps native keyboard support',await evaluate('document.querySelector("#kernel-t-value").textContent==="0.99"'));
  const angle=await dragRange('segment-angle', .625);
  check('Angle slider rotates geometry with a real mouse drag',Math.abs(angle-45)<=1,angle);
  const length=await dragRange('segment-length', .5);
  check('Length slider resizes the selected segment',length>10 && length<13 && await evaluate('document.querySelector("#segment-length-value").textContent.includes(document.querySelector("#segment-length").value)'),length);
  await evaluate('document.querySelector("#geometry-reset").click();');
  await evaluate('document.querySelector("#kernel-t").value=".5"; document.querySelector("#kernel-t").dispatchEvent(new Event("input"));');
  await dragMap([0,0],[5,0]);
  check('q(t) can be dragged directly without moving geometry',await evaluate('document.querySelector("#kernel-t-value").textContent==="0.75" && document.querySelector("#segment-points").textContent.includes("A (-10.0, 0.0) · B (10.0, 0.0)")'));
  await dragMap([-10,0],[-7,-3]);
  check('Dragging endpoint A changes geometry and keeps B fixed',await evaluate('document.querySelector("#segment-points").textContent.includes("A (-7.0, -3.0) · B (10.0, 0.0)")'));
  await evaluate('document.querySelector("#geometry-reset").click()');
  await dragMap([-5,0],[-3,1.5]);
  check('Dragging a segment translates both endpoints',await evaluate('document.querySelector("#segment-points").textContent.includes("A (-8.0, 1.5) · B (12.0, 1.5)")'));
  await evaluate('document.querySelector("[name=lab-scene][value=bend]").click()');
  await dragMap([-4,-4],[-3,-2]);
  await evaluate('document.querySelectorAll("[name=lab-segment]")[1].click()');
  check('Shared bend endpoints remain connected after dragging',await evaluate('document.querySelector("#segment-points").textContent.includes("A (-3.0, -2.0)")'));
  check('Integration follows the selected segment instead of S1',await evaluate('document.querySelector("[data-selected-segment]").textContent==="S2" && document.querySelector("#field-legend").textContent.includes("S2") && Number(document.querySelector("#integral-value").textContent)>.1'));
  await evaluate('document.querySelector("#lab-tab-2").click(); document.querySelectorAll(".segment-contribution")[2].click()');
  check('Contribution rows select their segment',await evaluate('document.querySelector("#field-lab").dataset.segmentIndex==="2" && document.querySelectorAll("[name=lab-segment]")[2].checked'));
  await evaluate('document.querySelector("#lab-tab-3").click(); document.querySelector("[name=lab-scene][value=crossing]").click();');
  const crossing = await evaluate('[...document.querySelectorAll("[data-channel] output")].map(el=>Number(el.textContent))');
  check('Crossing has high proximity and nearly zero directional confidence', crossing[3] > .89 && crossing[4] < .001, crossing);
  await screenshot('field-lab-crossing.png');
  await dragMap([0,5],[0,5]);
  check('A segment can be selected directly on the map',await evaluate('document.querySelector("#field-lab").dataset.segmentIndex==="1"'));
  await evaluate('document.querySelector("#segment-enabled").click()');
  check('Removing one crossing segment recovers directional confidence',await evaluate('Number(document.querySelector("[data-channel]:last-child output").textContent)>.99 && Number(document.querySelector("[data-raw=proximity]").textContent)>4'));
  await evaluate('document.querySelectorAll("[name=lab-segment]")[0].click(); document.querySelector("#segment-enabled").click()');
  check('Disabling all segments produces five finite zero outputs',await evaluate('[...document.querySelectorAll("[data-channel] output")].every(el=>Number(el.textContent)===0)'));
  await evaluate('document.querySelector("#geometry-reset").click()');
  await evaluate('document.querySelector("#field-canvas").focus()');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  check('Map probe is keyboard accessible', await evaluate('document.querySelector("#probe-position").textContent.includes("(0.5, 0.0)") && document.querySelector("#lab-status").textContent.includes("Proximity")'));
  const probeBounds = await evaluate('(()=>{const r=document.querySelector("#field-canvas").getBoundingClientRect(); return {x:r.left+r.width*.78,y:r.top+r.height*(7/18)};})()');
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...probeBounds,button:'left',clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...probeBounds,button:'left',clickCount:1});
  check('Clicking the background updates the probe and recovers a dominant axis', await evaluate('document.querySelector("#probe-position").textContent.includes("(7.8, 2.0)") && Number(document.querySelector("[data-channel]:last-child output").textContent)>.9'));
  await evaluate('document.querySelector("#probe-reset").click()');
  check('Reset restores the crossing center', await evaluate('document.querySelector("#probe-position").textContent.includes("(0.0, 0.0)") && Number(document.querySelector("[data-channel]:last-child output").textContent)<.001'));
  await evaluate('document.querySelector("#field-canvas").focus()');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowUp',code:'ArrowUp',windowsVirtualKeyCode:38});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowUp',code:'ArrowUp',windowsVirtualKeyCode:38});
  check('Segment endpoints can also be moved with the keyboard',await evaluate('document.querySelector("#segment-points").textContent.includes("A (-10.0, 0.5)")'));
  await evaluate('document.querySelector("#geometry-reset").click()');
  await evaluate('document.querySelector("#lab-tab-0").focus()');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'End',code:'End',windowsVirtualKeyCode:35});
  check('Construction tabs support keyboard navigation', await evaluate('document.activeElement.id==="lab-tab-3" && document.querySelector("#lab-tab-3").getAttribute("aria-selected")==="true"'));
  await evaluate(`document.querySelector('.results-nav a[href="#component-ablation"]').click()`);
  check('Result deep links open their table disclosure', await evaluate('document.querySelector("#component-ablation").open'));
  await evaluate('document.querySelectorAll("details").forEach(el=>el.open=false); document.querySelector("[name=lab-scene][value=straight]").click(); document.querySelector("#lab-tab-0").click();');
  check('Both research videos available in the page', await evaluate('document.querySelectorAll("video").length === 2 && [...document.querySelectorAll("video")].every(video => video.controls && video.preload === "none")'));
  for (const id of ['research-video', 'field-video']) {
    const playback = await evaluate(`(async () => {
      const video=document.getElementById('${id}');
      video.scrollIntoView({behavior:'instant',block:'center'}); video.muted=true;
      try { await video.play(); await new Promise(resolve=>setTimeout(resolve,700)); const result={time:video.currentTime,width:video.videoWidth,error:video.error?.message}; video.pause();return result; } catch(error) { return {error:error.message}; }
    })()`,true);
    check(`${id} plays H.264 video`, playback.time>0 && playback.width>0 && !playback.error, playback);
  }
  await evaluate('document.querySelector(".architecture [data-zoom]").click()');
  check('Framework figure enlarges in accessible dialog',await evaluate('document.querySelector("#figure-dialog").open && document.querySelector("#figure-dialog").contains(document.activeElement)'));
  await screenshot('figure-expanded.png');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await pause(100);
  check('Escape closes figure and restores focus',await evaluate('!document.querySelector("#figure-dialog").open && document.activeElement.matches("[data-zoom]") && document.documentElement.style.overflow === ""'));
  check('Research placeholders replaced by original figures', await evaluate('!document.querySelector(".placeholder-art") && document.querySelectorAll("[data-media-slot]").length === 3 && document.querySelectorAll("[data-zoom]").length >= 30'));
  for (const group of ['spread', 'attention', 'attention-metrics', 'uncertainty']) {
    const switched = await evaluate(`(() => {
      const explorer = document.querySelector('[data-explorer="${group}"]');
      const details = explorer.closest('details'); if (details) details.open = true;
      const radios = [...explorer.querySelectorAll('input[type=radio]')];
      return radios.every(radio => {
        radio.click();
        const visible = [...explorer.querySelectorAll('[data-panel]')].filter(panel => !panel.hidden);
        return radio.checked && visible.length === 1 && visible[0].dataset.panel === radio.value && [...visible[0].querySelectorAll('img')].every(image => image.naturalWidth > 0);
      });
    })()`);
    check(`${group} switches between the supplied figure panels`, switched);
  }
  await evaluate("document.querySelector('[data-explorer=\"spread\"] input[value=\"025\"]').focus()");
  await cdp('Input.dispatchKeyEvent', {type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await cdp('Input.dispatchKeyEvent', {type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  check('Figure selectors work with the keyboard', await evaluate("document.querySelector('[data-explorer=\"spread\"] input[value=\"050\"]').checked && !document.querySelector(\"#spread-050\").hidden"));
  await evaluate("document.querySelector('[data-explorer=\"uncertainty\"] [data-panel]:not([hidden]) [data-zoom]').click()");
  check('Viewer opens the selected full-size figure and its caption', await evaluate("document.querySelector(\"#figure-dialog-image\").src === document.querySelector('[data-explorer=\"uncertainty\"] [data-panel]:not([hidden]) [data-zoom]').href && document.querySelector(\"#figure-dialog-caption\").textContent.includes(\"Ambiguous free space\") && document.querySelector(\"#figure-original\").href === document.querySelector(\"#figure-dialog-image\").src"));
  await evaluate('document.querySelector("#figure-dialog-image").decode()');
  await screenshot('visualization-expanded.png');
  await evaluate('new Promise(resolve => { document.querySelector("#figure-dialog").addEventListener("close", () => resolve(true), {once:true}); document.querySelector("#close-figure").click(); })');
  check('Viewer restores focus to the selected figure', await evaluate("document.activeElement.matches('[data-explorer=\"uncertainty\"] [data-zoom]') && document.documentElement.style.overflow === \"\""));
  await evaluate("document.querySelectorAll(\"details\").forEach(details => { details.open = false; }); document.querySelector('[data-explorer=\"attention\"] input[value=\"road\"]').click(); document.querySelector('[data-explorer=\"uncertainty\"] input[value=\"driveway\"]').click();");
  await evaluate('document.querySelector("#gaussian-spread").scrollIntoView({behavior:"instant"})');
  await screenshot('visualizations-desktop.png');
  check('BibTeX empty with copying disabled', await evaluate('document.querySelector("#bibtex").textContent.trim() === "" && document.querySelector("#copy-citation").disabled'));
  check('Empty form fails validation', await evaluate('!document.querySelector("#contact-form").checkValidity()'));
  check('Contact address is absent from the initial DOM and email links',await evaluate('!document.documentElement.outerHTML.includes(decodeContactRecipient()) && [...document.links].every(link => !link.href.startsWith("mailto:"))'));
  await evaluate(`document.querySelector('#name').value='Research Test';document.querySelector('#email').value='test@example.org';document.querySelector('#message').value='A local QA draft with reserved characters & plus + and a question?';document.querySelector('#topic').value='Research collaboration';document.querySelector('#contact-form').requestSubmit();`,true);
  await pause(100);
  const draft = navigationRequests.findLast(url => url.startsWith('mailto:'));
  const draftURL = draft ? new URL(draft) : null;
  const expectedRecipient = Buffer.from('616e647265612e626572746f67616c6c6940756e6970722e6974','hex').toString();
  check('Contact opens a correctly encoded draft after submission', draftURL?.pathname === expectedRecipient && draftURL.searchParams.get('body').includes('characters & plus + and a question?') && draftURL.searchParams.get('subject').includes('Research collaboration'));
  const draftCount = navigationRequests.length;
  await evaluate('document.querySelector("#form-status button").click()',true);
  await pause(100);
  check('Retry opens the draft without exposing the address in the DOM',navigationRequests.length>draftCount && await evaluate('!document.documentElement.outerHTML.includes(decodeContactRecipient()) && [...document.links].every(link => !link.href.startsWith("mailto:"))'));
  check('Contact does not falsely claim delivery', await evaluate('document.querySelector("#form-status").textContent.includes("ready to send")'));
  for (const width of [1440, 1024, 768, 390, 320]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 761 });
    await evaluate("window.scrollTo({top:0,behavior:'instant'})"); await pause(180);
    const layout = await evaluate('({viewport:window.innerWidth,document:document.documentElement.scrollWidth})');
    check(`No page overflow at ${width}px`, layout.document <= width, layout);
    if (width === 390) {
      await screenshot('mobile.png');
      await evaluate('document.querySelector("#lab-tab-3").click(); document.querySelector("[name=lab-scene][value=crossing]").click(); document.querySelector("#field-lab").scrollIntoView({behavior:"instant"});');
      await screenshot('field-lab-mobile.png');
      check('Interactive map preserves its coordinate aspect ratio on mobile',await evaluate('(()=>{const r=document.querySelector("#field-canvas").getBoundingClientRect(); return Math.abs(r.width/r.height-28/18)<.02;})()'));
      await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
      await evaluate('document.querySelector("#lab-tab-1").click(); document.querySelector("[name=lab-scene][value=bend]").click(); document.querySelectorAll("[name=lab-segment]")[2].click();');
      check('Integration slider follows touch after changing scene, segment and tab',Math.abs((await dragRange('kernel-t',.15,true,14))-.15)<.03);
      check('Angle slider follows touch with vertical finger drift',Math.abs((await dragRange('segment-angle',.55,true,14))-18)<2);
      const touchLength=await dragRange('segment-length',.35,true,14);
      check('Length slider follows touch and keeps valid outputs',touchLength>1 && touchLength<12 && await evaluate('[...document.querySelectorAll("[data-channel] output")].every(el=>Number.isFinite(Number(el.textContent)))'));
      await evaluate('document.querySelector("[name=lab-scene][value=straight]").click();');
      await dragMap([-10,0],[-8,-2],true);
      check('Endpoint handles can be dragged on a touch screen',await evaluate('document.querySelector("#segment-points").textContent.includes("A (-8.0, -2.0)")'));
      await evaluate('document.querySelector("#geometry-reset").click(); document.querySelector("#kernel-t").value=".5"; document.querySelector("#kernel-t").dispatchEvent(new Event("input"));');
      await dragMap([0,0],[4,0],true);
      check('q(t) supports direct touch dragging',await evaluate('Math.abs(Number(document.querySelector("#kernel-t").value)-.7)<.02'));
      await evaluate('document.querySelector("#lab-tab-2").click(); document.querySelector("#field-lab").scrollIntoView({behavior:"instant"});');
      await screenshot('field-lab-segments-mobile.png');
      await cdp('Emulation.setTouchEmulationEnabled',{enabled:false});
      await evaluate('document.querySelector("#attention-analysis").scrollIntoView({behavior:"instant"})');
      await screenshot('visualizations-mobile.png');
      await evaluate("window.scrollTo({top:0,behavior:'instant'})");
      await evaluate('document.querySelector(".menu-toggle").click()');
      check('Mobile menu opens', await evaluate('!document.querySelector("#mobile-nav").hidden && document.querySelector(".menu-toggle").getAttribute("aria-expanded")==="true"'));
      await evaluate('document.querySelector("#mobile-nav a").click()');
      check('Mobile menu closes on navigation', await evaluate('document.querySelector("#mobile-nav").hidden'));
      await evaluate("window.scrollTo({top:0,behavior:'instant'})"); await pause(350);
      await screenshot('mobile-full.png', true);
    }
  }
  await cdp('Emulation.setEmulatedMedia', { features:[{name:'prefers-reduced-motion',value:'reduce'}] });
  check('Reduced-motion preference respected', await evaluate('getComputedStyle(document.documentElement).scrollBehavior === "auto"'));
  check('No JavaScript errors', runtimeErrors.length === 0, runtimeErrors);
  check('No failed network responses', networkFailures.length === 0, networkFailures);
  await cdp('Emulation.setScriptExecutionDisabled', {value:true});
  await cdp('Page.reload');
  await pause(500);
  check('Without JavaScript, all scientific panels and image links remain available', await evaluate('[...document.querySelectorAll("[data-panel]")].every(panel => !panel.hidden) && [...document.querySelectorAll(".explorer-controls")].every(controls => controls.hidden) && document.querySelectorAll("[data-zoom][href]").length >= 30'));
  check('Without JavaScript, analytic equations remain available', await evaluate('document.querySelector("#field-lab").hidden && document.querySelector(".construction-derivation math")!==null'));
  await cdp('Emulation.setScriptExecutionDisabled', {value:false});
  await writeFile(path.join(qa, 'report.json'), JSON.stringify(results, null, 2));
  console.log(`${results.length - failures.length}/${results.length} checks passed.`);
  if (failures.length) process.exitCode = 1;
} finally {
  socket?.close(); chrome.kill('SIGTERM'); server.kill('SIGTERM');
}
