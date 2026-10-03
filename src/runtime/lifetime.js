// Every runtime owns its listeners, scheduled work and teardown callbacks.
export function createLifetime(env){
  let stopped=false;const listeners=[],frames=new Set(),timeouts=new Set(),intervals=new Set();
  const request=env.requestAnimationFrame,timeout=env.setTimeout,interval=env.setInterval;
  const listen=(target,type,callback,options)=>{
    if(stopped||!target)return;
    target.addEventListener(type,callback,options);listeners.push([target,type,callback,options]);
  };
  env.requestAnimationFrame=callback=>{
    if(stopped||!request)return 0;let id;id=request(time=>{frames.delete(id);if(!stopped)callback(time);});frames.add(id);return id;
  };
  env.setTimeout=(callback,delay)=>{if(stopped)return 0;let id;id=timeout(()=>{timeouts.delete(id);if(!stopped)callback();},delay);timeouts.add(id);return id;};
  env.setInterval=(callback,delay)=>{if(stopped)return 0;const id=interval(()=>{if(!stopped)callback();},delay);intervals.add(id);return id;};
  return {listen,get stopped(){return stopped;},dispose(){
    if(stopped)return;stopped=true;
    for(const args of listeners)args[0].removeEventListener?.(...args.slice(1));listeners.length=0;
    for(const id of frames)env.cancelAnimationFrame?.(id);
    for(const id of timeouts)env.clearTimeout?.(id);
    for(const id of intervals)env.clearInterval?.(id);
    frames.clear();timeouts.clear();intervals.clear();
  }};
}
