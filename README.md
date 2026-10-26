# Arta Gustului Media

Centru multimedia și casă de marcat pentru restaurantul Arta Gustului (Windows 10/11, 64-bit).

## Instalare pe laptop

1. Rulează `ArtaGustului-Media-Setup-<versiune>.exe` → Următorul → Instalează.
   Varianta `…-Portabil-…exe` pornește fără instalare.
2. La prima pornire, Windows poate întreba de **Firewall** → bifează *Rețele private* → Permite.
3. SmartScreen („Windows a protejat computerul”): *Mai multe informații → Rulează oricum* (aplicația nu are semnătură digitală).

## Casa de marcat

- **Telefonul este calculatorul.** Ospătarii scanează codul QR (Casă → Panou sau pagina Telefon) și:
  aleg masa, adaugă produse, deschid cecuri, mută masa, pun note, încasează cu rest; au și un calculator liber de sume.
- **Laptopul este ecranul casei (Panou):** cecurile active, mare, și — live — totalul, suma primită și **restul**
  calculate pe telefon. După încasare rămâne afișat restul de dat.
- **Meniul îl face personalul:** Casă → Meniu (categorii, produse, prețuri, imagini din setul integrat sau poză proprie).
  Opțional PIN de administrator (Casă → Date & copii).
- **Ordonare automată după popularitate:** contează în câte cecuri apare produsul, nu cantitatea.
  Se face zilnic sau la fiecare N cecuri, niciodată în timp ce se lucrează la un cec.
- **Raport zilnic:** total, numerar / card, cele mai comandate, vânzări pe ore, ultimele cecuri.

## Acces de pe date mobile

Cu „Acces de oriunde” pornit (pagina Telefon), aplicația deschide un tunel securizat HTTPS prin Cloudflare
(gratuit, fără cont). Telefoanele se conectează de oriunde, inclusiv de pe date mobile; datele rămân pe laptop.

- Laptopul trebuie să fie pornit și cu internet.
- Adresa se schimbă la fiecare pornire a aplicației: codul QR se actualizează singur, telefoanele scanează din nou.
- Tunelurile fără cont nu au garanție de funcționare; dacă e nevoie de o adresă fixă, se poate trece pe un tunel cu cont Cloudflare.
- Accesul cere cheia din codul QR (22 de caractere); după 15 încercări greșite adresa respectivă e blocată 10 minute.

## Datele

- Baza de date este integrată (SQLite din aplicație, fără server): `%USERPROFILE%\Arta Gustului\casa.db`.
- Copii automate: la pornire, la fiecare oră cu modificări și la închidere, în `Arta Gustului\copii-de-rezerva`
  și o a doua copie în `Documente\Arta Gustului - copii de rezerva`.
- Nu se șterg la dezinstalare sau actualizare. Dacă baza lipsește, aplicația o restaurează singură din ultima copie.
- **Transfer pe alt calculator:** Casă → Date & copii → *Exportă* (fișier `.agdb`), apoi pe celălalt PC *Importă*.

## Viteză pe calculatoare slabe

Mod economic automat (fără efecte, animații doar când se văd), blocant de reclame integrat în browser
(extensiile MV3 de tip uBlock Lite nu funcționează în Electron), YouTube în H.264 (decodat de placa video),
file de browser care „adorm” după 10 minute fără folosire.

## Dezvoltare

```
npm install
powershell -File tools/get-cloudflared.ps1
npm start
```

Installerul se construiește cu `npm run dist`, dintr-un folder cu cale scurtă (NSIS nu acceptă căi foarte lungi).
`tools/get-cloudflared.ps1` descarcă `cloudflared.exe` oficial în `vendor/` și îi verifică semnătura Cloudflare.
