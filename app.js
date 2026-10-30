var __n=document.getElementById("nojs");if(__n)__n.parentNode.removeChild(__n);
window.addEventListener("error",function(e){var d=document.createElement("div");d.style.cssText="position:fixed;left:0;right:0;top:0;z-index:99;background:#b3261e;color:#fff;padding:8px 12px;font:14px sans-serif";d.textContent="Hata: "+e.message+" (satir "+e.lineno+")";(document.body||document.documentElement).appendChild(d)});
(function(){"use strict";
/* ===== AYARLAR: model adları değişirse buradan düzelt ===== */
const CONFIG={
  chatUrl:"/api/chat",   // güvenli sunucu: anahtarlar Vercel'de kalır
  ttsUrl:"/api/tts",
  models:{normal:"gemini-2.5-flash-lite",high:"gemini-2.5-flash",max:"gemini-2.5-pro",xhigh:"gemini-2.5-pro"},
  extra:{xhigh:"Adım adım düşün, mantığını kontrol et, sonra kapsamlı ve düzenli bir cevap ver."},
  musicUrl:"https://api-inference.huggingface.co/models/facebook/musicgen-small",
  system:"Sen Dunkles'sin: samimi, kısa ve yetenekli bir asistan. Varsayılan olarak Türkçe, kullanıcı başka dilde yazarsa onun dilinde cevap ver."
};
const LANG="tr-TR";
const $=id=>document.getElementById(id);
const log=$("log"),box=$("box");
let chatHistory=[],pending=[];
const store={get:k=>{try{return localStorage.getItem(k)||""}catch(e){return ""}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
function toast(t){const e=$("toast");e.textContent=t;e.classList.add("on");setTimeout(()=>e.classList.remove("on"),2000)}

function add(role,text,node){
  $("empty")&&$("empty").remove();
  const d=document.createElement("div");d.className="msg "+role;d.textContent=text||"";
  if(node)d.appendChild(node);
  log.appendChild(d);log.scrollTop=log.scrollHeight;return d;
}
function dots(){const s=document.createElement("span");s.className="dots";s.innerHTML="<i></i><i></i><i></i>";return s}
function renderChips(){$("chips").innerHTML="";pending.forEach((p,i)=>{const s=document.createElement("span");s.textContent=p.name+"  ×";s.onclick=()=>{pending.splice(i,1);renderChips();updateGo()};$("chips").appendChild(s)})}
function updateGo(){$("row").classList.toggle("has",box.value.trim().length>0||pending.length>0)}

/* ---------- ekler ---------- */
$("attach").onclick=()=>$("file").click();
$("file").onchange=async e=>{
  for(const f of e.target.files){
    if(f.type.startsWith("image/"))pending.push({name:f.name,kind:"image",data:await toDataUrl(f)});
    else if(f.type==="application/pdf")pending.push({name:f.name,kind:"text",data:await readPdf(f)});
    else if(f.type.startsWith("text/")||/\.(txt|md|csv|json)$/i.test(f.name))pending.push({name:f.name,kind:"text",data:(await f.text()).slice(0,20000)});
    else pending.push({name:f.name,kind:"note",data:`[Ek dosya: ${f.name}. İçeriği ücretsiz sürümde okunamıyor.]`});
  }
  e.target.value="";renderChips();updateGo();
};
const toDataUrl=f=>new Promise(r=>{const x=new FileReader();x.onload=()=>r(x.result);x.readAsDataURL(f)});
async function readPdf(f){
  try{
    if(!window.pdfjsLib){await new Promise((ok,no)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=ok;s.onerror=no;document.head.appendChild(s)});
      pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"}
    const pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;let t="";
    for(let i=1;i<=Math.min(pdf.numPages,30);i++){const c=await(await pdf.getPage(i)).getTextContent();t+=c.items.map(x=>x.str).join(" ")+"\n"}
    return t.slice(0,20000);
  }catch(e){return "[PDF okunamadı]"}
}

/* ---------- yapay zeka ---------- */
async function ask(text,files=[]){
  add("user",text+(files.length?"\nEk: "+files.map(f=>f.name).join(", "):""));
  const parts=[];let ctx="";
  files.forEach(f=>{if(f.kind==="image")parts.push({type:"image_url",image_url:{url:f.data}});else ctx+=`\n\n--- ${f.name} ---\n${f.data}`});
  parts.unshift({type:"text",text:(text||"Ekli dosyalara bak lütfen.")+ctx});
  chatHistory.push({role:"user",content:parts.length===1?parts[0].text:parts});
  const tier=$("tier").value;
  const sys=CONFIG.system+(CONFIG.extra[tier]?" "+CONFIG.extra[tier]:"");
  const out=add("bot","",dots());
  try{
    const r=await fetch(CONFIG.chatUrl,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:CONFIG.models[tier],messages:[{role:"system",content:sys},...chatHistory.slice(-12)]})});
    if(!r.ok){let m="sunucu "+r.status;try{const b=await r.json();const d=(b.error&&b.error.message)||b.error;if(d)m+=": "+d}catch(e){}throw new Error(m)}
    const j=await r.json();const a=(j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||"(cevap yok)";
    out.textContent=a;chatHistory.push({role:"assistant",content:a});
    log.scrollTop=log.scrollHeight;return a;
  }catch(e){out.textContent="Yapay zekaya ulaşılamadı ("+e.message+"). Bağlantını kontrol edip tekrar dene.";chatHistory.pop();return null}
}
async function send(){
  const text=box.value.trim();
  if(!text&&!pending.length)return;
  box.value="";box.style.height="auto";
  const files=pending;pending=[];renderChips();updateGo();
  if(text.startsWith("/music")){add("user",text);return makeMusic(text.replace("/music","").trim()||"sakin lo-fi ritim")}
  if(/spotify/i.test(text)&&/(geçmiş|chatHistory|öner|recommend)/i.test(text)&&!store.get("dk_sp_token"))
    toast("Spotify girişi henüz kurulu değil");
  await ask(text,files);
}
$("send").onclick=send;
$("vbtn").onclick=openVoice;
box.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&innerWidth>700){e.preventDefault();send()}});
box.addEventListener("input",()=>{box.style.height="auto";box.style.height=box.scrollHeight+"px";updateGo()});

/* ---------- müzik ---------- */
async function makeMusic(prompt){
  const tok=store.get("dk_hf");const out=add("bot","",dots());
  if(!tok){out.textContent="Müzik üretmek için Ayarlar'dan ücretsiz Hugging Face anahtarı ekle.";return}
  try{
    const r=await fetch(CONFIG.musicUrl,{method:"POST",headers:{Authorization:"Bearer "+tok,"Content-Type":"application/json"},body:JSON.stringify({inputs:prompt})});
    if(!r.ok)throw new Error("durum "+r.status+(r.status===503?" (model yükleniyor, 30 sn sonra tekrar dene)":""));
    const a=document.createElement("audio");a.controls=true;a.src=URL.createObjectURL(await r.blob());
    out.textContent="İşte parçan: "+prompt;out.appendChild(a);
  }catch(e){out.textContent="Müzik üretilemedi: "+e.message}
}

/* ---------- sesle yazma (dikte) ---------- */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;let dict=null;
$("mic").onclick=()=>{
  if(!SR)return toast("Bu tarayıcı sesli girişi desteklemiyor");
  if(dict){dict.stop();return}
  dict=new SR();dict.lang=LANG;dict.interimResults=true;
  dict.onstart=()=>$("mic").classList.add("rec");
  dict.onresult=e=>{box.value=[...e.results].map(r=>r[0].transcript).join("");updateGo()};
  dict.onend=()=>{dict=null;$("mic").classList.remove("rec")};
  dict.onerror=ev=>{if(ev.error==="not-allowed")toast("Mikrofon izni ver");};
  dict.start();
};

/* ---------- sesli sohbet ---------- */
const player=new Audio();
const SILENT="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
let vOn=false,vState="idle",vRec=null,curDone=null,raf=0,tt=0;
const wave=$("wave");for(let i=0;i<21;i++)wave.appendChild(document.createElement("i"));
const bars=[...wave.children];
const reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
const LABEL={idle:"Hazır",listening:"Dinliyorum…",thinking:"Düşünüyorum…",speaking:"Konuşuyorum…"};
function setState(s){vState=s;$("voice").dataset.s=s;$("vstate").textContent=LABEL[s]}
function frame(){
  tt+=.05;const mid=10;
  bars.forEach((b,i)=>{
    const env=1-Math.abs(i-mid)/mid*.65;let a;
    if(vState==="listening")a=.14+.45*env*Math.abs(Math.sin(tt*2.2+i*.7))*(.6+.4*Math.sin(tt*.8+i));
    else if(vState==="speaking")a=.18+.8*env*Math.abs(Math.sin(tt*3.4+i*.55))*Math.abs(Math.sin(tt*1.2+i*.25));
    else if(vState==="thinking")a=.15+.25*Math.abs(Math.sin(tt*3-i*.45));
    else a=.12;
    b.style.transform="scaleY("+(reduce?.3:a)+")";
  });
  raf=requestAnimationFrame(frame);
}
function openVoice(){
  if(!SR)return toast("Bu tarayıcı sesli sohbeti desteklemiyor (Chrome veya Safari dene)");
  player.src=SILENT;player.play().catch(()=>{}); // ses iznini kullanıcı dokunuşunda aç
  vOn=true;$("voice").classList.add("open");$("voice").setAttribute("aria-hidden","false");$("vtext").textContent="";
  cancelAnimationFrame(raf);frame();vListen();
}
function closeVoice(){
  vOn=false;$("voice").classList.remove("open");$("voice").setAttribute("aria-hidden","true");
  if(vRec){vRec.onend=null;try{vRec.abort()}catch(e){}vRec=null}
  stopSpeech();setState("idle");setTimeout(()=>{if(!vOn)cancelAnimationFrame(raf)},400);
}
function vListen(){
  if(!vOn)return;setState("listening");
  let final="";vRec=new SR();vRec.lang=LANG;vRec.interimResults=true;
  vRec.onresult=e=>{final=[...e.results].map(r=>r[0].transcript).join("");$("vtext").textContent=final};
  vRec.onerror=ev=>{
    if(ev.error==="not-allowed"||ev.error==="service-not-allowed"){vRec.onend=null;vRec=null;toast("Mikrofon izni gerekli");closeVoice()}
  };
  vRec.onend=()=>{vRec=null;if(!vOn)return;final.trim()?vAsk(final.trim()):setTimeout(vListen,300)};
  try{vRec.start()}catch(e){setTimeout(vListen,500)}
}
async function vAsk(t){
  setState("thinking");
  const a=await ask(t);
  if(!vOn)return;
  if(a){$("vtext").textContent=a;await vSpeak(a)}else{$("vtext").textContent="Bir hata oldu, tekrar dinliyorum."}
  if(vOn)vListen();
}
function vSpeak(t){
  return new Promise(async res=>{
    setState("speaking");curDone=res;
    const clean=t.replace(/[*#`_]/g,"").slice(0,1500);
    const local=()=>{
      if(!window.speechSynthesis)return res();
      const u=new SpeechSynthesisUtterance(clean);u.lang=LANG;u.onend=()=>res();u.onerror=()=>res();speechSynthesis.speak(u);
    };
    if(store.get("dk_voice")==="browser")return local();
    try{
      const r=await fetch(CONFIG.ttsUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:clean})});
      if(!r.ok)throw 0;
      if(!vOn)return res();
      player.onended=()=>res();player.onerror=()=>res();
      player.src=URL.createObjectURL(await r.blob());await player.play();
    }catch(e){if(vOn)local();else res()}
  });
}
function stopSpeech(){
  try{player.pause()}catch(e){}
  window.speechSynthesis&&speechSynthesis.cancel();
  if(curDone){const d=curDone;curDone=null;d()}
}
$("orb").onclick=()=>{if(vState==="speaking")stopSpeech()};
$("vclose").onclick=closeVoice;

/* ---------- ayarlar ---------- */
const openSheet=()=>document.body.classList.add("sheet"),closeSheet=()=>document.body.classList.remove("sheet");
$("hf").value=store.get("dk_hf");$("sp").value=store.get("dk_sp");$("voiceSel").value=store.get("dk_voice")||"eleven";
$("gear").onclick=openSheet;$("back").onclick=closeSheet;
$("save").onclick=()=>{store.set("dk_hf",$("hf").value.trim());store.set("dk_sp",$("sp").value.trim());store.set("dk_voice",$("voiceSel").value);closeSheet();toast("Kaydedildi")};
$("clear").onclick=()=>{chatHistory=[];log.innerHTML='<div class="empty" id="empty"><b>Sohbet temizlendi.</b><br>Yeni bir şey sor.</div>';closeSheet()};
addEventListener("keydown",e=>{if(e.key==="Escape"){closeSheet();if(vOn)closeVoice()}});
})();
