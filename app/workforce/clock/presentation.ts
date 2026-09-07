export type DisplayClockEvent = { type: string; occurredAt: string; branchId: string };
export const clockEventLabels: Record<string,string> = { CLOCK_IN: "Entrada", CLOCK_OUT: "Salida", BREAK_START: "Inicio de descanso", BREAK_END: "Fin de descanso" };
export function clockSuccess(type?: string) {
  return ({CLOCK_IN:"✓ Turno iniciado correctamente",CLOCK_OUT:"✓ Turno finalizado correctamente",BREAK_START:"✓ Descanso iniciado",BREAK_END:"✓ Descanso finalizado"} as Record<string,string>)[type??""]??"✓ Operación registrada correctamente";
}
export function displayedSession(events: DisplayClockEvent[], now: number) {
  const startIndex=events.map(e=>e.type).lastIndexOf("CLOCK_IN");
  if(startIndex<0)return null;
  const session=events.slice(startIndex),start=session[0];
  let workedMs=0,workingSince:number|null=Date.parse(start.occurredAt),endedAt:string|null=null,onBreak=false;
  for(const event of session.slice(1)){
    const at=Date.parse(event.occurredAt);
    if(event.type==="BREAK_START"||event.type==="CLOCK_OUT"){
      if(workingSince!==null)workedMs+=Math.max(0,at-workingSince);
      workingSince=null;onBreak=event.type==="BREAK_START";
      if(event.type==="CLOCK_OUT"){endedAt=event.occurredAt;break;}
    }else if(event.type==="BREAK_END"){workingSince=at;onBreak=false;}
  }
  if(workingSince!==null&&!endedAt)workedMs+=Math.max(0,now-workingSince);
  return {startedAt:start.occurredAt,branchId:start.branchId,endedAt,onBreak,seconds:Math.floor(workedMs/1000)};
}
export function durationClock(seconds:number){return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,"0")).join(":");}
