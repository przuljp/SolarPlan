# Završna provjera korisničkog toka

Datum: 5. novembar 2026. Lokalni Docker Compose, stvarni backend i baza, zaseban sintetički QA nalog i projekat. Korisnikovi postojeći projekti nisu mijenjani.

| Scenario | Rezultat |
|---|---|
| Registracija, prijava, prazan dashboard, novi projekat i odjava | Prošlo |
| Nominatim pretraga Sarajeva i čuvanje lokacije | Prošlo |
| Pravougaona južna i trapezna zapadna ploha | Prošlo |
| Zajednički panel; druga ploha ne dopušta drugi model | Prošlo |
| Preview, promjena orijentacije, ručni broj i čuvanje rasporeda | Prošlo |
| Ponovno otvaranje ručno sačuvanog rasporeda | Ispravljeno i ponovo prošlo: 4 panela, landscape, maksimum 7 |
| Stvarni PVGIS, obje plohe, podrazumijevanih 14% gubitaka | Prošlo |
| Parcijalna potrošnja za tri mjeseca | Prošlo; nema izmišljene godišnje potrošnje |
| Stvarno AI objašnjenje sa parcijalnom potrošnjom | Prošlo |
| Optimizer: match consumption sa parcijalnim profilom | Očekivano odbijen sa jasnom porukom |
| Optimizer: maximum production, tri kandidata i primjena | Prošlo; layout-i i nova simulacija ažurirani |
| Istorija i poređenje ručne i optimizer simulacije | Prošlo; zbirno poređenje bez razlika po plohama |
| Stvarno AI poređenje sa potrošnjom | Prvi pokušaj 503; ručni ponovni pokušaj 200 i validiran prikaz |
| PDF/CSV dugmad nad sačuvanom simulacijom | Oba stvarna endpointa vratila 200; sadržaj/render pokrivaju postojeći report testovi i ranija vizuelna provjera |
| Ručni gubici 31% i 10% | 31% blokira slanje; 10% uspješno sačuvano u novoj PVGIS simulaciji i prikazano u pretpostavkama |
| Responzivni prikaz analize/poređenja | Provjereno na 390px i desktop prikazu 1440px; lokalno skrolovanje grafikona, bez prelivanja cijele stranice |

## Ispravke tokom provjere

- Layout forma prvo čita sačuvanu plohu; čuva broj i orijentaciju za isti panel. Ako čitanje ne uspije, ne nudi prepisivanje podrazumijevanim vrijednostima.
- Odjava i nova prijava prazne TanStack Query cache da privatni podaci ne ostanu prikazani između sesija.
- Analysis grid dozvoljava skupljanje sadržaja; tooltip ostaje u mobilnom ekranu.
- Analysis prikazuje da su rezultati sačuvani snapshot i da promjene krova zahtijevaju Recalculate. Ručni gubici nose oznaku Manual estimate.
- Vite koristi polling zbog nepouzdanih događaja izmjene fajlova na Windows Docker bind mountu.
- AI adapter bilježi samo naziv vrste greške, bez ključeva, sadržaja zahtjeva ili odgovora, radi bezbjedne dijagnostike.

## Granice provjere

Ovo nije test svih kombinacija ulaza niti svih browsera. Annual-only/complete-monthly potrošnja, ostali optimizer režimi, vlasništvo, greške servisa i sadržaj izvještaja dodatno su pokriveni automatizovanim testovima. Čist deployment, distribuirano ograničavanje zahtjeva i produkcijska konfiguracija ostaju zaseban korak. Uzrok prvog AI 503 nije utvrđen; ponovni pokušaj je uspio, a nema automatskog ponavljanja plaćenih zahtjeva.

QA nalog i projekat ostavljeni su u lokalnoj bazi radi ponovljivosti. Pristupni podaci se ne čuvaju u repozitoriju.

## Izmijenjeni fajlovi i automatizovane provjere

- `frontend/src/pages/PanelLayoutPage.tsx` i novi `PanelLayoutPage.test.tsx`.
- `frontend/src/auth/AuthContext.tsx` i novi `AuthContext.test.tsx`.
- `frontend/src/pages/ProductionAnalysisPage.tsx`, `frontend/src/components/SystemLossControl.tsx`, `frontend/src/styles.css`.
- `frontend/vite.config.ts`.
- `backend/app/integrations/openai_client.py`.
- `docs/DEVELOPMENT_CONTEXT.md` i ovaj dokument.

Frontend: 27/27 testova i produkcijski build prolaze. Backend: kompletna kolekcija 164/164; nakon dodavanja dijagnostike ponovo 31/31 AI test. Ruff i `git diff --check` prolaze. Postojeća upozorenja: frontend chunk veći od 500 kB i pytest-asyncio podrazumijevani scope nije eksplicitno podešen.
