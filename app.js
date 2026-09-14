const state={files:[],query:'',sort:'newest'};
const fileInput=document.getElementById('fileInput');
const chooseBtn=document.getElementById('chooseBtn');
const dropZone=document.getElementById('dropZone');
const grid=document.getElementById('fileGrid');
const empty=document.getElementById('emptyState');
const search=document.getElementById('searchInput');
const sort=document.getElementById('sortSelect');
const fileCount=document.getElementById('fileCount');
const resultCount=document.getElementById('resultCount');

chooseBtn.addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',e=>handleFiles([...e.target.files]));
['dragenter','dragover'].forEach(type=>dropZone.addEventListener(type,e=>{e.preventDefault();dropZone.classList.add('dragging')}));
['dragleave','drop'].forEach(type=>dropZone.addEventListener(type,e=>{e.preventDefault();dropZone.classList.remove('dragging')}));
dropZone.addEventListener('drop',e=>handleFiles([...e.dataTransfer.files]));
search.addEventListener('input',e=>{state.query=e.target.value.toLowerCase();render()});
sort.addEventListener('change',e=>{state.sort=e.target.value;render()});
document.getElementById('refreshBtn').addEventListener('click',()=>{loadDemo();render()});

function handleFiles(files){
  if(!files.length)return;
  const now=Date.now();
  files.forEach((file,index)=>state.files.unshift({
    id:`local-${now}-${index}`,
    name:file.name,
    size:file.size,
    type:file.type||'application/octet-stream',
    uploader:'You',
    created_at:new Date().toISOString(),
    local:true,
    url:URL.createObjectURL(file)
  }));
  render();
}

function loadDemo(){
  if(state.files.some(x=>x.local))return;
  state.files=[];
  render();
}

function formatSize(bytes){
  if(!bytes)return '0 B';
  const units=['B','KB','MB','GB'];
  const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1);
  return `${(bytes/Math.pow(1024,i)).toFixed(i?1:0)} ${units[i]}`;
}
function formatType(type){
  if(type.startsWith('image/'))return 'IMAGE';
  if(type.startsWith('video/'))return 'VIDEO';
  if(type.startsWith('audio/'))return 'AUDIO';
  if(type.includes('pdf'))return 'PDF';
  if(type.includes('zip')||type.includes('compressed'))return 'ARCHIVE';
  if(type.includes('text')||type.includes('javascript')||type.includes('json'))return 'TEXT';
  return 'FILE';
}
function icon(type){
  if(type.startsWith('image/'))return '▧';
  if(type.startsWith('video/'))return '▶';
  if(type.startsWith('audio/'))return '♪';
  if(type.includes('pdf'))return 'P';
  if(type.includes('zip')||type.includes('compressed'))return '◇';
  return '□';
}
function filtered(){
  const q=state.query;
  let list=state.files.filter(f=>f.name.toLowerCase().includes(q)||String(f.uploader||'').toLowerCase().includes(q));
  if(state.sort==='oldest')list.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  if(state.sort==='newest')list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if(state.sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name));
  if(state.sort==='size')list.sort((a,b)=>(b.size||0)-(a.size||0));
  return list;
}
function render(){
  const list=filtered();
  grid.innerHTML=list.map(f=>`<article class="file-card">
    <div class="file-top"><div class="file-icon">${icon(f.type)}</div><div><div class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div><div class="file-meta">${formatSize(f.size)} · ${formatType(f.type)}</div></div></div>
    <div class="file-bottom"><span class="file-meta">by ${escapeHtml(f.uploader||'Unknown')}</span>${f.url?`<a class="download-btn" href="${f.url}" download="${escapeHtml(f.name)}">Download</a>`:`<span class="download-btn">Download</span>`}</div>
  </article>`).join('');
  fileCount.textContent=state.files.length;
  resultCount.textContent=`${list.length} ${list.length===1?'file':'files'}`;
  empty.classList.toggle('visible',list.length===0);
  grid.style.display=list.length?'grid':'none';
}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
loadDemo();
