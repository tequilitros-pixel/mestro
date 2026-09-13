import fs from 'node:fs';import dotenv from 'dotenv';import {spawnSync} from 'node:child_process';
const e=dotenv.parse(fs.readFileSync('.vercel/.env.production.local'));
const url=new URL(e.DATABASE_URL_UNPOOLED);
if(url.hostname!=='ep-noisy-rain-at5phvb9.c-9.us-east-1.aws.neon.tech'||url.pathname!=='/neondb')throw Error('PRODUCTION_ENDPOINT_MISMATCH');
url.searchParams.set('sslmode','verify-full');
const env={...process.env,DATABASE_URL:url.href,DATABASE_URL_UNPOOLED:url.href,MIGRATION_DATABASE_URL:url.href};
const mode=process.argv[2];
if(mode==='status'||mode==='diff'){
 const args=mode==='status'?['prisma','migrate','status']:['prisma','migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma','--script'];
 const r=spawnSync('npx',args,{env,stdio:'inherit'});process.exit(r.status??1);
}
if(mode==='backup'){
 const dir='/Users/joseadansanchez/maestro-checkpoints/pre-monday-20260906-095141/production';fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const pgEnv={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:url.pathname.slice(1),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:'system'};
 const r=spawnSync('/opt/homebrew/opt/libpq/bin/pg_dump',['--format=custom','--file',dir+'/before-scheduling.dump','--no-owner'],{env:pgEnv,stdio:'inherit'});if(r.status)process.exit(r.status);
 const list=spawnSync('/opt/homebrew/opt/libpq/bin/pg_restore',['--list',dir+'/before-scheduling.dump'],{encoding:'utf8'});if(list.status)process.exit(list.status);fs.writeFileSync(dir+'/restore-manifest.txt',list.stdout,{mode:0o600});console.log('Full production backup saved; archive manifest verified:',dir);process.exit(0);
}
throw Error('Read-only planning modes: status, diff, backup');
