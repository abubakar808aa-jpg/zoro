# Connector roadmap operations

This release adds official-source foundations without activating production data writes.

## Active connector implementations

- **USAJOBS:** official `data.usajobs.gov/api/Search`; server-only `USAJOBS_API_KEY` and account email in `USAJOBS_USER_AGENT`; capped at five pages per source. Listings retain the USAJOBS source and application links and are labelled federal.
- **The Muse:** official public jobs API; capped at five pages. `THE_MUSE_API_KEY` is optional for development, but production use should register the app as The Muse requests. The Muse landing page is labelled as the original external listing, not an employer-direct application.
- **Economic news:** official RSS feeds from BLS, the Federal Reserve Board, Census Economic Indicators, and DOL News Releases. JobMan stores/displays only headline, short excerpt, source, publication time, category, freshness, and canonical link—never full article text.
- **Yelp provider discovery:** official Places Business Search, admin-only, server-only key. Candidates include name, Yelp URL, rating/review count, categories, and city/state. Phone numbers and street addresses are intentionally discarded. Queue approval does not create a public profile or contact a business.
- **DataSF demand:** official public 311 and Building Permits datasets. SoQL aggregates by category and broad neighborhood before returning data; no addresses, coordinates, request IDs, or individual records reach JobMan.

## Disabled partner gates

- **Taskrabbit:** no public connector is enabled. Obtain written partner/API access for this use case before implementation.
- **Upwork:** no connector is enabled. Obtain approved API access for job-listing distribution before implementation.
- **Adzuna:** disabled. The published API terms allow listing publication but require “Jobs by Adzuna” attribution and state that ongoing commercial/aggregated use after a 14-day validation trial may require written consent/license. Termination requires removing acquired data. Record written commercial approval in internal compliance records before setting `ADZUNA_TERMS_APPROVED_AT`; credentials alone never enable the adapter.

Official references:

- USAJOBS: https://developer.usajobs.gov/api-reference/get-api-search
- The Muse: https://www.themuse.com/developers/api/v2
- BLS: https://www.bls.gov/feed/
- Federal Reserve: https://www.federalreserve.gov/feeds/feeds.htm
- Census: https://www.census.gov/about/contact-us/feeds.html
- DOL: https://www.dol.gov/rss
- Yelp: https://docs.developer.yelp.com/reference/v3_business_search
- DataSF 311: https://dev.socrata.com/foundry/data.sfgov.org/vw6y-z8j6
- DataSF Building Permits: https://data.sfgov.org/d/i98e-djp9
- Adzuna terms: https://developer.adzuna.com/docs/terms_of_service

## Production enablement checklist

1. Add only server-side credentials in the deployment environment; never use `NEXT_PUBLIC_` for connector secrets.
2. Add explicit source configurations to `CONNECTOR_SOURCES_JSON`; do not enable broad imports by default.
3. Run each connector once in staging and inspect `sourceFetchLogs`, counts, deduplication, external destinations, and missing-job lifecycle.
4. Confirm news-source health in `/api/feed/news` and inspect the source URLs before production.
5. Keep Yelp and DataSF views admin-only until product/legal review confirms the intended use and display obligations.
6. Leave Taskrabbit, Upwork, and Adzuna disabled until their dashboard gates state the required external approval has been documented and a separate implementation review is approved.
