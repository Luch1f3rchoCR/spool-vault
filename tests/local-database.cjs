// SQL-only local harness. No Supabase credentials, ports or cloud calls.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const container = "spool-vault-sql-test-20260909";
const root = path.resolve(__dirname, "..");
function command(args, input) {
 const result = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
 if (result.status !== 0) throw new Error(result.stderr || result.stdout || result.error?.message);
 return result.stdout;
}
const state = JSON.parse(command(["inspect", container]))[0];
if (state.Config.Labels?.app !== "spool-vault-sql-test" || state.HostConfig.NetworkMode !== "none") throw new Error("Not the isolated SQL test container");
function sql(source) { return command(["exec", "-i", container, "psql", "-U", "postgres", "-X", "-q", "-v", "ON_ERROR_STOP=1"], "set client_min_messages=warning;\n" + source); }
function file(relative) { return fs.readFileSync(path.join(root,relative),"utf8"); }
const count = command(["exec",container,"psql","-U","postgres","-X","-Atc","select count(*) from information_schema.tables where table_schema='public'"]).trim();
if(count !== "0") throw new Error("Database already initialized; refusing to overwrite");
sql(file("supabase/tests/local-bootstrap.sql"));
sql(file("supabase/schema.sql"));
console.log("PASS base schema on empty isolated PostgreSQL");
const migrations = fs.readdirSync(path.join(root,"supabase/migrations")).filter(f=>f.endsWith(".sql")).sort();
for(const name of migrations) {
 if(name.includes("tester_first_visit")) {
  for(const test of ["founder_testers.sql","tester_welcome.sql","printer_profiles.sql"]) {
   sql(file("supabase/tests/"+test));
   console.log("PASS pre-onboarding regression "+test);
  }
 }
 sql(file("supabase/migrations/"+name));
 console.log("PASS migration "+name);
}
sql(file("supabase/tests/tester_first_visit.sql"));
console.log("PASS first-visit activation, isolation and retry checks");
console.log(sql("select count(*) as remaining_test_users from auth.users;"));
