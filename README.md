# Arta Gustului Media

Centru multimedia pentru restaurantul Arta Gustului (Windows 10/11, 64-bit).

## Instalare pe laptop

1. Rulează `installer/ArtaGustului-Media-Setup-1.0.0.exe` → Următorul → Instalează.
   Se creează scurtătura **Arta Gustului Media** pe Desktop.
   Varianta `ArtaGustului-Media-Portabil-1.0.0.exe` pornește fără instalare (de pe stick).
2. La prima pornire, Windows poate întreba de **Firewall** → bifează *Rețele private* → Permite.
   Este necesar pentru telecomanda din telefon (QR).
3. Windows SmartScreen poate afișa „Windows a protejat computerul” (aplicația nu are semnătură digitală):
   *Mai multe informații → Rulează oricum*.

## Ce face

- Pornește pe tot ecranul; butonul roșu **Ieșire** este în colțul din dreapta sus. `F11` comută ecranul complet.
- **Acasă**: acces rapid la Spotify, YouTube, telefon, ieșirea audio și un ghid animat pentru LG.
- **Browser** integrat cu file (Chromium + Widevine, deci Spotify Web Player și YouTube funcționează) și extensii din Magazinul Chrome.
- **Telefon**: receptor Bluetooth (telefonul redă prin laptop → LG), Spotify Connect și telecomandă prin QR.
- **Ghid LG**: animație în 5 pași (pornire ⏻/I, cablu jack 3.5 mm → PORT. IN, PORTABLE, volum, muzică).
  Partea mufei 🎧 a laptopului (stânga/dreapta) se alege în ghid sau în Setări.
- **Setări**: ieșirea audio Windows, volumul, extensiile, pornirea odată cu Windows.

## Note

- Receptorul Bluetooth necesită Windows 10 versiunea 2004 sau mai nouă, iar telefonul trebuie asociat o dată
  din *Setări Bluetooth → Adaugă dispozitiv*.
- Widevine (protecția conținutului pentru Spotify) vine din Electron-ul castLabs. Pentru licențe stricte,
  aplicația poate fi semnată VMP gratuit cu `castlabs-evs` (`pip install castlabs-evs`,
  `python -m castlabs_evs.account signup`, apoi `python -m castlabs_evs.vmp sign-pkg dist/win-unpacked`
  înainte de a crea installerul).

## Dezvoltare

```
npm install
npm start
```

Installerul se construiește cu `npm run dist`. NSIS nu acceptă căi foarte lungi, așa că proiectul trebuie
construit dintr-un folder cu cale scurtă (de ex. `C:\agb`).
