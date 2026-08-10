# Voorbeeldwedstrijd-matching

Doel: het wedstrijdnummer vinden waarvan de door de app *gesimuleerde*
wedstrijd (5 innings, Honkbal, Honkvast=uit / Bal op het dak=thuis) qua
**plays** het dichtst in de buurt komt van de voorbeeldwedstrijd uit de
officiële KNBSB "Scorer 1"-cursus-PDF (hoofdstuk 'Voorbeeldwedstrijd',
p. 22-28). Er is geen wedstrijdnummer dat de PDF-wedstrijd exact
reproduceert — de generator van de app is onafhankelijk van dat verhaal —
dus dit is een dichtstbijzijnde-match, geen replay.

## Bestanden

- **`voorbeeldwedstrijd.json`** — de voorbeeldwedstrijd uit de PDF:
  slagvolgorde, wissels, het play-by-play verhaal per halve inning (letterlijk
  overgenomen uit de PDF-tekst), de eindstand per inning, en `speelacties`:
  een handmatige telling van het verhaal, gegroepeerd naar dezelfde
  categorieën als de scoreteken-vocabulaire van de app zelf (zie
  `REACH_BUTTONS`/`OUT_BUTTONS`/`SPECIAL_BUTTONS`/`RUNNER_BUTTONS` in
  `index.html`): `hit1`, `hit23`, `hr`, `bb` (BB+IBB+HP+INT/OB), `k` (elke
  K-variant), `fly` (F/L/IF/FF), `ground` (cijfercodes), `fc`, `sac`
  (SH+SF), `e`, `sb`, `cs` (CS+PO), `misplay` (WP+PB+BK).
- **`find-matching-wedstrijdnummer.mjs`** — de brute-force zoeker.

## Methodiek

1. **Doelwaarden vaststellen.** De `speelacties`-telling in
   `voorbeeldwedstrijd.json` is met de hand afgeleid uit de PDF-tekst, per
   team, per halve inning, en gecontroleerd tegen de officiële scorekaart-
   afbeelding op p. 27-28 (o.a. de "K23"- en "85"-codes zijn zo
   geverifieerd) en tegen de eindstand per inning (elke tussenstap moest
   optellen tot dezelfde punten-per-inning als de PDF).

2. **Headless simulatie.** Het script laadt `index.html` één keer in JSDOM
   (via `tests/helpers/loadApp.js`, dezelfde manier als de testsuite) en
   roept vervolgens voor elk te proberen wedstrijdnummer `initGame()` aan,
   gevolgd door een lus die `generateEvent()`/`applyEventToState()` direct
   aanroept — dezelfde functies die `nextTurn()` gebruikt, maar zonder DOM-
   rendering. Dat mag: `applyEventToState()` past de *werkelijke* speluitkomst
   toe ongeacht wat een speler zou hebben geantwoord (zie `submitAnswer()`),
   dus een headless doorloop levert exact dezelfde einduitkomst op als een
   volledige playthrough via de UI — alleen vele malen sneller (~0.5 ms per
   wedstrijd i.p.v. tientallen ms met DOM-rendering).

3. **Plays uitlezen.** Na afloop wordt `G.scorecard` voor beide teams
   doorlopen. Elke honk-vakje-quadrant (`1e`/`2e`/`3e`/`thuis`/`out`) bevat
   een of meer scoretekens; elk token wordt met een regex geclassificeerd in
   dezelfde categorieën als hierboven. **Let op de valkuil met kale
   cijfercodes**: een grondbal-uit (bv. `"63"` of `"3"`) staat altijd onder
   de `out`-key, maar exact zo'n kaal cijfer kan óók een
   opschuif-aantekening zijn (`buildAdvanceCreditEvent` schrijft het
   slagvolgordenummer van de slagman die een loper liet opschuiven, bv.
   `"4"`, onder `1e`/`2e`/`3e`/`thuis`) — dat is geen eigen speelactie en
   telt dus alleen mee als `ground` wanneer de key `out` is.

4. **Afstandsmaat.** Voor elk kandidaat-wedstrijdnummer wordt een
   `playDist` berekend (som van absolute verschillen per categorie, per
   team, t.o.v. `speelacties`) en een `runDist` (verschil per inning-score
   plus eindstand, per team). De totale score is `playDist * 3 + runDist`:
   plays wegen dus drie keer zo zwaar als de kale eindstand, omdat het
   doel is de plays te laten kloppen, niet alleen het bordje.

5. **Brute force.** Het volledige bereik dat de app zelf kan genereren
   (`randomMatchNumber()`: 100000–999999, dus 900.000 wedstrijden) wordt
   doorzocht. Op deze machine (4 cores) is dat in vier gelijke stukken
   parallel te draaien in enkele minuten; zie hieronder.

## Reproduceren

```sh
# hele bereik in één proces (langzamer, geen sharding nodig voor kleine ranges)
node analysis/find-matching-wedstrijdnummer.mjs

# gesplitst over 4 processen (aanbevolen voor het volledige bereik)
node analysis/find-matching-wedstrijdnummer.mjs 100000 325000 &
node analysis/find-matching-wedstrijdnummer.mjs 325001 550000 &
node analysis/find-matching-wedstrijdnummer.mjs 550001 775000 &
node analysis/find-matching-wedstrijdnummer.mjs 775001 999999 &
wait
```

Elk shard print zijn eigen beste kandidaat (JSON met `matchNumber`,
`sim.plays`, `sim.score`/`sim.inningRuns`, en de opgesplitste `dist`); het
globale beste resultaat is de laagste `dist.total` over alle shards.

## Resultaat

Over het volledige bereik (100000–999999) is **wedstrijdnummer `795231`**
de beste match (`dist.total = 92`, waarvan `playDist = 22`): 6 van de 13
speelcategorieën komen exact overeen bij Honkvast (uitploeg), inclusief het
aantal honkslagen, homeruns, drie-slagen, grondbal-uitslagen, velderskeuzes
en gestolen honk-pogingen. Zelf bekijken:
`index.html?innings=5&sport=Honkbal&wedstrijd=795231`.
