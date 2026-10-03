import {createGameRuntime} from '../../src/runtime/game.js';

// Compatibility for existing matrix scenarios: they now operate on the real
// imported runtime, instead of deleting main.js imports and evaluating a copy.
export function attachRuntime(sandbox,{legacyStreets=false}={}){
  const dependencies=legacyStreets?{organicStreetNetwork:undefined}:{};
  const runtime=createGameRuntime({environment:sandbox,dependencies});
  for(const name of Object.keys(runtime.context)){
    if(name==='env'||name==='dependencies')continue;
    Object.defineProperty(sandbox,name,{configurable:true,enumerable:true,
      get:()=>runtime.context[name],set:value=>{runtime.context[name]=value;}});
  }
  return runtime;
}
