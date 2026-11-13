const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const allowed=new Set(['--session-id','--user-id','--auth-session-public-id','--complete-job-id','--purpose','--thread-id']);
/** Pure strict CLI parsing. An invalid invocation never initializes DB or a transport. */
export function parseTeacherQualificationArgs(values) {
  const args=new Map();
  for(const value of values){
    const at=value.indexOf('=');
    if(at<0||!allowed.has(value.slice(0,at))||args.has(value.slice(0,at))) throw Error('invalid qualification arguments');
    args.set(value.slice(0,at),value.slice(at+1));
  }
  const sessionId=args.get('--session-id'),userId=args.get('--user-id'),authSession=args.get('--auth-session-public-id');
  const originalJobId=args.get('--complete-job-id'),purpose=args.get('--purpose')??'setup_reply',threadId=args.get('--thread-id');
  if(!uuid.test(sessionId??'')||!uuid.test(authSession??'')||!/^[1-9][0-9]{0,18}$/.test(userId??'')
    ||!['setup_reply','contextual_reply'].includes(purpose)
    ||(originalJobId!==undefined&&!uuid.test(originalJobId))
    ||(threadId!==undefined&&!uuid.test(threadId))
    ||(purpose==='contextual_reply'&&!originalJobId&&!threadId)
    ||(threadId!==undefined&&(purpose!=='contextual_reply'||originalJobId!==undefined))) throw Error('invalid qualification arguments');
  return {sessionId,userId,authSession,originalJobId,purpose,threadId};
}
