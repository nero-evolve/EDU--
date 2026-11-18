import {SUPABASE_URL,SUPABASE_ANON_KEY} from './cloud-config.js';
let client;
export const configured=()=>Boolean(SUPABASE_URL&&SUPABASE_ANON_KEY);
export async function db(){
 if(!configured())throw Error('尚未設定 Supabase，請先依 SETUP.md 完成設定。');
 if(!client){const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);}
 return client;
}
export async function session(){const c=await db();return (await c.auth.getSession()).data.session;}
export async function login(email,password){const c=await db();const {data,error}=await c.auth.signInWithPassword({email,password});if(error)throw error;return data.session;}
export async function requestPasswordReset(email,redirectTo){const c=await db();const {error}=await c.auth.resetPasswordForEmail(email,{redirectTo});if(error)throw error;}
export async function updatePassword(password){const c=await db();const {error}=await c.auth.updateUser({password});if(error)throw error;}
const seatEmail=seat=>`seat${seat}@students.bitexplorers.net`;
const seatPassword=seat=>`seat-login-${seat}-binary-course`;
export async function joinClassBySeat(seat){
 if(!/^\d{5}$/.test(seat))throw Error('請輸入 5 位數的班級座號，例如 90230。');
 const c=await db(),{error}=await c.rpc('join_class_by_code',{requested_class_code:seat.slice(0,3)});if(error)throw error;
}
export async function loginSeat(seat){
 if(!/^\d{5}$/.test(seat))throw Error('請輸入 5 位數的班級座號，例如 90230。');
 const c=await db(),email=seatEmail(seat),password=seatPassword(seat);
 let {data,error}=await c.auth.signInWithPassword({email,password});
 if(error){
  if(!/Invalid login credentials/i.test(error.message))throw error;
  const created=await c.auth.signUp({email,password,options:{data:{display_name:seat,seat_code:seat}}});
  if(created.error){
   if(/already registered/i.test(created.error.message))throw Error('此座號帳號已存在但無法登入，請確認 Supabase Email confirmation 已關閉。');
   throw created.error;
  }
  if(!created.data.session)throw Error('請先在 Supabase 關閉 Email confirmation；座號帳號不會使用電子郵件驗證。');
  data=created.data;error=null;
 }
 await joinClassBySeat(seat);
 return data.session;
}
export async function signup(email,password,name,role,classCode,institution='',applicationNote=''){
 const c=await db();const options={display_name:name};if(role==='teacher')Object.assign(options,{teacher_application:true,institution,application_note:applicationNote});const {data,error}=await c.auth.signUp({email,password,options:{data:options}});if(error)throw error;
 if(data.session&&data.user&&classCode){const {error:e}=await c.rpc('join_class',{requested_code:classCode.trim().toUpperCase()});if(e)throw e;}
 return data.session;
}
export async function logout(){const c=await db();const {error}=await c.auth.signOut();if(error)throw error;}
export async function profile(){const c=await db();const {data:{user},error:userError}=await c.auth.getUser();if(userError)throw userError;if(!user)throw Error('登入狀態已失效，請重新登入。');const {data,error}=await c.from('profiles').select('display_name,role').eq('id',user.id).single();if(error)throw error;return {...data,id:user.id,email:user.email};}
export async function classes(){const c=await db();const u=(await c.auth.getUser()).data.user;const p=await c.from('profiles').select('role').eq('id',u.id).single();if(p.error)throw p.error;if(p.data.role==='teacher'){const {data,error}=await c.rpc('teacher_visible_classes');if(error)throw error;return (data||[]).map(x=>({class_id:x.id,classes:x}));}const {data,error}=await c.from('class_members').select('class_id,classes(id,name,class_code,invite_code)').order('created_at');if(error)throw error;return data||[];}
export async function saveProgress(row){const c=await db();const payload={state:row.state,metrics:row.metrics,first:row.first,best:row.best,finalScore:row.finalScore,feedback:row.feedback};const {error}=await c.rpc('save_student_progress',{payload,client_revision:row.revision,client_updated_at:new Date(row.updatedMs).toISOString()});if(error)throw error;}
export async function loadProgress(){const c=await db();const {data,error}=await c.from('progress').select('state,revision,updated_at').maybeSingle();if(error)throw error;return data?{...data,state:data.state.state}:null;}
export async function deleteProgress(){const c=await db();const {error}=await c.from('progress').delete().eq('student_id',(await c.auth.getUser()).data.user.id);if(error)throw error;}
export async function leaderboard(classId){const c=await db();const {data,error}=await c.rpc('class_leaderboard',{target_class:classId});if(error)throw error;return data||[];}
export async function studentComments(){const c=await db();const {data,error}=await c.from('teacher_comments').select('class_id,body,updated_at,classes(name)').order('updated_at',{ascending:false});if(error)throw error;return data||[];}
export async function teacherClass(classId){const c=await db();const {data,error}=await c.rpc('teacher_class_progress',{target_class:classId});if(error)throw error;return data||[];}
export async function setTeacherScore(studentId,classId,score){const c=await db();const {error}=await c.rpc('set_teacher_score',{target_student:studentId,target_class:classId,requested_score:score});if(error)throw error;}
export async function comment(studentId,classId,body){const c=await db();const {error}=await c.from('teacher_comments').upsert({student_id:studentId,class_id:classId,body,updated_at:new Date().toISOString()},{onConflict:'student_id,class_id'});if(error)throw error;}
export async function createClass(name,classCode){const c=await db();const {data,error}=await c.rpc('create_class',{class_name:name,requested_class_code:classCode});if(error)throw error;return data;}
export async function removeClassMembers(classId,studentIds){const c=await db();const {data,error}=await c.rpc('remove_students_from_class',{target_class:classId,target_students:studentIds});if(error)throw error;return data;}
export async function teacherApplicationStatus(){const c=await db();const {data,error}=await c.rpc('teacher_application_status');if(error)throw error;return data;}
export async function isSiteAdmin(){const c=await db();const {data,error}=await c.rpc('is_site_admin');if(error)throw error;return !!data;}
export async function adminTeacherApplications(){const c=await db();const {data,error}=await c.rpc('admin_teacher_applications');if(error)throw error;return data||[];}
export async function adminTeacherAccounts(){const c=await db();const {data,error}=await c.rpc('admin_teacher_accounts');if(error)throw error;return data||[];}
export async function reviewTeacherApplication(userId,approve){const c=await db();const {error}=await c.rpc('review_teacher_application',{target_user:userId,approve});if(error)throw error;}
export async function deleteTeacherAccount(userId){const c=await db();const {data,error}=await c.functions.invoke('delete-teacher',{body:{user_id:userId}});if(error){let message=error.message;try{const details=await error.context.json();message=details.error||message;}catch{}throw Error(message);}if(!data?.ok)throw Error(data?.error||'刪除教師帳號失敗。');return data;}
const validCourse=slug=>{if(!['system-platforms'].includes(slug))throw Error('不支援的課程代碼。');return slug;};
export async function loadCourseProgress(slug){const c=await db();slug=validCourse(slug);const {data,error}=await c.from('course_progress').select('state,revision,updated_at').eq('course_slug',slug).maybeSingle();if(error)throw error;return data||null;}
export async function saveCourseProgress(slug,row){const c=await db();slug=validCourse(slug);const {error}=await c.rpc('save_course_progress',{target_course:slug,payload:row.state,client_revision:row.revision,client_updated_at:new Date(row.updatedMs).toISOString()});if(error)throw error;}
export async function deleteCourseProgress(slug){const c=await db();slug=validCourse(slug);const {error}=await c.rpc('delete_course_progress',{target_course:slug});if(error)throw error;}
export async function teacherCourseClass(classId,slug){const c=await db();slug=validCourse(slug);const {data,error}=await c.rpc('teacher_course_progress',{target_class:classId,target_course:slug});if(error)throw error;return data||[];}
export async function courseLeaderboard(classId,slug){const c=await db();slug=validCourse(slug);const {data,error}=await c.rpc('course_class_leaderboard',{target_class:classId,target_course:slug});if(error)throw error;return data||[];}
