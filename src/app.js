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
  var livraison = $("panier-livraison"), blocCgv = $("bloc-cgv"), caseCgv = $("accepte-cgv");
  var btnCommander = $("panier-commander"), erreur = $("panier-erreur");
  var btnPanier = $("panier-btn"), btnFermer = $("panier-fermer");
  var toastTimer, dernierFocus = null;

  // Panier mémorisé dans le navigateur (stockage local, exempté de consentement : contenu du panier).
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
    btnPanier.setAttribute("aria-label", n === 0 ? "Ouvrir le panier (vide)" : "Ouvrir le panier (" + n + (n > 1 ? " kits)" : " kit)"));
    liste.innerHTML = "";
    Object.keys(panier).forEach(function (id) {
      var p = catalogue[id], li = document.createElement("li");
      li.innerHTML = '<img src="' + echapper(p.image) + '" alt="">' +
        '<div><b>' + echapper(p.nom) + '</b><small>' + echapper(p.effet) + '</small>' +
        '<span class="ligne-prix">' + euros.format(p.prix * panier[id]) + '</span></div>' +
        '<div class="qte" role="group" aria-label="Quantité de ' + echapper(p.nom) + '">' +
        '<button type="button" data-moins="' + echapper(id) + '" aria-label="Retirer un ' + echapper(p.nom) + '">−</button>' +
        '<span aria-live="polite">' + panier[id] + '</span>' +
        '<button type="button" data-plus="' + echapper(id) + '" aria-label="Ajouter un ' + echapper(p.nom) + '">+</button></div>';
      liste.appendChild(li);
    });
    vide.hidden = n > 0;
    liste.hidden = n === 0;
    blocTotal.hidden = n === 0;
    livraison.hidden = n === 0;
    blocCgv.hidden = n === 0;
    btnCommander.hidden = n === 0;
    montantTotal.textContent = euros.format(total());
  }

  /* Panier en fenêtre de dialogue accessible : focus déplacé, reste de la page inerte, Échap pour fermer */
  var autour = function () {
    return Array.prototype.filter.call(document.body.children, function (el) {
      return el !== tiroir && el !== voile && el !== toast && el.tagName !== "SCRIPT";
    });
  };
  function ouvrir() {
    dernierFocus = document.activeElement;
    tiroir.hidden = false;
    voile.hidden = false;
    autour().forEach(function (el) { el.setAttribute("inert", ""); });
    btnFermer.focus();
  }
  function fermer() {
    if (tiroir.hidden) return;
    tiroir.hidden = true;
    voile.hidden = true;
    autour().forEach(function (el) { el.removeAttribute("inert"); });
    if (dernierFocus && dernierFocus.focus) dernierFocus.focus();
  }

  function message(txt) {
    toast.textContent = txt;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 3000);
  }

  function afficherErreur(txt) {
    erreur.textContent = txt;
    erreur.hidden = false;
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
    // Après suppression du dernier exemplaire, garder le focus dans le panier.
    if (t.hasAttribute("data-moins") && !document.body.contains(t)) btnFermer.focus();
  });

  caseCgv.addEventListener("change", function () { if (caseCgv.checked) erreur.hidden = true; });

  function reinitialiserBouton() {
    btnCommander.disabled = false;
    btnCommander.textContent = "Passer au paiement";
  }

  btnCommander.addEventListener("click", function () {
    erreur.hidden = true;
    if (!caseCgv.checked) {
      afficherErreur("Cochez la case pour accepter les conditions générales de vente.");
      caseCgv.focus();
      return;
    }
    btnCommander.disabled = true;
    btnCommander.textContent = "Ouverture du paiement…";
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cgv: true,
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
        afficherErreur(err && err.message && err.message !== "Failed to fetch"
          ? err.message
          : "Connexion impossible. Vérifiez votre réseau et réessayez.");
        reinitialiserBouton();
      });
  });

  // Retour depuis la page de paiement avec le bouton « précédent » du navigateur.
  window.addEventListener("pageshow", reinitialiserBouton);

  btnPanier.addEventListener("click", ouvrir);
  btnFermer.addEventListener("click", fermer);
  $("panier-continuer").addEventListener("click", fermer);
  voile.addEventListener("click", fermer);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") fermer();
    // Garder la tabulation dans le panier ouvert.
    if (e.key === "Tab" && !tiroir.hidden) {
      var focusables = Array.prototype.filter.call(
        tiroir.querySelectorAll("a[href], button:not([disabled]), input:not([disabled])"),
        function (el) { return !el.hidden && el.offsetParent !== null; }
      );
      if (!focusables.length) return;
      var premier = focusables[0], dernier = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    }
  });

  var menuBtn = $("menu-btn"), navMobile = $("nav-mobile");
  menuBtn.addEventListener("click", function () {
    var ouvert = navMobile.hidden;
    navMobile.hidden = !ouvert;
    menuBtn.setAttribute("aria-expanded", String(ouvert));
    menuBtn.setAttribute("aria-label", ouvert ? "Fermer le menu" : "Ouvrir le menu");
  });
  navMobile.addEventListener("click", function (e) {
    if (e.target.closest("a")) {
      navMobile.hidden = true;
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "Ouvrir le menu");
    }
  });

  rendu();
})();
