// Learning flow, chapter checks, answer validation, and cloud-synced progress for Bit Explorers.
import {STEPS, HEART, problems, hintLimit} from './content.js';

const VERSION = 'bit-explorers-v4';
const STORE_KEY = 'bit-explorers-class:v3';
// A gap between two actions longer than this (student away) counts only this much.
export const SEGMENT_CAP_MS = 5 * 60 * 1000;
const fail = code => {throw Object.assign(new Error(code), {code});};
const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() :
    [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join(''));
const bounded = (v, n = 500) => typeof v === 'string' && v.length <= n && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(v);
const actionTypes = new Set(['text','opt','conv','build','trick','pixel','wave']);
// Keep elapsed time for teacher context only; it never changes a score.
export const timed = s => ['opt','text','conv','build'].includes(s.t);
const checkpoints = STEPS.filter(s => s.checkpoint);
const practices = STEPS.filter(s => actionTypes.has(s.t) && !s.checkpoint);
const LAYOUT = 4;
const blank = () => ({version:VERSION,attemptId:newId(),layout:LAYOUT,attempt:1,step:0,maxStep:0,doneSteps:[],q:{},completed:false});
const qFor = (r, s) => r.q[s.id] ||= {submissions:0,wrongSubmissions:0,hints:0,ok:false,skipped:false};
const allowedValue = (s, v, r) => {
    if (['text','conv'].includes(s.t)) return bounded(v, 160);
    if (s.t === 'opt') return Number.isInteger(v) && v >= 0 && v < s.opts.length;
    if (s.t === 'build') return typeof v === 'string' && v.length === problems(r.attemptId)[s.id].n && /^[01]+$/.test(v);
    if (s.t === 'pixel') return typeof v === 'string' && /^[01]{64}$/.test(v);
    if (s.t === 'wave') return Number.isInteger(v) && v >= 3 && v <= 64;
    if (s.t === 'trick') return Array.isArray(v) && v.length <= 5 && v.every(x => typeof x === 'boolean');
    return false;
};
const correct = (s, v, q, r) => {
    const p = problems(r.attemptId)[s.id];
    const input = typeof v === 'string' ? v.normalize('NFKC') : v;
    if (s.t === 'opt') return input === s.right;
    if (s.t === 'conv') return /^\d+$/.test(input.trim()) && Number(input) === p.value;
    if (s.t === 'build') return input === p.bits;
    if (s.t === 'pixel') return input === HEART.join('');
    if (s.t === 'wave') return !!(q.low && q.high);
    if (s.t === 'trick') return input.length === 5;
    // Accept commas, spaces or the Chinese separators; a run-on 124816 counts too, so formatting alone is never wrong.
    if (s.id === 'd1') return input.replace(/\s/g,'') === p.bits;
    if (s.id === 'd2') return input.trim() === p.word;
    return s.chk(input);
};
// Add the time spent on the current timed question since the previous action.
const tick = (r, time) => {
    const s = STEPS[r.step];
    if (Number.isSafeInteger(r.sinceMs) && timed(s)) {
        const q = qFor(r, s);
        if (!q.ok) q.activeMs = (q.activeMs || 0) + Math.min(Math.max(0, time - r.sinceMs), SEGMENT_CAP_MS);
    }
    r.sinceMs = time;
};
export const courseScore = r => {
    const count = list => list.filter(s => r.q[s.id]?.ok).length;
    const checksDone=count(checkpoints),practiceDone=count(practices);
    const doneSteps=new Set(r.doneSteps||[]);
    const done = STEPS.filter((s,k) => actionTypes.has(s.t) ? (r.q[s.id]?.ok||r.q[s.id]?.skipped) : doneSteps.has(k)).length;
    const values = Object.values(r.q);
    const timeMs = STEPS.filter(timed).reduce((n, s) => n + (r.q[s.id]?.activeMs || 0), 0);
    return {score:checkpoints.length?Math.round(checksDone/checkpoints.length*100):0,
        checkpoints:checksDone,checkpointTotal:checkpoints.length,practices:practiceDone,practiceTotal:practices.length,choicePenalty:0,hintPenalty:0,timeMs,done,totalSteps:STEPS.length,
        progress:Math.round(done/STEPS.length*100),reached:r.maxStep+1,
        corrected:values.filter(q=>q.ok && q.wrongSubmissions>0).length,
        submissions:values.reduce((n,q)=>n+q.submissions,0),hints:values.reduce((n,q)=>n+q.hints,0),
        skipped:values.filter(q=>q.skipped&&!q.ok).length,completed:r.completed};
};
// The first completed attempt is kept as the score; the best one (score, then less time) is kept too.
const better = (a, b) => !b || a.score > b.score || (a.score === b.score && a.timeMs < b.timeMs);
const feedback = r => {
    const m=courseScore(r), pending=checkpoints.find(s=>!r.q[s.id]?.ok);
    return {strength:`你已完成 ${m.checkpoints}／${m.checkpointTotal} 個章末檢核。練習答錯和使用提示都不扣分。`,
        advice:pending?`下一步：完成「${pending.h}」。可以回去看教學，也可以使用提示。`:'六個章末檢核都完成了！你已經走完全部學習任務。',
        comment:`已完成 ${m.practices}／${m.practiceTotal} 個互動練習；共嘗試 ${m.submissions} 次，使用提示 ${m.hints} 次。這些紀錄用來看學習進度，不用來扣分。`};
};

// localStorage can be missing or blocked (private windows, strict settings); fall back to this page only.
let memory = null;
const load = () => {
    let saved = null;
    try {
        const value = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
        if (value && Number.isSafeInteger(value.revision) && value.state?.version === VERSION) saved = {...value, persisted: true};
    } catch {
        // Unreadable storage behaves like a first visit.
    }
    return memory && (!saved || memory.revision > saved.revision) ? memory : saved;
};
const save = row => {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify({revision: row.revision, updatedMs: row.updatedMs, state: row.state}));
        memory = null;
        return {...row, persisted: true};
    } catch {
        memory = {...row, persisted: false};
        return memory;
    }
};
const view = row => {
    const state=row.state, metrics=courseScore(state);
    return {revision:row.revision,updatedMs:row.updatedMs,persisted:row.persisted,segmentCapMs:SEGMENT_CAP_MS,state,metrics,
        feedback:feedback(state),first:state.first||null,best:state.best||null,finalScore:state.first?state.first.score:metrics.score};
};

export const mine = () => {
    const row = load();
    return row ? view(row) : {revision:0,updatedMs:null,persisted:true,segmentCapMs:SEGMENT_CAP_MS,state:null,metrics:null,feedback:null,first:null,best:null,finalScore:null};
};

// Restore an authenticated learner's server copy into this browser before rendering.
export const restore = row => {
    if (!row || !Number.isSafeInteger(row.revision)) return mine();
    const freshCourse=row.state?.version!==VERSION;
    const restored = {revision:row.revision,updatedMs:freshCourse?Date.now():(Date.parse(row.updated_at)||Date.now()),state:freshCourse?blank():row.state};
    memory = save(restored);
    return {...view(memory),resetFromPreviousCourse:freshCourse};
};

export const reset = () => {
    memory = null;
    try {
        localStorage.removeItem(STORE_KEY);
    } catch {
        // Nothing stored.
    }
};

export const event = body => {
    if (!Number.isSafeInteger(body.revision) || body.revision < 0 || !Number.isInteger(body.step) || body.step < 0 ||
        body.step >= STEPS.length || !['start','draft','submit','hint','skip','next','navigate','finish','retry'].includes(body.kind)) {
        fail('COURSE_INPUT_INVALID');
    }
    const row = load();
    // Another tab may have moved on; never overwrite its progress.
    if ((row?.revision || 0) !== body.revision) fail('COURSE_REVISION_CONFLICT');
    if (!row && body.kind !== 'start') fail('COURSE_NOT_STARTED');
    const r = row ? JSON.parse(JSON.stringify(row.state)) : blank(), time = Date.now();
    if (body.kind === 'start') {
        if (row || body.value !== null) fail('COURSE_INPUT_INVALID');
        r.step=body.step;
        r.sinceMs = time;
    } else if (body.kind === 'navigate') {
        if (body.value !== null) fail('COURSE_INPUT_INVALID');
        tick(r, time);
        r.step = body.step;
    } else if (body.kind === 'retry') {
        // Start a fresh playthrough with new values; previous completion records remain available.
        if (!r.completed || body.step !== r.step || body.value !== null) fail('COURSE_STEP_LOCKED');
        const next = {...blank(), attempt:(r.attempt||1)+1, first:r.first, best:r.best,sinceMs:time};
        Object.keys(r).forEach(k => delete r[k]);
        Object.assign(r, next);
    } else {
        if (body.step !== r.step) fail('COURSE_STEP_CONFLICT');
        tick(r, time);
        const s = STEPS[r.step], q = actionTypes.has(s.t) ? qFor(r, s) : null;
        if (['draft','submit'].includes(body.kind)) {
            if (!q || !allowedValue(s, body.value, r)) fail('COURSE_INPUT_INVALID');
            if (!q.ok) {
                q.answer = body.value;
                if (s.t === 'wave') {if (body.value <= 5) q.low = true;if (body.value >= 60) q.high = true;}
                if (body.kind === 'submit') {
                    q.submissions++;
                    const ok = correct(s, body.value, q, r);
                    if (q.submissions === 1) q.firstCorrect = ok;
                    if (!ok) q.wrongSubmissions++;
                    q.ok = ok;
                    if (ok) {q.skipped = false;q.solvedMs = time;}
                }
            }
        } else {
            if (body.value !== null) fail('COURSE_INPUT_INVALID');
            if (body.kind === 'hint') {
                if (!q) fail('COURSE_INPUT_INVALID');
                if (!q.ok) q.hints = Math.min(q.hints + 1, hintLimit(s));
            } else if (body.kind === 'skip') {
                if (!s.skip || !q) fail('COURSE_INPUT_INVALID');
                if (!q.ok) q.skipped = true;
                r.step = Math.min(r.step + 1, STEPS.length - 1);
            } else if (body.kind === 'next') {
                if (q && !q.ok && !q.skipped) fail('COURSE_STEP_LOCKED');
                if (r.step === STEPS.length - 1) fail('COURSE_INPUT_INVALID');
                r.doneSteps ||= [];
                if (!r.doneSteps.includes(r.step)) r.doneSteps.push(r.step);
                r.step++;
            } else if (body.kind === 'finish') {
                if (r.step !== STEPS.length - 1) fail('COURSE_STEP_LOCKED');
                if (checkpoints.some(s=>!r.q[s.id]?.ok)) fail('COURSE_CHECKPOINTS_PENDING');
                if (!r.completed) {
                    r.completed = true;
                    r.doneSteps ||= [];
                    if (!r.doneSteps.includes(r.step)) r.doneSteps.push(r.step);
                    const m = courseScore(r), entry = {attempt:r.attempt||1, score:m.score, timeMs:m.timeMs, completedMs:time};
                    if (!r.first) r.first = entry;
                    if (better(entry, r.best)) r.best = entry;
                }
            }
        }
        if (['next','skip','finish'].includes(body.kind)) r.maxStep = Math.max(r.maxStep, r.step);
    }
    return view(save({revision: body.revision + 1, updatedMs: time, state: r}));
};
