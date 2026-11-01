# Bundled science data

`exoplanets.json` and `neighbors.json` preserve the NASA Exoplanet Archive `pscomppars` query, retrieval date and returned records. Composite tables combine publications and may contain derived estimates. The playable transiting planets' masses/radii are observational constraints, not direct surface measurements. The non-transiting 55 Cnc b radius may be a catalog estimate. No atmospheric pressure, spin axis, terrain, ecology, ocean or moon is established by these records.

- NASA Archive and parameter documentation: https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html
- TRAPPIST-1 e: https://science.nasa.gov/exoplanet-catalog/trappist-1-e/
- 55 Cancri e and atmospheric evidence: https://science.nasa.gov/missions/webb/nasas-webb-hints-at-possible-atmosphere-surrounding-rocky-exoplanet/

`stars.json` is an adapted 125-object subset of **HYG 4.1**, by **David Nash / Astronexus**, based on Hipparcos, Yale Bright Star and Gliese catalogs. This data adaptation is licensed **Creative Commons Attribution–ShareAlike 4.0**: https://creativecommons.org/licenses/by-sa/4.0/ . Source: https://github.com/astronexus/HYG-Database/tree/main/hyg/CURRENT . Source SHA-256, selection rule and original catalog link are embedded in the JSON. Recreate it with `node scripts/import-star-catalog.mjs` from `tidefall/`; gameplay uses the bundled file without network requests. This notice and the ShareAlike data license must accompany redistributed/adapted catalog data.

Coordinates/equinox are approximately J2000; HYG Cartesian velocities propagate stars from epoch 2000 to 2026. Observer displacement uses the catalog 55 Cnc host or the Archive TRAPPIST-1 position. Host astrometric epochs, distance uncertainties and radial velocities are not complete; those limits are retained instead of inventing uncertainties. The assumed planetary pole/site orientation is explicitly modeled. The Galactic band uses the IAU J2000 north Galactic pole (RA 192.85948°, Dec 27.12825°); its texture is an illustration, not a measured all-sky map. Procedural faint points are cosmetic and never selectable/catalog-labeled.

Neighboring planets use measured periods/semi-major axes but an assumed circular/copanar orbit, initial phase, radius where necessary and gray Lambert albedo 0.3. Brightness is an approximate optical proxy without a full spectral/thermal phase model. The current simulation is not a precision ephemeris.
