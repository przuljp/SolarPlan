# SolarPlan — razvojni kontekst

> Stanje dokumentovano: 6. novembar 2026.
> Grana: `main` (`origin/main`)
> Posljednji objavljeni commit: `532ccae fix: preserve saved layouts and refine responsive workflows`. QA i responzivne ispravke su commitovane i pushane na `origin/main`; naknadno stanje provjeriti kroz `git status`.

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
- Asinhroni SQLAlchemy/asyncpg, PostgreSQL i Alembic migracije `0001`–`0008`.
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
- Konverzija kompasnog azimuta u PVGIS konvenciju; sistemski gubitak podrazumijevano je 14%, a ručni unos je ograničen na 0–30%.
- Production Analysis i Optimizer koriste zajedničku progresivnu kontrolu: osnovni tok prikazuje preporučenih 14%, a numerički unos, reset i objašnjenje dostupni su kroz ručno podešavanje.
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

### Optimizer konfiguracija

- Tri deterministička režima: maksimalna godišnja proizvodnja, približavanje pouzdanoj godišnjoj potrošnji i evaluacija ručno sačuvanog plana.
- Automatsko poređenje svih verifikovanih panela uz zajednički model panela i nezavisan kapacitet/orijentaciju svake krovne plohe.
- PVGIS specifični prinos računa se jednom po krovnoj plohi i koristi za reproducibilno rangiranje izvodljivih konfiguracija.
- Čuvanje rang-liste, odbijenih modela, metodologije i ulaznog hash-a u `configuration_optimizations`.
- Primjena bilo kojeg kandidata ažurira layoute svih ploha i čuva novu nepromjenjivu energetsku simulaciju.
- Stari rezultat se odbija sa `409` ako su lokacija, krov, paneli ili ručni layout promijenjeni nakon optimizacije.
- Frontend ekran prikazuje cilj, 2–5 kandidata, razlaganje po plohama i razlog preporuke.

### Istorija simulacija

- Za projekat se prikazuje hronološka lista svih sačuvanih PVGIS i optimizer simulacija.
- Sažetak simulacije prikazuje izvor, datum, godišnju proizvodnju, snagu sistema, broj panela, model panela i procijenjene gubitke.
- Detalj koristi nepromjenjivi `EnergySimulation` snapshot i ne poziva PVGIS ponovo niti vraća staru konfiguraciju krova.
- Frontend ima poseban read-only prikaz istorijskog rezultata sa mjesečnim vrijednostima, pretpostavkama i doprinosom svake krovne plohe.
- Istorija je dostupna iz pregleda projekta i trenutne Production Analysis stranice.

### Poređenje dvije simulacije

- Korisnik bira tačno dvije stavke iz istorije; starija automatski postaje baseline, a novija comparison.
- Read-only servis poredi model i broj panela, ukupni kWp, godišnju proizvodnju, specifični prinos, sistemske gubitke i mjesečnu proizvodnju.
- Poređenje koristi samo sačuvane snapshot-e, ne poziva PVGIS i ne mijenja projekat ili bazu.
- Po dogovoru se ne prikazuju razlike po pojedinačnim krovnim plohama.

### PDF/CSV izvještaji

- Preuzimanje iz Production Analysis i detalja bilo koje istorijske simulacije.
- PDF: podaci o lokaciji i izvoru, stvarni sistemski gubici, godišnja proizvodnja, snaga i specifični prinos, mjesečni grafikon i tabela, paneli i doprinosi ploha, datum i ograničenja procjene.
- CSV: jedinstvene kolone `section`, `roof_surface_id`, `name`, `metric`, `month`, `value`, `unit`; projektne i mjesečne vrijednosti, podaci o panelima i pojedinačnim plohama. UTF-8 BOM za Excel i zaštita tekstualnih ćelija od tumačenja kao formula.
- Backend `report_service` koristi ReportLab za PDF, Python `csv` za CSV i postojeći servis za autorizovano čitanje simulacije; frontend zajedničku komponentu `SimulationReportActions` sa pending/error stanjima.
- Nema novog PVGIS poziva, ponovnog obračuna gubitaka, migracije baze ili trajnog čuvanja fajlova.

## 3. Najvažnije arhitektonske odluke

- OpenAI nije alat za računanje. Nakon primjedbe da su objašnjenja generička, uvedene su reference `{{path}}` na backendov `display_values` skup. Servis ih zamjenjuje stvarnim brojevima i jedinicama; odbija nepoznate reference, proizvoljne cifre i sažetak bez snage/godišnje proizvodnje. Sezonski dio mora referencirati mjesečne rezultate, a potrošnja/poređenje svoj kontekst. Konačno objašnjenje sadrži konkretne brojke. Provjerava se porijeklo brojeva, ne garantuje semantička tačnost svake AI tvrdnje. Nema alata koji AI-ju dozvoljavaju izmjenu projekta.
- AI objašnjenja se generišu samo na klik. Trenutna potrošnja uključuje se samo uz izbor korisnika; u poređenju se odnosi na baseline. Adresa, koordinate, imena i privatni identifikatori nisu dio spoljnog zahtjeva.

- PDF/CSV se generišu na zahtjev iz nepromjenjivog snimka simulacije, uz postojeću provjeru vlasništva. Nema nove tabele, migracije ili trajnog skladištenja fajlova. Trenutna potrošnja nije dio tog snimka i zato nije uključena u izvještaj.

- `repositories` su ekvivalent DAO sloju. Naziv je drugačiji, ali odgovornost je ista: izolacija upita prema bazi.
- `/api/v1` omogućava kasnije mijenjanje API-ja bez lomljenja postojećih klijenata.
- Projekat je vlasnički korijen agregata: svi privatni podaci se dohvaćaju kroz projekat i njegovog korisnika.
- Krov nije modelovan kao jedna ploha. Jedan projekat može imati više strana krova, jer paneli mogu biti raspoređeni na više nagiba i azimuta.
- Pravougaonik nije dovoljan, pa je uveden trapez sa gornjom/donjom širinom i horizontalnim pomakom vrha.
- Korisnik je izabrao **jedan zajednički model panela za sve plohe projekta**. Time zbirna snaga i poređenje rezultata ostaju razumljivi, a konfiguracija realistična za jednu instalaciju.
- Raspored je deterministički, a ne AI-generisan. Isti ulaz mora dati isti položaj i broj panela.
- PVGIS je autoritativni numerički izvor. Budući AI može objašnjavati rezultate i pozivati alate, ali ne smije izmišljati energetske proračune.
- OpenAI integracija je serverski `httpx` adapter koji dobija provjerene energetske podatke i sačuvane rezultate simulacije. API ključ ostaje isključivo u backend okruženju, a strukturisan odgovor omogućava predvidljiv prikaz u interfejsu i obradu odbijanja ili greške.
- AI objašnjenje ne mijenja krovove, rasporede, optimizacije ili numeričke rezultate. PVGIS, deterministički optimizer i podaci iz baze ostaju jedini autoritativni izvori tih vrijednosti.
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
Project 1 ── N ConfigurationOptimization
```

- `User` je vlasnik projekata.
- `Project` objedinjuje jednu planiranu solarnu instalaciju.
- `ProjectLocation` daje koordinate potrebne za mapu i PVGIS.
- `RoofSurface` opisuje svaku stranu krova nezavisno.
- `PanelLayout` pripada jednoj plohi i referencira model iz kataloga `SolarPanel`.
- Servis rasporeda provjerava da svi layout-i projekta koriste isti panel.
- PVGIS servis za svaku plohu koristi lokaciju, nagib, azimut, broj panela i snagu panela; zatim sabira mjesečne i godišnje rezultate.
- `EnergySimulation` čuva kompletan snapshot ulaza i rezultata, pa projekat može imati više istorijskih simulacija.
- `ElectricityConsumptionProfile` je odvojen od simulacije; izvedeni servis poredi profil sa posljednjim sačuvanim energetskim rezultatom bez izmjene oba izvora.
- `ConfigurationOptimization` čuva poređenje kandidata; izabrani kandidat može referencirati simulaciju nastalu njegovom primjenom.
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
- `GET /projects/{project_id}/simulations` — hronološka lista sažetaka sačuvanih simulacija.
- `GET /projects/{project_id}/simulations/latest` — posljednja simulacija.
- `GET /projects/{project_id}/simulations/compare` — poređenje dva sačuvana snapshot-a preko `baseline_id` i `comparison_id`.
- `GET /projects/{project_id}/simulations/{simulation_id}` — kompletan read-only snapshot jedne simulacije.
- `GET /projects/{project_id}/simulations/{simulation_id}/report?format=pdf|csv` — preuzimanje izvještaja iz odabrane simulacije; podrazumijevani format je PDF, pristup je ograničen na vlasnika projekta.
- `GET /ai/status` — autentifikovana provjera da li je backend ključ konfigurisan; ne provjerava pristup modelu niti izlaže ključ.
- `POST /projects/{project_id}/simulations/{simulation_id}/explanation` — OpenAI objašnjenje odabranog snimka. Tijelo: opcioni `comparison_simulation_id` i `include_current_consumption` (podrazumijevano `false`). Brojčani ulazi se uvijek čitaju iz baze, uz provjeru vlasništva nad projektom i pripadnosti simulacija.

### Potrošnja

- `GET /projects/{project_id}/consumption` — profil potrošnje.
- `PUT /projects/{project_id}/consumption` — kreiranje ili izmjena profila.

### Poređenje proizvodnje i potrošnje

- `GET /projects/{project_id}/energy-comparison` — izvedeni read-only rezultat iz posljednje simulacije i postojećeg profila potrošnje.

### Optimizer konfiguracija

- `POST /projects/{project_id}/optimize` — računa i čuva rang-listu prema izabranom kriteriju.
- `GET /projects/{project_id}/optimizations/latest` — vraća posljednje sačuvano poređenje.
- `POST /projects/{project_id}/optimizations/{optimization_id}/select` — validira i primjenjuje izabrani kandidat te čuva simulaciju.

### Neaktivni legacy kod

U repozitoriju još postoje model, migracija i izvorni router za staru jednu `RoofConfiguration` i rutu `/projects/{project_id}/roof`, ali router nije registrovan u aplikaciji. Aktivni tok koristi `RoofSurface`. Brisanje legacy koda i eventualna migracija starih podataka tek treba da se procijene.

## 6. Trenutno stanje testova

### Potvrđeno u posljednjoj provjeri

- Frontend: `npm test` — **29/29 testova prolazi**, uključujući AI stanja i sklapanje bez dodatnog zahtjeva, prikaz/skrivanje lozinke na prijavi i registraciji, sačuvani raspored i izolaciju cache-a između sesija.
- Frontend: `npm run build` — produkcijski TypeScript/Vite build prolazi; postoji upozorenje da je glavni JS chunk veći od 500 kB.
- Backend: kompletna pytest kolekcija — **171/171 test prolazi**. AI testovi pokrivaju strukturisani odgovor, reference i formatiranje stvarnih brojeva, odbijanje nepoznatih referenci i proizvoljnih cifara, vlasništvo, cache/cooldown, parcijalnu potrošnju i poređenje bez razlika po plohama. OpenAI je mockovan u automatizovanim testovima.
- Backend: Ruff provjera `backend/app` i `backend/tests` prolazi.
- Probni PDF je renderovan i vizuelno pregledan na obje stranice; stvarni API je provjeren za PDF i CSV uz privremene sintetičke podatke.
- AI interfejs je vizuelno provjeren na desktopu i mobilnom ekranu kroz privremeni QA prikaz sa sintetičkim podacima i simuliranim odgovorom; ovo nije test kvaliteta odgovora stvarnog modela.

## 7. Poznati problemi i stvari koje treba provjeriti

### Poznato

- Legacy `RoofConfiguration` kod i tabela još postoje uz novi model `RoofSurface`.
- Mobilno prelivanje analysis grida i tooltipa ispravljeno je; provjereno na 390px, 800px i desktopu. Grafikoni imaju lokalno horizontalno skrolovanje.
- Stvarno AI poređenje jednom je vratilo 503, a ručni ponovni pokušaj je uspio. Uzrok prvog pokušaja nije potvrđen; adapter sada bilježi samo vrstu greške, bez osjetljivih podataka.

### Treba provjeriti

- Stvarni tok sa parcijalnom potrošnjom, optimizerom, poređenjem i OpenAI objašnjenjima sada je prošao na zasebnom QA nalogu. Obim i ograničenja zabilježeni su u `docs/USER_FLOW_QA.md`.
- Provjeriti puni end-to-end tok nakon čistog `docker compose up --build`: registracija → projekat → lokacija → više ploha → layout → PVGIS → potrošnja.
- Provjeriti da li u lokalnoj razvojnoj bazi još postoji privremena trapezna test-ploha; to je podatak iz razgovora, ne dio verzionisanog koda.
- Vite sada koristi polling zbog Windows Docker bind mounta; izmjene su potvrđene bez ponavljanja restarta nakon konfiguracije.

## 8. Planirane funkcionalnosti

### Neposredni plan

1. Završni end-to-end scenario provjeren je u lokalnom okruženju; pregledati `docs/USER_FLOW_QA.md` za konkretne scenarije.
2. Sigurnosno učvršćivanje i provjera rada pri deploymentu.
3. Deployment i priprema demonstracije za diplomski rad.

### Kasniji plan

- Opcionalna obrada računa uz izričitu saglasnost, validaciju izdvojenih vrijednosti i sigurno čišćenje fajlova.
- Dodatno sigurnosno učvršćivanje, rate limiting, CI/deployment i end-to-end demonstracioni scenario za diplomski rad.

### Nove korisničke ideje — status implementacije

Korisnik je prvo tražio evidenciju pet ideja, a zatim implementaciju stavki 4 i 5. Stavke 1–3 ostaju za narednu sesiju, po dogovoru.

1. **Potvrda email adrese** — potvrditi da korisnik ima pristup adresi navedenoj pri registraciji. Servis za slanje emailova i pravila pristupa prije potvrde još treba dogovoriti.
2. **Forgot password** — omogućiti pokretanje oporavka pristupa i bezbjedno postavljanje nove lozinke putem emaila. Detalje tokena, rok važenja i slanje poruka definisati pri implementaciji.
3. **Delete account** — dodati korisničku sekciju za brisanje sopstvenog naloga. Prije implementacije definisati potvrdu identiteta, tretman projekata i povezanih podataka te da li je brisanje trajno ili postoji period oporavka.
4. **Show/hide password — implementirano** na prijavi i registraciji. Lozinka je početno skrivena; Show/Hide mijenja samo tip inputa, čuva unesenu vrijednost i ne šalje formu. Prelazak između formi vraća skriven prikaz.
5. **Sakrij/prikaži AI objašnjenje — implementirano** u zajedničkom `AiExplanationPanel`, uključujući poređenje. Hide/Show explanation sklapa i otvara već dobijeni odgovor bez novog OpenAI poziva. Dugme ima `aria-expanded` i vezu sa kontrolisanim sadržajem.

UI i nazivi kontrola ostaju na engleskom; korisniku se razvoj objašnjava na srpskom. Redoslijed preostale tri funkcionalnosti još treba dogovoriti.

### Van trenutnog obima

- Kratkoročna vremenska prognoza i Open-Meteo integracija: SolarPlan je alat za dugoročno planiranje, a PVGIS već daje tipičnu godišnju i mjesečnu procjenu prema koordinatama projekta.
- Finansijski ROI i cijene sistema, baterije, admin panel, 3D/LiDAR, automatsko prepoznavanje krova sa satelita, precizno sjenčenje i zvanična statička/elektrotehnička verifikacija.

## 9. Posljednji zadatak i odluka

Najnoviji UI paket: Show/Hide password na prijavi/registraciji i sklapanje AI objašnjenja bez dodatnog zahtjeva. Frontend testovi 29/29 i build prolaze; prikaz provjeren u browseru na mobilnoj širini. Korisnik je tražio commit/push sada, a potvrdu emaila, forgot password i delete account ostavlja za narednu sesiju.

Završna potvrda ovog paketa: 171/171 backend test prolazi i nakon dorade parcijalne potrošnje, Ruff prolazi, stvarni pojedinačni odgovor navodi provjerene mjesečne bilanse bez pogrešnog godišnjeg podzbira. Backend je restartovan radi učitavanja novog koda i health endpoint vraća 200. Privremena smoke skripta je uklonjena; aplikacijski podaci nisu mijenjani.

Najnoviji zadatak: projektno specifična AI objašnjenja umjesto opštih definicija. Promijenjeni su prompt, validacija i cache verzija (`solarplan-explanation-v2-evidence`); dodan je `services/explanation_evidence.py`. API i frontend format ostaju kompatibilni, bez biblioteka ili migracije. Potrošnja je i dalje opcioni trenutni profil, a poređenje ostaje zbirno bez razlika po plohama. Redundantna godišnja proizvodnja uklonjena je iz AI konteksta potrošnje da se ne zamijeni sa podzbirom poznatih mjeseci. Ciljani testovi: 38 prolazi; kompletni backend: 171 prolazi prije posljednje male dorade konteksta. Stvarni sintetički testovi pojedinačne simulacije i poređenja sa potrošnjom dali su projektno specifične brojeve; jedan pojedinačni pokušaj bio je odbijen validacijom prije uspješnog ponavljanja. Nove ideje za nalog i sklapanje AI prikaza iz odjeljka 8 ostaju planirane.

Posljednji zadatak je **završna provjera korisničkog toka i ciljane ispravke**: učitavanje sačuvanog rasporeda, izolacija cache-a između sesija, mobilni grid/tooltip, jasna poruka o snapshot-u i Vite polling. Detalji su u `docs/USER_FLOW_QA.md`. Prethodni paket su OpenAI objašnjenja preko Responses API-ja, postojećeg `httpx` klijenta i `store: false`; model je `gpt-5-mini`. Nema nove biblioteke ili migracije.

Prazno `SOLARPLAN_OPENAI_API_KEY=` je dodato u root `.env` i `.env.example`; ključ se Docker-om prosljeđuje samo backendu. Potrošnja je opcioni trenutni kontekst, nije istorijski snapshot. Objašnjenja se ne čuvaju u bazi niti ubacuju u PDF/CSV. Cache je vlasnički, do 128 stavki / sat, uz cooldown od deset sekundi i jedan aktivan zahtjev po korisniku; sve je lokalno procesu i resetuje se restartom. Distribuirano ograničavanje zahtjeva ostaje završni deployment zadatak.

Korisnik je zatim dodao ključ u lokalni `.env`; backend ga je učitao. Stvarni OpenAI poziv sa sintetičkim podacima uspješno je završen (HTTP 200, `completed`, validiran strukturisani odgovor). Potrošnja i poređenje u ovom stvarnom testu nisu bili uključeni. Nakon provjere korisnik je zatražio commit i push ovog paketa.

Ranije je dogovoreno da se Open-Meteo ne implementira: kratkoročna prognoza ne doprinosi glavnom cilju dugoročnog planiranja, dok PVGIS ostaje autoritativni izvor tipične godišnje i mjesečne proizvodnje. OpenAI tumači već provjerene rezultate.

## 10. Sljedeća tri konkretna koraka

1. **Odabir narednog funkcionalnog paketa** — QA ispravke su već pushane (`532ccae`); novih pet ideja je zabilježeno u odjeljku 8, a njihov redoslijed implementacije još treba dogovoriti.
2. **Sigurnosno učvršćivanje** — provjera vlasništva i grešaka, produkcijske konfiguracije i distribuiranog ograničavanja AI zahtjeva.
3. **Deployment i demonstracija** — reproducibilno pokretanje i priprema scenarija za odbranu diplomskog rada.

## Pravila za nastavak u novom razgovoru

- Prvo pročitati ovaj dokument, zatim provjeriti `git status`, posljednje commit-e i relevantne fajlove; dokument može zastarjeti.
- Ne mijenjati arhitekturu ili šemu baze bez objašnjenja razloga i migracionih posljedica.
- Ne pushati `docs/master-specification.md` niti tajne/API ključeve.
- Ne dokumentovati niti dijeliti testne lozinke; lokalni testni korisnik postoji, ali su pristupni podaci namjerno izostavljeni.
- Kod i UI ostaju na engleskom, objašnjenja korisniku na srpskom.
