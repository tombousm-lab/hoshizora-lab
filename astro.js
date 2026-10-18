/* HOSHIZORA LAB — simplified sky mechanics, suitable for educational visualization.
   Stars use approximate J2000 RA/Dec. Planetary elements are low-precision analytical
   approximations; not for navigation or precise telescope pointing. */
const Astro = (() => {
  const RAD = Math.PI/180, DEG = 180/Math.PI;
  const sin = x => Math.sin(x*RAD), cos = x => Math.cos(x*RAD);
  const norm = d => ((d%360)+360)%360;
  const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
  const jd = date => date.getTime()/86400000 + 2440587.5;
  function sidereal(date, lon){ const j=jd(date), t=(j-2451545)/36525; return norm(280.46061837+360.98564736629*(j-2451545)+.000387933*t*t-t*t*t/38710000+lon); }
  function horizon(ra, dec, date, lat, lon){
    const hour=(norm(sidereal(date,lon)-ra*15+180)-180)*RAD, phi=lat*RAD, delta=dec*RAD;
    const alt=Math.asin(clamp(Math.sin(phi)*Math.sin(delta)+Math.cos(phi)*Math.cos(delta)*Math.cos(hour),-1,1))*DEG;
    const az=norm(Math.atan2(Math.sin(hour),Math.cos(hour)*Math.sin(phi)-Math.tan(delta)*Math.cos(phi))*DEG+180);
    return {alt,az};
  }
  const elements = {
    Mercury:d=>[48.3313+3.24587e-5*d,7.0047+5e-8*d,29.1241+1.01444e-5*d,.387098,.205635+5.59e-10*d,168.6562+4.0923344368*d],
    Venus:d=>[76.6799+2.4659e-5*d,3.3946+2.75e-8*d,54.891+1.38374e-5*d,.723330,.006773-1.302e-9*d,48.0052+1.6021302244*d],
    Mars:d=>[49.5574+2.11081e-5*d,1.8497-1.78e-8*d,286.5016+2.92961e-5*d,1.523688,.093405+2.516e-9*d,18.6021+.5240207766*d],
    Jupiter:d=>[100.4542+2.76854e-5*d,1.303-1.557e-7*d,273.8777+1.64505e-5*d,5.20256,.048498+4.469e-9*d,19.895+.0830853001*d],
    Saturn:d=>[113.6634+2.38980e-5*d,2.4886-1.081e-7*d,339.3939+2.97661e-5*d,9.55475,.055546-9.499e-9*d,316.967+.0334442282*d],
    Uranus:d=>[74.0005+1.3978e-5*d,.7733+1.9e-8*d,96.6612+3.0565e-5*d,19.18171-1.55e-8*d,.047318+7.45e-9*d,142.5905+.011725806*d],
    Neptune:d=>[131.7806+3.0173e-5*d,1.77-2.55e-7*d,272.8461-6.027e-6*d,30.05826+3.313e-8*d,.008606+2.15e-9*d,260.2471+.005995147*d]
  };
  function kepler(M,e){let E=norm(M)*RAD;for(let i=0;i<8;i++)E-=(E-e*Math.sin(E)-norm(M)*RAD)/(1-e*Math.cos(E));return E;}
  function sunEcliptic(d){
    const w=282.9404+4.70935e-5*d,e=.016709-1.151e-9*d,M=356.0470+.9856002585*d;
    const E=kepler(M,e),x=Math.cos(E)-e,y=Math.sqrt(1-e*e)*Math.sin(E),v=Math.atan2(y,x)*DEG,r=Math.hypot(x,y),lon=norm(v+w);
    return {x:r*cos(lon),y:r*sin(lon),z:0,lon, r};
  }
  function orbital(v){let [N,i,w,a,e,M]=v;let E=kepler(M,e), xv=a*(Math.cos(E)-e), yv=a*Math.sqrt(1-e*e)*Math.sin(E),
    r=Math.hypot(xv,yv), vv=Math.atan2(yv,xv)*DEG, u=vv+w;
    return {x:r*(cos(N)*cos(u)-sin(N)*sin(u)*cos(i)),y:r*(sin(N)*cos(u)+cos(N)*sin(u)*cos(i)),z:r*sin(u)*sin(i),lon:norm(Math.atan2(r*(sin(N)*cos(u)+cos(N)*sin(u)*cos(i)),r*(cos(N)*cos(u)-sin(N)*sin(u)*cos(i)))*DEG)};
  }
  function equator(x,y,z,d){ const e=23.4393-3.563e-7*d;
    const yy=y*cos(e)-z*sin(e),zz=y*sin(e)+z*cos(e);
    return {ra:norm(Math.atan2(yy,x)*DEG)/15,dec:Math.atan2(zz,Math.hypot(x,yy))*DEG};
  }
  function bodies(date,lat,lon){
    const d=jd(date)-2451543.5, s=sunEcliptic(d), sun=equator(s.x,s.y,0,d);
    const output=[{id:'Sun',name:'太陽',...sun, ...horizon(sun.ra,sun.dec,date,lat,lon),color:'#ffdb88',mag:-26.7,kind:'sun'}];
    const moonV=[125.1228-.0529538083*d,5.1454,318.0634+.1643573223*d,60.2666,.054900,115.3654+13.0649929509*d];
    const moon=orbital(moonV), moonEq=equator(moon.x,moon.y,moon.z,d), moonH=horizon(moonEq.ra,moonEq.dec,date,lat,lon);
    const illum=(1-Math.cos((moon.lon-s.lon)*RAD))/2;
    output.push({id:'Moon',name:'月',...moonEq,...moonH,color:'#f2eedc',mag:-12.5,kind:'moon',illum});
    for(const [id,fn] of Object.entries(elements)){
      const p=orbital(fn(d)), eq=equator(p.x+s.x,p.y+s.y,p.z,d), h=horizon(eq.ra,eq.dec,date,lat,lon);
      const japanese={Mercury:'水星',Venus:'金星',Mars:'火星',Jupiter:'木星',Saturn:'土星',Uranus:'天王星',Neptune:'海王星'};
      const color={Mercury:'#c8cedd',Venus:'#ffdb9d',Mars:'#ff936d',Jupiter:'#f9d2a2',Saturn:'#e7d5af',Uranus:'#a4f4e9',Neptune:'#86a5ff'};
      output.push({id,name:japanese[id],...eq,...h,color:color[id],kind:'planet'});
    }
    return output;
  }
  return {horizon,bodies,jd,norm};
})();
