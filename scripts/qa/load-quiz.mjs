#!/usr/bin/env node
/**
 * Exam-rush load test: N students sign in, start a quiz and answer every
 * question at the same time. Reports p50/p95 for start, each answer, and finish.
 *
 *   BASE_URL=http://localhost:4000 LOAD_USERS=30 QUIZ_TOPIC=t3 QUIZ_SIZE=25 node scripts/qa/load-quiz.mjs
 *
 * Needs accounts load1@test.local … loadN@test.local (password TEST_PASSWORD)
 * and an unlocked topic with at least QUIZ_SIZE questions. Local or preview only.
 */
const BASE=(process.env.BASE_URL||"http://localhost:4000").replace(/\/$/,""), USERS=Number(process.env.LOAD_USERS||process.argv[2]||30), N=Number(process.env.QUIZ_SIZE||25), TOPIC=process.env.QUIZ_TOPIC||"t3", PW=process.env.TEST_PASSWORD||"Test-Password-123"
async function user(i){
  const jar=new Map(); const store=r=>{for(const c of r.headers.getSetCookie()){const [p]=c.split(";");const k=p.indexOf("=");jar.set(p.slice(0,k),p.slice(k+1))}}
  const ck=()=>[...jar].map(([k,v])=>`${k}=${v}`).join("; ")
  let r=await fetch(BASE+"/api/auth/csrf");store(r);const {csrfToken}=await r.json()
  r=await fetch(BASE+"/api/auth/callback/credentials",{method:"POST",redirect:"manual",headers:{cookie:ck(),"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({csrfToken,email:`load${i}@test.local`,password:PW,json:"true"})});store(r)
  const times={start:0,answer:[],finish:0}; let errors=0
  const j=async(m,p,b)=>{const t=Date.now();const res=await fetch(BASE+p,{method:m,headers:{cookie:ck(),"content-type":"application/json"},body:b&&JSON.stringify(b)});if(!res.ok)errors++;const d=await res.json().catch(()=>({}));return [d,Date.now()-t]}
  const [s,ts]=await j("POST","/api/quiz/attempt",{topicId:TOPIC,fresh:true,settings:{questionsPerQuiz:N}}); times.start=ts
  const qs=s.data?.questions??[]
  for(const [k,q] of qs.entries()){const [,t]=await j("PUT","/api/quiz/attempt",{attemptId:s.data.attemptId,questionId:q.id,selectedAnswerId:q.options[0].id}); if(k===qs.length-1) times.finish=t; else times.answer.push(t)}
  return {times,errors}
}
const t0=Date.now()
const res=await Promise.all(Array.from({length:USERS},(_,i)=>user(i+1)))
const pct=(a,p)=>{a=[...a].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(a.length*p))]}
const ans=res.flatMap(r=>r.times.answer), fin=res.map(r=>r.times.finish), st=res.map(r=>r.times.start)
console.log(`users=${USERS} wall=${((Date.now()-t0)/1000).toFixed(1)}s errors=${res.reduce((n,r)=>n+r.errors,0)}`)
console.log(`start  p50=${pct(st,.5)}ms p95=${pct(st,.95)}ms`)
console.log(`answer p50=${pct(ans,.5)}ms p95=${pct(ans,.95)}ms max=${Math.max(...ans)}ms (n=${ans.length})`)
console.log(`finish p50=${pct(fin,.5)}ms p95=${pct(fin,.95)}ms`)
