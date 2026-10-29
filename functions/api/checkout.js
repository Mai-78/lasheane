// POST /api/checkout : crée une session de paiement Stripe à partir du panier.
// Les prix sont relus ici, côté serveur, dans les contenus publiés du site :
// une cliente ne peut donc pas modifier le prix depuis son navigateur.
// Variable d'environnement requise sur Cloudflare : STRIPE_SECRET_KEY.

const QUANTITE_MAX = 10;

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_SECRET_KEY) {
    return json({ erreur: "Le paiement en ligne n'est pas encore activé." }, 503);
  }

  let corps;
  try {
    corps = await request.json();
  } catch {
    return json({ erreur: "Panier illisible. Rechargez la page et réessayez." }, 400);
  }

  let catalogue, boutique;
  try {
    [catalogue, boutique] = await Promise.all([
      lireContenu(context, "/content/produits.json"),
      lireContenu(context, "/content/boutique.json"),
    ]);
  } catch (e) {
    console.error(e);
    return json({ erreur: "La boutique est momentanément indisponible." }, 500);
  }

  const offreActive = boutique.offre_active === true;
  const produits = new Map((catalogue.produits || []).map((p) => [p.id, p]));
  const origine = new URL(request.url).origin;

  const articles = Array.isArray(corps?.articles) ? corps.articles : [];
  const lignes = [];
  for (const a of articles) {
    const p = produits.get(String(a?.id));
    const quantite = Math.floor(Number(a?.quantite));
    if (!p || p.disponible === false) {
      return json({ erreur: "Un kit de votre panier n'est plus disponible. Retirez-le et réessayez." }, 400);
    }
    if (!(quantite >= 1 && quantite <= QUANTITE_MAX)) {
      return json({ erreur: `Quantité invalide (maximum ${QUANTITE_MAX} par kit).` }, 400);
    }
    const lancement = nombre(p.prix_lancement);
    const prix = offreActive && lancement > 0 ? lancement : nombre(p.prix);
    const centimes = Math.round(prix * 100);
    if (!(centimes > 0)) {
      return json({ erreur: "Un prix est manquant. Contactez-nous pour finaliser votre commande." }, 500);
    }
    lignes.push({ p, quantite, centimes });
  }
  if (lignes.length === 0) {
    return json({ erreur: "Votre panier est vide." }, 400);
  }

  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("locale", "fr");
  params.append("success_url", `${origine}/merci?session_id={CHECKOUT_SESSION_ID}`);
  params.append("cancel_url", `${origine}/#collection`);
  params.append("allow_promotion_codes", "true");
  params.append("phone_number_collection[enabled]", "true");
  params.append("metadata[source]", "site-lasheane");

  let sousTotal = 0;
  lignes.forEach(({ p, quantite, centimes }, i) => {
    sousTotal += centimes * quantite;
    params.append(`line_items[${i}][quantity]`, String(quantite));
    params.append(`line_items[${i}][price_data][currency]`, "eur");
    params.append(`line_items[${i}][price_data][unit_amount]`, String(centimes));
    params.append(`line_items[${i}][price_data][product_data][name]`, p.nom);
    if (p.effet) params.append(`line_items[${i}][price_data][product_data][description]`, p.effet);
    params.append(`line_items[${i}][price_data][product_data][metadata][kit]`, p.id);
    const img = String(p.image || "");
    if (img) {
      const absolue = /^https:\/\//.test(img) ? img : origine + (img.startsWith("/") ? img : "/" + img);
      params.append(`line_items[${i}][price_data][product_data][images][0]`, encodeURI(absolue));
    }
  });

  // Livraison
  const pays = (Array.isArray(boutique.pays) ? boutique.pays : ["FR"]).filter((c) => /^[A-Z]{2}$/.test(c));
  (pays.length ? pays : ["FR"]).forEach((c, i) => params.append(`shipping_address_collection[allowed_countries][${i}]`, c));

  const fraisPort = nombre(boutique.livraison_prix);
  if (fraisPort >= 0 && Number.isFinite(fraisPort)) {
    const seuil = nombre(boutique.livraison_offerte_des);
    const offerte = seuil > 0 && sousTotal >= Math.round(seuil * 100);
    const montant = offerte ? 0 : Math.round(fraisPort * 100);
    const base = "shipping_options[0][shipping_rate_data]";
    params.append(`${base}[type]`, "fixed_amount");
    params.append(`${base}[display_name]`, offerte ? "Livraison offerte" : (boutique.livraison_nom || "Livraison"));
    params.append(`${base}[fixed_amount][amount]`, String(montant));
    params.append(`${base}[fixed_amount][currency]`, "eur");
    const min = Math.floor(nombre(boutique.livraison_jours_min));
    const max = Math.floor(nombre(boutique.livraison_jours_max));
    if (min > 0 && max >= min) {
      params.append(`${base}[delivery_estimate][minimum][unit]`, "business_day");
      params.append(`${base}[delivery_estimate][minimum][value]`, String(min));
      params.append(`${base}[delivery_estimate][maximum][unit]`, "business_day");
      params.append(`${base}[delivery_estimate][maximum][value]`, String(max));
    }
  }

  let reponse;
  try {
    reponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  } catch (e) {
    console.error("Stripe injoignable", e);
    return json({ erreur: "Le paiement n'a pas pu démarrer. Réessayez dans un instant." }, 502);
  }
  const session = await reponse.json().catch(() => ({}));

  if (!reponse.ok || !session.url) {
    console.error("Erreur Stripe", reponse.status, JSON.stringify(session.error || session));
    return json({ erreur: "Le paiement n'a pas pu démarrer. Réessayez dans un instant." }, 502);
  }
  return json({ url: session.url });
}

async function lireContenu({ request, env }, chemin) {
  const res = await env.ASSETS.fetch(new URL(chemin, request.url).toString());
  if (!res.ok) throw new Error(`Contenu introuvable : ${chemin} (${res.status})`);
  return res.json();
}

function nombre(v) {
  return typeof v === "number" ? v : Number.parseFloat(String(v ?? "").replace(",", "."));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
