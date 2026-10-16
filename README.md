# Dastavez Guide

Search any Indian government document and see the full process to get it, step by step: who can apply, which papers to carry, every step from form to delivery, fees, timelines, official portals, helplines and YouTube explainers.

## Features

- 16 documents: Passport, Learner's Licence, Driving Licence, Aadhaar, PAN, Voter ID, Ration Card, Birth, Death, Income, Caste, Domicile and Marriage certificates, Ayushman Card, ABHA and e-Shram
- 11 languages: English, हिन्दी, मराठी, ગુજરાતી, বাংলা, ਪੰਜਾਬੀ, ଓଡ଼ିଆ, தமிழ், తెలుగు, ಕನ್ನಡ, മലയാളം
- Search with typo tolerance ("adhaar", "DL", "licence") and native-script search
- Step checklist with progress, clickable official links on each step
- Optional sign-up to save documents (stored in the browser only, no server)
- Light theme by default, dark theme on demand, works on phones down to 320px

## Project structure

```
index.html      Page, styles, English content and app logic
i18n/*.json     Translations (UI strings + all document guides), loaded on demand
```

No build step and no dependencies. Fonts come from Google Fonts.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. (Opening `index.html` directly works for English; other languages need a local server because they are fetched.)

## Adding or editing a document

1. Add or edit the entry in the `DOCS` array in `index.html` (English).
2. Add the same `id` under `docs` in every `i18n/*.json` file, with the same number of `steps` and `docs` items.
3. A step's `w` field becomes a clickable link: a domain (e.g. `passportindia.gov.in`) links to that site; any other text links to the document's official portal.

## Disclaimer

This is an independent guide, not a government website. Fees and timelines change, so always confirm on the official portal. Translations were machine-assisted and should be reviewed by native speakers.
