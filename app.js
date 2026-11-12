// Student course and teacher dashboard for the Bit Explorers class site.
import {STEPS,CARDS,HEART,CHAPS,CHAPTER_STARTS,problems,optionOrder,hintLimit} from './content.js';
import {chapterVisual} from './visuals.js';
import * as course from './engine.js';
import * as cloud from './cloud.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let record=null,tickTimer=null,extrasHTML='';
let passwordRecoveryMode=new URLSearchParams(location.hash.slice(1)).get('type')==='recovery';
const byteTools={},trickReady={};
let returnTo=null,shownStep=null;
const BADGES=['數字線索偵探','位元開關手','二進位拼圖師','訊息解碼員','像素創作家','聲音探測員'];
const errors={COURSE_REVISION_CONFLICT:'另一個分頁已經更新了進度。請重新載入這一頁再繼續。',
COURSE_STEP_CONFLICT:'目前步驟已在另一個分頁變更，請重新載入這一頁。',
COURSE_NOT_STARTED:'找不到這台電腦上的進度，請重新載入這一頁。',
COURSE_STEP_LOCKED:'先完成這一步，再繼續下一關。',
COURSE_CHECKPOINTS_PENDING:'還有章末檢核沒有完成，可以從上方選單切換章節。'};
function status(text){$('#sync').textContent=text;}
function mascotBubble(message,mood='curious'){
 return '<aside class="mascot-bubble '+mood+'"><span class="mascot-face" aria-hidden="true"><svg viewBox="0 0 64 64"><path class="antenna" d="M32 13V7m0 0-5-4m5 4 5-4"/><circle class="antenna-dot" cx="32" cy="7" r="3"/><rect class="bot-shell" x="9" y="15" width="46" height="39" rx="14"/><circle class="bot-eye" cx="24" cy="31" r="3.5"/><circle class="bot-eye" cx="40" cy="31" r="3.5"/><path class="bot-mouth" d="M24 41q8 8 16 0"/><path class="bot-ear" d="M9 28H5v12h4m46-12h4v12h-4"/><path class="bot-foot" d="M21 54v5m22-5v5"/></svg></span><span class="mascot-copy"><b>小波</b><span>'+esc(message)+'</span></span></aside>';
}
function mascotPrompt(s,q){
 if(q.submissions)return '線索快對上了！調整一下，再試一次。';
 if(s.checkpoint)return '章末挑戰開始！放心試，答錯可以重來，不扣分。';
 if(s.t==='trick')return '選好一個 0 到 31 的數字，先保密喔！';
 if(s.t==='conv')return '把亮著的 1 逐格加進來，看看我能不能解碼。';
 if(s.t==='build')return '點亮需要的位置，讓上方讀數慢慢靠近目標！';
 if(s.id==='welcome')return '嗨！我是小波。陪我從數字卡找出藏起來的規律吧！';
 if(s.id==='card-values')return '卡片左上角的小數字藏著線索，放大眼睛找找看！';
 if(s.ch===1)return '每格都像一盞小燈，試著找出 0 和 1 的規則。';
 if(s.ch===3)return '準備好解碼訊息了嗎？字母也藏著數字線索！';
 if(s.ch===4)return '一格一格拼起來，看看圖案會不會對你笑。';
 if(s.ch===5)return '來聽聽看，取樣變多時聲音有什麼不同。';
 return '準備好了嗎？我們一起找下一個線索！';
}
function mascotReward(ch){
 return '<div class="reward-badge"><span class="reward-star" aria-hidden="true">★</span><span><b>徽章解鎖：'+esc(BADGES[ch]||'任務達人')+'</b><small>這章的檢核完成了，做得好！</small></span></div>';
}
function bounce(el){if(!el)return;el.classList.remove('bit-pop');void el.offsetWidth;el.classList.add('bit-pop');el.addEventListener('animationend',()=>el.classList.remove('bit-pop'),{once:true});}
function savedStatus(){
 status(record.persisted===false?'這個瀏覽器不允許儲存資料：可以繼續玩，但關閉頁面後進度會消失。':'進度已存在這台電腦的瀏覽器 · '+new Date(record.updatedMs).toLocaleTimeString('zh-TW'));
}
function send(kind,value=null,step=record?.state?.step||0){
 try{record=course.event({revision:record?.revision||0,kind,step,value});savedStatus();renderStudent();const snapshot=record;cloud.saveProgress(snapshot).then(()=>kind==='submit'?appendStudentExtras():null).catch(e=>status('雲端同步失敗：'+esc(e.message)+'（本機進度仍保留）'));}
 catch(e){
  status((errors[e.code]||'這一步沒有完成，請重新載入這一頁再試。')+' ');
  $('#sync').insertAdjacentHTML('beforeend','<button id="reload" class="plain">重新載入</button>');
  $('#reload').onclick=()=>location.reload();
 }
}
function passwordRecoveryScreen(){
 $('#reset').hidden=true;$('#app').innerHTML='<section class="panel auth-panel"><p class="eyebrow">教師帳號安全設定</p><h1>設定新密碼</h1><p>請輸入新的教師登入密碼。</p><form id="password-reset-form" class="auth-form"><label>新密碼<input name="password" type="password" minlength="6" autocomplete="new-password" required></label><label>再次輸入新密碼<input name="confirm" type="password" minlength="6" autocomplete="new-password" required></label><p class="err"></p><button class="btn">儲存新密碼</button></form></section>';
 $('#password-reset-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),password=String(f.get('password')||''),confirmPassword=String(f.get('confirm')||'');if(password!==confirmPassword){e.currentTarget.querySelector('.err').textContent='兩次輸入的密碼不相同。';return;}try{await cloud.updatePassword(password);passwordRecoveryMode=false;history.replaceState(null,'',location.pathname+location.search);status('密碼已更新，正在開啟教師後台…');await boot();}catch(err){e.currentTarget.querySelector('.err').textContent=err.message;}};
}
function loginScreen(message='',teacherMode=false){
 $('#reset').hidden=true;
 $('#app').innerHTML='<section class="panel auth-panel"><p class="eyebrow">位元探險隊 · 學習入口</p><h1>'+(teacherMode?'教師登入':'準備開始任務？')+'</h1><p>'+(teacherMode?'請使用教師帳號登入，查看班級進度與回饋。':'輸入 5 位數班級座號即可開始。例：90230 是 902 班 30 號；登入後進度會自動保存。')+'</p><form id="auth-form" class="auth-form">'+(teacherMode?'<label>Email<input name="email" type="email" autocomplete="username" required></label><label>密碼<input name="password" type="password" autocomplete="current-password" required></label><button id="forgot-password" type="button" class="plain">忘記密碼？</button>':'<label>班級座號<input name="seat" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="例如 90230" autocomplete="username" required></label>')+'<p class="err">'+esc(message)+'</p><button class="btn">'+(teacherMode?'登入教師後台':'進入任務地圖')+'</button></form><button id="login-mode" class="plain">'+(teacherMode?'返回學生登入':'教師登入')+'</button></section>';
 $('#login-mode').onclick=()=>loginScreen('',!teacherMode);
 if($('#forgot-password'))$('#forgot-password').onclick=async()=>{const email=$('#auth-form [name=email]').value.trim();if(!email){status('請先輸入教師 Email，再按忘記密碼。');return;}try{await cloud.requestPasswordReset(email,location.origin+location.pathname);status('已寄出密碼重設信，請開啟最新一封信。');}catch(err){status('無法寄出重設信：'+err.message);}};
 $('#auth-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{status('正在登入…');if(teacherMode)await cloud.login(f.get('email'),f.get('password'));else await cloud.loginSeat(String(f.get('seat')||'').trim());await boot();}catch(err){const seat=String(f.get('seat')||'').trim();const message=!teacherMode&&/class not found/i.test(err.message)?'找不到 '+seat.slice(0,3)+' 班。請老師先在教師後台建立班級；建立後重新登入即可。':err.message;loginScreen(message,teacherMode);}};
}
function teacherAnswerDetails(student){
 const r=student.state?.state||{},current=STEPS[r.step],items=STEPS.map((step,k)=>{const q=r.q?.[step.id];if(!q)return '';let answer=q.answer;if(Array.isArray(answer))answer=answer.map(v=>typeof v==='boolean'?(v?'有':'沒有'):v).join(' / ');else if(answer===undefined||answer===null)answer='尚未作答';else answer=String(answer);if(answer.length>120)answer=answer.slice(0,120)+'…';return '<li class="'+(q.ok?'answer-ok':'')+'"><b>'+(q.ok?'✓':'·')+' '+esc(step.h||('第 '+(k+1)+' 步'))+'</b><span>答案：'+esc(answer)+' · 作答 '+(q.submissions||0)+' 次 · 提示 '+(q.hints||0)+' 次</span></li>';}).filter(Boolean).join('');
 const place=current?('第 '+(current.ch+1)+' 章「'+CHAPS[current.ch]+'」 · '+(current.h||'任務')):'尚未開始';return '<details class="student-record-details"><summary>查看作答紀錄 · '+(r.maxStep+1)+'／'+STEPS.length+' 步</summary><p class="meta">目前進度：'+esc(place)+'；完成步驟 '+(student.state?.metrics?.done||0)+' 步。</p><ol>'+(items||'<li>尚無作答紀錄</li>')+'</ol></details>';
}
async function renderTeacher(profile){
 $('#reset').hidden=true;$('#student-logout').hidden=true;
 const links=await cloud.classes();
 const exportRows=new Map();
 let html='<div class="panel teacher"><p class="eyebrow">班級管理 · 學習回饋</p><h1>教師儀表板</h1><p>教師：'+esc(profile.display_name)+' <button id="logout" class="plain">登出</button></p><h3>建立班級</h3><div class="row"><input id="new-class" placeholder="班級名稱（例如 902）"><input id="new-class-code" inputmode="numeric" maxlength="3" placeholder="三位班級碼"><button id="make-class">新增班級</button></div><p class="meta">學生座號前 3 碼是班級，後 2 碼是座號，例如 90230。每次作答與進度會自動同步。老師可查看作答紀錄與調整核定分數；留空儲存可恢復系統分數。</p>';
 if(!links.length)html+='<p>目前沒有班級。先輸入班級名稱和三位班級碼。</p>';
 for(const link of links){
  const c=link.classes;if(!c)continue;
  const rows=await cloud.teacherClass(c.id);exportRows.set(c.id,{classInfo:c,rows});
  html+='<h2>'+esc(c.name)+' <small>班級碼：'+esc(c.class_code||'尚未設定')+'</small></h2><button class="export-excel" data-export-class="'+esc(c.id)+'">下載 Excel 分數表</button><div class="scroll"><table><thead><tr><th>學生座號</th><th>任務進度</th><th>老師核定分數</th><th>課程狀態</th><th>作答紀錄</th></tr></thead><tbody>'+rows.map(s=>{const x=s.state?.metrics||{},grade=s.teacher_score??x.score??'';return '<tr><td>'+esc(s.display_name)+'</td><td>'+(x.progress??0)+'%</td><td><div class="grade-editor"><label>老師核定分數<input type="number" min="0" max="100" step="1" inputmode="numeric" data-teacher-score="'+esc(s.student_id)+'" data-class="'+esc(c.id)+'" value="'+esc(grade)+'" placeholder="'+(x.score??0)+'"></label><small>系統檢核 '+(x.score??'—')+'／100</small><button data-save-score="'+esc(s.student_id)+'" data-class="'+esc(c.id)+'">儲存</button></div></td><td>'+((s.state?.state?.completed)?'已完成':'進行中')+'</td><td>'+teacherAnswerDetails(s)+'</td></tr>';}).join('')+'</tbody></table></div>';
 }
 html+='</div>';$('#app').innerHTML=html;
 $('#logout').onclick=async()=>{await cloud.logout();loginScreen();};
 $('#make-class').onclick=async()=>{try{await cloud.createClass($('#new-class').value,$('#new-class-code').value);await boot();}catch(e){status(e.message);}};
 document.querySelectorAll('[data-export-class]').forEach(b=>b.onclick=async()=>{
  const item=exportRows.get(b.dataset.exportClass);if(!item)return;
  try{
   status('正在準備 Excel 分數表…');
   const XLSX=await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
   const c=item.classInfo;
   const aoa=[['班級',c.name],['班級碼',c.class_code||''],['匯出時間',new Date().toLocaleString('zh-TW')],[],['學生座號','任務進度','系統分數','老師核定分數','目前採計分數','課程狀態','完成步驟','總步驟','最後更新時間']];
   for(const s of item.rows){const m=s.state?.metrics||{};aoa.push([s.display_name,m.progress??0,m.score??'',s.teacher_score??'',s.teacher_score??m.score??'',s.state?.state?.completed?'已完成':'進行中',m.done??0,m.totalSteps??0,s.updated_at?new Date(s.updated_at).toLocaleString('zh-TW'):'']);}
   const ws=XLSX.utils.aoa_to_sheet(aoa);ws['!cols']=[{wch:14},{wch:12},{wch:12},{wch:16},{wch:16},{wch:12},{wch:12},{wch:12},{wch:22}];
   if(item.rows.length)ws['!autofilter']={ref:'A5:I'+(5+item.rows.length)};
   const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'學生分數');
   const safeName=String(c.name||'班級').replace(/[\/:*?"<>|]/g,'_');
   XLSX.writeFile(wb,(c.class_code||'班級')+'_'+safeName+'_學生分數.xlsx');status('Excel 分數表已下載。');
  }catch(e){status('Excel 匯出失敗：'+esc(e.message));}
 });
 document.querySelectorAll('[data-save-score]').forEach(b=>b.onclick=async()=>{const input=document.querySelector('input[data-teacher-score="'+b.dataset.saveScore+'"][data-class="'+b.dataset.class+'"]');const value=input.value.trim()===''?null:Number(input.value);if(value!==null&&(!Number.isFinite(value)||value<0||value>100)){status('分數請輸入 0 到 100。');return;}try{await cloud.setTeacherScore(b.dataset.saveScore,b.dataset.class,value);status(value===null?'已恢復系統檢核分數。':'老師核定分數已儲存。');await boot();}catch(e){status('分數儲存失敗：'+esc(e.message));}});
}
async function boot(){
 const s=await cloud.session();if(!s){loginScreen(passwordRecoveryMode?'重設連結已失效，請重新申請密碼重設。':'');return;}if(passwordRecoveryMode){passwordRecoveryScreen();return;}const p=await cloud.profile();
 if(p.role==='teacher'){await renderTeacher(p);status('教師帳號已登入。');return;}
 const seat=s.user?.email?.match(/^seat(\d{5})@students\.bitexplorers\.net$/i)?.[1];if(!seat){await cloud.logout();loginScreen('學生請使用五位數班級座號登入。');return;}
 try{await cloud.joinClassBySeat(seat);}catch(e){const message=/class not found/i.test(e.message)?'找不到 '+seat.slice(0,3)+' 班。請老師先在教師後台建立班級；建立後重新整理或重新登入即可。':e.message;loginScreen(message);return;}
 const remote=await cloud.loadProgress();if(remote){record=course.restore(remote);if(record.resetFromPreviousCourse){try{await cloud.saveProgress(record);status('新版課程已準備好，從第 1 關開始。');}catch(e){status('無法更新新版進度：'+esc(e.message)+'；你仍可繼續學習。');}}else savedStatus();renderStudent();}else{course.reset();record=course.mine();status('進度尚未開始；完成第一個步驟後會同步到雲端。');startScreen();}await appendStudentExtras();
}
function showStudentHeader(){$('#reset').hidden=false;const b=$('#student-logout');if(b){b.hidden=false;b.onclick=async()=>{await cloud.logout();extrasHTML='';loginScreen();};}}
function startScreen(){
 showStudentHeader();
 clearInterval(tickTimer);shownStep=null;
 const captions=['先玩遊戲，再找出卡片規律','從開關和短位元開始學','先用少量位置，再慢慢增加','用字母練習資料編碼','把位元畫成像素圖片','觀察聲音怎麼變成資料'];
 const icons=['🔎','💡','🧩','🔐','🎨','🎧'],zones=['線索林地','開關基地','積木高原','暗號城堡','像素工坊','聲音修復站'];
 $('#app').innerHTML='<div id="cover" class="quest-lobby"><section class="ticket"><div class="lobby-kicker"><span class="lobby-emblem">BE</span><span>數位探險任務 · 6 個區域</span></div><p class="eyebrow">準備好出發了嗎？</p><h1>位元探險隊</h1><p class="story">跟著小波穿越六個任務區，從數字卡一路探索到聲音資料。你可以照順序闖關，也能自由選擇想玩的任務。</p><div class="lobby-stats"><div><b>06</b><span>任務區</span></div><div><b>自由</b><span>選擇順序</span></div><div><b>不限</b><span>提示與重試</span></div></div><button id="start" class="btn">🚀　從第 1 區出發</button><p class="note">練習答錯不扣分，完成章末挑戰就能解鎖徽章。</p>'+mascotBubble('地圖準備好了！選一條路線，我們開始探險吧。','curious')+'</section><section class="map-panel"><div class="map-heading"><div><p class="eyebrow">WORLD MAP</p><h2>選擇任務區</h2></div><span class="map-open">● 六區都已開放</span></div><div class="mission-map"><svg class="mission-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M25 16 C42 16 55 16 75 16 L75 50 C55 50 43 50 25 50 L25 84 C45 84 57 84 75 84"/></svg>'+CHAPS.map((name,i)=>{const done=!!record?.state?.q?.['check-'+(i+1)]?.ok,active=!!record?.state&&STEPS[record.state.step]?.ch===i,status=done?'✓ 已完成':active?'正在进行':'點我探索';return '<button type="button" class="mission-card zone-'+(i+1)+(done?' completed':'')+(active?' active':'')+'" data-start-step="'+CHAPTER_STARTS[i]+'"><span class="mission-icon">'+icons[i]+'<small>0'+(i+1)+'</small></span><span class="mission-copy"><small>'+esc(zones[i])+'</small><b>'+esc(name)+'</b><span>'+captions[i]+'</span><em class="mission-status">'+status+'</em></span><span class="mission-arrow">↗</span></button>';}).join('')+'</div><p class="map-tip"><span>✦</span> 點選任務卡即可直接前往該章；途中也能切換區域。</p></section></div>';
 $('#start').onclick=()=>send('start');
 document.querySelectorAll('[data-start-step]').forEach(b=>b.onclick=()=>send('start',null,+b.dataset.startStep));
}
const fmt=ms=>{const t=Math.max(0,Math.round((ms||0)/1000)),h=Math.floor(t/3600),m=Math.floor(t%3600/60),x=t%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0');};
const timedStep=s=>false;
const liveMs=(r,s)=>{const q=r.q[s.id]||{};return (q.activeMs||0)+(q.ok||!Number.isFinite(r.sinceMs)?0:Math.min(Math.max(0,Date.now()-r.sinceMs),record?.segmentCapMs||300000));};
function scorePanel(v){
 const m=v.metrics,f=v.feedback,attempt=v.state?.attempt||1;
 if(!m)return '';
 return '<div class="student-dashboard-grid"><div class="panel learning-record"><p class="eyebrow">學習紀錄</p><h3>我的任務進度</h3><p class="grade">'+m.score+'／100</p><p>已完成 '+m.checkpoints+'／'+m.checkpointTotal+' 個章末檢核。'+(attempt>1?'這是第 '+attempt+' 次練習。':'')+'</p><div class="checkpoint-strip">'+Array.from({length:m.checkpointTotal},(_,i)=>'<span class="'+(i<m.checkpoints?'done':'')+'">'+(i<m.checkpoints?'✓':i+1)+'</span>').join('')+'</div><p>完成 '+m.done+'／'+m.totalSteps+' 個步驟（'+m.progress+'%） · 已試 '+m.submissions+' 次 · 看過 '+m.hints+' 個提示</p><details><summary>分數怎麼算？</summary><p>六個章末檢核平均計分，每關約 16.7 分。練習答錯、使用提示和重試都不扣分。老師可以在後台查看進度和檢核分數。</p><p>你已完成 '+m.practices+'／'+m.practiceTotal+' 個互動練習。略過 '+m.skipped+' 個活動。</p></details><div class="report"><b>學習回饋</b><p>'+esc(f.strength)+'</p><p>'+esc(f.advice)+'</p><p>'+esc(f.comment)+'</p></div></div><div id="student-extras" class="student-rank-column"></div></div>';
}
const isAction=s=>['text','opt','conv','build','trick','pixel','wave'].includes(s.t);
const fill=(text,p)=>String(text||'').replace(/\{(letter|code|bits|word|value|parts)\}/g,(_,k)=>k==='parts'?[...(p?.bits||'')].map((b,i,a)=>b==='1'?2**(a.length-1-i):0).filter(Boolean).join(' + '):p?.[k]??'');
const cardsHtml=(highFirst=false)=>'<div class="cardgrid">'+(highFirst?[...CARDS].reverse():CARDS).map(c=>card(c)).join('')+'</div>';
const CN=['零','一','二','三','四','五','六','七','八'];
const glyph=n=>n>=33&&n<=126?String.fromCharCode(n):n===32?'空白':'—';
function byteTool(id,label='8 格編碼工具'){
 const bits=byteTools[id]||'00000000',value=parseInt(bits,2);
 return '<div class="bytetool" data-tool="'+esc(id)+'"><p class="meta">'+esc(label)+'：點格子切換 0 和 1。</p><div class="bits">'+[...bits].map((b,k)=>'<button type="button" data-tbit="'+k+'" aria-pressed="'+(b==='1')+'" class="'+(b==='1'?'on':'')+'"><small>2<sup>'+(7-k)+'</sup> = '+2**(7-k)+'</small><b>'+b+'</b></button>').join('')+'</div><p class="tally">目前編號：<b data-tool-value>'+value+'</b> · 符號：<b data-tool-glyph>'+esc(glyph(value))+'</b></p><button type="button" class="plain tool-clear">清空這組</button></div>';
}
function letterTable(){
 const row=(from,to)=>{let h='';for(let n=from;n<=to;n++)h+='<span><b>'+String.fromCharCode(n)+'</b><small>'+n+'</small></span>';return h;};
 return '<details class="lettertable"><summary>需要查字母編號時，打開這張表</summary><p class="meta">上排是大寫，下排是小寫。</p><div class="letters">'+row(65,90)+'</div><div class="letters">'+row(97,122)+'</div></details>';
}
function bitPuzzle(p,q){
 const bits=q.answer||'0'.repeat(p.n),sum=[...bits].reduce((n,b,k)=>n+(b==='1'?2**(p.n-k-1):0),0);
 return '<div class="build-numbers"><div class="build-target"><span>目標十進位</span><b>'+p.value+'</b></div><div class="build-current" aria-live="polite"><span>目前代表的十進位</span><b id="build-sum">'+sum+'</b></div></div><p>點一下下面的 0 或 1，就能切換位元；上方數字會即時更新。</p><div class="bit-board" style="--bit-count:'+p.n+'" aria-label="點選切換 0 和 1">'+[...bits].map((b,k)=>{const power=p.n-k-1,value=2**power;return '<div class="bit-place"><span>2<sup>'+power+'</sup> = '+value+'</span><button type="button" data-bank-bit="'+k+'" class="bit-toggle '+(b==='1'?'on':'')+'" aria-label="位置值 '+value+'，目前是 '+b+'" aria-pressed="'+(b==='1')+'" '+(q.ok?'disabled':'')+'>'+b+'</button></div>';}).join('')+'</div><p class="bit-binary-readout">目前的二進位：<b id="build-bits">'+bits+'</b></p><button type="button" id="clear-build" class="plain" '+(q.ok?'disabled':'')+'>全部改回 0</button><button type="button" id="confirm-build" class="btn" '+(q.ok?'disabled':'')+'>檢查答案</button>';
}
function selectedConversionSum(p,q){return Number(q.answer||0)&parseInt(p.bits,2);}
function conversionPuzzle(p,q){
 const sum=selectedConversionSum(p,q),included=sum.toString(2).padStart(p.n,'0').slice(-p.n),bits=[...p.bits];
 return '<div class="build-numbers"><div class="build-target"><span>題目給的二進位</span><b class="binary-pattern">'+p.bits+'</b></div><div class="build-current" aria-live="polite"><span>目前換算出的十進位</span><b id="conv-sum">'+sum+'</b></div></div><p>點一下題目中每個 1，把它的位置值加進上方總和；0 不用加。</p><div class="bit-board" style="--bit-count:'+p.n+'" aria-label="二進位位置和值">'+bits.map((bit,k)=>{const power=p.n-k-1,value=2**power,selected=included[k]==='1';return '<div class="bit-place"><span>2<sup>'+power+'</sup> = '+value+'</span>'+(bit==='1'?'<button type="button" data-conv-bit="'+value+'" class="bit-toggle conv-toggle '+(selected?'on':'')+'" aria-label="位元 1，位置值 '+value+'，'+(selected?'已加入總和':'點選加入總和')+'" aria-pressed="'+selected+'" '+(q.ok?'disabled':'')+'>1</button>':'<div class="bit-static-zero" aria-label="位元 0，不加入">0</div>')+'</div>';}).join('')+'</div><button type="button" id="clear-conv" class="plain" '+(q.ok?'disabled':'')+'>清除重算</button><button type="button" id="confirm-conv" class="btn" '+(q.ok?'disabled':'')+'>檢查答案</button>';
}
function renderStudent(){
 showStudentHeader();
 $('#reset').hidden=false;
 clearInterval(tickTimer);
 if(!record?.state)return startScreen();
 const r=record.state,s=STEPS[r.step],q=r.q[s.id]||{},m=record.metrics,all=problems(r.attemptId),p=all[s.id],chapterIndices=STEPS.map((x,k)=>x.ch===s.ch?k:-1).filter(k=>k>=0),chapterPlace=chapterIndices.indexOf(r.step)+1;
 let html='<div class="top quest-hud"><div class="toprow"><div class="hud-title"><span class="hud-emblem">0'+(s.ch+1)+'</span><span><small>任務區 '+(s.ch+1)+'</small><b>'+CHAPS[s.ch]+'</b></span></div><span class="hud-step">第 '+chapterPlace+'／'+chapterIndices.length+' 步</span><span class="pc">課程 '+m.progress+'%</span>'+(r.attempt>1?'<span class="badge">第 '+r.attempt+' 次練習</span>':'')+'</div><div class="track"><div class="fill" style="width:'+m.progress+'%"></div></div><div class="chapter-dots">'+CHAPS.map((name,k)=>{const done=!!r.q['check-'+(k+1)]?.ok;return '<span class="'+(done?'done':k===s.ch?'current':'')+'" title="'+esc(name)+'">'+(done?'✓':k+1)+'</span>';}).join('')+'</div></div><div class="toolbar quest-toolbar"><span class="toolbar-icon">🗺️</span><label for="chapter-select">切換任務區</label><select id="chapter-select">'+CHAPS.map((name,k)=>'<option value="'+CHAPTER_STARTS[k]+'" '+(k===s.ch?'selected':'')+'>第 '+(k+1)+' 章 · '+esc(name)+'</option>').join('')+'</select><span class="toolbar-note">六區皆可自由選擇</span></div>'; if(returnTo!==null&&r.step>=returnTo)returnTo=null;
 if(returnTo!==null)html+='<p class="reviewback"><button type="button" id="review-return" class="btn">看完了，回到第 '+(returnTo+1)+' 步「'+esc(STEPS[returnTo].h||'')+'」繼續作答</button></p>';
 html+='<section class="panel quest-panel"><header class="mission-heading"><div class="quest-label"><span>🧭 任務進行中</span><span>第 '+(chapterPlace)+' 步</span></div><div class="lesson-kicker">'+(s.checkpoint?'章末檢核 · '+CHAPS[s.ch]:'第 '+(s.ch+1)+' 關 · '+CHAPS[s.ch])+'</div><h2 tabindex="-1" id="step-heading">'+esc(s.h||'資料任務')+'</h2></header>'+(s.visual&&s.id!=='card-values'?chapterVisual(s.visual):'');
 if(!q.ok)html+=mascotBubble(mascotPrompt(s,q),q.submissions?'thinking':'curious');
 if(s.id==='card-combinations')html+='<aside class="combo-guide"><b>怎麼算一種組合？</b><p>三張卡都要各回答一次「有」或「沒有」。例如：有／沒有／有，就是其中一種回答組合。</p><p class="combo-think">再想想看：換成其他回答時，會不會又是新的組合？</p></aside>';
 if(s.guide)html+='<div class="guide"><b>任務說明</b><p>'+esc(s.guide)+'</p></div>';
 if(s.checkpoint)html+='<div class="checkpoint-note"><b>章末檢核</b><span>可以看提示，也可以再試幾次。答錯不扣分。</span></div>';
 if(s.t==='story'&&!s.steps)html+='<p class="meta">準備好就繼續。</p>';
 if(s.t==='cards')html+=cardsHtml();
 if(s.t==='mile')html+='<div class="learned"><h3>你剛剛學會的</h3><ul>'+s.learned.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></div>'+(s.why?'<p>電腦電路用容易區分的兩種狀態表示 0 與 1，讓資料更容易可靠地保存與處理。</p>':'')+(s.cards?'<h3>對照五張卡</h3><p class="meta">邊看說明邊對照：每張卡的金色數字就是它的位值。</p>'+cardsHtml():'');
 if(s.recap){
  const rounds=[['第一次','trick'],['第二次','trick2']].map(([label,id])=>[label,r.q[id]?.answer]).filter(([,a])=>Array.isArray(a)&&a.length===5);
  if(rounds.length)html+='<div class="recap"><h3>你回答的線索與小波算出的結果</h3>'+rounds.map(([label,a])=>'<p><b>'+label+'</b>：解碼結果是 <b>'+a.reduce((n,x,k)=>n+(x?2**k:0),0)+'</b></p><div class="bits">'+a.map((x,k)=>'<div class="'+(x?'on':'')+'"><small class="cardname">卡片 '+(k+1)+'</small><b>'+(x?'有':'沒有')+'</b></div>').join('')+'</div>').join('')+'</div>';
 }
 if(s.steps)html+='<ol class="ladder">'+s.steps.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ol>';
 if(s.id==='card-values')html+='<h3>先看這五張卡</h3><p class="meta">金色框線標出每張卡左上角的代表值。對照卡片，再依序輸入這五個數字。</p>'+cardsHtml();
 if(s.ask)html+='<p class="ask">'+esc(fill(s.ask,p))+'</p>';
 if(s.review&&!q.ok){
  const targets=s.review.map(v=>STEPS.findIndex(x=>x.id===v||x.t===v)).filter(k=>k>=0&&k<r.step);
  if(targets.length)html+='<div class="reviewlinks">'+targets.map(k=>'<button type="button" class="plain" data-review="'+k+'">回到第 '+(k+1)+' 步「'+esc(STEPS[k].h||'')+'」看看</button>').join('')+'</div>';
 }
 if(s.t==='conv')html+=conversionPuzzle(p,q);
 if(s.t==='text'){
  if(s.id==='d1')html+='<p class="ask">把字母 <b>'+esc(p.letter)+'</b> 的編號 '+p.code+' 寫成 8 個 0 和 1。</p>';
  if(s.id==='d2')html+='<p class="ask">解開兩組位元，輸入這兩個字母。請注意大寫、小寫：<br><code>'+esc(p.bits)+'</code></p>';
  if(s.tool)html+=s.id==='d2'?'<div class="byte-pair">'+byteTool('d2a','第 1 組位元')+byteTool('d2b','第 2 組位元')+'</div>':byteTool(s.id)+(s.id==='d1'&&!q.ok?'<button type="button" id="tool-copy" class="plain">把 8 格結果填入答案</button>':'');
  if(s.table)html+=letterTable();
  html+='<form id="answer-form" class="ansrow"><input id="answer" aria-label="你的答案" maxlength="160" placeholder="'+esc(s.ph||(s.id==='d1'?'例如 01000001':s.id==='d2'?'輸入兩個字母':'輸入數字'))+'" value="'+esc(q.answer||'')+'" '+(q.ok?'disabled':'')+'><button '+(q.ok?'disabled':'')+'>檢查答案</button></form>';
  html+='<p class="meta">不確定時可以打開提示，再試一次。</p>';
 }
 if(s.t==='opt')html+='<div class="opts">'+optionOrder(r.attemptId,s.id,s.opts.length).map(k=>'<button data-opt="'+k+'" class="'+(q.answer===k?'sel':'')+'" '+(q.ok?'disabled':'')+'>'+esc(s.opts[k])+'</button>').join('')+'</div><p class="meta">選一個答案試試；答錯可以再選，不扣分。</p>';
 if(s.t==='build'){
  html+=bitPuzzle(p,q);
 }
 if(s.t==='trick'){
  const a=q.answer||[];
  if(!a.length&&!trickReady[s.id])html+='<p class="ask">'+(s.practice?'再挑一個不同的數字試試。':'小波準備了五張資料卡。')+'先觀察卡片，再選一個 0 到 31 的數字，看看回答線索能不能讓我們把它解出來。</p>'+cardsHtml()+'<button id="trick-ready" class="btn">準備好了，查看線索</button>';
  else if(a.length<5){html+='<p>看看小波的解碼線索：這張卡有沒有你的數字？（第 '+(a.length+1)+' 張）</p>'+card(CARDS[a.length])+'<div class="yn"><button id="yes">有這個數字</button><button id="no">沒有</button></div>';}
  else html+='<div class="bigreveal"><p>線索組合出的數字</p><div class="n">'+a.reduce((n,x,k)=>n+(x?2**k:0),0)+'</div></div>'+(!q.ok?'<button id="confirm-trick" class="btn">我看過結果了</button>':'<p class="fb yes">解碼完成。</p>');
 }
 if(s.t==='pixel'){
  const bits=q.answer||'0'.repeat(64);
  html+='<p>照著上方的 0 和 1 還原笑臉。<b>1 是亮格，0 是暗格。</b>可以點一下切換，也可以按住滑鼠拖過多格。</p><div class="pixel-source">'+HEART.join('<br>')+'</div><div class="pix" id="grid" aria-label="8 乘 8 像素畫布">'+[...bits].map((b,k)=>'<button data-pixel="'+k+'" class="'+(b==='1'?'lit':'')+'" aria-label="第 '+(Math.floor(k/8)+1)+' 列第 '+(k%8+1)+' 格：'+(b==='1'?'1 亮':'0 暗')+'" aria-pressed="'+(b==='1')+'" '+(q.ok?'disabled':'')+'></button>').join('')+'</div><button id="confirm-pixel" class="plain" '+(q.ok?'disabled':'')+'>檢查圖案</button>';
 }
 if(s.t==='wave')html+='<div class="sound-game-intro"><b>任務：幫小波修復音效</b><p>灰線是原本的聲音，橘線是把快照連起來後拼出的聲音。試著調整每段音效拍幾張快照。</p></div><canvas id="wave" width="900" height="250" aria-label="灰色原音波形和橘色快照復原波形"></canvas><label for="sample">快照數：<b id="sample-value">'+(q.answer||16)+'</b></label><input id="sample" type="range" min="3" max="64" value="'+(q.answer||16)+'" '+(q.ok?'disabled':'')+'><div class="sound-range-hints"><span><b>快照少</b>：復原較粗略</span><span><b>快照多</b>：能保留較多變化</span></div><p>已觀察：快照少時 '+(q.low?'✓':'○')+'　·　快照多時 '+(q.high?'✓':'○')+'</p><button id="confirm-wave" class="plain" '+(q.ok?'disabled':'')+'>完成修復</button>';
 if(isAction(s)&&s.t!=='trick'){
  if(q.ok)html+='<p class="fb yes">完成！'+esc(fill(s.ok,p)||'結果正確。')+'</p>'+mascotBubble(s.checkpoint?'太棒了，這章的線索都被你破解了！':'答對啦！小波把這個線索記下來了。','happy')+(s.checkpoint?mascotReward(s.ch):'');
  else if(q.submissions)html+='<p class="fb no">還沒答對，沒關係。看看提示或回想範例，再試一次；練習不扣分。</p>';
  let hints=s.hints||[];
  if(s.t==='conv')hints=['只加位元是 1 的位置值；位元是 0 的位置先跳過。','從右往左的位置值是 '+Array.from({length:p.n},(_,i)=>2**i).join('、')+'。'];
  if(s.t==='build')hints=[p.n+' 格的位置值由左到右是 '+Array.from({length:p.n},(_,i)=>2**(p.n-i-1)).join('、')+'。','看目標數字需要哪些位置值；需要的格子點成 1，其餘保持 0。'];
  const used=q.hints||0,limit=hintLimit(s);
  if(hints.length)html+='<button id="hint" class="hintbtn" '+(q.ok||used>=limit?'disabled':'')+'>'+(used>=limit?'提示都看完了':'看提示 '+(used+1)+'／'+limit)+'</button>'+hints.slice(0,used).map((h,i)=>'<div class="hintout"><b>提示 '+(i+1)+':</b> '+esc(h)+'</div>').join('');
 }
 if(s.t==='final')html+='<div class="finish-summary"><b>六章回顧</b><ol>'+CHAPS.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol></div>'+(m.checkpoints===m.checkpointTotal?'<button id="finish" class="btn" '+(r.completed?'disabled':'')+'>'+(r.completed?'已記錄完成':'完成課程並保存紀錄')+'</button>':'<p class="checkpoint-note">還有 '+(m.checkpointTotal-m.checkpoints)+' 個章末檢核未完成。可以用上方選單前往其他章練習。</p><button class="btn" disabled>完成全部章末檢核後即可保存完成紀錄</button>')+(r.completed?'<div class="retrybox"><p><b>想再練一次？</b>重玩會換新的數字和字母。之前的最高檢核分數會保留。</p><button id="retry-course" class="btn">重新玩六章</button></div>':'');
 html+='<div class="nav"><button id="back" '+(r.step===0?'disabled':'')+'>上一步</button>'+(s.skip&&!q.ok?'<button id="skip">先跳過（不算答對）</button>':'')+(r.step<STEPS.length-1?'<button id="next" class="go" '+(isAction(s)&&!q.ok&&!q.skipped?'disabled':'')+'>'+esc(s.go||'繼續 →')+'</button>':'')+'</div></section>'+scorePanel(record);
 if(extrasHTML)html+='<div id="student-extras">'+extrasHTML+'</div>';
 $('#app').innerHTML=html;
 if($('#logout'))$('#logout').onclick=async()=>{await cloud.logout();extrasHTML='';loginScreen();};
 if(shownStep!==r.step){shownStep=r.step;window.scrollTo(0,0);}
 $('#chapter-select').onchange=e=>send('navigate',null,+e.target.value);
 $('#back').onclick=()=>send('navigate',null,r.step-1);
 if($('#next'))$('#next').onclick=()=>send('next');
 if($('#skip'))$('#skip').onclick=()=>send('skip');
 if($('#hint'))$('#hint').onclick=()=>send('hint');
 if($('#finish'))$('#finish').onclick=()=>send('finish');
 if($('#retry-course'))$('#retry-course').onclick=()=>{if(!confirm('重新開始六關？會換一組練習題；以前的最高檢核分數會保留。'))return;send('retry');};
 if($('#qtime')&&!q.ok)tickTimer=setInterval(()=>{const el=$('#qtime'),st=record?.state;if(el&&st)el.textContent=fmt(liveMs(st,STEPS[st.step]));},1000);
 if($('#answer-form'))$('#answer-form').onsubmit=e=>{e.preventDefault();send('submit',$('#answer').value);};
 document.querySelectorAll('[data-opt]').forEach(b=>b.onclick=()=>send('submit',+b.dataset.opt));
 document.querySelectorAll('[data-conv-bit]').forEach(b=>b.onclick=()=>{const value=+b.dataset.convBit,current=selectedConversionSum(p,q),selected=(current&value)!==0;send('draft',String(current+(selected?-value:value)));bounce(document.querySelector('[data-conv-bit="'+value+'"]'));});
 if($('#clear-conv'))$('#clear-conv').onclick=()=>send('draft','0');
 if($('#confirm-conv'))$('#confirm-conv').onclick=()=>send('submit',String(selectedConversionSum(p,q)));
 document.querySelectorAll('[data-bank-bit]').forEach(b=>{
  const flip=()=>{const v=[...(q.answer||'0'.repeat(p.n))],k=+b.dataset.bankBit;v[k]=v[k]==='1'?'0':'1';send('draft',v.join(''));bounce(document.querySelector('[data-bank-bit="'+k+'"]'));};
  b.onclick=flip;
 });
 document.querySelectorAll('[data-chip-bit]').forEach(b=>b.onclick=()=>{const v=[...(q.answer||'0'.repeat(p.n))];v[+b.dataset.chipBit]='0';send('draft',v.join(''));});
 if($('#build-drop')){$('#build-drop').ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';$('#build-drop').classList.add('drag-over');};$('#build-drop').ondragleave=()=>$('#build-drop').classList.remove('drag-over');$('#build-drop').ondrop=e=>{e.preventDefault();$('#build-drop').classList.remove('drag-over');const k=+e.dataTransfer.getData('text/plain'),v=[...(q.answer||'0'.repeat(p.n))];if(Number.isInteger(k)&&k>=0&&k<p.n&&v[k]==='0'){v[k]='1';send('draft',v.join(''));}};}
 if($('#clear-build'))$('#clear-build').onclick=()=>send('draft','0'.repeat(p.n));
 if($('#confirm-build'))$('#confirm-build').onclick=()=>send('submit',q.answer||'0'.repeat(p.n));
 document.querySelectorAll('[data-tool]').forEach(tool=>{
  const id=tool.dataset.tool;
  tool.querySelectorAll('[data-tbit]').forEach(b=>b.onclick=()=>{const v=[...(byteTools[id]||'00000000')],k=+b.dataset.tbit;v[k]=v[k]==='1'?'0':'1';byteTools[id]=v.join('');b.classList.toggle('on',v[k]==='1');b.setAttribute('aria-pressed',v[k]==='1');b.querySelector('b').textContent=v[k];const n=parseInt(byteTools[id],2);tool.querySelector('[data-tool-value]').textContent=n;tool.querySelector('[data-tool-glyph]').textContent=glyph(n);bounce(b);});
  tool.querySelector('.tool-clear').onclick=()=>{byteTools[id]='00000000';tool.querySelectorAll('[data-tbit]').forEach(b=>{b.classList.remove('on');b.setAttribute('aria-pressed','false');b.querySelector('b').textContent='0';});tool.querySelector('[data-tool-value]').textContent='0';tool.querySelector('[data-tool-glyph]').textContent='—';};
 });
 if($('#tool-copy'))$('#tool-copy').onclick=()=>{$('#answer').value=byteTools[s.id]||'00000000';$('#answer').focus();};
 if($('#yes')){$('#yes').onclick=()=>send('draft',[...(q.answer||[]),true]);$('#no').onclick=()=>send('draft',[...(q.answer||[]),false]);}
 if($('#trick-ready'))$('#trick-ready').onclick=()=>{trickReady[s.id]=true;renderStudent();};
 document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{returnTo=r.step;send('navigate',null,+b.dataset.review);});
 if($('#review-return'))$('#review-return').onclick=()=>send('navigate',null,returnTo);
 if($('#confirm-trick'))$('#confirm-trick').onclick=()=>send('submit',q.answer);
 if($('#grid')){
  let bits=[...(q.answer||'0'.repeat(64))],painting=false,mode='1',dirty=false;
  const paint=b=>{if(!b||q.ok)return;const k=+b.dataset.pixel;if(bits[k]===mode)return;bits[k]=mode;dirty=true;b.classList.toggle('lit',mode==='1');b.setAttribute('aria-pressed',mode==='1');b.setAttribute('aria-label',b.getAttribute('aria-label').replace(/：.*$/,'：'+(mode==='1'?'1 白色':'0 黑色')));};
  $('#grid').onpointerdown=e=>{const b=e.target.closest('[data-pixel]');if(!b||q.ok)return;painting=true;mode=bits[+b.dataset.pixel]==='1'?'0':'1';paint(b);e.preventDefault();};
  $('#grid').onpointermove=e=>{if(!painting)return;const b=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-pixel]');if(b)paint(b);};
  const end=()=>{if(!painting)return;painting=false;if(dirty){dirty=false;send('draft',bits.join(''));}};
  document.onpointerup=end;document.onpointercancel=end;
  document.querySelectorAll('[data-pixel]').forEach(b=>b.onclick=e=>{if(e.detail===0&&!q.ok){mode=bits[+b.dataset.pixel]==='1'?'0':'1';paint(b);send('draft',bits.join(''));}});
  $('#confirm-pixel').onclick=()=>send('submit',bits.join(''));
 }else{document.onpointerup=null;document.onpointercancel=null;}
 if($('#sample')){$('#sample').oninput=e=>{$('#sample-value').textContent=e.target.value;drawWave(+e.target.value);};$('#sample').onchange=e=>send('draft',+e.target.value);$('#confirm-wave').onclick=()=>send('submit',+(q.answer||16));drawWave(q.answer||16);}
}
async function appendStudentExtras(){
 try{
  const members=await cloud.classes();let html='';
  for(const m of members){
   const c=m.classes;if(!c)continue;
   const rows=await cloud.leaderboard(c.id),active=rows.filter(r=>r.updated_at&&!r.completed).length,completed=rows.filter(r=>r.completed).length;
   html+='<section class="panel board-panel"><h3>'+esc(c.name)+' 班級排行</h3><div class="board-stats"><div><b>'+active+'</b><span>進行中</span></div><div><b>'+completed+'</b><span>已完成</span></div><div><b>'+rows.length+'</b><span>班級人數</span></div></div><p class="meta board-note">進行中表示已開始學習、尚未完成；這不是即時在線人數。</p><div class="scroll"><table class="board"><thead><tr><th>名次</th><th>座號</th><th>分數</th><th>狀態</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.display_name)+'</td><td>'+r.score+'</td><td>'+(r.completed?'已完成':r.updated_at?'進行中':'尚未開始')+'</td></tr>').join('')+'</tbody></table></div></section>';
  }
  const old=$('#student-extras');
  if(old)old.innerHTML=html;
  else if($('#app'))$('#app').insertAdjacentHTML('beforeend','<div id="student-extras" class="student-rank-column standalone">'+html+'</div>');
 }catch(e){status('班級資料載入失敗：'+e.message);}
}
function card(c){return '<div class="cardbox"><div class="hd">卡片 '+(c.i+1)+'</div><div class="nums">'+c.list.map(n=>'<span class="'+(n===c.value?'key':'')+'">'+n+'</span>').join('')+'</div></div>';}
function drawWave(n){
 const c=$('#wave'),g=c.getContext('2d'),w=c.width,h=c.height,f=x=>h/2-Math.sin(x/w*Math.PI*4)*h*.3-Math.sin(x/w*Math.PI*9)*h*.09;
 g.clearRect(0,0,w,h);g.lineWidth=3;g.strokeStyle='#888';g.beginPath();for(let x=0;x<=w;x+=2)x?g.lineTo(x,f(x)):g.moveTo(x,f(x));g.stroke();
 g.strokeStyle='#b88b36';g.beginPath();for(let k=0;k<n;k++){const x=k/(n-1)*w;k?g.lineTo(x,f(x)):g.moveTo(x,f(x));}g.stroke();
}
$('#reset').onclick=()=>{
 if(!confirm('清除這個座號的雲端學習紀錄，重新開始？'))return;
 course.reset();record=null;cloud.deleteProgress().then(()=>{startScreen();status('進度已清除。');}).catch(e=>status('無法清除雲端進度：'+e.message));
};
if(cloud.configured())boot().catch(e=>{status('雲端服務連線失敗：'+e.message);loginScreen(e.message);});
else loginScreen('請先在 cloud-config.js 填入 Supabase URL 與 anon key。');
