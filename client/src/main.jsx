import React, { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { Sparkles, Search, CheckCircle2, Clock, AlertTriangle, TrendingUp, LayoutGrid, Users, BarChart3, Star, RefreshCw, ArrowRight, ExternalLink, Mail, Code2, UserPlus, X, Pencil, Trash2 } from 'lucide-react';
import './styles.css';

let toasts = [];
const toastListeners = new Set();
const notifyToasts = () => toastListeners.forEach(fn => fn());
function pushToast(kind, text){
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, kind, text }];
  notifyToasts();
  setTimeout(() => { toasts = toasts.filter(t => t.id !== id); notifyToasts(); }, 4000);
}
const toast = { success: text => pushToast('success', text), error: text => pushToast('error', text) };
function useToasts(){ return useSyncExternalStore(fn => { toastListeners.add(fn); return () => toastListeners.delete(fn); }, () => toasts); }
function dismissToast(id){ toasts = toasts.filter(t => t.id !== id); notifyToasts(); }
function Toasts(){
  const items = useToasts();
  return <div className="toast-stack">{items.map(t => <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismissToast(t.id)}>{t.kind==='success'?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>}<span>{t.text}</span></div>)}</div>;
}

const api = (path, opt = {}) => fetch(path, {
  ...opt,
  headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) },
}).then(async r => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
});

const fmtDate = value => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const pct = value => `${Math.round(Number(value || 0) * 100)}%`;

function Logo(){ return <div className="brand-mark"><Sparkles size={18}/></div>; }
function Icon({children}){ return <span className="icon" aria-hidden="true">{children}</span>; }
function GlassCard({children, className=''}){ return <section className={`glass ${className}`}>{children}</section>; }
function Stat({label,value,meta,icon:IconCmp,tone=''}){ return <div className={`stat-card ${tone}`}><div className="stat-icon"><IconCmp size={18}/></div><div><span>{label}</span><strong>{value}</strong>{meta && <small>{meta}</small>}</div></div>; }
function Badge({status}){ return <span className={`badge ${String(status).toLowerCase()}`}>{status}</span>; }
function ProgressBar({value}){ return <div className="progress"><i style={{width:`${Math.max(0,Math.min(100,Number(value||0)))}%`}}/></div>; }

function StudentPortal(){
  const [roll,setRoll]=useState(''), [student,setStudent]=useState(null);
  const [loading,setLoading]=useState(false);
  async function load(value=roll){ setStudent(null); if(!value.trim()) return toast.error('Enter your Roll No.'); setLoading(true); try{ setStudent(await api('/api/student/'+encodeURIComponent(value.trim()))); }catch(e){toast.error(e.message)}finally{setLoading(false)} }
  async function submit(week,url){
    if(!/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+/i.test(url)) return toast.error('Enter a valid GitHub repository URL.');
    setLoading(true); try{ setStudent(await api('/api/submissions',{method:'POST',body:JSON.stringify({rollNo:roll,week,url})})); toast.success(`Week ${week} submitted and is now pending admin review.`); }catch(e){toast.error(e.message)}finally{setLoading(false)}
  }
  async function saveEmail(email){
    setLoading(true); try{ await api(`/api/student/${encodeURIComponent(roll)}/email`,{method:'POST',body:JSON.stringify({email})}); setStudent(s=>({...s,email})); toast.success('Email saved. You will get an email when a week is reviewed.'); }catch(e){toast.error(e.message)}finally{setLoading(false)}
  }
  return <div className="app-shell student-shell">
    <header className="top-nav glass"><div className="brand"><Logo/><div><b>Student Portal</b><small>12-week submission tracking</small></div></div><div className="nav-pill"><span className="live-dot"/> Live sheet sync</div></header>
    <main className="container">
      <GlassCard className="hero student-hero">
        <div className="hero-copy"><span className="eyebrow">LEARNING PROGRESS</span><h1>Stay on top of every week.</h1><p>Enter your Roll No to see your submission history, missing work, and review status.</p></div>
        <div className="lookup glass-inner"><div className="input-wrap"><Icon><Search size={17}/></Icon><input value={roll} onChange={e=>setRoll(e.target.value)} placeholder="Enter Roll No" onKeyDown={e=>e.key==='Enter'&&load()}/></div><button className="primary" onClick={()=>load()} disabled={loading}>{loading?'Loading…':'View progress'} <ArrowRight size={16}/></button></div>
        {!student && <div className="hero-highlights"><div><span><CheckCircle2 size={16}/></span><div><strong>Submission history</strong>Every week, tracked</div></div><div><span><Clock size={16}/></span><div><strong>Review status</strong>Know what's pending</div></div><div><span><AlertTriangle size={16}/></span><div><strong>Missing work</strong>Never miss a deadline</div></div></div>}
      </GlassCard>
      {student && (student.email
        ? <StudentDetails student={student} onSubmit={submit} />
        : <EmailGate student={student} onSave={saveEmail} loading={loading}/>)}
    </main>
  </div>
}

function EmailGate({student,onSave,loading}){
  const [value,setValue]=useState('');
  const [error,setError]=useState('');
  function save(){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){ const msg='Enter a valid email address.'; setError(msg); return toast.error(msg); }
    if(/@uog\.edu\.pk$/i.test(value.trim())){ const msg='Please add your personal email, not your university email.'; setError(msg); return toast.error(msg); }
    setError('');
    onSave(value);
  }
  return <GlassCard className="hero student-hero gate-card">
    <div className="hero-copy">
      <span className="eyebrow">ONE LAST STEP</span>
      <h1>Hi {student.name}, verify your email.</h1>
      <p>Before you can see your progress, add the email you check regularly. You'll get a message here whenever a week is approved or rejected.</p>
    </div>
    <div className="lookup glass-inner"><div className={`input-wrap ${error?'has-error':''}`}><Icon><Mail size={17}/></Icon><input type="email" autoFocus value={value} onChange={e=>{setValue(e.target.value);setError('')}} placeholder="you@gmail.com" onKeyDown={e=>e.key==='Enter'&&save()}/></div><button className="primary" onClick={save} disabled={loading}>{loading?'Saving…':'Verify & continue'} <ArrowRight size={16}/></button></div>
    {error && <p className="field-error">{error}</p>}
    <div className="hero-highlights"><div><span><AlertTriangle size={16}/></span><div><strong>Use your personal email</strong>Not your university email</div></div><div><span><CheckCircle2 size={16}/></span><div><strong>One-time step</strong>You won't be asked again</div></div></div>
  </GlassCard>
}

function StudentDetails({student,onSubmit}){
  const submitted=student.submitted, missing=student.missing, pending=student.pending;
  return <>
    <GlassCard className="profile-card"><div className="avatar">{student.name?.slice(0,1)?.toUpperCase()||'S'}</div><div className="profile-main"><span className="eyebrow">STUDENT PROFILE</span><h2>{student.name}</h2><p>{student.rollNo} <span>•</span> {student.semester || 'Student'}</p></div><div className="profile-side"><span>Current progress</span><strong>{pct(student.submissionPercent)}</strong><ProgressBar value={student.submissionPercent*100}/></div></GlassCard>
    <EmailBadge email={student.email}/>
    <div className="stats-grid"><Stat label="Submitted" value={submitted} meta={`of ${student.activeWeeks} active weeks`} icon={CheckCircle2} tone="green"/><Stat label="Missing" value={missing} meta="Needs your attention" icon={AlertTriangle} tone="red"/><Stat label="Pending" value={pending} meta="Waiting for review" icon={Clock} tone="amber"/><Stat label="Completion" value={pct(student.submissionPercent)} meta="Approved submissions" icon={TrendingUp} tone="accent"/></div>
    <GlassCard className="weekly-card"><div className="section-head"><div><span className="eyebrow">WEEKLY TRACKER</span><h3>Your 12-week journey</h3></div><span className="active-weeks">{student.activeWeeks} active weeks</span></div><div className="week-list">{student.weeks.map(w=><StudentWeek key={w.week} week={w} onSubmit={onSubmit}/>)}</div></GlassCard>
  </>
}

function EmailBadge({email}){
  return <GlassCard className="email-card"><Icon><Mail size={16}/></Icon><span>Progress emails go to <b>{email}</b></span></GlassCard>;
}
function StudentWeek({week,onSubmit}){
  const [url,setUrl]=useState('');
  return <div className={`week-row ${week.status.toLowerCase()}`}><div className="week-number"><span>W{String(week.week).padStart(2,'0')}</span><div><b>Week {week.week}</b><small>{week.status==='Submitted'?'Submission approved':week.status==='Pending'?'Under admin review':'Assignment is missing'}</small></div></div><div className="week-action"><Badge status={week.status}/>{week.status==='Missing'&&<div className="submit-inline"><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="GitHub repository URL"/><button className="primary small" onClick={()=>onSubmit(week.week,url)}>Submit</button></div>}{week.status==='Pending'&&<span className="muted">GitHub link received • awaiting review</span>}{week.githubUrl&&<a className="repo-link" href={week.githubUrl} target="_blank" rel="noreferrer">Open repository <ExternalLink size={12}/></a>}</div></div>
}

function Admin(){
  const [key,setKey]=useState(''), [logged,setLogged]=useState(false), [data,setData]=useState(null), [tab,setTab]=useState('overview'), [loading,setLoading]=useState(false);
  const [studentFilter,setStudentFilter]=useState('');
  async function refresh(){ setLoading(true); try{const headers={'x-admin-key':key}; const result=await api('/api/admin/analytics',{headers}); setData(result);setLogged(true);}catch(e){toast.error(e.message)}finally{setLoading(false)} }
  async function review(row,action){ setLoading(true);try{await api('/api/admin/review',{method:'POST',headers:{'x-admin-key':key},body:JSON.stringify({row,action})});await refresh();toast.success(`Submission ${action.toLowerCase()}d.`)}catch(e){toast.error(e.message)}finally{setLoading(false)} }
  async function addStudent(payload){ setLoading(true);try{await api('/api/admin/students',{method:'POST',headers:{'x-admin-key':key},body:JSON.stringify(payload)});await refresh();toast.success(`${payload.name} added to the roster.`)}catch(e){toast.error(e.message);throw e}finally{setLoading(false)} }
  async function editStudent(rollNo,payload){ setLoading(true);try{await api('/api/admin/students/'+encodeURIComponent(rollNo),{method:'PATCH',headers:{'x-admin-key':key},body:JSON.stringify(payload)});await refresh();toast.success(`${payload.name} updated.`)}catch(e){toast.error(e.message);throw e}finally{setLoading(false)} }
  async function deleteStudent(rollNo,name){ if(!confirm(`Remove ${name} (${rollNo}) from the roster? This cannot be undone.`)) return; setLoading(true);try{await api('/api/admin/students/'+encodeURIComponent(rollNo),{method:'DELETE',headers:{'x-admin-key':key}});await refresh();toast.success(`${name} removed from the roster.`)}catch(e){toast.error(e.message)}finally{setLoading(false)} }
  if(!logged) return <div className="app-shell admin-login"><main className="container login-container"><GlassCard className="login-card"><div className="login-logo"><Logo/></div><span className="eyebrow">ADMIN CONSOLE</span><h1>Control center for submissions.</h1><p>Review student work, monitor weekly health, and manage the entire 12-week submission cycle.</p><div className="input-wrap large"><Icon><Search size={17}/></Icon><input type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder="Enter admin key" onKeyDown={e=>e.key==='Enter'&&refresh()}/></div><button className="primary wide" onClick={refresh} disabled={loading}>{loading?'Connecting…':<>Open admin portal <ArrowRight size={16}/></>}</button></GlassCard></main></div>;
  const a=data?.summary||{};
  const tabIcons={overview:LayoutGrid,review:Clock,students:Users,analytics:BarChart3};
  const tabs=[['overview','Overview'],['review','Pending Review'],['students','Students'],['analytics','Analytics']];
  return <div className="app-shell admin-shell">
    <aside className="sidebar glass"><div className="brand"><Logo/><div><b>Admin Portal</b><small>Submission command center</small></div></div><nav>{tabs.map(([id,label])=>{const TabIcon=tabIcons[id];return <button className={tab===id?'active':''} key={id} onClick={()=>{setTab(id);refresh()}}><span><TabIcon size={16}/></span>{label}{id==='review'&&a.pending>0&&<em>{a.pending}</em>}</button>})}</nav><div className="side-footer"><div className="status-chip"><span className="live-dot"/> Google Sheets connected</div><button className="ghost" onClick={()=>{setLogged(false);setData(null)}}>Lock portal</button></div></aside>
    <div className="admin-content"><header className="top-nav admin-top glass"><div><span className="eyebrow">ADMIN / {tabs.find(x=>x[0]===tab)?.[1].toUpperCase()}</span><h2>{tabs.find(x=>x[0]===tab)?.[1]}</h2></div><div className="top-actions"><span className="sync">Last sync: {new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span><button className="secondary" onClick={refresh}><RefreshCw size={14}/> {loading?'Refreshing…':'Refresh'}</button></div></header>
      <main className="container admin-container">{tab==='overview'&&<Overview data={data} onReview={()=>{setTab('review');refresh()}}/>} {tab==='review'&&<Review data={data} review={review} busy={loading}/>} {tab==='students'&&<Students data={data} filter={studentFilter} setFilter={setStudentFilter} onAdd={addStudent} onEdit={editStudent} onDelete={deleteStudent}/>} {tab==='analytics'&&<Analytics data={data}/>}</main></div>
  </div>
}

function Overview({data,onReview}){const s=data.summary;return <>
  <div className="page-intro"><div><span className="eyebrow">OVERVIEW</span><h1>Everything at a glance.</h1><p>Live insights from your Student Tracking workbook.</p></div><button className="primary" onClick={onReview}>Review pending <ArrowRight size={16}/></button></div>
  <div className="stats-grid admin-stats"><Stat label="Total students" value={s.students} meta="Active roster" icon={Users}/><Stat label="Submitted" value={s.submitted} meta={`${pct(s.submissionRate)} submission rate`} icon={CheckCircle2} tone="green"/><Stat label="Missing" value={s.missing} meta={`${s.studentsWithMissing} students affected`} icon={AlertTriangle} tone="red"/><Stat label="Pending review" value={s.pending} meta="Awaiting admin action" icon={Clock} tone="amber"/><Stat label="Active weeks" value={s.activeWeeks} meta="of 12 course weeks" icon={LayoutGrid} tone="accent"/><Stat label="100% complete" value={s.studentsAt100} meta="Perfect active-week record" icon={Star} tone="green"/></div>
  <div className="dashboard-grid"><GlassCard className="panel"><div className="section-head"><div><span className="eyebrow">WEEKLY HEALTH</span><h3>Submission performance</h3></div><span className="mini-label">Weeks 1–{s.activeWeeks}</span></div><WeeklyChart weeks={data.weekly}/></GlassCard><GlassCard className="panel"><div className="section-head"><div><span className="eyebrow">LEADERBOARD</span><h3>Top students</h3></div><span className="mini-label">by completion</span></div><Leaderboard rows={data.leaderboard}/></GlassCard></div>
  <div className="dashboard-grid lower"><GlassCard className="panel"><div className="section-head"><div><span className="eyebrow">ACTION QUEUE</span><h3>Recent pending submissions</h3></div><button className="link-button" onClick={onReview}>View all <ArrowRight size={14}/></button></div><PendingList rows={data.pending.slice(0,5)} onReview={onReview}/></GlassCard><GlassCard className="panel"><div className="section-head"><div><span className="eyebrow">ATTENTION</span><h3>Students with missing work</h3></div></div><MissingList rows={data.missingStudents.slice(0,6)}/></GlassCard></div>
</>}
function WeeklyChart({weeks}){const max=Math.max(...weeks.map(w=>w.total||0),1);return <div className="chart">{weeks.map(w=><div className="bar-group" key={w.week}><div className="bar-track"><div className="bar submitted" style={{height:`${(w.submitted/max)*100}%`}}/><div className="bar pending" style={{height:`${(w.pending/max)*100}%`}}/></div><b>{w.submitted}</b><small>W{w.week}</small><span>{pct(w.rate)}</span></div>)}</div>}
function Leaderboard({rows}){return <div className="leader-list">{rows.slice(0,8).map((r,i)=><div className="leader-row" key={r.rollNo}><span className="rank">{i+1}</span><div className="mini-avatar">{r.name?.slice(0,1)}</div><div className="leader-name"><b>{r.name}</b><small>{r.rollNo}</small></div><div className="leader-progress"><ProgressBar value={r.rate*100}/></div><strong>{pct(r.rate)}</strong></div>)}</div>}
function PendingList({rows,onReview}){if(!rows.length)return <Empty text="No pending submissions. You're all caught up."/>;return <div className="pending-list">{rows.map(r=><div className="pending-row" key={r.row}><div className="mini-avatar">{r.name?.slice(0,1)}</div><div><b>{r.name}</b><small>{r.rollNo} • Week {r.week}</small></div><a href={r.url} target="_blank" rel="noreferrer">GitHub <ExternalLink size={11}/></a><button className="icon-button" onClick={onReview}>Review</button></div>)}</div>}
function MissingList({rows}){if(!rows.length)return <Empty text="No students currently have missing work."/>;return <div className="missing-list">{rows.map(r=><div className="missing-row" key={r.rollNo}><div><b>{r.name}</b><small>{r.rollNo}</small></div><span>{r.missing} missing</span></div>)}</div>}
function Review({data,review,busy}){return <><div className="page-intro"><div><span className="eyebrow">ACTION QUEUE</span><h1>Pending submissions.</h1><p>Open each repository, then approve or reject. The workbook updates automatically.</p></div><div className="queue-count">{data.pending.length}<small>pending</small></div></div><GlassCard className="table-card"><div className="table-toolbar"><div><b>Submission review</b><span>{data.pending.length} awaiting action</span></div></div><div className="table-scroll"><table><thead><tr><th>Student</th><th>Week</th><th>Repository</th><th>Submitted</th><th>Action</th></tr></thead><tbody>{data.pending.map(r=><tr key={r.row}><td><div className="table-person"><div className="mini-avatar">{r.name?.slice(0,1)}</div><div><b>{r.name}</b><small>{r.rollNo}</small></div></div></td><td><span className="week-tag">Week {r.week}</span></td><td><a className="repo-link" href={r.url} target="_blank" rel="noreferrer">Open GitHub <ExternalLink size={12}/></a></td><td>{fmtDate(r.submittedOn)}</td><td><div className="actions"><button className="approve" onClick={()=>review(r.row,'Approve')} disabled={busy}>Approve</button><button className="reject" onClick={()=>review(r.row,'Reject')} disabled={busy}>Reject</button></div></td></tr>)}</tbody></table></div>{!data.pending.length&&<Empty text="No pending submissions. New student submissions will appear here."/>}</GlassCard></>}
function Students({data,filter,setFilter,onAdd,onEdit,onDelete}){
  const rows=data.students.filter(r=>`${r.name} ${r.rollNo}`.toLowerCase().includes(filter.toLowerCase()));
  const [showAdd,setShowAdd]=useState(false);
  const [editing,setEditing]=useState(null);
  return <><div className="page-intro"><div><span className="eyebrow">STUDENT DIRECTORY</span><h1>Every student, every signal.</h1><p>Search performance, active weeks, missing work and completion.</p></div><button className="primary" onClick={()=>{setEditing(null);setShowAdd(v=>!v)}}>{showAdd?<>Cancel <X size={16}/></>:<>Add student <UserPlus size={16}/></>}</button></div>
  {showAdd&&<AddStudentForm onAdd={onAdd} onDone={()=>setShowAdd(false)}/>}
  {editing&&<AddStudentForm student={editing} onAdd={payload=>onEdit(editing.rollNo,payload)} onDone={()=>setEditing(null)}/>}
  <GlassCard className="table-card"><div className="table-toolbar"><div><b>{rows.length} students</b><span>Live from Student Tracking</span></div><div className="input-wrap compact"><Icon><Search size={16}/></Icon><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search name or roll no"/></div></div><div className="table-scroll"><table><thead><tr><th>Rank</th><th>Student</th><th>Contact</th><th>Progress</th><th>Submitted</th><th>Missing</th><th>Pending</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map(r=><tr key={r.rollNo}><td><span className="rank">{r.rank}</span></td><td><div className="table-person"><div className="mini-avatar">{r.name?.slice(0,1)}</div><div><b>{r.name}</b><small>{r.rollNo} • {r.semester}</small></div></div></td><td><div className="contact-cell">{r.email&&<a href={`mailto:${r.email}`} title={r.email}><Mail size={13}/></a>}{r.githubProfile&&<a href={r.githubProfile} target="_blank" rel="noreferrer" title={r.githubProfile}><Code2 size={13}/></a>}</div></td><td><div className="progress-cell"><ProgressBar value={r.rate*100}/><strong>{pct(r.rate)}</strong></div></td><td>{r.submitted}</td><td><span className={r.missing?'number-red':''}>{r.missing}</span></td><td><span className={r.pending?'number-amber':''}>{r.pending}</span></td><td><Badge status={r.rate>=1?'Complete':r.missing>0?'Needs attention':'On track'}/></td><td><div className="actions"><button className="icon-button" onClick={()=>{setShowAdd(false);setEditing(r)}} title="Edit student"><Pencil size={14}/></button><button className="icon-button danger" onClick={()=>onDelete(r.rollNo,r.name)} title="Delete student"><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div></GlassCard></>}
function AddStudentForm({student,onAdd,onDone}){
  const [form,setForm]=useState(student?{rollNo:student.rollNo,name:student.name,semester:student.semester||'',email:student.email||'',githubProfile:student.githubProfile||''}:{rollNo:'',name:'',semester:'',email:'',githubProfile:''});
  const [saving,setSaving]=useState(false);
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  async function save(){
    if(!form.rollNo.trim()||!form.name.trim()) return toast.error('Roll No and name are required.');
    setSaving(true);
    try{ await onAdd(form); onDone(); }catch(e){ /* Admin.addStudent/editStudent already toasts the failure */ }finally{ setSaving(false); }
  }
  return <GlassCard className="table-card add-student-form">
    <div className="section-head"><div><span className="eyebrow">{student?'EDIT STUDENT':'NEW STUDENT'}</span><h3>{student?`Update ${student.name}`:'Add to the roster'}</h3></div></div>
    <div className="form-grid">
      <div className="input-wrap"><input value={form.rollNo} onChange={set('rollNo')} placeholder="Roll No" disabled={!!student}/></div>
      <div className="input-wrap"><input value={form.name} onChange={set('name')} placeholder="Student name"/></div>
      <div className="input-wrap"><input value={form.semester} onChange={set('semester')} placeholder="Semester"/></div>
      <div className="input-wrap"><input value={form.email} onChange={set('email')} placeholder="Email (optional)"/></div>
      <div className="input-wrap"><input value={form.githubProfile} onChange={set('githubProfile')} placeholder="GitHub profile (optional)"/></div>
    </div>
    <button className="primary" onClick={save} disabled={saving}>{saving?(student?'Saving…':'Adding…'):student?<>Save changes <Pencil size={16}/></>:<>Add student <UserPlus size={16}/></>}</button>
  </GlassCard>
}
function Analytics({data}){const s=data.summary;return <><div className="page-intro"><div><span className="eyebrow">DEEP ANALYTICS</span><h1>Understand the whole cohort.</h1><p>Weekly trends, completion distribution, missing-work load and submission queue.</p></div></div><div className="stats-grid admin-stats"><Stat label="Average completion" value={pct(s.averageRate)} meta="Across active weeks" icon={BarChart3} tone="accent"/><Stat label="Students needing attention" value={s.studentsWithMissing} meta="At least one missing week" icon={AlertTriangle} tone="red"/><Stat label="Pending submissions" value={s.pending} meta="Need review" icon={Clock} tone="amber"/><Stat label="Perfect students" value={s.studentsAt100} meta="100% approved" icon={Star} tone="green"/></div><div className="dashboard-grid"><GlassCard className="panel"><div className="section-head"><div><span className="eyebrow">WEEK-BY-WEEK</span><h3>Detailed submission rates</h3></div></div><div className="analytics-weeks">{data.weekly.map(w=><div className="analytics-week" key={w.week}><div><b>Week {w.week}</b><span>{w.submitted} submitted • {w.missing} missing • {w.pending} pending</span></div><strong>{pct(w.rate)}</strong><ProgressBar value={w.rate*100}/></div>)}</div></GlassCard><GlassCard className="panel"><div className="section-head"><div><span className="eyebrow">DISTRIBUTION</span><h3>Student completion bands</h3></div></div><div className="distribution">{data.distribution.map(d=><div className="distribution-row" key={d.label}><div><span>{d.label}</span><b>{d.count}</b></div><ProgressBar value={s.students?d.count/s.students*100:0}/></div>)}</div></GlassCard></div></>}
function Empty({text}){return <div className="empty"><div><Sparkles size={22}/></div><p>{text}</p></div>}

function App(){ return <>{location.pathname.startsWith('/admin')?<Admin/>:<StudentPortal/>}<Toasts/></>; }
createRoot(document.getElementById('root')).render(<App/>);
