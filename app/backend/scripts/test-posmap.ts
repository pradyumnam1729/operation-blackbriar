import "dotenv/config";
import { buildPositioningMap } from "../src/services/competitive";
import { supabase } from "../src/services/db";

async function main() {
  const { data: admin } = await supabase()!
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .single();
  const map = await buildPositioningMap(admin!.id, {
    xAxis: { label: "AI depth", low: "Bolt-on features", high: "AI-native platform" },
    yAxis: { label: "Scope of coverage", low: "Point solution", high: "Full life cycle suite" },
    products: ["Masterworks", "Masterworks AI", "Primus"],
  });
  console.log("x:", map.xAxis.label, "| y:", map.yAxis.label);
  console.log(
    "quadrants:",
    map.quadrants
      ? [map.quadrants.top_left, map.quadrants.top_right, map.quadrants.bottom_left, map.quadrants.bottom_right].join(" | ")
      : "(none)"
  );
  for (const p of map.points) {
    console.log(`(${p.x},${p.y}) size=${p.size} [${p.type}] ${p.name}`);
  }
  console.log("skipped:", map.skipped.map((s) => s.name).join(", ") || "(none)");
}

main().catch((e) => {
  console.error("FAILED:", (e as Error).message);
  process.exit(1);
});
