// Creates demo users via the Supabase auth admin API (email pre-confirmed)
// and writes their role profiles. Idempotent. Usage: npm run seed:users
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const USERS = [
  { email: "admin@aurigo.demo", password: "Admin@12345", full_name: "Priya (PMM Admin)", role: "admin" },
  { email: "sales@aurigo.demo", password: "Sales@12345", full_name: "Ravi (Sales)", role: "sales" },
  { email: "marketing@aurigo.demo", password: "Marketing@12345", full_name: "Meera (Marketing)", role: "marketing" },
  { email: "elt@aurigo.demo", password: "Elt@12345", full_name: "Arjun (ELT)", role: "elt" },
];

async function main() {
  for (const u of USERS) {
    let userId: string | undefined;
    const created = await sb.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });
    if (created.error) {
      // Already exists — look them up.
      const list = await sb.auth.admin.listUsers({ perPage: 100 });
      userId = list.data?.users.find((x) => x.email === u.email)?.id;
      if (!userId) {
        console.error(`FAILED ${u.email}: ${created.error.message}`);
        continue;
      }
      console.log(`exists  ${u.email}`);
    } else {
      userId = created.data.user!.id;
      console.log(`created ${u.email}`);
    }
    const { error } = await sb.from("profiles").upsert({
      id: userId,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
    });
    if (error) console.error(`profile upsert failed for ${u.email}: ${error.message}`);
  }
  console.log("done");
}

main();
