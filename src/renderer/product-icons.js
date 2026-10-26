// Iconite de contur pentru produse (24x24). kw = cuvinte cheie pentru cautare si potrivire automata.
(function () {
  const P = [
    { id: 'coffee', label: 'Cafea', kw: 'cafea espresso americano ristretto lungo coffee', d: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8.5 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3"/><path d="M4 21h14"/>' },
    { id: 'latte', label: 'Latte', kw: 'latte cappuccino flat white macchiato lapte frappe', d: '<path d="M7 4h10l-1.5 16h-7Z"/><path d="M7.4 8.5h9.2"/><path d="M10 13c1-1 3-1 4 0-1 1.5-3 1.5-4 0Z"/>' },
    { id: 'tea', label: 'Ceai', kw: 'ceai tea infuzie', d: '<path d="M4 9h12v4a6 6 0 0 1-12 0Z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M10 9V5"/><rect x="8.5" y="3" width="3" height="3" rx=".5"/>' },
    { id: 'hotchoc', label: 'Ciocolată caldă', kw: 'ciocolata calda cacao', d: '<path d="M5 8h12v6a6 6 0 0 1-12 0Z"/><path d="M5 11c2 1 4 1 6 0s4-1 6 0"/><path d="M9 3.5l1 2.5M13 3.5l-1 2.5"/>' },
    { id: 'water', label: 'Apă', kw: 'apa plata minerala water', d: '<path d="M9.5 2.5h5v2.5l1.5 2v13a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20.5v-13l1.5-2Z"/><path d="M8 11h8M8 16h8"/>' },
    { id: 'soda', label: 'Răcoritoare', kw: 'cola fanta sprite suc racoritoare soda pepsi', d: '<path d="M7 5h10l-1 15a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20Z"/><path d="M7.3 9h9.4"/><path d="M13 5l2-3h2.5"/><circle cx="11" cy="14" r=".6"/><circle cx="13" cy="16.5" r=".6"/>' },
    { id: 'juice', label: 'Suc natural', kw: 'suc fresh portocale natural limonada juice', d: '<path d="M6 7h12l-1.5 13.5h-9Z"/><path d="M14 7l2-4.5"/><circle cx="16.5" cy="7" r="3" opacity=".9"/><path d="M6.5 11h11"/>' },
    { id: 'lemonade', label: 'Limonadă', kw: 'limonada lemonade menta mojito fara alcool', d: '<path d="M6 6h12l-2 15H8Z"/><path d="M15 6 17 2"/><path d="M9 11.5a3 3 0 0 0 6 0Z"/><path d="M10 16h4"/>' },
    { id: 'beer', label: 'Bere', kw: 'bere draft halba beer pils lager', d: '<path d="M5 7h10v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"/><path d="M15 9.5h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/><path d="M5 7a2.5 2.5 0 0 1 2.5-3c.8-1.2 2.7-1.2 3.5 0A2.5 2.5 0 0 1 15 7"/><path d="M8.5 11v6M11.5 11v6"/>' },
    { id: 'beerbottle', label: 'Bere sticlă', kw: 'bere sticla doza bottle', d: '<path d="M10 2.5h4v4l1.5 3V20a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 20V9.5l1.5-3Z"/><path d="M8.5 13h7v4h-7Z"/>' },
    { id: 'wine', label: 'Vin', kw: 'vin pahar rosu alb rose wine', d: '<path d="M7 3h10c0 5.5-1.5 9-5 9S7 8.5 7 3Z"/><path d="M12 12v8M8.5 21h7"/><path d="M7.4 6.5h9.2"/>' },
    { id: 'winebottle', label: 'Vin sticlă', kw: 'vin sticla bottle sampanie', d: '<path d="M10.5 2.5h3v5c1.8.8 2.5 2.2 2.5 4V20a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20v-8.5c0-1.8.7-3.2 2.5-4Z"/><path d="M8 13h8v4H8Z"/>' },
    { id: 'champagne', label: 'Șampanie', kw: 'sampanie spumant prosecco champagne', d: '<path d="M9 3h6l-.5 6a2.5 2.5 0 0 1-5 0Z"/><path d="M12 11.5V20M9 21h6"/><path d="M17 4l2-1M17.5 7H20M17 10l2 1"/>' },
    { id: 'cocktail', label: 'Cocktail', kw: 'cocktail martini aperol spritz long drink', d: '<path d="M4 4h16l-8 9Z"/><path d="M12 13v7M8 21h8"/><path d="M15 4l3-2"/><circle cx="16" cy="7.5" r="1.5"/>' },
    { id: 'spirits', label: 'Tărie', kw: 'whisky coniac vodca rachiu tarie shot spirits divin', d: '<path d="M6 8h12l-1.2 11.5a1.5 1.5 0 0 1-1.5 1.5H8.7a1.5 1.5 0 0 1-1.5-1.5Z"/><path d="M6.5 13h11"/><rect x="9" y="14.5" width="3" height="3" rx=".6"/><rect x="12.5" y="14" width="3" height="3" rx=".6"/>' },
    { id: 'eggs', label: 'Ouă', kw: 'oua omleta ochiuri mic dejun breakfast', d: '<path d="M3.5 13.5c0-3.5 2.5-6 6-6 2 0 3 1 4.5 1s2.5-1 4.5-.5c2 .6 2.5 3.2 1.5 5.5-1.2 2.8-4 4.5-8 4.5-5 0-8.5-1.8-8.5-4.5Z"/><circle cx="10" cy="12.5" r="2.5"/>' },
    { id: 'pancake', label: 'Clătite', kw: 'clatite pancakes blinchik', d: '<ellipse cx="12" cy="16" rx="8" ry="3"/><path d="M4 13c0 1.7 3.6 3 8 3s8-1.3 8-3"/><ellipse cx="12" cy="11" rx="8" ry="3"/><path d="M14 8.5c1 0 2 .6 2 1.5"/>' },
    { id: 'croissant', label: 'Croissant', kw: 'croissant patiserie corn', d: '<path d="M3 15c1-5 5-8 9-8s8 3 9 8c-2 .8-4 1-5 0-1 1.5-2.5 2-4 2s-3-.5-4-2c-1 1-3 .8-5 0Z"/><path d="M9 8.5 10 15M15 8.5 14 15"/>' },
    { id: 'bread', label: 'Pâine', kw: 'paine bread chifla bruschete', d: '<path d="M4 11a4 4 0 0 1 1-7.5h14A4 4 0 0 1 20 11v8.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/><path d="M9 8l-1.5 2M13 8l-1.5 2M17 8l-1.5 2"/>' },
    { id: 'sandwich', label: 'Sandviș', kw: 'sandvis sandwich toast club panini', d: '<path d="M3 15 12 5l9 10Z"/><path d="M3 15v3h18v-3"/><path d="M6 13.5c1 .8 2 .8 3 0s2-.8 3 0 2 .8 3 0 2-.8 3 0"/>' },
    { id: 'burger', label: 'Burger', kw: 'burger hamburger cheeseburger', d: '<path d="M4 11a8 6 0 0 1 16 0Z"/><path d="M3.5 14h17"/><path d="M4 17h16v1a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18Z"/><path d="M9 7.5h.01M12 6.5h.01M15 7.5h.01"/>' },
    { id: 'hotdog', label: 'Hot-dog', kw: 'hot dog crenvursti shaorma wrap', d: '<path d="M3.5 14.5c0 3 3.5 5 8.5 5s8.5-2 8.5-5"/><path d="M4 12.5c1.5-.8 2.5-1 4-1h8c1.5 0 2.5.2 4 1"/><path d="M5 10.5h14a2 2 0 0 1 0 4H5a2 2 0 0 1 0-4Z"/><path d="M7 12.5c1-.6 2 .6 3 0s2 .6 3 0 2 .6 3 0"/>' },
    { id: 'pizza', label: 'Pizza', kw: 'pizza margherita quattro diavola', d: '<path d="M12 21 3.5 5.5a14 14 0 0 1 17 0Z"/><path d="M5.2 8.5a11 11 0 0 1 13.6 0"/><circle cx="11" cy="11.5" r="1.3"/><circle cx="14" cy="14" r="1"/><circle cx="10.5" cy="16" r="1"/>' },
    { id: 'pasta', label: 'Paste', kw: 'paste spaghete carbonara bolognese tagliatelle pasta', d: '<path d="M3 13h18a9 6 0 0 1-18 0Z"/><path d="M7 13c0-3 2-3 2-6M11 13c0-3 2-3 2-6M15 13c0-3 2-3 2-6"/><path d="M8 21h8"/>' },
    { id: 'steak', label: 'Friptură', kw: 'friptura carne vita porc steak antricot cotlet', d: '<path d="M5 7c3-3 9-3 12 0 3 2.5 3 7 0 10-3 3-9 3-12 0-2.5-2.5-2.5-7.5 0-10Z"/><circle cx="14" cy="11" r="2"/><path d="M7 11c1-1.5 2.5-2 4-2"/>' },
    { id: 'chicken', label: 'Pui', kw: 'pui piept aripioare chicken pulpe frigarui', d: '<path d="M14.5 4a5.5 5.5 0 0 1 3 10c-1.5 1-3.5 1-5 .5L9 18"/><path d="M14.5 4A5.5 5.5 0 0 0 9 9.5c0 1.5.5 2.5 1.5 3.5"/><circle cx="7" cy="19.5" r="1.6"/><circle cx="9.5" cy="20.5" r="1.4"/>' },
    { id: 'fish', label: 'Pește', kw: 'peste somon dorada pastrav fish fructe de mare', d: '<path d="M3 12c3-4.5 8-6 12-4 2 1 3.5 2.5 4 4-.5 1.5-2 3-4 4-4 2-9 .5-12-4Z"/><path d="M19 12l2.5-3v6Z"/><circle cx="15.5" cy="11" r=".7"/><path d="M10 9c1 2 1 4 0 6"/>' },
    { id: 'sushi', label: 'Sushi', kw: 'sushi rulouri maki', d: '<ellipse cx="12" cy="9" rx="7" ry="3"/><path d="M5 9v6c0 1.7 3.1 3 7 3s7-1.3 7-3V9"/><ellipse cx="12" cy="9" rx="3" ry="1.3"/>' },
    { id: 'grill', label: 'Grătar', kw: 'gratar mici grill bbq frigarui kebab', d: '<path d="M4 10h16a8 6 0 0 1-16 0Z"/><path d="M8 20l2-4M16 20l-2-4"/><path d="M8 6.5c-.6-1 .6-2 0-3M12 6.5c-.6-1 .6-2 0-3M16 6.5c-.6-1 .6-2 0-3"/>' },
    { id: 'salad', label: 'Salată', kw: 'salata caesar greceasca verde salad', d: '<path d="M3 12h18a9 7 0 0 1-18 0Z"/><path d="M7 12c-1-3 1-5 3-5 0-2 3-3 4-1 2-1 4 1 3 3 1 1 1 2 0 3"/><path d="M12 12c0-2 1-3 2-3.5"/>' },
    { id: 'soup', label: 'Supă', kw: 'supa zeama ciorba borș bors soup crema', d: '<path d="M3 11h18a9 7 0 0 1-18 0Z"/><path d="M8 21h8"/><path d="M9 7.5c-.7-1 .7-2 0-3M13 7.5c-.7-1 .7-2 0-3"/><path d="M15 10l5-6"/>' },
    { id: 'fries', label: 'Cartofi prăjiți', kw: 'cartofi prajiti fries garnitura', d: '<path d="M5 10h14l-2 11H7Z"/><path d="M7.5 10 7 3.5M10 10V2.5M12.5 10l.5-7M15 10l1.5-6"/><path d="M8.5 14.5a3.5 3.5 0 0 0 7 0"/>' },
    { id: 'rice', label: 'Garnitură', kw: 'orez garnitura piure mamaliga legume rice', d: '<path d="M3 13h18a9 6 0 0 1-18 0Z"/><path d="M6 13c0-3 3-5 6-5s6 2 6 5"/><path d="M9 10.5h.01M12 9.5h.01M15 10.5h.01M10.5 12h.01M13.5 12h.01"/>' },
    { id: 'placinta', label: 'Plăcintă', kw: 'placinta branza varza vargabi zeama traditional', d: '<path d="M3 15c0-4 4-7 9-7s9 3 9 7c0 1.5-1.5 2.5-3 2.5H6c-1.5 0-3-1-3-2.5Z"/><path d="M7 11c1.5 1 3 1.5 5 1.5s3.5-.5 5-1.5"/><path d="M8 17.5v2M16 17.5v2"/>' },
    { id: 'cake', label: 'Tort', kw: 'tort prajitura cheesecake desert cake felie', d: '<path d="M3 13 20 7v12H3Z"/><path d="M3 13h17"/><path d="M3 16.5h17"/><path d="M15 8.5V6M15 5.5c-.6-.6 0-1.5 0-1.5s.6.9 0 1.5"/>' },
    { id: 'icecream', label: 'Înghețată', kw: 'inghetata gelato ice cream sorbet', d: '<path d="M7 11h10l-5 10Z"/><path d="M7 11a5 5 0 0 1 10 0"/><path d="M9.5 6.5a3 3 0 0 1 5 0"/>' },
    { id: 'donut', label: 'Gogoașă', kw: 'gogoasa donut papanasi', d: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M6 9.5l1 .5M9 6l.3 1M14.5 6.5l-.5.8M18 10l-1 .3M17 15l-.8-.5M8 16.5l.7-.7"/>' },
    { id: 'fruit', label: 'Fructe', kw: 'fructe platou mar fruct fruit', d: '<path d="M12 7c-1.5-1-4.5-1.5-6 .5-2 2.5-1 7 1 9.5 1.5 2 3 2.5 5 1.5 2 1 3.5.5 5-1.5 2-2.5 3-7 1-9.5-1.5-2-4.5-1.5-6-.5Z"/><path d="M12 7V4M12 5c1-1.5 2.5-2 4-1.5"/>' },
    { id: 'kids', label: 'Meniu copii', kw: 'copii kids meniu copil', d: '<circle cx="12" cy="9" r="5"/><path d="M10 8.5h.01M14 8.5h.01"/><path d="M10.2 10.8c1 .8 2.6.8 3.6 0"/><path d="M6.5 21a5.5 5.5 0 0 1 11 0"/><path d="M9.5 4.3c.5-1.3 2-1.8 3-1"/>' },
    { id: 'sauce', label: 'Sos', kw: 'sos ketchup maioneza mujdei smantana extra', d: '<path d="M8 8h8v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2Z"/><path d="M9.5 8V5.5a2.5 2.5 0 0 1 5 0V8"/><path d="M8 13h8"/>' },
    { id: 'hookah', label: 'Narghilea', kw: 'narghilea hookah shisha', d: '<path d="M10 3h4M12 3v5"/><path d="M9 8h6l-1 3h-4Z"/><path d="M12 11v2"/><path d="M8 17a4 4 0 0 1 8 0v2.5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 19.5Z"/><path d="M16 16c2.5 0 3.5-1.5 4-4"/>' },
    { id: 'gift', label: 'Altele', kw: 'altele diverse serviciu taxa cadou', d: '<rect x="3.5" y="9" width="17" height="11.5" rx="1.5"/><path d="M3.5 13h17M12 9v11.5"/><path d="M12 9c-1.5-3-5-4-5-1.5S10.5 9 12 9c1.5 0 5 1 5-1.5S13.5 6 12 9Z"/>' },
  ];

  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const byId = Object.fromEntries(P.map((p) => [p.id, p]));

  window.PRODUCT_ICONS = P;
  window.productIcon = function (id, cls = '') {
    const p = byId[id] || byId.gift;
    return `<svg class="pico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p.d}</svg>`;
  };
  // Cauta iconite dupa text (nume sau cuvant cheie)
  window.searchProductIcons = function (q) {
    const t = norm(q).trim();
    if (!t) return P;
    return P.filter((p) => norm(`${p.label} ${p.kw}`).includes(t));
  };
  // Potrivire automata: alege iconita dupa numele produsului
  window.guessProductIcon = function (name) {
    const words = norm(name).split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    let best = null, bestScore = 0;
    for (const p of P) {
      const hay = norm(`${p.label} ${p.kw}`).split(/\s+/);
      let score = 0;
      for (const w of words) for (const h of hay) if (h === w) score += 3; else if (h.startsWith(w) || w.startsWith(h)) score += 1;
      if (score > bestScore) { bestScore = score; best = p.id; }
    }
    return best;
  };
})();
