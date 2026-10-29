// GET /api/auth : première étape de la connexion à l'administration (/admin) avec GitHub.
// Variables d'environnement requises sur Cloudflare : GITHUB_CLIENT_ID et GITHUB_CLIENT_SECRET.

export async function onRequestGet({ request, env }) {
  // trim() : enlève un espace ou un retour à la ligne collé par erreur avec la clé.
  const clientId = String(env.GITHUB_CLIENT_ID || "").trim();
  if (!clientId) {
    return new Response("Connexion indisponible : la variable GITHUB_CLIENT_ID n'est pas configurée sur Cloudflare.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const origine = new URL(request.url).origin;
  const etat = crypto.randomUUID();

  const github = new URL("https://github.com/login/oauth/authorize");
  github.searchParams.set("client_id", clientId);
  github.searchParams.set("redirect_uri", `${origine}/api/callback`);
  github.searchParams.set("scope", "repo");
  github.searchParams.set("state", etat);

  return new Response(null, {
    status: 302,
    headers: {
      Location: github.toString(),
      "Set-Cookie": `lasheane_oauth=${etat}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
}
