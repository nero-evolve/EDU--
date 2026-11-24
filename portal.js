import * as cloud from './cloud.js?v=20261118-teacher-approval-v3';

const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STUDENT_BUCKET='learning-materials', TEACHER_BUCKET='teacher-materials';
let materials=[], currentUser=null, editing=null, queuedFiles=[],isSiteAdminUser=false,teacherApplicationsCache=[],teacherApplicationsError='',teacherAccountsCache=[],teacherAccountsError='';
const gradeName=n=>({7:'七年級',8:'八年級',9:'九年級'}[Number(n)]||'');
const typeName={worksheet:'學習單',lesson:'教材',slides:'簡報',video:'影片',image:'圖片',other:'其他'};

function message(text,kind='info'){return '<div class="message '+(kind==='error'?'error':'')+'">'+esc(text)+'</div>';}
function setStudentMessage(text,kind='info'){$('#material-list').innerHTML=message(text,kind);}
function publicUrl(row){const c=window.__materialClient;const {data}=c.storage.from(row.storage_bucket).getPublicUrl(row.storage_path,{download:row.original_name});return data.publicUrl;}
function previewUrl(row){const c=window.__materialClient;const {data}=c.storage.from(row.storage_bucket).getPublicUrl(row.storage_path);return data.publicUrl;}
function isImageFile(row){return String(row.mime_type||'').startsWith('image/')||/\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(row.original_name||'');}
function isHtmlFile(row){return /\.html?$/i.test(row.original_name||'')||String(row.mime_type||'').toLowerCase()==='text/html';}
function fileContentType(file){return /\.html?$/i.test(file.name)?'text/html':(file.type||'application/octet-stream');}

async function fetchStudentMaterials(){
  try{const c=await cloud.db();const {data,error}=await c.from('teaching_materials').select('*').eq('audience','student').eq('is_published',true).order('grade').order('title');if(error)throw error;materials=data||[];renderStudentMaterials();}
  catch(e){setStudentMessage('目前無法載入教材。老師可能還沒完成教材資料庫設定。\n'+e.message,'error');}
}
function renderStudentMaterials(){
  const grade=$('#grade-filter').value,query=$('#search-filter').value.trim().toLowerCase();
  const rows=materials.filter(x=>grade==='all'||String(x.grade)===grade);
  if(!rows.length){setStudentMessage(materials.length?'目前找不到符合條件的教材。':'老師還沒有發布教材。');return;}
  const groups=new Map();for(const row of rows){const key=JSON.stringify([row.grade,row.title,row.unit||'']);if(!groups.has(key))groups.set(key,{grade:row.grade,title:row.title,unit:row.unit||'',description:row.description||'',files:[]});groups.get(key).files.push(row);}
  const visible=[...groups.values()].filter(g=>!query||[g.title,g.unit,g.description,...g.files.map(f=>f.original_name)].some(t=>String(t||'').toLowerCase().includes(query)));
  $('#material-list').innerHTML=visible.map(g=>'<details class="material-card material-group"><summary><div class="card-top"><span class="grade-chip">'+gradeName(g.grade)+'</span><span class="file-type">'+g.files.length+' 個檔案</span></div><h3>'+esc(g.title)+'</h3>'+(g.unit?'<p class="unit">'+esc(g.unit)+'</p>':'')+'<p class="description">'+esc(g.description||'老師準備的學習資源。')+'</p><span class="group-open">點開查看教材清單　＋</span></summary><div class="group-files">'+g.files.map(f=>{const url=previewUrl(f),image=isImageFile(f),name=esc(f.original_name),type=esc(typeName[f.resource_type]||typeName.other);return '<div class="group-file '+(image?'has-image-preview':'')+'">'+(image?'<div class="image-preview-card"><button type="button" class="image-preview" data-image-preview data-image-src="'+esc(url)+'" data-image-name="'+name+'" aria-label="預覽 '+name+'"><img src="'+esc(url)+'" alt="'+name+'" loading="lazy"><span>點圖預覽</span></button><b class="image-file-name">'+name+'</b><small class="image-file-type">'+type+'</small></div>':'<span class="group-file-info"><b>'+name+'</b><small>'+type+'</small></span>')+'<span class="group-file-actions"><a class="download-btn" href="'+esc(publicUrl(f))+'" target="_blank" rel="noopener" download="'+name+'">下載</a></span></div>';}).join('')+'</div></details>').join('');
  const fileRows=$('#material-list').querySelectorAll('.group-file');let fileIndex=0;for(const group of visible)for(const file of group.files){if(isHtmlFile(file)){const filename=fileRows[fileIndex]?.querySelector('.group-file-info b');if(filename){const link=document.createElement('a');link.className='html-file-open';link.href=previewUrl(file);link.target='_blank';link.rel='noopener noreferrer';link.textContent=filename.textContent;link.title='在新視窗開啟 '+filename.textContent;filename.replaceWith(link);}}fileIndex++;}
  bindImagePreviews();
}
function bindImagePreviews(){
  let dialog=document.querySelector('#image-preview-dialog');
  if(!dialog){document.body.insertAdjacentHTML('beforeend','<dialog id="image-preview-dialog" class="image-preview-dialog"><button type="button" class="image-preview-close" aria-label="關閉預覽">關閉 ✕</button><img alt=""><p></p></dialog>');dialog=document.querySelector('#image-preview-dialog');dialog.querySelector('.image-preview-close').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});}
  document.querySelectorAll('[data-image-preview]').forEach(button=>button.onclick=()=>{const img=dialog.querySelector('img');img.src=button.dataset.imageSrc;img.alt=button.dataset.imageName||'';dialog.querySelector('p').textContent=button.dataset.imageName||'';dialog.showModal();});
}

function teacherLogin(message=''){
  $('#teacher-root').innerHTML='<section class="teacher-login"><h3>教師登入</h3><p>登入後管理自己的班級與教材；其他教師的內容可檢視與下載。</p>'+(message?'<p class="form-error">'+esc(message)+'</p>':'')+'<form id="portal-login" class="login-form"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>密碼<input name="password" type="password" autocomplete="current-password" required></label><p id="login-error" class="form-error"></p><button class="primary">登入教師管理</button></form><button type="button" id="teacher-register-link" class="secondary-btn">申請教師帳號</button></section>';
  $('#teacher-register-link').onclick=()=>teacherRegister();
  $('#portal-login').onsubmit=async e=>{e.preventDefault();const form=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button');button.disabled=true;$('#login-error').textContent='正在登入…';try{await cloud.login(form.get('email'),form.get('password'));const p=await cloud.profile();if(p.role!=='teacher'){let application='none';try{application=await cloud.teacherApplicationStatus();}catch{}await cloud.logout();teacherLogin(application==='pending'?'帳號已建立，教師申請尚待管理員審核。':application==='rejected'?'教師申請未核准，請聯絡網站管理員。':'此帳號尚未取得教師權限。');return;}const session=await cloud.session();currentUser=session.user;await loadTeacherMaterials();}catch(err){$('#login-error').textContent=err.message;button.disabled=false;}};
}
function teacherRegister(message=''){
  $('#teacher-root').innerHTML='<section class="teacher-login"><h3>申請教師帳號</h3><p>送出後先由網站管理員審核；核准前不會開放教師功能。</p>'+(message?'<p class="form-error">'+esc(message)+'</p>':'')+'<form id="teacher-register-form" class="login-form"><label>姓名<input name="name" maxlength="80" autocomplete="name" required></label><label>學校／任教單位<input name="institution" maxlength="120" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>設定密碼<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><label>申請說明<textarea name="note" maxlength="1000" rows="3" placeholder="簡單說明你的任教年級或使用需求"></textarea></label><p id="register-error" class="form-error"></p><button class="primary">送出教師申請</button></form><button type="button" id="back-to-teacher-login" class="secondary-btn">返回教師登入</button></section>';
  $('#back-to-teacher-login').onclick=()=>teacherLogin();
  $('#teacher-register-form').onsubmit=async e=>{e.preventDefault();const form=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button');button.disabled=true;$('#register-error').textContent='正在送出…';try{const result=await cloud.signup(form.get('email'),form.get('password'),form.get('name'),'teacher',null,form.get('institution'),form.get('note'));if(result)await cloud.logout();teacherLogin('申請已送出。管理員審核通過後即可登入。');}catch(err){$('#register-error').textContent=err.message;button.disabled=false;}};
}
function teacherApplicationPanel(){
  if(!isSiteAdminUser)return '';
  return '<section class="teacher-applications"><h3>待審教師申請</h3>'+(teacherApplicationsError?'<p class="form-error">申請清單載入失敗：'+esc(teacherApplicationsError)+'</p>':teacherApplicationsCache.length?'<div class="teacher-table-wrap"><table class="teacher-table"><thead><tr><th>申請者</th><th>Email</th><th>任教單位</th><th>申請說明</th><th>狀態</th><th>審核</th></tr></thead><tbody>'+teacherApplicationsCache.map(a=>'<tr><td>'+esc(a.display_name||'')+'</td><td>'+esc(a.email||'')+'</td><td>'+esc(a.institution||'')+'</td><td>'+esc(a.note||'')+'</td><td>待審核'+(a.email_confirmed?' · 信箱已驗證':' · 信箱未驗證')+'</td><td><button class="small-btn" data-review-teacher="'+esc(a.user_id)+'" data-approve="true">核准</button> <button class="danger-btn" data-review-teacher="'+esc(a.user_id)+'" data-approve="false">拒絕</button></td></tr>').join('')+'</tbody></table></div>':'<p class="meta">目前沒有待審申請。</p>')+'</section>';
}

function teacherAccountsPanel(){
  if(!isSiteAdminUser)return '';
  return '<section class="teacher-applications teacher-accounts"><h3>已核准教師管理</h3><p class="meta">可刪除沒有班級、教材或評語的教師帳號；仍有資料時，系統會阻止刪除並列出需要先處理的項目。</p>'+(teacherAccountsError?'<p class="form-error">教師清單載入失敗：'+esc(teacherAccountsError)+'</p>':teacherAccountsCache.length?'<div class="teacher-table-wrap"><table class="teacher-table teacher-account-table"><thead><tr><th>教師</th><th>Email</th><th>任教單位</th><th>班級</th><th>教材</th><th>評語</th><th>管理</th></tr></thead><tbody>'+teacherAccountsCache.map(t=>'<tr><td>'+esc(t.display_name||'')+'</td><td>'+esc(t.email||'')+'</td><td>'+esc(t.institution||'—')+'</td><td>'+Number(t.class_count||0)+'</td><td>'+Number(t.material_count||0)+'</td><td>'+Number(t.comment_count||0)+'</td><td><button class="danger-btn" data-delete-teacher="'+esc(t.user_id)+'" data-teacher-name="'+esc(t.display_name||t.email||'教師')+'">刪除帳號</button></td></tr>').join('')+'</tbody></table></div>':'<p class="meta">目前沒有其他已核准教師。</p>')+'</section>';
}

function teacherForm(row=null){
  const r=row||{};editing=r.id||null;
  return '<section class="form-panel"><h3>'+(editing?'編輯教材':'新增教材')+'</h3><form id="material-form"><div class="form-grid"><label>教材主題<input name="title" maxlength="120" required value="'+esc(r.title||'')+'" placeholder="例如：手遊抽卡實作"></label><label>年級<select name="grade" required><option value="">選擇年級</option>'+[7,8,9].map(g=>'<option value="'+g+'" '+(Number(r.grade)===g?'selected':'')+'>'+gradeName(g)+'</option>').join('')+'</select></label><label>科目<input value="資訊科技" readonly><small class="subject-label">本站科目固定為資訊科技</small></label><label>單元／主題<input name="unit" maxlength="100" placeholder="例如：Scratch 專題" value="'+esc(r.unit||'')+'"></label><label>教材類型<select name="resource_type">'+Object.entries(typeName).map(([k,v])=>'<option value="'+k+'" '+((r.resource_type||'lesson')===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label><label>學生存取範圍<select name="audience"><option value="student" '+((r.audience||'student')==='student'?'selected':'')+'>學生可檢視與下載</option><option value="teacher" '+(r.audience==='teacher'?'selected':'')+'>老師限定</option></select></label><label class="wide">簡介<textarea name="description" maxlength="500" placeholder="簡單說明這個主題的教材內容">'+esc(r.description||'')+'</textarea></label><label class="wide">教材檔案<input id="material-files" name="files" type="file" '+(editing?'':'multiple')+'><small class="subject-label">可分次選取檔案：每次選取後會加入待上傳清單；不限制檔案格式。單檔上限依 Supabase Storage 設定。</small>'+(editing&&r.original_name?'<small class="subject-label">目前檔案：'+esc(r.original_name)+'（不選新檔即可保留）</small>':'')+'<div id="file-queue" class="file-queue"></div></label><label class="wide checkbox-field"><input type="checkbox" name="is_published" '+(r.audience==='teacher'||r.is_published===false?'':'checked')+'><span>發布給學生（取消勾選會存成草稿）</span></label></div><div class="form-actions"><button class="primary">'+(editing?'儲存修改':'上傳教材')+'</button>'+(editing?'<button type="button" id="cancel-edit" class="secondary-btn">取消編輯</button>':'')+'</div><p id="form-message" class="form-error"></p></form></section>';
}
function teacherTable(){
  if(!materials.length)return '<div class="empty-state">還沒有教材。可用上方表單新增第一份教材。</div>';
  return '<div class="teacher-table-wrap"><table class="teacher-table"><thead><tr><th>教材</th><th>年級／科目</th><th>存取範圍</th><th>狀態</th><th>檔案</th><th>管理</th></tr></thead><tbody>'+materials.map(r=>{const owns=r.created_by===currentUser?.id;return '<tr><td><b>'+esc(r.title)+'</b>'+(r.unit?'<br><span class="subject-label">'+esc(r.unit)+'</span>':'')+'</td><td>'+gradeName(r.grade)+'<br>'+esc(r.subject)+'</td><td>'+(r.audience==='student'?'學生可看':'<span class="private-chip">老師限定</span>')+'</td><td>'+(r.is_published?'已發布':'草稿')+'</td><td><a class="quiet-link" href="#" data-download="'+esc(r.id)+'">下載</a><br><span class="subject-label">'+esc(r.original_name||'')+'</span></td><td>'+(owns?'<div class="table-actions"><button class="small-btn" data-edit="'+esc(r.id)+'">編輯</button><button class="danger-btn" data-delete="'+esc(r.id)+'">刪除</button></div>':'<span class="subject-label">僅檢視</span>')+'</td></tr>';}).join('')+'</tbody></table></div>';
}
async function loadTeacherMaterials(){
  try{
    const c=await cloud.db(),[profile,session]=await Promise.all([cloud.profile(),cloud.session()]);
    if(profile.role!=='teacher')throw Error('教師帳號尚未通過審核。');
    currentUser=session.user;isSiteAdminUser=false;teacherApplicationsCache=[];teacherApplicationsError='';teacherAccountsCache=[];teacherAccountsError='';
    try{isSiteAdminUser=await cloud.isSiteAdmin();if(isSiteAdminUser){try{teacherApplicationsCache=await cloud.adminTeacherApplications();}catch(e){teacherApplicationsError=e.message||String(e);}try{teacherAccountsCache=await cloud.adminTeacherAccounts();}catch(e){teacherAccountsError=e.message||String(e);}}}catch(e){teacherApplicationsError=e.message||String(e);console.warn('教師管理清單暫不可用',e);}
    const {data,error}=await c.from('teaching_materials').select('*').order('grade').order('subject').order('title');if(error)throw error;
    materials=data||[];renderTeacherMaterials(profile.display_name);
  }catch(e){$('#teacher-root').innerHTML=message('教材管理載入失敗：'+e.message,'error');}
}
function renderTeacherMaterials(name='老師'){
  $('#teacher-root').innerHTML='<div class="teacher-bar"><p>登入者：'+esc(name)+'　·　教材 '+materials.length+' 份</p><button id="portal-logout" class="secondary-btn">登出</button></div>'+teacherApplicationPanel()+teacherAccountsPanel()+(isSiteAdminUser?'<div class="application-refresh"><button id="refresh-applications" class="small-btn">重新整理申請／教師清單</button></div>':'')+teacherForm()+teacherTable();
  $('#portal-logout').onclick=async()=>{await cloud.logout();currentUser=null;queuedFiles=[];teacherLogin();};
  if($('#refresh-applications'))$('#refresh-applications').onclick=loadTeacherMaterials;
  $('#teacher-root').querySelectorAll('[data-review-teacher]').forEach(b=>b.onclick=async()=>{const approve=b.dataset.approve==='true',userId=b.dataset.reviewTeacher;if(!confirm(approve?'核准此教師帳號？核准後即可建立班級並管理自己的教材。':'拒絕此教師申請？'))return;try{await cloud.reviewTeacherApplication(userId,approve);await loadTeacherMaterials();}catch(e){alert('審核失敗：'+e.message);}});
  $('#teacher-root').querySelectorAll('[data-delete-teacher]').forEach(b=>b.onclick=async()=>{const name=b.dataset.teacherName;if(!confirm('確定永久刪除教師「'+name+'」的登入帳號？若此教師仍有班級、教材或評語，系統會阻止刪除。此操作無法復原。'))return;b.disabled=true;try{await cloud.deleteTeacherAccount(b.dataset.deleteTeacher);alert('教師帳號已刪除。');await loadTeacherMaterials();}catch(e){alert('無法刪除教師帳號：'+e.message);b.disabled=false;}});
  bindMaterialForm();
  $('#teacher-root').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{queuedFiles=[];const row=materials.find(x=>x.id===b.dataset.edit);if(!row||row.created_by!==currentUser.id){alert('只有上傳者可以編輯這份教材。');return;}$('#teacher-root').innerHTML='<div class="teacher-bar"><p>登入者：教材管理</p><button id="portal-logout" class="secondary-btn">登出</button></div>'+teacherForm(row)+teacherTable();$('#portal-logout').onclick=async()=>{await cloud.logout();currentUser=null;queuedFiles=[];teacherLogin();};bindMaterialForm();$('#cancel-edit').onclick=()=>{queuedFiles=[];renderTeacherMaterials();};});
  $('#teacher-root').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteMaterial(b.dataset.delete));
  $('#teacher-root').querySelectorAll('[data-download]').forEach(b=>b.onclick=async e=>{e.preventDefault();const win=window.open('about:blank','_blank');try{const row=materials.find(x=>x.id===b.dataset.download),c=await cloud.db();let url;if(row.storage_bucket===STUDENT_BUCKET)url=publicUrl(row);else{const {data,error}=await c.storage.from(row.storage_bucket).createSignedUrl(row.storage_path,600,{download:row.original_name});if(error)throw error;url=data.signedUrl;}if(win)win.location=url;else alert('瀏覽器封鎖下載視窗，請允許此網站開啟新視窗後再試。');}catch(err){if(win)win.close();alert('下載失敗：'+err.message);}});
}

async function bindMaterialForm(){
  const form=$('#material-form');if(!form)return;
  const fileInput=$('#material-files'),queueRoot=$('#file-queue');
  const drawQueue=()=>{if(!queueRoot)return;if(!queuedFiles.length){queueRoot.innerHTML='';return;}queueRoot.innerHTML='<ul class="queued-files">'+queuedFiles.map((f,i)=>'<li><span>'+esc(f.name)+' <small>('+Math.max(1,Math.round(f.size/1024))+' KB)</small></span><button type="button" class="small-btn" data-remove-queued="'+i+'">移除</button></li>').join('')+'</ul>';queueRoot.querySelectorAll('[data-remove-queued]').forEach(b=>b.onclick=()=>{queuedFiles.splice(Number(b.dataset.removeQueued),1);drawQueue();});};
  if(fileInput)fileInput.onchange=()=>{const picked=Array.from(fileInput.files||[]);if(editing)queuedFiles=picked.slice(0,1);else for(const file of picked)if(!queuedFiles.some(q=>q.name===file.name&&q.size===file.size&&q.lastModified===file.lastModified))queuedFiles.push(file);fileInput.value='';drawQueue();};
  drawQueue();
  form.onsubmit=async e=>{
    e.preventDefault();const data=new FormData(form),files=queuedFiles.slice(),button=form.querySelector('.primary'),messageEl=$('#form-message');
    const old=materials.find(x=>x.id===editing),audience=String(data.get('audience')),isPublished=audience==='student'&&data.has('is_published'),bucket=audience==='student'&&isPublished?STUDENT_BUCKET:TEACHER_BUCKET;
    if(editing&&files.length>1){messageEl.textContent='編輯時一次只能替換一個檔案。';return;}
    if(!editing&&!files.length){messageEl.textContent='請先選擇要上傳的檔案。';return;}
    button.disabled=true;let saved=0,activeUpload=null;
    try{
      const c=await cloud.db(),baseTitle=String(data.get('title')||'').trim(),common={grade:Number(data.get('grade')),subject:'資訊科技',unit:String(data.get('unit')||'').trim(),resource_type:String(data.get('resource_type')),description:String(data.get('description')||'').trim(),audience,is_published:isPublished,updated_at:new Date().toISOString(),created_by:currentUser.id};
      if(editing){
        let storageBucket=old.storage_bucket,storagePath=old.storage_path,originalName=old.original_name,mimeType=old.mime_type,sizeBytes=old.size_bytes;
        if(files.length){const file=files[0],ext=(file.name.split('.').pop()||'file').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,10)||'file',contentType=fileContentType(file);storagePath=currentUser.id+'/'+crypto.randomUUID()+'.'+ext;activeUpload={bucket,path:storagePath};const {error}=await c.storage.from(bucket).upload(storagePath,file,{contentType,upsert:false});if(error)throw error;storageBucket=bucket;originalName=file.name;mimeType=contentType;sizeBytes=file.size;}
        else if(old.storage_bucket!==bucket){let blob;if(old.storage_bucket===STUDENT_BUCKET){const response=await fetch(publicUrl(old));if(!response.ok)throw Error('無法讀取目前公開教材檔案。');blob=await response.blob();}else{const {data,error:downloadError}=await c.storage.from(old.storage_bucket).download(old.storage_path);if(downloadError)throw downloadError;blob=data;}const ext=(old.original_name.split('.').pop()||'file').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,10)||'file';storagePath=currentUser.id+'/'+crypto.randomUUID()+'.'+ext;activeUpload={bucket,path:storagePath};const {error:uploadError}=await c.storage.from(bucket).upload(storagePath,blob,{contentType:old.mime_type||'application/octet-stream',upsert:false});if(uploadError)throw uploadError;storageBucket=bucket;}
        const {error}=await c.from('teaching_materials').update({...common,title:baseTitle,storage_bucket:storageBucket,storage_path:storagePath,original_name:originalName,mime_type:mimeType,size_bytes:sizeBytes}).eq('id',editing);if(error)throw error;
        if(files.length||old.storage_bucket!==bucket){const {error:removeError}=await c.storage.from(old.storage_bucket).remove([old.storage_path]);if(removeError)console.warn('新檔已更新，但舊檔清理失敗',removeError);}
        activeUpload=null;editing=null;queuedFiles=[];await loadTeacherMaterials();return;
      }
      for(let i=0;i<files.length;i++){
        const file=files[i],ext=(file.name.split('.').pop()||'file').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,10)||'file',path=currentUser.id+'/'+crypto.randomUUID()+'.'+ext;
        messageEl.textContent='正在上傳 '+(i+1)+'／'+files.length+' 個檔案…';activeUpload={bucket,path};
        const contentType=fileContentType(file),{error:uploadError}=await c.storage.from(bucket).upload(path,file,{contentType,upsert:false});if(uploadError)throw new Error(file.name+'：'+uploadError.message);
        const {error:insertError}=await c.from('teaching_materials').insert({...common,title:baseTitle,storage_bucket:bucket,storage_path:path,original_name:file.name,mime_type:contentType,size_bytes:file.size});
        if(insertError){await c.storage.from(bucket).remove([path]);activeUpload=null;throw new Error(file.name+'：'+insertError.message);}
        activeUpload=null;saved++;
      }
      editing=null;queuedFiles=[];await loadTeacherMaterials();alert('已成功上傳 '+saved+' 個教材檔案，已歸入主題「'+baseTitle+'」。');
    }catch(err){if(activeUpload){const c=await cloud.db();await c.storage.from(activeUpload.bucket).remove([activeUpload.path]);}const errorText=(saved?'已成功上傳 '+saved+' 個；':'')+'上傳失敗：'+err.message;queuedFiles=files.slice(saved);button.disabled=false;if(saved){await loadTeacherMaterials();alert(errorText);}else{messageEl.textContent=errorText;drawQueue();}}
  };
}

async function deleteMaterial(id){
  const row=materials.find(x=>x.id===id);if(!row)return;if(row.created_by!==currentUser?.id){alert('只有上傳者可以刪除這份教材。');return;}if(!confirm('刪除「'+row.title+'」及其上傳檔案？此操作無法復原。'))return;
  try{const c=await cloud.db(),{error:storageError}=await c.storage.from(row.storage_bucket).remove([row.storage_path]);if(storageError)throw storageError;const {error}=await c.from('teaching_materials').delete().eq('id',id);if(error)throw error;await loadTeacherMaterials();}catch(e){alert('刪除失敗：'+e.message);}
}

function setView(view){document.querySelectorAll('.nav-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#teacher-view').hidden=view!=='teacher';$('#student-view').hidden=view!=='student';if(view==='teacher'){if(currentUser)loadTeacherMaterials();else teacherLogin();}else fetchStudentMaterials();}
document.querySelectorAll('.nav-tab').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('[data-jump-student]').onclick=()=>$('#student-view').scrollIntoView({behavior:'smooth'});
$('#grade-filter').onchange=renderStudentMaterials;$('#search-filter').oninput=renderStudentMaterials;
window.__materialClient=await cloud.db().catch(()=>null);
if(!window.__materialClient){setStudentMessage('無法連線教材服務，請確認 cloud-config.js 設定。','error');}else fetchStudentMaterials();
