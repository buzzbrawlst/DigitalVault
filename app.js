const state={files:[],query:'',sort:'newest',config:null};
const MAX_FILE_SIZE=100*1024*1024;
const fileInput=document.getElementById('fileInput');
const chooseBtn=document.getElementById('chooseBtn');
const dropZone=document.getElementById('dropZone');
const grid=document.getElementById('fileGrid');
const empty=document.getElementById('emptyState');
const search=document.getElementById('searchInput');
const sort=document.getElementById('sortSelect');
const fileCount=document.getElementById('fileCount');
const resultCount=document.getElementById('resultCount');
const connectionText=document.getElementById('connectionText');
const uploadPanel=document.getElementById('uploadPanel');

function loadConfig(){
  return new Promise((resolve,reject)=>{
    if(window.DIGITALVAULT_CONFIG)return resolve(window.DIGITALVAULT_CONFIG);
    const script=document.createElement('script');
    script.src='config.js';
    script.onload=()=>resolve(window.DIGITALVAULT_CONFIG);
    script.onerror=()=>reject(new Error('Could not load config.js'));
    document.head.appendChild(script);
  });
}
function ready(){
  return state.config && state.config.SUPABASE_URL && !state.config.SUPABASE_URL.includes('YOUR-PROJECT') && state.config.SUPABASE_ANON_KEY && !state.config.SUPABASE_ANON_KEY.includes('YOUR_');
}
function headers(extra={}){return {'apikey':state.config.SUPABASE_ANON_KEY,'Authorization':`Bearer ${state.config.SUPABASE_ANON_KEY}`,...extra};}
function api(path,options={}){return fetch(`${state.config.SUPABASE_URL}${path}`,{...options,headers:headers(options.headers||{})});}

chooseBtn.addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',e=>handleFiles([...e.target.files]));
['dragenter','dragover'].forEach(type=>dropZone.addEventListener(type,e=>{e.preventDefault();dropZone.classList.add('dragging')}));
['dragleave','drop'].forEach(type=>dropZone.addEventListener(type,e=>{e.preventDefault();dropZone.classList.remove('dragging')}));
dropZone.addEventListener('drop',e=>handleFiles([...e.dataTransfer.files]));
search.addEventListener('input',e=>{state.query=e.target.value.toLowerCase();render()});
sort.addEventListener('change',e=>{state.sort=e.target.value;render()});
document.getElementById('refreshBtn').addEventListener('click',loadFiles);

async function handleFiles(files){
  if(!files.length)return;
  if(!ready()){
    alert('DigitalVault is not connected yet. Add your Supabase URL and anon key to config.js first.');
    return;
  }
  let uploader=localStorage.getItem('digitalvault-uploader')||'';
  if(!uploader){uploader=prompt('What name should appear on your uploads?','Anonymous')||'Anonymous';uploader=uploader.trim().slice(0,40)||'Anonymous';localStorage.setItem('digitalvault-uploader',uploader)}
  for(const file of files)await uploadFile(file,uploader);
  fileInput.value='';
  await loadFiles();
}

async function uploadFile(file,uploader){
  if(file.size>MAX_FILE_SIZE){alert(`${file.name} is larger than 100 MB.`);return}
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-180)||'file';
  const path=`${Date.now()}-${crypto.randomUUID()}-${safe}`;
  setUploadStatus(`Uploading ${file.name}…`);
  try{
    const upload=await fetch(`${state.config.SUPABASE_URL}/storage/v1/object/files/${path}`,{method:'POST',headers:headers({'Content-Type':file.type||'application/octet-stream','x-upsert':'false'}),body:file});
    if(!upload.ok)throw new Error(await upload.text());
    const insert=await api('/rest/v1/files',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({name:file.name,storage_path:path,size:file.size,mime_type:file.type||'application/octet-stream',uploader_name:uploader})});
    if(!insert.ok){await fetch(`${state.config.SUPABASE_URL}/storage/v1/object/files/${path}`,{method:'DELETE',headers:headers()});throw new Error(await insert.text())}
    setUploadStatus(`Uploaded ${file.name}`,'success');
  }catch(error){console.error(error);setUploadStatus(`Upload failed: ${file.name}`,'error');alert(`Upload failed for ${file.name}. Check your Supabase setup.`)}
}
function setUploadStatus(message,type=''){uploadPanel.hidden=false;uploadPanel.className=`upload-panel ${type}`;uploadPanel.textContent=message;clearTimeout(setUploadStatus.timer);setUploadStatus.timer=setTimeout(()=>uploadPanel.hidden=true,4500)}

async function loadFiles(){
  if(!ready()){
    connectionText.textContent='Setup required';
    state.files=[];render();return;
  }
  connectionText.textContent='Loading vault';
  try{
    const response=await api('/rest/v1/files?select=id,name,storage_path,size,mime_type,uploader_name,created_at&order=created_at.desc');
    if(!response.ok)throw new Error(await response.text());
    const rows=await response.json();
    state.files=rows.map(row=>({...row,uploader:row.uploader_name,url:`${state.config.SUPABASE_URL}/storage/v1/object/public/files/${row.storage_path.split('/').map(encodeURIComponent).join('/')}`}));
    connectionText.textContent='Shared vault';
    render();
  }catch(error){console.error(error);connectionText.textContent='Connection error';state.files=[];render()}
}

function formatSize(bytes){if(!bytes)return '0 B';const units=['B','KB','MB','GB'];const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1);return `${(bytes/Math.pow(1024,i)).toFixed(i?1:0)} ${units[i]}`}
function formatType(type){if(type.startsWith('image/'))return 'IMAGE';if(type.startsWith('video/'))return 'VIDEO';if(type.startsWith('audio/'))return 'AUDIO';if(type.includes('pdf'))return 'PDF';if(type.includes('zip')||type.includes('compressed'))return 'ARCHIVE';if(type.includes('text')||type.includes('javascript')||type.includes('json'))return 'TEXT';return 'FILE'}
function icon(type){if(type.startsWith('image/'))return '▧';if(type.startsWith('video/'))return '▶';if(type.startsWith('audio/'))return '♪';if(type.includes('pdf'))return 'P';if(type.includes('zip')||type.includes('compressed'))return '◇';return '□'}
function filtered(){const q=state.query;let list=state.files.filter(f=>f.name.toLowerCase().includes(q)||String(f.uploader||'').toLowerCase().includes(q));if(state.sort==='oldest')list.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));if(state.sort==='newest')list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));if(state.sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name));if(state.sort==='size')list.sort((a,b)=>(b.size||0)-(a.size||0));return list}
function preview(f){if(f.mime_type?.startsWith('image/'))return `<img class="file-preview" src="${f.url}" alt="">`;if(f.mime_type?.startsWith('video/'))return `<video class="file-preview" src="${f.url}" muted preload="metadata"></video>`;if(f.mime_type?.startsWith('audio/'))return `<div class="audio-preview">♪ Audio</div>`;return ''}
function render(){const list=filtered();grid.innerHTML=list.map(f=>`<article class="file-card">${preview(f)}<div class="file-top"><div class="file-icon">${icon(f.mime_type)}</div><div><div class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div><div class="file-meta">${formatSize(f.size)} · ${formatType(f.mime_type)}</div></div></div><div class="file-bottom"><span class="file-meta">by ${escapeHtml(f.uploader||'Unknown')}</span><a class="download-btn" href="${f.url}" download="${escapeHtml(f.name)}" target="_blank" rel="noopener">Download</a></div></article>`).join('');fileCount.textContent=state.files.length;resultCount.textContent=`${list.length} ${list.length===1?'file':'files'}`;empty.classList.toggle('visible',list.length===0);grid.style.display=list.length?'grid':'none'}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

(async()=>{try{state.config=await loadConfig()}catch(error){console.error(error)}await loadFiles()})();
