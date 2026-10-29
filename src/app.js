// Panier, menu mobile et passage au paiement Stripe.
(function () {
  "use strict";

  var CLE = "lasheane-panier";
  var catalogue = {};
  try {
    JSON.parse(document.getElementById("catalogue").textContent).forEach(function (p) { catalogue[p.id] = p; });
  } catch (e) { /* catalogue vide */ }

  var euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  var $ = function (id) { return document.getElementById(id); };
  var compteur = $("compteur"), liste = $("panier-liste"), vide = $("panier-vide");
  var tiroir = $("panier"), voile = $("voile"), toast = $("toast");
  var blocTotal = $("panier-total"), montantTotal = $("total-montant");
  var btnCommander = $("panier-commander"), erreur = $("panier-erreur");
  var toastTimer;

  // Panier mémorisé dans le navigateur de la cliente (simple confort, jamais indispensable).
  var panier = {};
  try {
    var sauve = JSON.parse(localStorage.getItem(CLE) || "{}");
    Object.keys(sauve).forEach(function (id) {
      var q = parseInt(sauve[id], 10);
      if (catalogue[id] && q > 0) panier[id] = Math.min(q, 10);
    });
  } catch (e) { panier = {}; }

  function sauver() {
    try { localStorage.setItem(CLE, JSON.stringify(panier)); } catch (e) { /* stockage indisponible */ }
  }

  function nombre() { var n = 0; for (var k in panier) n += panier[k]; return n; }
  function total() { var t = 0; for (var k in panier) t += catalogue[k].prix * panier[k]; return t; }

  function echapper(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function rendu() {
    var n = nombre();
    compteur.textContent = n;
    compteur.hidden = n === 0;
    liste.innerHTML = "";
    Object.keys(panier).forEach(function (id) {
      var p = catalogue[id], li = document.createElement("li");
      li.innerHTML = '<img src="' + echapper(p.image) + '" alt="">' +
        '<div><b>' + echapper(p.nom) + '</b><small>' + echapper(p.effet) + '</small>' +
        '<span class="ligne-prix">' + euros.format(p.prix * panier[id]) + '</span></div>' +
        '<div class="qte"><button type="button" data-moins="' + echapper(id) + '" aria-label="Retirer un ' + echapper(p.nom) + '">−</button>' +
        '<span>' + panier[id] + '</span>' +
        '<button type="button" data-plus="' + echapper(id) + '" aria-label="Ajouter un ' + echapper(p.nom) + '">+</button></div>';
      liste.appendChild(li);
    });
    vide.hidden = n > 0;
    liste.hidden = n === 0;
    blocTotal.hidden = n === 0;
    btnCommander.hidden = n === 0;
    montantTotal.textContent = euros.format(total());
  }

  function ouvrir() { tiroir.hidden = false; voile.hidden = false; }
  function fermer() { tiroir.hidden = true; voile.hidden = true; }

  function message(txt) {
    toast.textContent = txt;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 2400);
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-ajout],[data-plus],[data-moins]");
    if (!t) return;
    var id = t.getAttribute("data-ajout") || t.getAttribute("data-plus") || t.getAttribute("data-moins");
    if (!catalogue[id]) return;
    if (t.hasAttribute("data-moins")) {
      panier[id] -= 1;
      if (panier[id] <= 0) delete panier[id];
    } else {
      panier[id] = Math.min((panier[id] || 0) + 1, 10);
      if (t.hasAttribute("data-ajout")) message(catalogue[id].nom + " ajouté au panier");
    }
    erreur.hidden = true;
    sauver();
    rendu();
  });

  function reinitialiserBouton() {
    btnCommander.disabled = false;
    btnCommander.textContent = "Commander";
  }

  btnCommander.addEventListener("click", function () {
    erreur.hidden = true;
    btnCommander.disabled = true;
    btnCommander.textContent = "Ouverture du paiement…";
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articles: Object.keys(panier).map(function (id) { return { id: id, quantite: panier[id] }; })
      })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data.url) throw new Error(data.erreur || "Le paiement n'a pas pu démarrer. Réessayez dans un instant.");
          window.location.href = data.url;
        });
      })
      .catch(function (err) {
        erreur.textContent = err && err.message && err.message !== "Failed to fetch"
          ? err.message
          : "Connexion impossible. Vérifiez votre réseau et réessayez.";
        erreur.hidden = false;
        reinitialiserBouton();
      });
  });

  // Retour depuis la page de paiement avec le bouton « précédent » du navigateur.
  window.addEventListener("pageshow", reinitialiserBouton);

  $("panier-btn").addEventListener("click", ouvrir);
  $("panier-fermer").addEventListener("click", fermer);
  $("panier-continuer").addEventListener("click", fermer);
  voile.addEventListener("click", fermer);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") fermer(); });

  var menuBtn = $("menu-btn"), navMobile = $("nav-mobile");
  menuBtn.addEventListener("click", function () {
    var ouvert = navMobile.hidden;
    navMobile.hidden = !ouvert;
    menuBtn.setAttribute("aria-expanded", String(ouvert));
  });
  navMobile.addEventListener("click", function (e) {
    if (e.target.closest("a")) { navMobile.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); }
  });

  rendu();
})();
