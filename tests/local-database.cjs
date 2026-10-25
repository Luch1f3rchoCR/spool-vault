// SQL-only local harness. No Supabase credentials, ports or cloud calls.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const container = process.env.PROPER_SQL_TEST_CONTAINER || "spool-vault-sql-test-20260909";
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
 const isHistoricalFx = name.includes("fin01a_historical_fx");
 if (isHistoricalFx || name.includes("filament_print_profiles")) {
  // Reproduce Supabase's inherited grants, including destructive privileges.
  sql("alter default privileges in schema public grant all on tables to service_role;");
  sql("begin;\n" + file("supabase/migrations/"+name) + "\nrollback;");
 }
 sql(file("supabase/migrations/"+name));
 if (isHistoricalFx) sql("alter default privileges in schema public revoke all on tables from service_role;");
 console.log("PASS migration "+name);
}
sql(file("supabase/tests/tester_first_visit.sql"));
console.log("PASS first-visit activation, isolation and retry checks");
sql(file("supabase/tests/purchase_order_new_filaments.sql"));
console.log("PASS order/new-filament rollback, isolation, mixed lines and retry checks");
sql(file("supabase/tests/supply_stock_projects.sql"));
console.log("PASS supply stock, weighted costs, production rollback, isolation and retry checks");
sql(file("supabase/tests/fin01a_historical_fx.sql"));
console.log("PASS FIN-01A historical FX, valuation, isolation and immutability checks");
sql(file("supabase/tests/filament_print_profiles.sql"));
console.log("PASS print settings, revision history, isolation, rejection and retry checks");
console.log(sql("select count(*) as remaining_test_users from auth.users;"));
