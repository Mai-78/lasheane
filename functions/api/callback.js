// GET /api/callback : GitHub renvoie ici après la connexion.
// La page transmet le jeton à l'administration (Decap CMS) qui l'a ouverte, puis se ferme.

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const etat = url.searchParams.get("state");
  const cookie = request.headers.get("Cookie") || "";
  const attendu = (cookie.match(/(?:^|;\s*)lasheane_oauth=([^;]+)/) || [])[1];

  if (!code || !etat || !attendu || etat !== attendu) {
    return page("error", { message: "La connexion a expiré. Fermez cette fenêtre et réessayez." });
  }

  const reponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "lasheane-admin",
    },
    body: JSON.stringify({
      client_id: String(env.GITHUB_CLIENT_ID || "").trim(),
      client_secret: String(env.GITHUB_CLIENT_SECRET || "").trim(),
      code,
      redirect_uri: `${url.origin}/api/callback`,
    }),
  });
  const data = await reponse.json().catch(() => ({}));

  if (!data.access_token) {
    return page("error", { message: data.error_description || "GitHub a refusé la connexion." });
  }
  return page("success", { token: data.access_token, provider: "github" });
}

function page(statut, contenu) {
  const message = `authorization:github:${statut}:${JSON.stringify(contenu)}`;
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Connexion…</title></head>
<body style="font-family: sans-serif; padding: 24px;">
<p>Connexion en cours… Cette fenêtre va se fermer.</p>
<script>
(function () {
  var message = ${JSON.stringify(message).replace(/</g, "\\u003c")};
  function recevoir(e) {
    if (e.origin !== window.location.origin) return;
    window.opener.postMessage(message, e.origin);
    window.removeEventListener("message", recevoir, false);
  }
  if (!window.opener) {
    document.body.innerHTML = "<p>Ouvrez l'administration depuis l'adresse /admin du site, puis reconnectez-vous.</p>";
    return;
  }
  window.addEventListener("message", recevoir, false);
  window.opener.postMessage("authorizing:github", window.location.origin);
})();
</script>
</body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": "lasheane_oauth=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}
