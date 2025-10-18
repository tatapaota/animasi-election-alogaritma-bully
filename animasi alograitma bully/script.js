// data dan layout
const svg = document.getElementById('stage');
const status = document.getElementById('status');

// Buat elemen log tambahan
const logDiv = document.createElement('div');
logDiv.id = 'log';
logDiv.style.marginTop = '10px';
logDiv.style.background = '#fff';
logDiv.style.padding = '8px 12px';
logDiv.style.borderRadius = '6px';
logDiv.style.maxHeight = '220px';
logDiv.style.overflowY = 'auto';
logDiv.style.fontSize = '13px';
logDiv.innerHTML = '<b>Riwayat Proses:</b><br>';
status.insertAdjacentElement('afterend', logDiv);

const nodes = [
  { id: 1, x: 70,  y: 110 },
  { id: 2, x: 190, y: 40 },
  { id: 3, x: 310, y: 110 },
  { id: 4, x: 430, y: 40 },
  { id: 5, x: 550, y: 110 }
];

let failed = new Set();
let coordinator = 5;
let animating = [];

function createNodeGroup(n){
  const g = document.createElementNS('http://www.w3.org/2000/svg','g');
  g.setAttribute('class','node normal');
  g.setAttribute('data-id',n.id);
  g.setAttribute('transform',`translate(${n.x},${n.y})`);

  const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
  circle.setAttribute('r',28);

  const textId = document.createElementNS('http://www.w3.org/2000/svg','text');
  textId.setAttribute('x',0);
  textId.setAttribute('y',4);
  textId.setAttribute('text-anchor','middle');
  textId.textContent = n.id;

  const label = document.createElementNS('http://www.w3.org/2000/svg','text');
  label.setAttribute('x',0);
  label.setAttribute('y',40);
  label.setAttribute('text-anchor','middle');
  label.setAttribute('font-size','11');
  label.textContent = 'Node ' + n.id;

  g.appendChild(circle);
  g.appendChild(textId);
  g.appendChild(label);
  g.addEventListener('click', ()=> toggleFail(n.id));

  return g;
}

function render(){
  while(svg.firstChild) svg.removeChild(svg.firstChild);

  for(let i=0;i<nodes.length-1;i++){
    const a=nodes[i], b=nodes[i+1];
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',a.x); line.setAttribute('y1',a.y);
    line.setAttribute('x2',b.x); line.setAttribute('y2',b.y);
    line.setAttribute('stroke','#eee'); line.setAttribute('stroke-width','2');
    svg.appendChild(line);
  }

  nodes.forEach(n=>{
    const g = createNodeGroup(n);
    if(failed.has(n.id)) g.classList.add('failed');
    else if(n.id === coordinator) g.classList.add('coordinator');
    else g.classList.add('normal');
    svg.appendChild(g);
  });

  updateStatus('Coordinator = Node ' + coordinator + (failed.has(coordinator) ? ' (FAILED)' : ''));
}

//Actions
function toggleFail(id){
  if(failed.has(id)) failed.delete(id);
  else failed.add(id);

  if(failed.has(coordinator)){
    updateStatus('Coordinator gagal! Node lain akan memulai proses election secara otomatis.');
    const activeNonCoordinator = nodes.filter(n => !failed.has(n.id) && n.id !== coordinator);
    if(activeNonCoordinator.length === 0){
      updateStatus('Semua node gagal! Tidak ada election yang bisa dilakukan.');
      addLog('Semua node gagal — sistem tidak dapat beroperasi.');
      return;
    }
    const starter = activeNonCoordinator[Math.floor(Math.random() * activeNonCoordinator.length)].id;
    addLog('Node ' + starter + ' mendeteksi kegagalan koordinator dan memulai election.');
    startElection(starter);
  }
  render();
}

function updateStatus(text){
  status.textContent = 'Status: ' + text;
  addLog(text);
}

function addLog(entry){
  const p = document.createElement('div');
  p.textContent = '• ' + entry;
  logDiv.appendChild(p);
  logDiv.scrollTop = logDiv.scrollHeight; 
}

// Pesan proses
function animateMessage(fromId, toId, label='E') {
  const from = nodes.find(n=>n.id===fromId);
  const to = nodes.find(n=>n.id===toId);
  if(!from || !to) return;

  const msg = document.createElementNS('http://www.w3.org/2000/svg','circle');
  msg.setAttribute('r',6);
  msg.setAttribute('class','message');
  svg.appendChild(msg);

  const text = document.createElementNS('http://www.w3.org/2000/svg','text');
  text.setAttribute('x',0);
  text.setAttribute('y',2);
  text.setAttribute('text-anchor','middle');
  text.setAttribute('font-size','8');
  text.setAttribute('fill','#000');
  text.textContent = label;
  msg.appendChild(text);

  let t = 0;
  const steps = 80;

  function step(){
    t++;
    const lerp = t/steps;
    const x = from.x + (to.x - from.x) * lerp;
    const y = from.y + (to.y - from.y) * lerp;
    msg.setAttribute('cx', x);
    msg.setAttribute('cy', y);

    if(t >= steps){
      svg.removeChild(msg);
      return;
    }
    requestAnimationFrame(step);
  }
  step();
}

async function startElection(initiatorId){
  if(failed.has(initiatorId)) {
    updateStatus('Node '+initiatorId+' gagal, tidak bisa memulai election.');
    return;
  }

  updateStatus('Node '+initiatorId+' memulai election — mengirim pesan ELECTION ke node dengan ID lebih tinggi.');

  const higher = nodes.filter(n=>n.id>initiatorId).map(n=>n.id);
  let anyOk = false;

  for(const h of higher){
    if(failed.has(h)) {
      animateMessage(initiatorId, h, 'E');
      await sleep(700);
      addLog('Node '+h+' tidak merespons — dianggap gagal.');
    } else {
      animateMessage(initiatorId, h, 'E');
      await sleep(700);
      addLog('Node '+h+' merespons dengan pesan OK.');
      animateMessage(h, initiatorId, 'OK');
      await sleep(700);
      anyOk = true;
      await startElection(h); 
      return;
    }
  }

  if(!anyOk){
    coordinator = initiatorId;
    updateStatus('Node '+initiatorId+' menjadi KOORDINATOR baru — mengumumkan ke semua node lain.');
    addLog('Node '+initiatorId+' menjadi koordinator dan mengirim pesan COORDINATOR.');
    const promises = nodes.filter(x=>x.id !== initiatorId && !failed.has(x.id)).map(n => {
      animateMessage(initiatorId, n.id, 'C');
      return sleep(250);
    });
    await Promise.all(promises);
    render();
  }
}

function sleep(ms){ return new Promise(res=>setTimeout(res,ms)); }

document.getElementById('failBtn').addEventListener('click', ()=>{
  if(!failed.has(coordinator)){
    failed.add(coordinator);
    updateStatus('Koordinator Node '+coordinator+' gagal — proses election akan segera dimulai.');
  } else updateStatus('Koordinator sudah gagal sebelumnya.');
  render();
});

document.getElementById('startBtn').addEventListener('click', async ()=>{
  logDiv.innerHTML = '<b>Riwayat Proses:</b><br>'; // reset log tiap mulai baru
  const activeNonCoordinator = nodes.filter(n => !failed.has(n.id) && n.id !== coordinator);
  if(activeNonCoordinator.length === 0){
    updateStatus('Tidak ada node aktif untuk memulai election.');
    return;
  }
  const starter = activeNonCoordinator[Math.floor(Math.random() * activeNonCoordinator.length)].id;
  await startElection(starter);
  addLog('Proses election selesai. Koordinator baru adalah Node '+coordinator+'.');
});

document.getElementById('resetBtn').addEventListener('click', ()=>{
  failed.clear();
  coordinator = Math.max(...nodes.map(n=>n.id));
  updateStatus('Reset — Koordinator diatur ulang ke Node ' + coordinator);
  logDiv.innerHTML = '<b>Riwayat Proses:</b><br>';
  render();
});

render();