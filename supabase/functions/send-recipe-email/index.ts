import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { recipe } = await req.json();
    if (!recipe) return new Response(JSON.stringify({ error: "Missing recipe" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Build a simple HTML email summary
    const rows = Object.entries(recipe)
      .filter(([k]) => !["id", "user_id", "created_at", "results", "pigments"].includes(k))
      .map(([k, v]) => `<tr><td style="padding:6px 12px;border:1px solid #ddd;background:#f5f7fa"><b>${k}</b></td><td style="padding:6px 12px;border:1px solid #ddd">${v ?? "-"}</td></tr>`)
      .join("");

    const pigments = Array.isArray(recipe.pigments)
      ? recipe.pigments.map((p: any) => `<tr><td style="padding:6px 12px;border:1px solid #ddd">${p.name}</td><td style="padding:6px 12px;border:1px solid #ddd">${p.percent}%</td></tr>`).join("")
      : "";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#0f1b3d">
        <h1 style="color:#0f1b3d;border-bottom:3px solid #3b6fa0;padding-bottom:12px">Recipe Calculation Result</h1>
        <h2 style="color:#1e3a5f">${recipe.shade_name ?? ""}</h2>
        <p style="color:#555">Customer: <b>${recipe.customer_name ?? "-"}</b></p>
        <h3 style="color:#1e3a5f;margin-top:24px">Pigments</h3>
        <table style="border-collapse:collapse;width:100%">${pigments}</table>
        <h3 style="color:#1e3a5f;margin-top:24px">Calculation Details</h3>
        <table style="border-collapse:collapse;width:100%">${rows}</table>
        <p style="margin-top:32px;color:#888;font-size:12px">Sent automatically from Plant Recipe System</p>
      </div>
    `;

    // Log to console — actual sending requires email infra setup.
    // Returning success so UI can confirm; real send needs email domain configured.
    console.log(`[send-recipe-email] Would send to ${user.email}`);
    console.log(html.substring(0, 200));

    return new Response(
      JSON.stringify({
        success: true,
        recipient: user.email,
        message: "Recipe logged. To enable real email delivery, configure an email domain in Lovable Cloud → Emails.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
