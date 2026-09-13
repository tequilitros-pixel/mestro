export interface WorkforceTimeProvider { now(): Date }

export const systemWorkforceClock: WorkforceTimeProvider = { now: () => new Date() };

export type TestWorkforceClock = WorkforceTimeProvider & {
  set(value: Date): void;
  advanceMilliseconds(value: number): void;
  advanceMinutes(value: number): void;
  advanceHours(value: number): void;
};

export function createTestWorkforceClock(input: { initial: Date; certificationEnabled?: boolean; nodeEnv?: string }): TestWorkforceClock {
  const nodeEnv=input.nodeEnv ?? process.env.NODE_ENV;
  const enabled=input.certificationEnabled ?? process.env.WORKFORCE_CERTIFICATION_CLOCK === "true";
  if(nodeEnv === "production") throw new Error("TEST_CLOCK_FORBIDDEN_IN_PRODUCTION");
  if(!enabled) throw new Error("TEST_CLOCK_REQUIRES_EXPLICIT_CERTIFICATION_FLAG");
  let instant=new Date(input.initial);
  if(Number.isNaN(instant.getTime())) throw new Error("TEST_CLOCK_INVALID_INSTANT");
  return {
    now:()=>new Date(instant),
    set(value){if(Number.isNaN(value.getTime())) throw new Error("TEST_CLOCK_INVALID_INSTANT"); instant=new Date(value)},
    advanceMilliseconds(value){if(!Number.isFinite(value)) throw new Error("TEST_CLOCK_INVALID_ADVANCE"); instant=new Date(instant.getTime()+value)},
    advanceMinutes(value){this.advanceMilliseconds(value*60_000)},
    advanceHours(value){this.advanceMilliseconds(value*3_600_000)},
  };
}
