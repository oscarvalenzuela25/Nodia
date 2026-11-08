import { Injectable } from '@nestjs/common';
export interface GenerationWorkerSource {
  execute(workerId:string,signal:AbortSignal):Promise<boolean>;
  recover():Promise<void>;
}
/** One worker lifecycle, one canonical capacity store; domains register work, not locks. */
@Injectable()
export class GenerationWorkerSourceRegistry {
  private source:GenerationWorkerSource|null=null;
  register(source:GenerationWorkerSource):void {
    if(this.source && this.source!==source) throw Error('generation_worker_source_duplicate');
    this.source=source;
  }
  execute(workerId:string,signal:AbortSignal):Promise<boolean> {return this.source?.execute(workerId,signal)??Promise.resolve(false);}
  recover():Promise<void> {return this.source?.recover()??Promise.resolve();}
}
