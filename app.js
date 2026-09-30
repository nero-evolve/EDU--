// Student course and teacher dashboard for the Bit Explorers class site.
import {STEPS,CARDS,HEART,CHAPS,problems,optionOrder,hintLimit} from './content.js';
import * as course from './engine.js';
import * as cloud from './cloud.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let record=null,tickTimer=null,extrasHTML='';
const byteTools={},trickReady={};
let returnTo=null,shownStep=null;
const errors={COURSE_REVISION_CONFLICT:'另一個分頁已經更新了進度。請重新載入這一頁再繼續。',
COURSE_STEP_CONFLICT:'目前步驟已在另一個分頁變更，請重新載入這一頁。',
COURSE_NOT_STARTED:'找不到這台電腦上的進度，請重新載入這一頁。',
COURSE_STEP_LOCKED:'請先完成目前這一步（重刷需先完成一次活動）。'};
function status(text){$('#sync').textContent=text;}
function savedStatus(){
 status(record.persisted===false?'這個瀏覽器不允許儲存資料：可以繼續玩，但關閉頁面後進度會消失。':'進度已存在這台電腦的瀏覽器 · '+new Date(record.updatedMs).toLocaleTimeString('zh-TW'));
}
function send(kind,value=null,step=record?.state?.step||0){
 try{record=course.event({revision:record?.revision||0,kind,step,value});savedStatus();renderStudent();cloud.saveProgress(record).catch(e=>status('雲端同步失敗：'+esc(e.message)+'（本機進度仍保留）'));}
 catch(e){
  status((errors[e.code]||'這一步沒有完成，請重新載入這一頁再試。')+' ');
  $('#sync').insertAdjacentHTML('beforeend','<button id="reload" class="plain">重新載入</button>');
  $('#reload').onclick=()=>location.reload();
 }
}
function loginScreen(message='',teacherMode=false){
 $('#reset').hidden=true;
 $('#app').innerHTML='<section class="panel auth-panel"><h1>'+(teacherMode?'教師登入':'學生登入')+'</h1><p>'+(teacherMode?'教師請使用已開通的 Email 帳號。':'輸入班級座號即可開始；例如 90230 代表 902 班 30 號。登入後進度會同步，換電腦也能繼續。')+'</p><form id="auth-form" class="auth-form">'+(teacherMode?'<label>Email<input name="email" type="email" autocomplete="username" required></label><label>密碼<input name="password" type="password" autocomplete="current-password" required></label>':'<label>班級座號<input name="seat" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="例如 90230" autocomplete="username" required></label>')+'<p class="err">'+esc(message)+'</p><button class="btn">'+(teacherMode?'登入教師後台':'開始學習')+'</button></form><button id="login-mode" class="plain">'+(teacherMode?'返回學生登入':'教師登入')+'</button></section>';
 $('#login-mode').onclick=()=>loginScreen('',!teacherMode);
 $('#auth-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{status('正在登入…');if(teacherMode)await cloud.login(f.get('email'),f.get('password'));else await cloud.loginSeat(String(f.get('seat')||'').trim());await boot();}catch(err){loginScreen(err.message,teacherMode);}};
}
async function renderTeacher(profile){
 $('#reset').hidden=true;
 const links=await cloud.classes();let html='<div class="panel teacher"><h1>教師儀表板</h1><p>教師：'+esc(profile.display_name)+'　<button id="logout" class="plain">登出</button></p><h3>新增班級</h3><div class="row"><input id="new-class" placeholder="班級名稱（例如 902）"><input id="new-class-code" inputmode="numeric" maxlength="3" placeholder="三位班級碼"><button id="make-class">建立班級</button></div><p class="meta">學生座號前 3 碼需與班級碼相同，後 2 碼為座號。</p>';
 if(!links.length)html+='<p>尚未建立班級。先建立三位數班級碼，例如 902。</p>';
 for(const link of links){const c=link.classes;if(!c)continue;const rows=await cloud.teacherClass(c.id);html+='<h2>'+esc(c.name)+' <small>班級碼：'+esc(c.class_code||'尚未設定')+'</small></h2><div class="scroll"><table><thead><tr><th>座號</th><th>進度</th><th>分數</th><th>完成</th><th>教師評語</th></tr></thead><tbody>'+rows.map(s=>{const x=s.state?.metrics||{};return '<tr><td>'+esc(s.display_name)+'</td><td>'+(x.progress??0)+'%</td><td>'+(x.score??'—')+'</td><td>'+((s.state?.state?.completed)?'完成':'進行中')+'</td><td><textarea data-comment="'+esc(s.student_id)+'" data-class="'+esc(c.id)+'" maxlength="2000">'+esc(s.teacher_comment||'')+'</textarea><button data-save-comment="'+esc(s.student_id)+'" data-class="'+esc(c.id)+'">儲存評語</button></td></tr>';}).join('')+'</tbody></table></div>';}
 html+='</div>';$('#app').innerHTML=html;$('#logout').onclick=async()=>{await cloud.logout();loginScreen();};$('#make-class').onclick=async()=>{try{await cloud.createClass($('#new-class').value,$('#new-class-code').value);await boot();}catch(e){status(e.message);}};document.querySelectorAll('[data-save-comment]').forEach(b=>b.onclick=async()=>{const f=document.querySelector('textarea[data-comment="'+b.dataset.saveComment+'"][data-class="'+b.dataset.class+'"]');try{await cloud.comment(b.dataset.saveComment,b.dataset.class,f.value);status('評語已儲存。');}catch(e){status(e.message);}});
}
async function boot(){
 const s=await cloud.session();if(!s){loginScreen();return;}const p=await cloud.profile();
 if(p.role==='teacher'){await renderTeacher(p);status('教師帳號已登入。');return;}
 if(!s.user?.email?.endsWith('@students.example.com')){await cloud.logout();loginScreen('學生請使用五位數班級座號登入。');return;}
 const remote=await cloud.loadProgress();if(remote)record=course.restore(remote);else{course.reset();record=course.mine();status('進度尚未開始；完成第一個動作後會同步到雲端。');startScreen();}if(remote){savedStatus();renderStudent();}await appendStudentExtras();
}
function startScreen(){
 clearInterval(tickTimer);shownStep=null;
 $('#app').innerHTML='<div id="cover"><img class="cover-art" src="./images/karl-cover.webp" alt="位元探險隊走進資料實驗室"><div class="ticket"><p class="eyebrow">資料實驗室 · 探索任務</p><h1>位元探險隊</h1><p class="story">我是小波，今天邀你一起破解數字、文字、圖片和聲音裡的資料線索。先從五張數字卡開始吧！</p><button id="start" class="btn">開始解碼</button><p class="note">登入座號即可同步進度，換電腦也能接著完成<br>選擇題答錯每次扣 1 分；其他題可訂正<br>單題提示全部用完才扣 1 分</p></div></div>';
 $('#start').onclick=()=>send('start');
}
const fmt=ms=>{const t=Math.max(0,Math.round((ms||0)/1000)),h=Math.floor(t/3600),m=Math.floor(t%3600/60),x=t%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0');};
const timedStep=s=>['opt','text','conv','build'].includes(s.t);
const liveMs=(r,s)=>{const q=r.q[s.id]||{};return (q.activeMs||0)+(q.ok||!Number.isFinite(r.sinceMs)?0:Math.min(Math.max(0,Date.now()-r.sinceMs),record?.segmentCapMs||300000));};
function scorePanel(v){
 const m=v.metrics,f=v.feedback,attempt=v.state?.attempt||1;
 if(!m)return '';
 return '<div class="panel"><h3>我的學習紀錄</h3><p class="grade">'+(v.first?'首次完成分數':'目前累計分數')+' '+v.finalScore+'／100</p><p>'+(attempt>1?'這次練習 ':'首次作答 ')+m.score+'／100 · 作答時間 '+fmt(m.timeMs)+(attempt>1?' · 第 '+attempt+' 次作答':'')+'</p>'+(v.best?'<p>個人最佳：'+v.best.score+' 分 · 用時 '+fmt(v.best.timeMs)+'（第 '+v.best.attempt+' 次）</p>':'')+'<p>概念題 '+m.concepts+'/18 · 位元組合 '+m.binary+'/5 · 操作任務 '+m.activities+'/3'+(m.choicePenalty?' · 選擇題錯答扣 '+m.choicePenalty+' 分':'')+(m.hintPenalty?' · 提示用盡扣 '+m.hintPenalty+' 分':'')+'</p><p>完成 '+m.done+'/'+m.totalSteps+' 步（'+m.progress+'%） · 最遠到達第 '+m.reached+' 步 · 略過 '+m.skipped+' 題</p><details><summary>計分方式與作答摘要</summary><p>概念題共 70 分，五題位元組合共 15 分，三項操作任務各 5 分。選擇題答錯一次扣 1 分；其他題目可訂正。單題提示全部看完才扣 1 分。計時題時間只用於和自己的紀錄比較，不影響分數；離開超過 5 分鐘只計 5 分鐘。</p><p>提交 '+m.submissions+' 次 · 訂正 '+m.corrected+' 題 · 選擇題錯答 '+m.choicePenalty+' 次 · 使用提示 '+m.hints+' 次</p><p>這是可使用提示與訂正的學習活動紀錄，不等同獨立測驗。</p></details><div class="report"><b>學習回饋</b><p>'+esc(f.strength)+'</p><p>'+esc(f.advice)+'</p><p>'+esc(f.comment)+'</p></div></div>';
}
const isAction=s=>['text','opt','conv','build','trick','pixel','wave'].includes(s.t);
const fill=(text,p)=>String(text||'').replace(/\{(letter|code|bits|word|value|parts)\}/g,(_,k)=>k==='parts'?[...(p?.bits||'')].map((b,i,a)=>b==='1'?2**(a.length-1-i):0).filter(Boolean).join(' + '):p?.[k]??'');
const cardsHtml=(highFirst=false)=>'<div class="cardgrid">'+(highFirst?[...CARDS].reverse():CARDS).map(c=>card(c)).join('')+'</div>';
const CN=['零','一','二','三','四','五','六','七','八'];
const glyph=n=>n>=33&&n<=126?String.fromCharCode(n):n===32?'空白':'—';
function byteTool(id){
 const bits=byteTools[id]||'00000000',value=parseInt(bits,2);
 return '<div class="bytetool" data-tool="'+esc(id)+'"><p class="meta">8 格工具：點格子切換 0 和 1（這裡只是計算用，不會送出）</p><div class="bits">'+[...bits].map((b,k)=>'<button type="button" data-tbit="'+k+'" aria-pressed="'+(b==='1')+'" class="'+(b==='1'?'on':'')+'"><small>'+2**(7-k)+'</small><b>'+b+'</b></button>').join('')+'</div><p class="tally">數字 = <b id="tool-value">'+value+'</b> · 對應符號：<b id="tool-glyph">'+esc(glyph(value))+'</b></p></div>';
}
function letterTable(){
 const row=(from,to)=>{let h='';for(let n=from;n<=to;n++)h+='<span><b>'+String.fromCharCode(n)+'</b><small>'+n+'</small></span>';return h;};
 return '<div class="lettertable"><p class="meta">字母編號表（大寫 A=65 起，小寫 a=97 起）</p><div class="letters">'+row(65,90)+'</div><div class="letters">'+row(97,122)+'</div></div>';
}
function renderStudent(){
 $('#reset').hidden=false;
 clearInterval(tickTimer);
 if(!record?.state)return startScreen();
 const r=record.state,s=STEPS[r.step],q=r.q[s.id]||{},m=record.metrics,all=problems(r.attemptId),p=all[s.id];
 let html='<div class="top"><div class="toprow"><b>第 '+(s.ch+1)+' 章 · '+CHAPS[s.ch]+'</b><span>第 '+(r.step+1)+'／'+STEPS.length+' 步</span><span class="pc">'+m.progress+'%</span>'+(r.attempt>1?'<span class="badge">第 '+(r.attempt-1)+' 次重練</span>':'')+'</div><div class="track"><div class="fill" style="width:'+m.progress+'%"></div></div></div><div class="toolbar"><label for="step-select">回顧已到達步驟</label><select id="step-select">'+STEPS.slice(0,r.maxStep+1).map((x,k)=>'<option value="'+k+'" '+(k===r.step?'selected':'')+'>'+(k+1)+' · '+esc(x.h||'資料卡任務')+'</option>').join('')+'</select></div>';
 if(returnTo!==null&&(r.step>=returnTo||returnTo>r.maxStep))returnTo=null;
 if(returnTo!==null)html+='<p class="reviewback"><button type="button" id="review-return" class="btn">看完了，回到第 '+(returnTo+1)+' 步「'+esc(STEPS[returnTo].h||'')+'」繼續作答</button></p>';
 html+='<section class="panel"><h2 tabindex="-1" id="step-heading">'+esc(s.h||'想一個 0 到 31 的數字')+'</h2>'+(timedStep(s)?'<p class="timer">本題用時 <b id="qtime">'+fmt(liveMs(r,s))+'</b>'+(q.ok?'（已完成）':'')+'</p>':'')+(s.art?'<img class="banner" src="./images/'+esc(s.art)+'.webp" alt="" width="1024" height="572">':'');
 if(s.t==='final')html+='<img class="finale-art" src="./images/karl-finale.webp" alt="小波與探險隊整理數位資料的線索">';
 if(s.guide)html+=s.t==='final'?'<p class="guide"><b>小波：</b>'+esc(s.guide)+'</p>':'<div class="karlrow"><img class="karl-face" src="./images/karl-portrait.webp" alt="" width="72" height="72"><p class="guide"><b>小波：</b>'+esc(s.guide)+'</p></div>';
 if(s.t==='story'&&!s.steps)html+='<p class="meta">準備好就繼續。</p>';
 if(s.t==='cards')html+=cardsHtml();
 if(s.t==='mile')html+='<div class="learned"><h3>你剛剛學會的</h3><ul>'+s.learned.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></div>'+(s.why?'<p>電腦電路用容易區分的兩種狀態表示 0 與 1，讓資料更容易可靠地保存與處理。</p>':'')+(s.cards?'<h3>對照五張卡</h3><p class="meta">邊看說明邊對照：每張卡的金色數字就是它的位值。</p>'+cardsHtml():'');
 if(s.recap){
  const rounds=[['第一次','trick'],['第二次','trick2']].map(([label,id])=>[label,r.q[id]?.answer]).filter(([,a])=>Array.isArray(a)&&a.length===5);
  if(rounds.length)html+='<div class="recap"><h3>你回答的線索與小波算出的結果</h3>'+rounds.map(([label,a])=>'<p><b>'+label+'</b>：解碼結果是 <b>'+a.reduce((n,x,k)=>n+(x?2**k:0),0)+'</b></p><div class="bits">'+a.map((x,k)=>'<div class="'+(x?'on':'')+'"><small class="cardname">卡片 '+(k+1)+'</small><b>'+(x?'有':'沒有')+'</b></div>').join('')+'</div>').join('')+'</div>';
 }
 if(s.steps)html+='<ol class="ladder">'+s.steps.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ol>';
 if(s.ask)html+='<p class="ask">'+esc(fill(s.ask,p))+'</p>';
 if(s.review&&!q.ok){
  const targets=s.review.map(v=>STEPS.findIndex(x=>x.id===v||x.t===v)).filter(k=>k>=0&&k<r.step);
  if(targets.length)html+='<div class="reviewlinks">'+targets.map(k=>'<button type="button" class="plain" data-review="'+k+'">回到第 '+(k+1)+' 步「'+esc(STEPS[k].h||'')+'」看看</button>').join('')+'</div>';
 }
 if(s.t==='text'||s.t==='conv'){
  if(s.t==='conv'){
   const bits=[...p.bits].map(Number),n=bits.length;
   if(s.raw)html+='<p>把這排二進位換成十進位（速記寫法：('+p.bits+')₂）：</p>';
   else html+='<p class="ask">輪到你解碼了。這位顧客的數字會出現在 '+CN[n]+' 張卡中的某些卡片上。把每張卡的回答依序記成 1 或 0：<b>有這個數字記 1</b>，<b>沒有記 0</b>。</p><p>格子下方是卡片的位值。將所有標記 1 的位值相加，就能還原顧客的數字；標記 0 的位置不必加。</p>';
   if(s.id==='a1')html+='<p class="meta"><b>位元排列提醒：</b>卡片位值由小到大是 1、2、4、8、16；寫成二進位時，最大的位值放左側，最小的放右側。因此左到右對應 16、8、4、2、1。每個位置的規則不變：1 代表採用該位值，0 代表略過。</p>';
   html+='<div class="bits">'+bits.map((b,k)=>'<div class="'+(b?'on':'')+'">'+(s.raw?'':'<small class="cardname">卡片 '+(n-k)+'</small>')+'<b>'+b+'</b><small>'+2**(n-1-k)+'</small>'+(s.raw?'':'<em class="inout">'+(b?'在':'不在')+'</em>')+'</div>').join('')+'</div>';
   if(p.n===5)html+='<details class="cardref"><summary>打開五張卡對照（由左到右是卡片 5 到卡片 1，和上面的格子對齊）</summary>'+cardsHtml(true)+'</details>';
  }
  if(s.tool)html+=byteTool(s.id)+(s.id==='d2'&&!q.ok?'<button type="button" id="tool-copy" class="plain">把 8 格結果填入答案</button>':'');
  if(s.table)html+=letterTable();
  html+='<form id="answer-form" class="ansrow"><input id="answer" aria-label="你的答案" maxlength="160" '+(s.ph?'placeholder="'+esc(s.ph)+'"':'')+' value="'+esc(q.answer||'')+'" '+(q.ok?'disabled':'')+'><button '+(q.ok?'disabled':'')+'>確認答案</button></form>';
  html+='<p class="meta">可輸入全形或半形；英文字母大小寫仍依題目判別。</p>';
 }
 if(s.t==='opt')html+='<div class="opts">'+optionOrder(r.attemptId,s.id,s.opts.length).map(k=>'<button data-opt="'+k+'" class="'+(q.answer===k?'sel':'')+'" '+(q.ok?'disabled':'')+'>'+esc(s.opts[k])+'</button>').join('')+'</div><p class="meta">請先看清楚題目再作答：點選選項就會提交，每猜錯一次扣 1 分。每次作答的選項順序不同。</p>';
 if(s.t==='build'){
  const bits=q.answer||'0'.repeat(p.n);
  html+='<p class="ask">要表示 <b>'+p.value+'</b>，應選哪些位置？完成後按「確認答案」。</p><p class="meta">提醒：每個數字的二進位組合只有一種（唯一性）。從最大的位值開始想，就不會選錯。</p><div class="bits">'+[...bits].map((b,k)=>'<button data-bit="'+k+'" aria-pressed="'+(b==='1')+'" class="'+(b==='1'?'on':'')+'" '+(q.ok?'disabled':'')+'><b>'+b+'</b><small>'+2**(p.n-k-1)+'</small></button>').join('')+'</div><p class="tally">目前合計 '+parseInt(bits,2)+'</p><button id="confirm-build" class="plain" '+(q.ok?'disabled':'')+'>確認答案</button>';
 }
 if(s.t==='trick'){
  const a=q.answer||[];
  if(!a.length&&!trickReady[s.id])html+='<p class="ask">'+(s.practice?'再挑一個不同的數字試試。':'小波準備了五張資料卡。')+'先觀察卡片，再選一個 0 到 31 的數字，看看回答線索能不能讓我們把它解出來。</p>'+cardsHtml()+'<button id="trick-ready" class="btn">準備好了，查看線索</button>';
  else if(a.length<5){html+='<p>看看小波的解碼線索：這張卡有沒有你的數字？（第 '+(a.length+1)+' 張）</p>'+card(CARDS[a.length])+'<div class="yn"><button id="yes">有這個數字</button><button id="no">沒有</button></div>';}
  else html+='<div class="bigreveal"><p>線索組合出的數字</p><div class="n">'+a.reduce((n,x,k)=>n+(x?2**k:0),0)+'</div></div>'+(!q.ok?'<button id="confirm-trick" class="btn">我看過結果了</button>':'<p class="fb yes">解碼完成。</p>');
 }
 if(s.t==='pixel'){
  const bits=q.answer||'0'.repeat(64);
  html+='<p>按照資料還原圖案：<b>1 是白色（這格亮）</b>，<b>0 是黑色（這格暗）</b>。每一格一開始都是 0（黑色），點一下變成 1（白色）。可點選、拖曳，或用 Tab 與空白鍵操作。</p><div class="binrows">'+HEART.join('<br>')+'</div><div class="pix" id="grid">'+[...bits].map((b,k)=>'<button data-pixel="'+k+'" class="'+(b==='1'?'lit':'')+'" aria-label="第 '+(Math.floor(k/8)+1)+' 列第 '+(k%8+1)+' 格：'+(b==='1'?'1 白色':'0 黑色')+'" aria-pressed="'+(b==='1')+'" '+(q.ok?'disabled':'')+'></button>').join('')+'</div><button id="confirm-pixel" class="plain" '+(q.ok?'disabled':'')+'>確認圖案</button>';
 }
 if(s.t==='wave')html+='<p>灰色是原始聲音曲線，金色是電腦取樣後連起來的折線。</p><ol class="ladder"><li>把滑桿<b>拉到最左邊</b>（取樣最少，3～5 點），看金色折線和灰色曲線差多少。</li><li>再把滑桿<b>拉到最右邊</b>（取樣最多，60～64 點），再比較一次。</li><li>兩種都看過後，按「確認觀察完成」。</li></ol><canvas id="wave" width="900" height="250" aria-label="取樣曲線比較"></canvas><label for="sample">取樣點數：<b id="sample-value">'+(q.answer||16)+'</b></label><input id="sample" type="range" min="3" max="64" value="'+(q.answer||16)+'" '+(q.ok?'disabled':'')+'><p>最少取樣 '+(q.low?'✔ 已觀察':'✘ 還沒拉到最左邊')+' · 最多取樣 '+(q.high?'✔ 已觀察':'✘ 還沒拉到最右邊')+'</p><button id="confirm-wave" class="plain" '+(q.ok?'disabled':'')+'>確認觀察完成</button>';
 if(isAction(s)&&s.t!=='trick'){
  if(q.ok)html+='<p class="fb yes">完成！'+esc(fill(s.ok,p)||'結果正確。')+'</p>';
  else if(q.submissions)html+='<p class="fb no">'+(s.t==='opt'?'還沒答對。選擇題每次猜錯都扣 1 分；本題目前已扣 '+(q.wrongSubmissions||0)+' 分。請看清楚題目再試。':'還沒完成，對照題目再試一次。這類題目訂正不扣分。')+'</p>';
  let hints=s.hints||[];
  if(s.t==='conv')hints=['只加寫著 1（在）的格子下面的小數字；寫著 0（不在）的跳過。','由右往左的位置值是 1、2、4、8、16、32、64、128。'];
  if(s.t==='build')hints=['從最大的位值開始，放得下就選，剩下的數再往下分。','也可以一直除以 2，將餘數由下往上讀。'];
  const used=q.hints||0,limit=hintLimit(s);
  if(hints.length)html+='<button id="hint" class="hintbtn" data-last="'+(used===limit-1)+'" '+(q.ok||used>=limit?'disabled':'')+'>'+(used>=limit?'提示已全部用完（本題扣 1 分）':used===limit-1?'看最後一個提示（'+used+'／'+limit+'，看了本題扣 1 分）':'提示 '+used+'／'+limit+'（全部用完才扣 1 分）')+'</button>'+hints.slice(0,used).map(h=>'<div class="hintout">'+esc(h)+'</div>').join('');
 }
 if(s.t==='final')html+='<p>你用一連串「有或沒有」，認識了數字、文字、圖片與聲音的表示方式。</p><button id="finish" class="btn" '+(r.completed?'disabled':'')+'>'+(r.completed?'已完成本次活動':'完成本次活動')+'</button>'+(r.completed?'<div class="retrybox"><p><b>想挑戰更快嗎？</b>重刷會換新的數字和選項順序，只重做選擇題和練習題並重新計時。第一次完成的分數會保留，另外記下你的最佳紀錄。</p><button id="retry-course" class="btn">重刷練習</button></div>':'');
 html+='<div class="nav"><button id="back" '+(r.step===0?'disabled':'')+'>上一步</button>'+(s.skip&&!q.ok?'<button id="skip">先跳過（不算答對）</button>':'')+(r.step<STEPS.length-1?'<button id="next" class="go" '+(isAction(s)&&!q.ok&&!q.skipped?'disabled':'')+'>'+esc(s.go||'繼續 →')+'</button>':'')+'</div></section>'+scorePanel(record);
 if(extrasHTML)html+='<div id="student-extras">'+extrasHTML+'</div>';
 $('#app').innerHTML=html;
 if($('#logout'))$('#logout').onclick=async()=>{await cloud.logout();extrasHTML='';loginScreen();};
 if(shownStep!==r.step){shownStep=r.step;window.scrollTo(0,0);}
 $('#step-select').onchange=e=>send('navigate',null,+e.target.value);
 $('#back').onclick=()=>send('navigate',null,r.step-1);
 if($('#next'))$('#next').onclick=()=>send('next');
 if($('#skip'))$('#skip').onclick=()=>send('skip');
 if($('#hint'))$('#hint').onclick=()=>{if($('#hint').dataset.last==='true'&&!confirm('這是最後一個提示。看完後，這題答對時會扣 1 分。確定要看嗎？'))return;send('hint');};
 if($('#finish'))$('#finish').onclick=()=>send('finish');
 if($('#retry-course'))$('#retry-course').onclick=()=>{if(!confirm('開始重刷練習？會換新題目並重新計時；第一次完成的分數會保留，另外記下最佳紀錄。'))return;send('retry');};
 if($('#qtime')&&!q.ok)tickTimer=setInterval(()=>{const el=$('#qtime'),st=record?.state;if(el&&st)el.textContent=fmt(liveMs(st,STEPS[st.step]));},1000);
 if($('#answer-form'))$('#answer-form').onsubmit=e=>{e.preventDefault();send('submit',$('#answer').value);};
 document.querySelectorAll('[data-opt]').forEach(b=>b.onclick=()=>send('submit',+b.dataset.opt));
 document.querySelectorAll('[data-bit]').forEach(b=>b.onclick=()=>{const v=[...(q.answer||'0'.repeat(p.n))];v[+b.dataset.bit]=v[+b.dataset.bit]==='1'?'0':'1';send('draft',v.join(''));});
 if($('#confirm-build'))$('#confirm-build').onclick=()=>send('submit',q.answer||'0'.repeat(p.n));
 document.querySelectorAll('[data-tbit]').forEach(b=>b.onclick=()=>{
  const v=[...(byteTools[s.id]||'00000000')],k=+b.dataset.tbit;v[k]=v[k]==='1'?'0':'1';byteTools[s.id]=v.join('');
  b.classList.toggle('on',v[k]==='1');b.setAttribute('aria-pressed',v[k]==='1');b.querySelector('b').textContent=v[k];
  const n=parseInt(byteTools[s.id],2);$('#tool-value').textContent=n;$('#tool-glyph').textContent=glyph(n);
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
 try{const [members,comments]=await Promise.all([cloud.classes(),cloud.studentComments()]);let html='';for(const m of members){const c=m.classes;if(!c)continue;const rows=await cloud.leaderboard(c.id);html+='<section class="panel board-panel"><h3>'+esc(c.name)+' 班級排行</h3><div class="scroll"><table class="board"><thead><tr><th>名次</th><th>座號</th><th>分數</th><th>狀態</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.display_name)+'</td><td>'+r.score+'</td><td>'+(r.completed?'已完成':'進行中')+'</td></tr>').join('')+'</tbody></table></div></section>';}
 if(comments.length)html+='<section class="panel"><h3>老師給我的評語</h3>'+comments.map(c=>'<p><b>'+esc(c.classes?.name||'班級')+'</b> · '+esc(c.body)+'</p>').join('')+'</section>';
 extrasHTML='<button id="logout" class="plain">登出</button>'+html;
 const old=$('#student-extras');if(old)old.outerHTML='<div id="student-extras">'+extrasHTML+'</div>';else if($('#app'))$('#app').insertAdjacentHTML('beforeend','<div id="student-extras">'+extrasHTML+'</div>');
 $('#logout').onclick=async()=>{await cloud.logout();extrasHTML='';loginScreen();};
 }catch(e){status('班級資料載入失敗：'+e.message);}
}
function card(c){return '<div class="cardbox"><div class="hd">卡片 '+(c.i+1)+'</div><div class="nums">'+c.list.map(n=>'<span class="'+(n===c.value?'key':'')+'">'+n+'</span>').join('')+'</div></div>';}
function drawWave(n){
 const c=$('#wave'),g=c.getContext('2d'),w=c.width,h=c.height,f=x=>h/2-Math.sin(x/w*Math.PI*4)*h*.3-Math.sin(x/w*Math.PI*9)*h*.09;
 g.clearRect(0,0,w,h);g.lineWidth=3;g.strokeStyle='#888';g.beginPath();for(let x=0;x<=w;x+=2)x?g.lineTo(x,f(x)):g.moveTo(x,f(x));g.stroke();
 g.strokeStyle='#b88b36';g.beginPath();for(let k=0;k<=n;k++){const x=k/n*w;k?g.lineTo(x,f(x)):g.moveTo(x,f(x));}g.stroke();
}
$('#reset').onclick=()=>{
 if(!confirm('清除這個座號的雲端學習紀錄，重新開始？'))return;
 course.reset();record=null;cloud.deleteProgress().then(()=>{startScreen();status('進度已清除。');}).catch(e=>status('無法清除雲端進度：'+e.message));
};
if(cloud.configured())boot().catch(e=>{status('雲端服務連線失敗：'+e.message);loginScreen(e.message);});
else loginScreen('請先在 cloud-config.js 填入 Supabase URL 與 anon key。');
