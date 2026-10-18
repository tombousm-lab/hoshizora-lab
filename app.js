'use strict';
(() => {
const $ = id => document.getElementById(id);
const PLACES={
  tokyo:{label:'東京',lat:35.6812,lon:139.7671},
  osaka:{label:'大阪',lat:34.6937,lon:135.5023},
  sapporo:{label:'札幌',lat:43.0618,lon:141.3545},
  okinawa:{label:'那覇',lat:26.2124,lon:127.6792},
  kyoto:{label:'京都',lat:35.0116,lon:135.7681},
  london:{label:'ロンドン',lat:51.5072,lon:-.1276},
  newyork:{label:'ニューヨーク',lat:40.7128,lon:-74.0060},
  sydney:{label:'シドニー',lat:-33.8688,lon:151.2093}
};
const FACTS=[
['星はどうして動くの？','地球が約24時間かけて自転するため、夜空の星は時間とともに東から西へ動いて見えます。'],
['北極星は真北の目印','北極星は天の北極のすぐ近くにあり、日本ではほとんど同じ位置に見えます。空での高さは観測地の緯度とほぼ同じです。'],
['明るさを示す「等級」','恒星の等級は数字が小さいほど明るく、1等級違うと明るさは約2.5倍変わります。シリウスは約−1.46等級です。'],
['夏の大三角','ベガ・アルタイル・デネブを結んだ三角形を「夏の大三角」と呼びます。夏から秋にかけて見つけやすい目印です。'],
['冬の大三角','シリウス・プロキオン・ベテルギウスを結ぶ大きな三角形。冬の夜空で星座を探すのに便利です。'],
['月の形が変わる理由','月が地球の周囲を公転し、太陽に照らされる半球のうち地球から見える割合が変わるためです。'],
['星座の線は誰が決めた？','星座を結ぶ線は文化や資料によって異なります。現在の天文学では国際天文学連合が88の星座の領域を定義しています。'],
['星と惑星の違い','恒星は自ら光を放ち、惑星は主に太陽の光を反射して見えます。惑星は星座を背景として日々少しずつ位置を変えます。']
];
const saveKey='hoshizora-settings-v1';
let stored={}; try{stored=JSON.parse(localStorage.getItem(saveKey)||'{}')}catch{}
const defaultDate=new Date(); if(defaultDate.getHours()<22){defaultDate.setHours(21,0,0,0)}else{defaultDate.setDate(defaultDate.getDate()+1);defaultDate.setHours(21,0,0,0)}
const state={place:PLACES[stored.place] ? stored.place:'tokyo',lat:Number.isFinite(stored.lat)?stored.lat:35.6812,lon:Number.isFinite(stored.lon)?stored.lon:139.7671,
  date:defaultDate,bearing:0,zoom:1,lines:stored.lines??true,labels:stored.labels??true,planets:stored.planets??true,grid:stored.grid??true,mag:stored.mag??5,playing:false,selected:null};
if(PLACES[state.place]){state.lat=PLACES[state.place].lat;state.lon=PLACES[state.place].lon}
const canvas=$('sky'),ctx=canvas.getContext('2d'); let vw=0,vh=0,dpr=1,cx=0,cy=0,R=0,hitTargets=[],raf=null,starsExpanded=[],bodiesCache=[],allStars=STARS.map(s=>({id:s[0],name:s[1],ra:s[2],dec:s[3],mag:s[4],color:s[5],known:true}));
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3100)}
function persist(){try{localStorage.setItem(saveKey,JSON.stringify({place:state.place,lat:state.lat,lon:state.lon,lines:state.lines,labels:state.labels,planets:state.planets,grid:state.grid,mag:state.mag}))}catch{}}
function pad(n){return String(n).padStart(2,'0')}
function dateLocal(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
function dateDisplay(d){return new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(d)}
function updateDateInput(){ $('date-time').value=dateLocal(state.date);$('view-time').textContent=dateDisplay(state.date);}
function coordText(){return `${Math.abs(state.lat).toFixed(2)}° ${state.lat>=0?'N':'S'} / ${Math.abs(state.lon).toFixed(2)}° ${state.lon>=0?'E':'W'}`}
function updateCoords(){ $('coords').textContent=coordText();$('lat-input').value=state.lat.toFixed(4);$('lon-input').value=state.lon.toFixed(4);$('top-location').textContent=PLACES[state.place]?.label || 'カスタム地点';$('city-select').value=state.place;}
function setPlace(id,lat,lon){state.place=id;state.lat=lat;state.lon=lon;updateCoords();persist();refresh();}
function setTime(d){if(Number.isNaN(d.getTime()))return;state.date=d;updateDateInput();refresh()}
function projected(h){const r=R*(90-h.alt)/90*state.zoom, theta=(h.az-state.bearing)*Math.PI/180;return {x:cx+Math.sin(theta)*r,y:cy-Math.cos(theta)*r};}
function inside(p){return Math.hypot(p.x-cx,p.y-cy)<=R+1}
function angleLabel(az){const dir=['北','北東','東','南東','南','南西','西','北西'];return dir[Math.round(az/45)%8]}
function skyColors(sunAlt){if(sunAlt>-1)return ['#173651','#1e3546','#343957'];if(sunAlt>-10)return ['#0d2443','#18283f','#4a2f53'];return ['#080f22','#101b36','#25304c']}
function resize(){const b=canvas.getBoundingClientRect();const nextW=Math.max(300,b.width),nextH=Math.max(340,b.height); const ratio=Math.min(window.devicePixelRatio||1,2);if(Math.abs(nextW-vw)<1&&Math.abs(nextH-vh)<1&&dpr===ratio)return;
  vw=nextW;vh=nextH;dpr=ratio;canvas.width=Math.round(vw*dpr);canvas.height=Math.round(vh*dpr);ctx.setTransform(dpr,0,0,dpr,0,0); cx=vw/2;cy=vh*.495;R=Math.max(130,Math.min(vw*.424,vh*.437)); refresh();}
function text(x,y,str,size,color,align='center',fontWeight=500){ctx.font=`${fontWeight} ${size}px Inter, "Noto Sans JP", sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(str,x,y)}
function gradientSky(sunAlt){const colors=skyColors(sunAlt),g=ctx.createRadialGradient(cx,cy-R*.2,R*.05,cx,cy,R*1.3);g.addColorStop(0,colors[0]);g.addColorStop(.65,colors[1]);g.addColorStop(1,colors[2]);ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.fill();}
function drawRing(alt,stroke,dash=[]){const rr=R*(90-alt)/90*state.zoom;ctx.beginPath();ctx.arc(cx,cy,rr,0,Math.PI*2);ctx.strokeStyle=stroke;ctx.lineWidth=.8;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([])}
function drawStar(star,h,bright=false){if(h.alt<=0)return;const p=projected(h);if(!inside(p))return;
  const intensity=Math.max(.14,(6.2-star.mag)/6.2), r=(bright?2.2:1.1)+Math.max(0,2.5-star.mag)*.9;
  ctx.globalAlpha=Math.min(1,.25+intensity*.9);ctx.shadowColor=star.color;ctx.shadowBlur=bright?11+Math.max(0,2-star.mag)*3:3;ctx.fillStyle=star.color;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.45,r),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;
  if(bright&&star.mag<1.75){ctx.globalAlpha=.24;ctx.strokeStyle=star.color;ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(p.x-6,p.y);ctx.lineTo(p.x+6,p.y);ctx.moveTo(p.x,p.y-6);ctx.lineTo(p.x,p.y+6);ctx.stroke();ctx.globalAlpha=1}
  if(bright){hitTargets.push({...star,...h,x:p.x,y:p.y,kind:'star'})}
}
function drawPlanet(obj){if(obj.alt<=0)return;const p=projected(obj);if(!inside(p))return;let radius=obj.kind==='moon'?7:obj.kind==='sun'?10:obj.id==='Venus'?4.7:obj.id==='Jupiter'?4.3:3.3;
  ctx.save();ctx.shadowColor=obj.color;ctx.shadowBlur=obj.kind==='sun'?27:20;ctx.fillStyle=obj.color;
  if(obj.kind==='moon'){
    ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();
    ctx.globalCompositeOperation='destination-out';
    const shadowShift=radius*(.5-obj.illum)*1.6;
    ctx.beginPath();ctx.arc(p.x+shadowShift,p.y,radius*.82,0,Math.PI*2);ctx.fill();
    ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle=obj.color;ctx.globalAlpha=.65;ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.stroke();
  }else{ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill()}
  ctx.restore();hitTargets.push({...obj,x:p.x,y:p.y});
}
function drawConstellations(hmap){ctx.save();ctx.lineWidth=1.1;ctx.strokeStyle='#83addb';ctx.globalAlpha=.33;
 for(const c of CONSTELLATIONS){for(const path of c.lines){for(let i=1;i<path.length;i++){const a=hmap.get(path[i-1]),b=hmap.get(path[i]);if(!a||!b||a.alt<=0||b.alt<=0)continue;const p=projected(a),q=projected(b);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}}}
 ctx.restore();
}
function drawLabels(hmap,planetPositions){const placed=[]; const canPlace=(x,y)=>{if(!inside({x,y}))return false;for(const p of placed){if(Math.hypot(p.x-x,p.y-y)<29)return false;}placed.push({x,y});return true};
  ctx.save();ctx.shadowColor='#08132b';ctx.shadowBlur=5;
  for(const c of CONSTELLATIONS){if(!state.lines)break;const visible=c.stars.map(id=>hmap.get(id)).filter(h=>h&&h.alt>17).map(projected).filter(inside);if(visible.length<3)continue;const x=visible.reduce((s,p)=>s+p.x,0)/visible.length,y=visible.reduce((s,p)=>s+p.y,0)/visible.length;if(canPlace(x,y)){text(x,y,c.name,Math.max(10,Math.min(12,R/33)),'#718eb5')}}
  for(const [id,h] of hmap){const st=starIndex.get(id);if(!st||h.alt<=7||st.mag>2.0)continue;const p=projected(h);if(canPlace(p.x+8,p.y-10)){text(p.x+8,p.y-10,st.name,Math.min(12,Math.max(9,R/34)),'#d9dfec','left')}}
  for(const obj of planetPositions){if(obj.alt<=1)continue;const p=projected(obj);if(canPlace(p.x+12,p.y-12)){text(p.x+12,p.y-12,obj.name,11,'#ffda9d','left',650)}}
  ctx.restore();
}
const starIndex=new Map(allStars.map(s=>[s.id,s]));
function render(){if(!vw||!vh)return;ctx.clearRect(0,0,vw,vh);hitTargets=[];
  const bodies=Astro.bodies(state.date,state.lat,state.lon),sun=bodies[0], hmap=new Map();bodiesCache=bodies;
  for(const st of allStars){hmap.set(st.id,Astro.horizon(st.ra,st.dec,state.date,state.lat,state.lon))}
  ctx.save();gradientSky(sun.alt);
  ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.clip();
  if(state.grid){for(const alt of [30,60])drawRing(alt,'#8598b12b',[3,6]);for(let az=0;az<360;az+=45){const p=projected({alt:0,az}),q=projected({alt:90,az});ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(p.x,p.y);ctx.strokeStyle='#9aa8ba21';ctx.lineWidth=.7;ctx.stroke()}}
  // Dim catalog stars are fetched from the public Yale Bright Star Catalog. When offline, named bright stars remain.
  for(const st of starsExpanded){if(st.mag>state.mag)continue;const h=Astro.horizon(st.ra,st.dec,state.date,state.lat,state.lon);drawStar(st,h)}
  if(state.lines)drawConstellations(hmap);
  for(const st of allStars){if(st.mag>state.mag)continue;drawStar(st,hmap.get(st.id),true)}
  if(state.planets){for(const obj of bodies){drawPlanet(obj)}}
  if(state.labels)drawLabels(hmap,state.planets?bodies:[]);
  ctx.restore();
  ctx.save();drawRing(0,'#8d9ab28a');ctx.lineWidth=1;ctx.strokeStyle='#8190ab55';ctx.beginPath();ctx.arc(cx,cy,R+5,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<360;i+=10){const a=(i-state.bearing)*Math.PI/180;const inner=R+2,outer=R+(i%30===0?10:5);ctx.strokeStyle='#637391';ctx.lineWidth=.85;ctx.beginPath();ctx.moveTo(cx+Math.sin(a)*inner,cy-Math.cos(a)*inner);ctx.lineTo(cx+Math.sin(a)*outer,cy-Math.cos(a)*outer);ctx.stroke()}
  for(let a=0;a<360;a+=45){const p=projected({alt:-3,az:a});const n=['N','NE','E','SE','S','SW','W','NW'][a/45];text(cx+Math.sin((a-state.bearing)*Math.PI/180)*(R+24),cy-Math.cos((a-state.bearing)*Math.PI/180)*(R+24),n,12,a%90===0?'#cbd7e7':'#8492a9','center',700)}
  text(cx,cy,'✧',18,'#7d94b2b2');ctx.restore();
  const sunStr=sun.alt>0?'日中の星空（実際は観測できません）':sun.alt>-12?'薄明中の空（暗い星は見えにくい）':'夜空のシミュレーション';$('sky-conditions').textContent=sunStr;
  if(state.selected){const newSelected=hitTargets.find(t=>t.id===state.selected.id);if(newSelected)state.selected=newSelected;}
  // keep guide cards in sync whenever date/location changes
  if(!render.deferGuides){updateHighlights(hitTargets,bodies)}
}
render.deferGuides=false;
function refresh(){if(!ctx||!vw)return;render()}
function updateHighlights(hit,bodies){const planetHit=hit.filter(o=>o.kind==='planet'||o.kind==='moon'), starHit=hit.filter(o=>o.kind==='star'&&o.mag<=1.5);
  const order={Venus:1,Jupiter:2,Saturn:3,Mars:4,Moon:5,Mercury:6,Uranus:7,Neptune:8};planetHit.sort((a,b)=>(order[a.id]||10)-(order[b.id]||10));starHit.sort((a,b)=>a.mag-b.mag);
  const collection=[...planetHit,...starHit].filter((o,i,arr)=>arr.findIndex(q=>q.id===o.id)===i).slice(0,4);const el=$('highlight-list');el.innerHTML='';
  if(!collection.length){const div=document.createElement('div');div.className='empty-object';div.textContent='この時刻、地平線の上にある主な天体は見つかりませんでした。日時を変更してみてください。';el.appendChild(div);return}
  for(const ob of collection){const btn=document.createElement('button');btn.className='highlight-object';btn.type='button';const symbol=document.createElement('span');symbol.className='object-symbol';symbol.textContent=ob.kind==='moon'?'☾':ob.kind==='planet'?'●':'✦';symbol.style.color=ob.color;
    const box=document.createElement('span');box.className='object-main';const name=document.createElement('strong');name.textContent=ob.name;const detail=document.createElement('small');detail.textContent=`${angleLabel(ob.az)}の空 · 高度${Math.round(ob.alt)}°`;box.append(name,detail);const arrow=document.createElement('span');arrow.className='object-arrow';arrow.textContent='↗';btn.append(symbol,box,arrow);btn.onclick=()=>selectObject(ob);el.appendChild(btn)}
}
function selectObject(obj){state.selected=obj;$('selected-name').textContent=obj.name;let info='';
  if(obj.kind==='moon'){info=`月の明るい面の割合は約${Math.round((obj.illum||0)*100)}%。月は地球の周りを約1か月で公転します。`}
  else if(obj.kind==='sun'){info='太陽は太陽系の中心にある恒星です。太陽を直接見ないでください。'}
  else if(obj.kind==='planet'){const desc={Mercury:'太陽に最も近い惑星。夕方か明け方の低い空に見えやすい天体です。',Venus:'「宵の明星」「明けの明星」とも呼ばれる、とても明るい惑星です。',Mars:'赤みがかった色で知られる惑星。地球との距離により明るさが変わります。',Jupiter:'太陽系で最も大きな惑星。条件が良いと非常に明るく見えます。',Saturn:'美しい環で有名な惑星。環を観察するには望遠鏡が必要です。',Uranus:'望遠鏡などを使うと観測できる外惑星です。',Neptune:'太陽から遠い惑星。肉眼では見えません。'};info=desc[obj.id]||'太陽系の惑星です。'}
  else if(obj.kind==='star'){info=`見かけの明るさは約 ${obj.mag.toFixed(2)} 等級。恒星は自ら光を放っています。`}
  $('selected-desc').textContent=info;$('selected-metrics').innerHTML='';
  for(const [k,v] of [['高度',`${obj.alt.toFixed(1)}°`],['方角',`${angleLabel(obj.az)} · ${obj.az.toFixed(0)}°`]]){const d=document.createElement('div'),s=document.createElement('span'),b=document.createElement('b');s.textContent=k;b.textContent=v;d.append(s,b);$('selected-metrics').append(d)}
}
let pointerStart=null,pointerMoved=false;
canvas.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY,bearing:state.bearing};pointerMoved=false;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!pointerStart)return;const dx=e.clientX-pointerStart.x,dy=e.clientY-pointerStart.y;if(Math.abs(dx)>5||Math.abs(dy)>5)pointerMoved=true;if(pointerMoved){state.bearing=Astro.norm(pointerStart.bearing+dx*.32);render()}});
canvas.addEventListener('pointerup',e=>{if(!pointerStart)return;if(!pointerMoved){const b=canvas.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;const matches=hitTargets.map(t=>({...t,dist:Math.hypot(x-t.x,y-t.y)})).filter(t=>t.dist<=17).sort((a,b)=>a.dist-b.dist);if(matches.length)selectObject(matches[0]);else if(inside({x,y}))toast('明るい星や惑星をタップすると情報を見られます')}pointerStart=null});
canvas.addEventListener('pointercancel',()=>pointerStart=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=Math.max(1,Math.min(2.4,state.zoom+(e.deltaY<0?.1:-.1)));$('zoom-label').textContent=Math.round(state.zoom*100)+'%';render()},{passive:false});
$('zoom-in').onclick=()=>{state.zoom=Math.min(2.4,state.zoom+.2);$('zoom-label').textContent=Math.round(state.zoom*100)+'%';render()};
$('zoom-out').onclick=()=>{state.zoom=Math.max(1,state.zoom-.2);$('zoom-label').textContent=Math.round(state.zoom*100)+'%';render()};
$('reset-bearing').onclick=()=>{state.bearing=0;state.zoom=1;$('zoom-label').textContent='100%';render();toast('北を上に戻しました')};
$('city-select').onchange=e=>{if(e.target.value==='custom'){state.place='custom';updateCoords();persist();$('custom-coords').hidden=false;$('edit-coords').setAttribute('aria-expanded','true');return}const p=PLACES[e.target.value];setPlace(e.target.value,p.lat,p.lon)};
$('gps-btn').onclick=()=>{if(!('geolocation' in navigator)){toast('このブラウザでは位置情報が使えません');return}toast('現在地の取得をリクエストしています…');navigator.geolocation.getCurrentPosition(pos=>{setPlace('custom',pos.coords.latitude,pos.coords.longitude);toast('観測場所を現在地に変更しました')},err=>toast('位置を取得できません。位置情報の許可を確認してください。'),{enableHighAccuracy:false,timeout:12000,maximumAge:600000})};
$('edit-coords').onclick=()=>{$('custom-coords').hidden=!$('custom-coords').hidden;$('edit-coords').setAttribute('aria-expanded',String(!$('custom-coords').hidden))};
$('apply-coords').onclick=()=>{const lat=Number($('lat-input').value),lon=Number($('lon-input').value);if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -90||lat>90||lon< -180||lon>180){toast('緯度は−90〜90、経度は−180〜180の範囲で指定してください');return}setPlace('custom',lat,lon);$('custom-coords').hidden=true;toast('座標を更新しました')};
$('date-time').onchange=e=>{const d=new Date(e.target.value);if(!Number.isNaN(d.getTime()))setTime(d)};
function moveHour(hours){setTime(new Date(state.date.getTime()+hours*3600000))}
$('minus-hour').onclick=()=>moveHour(-1);$('plus-hour').onclick=()=>moveHour(1);$('minus-day').onclick=()=>moveHour(-24);$('plus-day').onclick=()=>moveHour(24);
$('tonight-btn').onclick=()=>{const d=new Date();if(d.getHours()>=22)d.setDate(d.getDate()+1);d.setHours(21,0,0,0);setTime(d);toast('今夜21時の星空に移動しました')};
$('now-header').onclick=()=>{setTime(new Date());toast('現在時刻の星空を表示します')};
let autoplay=null;
$('animate-btn').onclick=()=>{state.playing=!state.playing;$('animate-btn').textContent=state.playing?'■ 一時停止':'▶ 時間を進める';if(autoplay){clearInterval(autoplay);autoplay=null}if(state.playing){autoplay=setInterval(()=>moveHour(1/12),180)}};
for(const [name,id] of [['lines','toggle-lines'],['labels','toggle-labels'],['planets','toggle-planets'],['grid','toggle-grid']]){$(id).checked=state[name];$(id).onchange=e=>{state[name]=e.target.checked;persist();render()}}
$('magnitude').value=state.mag;$('mag-value').textContent=state.mag.toFixed(1)+' 等級まで';$('magnitude').oninput=e=>{state.mag=Number(e.target.value);$('mag-value').textContent=state.mag.toFixed(1)+' 等級まで';persist();render()};
let factIndex=0;$('next-fact').onclick=()=>{factIndex=(factIndex+1)%FACTS.length;$('fact-title').textContent=FACTS[factIndex][0];$('fact-text').textContent=FACTS[factIndex][1]};
$('save-image').onclick=()=>{try{const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height+Math.round(56*dpr);const c=out.getContext('2d');c.fillStyle='#090f20';c.fillRect(0,0,out.width,out.height);c.drawImage(canvas,0,0);c.fillStyle='#f1e0be';c.font=`${16*dpr}px sans-serif`;c.fillText('HOSHIZORA   ·   '+dateDisplay(state.date),20*dpr,canvas.height+33*dpr);const a=document.createElement('a');a.download='hoshizora-'+dateLocal(state.date).replace(/[:T]/g,'-')+'.png';a.href=out.toDataURL('image/png');document.body.append(a);a.click();a.remove();toast('星空の画像を保存しました')}catch{toast('画像保存に失敗しました')}};
function parseCoords(v,isRA){if(typeof v==='number')return v;if(typeof v!=='string')return NaN;const match=v.match(/[+-]?\d+(?:\.\d+)?/g);if(!match?.length)return NaN;const sign=v.trim()[0]==='-'?-1:1;const p=match.map(Number);return sign*(Math.abs(p[0])+(p[1]||0)/60+(p[2]||0)/3600)}
async function loadFullCatalog(){const urls=['https://cdn.jsdelivr.net/gh/brettonw/YaleBrightStarCatalog@master/bsc5-short.json','https://brettonw.github.io/YaleBrightStarCatalog/bsc5-short.json'];
 for(const url of urls){try{const controller=new AbortController();const t=setTimeout(()=>controller.abort(),9000);let res;try{res=await fetch(url,{signal:controller.signal})}finally{clearTimeout(t)}if(!res.ok)throw new Error('HTTP '+res.status);const input=await res.json();if(!Array.isArray(input))throw new Error('catalog not array');let list=[];
   for(const row of input){const mag=Number(row.V),ra=parseCoords(row.RA,true),dec=parseCoords(row.Dec,false);if(!Number.isFinite(ra)||!Number.isFinite(dec)||!Number.isFinite(mag)||mag>6||mag<2.3)continue;if(ra<0||ra>24||dec< -90||dec>90)continue;
     list.push({id:'HR'+row.HR,name:row.N||('HR '+row.HR),ra,dec,mag,color:'#d5e5ff'});
   }
   if(list.length<200)throw new Error('too few stars');starsExpanded=list;$('catalog-status').textContent=`公開恒星カタログから ${list.length.toLocaleString('ja-JP')} 個の星を追加表示できます。出典：Yale Bright Star Catalog（再配布元 MIT）。`;render();return;
 }catch(e){console.info('Catalog fallback:',e.message)}}
 $('catalog-status').textContent=`主な実在の恒星 ${allStars.length} 個を内蔵。追加星表の通信に失敗しましたが、主要な星と惑星はそのまま表示できます。`;
}
updateCoords();updateDateInput();
const observer=new ResizeObserver(()=>resize());observer.observe(canvas);resize();loadFullCatalog();
})();
