import {initializeApp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {getFirestore,collection,onSnapshot,query,orderBy,limit} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {FIREBASE_CONFIG,COLLECTION,READING_LIMIT} from "./config.js";

const $=id=>document.getElementById(id);
const demo=[
{name:"Forward Base 1",loc:"Ladakh · Sector Alpha",inTemp:12.4,outTemp:-8.7,hin:42,hout:76,pin:81.2,pout:68.5,solar:420,solarMode:"MPP",uv:3.2,battery:78},
{name:"Forward Base 2",loc:"Ladakh · Sector Bravo",inTemp:14.8,outTemp:-10.2,hin:38,hout:71,pin:82.6,pout:69.8,solar:385,solarMode:"PWM",uv:2.8,battery:72},
{name:"Forward Base 3",loc:"Ladakh · Sector Charlie",inTemp:11.6,outTemp:-12.4,hin:45,hout:80,pin:80.9,pout:67.3,solar:460,solarMode:"MPP",uv:3.6,battery:85},
{name:"Forward Base 4",loc:"Ladakh · Sector Delta",inTemp:13.2,outTemp:-9.8,hin:41,hout:75,pin:81.7,pout:68.9,solar:410,solarMode:"MPP",uv:3.1,battery:76},
{name:"Forward Base 5",loc:"Ladakh · Sector Echo",inTemp:15.1,outTemp:-11.3,hin:37,hout:69,pin:83.4,pout:70.6,solar:445,solarMode:"MPP",uv:2.9,battery:81},
{name:"Forward Base 6",loc:"Ladakh · Sector Foxtrot",inTemp:10.9,outTemp:-14.1,hin:48,hout:82,pin:79.8,pout:66.7,solar:372,solarMode:"MPP",uv:2.5,battery:68}
];
let bases=demo.map((x,i)=>({...x,id:`base${i+1}`}));let firebaseLive=false;
function fmt(v){return Number.isFinite(Number(v))?Number(v).toFixed(1):"—"}
function status(b){return b.battery<25||b.outTemp<=-30?'crit':b.battery<45||b.outTemp<=-24?'warn':'ok'}
function card(b){return `<article class="base-card" data-id="${b.id}"><div class="base-head"><div><div class="base-name">${b.name}</div><span class="status">Online</span></div><span class="arrow">→</span></div><div class="metric-row"><div class="metric"><span>♨ Temp IN</span><b>${fmt(b.inTemp)}°C</b></div><div class="metric"><span>♨ Temp OUT</span><b>${fmt(b.outTemp)}°C</b></div><div class="metric"><span>💧 Humidity IN</span><b>${b.hin}%</b></div><div class="metric"><span>💧 Humidity OUT</span><b>${b.hout}%</b></div></div><div class="wide-row"><div class="metric"><span>◌ Pressure IN</span><b>${fmt(b.pin)} kPa</b></div><div class="metric"><span>◌ Pressure OUT</span><b>${fmt(b.pout)} kPa</b></div></div><div class="bottom-row"><div class="metric"><span>☀ Solar Power</span><b>${b.solar} W (${b.solarMode})</b></div><div class="metric"><span>▣ Battery</span><b>${b.battery}%</b></div><div class="metric"><span>☼ UV</span><b>${fmt(b.uv)} mW/cm²</b></div></div><div class="card-footer">Last Update: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div></article>`}
function render(){
 $('baseGrid').innerHTML=bases.map(card).join('');document.querySelectorAll('.base-card').forEach(c=>c.onclick=()=>openDetail(bases.find(b=>b.id===c.dataset.id)));
 const avg=k=>bases.reduce((a,b)=>a+Number(b[k]||0),0)/bases.length;const health=Math.round(avg('battery'));$('activeBases').textContent=bases.length;$('systemHealth').textContent=health>=60?'Good':'Attention';$('lastUpdate').textContent=firebaseLive?'Live':'Demo';
}
function openMasterDetails(){
 const old=document.getElementById('masterDetailOverlay'); if(old)old.remove();
 const avg=k=>bases.reduce((a,b)=>a+Number(b[k]||0),0)/Math.max(bases.length,1);
 const min=k=>Math.min(...bases.map(b=>Number(b[k]||0)));
 const max=k=>Math.max(...bases.map(b=>Number(b[k]||0)));
 const data={tempIn:avg('inTemp'),tempOut:avg('outTemp'),hin:avg('hin'),hout:avg('hout'),pin:avg('pin'),pout:avg('pout'),solar:avg('solar'),uv:avg('uv'),battery:avg('battery')};
 const online=bases.length;
 const critical=bases.filter(b=>status(b)==='crit').length;
 const warning=bases.filter(b=>status(b)==='warn').length;
 const healthy=online-critical-warning;
 const strongest=[...bases].sort((a,b)=>b.battery-a.battery)[0];
 const lowest=[...bases].sort((a,b)=>a.battery-b.battery)[0];
 const highestSolar=[...bases].sort((a,b)=>b.solar-a.solar)[0];
 const coldest=[...bases].sort((a,b)=>a.outTemp-b.outTemp)[0];
 const alerts=[];
 if(critical) alerts.push({c:'crit',t:`${critical} forward base${critical>1?'s':''} require critical attention.`});
 else if(warning) alerts.push({c:'warn',t:`${warning} forward base${warning>1?'s':''} currently need monitoring.`});
 else alerts.push({c:'ok',t:'All monitored forward bases are operating in the normal range.'});
 if(data.battery<50) alerts.push({c:'warn',t:`Master battery average is ${fmt(data.battery)}%. Plan a power check if the trend continues.`});
 else alerts.push({c:'ok',t:`Master battery reserve is ${fmt(data.battery)}% across the monitored network.`});
 if(data.tempOut<=-25) alerts.push({c:'crit',t:`Extreme cold: network outside-temperature average is ${fmt(data.tempOut)}°C.`});
 else alerts.push({c:'ok',t:`Cold-weather telemetry is stable. Network outside average: ${fmt(data.tempOut)}°C.`});
 if(data.hin>=70||data.hout>=85) alerts.push({c:'warn',t:'Condensation risk detected from elevated humidity. Inspect enclosure sealing/heating.'});
 else alerts.push({c:'ok',t:'Humidity levels are currently within the configured monitoring range.'});
 const div=document.createElement('div'); div.id='masterDetailOverlay'; div.className='master-detail-overlay';
 div.innerHTML=`<div class="master-detail-page master-enhanced">
  <div class="master-detail-head"><div><div class="master-kicker"></div></div><div class="master-head-actions"><span class="master-live"><i></i> ${firebaseLive?'FIREBASE LIVE':'DEMO DATA'}</span><button class="master-close" id="masterClose">✕ Close</button></div></div>
  <div class="master-overview master-overview-5">
   <div class="mini-stat"><span>Network Status</span><b class="good-text">${healthy}/${online} Healthy</b><small>${warning+critical} need attention</small></div>
   <div class="mini-stat"><span>Battery Average</span><b>${fmt(data.battery)}%</b><small>Lowest: ${lowest?.name||'—'} · ${fmt(lowest?.battery)}%</small></div>
   <div class="mini-stat"><span>Solar Generation</span><b>${fmt(data.solar)} W</b><small>Best: ${highestSolar?.name||'—'} · ${highestSolar?.solar||0} W</small></div>
   <div class="mini-stat"><span>Temperature Span</span><b>${fmt(min('outTemp'))}° → ${fmt(max('outTemp'))}°</b><small>Outside network range</small></div>
   <div class="mini-stat"><span>Last Sync</span><b>${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false})}</b><small>${firebaseLive?'Firebase Firestore':'Local demo data'}</small></div>
  </div>
  <div class="master-section-title"><div><h3> Master Node Detailes </h3></div><span class="range-pill"></span></div>
  <div class="master-sensors">
   <div class="master-sensor blue"><div class="ms-label">🌡 Temperature IN</div><div class="ms-value">${fmt(data.tempIn)}°C</div><div class="ms-unit">Average · ${fmt(min('inTemp'))}° to ${fmt(max('inTemp'))}°C</div></div>
   <div class="master-sensor blue"><div class="ms-label">🌡 Temperature OUT</div><div class="ms-value">${fmt(data.tempOut)}°C</div><div class="ms-unit">Average · ${fmt(min('outTemp'))}° to ${fmt(max('outTemp'))}°C</div></div>
   <div class="master-sensor green"><div class="ms-label">💧 Humidity IN</div><div class="ms-value">${fmt(data.hin)}%</div><div class="ms-unit">Average relative humidity</div></div>
   <div class="master-sensor green"><div class="ms-label">💧 Humidity OUT</div><div class="ms-value">${fmt(data.hout)}%</div><div class="ms-unit">Average relative humidity</div></div>
   <div class="master-sensor violet"><div class="ms-label">⛰ Pressure IN</div><div class="ms-value">${fmt(data.pin)}</div><div class="ms-unit">kPa · network average</div></div>
   <div class="master-sensor violet"><div class="ms-label">⛰ Pressure OUT</div><div class="ms-value">${fmt(data.pout)}</div><div class="ms-unit">kPa · network average</div></div>
   <div class="master-sensor orange"><div class="ms-label">☀ Solar Power</div><div class="ms-value">${fmt(data.solar)} W</div><div class="ms-unit">MPP/PWM network average</div></div>
   <div class="master-sensor orange"><div class="ms-label">☢ UV Radiation</div><div class="ms-value">${fmt(data.uv)}</div><div class="ms-unit">mW/cm² · network average</div></div>
   <div class="master-sensor green"><div class="ms-label">🔋 Battery Life</div><div class="ms-value">${fmt(data.battery)}%</div><div class="ms-unit">Average remaining capacity</div></div>
  </div>
  <div class="master-lower-grid">
   <section class="master-panel"><div class="panel-head"><div><h3>Forward Base Health Matrix</h3><p>Click a base to open its complete telemetry.</p></div></div><div class="base-health-grid">${bases.map(b=>`<button class="base-health ${status(b)}" data-base="${b.id}"><div><strong>${b.name.replace('Forward ','FB ')}</strong><span>${b.loc.replace('Ladakh · ','')}</span></div><div class="health-values"><b>${fmt(b.battery)}%</b><small>Battery</small></div><i>→</i></button>`).join('')}</div></section>
   <section class="master-panel"><div class="panel-head"><div><h3>Command Snapshot</h3><p>Key network extremes right now.</p></div></div><div class="snapshot-list"><div><span>🔋 Strongest battery</span><b>${strongest?.name||'—'} · ${fmt(strongest?.battery)}%</b></div><div><span>❄ Coldest outside</span><b>${coldest?.name||'—'} · ${fmt(coldest?.outTemp)}°C</b></div><div><span>☀ Highest solar</span><b>${highestSolar?.name||'—'} · ${highestSolar?.solar||0} W</b></div><div><span>📡 Data link</span><b>${firebaseLive?'Firebase Firestore · Live':'Local demo mode'}</b></div></div></section>
  </div>
  <div class="master-alerts"><div class="panel-head"><div><h3>System Status &amp; Alerts</h3><p>Prioritized checks for field personnel.</p></div><span class="alert-count ${critical?'danger':warning?'warning':''}">${critical?critical+' Critical':warning?warning+' Warning':'All Clear'}</span></div><div class="alert-list">${alerts.map(a=>`<div class="alert-item ${a.c}">${a.t}</div>`).join('')}</div></div>
  <div class="master-footer-note"><span>MASTER NODE</span><b>Central monitoring only — base-level details remain available from each Forward Base.</b></div>
 </div>`;
 document.body.appendChild(div);
 div.querySelector('#masterClose').onclick=()=>div.remove();
 div.addEventListener('click',e=>{if(e.target===div)div.remove()});
 div.querySelectorAll('.base-health').forEach(btn=>btn.onclick=()=>{const b=bases.find(x=>x.id===btn.dataset.base);div.remove();openDetail(b)});
}

function openDetail(b){if(!b)return;const old=document.getElementById('detailOverlay');if(old)old.remove();const div=document.createElement('div');div.id='detailOverlay';div.className='detail-overlay';div.innerHTML=`<div class="detail-page"><div class="detail-nav"><button class="back" id="back">← BACK TO MASTER NODE</button><strong style="color:#15915d;font-size:11px">● ONLINE</strong></div><div class="detail-title"><small style="color:#0878c9;font-weight:700">FORWARD BASE DETAIL · LIVE TELEMETRY</small><h2>${b.name}</h2><p>${b.loc} · Protective enclosure environmental status</p></div><div class="detail-grid"><div class="detail-card"><h3>ENVIRONMENTAL SENSORS</h3><div class="sensor-grid"><div class="sensor"><span>TEMPERATURE IN</span><b>${fmt(b.inTemp)}°</b><small>Celsius</small></div><div class="sensor"><span>TEMPERATURE OUT</span><b>${fmt(b.outTemp)}°</b><small>Celsius</small></div><div class="sensor"><span>HUMIDITY IN</span><b>${b.hin}%</b><small>RH</small></div><div class="sensor"><span>HUMIDITY OUT</span><b>${b.hout}%</b><small>RH</small></div><div class="sensor"><span>PRESSURE IN</span><b>${fmt(b.pin)}</b><small>kPa</small></div><div class="sensor"><span>PRESSURE OUT</span><b>${fmt(b.pout)}</b><small>kPa</small></div></div></div><div class="detail-card"><h3>POWER &amp; RADIATION</h3><div class="sensor-grid"><div class="sensor"><span>BATTERY LIFE</span><b>${b.battery}%</b><small>remaining</small></div><div class="sensor"><span>UV RADIATION</span><b>${fmt(b.uv)}</b><small>mW/cm²</small></div></div><div class="solar"><span style="font-size:9px;color:#7a8792">SOLAR POWER · ${b.solarMode}</span><div class="solar-value">${b.solar} W</div></div></div></div><div class="detail-foot"><div class="info"><span>BASE STATUS</span><b>ONLINE</b></div><div class="info"><span>DATA SOURCE</span><b>${firebaseLive?'Firebase Firestore':'Local demo data'}</b></div><div class="info"><span>LAST SYNC</span><b>${new Date().toLocaleTimeString('en-IN',{hour12:false})}</b></div></div></div>`;document.body.appendChild(div);div.querySelector('#back').onclick=()=>div.remove();div.addEventListener('click',e=>{if(e.target===div)div.remove()})}
function clock(){const d=new Date();$('clock').textContent=d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Kolkata'});$('date').textContent=d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'})}
setInterval(clock,1000);clock();render();
document.getElementById("masterDetailsBtn")?.addEventListener("click",openMasterDetails);
document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.getElementById(btn.dataset.scroll)?.scrollIntoView({behavior:'smooth',block:'start'})}));
function hasConfig(){return Object.values(FIREBASE_CONFIG).every(v=>typeof v==='string'&&v.trim())}
async function connectFirebase(){if(!hasConfig())return;try{const app=initializeApp(FIREBASE_CONFIG),db=getFirestore(app);onSnapshot(collection(db,COLLECTION),snap=>{const docs=snap.docs.map(d=>({id:d.id,...d.data()}));if(docs.length){bases=docs.slice(0,6).map((n,i)=>({...demo[i],...n,id:n.id||`base${i+1}`,name:n.name||`Forward Base ${i+1}`}));render();bases.forEach(b=>listenLatest(db,b))}firebaseLive=true;render()},console.error)}catch(e){console.error(e)}}
function listenLatest(db,b){const q=query(collection(db,`${COLLECTION}/${b.id}/readings`),orderBy('ts','desc'),limit(1));onSnapshot(q,s=>{if(!s.empty){const r=s.docs[0].data();Object.assign(b,{inTemp:r.tempIn??r.insideTemp??b.inTemp,outTemp:r.tempOut??r.outsideTemp??b.outTemp,hin:r.humidityIn??b.hin,hout:r.humidityOut??b.hout,pin:r.pressureIn??b.pin,pout:r.pressureOut??b.pout,solar:r.solarPower??r.powerSolar??b.solar,solarMode:r.solarMode??b.solarMode,uv:r.uv??r.uvIndex??b.uv,battery:r.battery??r.batteryLife??b.battery});render()}})}
connectFirebase();


/* ===== ColdGuard Battery History ===== */
(function(){
  const state = { histories:{}, selected:"master" };

  function batteryHistoryDemo(base){
    const now=Date.now();
    const seed={master:78,base1:82,base2:67,base3:91,base4:73,base5:61,base6:86}[base] || 78;
    return Array.from({length:24},(_,i)=>({
      ts: now-(23-i)*3600000,
      battery: Math.max(8, Math.min(100, seed - Math.sin(i/2.8)*3 - (23-i)*0.18))
    }));
  }

  function formatTime(ts){
    const d=new Date(ts);
    return {
      date:d.toLocaleDateString([], {day:"2-digit",month:"short"}),
      time:d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})
    };
  }

  function drawBatteryChart(points){
    const canvas=document.getElementById("batteryHistoryChart");
    const empty=document.getElementById("batteryChartEmpty");
    if(!canvas) return;
    const ctx=canvas.getContext("2d");
    const w=canvas.clientWidth||700, h=210, dpr=window.devicePixelRatio||1;
    canvas.width=w*dpr; canvas.height=h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);

    if(!points.length){ empty.style.display="flex"; return; }
    empty.style.display="none";

    const pad={l:38,r:16,t:16,b:30};
    const vals=points.map(p=>p.battery);
    const min=Math.max(0,Math.floor(Math.min(...vals)-5));
    const max=Math.min(100,Math.ceil(Math.max(...vals)+5));
    const x=i=>pad.l+(i/(Math.max(1,points.length-1)))*(w-pad.l-pad.r);
    const y=v=>pad.t+(max-v)/(max-min)*(h-pad.t-pad.b);

    ctx.font="11px system-ui";
    ctx.fillStyle="#8a999f";
    ctx.strokeStyle="#edf1f3";
    ctx.lineWidth=1;
    for(let g=0;g<=4;g++){
      const v=min+(max-min)*(g/4), yy=y(v);
      ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();
      ctx.fillText(Math.round(v)+"%",5,yy+4);
    }

    ctx.beginPath();
    points.forEach((p,i)=>{const xx=x(i),yy=y(p.battery);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});
    ctx.strokeStyle="#4c93a8";ctx.lineWidth=3;ctx.stroke();

    points.forEach((p,i)=>{
      ctx.beginPath();ctx.arc(x(i),y(p.battery),3.2,0,Math.PI*2);
      ctx.fillStyle="#fff";ctx.fill();ctx.strokeStyle="#4c93a8";ctx.lineWidth=2;ctx.stroke();
    });

    const last=points[points.length-1];
    ctx.fillStyle="#315866";ctx.font="700 12px system-ui";
    ctx.fillText(Math.round(last.battery)+"%", Math.min(w-pad.r-35,x(points.length-1)-12), Math.max(14,y(last.battery)-10));
  }

  function renderBatteryHistory(base){
    const points=(state.histories[base]||batteryHistoryDemo(base)).slice(-24).sort((a,b)=>a.ts-b.ts);
    const current=points[points.length-1];
    const yesterday=points[Math.max(0,points.length-2)];
    const first24=points[0];
    const low=Math.min(...points.map(p=>p.battery));

    const curEl=document.getElementById("batteryCurrent");
    const yEl=document.getElementById("batteryYesterday");
    const chEl=document.getElementById("battery24hChange");
    const lowEl=document.getElementById("battery7dLow");
    if(curEl)curEl.textContent=Math.round(current.battery)+"%";
    if(yEl)yEl.textContent=Math.round(yesterday.battery)+"%";
    if(chEl){
      const diff=current.battery-first24.battery;
      chEl.textContent=(diff>=0?"+":"")+diff.toFixed(1)+"%";
      chEl.className=diff>=0?"battery-trend-up":"battery-trend-down";
    }
    if(lowEl)lowEl.textContent=Math.round(low)+"%";
    const ct=document.getElementById("batteryCurrentTime");
    if(ct)ct.textContent="Last update "+formatTime(current.ts).time;

    const tbody=document.getElementById("batteryHistoryRows");
    if(tbody){
      tbody.innerHTML=points.slice().reverse().slice(0,10).map((p,i)=>{
        const prev=points[Math.max(0,points.indexOf(p)-1)];
        const diff=p.battery-prev.battery;
        return `<tr><td>${formatTime(p.ts).date}</td><td>${formatTime(p.ts).time}</td><td>${Math.round(p.battery)}%</td><td class="${diff>=0?'battery-trend-up':'battery-trend-down'}">${diff>=0?'+':''}${diff.toFixed(1)}%</td></tr>`;
      }).join("");
    }
    drawBatteryChart(points);
  }

  async function loadFirebaseBatteryHistory(base){
    try{
      if(typeof db==="undefined" || !db) return;
      if(typeof collection!=="function" || typeof getDocs!=="function") return;
      const ref=collection(db,"nodes",base==="master"?"master":base,"readings");
      const snap=await getDocs(ref);
      const arr=[];
      snap.forEach(doc=>{
        const d=doc.data()||{};
        const b=Number(d.battery);
        if(Number.isFinite(b)){
          let ts=d.ts;
          if(ts && typeof ts.toMillis==="function") ts=ts.toMillis();
          else if(typeof ts==="number" && ts<100000000000) ts*=1000;
          else ts=Date.now();
          arr.push({ts,battery:b});
        }
      });
      if(arr.length){state.histories[base]=arr;renderBatteryHistory(base);}
    }catch(e){
      console.warn("Battery history read skipped:",e);
    }
  }

  function initBatteryHistory(){
    const select=document.getElementById("batteryBaseSelect");
    if(!select) return;
    select.addEventListener("change",()=>{
      state.selected=select.value;
      renderBatteryHistory(state.selected);
      loadFirebaseBatteryHistory(state.selected);
    });
    renderBatteryHistory("master");
    ["master","base1","base2","base3","base4","base5","base6"].forEach(loadFirebaseBatteryHistory);
    window.addEventListener("resize",()=>renderBatteryHistory(state.selected));
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",initBatteryHistory);
  else initBatteryHistory();
})();
