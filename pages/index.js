
import {useEffect, useRef, useState} from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import Chart from 'chart.js/auto';

export default function Home(){
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const beamCanvasRef = useRef(null);
  const rafRef = useRef(null);
  const [selected,setSelected] = useState(null);
  const pulseRef = useRef(null);
  const donutRef = useRef(null);
  const donut2Ref = useRef(null);

  // beam animation state
  const beamState = useRef({
    active:false,
    from:[69.52,40.898],
    to:[69.52,40.898],
    t:0
  });

  useEffect(()=>{
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: '/neon-style.json',
      center: [69.52,40.898],
      zoom: 13,
      pitch: 58,
      bearing: -14,
      antialias:true
    });
    mapRef.current = map;

    map.on('load', ()=>{
      map.addSource('chinaz', { type:'geojson', data:'/geojson/uz_chinaz.geojson' });

      // glow fill
      map.addLayer({
        id:'area-fill',
        type:'fill',
        source:'chinaz',
        paint:{
          'fill-color':'rgba(0,255,255,0.04)',
          'fill-outline-color':'rgba(0,255,255,0.9)'
        }
      }, 'osm');

      // multiple outline layers for glow
      map.addLayer({ id:'outline-core', type:'line', source:'chinaz', paint:{ 'line-color':'#00ffff', 'line-width':2, 'line-opacity':1 }});
      map.addLayer({ id:'outline-glow-1', type:'line', source:'chinaz', paint:{ 'line-color':'#00ffff', 'line-width':9, 'line-opacity':0.18 }});
      map.addLayer({ id:'outline-glow-2', type:'line', source:'chinaz', paint:{ 'line-color':'#00baff', 'line-width':18, 'line-opacity':0.08 }});

      // subtle extrusion-like effect using line-offsets
      map.addLayer({ id:'outline-sheen', type:'line', source:'chinaz', paint:{ 'line-color':'#7fffd4', 'line-width':1, 'line-opacity':0.25, 'line-blur':0.5 }});

      // labels
      map.addLayer({ id:'labels', type:'symbol', source:'chinaz', layout:{ 'text-field':['get','name'], 'text-size':12}, paint:{ 'text-color':'#9fefff', 'text-halo-color':'rgba(0,0,0,0.7)', 'text-halo-width':1 }});

      // enable mouse events for outlines
      map.on('click','outline-core', (e)=>{
        const f = e.features[0];
        const coords = centroidOf(f);
        setSelected(f.properties);
        startBeam([69.52,40.898], coords);
        animatePulse(coords);
        flyToFeature(coords);
      });

      map.on('mousemove','outline-core', ()=> map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave','outline-core', ()=> map.getCanvas().style.cursor = '');
    });

    // create canvas overlay for beam drawing
    const canvas = document.createElement('canvas');
    canvas.id = 'beam-canvas';
    canvas.width = map.getCanvas().width;
    canvas.height = map.getCanvas().height;
    canvas.style.position='absolute';
    canvas.style.left='0'; canvas.style.top='0';
    canvas.style.pointerEvents='none';
    document.body.appendChild(canvas);
    beamCanvasRef.current = canvas;

    // on resize, resize canvas
    function resizeCanvas(){
      if(!beamCanvasRef.current) return;
      const c = beamCanvasRef.current;
      c.width = map.getCanvas().width;
      c.height = map.getCanvas().height;
    }
    map.on('resize', resizeCanvas);

    // render loop for beam (uses screen coords)
    function renderBeam(){
      const c = beamCanvasRef.current;
      if(!c) { rafRef.current = requestAnimationFrame(renderBeam); return; }
      const ctx = c.getContext('2d');
      ctx.clearRect(0,0,c.width,c.height);
      const s = beamState.current;
      if(s.active){
        // animate t easing
        s.t += 0.02;
        if(s.t>1) s.t=1;
        // interpolate geographic coords to screen
        const from = map.project(s.from);
        const to = map.project(s.to);
        // beam path param along line based on t
        const x = from.x + (to.x-from.x)*s.t;
        const y = from.y + (to.y-from.y)*s.t;

        // draw glowing path with additive blend
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // main beam
        const grad = ctx.createLinearGradient(from.x, from.y, x, y);
        grad.addColorStop(0, 'rgba(0,255,255,0.05)');
        grad.addColorStop(0.6, 'rgba(0,255,255,0.35)');
        grad.addColorStop(1, 'rgba(255,150,255,0.9)');

        ctx.beginPath();
        ctx.lineWidth = 8 + (s.t*18);
        ctx.strokeStyle = grad;
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        // inner bright core
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        // trailing sparkles
        for(let i=0;i<6;i++){
          const pct = Math.random()*0.9;
          const px = from.x + (x-from.x)*pct + (Math.random()-0.5)*6;
          const py = from.y + (y-from.y)*pct + (Math.random()-0.5)*6;
          ctx.fillStyle = 'rgba(255,255,255,'+ (0.6*Math.random()) +')';
          ctx.fillRect(px,py, (Math.random()*2)+1, (Math.random()*2)+1 );
        }

        ctx.restore();

        // decay: if fully reached, slowly fade
        if(s.t>=1){
          s.active=false;
          setTimeout(()=>{ // small fade out by clearing after
            // nothing here; the next frames clear anyway
          },400);
        }
      }
      rafRef.current = requestAnimationFrame(renderBeam);
    }
    rafRef.current = requestAnimationFrame(renderBeam);

    // cleanup on unmount
    return ()=>{
      if(map) map.remove();
      if(beamCanvasRef.current){ try{ beamCanvasRef.current.remove(); }catch(e){} }
      if(rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  },[]);

  function centroidOf(feature){
    const coords = feature.geometry.coordinates[0];
    let x=0,y=0,n=coords.length;
    coords.forEach(c=>{ x+=c[0]; y+=c[1]; });
    return [x/n,y/n];
  }

  function flyToFeature(coords){
    const map = mapRef.current;
    if(!map) return;
    map.flyTo({center:coords, zoom:14, speed:0.9, curve:1.6, essential:true});
  }

  function animatePulse(coords){
    const map = mapRef.current;
    const p = map.project(coords);
    const el = document.getElementById('pulse-dot');
    if(!el) return;
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.display = 'block';
    setTimeout(()=> el.style.display='none', 1800);
  }

  function startBeam(from, to){
    beamState.current.active = true;
    beamState.current.from = from;
    beamState.current.to = to;
    beamState.current.t = 0;
  }

  useEffect(()=>{
    if(!selected) return;
    // president donut
    const pres = selected.president_votes ? selected.president_votes : {};
    const pLabels = Object.keys(pres);
    const pData = pLabels.map(k=>pres[k]);

    if(donutRef.current) donutRef.current.destroy();
    const ctx = document.getElementById('donut').getContext('2d');
    donutRef.current = new Chart(ctx,{
      type:'doughnut',
      data:{ labels:pLabels, datasets:[{data:pData, backgroundColor:['#ff6a6a','#6ad7ff','#ffcc66']}]},
      options:{ plugins:{legend:{position:'bottom'}, title:{display:true, text:'Presidential Votes'}} }
    });

    // vice donut
    const vice = selected.vice_votes ? selected.vice_votes : {};
    const vLabels = Object.keys(vice);
    const vData = vLabels.map(k=>vice[k]);
    if(donut2Ref.current) donut2Ref.current.destroy();
    const ctx2 = document.getElementById('donut2').getContext('2d');
    donut2Ref.current = new Chart(ctx2,{ type:'doughnut', data:{ labels:vLabels, datasets:[{data:vData, backgroundColor:['#ffb34d','#ff4da6']}]}, options:{ plugins:{legend:{position:'bottom'}, title:{display:true, text:'Vice Presidential Votes'}}}});

    // treemap-like tiles
    const container = document.getElementById('treemap');
    container.innerHTML = '';
    const sen = selected.senatorial || [];
    const total = sen.reduce((s,a)=> s + (a[1]||0), 0) || 1;
    sen.forEach(s=>{
      const tile = document.createElement('div');
      tile.className='tile';
      const pct = Math.round((s[1]/total)*100);
      tile.style.flex = '1 1 '+ Math.max(40,pct) +'px';
      const color = s[1] > total*0.35 ? '#ff6a6a' : (s[1] > total*0.18 ? '#ffb86a' : '#6ad7ff');
      tile.style.background = color;
      tile.textContent = s[0].split(' ')[1] || s[0];
      container.appendChild(tile);
    });

  },[selected]);

  return (
    <div style={{height:'100vh', width:'100vw', position:'relative'}}>
      <div ref={mapContainer} id="map" style={{height:'100%', width:'100%'}}/>
      <div id="scanlines"></div>
      <div id="grid"></div>
      <div id="vignette"></div>
      <canvas id="beam-canvas" className="canvas-glow" style={{pointerEvents:'none'}}></canvas>
      <div id="pulse-dot" className="pulse" style={{display:'none'}}></div>

      <div className="sidebar">
        <div className="title">Tashkent — Chinaz (TRON Demo v2)</div>
        {!selected && <div className="stat">Click an area on the map to inspect results and projects.</div>}
        {selected && <>
          <div className="stat"><strong>{selected.name}</strong></div>
          <div className="stat">Region: {selected.region}</div>
          <div className="stat">Flood control projects: {selected.flood_projects}</div>

          <div className="panel-chart">
            <canvas id="donut" width="320" height="200"></canvas>
          </div>

          <div className="panel-chart" style={{marginTop:8}}>
            <canvas id="donut2" width="320" height="200"></canvas>
          </div>

          <div className="panel-chart">
            <div style={{fontWeight:800, color:'#ff6aff'}}>Senatorial Votes</div>
            <div id="treemap" className="treemap"></div>
          </div>

          <div className="footer">Data: Mock GeoJSON for demo. Replace /public/geojson/uz_chinaz.geojson with real data.</div>
        </>}
      </div>
    </div>
  );
}
