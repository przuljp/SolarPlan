# SolarPlan — razvojni kontekst

> Stanje dokumentovano: 3. novembar 2026.
> Grana: `main` (`origin/main`)
> Posljednji commit: `92d5e89 feat: add PVGIS analysis and consumption profiles`

Ovaj dokument služi za nastavak razvoja u novom Codex razgovoru. Tvrdnje su označene kao **implementirano**, **planirano** ili **treba provjeriti** gdje stanje nije moguće pouzdano utvrditi iz koda i dosadašnjeg razgovora.

## 1. Trenutna arhitektura

### Backend

- FastAPI aplikacija sa globalnim prefiksom `/api/v1`.
- Slojevi prate obrazac **Repository (DAO) → Service → Router**:
  - `repositories/`: isključivo pristup PostgreSQL bazi;
  - `services/`: poslovna pravila, autorizacija i orkestracija integracija;
  - `routers/`: tanki HTTP endpointi, validacija ulaza i mapiranje odgovora;
  - `schemas/`: Pydantic ulazni i izlazni modeli;
  - `models/`: SQLAlchemy modeli;
  - `integrations/`: klijenti prema spoljnim servisima, trenutno PVGIS;
  - `dependencies/`: autentifikacija, DB sesija i zajedničke FastAPI zavisnosti.
- Asinhroni SQLAlchemy/asyncpg, PostgreSQL i Alembic migracije `0001`–`0007`.
- JWT Bearer autentifikacija. Pristup projektu se uvijek provjerava prema vlasniku; tuđi ili nepostojeći privatni resurs vraća `404`.
- Docker Compose pokreće PostgreSQL, backend i frontend. Backend pri pokretanju primjenjuje `alembic upgrade head`; korisnik ne kreira PostgreSQL bazu ručno.

### Frontend

- React 19, TypeScript, Vite 8, React Router 7 i TanStack Query.
- `AuthProvider` čuva JWT u `sessionStorage`; `ProtectedRoute` štiti privatne stranice.
- `AppShell` daje zajedničku navigaciju i responzivni mobilni prikaz.
- `lib/api.ts` je centralni HTTP klijent, `types/api.ts` sadrži API tipove, a `ApiError` standardizuje greške.
- Leaflet/React Leaflet se koristi za izbor lokacije krova.
- Produkcijski interfejs i sav tekst u aplikaciji su na **engleskom**; objašnjenja razvoja korisniku daju se na **srpskom**.

Glavne frontend rute:

- javne: `/`, `/login`, `/register`;
- zaštićene: `/dashboard`, `/projects`, `/projects/new`, detalji i izmjena projekta;
- tok projekta: lokacija → krovne plohe → panel → raspored → analiza → potrošnja;
- pomoćne: `/settings`, `/404`.

## 2. Implementirane funkcionalnosti

### Korisnik i projekti

- Registracija, prijava, odjava i dohvat trenutno prijavljenog korisnika.
- CRUD projekata ograničen na vlasnika.
- Status projekta `draft`/`analyzed` u bazi.
- Dashboard, lista projekata, kreiranje, detalji i izmjena projekta.

### Lokacija i krov

- Pretraga i obrnuto geokodiranje preko Nominatima.
- Interaktivna Leaflet mapa i čuvanje jedne lokacije po projektu.
- Više krovnih ploha po projektu.
- Pravougaone i trapezne plohe sa dimenzijama, nagibom, azimutom, marginom i razmakom.
- CRUD krovnih ploha i SVG prikaz geometrije.

### Paneli i raspored

- Katalog od devet različitih panela sa tehničkim podacima i izvorima sa tržišta BiH.
- Pregled kataloga i pojedinačnog panela.
- Deterministički obračun kapaciteta i položaja panela za pravougaonu ili trapeznu plohu.
- Portrait/landscape orijentacija, automatski maksimum ili ručno traženi broj do kapaciteta.
- Preview, čuvanje i ponovno učitavanje rasporeda.
- Sve plohe jednog projekta moraju koristiti isti model panela; neslaganje vraća `409`.

### PVGIS analiza proizvodnje

- Integracija sa javnim PVGIS 5.3 API-jem, bez API ključa.
- Poseban PVGIS zahtjev za svaku krovnu plohu i sabiranje rezultata na nivou projekta.
- Konverzija kompasnog azimuta u PVGIS konvenciju, podesiv sistemski gubitak (podrazumijevano 14%).
- Retry obrada za privremene greške i cache po determinističkom SHA-256 ključu.
- Čuvanje nepromjenjivog snapshot-a ulaza i rezultata simulacije.
- Mjesečna i godišnja proizvodnja, specifični prinos, rezultat po plohi i datum simulacije.
- Frontend stranica Production Analysis sa grafikom, tabelom, pretpostavkama, greškama i ponovnim proračunom.
- Nakon uspješne simulacije projekat prelazi u status `analyzed`.

### Potrošnja električne energije

- Jedan profil potrošnje po projektu.
- Ručni unos godišnje vrijednosti ili 1–12 jedinstvenih mjesečnih vrijednosti.
- Parcijalni mjesečni profil ostaje parcijalan; aplikacija ne izmišlja nedostajuće mjesece niti godišnju procjenu.
- Izvedeni podaci: poznati mjeseci, zbir, prosjek, pokrivenost i tip profila.
- Frontend stranica za unos i pregled potrošnje.
- Izvedeno poređenje posljednje PVGIS simulacije i profila potrošnje: godišnji odnos i bilans, mjesečni višak/manjak za poznate mjesece, grafikon, tabela i upozorenje o ograničenjima.
- Parcijalni profil ne proizvodi izmišljenu godišnju vrijednost; godišnji profil bez mjesečne raspodjele ne proizvodi izmišljene mjesečne vrijednosti.

## 3. Najvažnije arhitektonske odluke

- `repositories` su ekvivalent DAO sloju. Naziv je drugačiji, ali odgovornost je ista: izolacija upita prema bazi.
- `/api/v1` omogućava kasnije mijenjanje API-ja bez lomljenja postojećih klijenata.
- Projekat je vlasnički korijen agregata: svi privatni podaci se dohvaćaju kroz projekat i njegovog korisnika.
- Krov nije modelovan kao jedna ploha. Jedan projekat može imati više strana krova, jer paneli mogu biti raspoređeni na više nagiba i azimuta.
- Pravougaonik nije dovoljan, pa je uveden trapez sa gornjom/donjom širinom i horizontalnim pomakom vrha.
- Korisnik je izabrao **jedan zajednički model panela za sve plohe projekta**. Time zbirna snaga i poređenje rezultata ostaju razumljivi, a konfiguracija realistična za jednu instalaciju.
- Raspored je deterministički, a ne AI-generisan. Isti ulaz mora dati isti položaj i broj panela.
- PVGIS je autoritativni numerički izvor. Budući AI može objašnjavati rezultate i pozivati alate, ali ne smije izmišljati energetske proračune.
- PVGIS simulacija čuva snapshot umjesto samo veze na trenutne podatke. Stari rezultat tako ostaje reproduktivan i nakon izmjene krova ili panela.
- Interfejs je namjerno jednostavan i vođen koracima. Dogovoreno je da jednostavnost nije mana dok su hijerarhija, status i sljedeća akcija jasni.
- Nakon čuvanja korisnik treba biti prirodno usmjeren na sljedeći korak, a ne ostavljen na istoj formi bez jasnog nastavka.
- Obim je energetska analiza za korisnika, bez admin uloge, finansijskog ROI-ja, baterija, 3D modela, LiDAR-a, automatske satelitske detekcije krova i zvaničnog građevinskog/elektroinženjerskog proračuna.
- Privatna specifikacija `docs/master-specification.md` mora ostati van GitHub-a i već je navedena u `.gitignore`.
- Za diplomski rad svaka značajna promjena treba biti objašnjena korisniku na srpskom: šta se mijenja, gdje se nalazi i kako utiče na tok aplikacije.

## 4. Veze između domena i tok podataka

```text
User 1 ── N Project
Project 1 ── 0..1 ProjectLocation
Project 1 ── N RoofSurface
RoofSurface 1 ── 0..1 PanelLayout
PanelLayout N ── 1 SolarPanel
Project 1 ── N EnergySimulation
Project 1 ── 0..1 ElectricityConsumptionProfile
```

- `User` je vlasnik projekata.
- `Project` objedinjuje jednu planiranu solarnu instalaciju.
- `ProjectLocation` daje koordinate potrebne za mapu i PVGIS.
- `RoofSurface` opisuje svaku stranu krova nezavisno.
- `PanelLayout` pripada jednoj plohi i referencira model iz kataloga `SolarPanel`.
- Servis rasporeda provjerava da svi layout-i projekta koriste isti panel.
- PVGIS servis za svaku plohu koristi lokaciju, nagib, azimut, broj panela i snagu panela; zatim sabira mjesečne i godišnje rezultate.
- `EnergySimulation` čuva kompletan snapshot ulaza i rezultata, pa projekat može imati više istorijskih simulacija.
- `ElectricityConsumptionProfile` je odvojen od simulacije. Sljedeći domeni korak je mjesečno i godišnje poređenje ova dva skupa podataka.
- Brisanje projekta kaskadno uklanja njegove lokacije, plohe, rasporede, simulacije i potrošnju; katalog panela je zajednički i ne briše se s projektom.

## 5. Aktivne API rute

Sve rute imaju prefiks `/api/v1`.

### Sistem i autentifikacija

- `GET /health` — provjera rada API-ja.
- `POST /auth/register` — registracija i izdavanje tokena.
- `POST /auth/login` — prijava i izdavanje tokena.
- `POST /auth/logout` — stateless završetak klijentske sesije.
- `GET /users/me` — profil trenutnog korisnika.

### Projekti

- `POST /projects` — kreiranje projekta.
- `GET /projects` — lista projekata vlasnika.
- `GET /projects/{project_id}` — detalji projekta.
- `PATCH /projects/{project_id}` — djelimična izmjena.
- `DELETE /projects/{project_id}` — brisanje projekta i zavisnih podataka.

### Geokodiranje i lokacija

- `GET /geocoding/search` — tekstualna pretraga adrese.
- `GET /geocoding/reverse` — adresa prema koordinatama.
- `GET /projects/{project_id}/location` — postojeća lokacija.
- `PUT /projects/{project_id}/location` — kreiranje ili zamjena lokacije.

### Krovne plohe

- `GET /projects/{project_id}/roof-surfaces` — lista ploha.
- `POST /projects/{project_id}/roof-surfaces` — nova ploha.
- `GET /projects/{project_id}/roof-surfaces/{surface_id}` — jedna ploha.
- `PUT /projects/{project_id}/roof-surfaces/{surface_id}` — potpuna izmjena.
- `DELETE /projects/{project_id}/roof-surfaces/{surface_id}` — brisanje plohe.

### Paneli i raspored

- `GET /panels` — katalog panela.
- `GET /panels/{panel_id}` — detalji panela.
- `POST /projects/{project_id}/roof-surfaces/{surface_id}/layout/preview` — obračun bez čuvanja.
- `GET /projects/{project_id}/roof-surfaces/{surface_id}/layout` — sačuvani raspored.
- `PUT /projects/{project_id}/roof-surfaces/{surface_id}/layout` — obračun i čuvanje rasporeda.

### PVGIS simulacije

- `POST /projects/{project_id}/simulations` — pokretanje i čuvanje zbirne simulacije.
- `GET /projects/{project_id}/simulations/latest` — posljednja simulacija.

### Potrošnja

- `GET /projects/{project_id}/consumption` — profil potrošnje.
- `PUT /projects/{project_id}/consumption` — kreiranje ili izmjena profila.

### Poređenje proizvodnje i potrošnje

- `GET /projects/{project_id}/energy-comparison` — izvedeni read-only rezultat iz posljednje simulacije i postojećeg profila potrošnje.

### Neaktivni legacy kod

U repozitoriju još postoje model, migracija i izvorni router za staru jednu `RoofConfiguration` i rutu `/projects/{project_id}/roof`, ali router nije registrovan u aplikaciji. Aktivni tok koristi `RoofSurface`. Brisanje legacy koda i eventualna migracija starih podataka tek treba da se procijene.

## 6. Trenutno stanje testova

### Potvrđeno u posljednjoj provjeri

- Frontend: `npm test -- --run` — **7/7 testova prolazi**.
- Frontend: `npm run build` — produkcijski TypeScript/Vite build prolazi; postoji upozorenje da je glavni JS chunk veći od 500 kB.
- Git radno stablo je prije izrade ovog dokumenta bilo čisto, a `main` nije pokazivao odstupanje od `origin/main`.

### Nije potvrđeno u posljednjoj provjeri

- Backend testovi postoje za autentifikaciju, API ugovore, modele, repozitorije, geokodiranje, layout engine, PVGIS klijent i servis, simulacije i potrošnju.
- Lokalni Python 3.13 nema instaliran `pytest`, pa kompletna backend kolekcija nije pokrenuta u ovoj provjeri.
- Ranije je PVGIS stanje imalo 86 prolaznih testova, ali to je bilo prije posljednjih izmjena potrošnje i nije dokaz za trenutni commit. Trenutnu kolekciju treba pokrenuti unutar backend Docker kontejnera ili odgovarajućeg virtualnog okruženja.

## 7. Poznati problemi i stvari koje treba provjeriti

### Poznato

- Project Detail trenutno statički prikazuje `Draft`, iako backend poslije simulacije može imati status `analyzed`.
- API daje samo posljednju simulaciju; nema liste istorije niti detalja pojedinačne simulacije.
- Legacy `RoofConfiguration` kod i tabela još postoje uz novi model `RoofSurface`.
- README opis sljedećeg koraka je djelimično zastario jer su Production Analysis UI i ručni unos potrošnje već implementirani.

### Treba provjeriti

- Pokrenuti kompletnu backend test kolekciju na trenutnom commit-u.
- Provjeriti puni end-to-end tok nakon čistog `docker compose up --build`: registracija → projekat → lokacija → više ploha → layout → PVGIS → potrošnja.
- Provjeriti da li u lokalnoj razvojnoj bazi još postoji privremena trapezna test-ploha; to je podatak iz razgovora, ne dio verzionisanog koda.
- Potvrditi ponašanje svih dev okruženja kod Vite hot reload-a; ranije je povremeno bio potreban restart frontend kontejnera i hard refresh.

## 8. Planirane funkcionalnosti

### Neposredni plan

1. Deterministički optimizer i poređenje konfiguracija: maksimalna proizvodnja, približavanje potrošnji i ručni scenario.
2. Istorija simulacija: lista, detalji, poređenje i bolji projektni dashboard.
3. Verifikacija kompletnog novog energy-comparison toka unutar Docker okruženja i dodavanje frontend testova za njegova stanja.

### Kasniji plan

- Open-Meteo integracija i kratkoročna procjena proizvodnje.
- PDF/CSV izvještaji.
- OpenAI adapter za objašnjenje rezultata, savjetnika i opcionalnu obradu računa uz saglasnost i validaciju; AI ne radi osnovni numerički proračun.
- Upload računa, kontrolisano izdvajanje potrošnje i sigurno čišćenje fajlova.
- Dodatno sigurnosno učvršćivanje, rate limiting, CI/deployment i end-to-end demonstracioni scenario za diplomski rad.

### Van trenutnog obima

- Finansijski ROI i cijene sistema, baterije, admin panel, 3D/LiDAR, automatsko prepoznavanje krova sa satelita, precizno sjenčenje i zvanična statička/elektrotehnička verifikacija.

## 9. Posljednji zadatak

Posljednji commitovani razvojni paket na trenutnom `HEAD`-u je **PVGIS analiza proizvodnje i profil potrošnje** (`92d5e89`). U trenutnom, još necommitovanom radnom stablu posljednji zadatak je **poređenje proizvodnje i potrošnje**: read-only backend servis/endpoint i prikaz na Production Analysis stranici.

## 10. Sljedeća tri konkretna koraka

1. **Verifikacija trenutnog zadatka** — pokrenuti puni backend pytest u Docker kontejneru i pregledati Production Analysis nakon prijave za kompletan, parcijalan i godišnji profil.
2. **Korekcija statusa projekta** — zamijeniti statički `Draft` stvarnim `project.status` podatkom i testirati prelaz nakon PVGIS simulacije.
3. **Optimizer — prvi vertikalni rez** — definisati schema/service za režim maksimalne godišnje proizvodnje uz ograničen, keširan skup kandidata; zatim proširiti na režim prema potrošnji.

## Pravila za nastavak u novom razgovoru

- Prvo pročitati ovaj dokument, zatim provjeriti `git status`, posljednje commit-e i relevantne fajlove; dokument može zastarjeti.
- Ne mijenjati arhitekturu ili šemu baze bez objašnjenja razloga i migracionih posljedica.
- Ne pushati `docs/master-specification.md` niti tajne/API ključeve.
- Ne dokumentovati niti dijeliti testne lozinke; lokalni testni korisnik postoji, ali su pristupni podaci namjerno izostavljeni.
- Kod i UI ostaju na engleskom, objašnjenja korisniku na srpskom.
